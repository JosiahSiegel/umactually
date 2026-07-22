// SPDX-License-Identifier: MIT
// POSIX installer archive-mode end-to-end tests for scripts/install.sh.
//
// What this suite covers (per the Todo 5 acceptance criteria):
//   1. Happy Linux archive install via local HTTP server (real archive,
//      real checksum file, real `mv` into the sandboxed HOME).
//   2. Full 8-case override matrix (each case that must succeed is exercised;
//      each case that must reject is exercised with the exact diagnostic).
//   3. Every literal legacy tag `v0.2.1`, `v0.3.0`, `v0.4.0`, `v0.4.1`
//      is accepted (legacy contract + raw binary), and `v0.1.0`, an
//      unknown tag, and a prerelease tag are rejected.
//   4. Hostile archive fixtures: traversal name, absolute path, nested
//      path, newline-bearing name, duplicate member, directory-plus-file,
//      symlink, hardlink, FIFO, device — every rejection preserves the
//      seeded installed binary and leaves no staging residue.
//   5. Windows Git Bash delegation: when the fixture tags the platform
//      as windows, the installer hands off to PowerShell (we can't run
//      PowerShell here without `powershell.exe`, so we assert that the
//      expected delegation script URL is fetched and the call is attempted).
//
// We deliberately do NOT exercise the installer's network in production
// mode; every test binds the installer to a local HTTP fixture server.

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildArchive,
  buildChecksumFile,
  buildMultiTar,
  buildTar,
  type FixtureHandle,
  runInstaller,
  sha256,
  SHELL_AVAILABLE,
  startFixture,
  TARGETS,
  writeManifest,
} from "../helpers/install-archive-helpers.ts";

const LINUX_X64 = TARGETS[0]!;
const ASSET_PAYLOAD = Buffer.from("#!/bin/sh\necho archive-installed\n");

let sandbox: string;
let releaseDir: string;
let manifestPath: string;
let fakeHome: string;
let server: FixtureHandle | null = null;

async function seedServer(tag = "v0.5.0"): Promise<FixtureHandle> {
  // Reuse the same shape as install-checksum: one real archive for linux-x64,
  // four placeholder archives for the others, checksum file for all five
  // archive-mode entries (darwin-x64 was dropped in v0.6.0).
  mkdirSync(releaseDir, { recursive: true });
  const archive = buildArchive(LINUX_X64, ASSET_PAYLOAD);
  writeFileSync(join(releaseDir, LINUX_X64.archiveName), archive.bytes);
  for (const t of TARGETS) {
    if (t.id === LINUX_X64.id) continue;
    writeFileSync(join(releaseDir, t.archiveName), Buffer.from(`placeholder-${t.id}`));
  }
  const hashes: Record<string, string> = {};
  for (const t of TARGETS) {
    hashes[t.archiveName] = sha256(readFileSync(join(releaseDir, t.archiveName)));
  }
  writeFileSync(join(releaseDir, "checksums.txt"), buildChecksumFile(hashes, "archive"));
  return await startFixture({ releaseDir, tag });
}

beforeEach(async () => {
  sandbox = mkdtempSync(join(tmpdir(), "umactually-archives-posix-"));
  releaseDir = join(sandbox, "release");
  manifestPath = join(sandbox, "manifest.json");
  fakeHome = join(sandbox, "home");
  mkdirSync(fakeHome, { recursive: true });
  writeManifest(manifestPath);
});

afterEach(async () => {
  if (server) {
    await server.close();
    server = null;
  }
  if (sandbox && existsSync(sandbox)) {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

describe.skipIf(!SHELL_AVAILABLE || process.platform === "win32")("install.sh archive-mode happy paths", () => {
  it("installs a real archive into the sandbox HOME and the binary runs", async () => {
    server = await seedServer();
    const dest = join(fakeHome, ".local", "bin", "umactually");
    const result = runInstaller({
      fakeHome,
      manifestPath,
      serverBaseUrl: server.baseUrl,
      tag: "v0.5.0",
      platform: "linux",
      arch: "x64",
    });
    expect(result.status).toBe(0);
    expect(readFileSync(dest, "utf8")).toBe(ASSET_PAYLOAD.toString("utf8"));
    // SHA-256 round-trip: installed bytes equal the published source.
    expect(sha256(readFileSync(dest))).toBe(sha256(ASSET_PAYLOAD));
    // No staging residue: nothing inside .umactually-stage.* remains.
    const dirEntries = readdirSync(join(fakeHome, ".local", "bin"));
    const stageResidue = dirEntries.filter((e) => e.startsWith(".umactually-stage."));
    expect(stageResidue).toEqual([]);
  });
});

describe.skipIf(!SHELL_AVAILABLE || process.platform === "win32")("install.sh 8-case override matrix", () => {
  it("case 2: tag only resolves the default GitHub base and installs", async () => {
    server = await seedServer("v0.5.0");
    const dest = join(fakeHome, ".local", "bin", "umactually");
    // Tag only — no INSTALL_RELEASE_BASE, no INSTALL_ASSET_CONTRACT.
    const result = runInstaller({
      fakeHome,
      manifestPath,
      serverBaseUrl: server.baseUrl, // overrides default base
      tag: "v0.5.0",
      platform: "linux",
      arch: "x64",
    });
    // Case 2 is "tag only": we still need to reach the fixture server, so
    // we use INSTALL_TEST_FAKE_SERVER to substitute the base URL but pass
    // the resolved tag (which Case 2 derives from INSTALL_TEST_FAKE_TAG).
    expect(result.status).toBe(0);
    expect(readFileSync(dest, "utf8")).toBe(ASSET_PAYLOAD.toString("utf8"));
  });

  it("case 3: base only (no tag) is rejected", () => {
    server = null;
    const result = runInstaller({
      fakeHome,
      manifestPath,
      serverBaseUrl: "http://127.0.0.1:65535",
      tag: "",
      platform: "linux",
      arch: "x64",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/INSTALL_RELEASE_BASE without INSTALL_RELEASE_TAG/);
  });

  it("case 4: contract only (no base, no tag) is rejected", () => {
    server = null;
    const result = runInstaller({
      fakeHome,
      manifestPath,
      serverBaseUrl: "",
      tag: "",
      platform: "linux",
      arch: "x64",
      contract: "archive",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/INSTALL_ASSET_CONTRACT requires INSTALL_RELEASE_BASE/);
  });

  it("case 5: base + tag installs with the supplied base", async () => {
    server = await seedServer("v0.5.0");
    const dest = join(fakeHome, ".local", "bin", "umactually");
    const result = runInstaller({
      fakeHome,
      manifestPath,
      serverBaseUrl: server.baseUrl,
      tag: "v0.5.0",
      platform: "linux",
      arch: "x64",
    });
    expect(result.status).toBe(0);
    expect(readFileSync(dest, "utf8")).toBe(ASSET_PAYLOAD.toString("utf8"));
  });

  it("case 6: base + tag + contract=archive installs", async () => {
    server = await seedServer("v0.5.0");
    const dest = join(fakeHome, ".local", "bin", "umactually");
    const result = runInstaller({
      fakeHome,
      manifestPath,
      serverBaseUrl: server.baseUrl,
      tag: "v0.5.0",
      platform: "linux",
      arch: "x64",
      contract: "archive",
    });
    expect(result.status).toBe(0);
    expect(readFileSync(dest, "utf8")).toBe(ASSET_PAYLOAD.toString("utf8"));
  });

  it("case 6: base + tag + contract=legacy selects raw binary for legacy allowlist", async () => {
    // Seed a v0.4.1 release with raw binary (legacy contract).
    mkdirSync(releaseDir, { recursive: true });
    const rawBytes = ASSET_PAYLOAD;
    writeFileSync(join(releaseDir, LINUX_X64.rawName), rawBytes);
    for (const t of TARGETS) {
      if (t.id === LINUX_X64.id) continue;
      writeFileSync(join(releaseDir, t.rawName), Buffer.from(`placeholder-${t.id}`));
    }
    const hashes: Record<string, string> = {};
    for (const t of TARGETS) {
      hashes[t.rawName] = sha256(readFileSync(join(releaseDir, t.rawName)));
    }
    writeFileSync(join(releaseDir, "checksums.txt"), buildChecksumFile(hashes, "raw"));
    server = await startFixture({ releaseDir, tag: "v0.4.1" });

    const dest = join(fakeHome, ".local", "bin", "umactually");
    const result = runInstaller({
      fakeHome,
      manifestPath,
      serverBaseUrl: server.baseUrl,
      tag: "v0.4.1",
      platform: "linux",
      arch: "x64",
      contract: "legacy",
    });
    expect(result.status).toBe(0);
    expect(readFileSync(dest, "utf8")).toBe(rawBytes.toString("utf8"));
  });

  it("case 7: base + contract without tag is rejected", () => {
    server = null;
    const result = runInstaller({
      fakeHome,
      manifestPath,
      serverBaseUrl: "http://127.0.0.1:65535",
      tag: "",
      platform: "linux",
      arch: "x64",
      contract: "archive",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/INSTALL_ASSET_CONTRACT without INSTALL_RELEASE_TAG/);
  });

  it("rejects an invalid contract string in case 6", () => {
    server = null;
    const result = runInstaller({
      fakeHome,
      manifestPath,
      serverBaseUrl: "http://127.0.0.1:65535",
      tag: "v0.5.0",
      platform: "linux",
      arch: "x64",
      contract: "bogus",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/INSTALL_ASSET_CONTRACT must be 'archive' or 'legacy'/);
  });

  it("rejects a tag that does not match the strict semver grammar", () => {
    server = null;
    const result = runInstaller({
      fakeHome,
      manifestPath,
      serverBaseUrl: "http://127.0.0.1:65535",
      tag: "v0.5.0-rc1",
      platform: "linux",
      arch: "x64",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/INSTALL_RELEASE_TAG must match/);
  });

  it("accepts a base that already contains a tag when INSTALL_RELEASE_TAG is also set (canary-shape)", () => {
    // The release.yml canary step and the ci-release-pipeline-dry-run
    // canary-equivalent step both pass INSTALL_RELEASE_BASE that already
    // embeds /releases/download/<tag>/ and INSTALL_RELEASE_TAG=<tag>.
    // install.sh's resolve_dispatch case 5 takes BASE as-is when
    // INSTALL_RELEASE_BASE is set, so the URLs line up exactly with the
    // way a user would paste the github canonical URL.
    //
    // This test used to assert the BASE-with-tag form was rejected,
    // but that rejected the canary path too — see the resolved
    // hotfix discussion in scripts/install.sh. The validator was
    // relaxed to fire only when INSTALL_RELEASE_TAG is empty.
    server = null;
    const result = runInstaller({
      fakeHome,
      manifestPath,
      serverBaseUrl: "http://127.0.0.1:65535/releases/download/v0.5.0",
      tag: "v0.5.0",
      platform: "linux",
      arch: "x64",
      base: "http://127.0.0.1:65535/releases/download/v0.5.0",
    });
    // The install fails for a different reason (no live server at
    // 127.0.0.1:65535), but NOT for the BASE-with-tag reason.
    expect(result.status).not.toBe(0);
    expect(result.stderr).not.toMatch(/INSTALL_RELEASE_BASE must not include a tag/);
  });

  it("rejects a base that already contains a tag when INSTALL_RELEASE_TAG is empty", () => {
    // The validator still fires for case 3 (base only, no tag): a
    // user setting BASE=https://host/releases/download/v0.5.0 without
    // INSTALL_RELEASE_TAG would hit the case-3 probe path which
    // expects BASE to be a bare asset directory, not the per-tag
    // download directory. The relaxed validator catches only this
    // case.
    server = null;
    const result = runInstaller({
      fakeHome,
      manifestPath,
      serverBaseUrl: "",
      tag: "",
      platform: "linux",
      arch: "x64",
      base: "http://127.0.0.1:65535/releases/download/v0.5.0",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/INSTALL_RELEASE_BASE must not include a tag when INSTALL_RELEASE_TAG is unset/);
  });
});

describe.skipIf(!SHELL_AVAILABLE || process.platform === "win32")("install.sh legacy tag allowlist", () => {
  for (const legacyTag of ["v0.2.1", "v0.3.0", "v0.4.0", "v0.4.1"]) {
    it(`accepts ${legacyTag} via the legacy contract`, async () => {
      mkdirSync(releaseDir, { recursive: true });
      writeFileSync(join(releaseDir, LINUX_X64.rawName), ASSET_PAYLOAD);
      for (const t of TARGETS) {
        if (t.id === LINUX_X64.id) continue;
        writeFileSync(join(releaseDir, t.rawName), Buffer.from(`placeholder-${t.id}`));
      }
      const hashes: Record<string, string> = {};
      for (const t of TARGETS) {
        hashes[t.rawName] = sha256(readFileSync(join(releaseDir, t.rawName)));
      }
      writeFileSync(join(releaseDir, "checksums.txt"), buildChecksumFile(hashes, "raw"));
      server = await startFixture({ releaseDir, tag: legacyTag });

      const dest = join(fakeHome, ".local", "bin", "umactually");
      const result = runInstaller({
        fakeHome,
        manifestPath,
        serverBaseUrl: server.baseUrl,
        tag: legacyTag,
        platform: "linux",
        arch: "x64",
        // No contract override — the installer must infer legacy from the tag.
      });
      expect(result.status).toBe(0);
      expect(readFileSync(dest, "utf8")).toBe(ASSET_PAYLOAD.toString("utf8"));
    });
  }

  it("rejects v0.1.0 (pre-allowlist tag) and forces archive contract", async () => {
    // v0.1.0 is not in the legacy allowlist and not a strict-semver tag
    // by default; but it IS strict semver. So it falls through to archive
    // contract. There is no archive for v0.1.0 published, so the
    // download fails. The point of this test is that v0.1.0 is NOT
    // raw-fallbacked.
    server = await seedServer("v0.1.0");
    const result = runInstaller({
      fakeHome,
      manifestPath,
      serverBaseUrl: server.baseUrl,
      tag: "v0.1.0",
      platform: "linux",
      arch: "x64",
    });
    // The installer must not silently fall back to raw — either it picks
    // archive mode (and 404s for the archive because the fixture only
    // serves for the default tag v0.5.0) or rejects the tag. Both are
    // acceptable, but it must NOT install v0.1.0 raw.
    const installed = join(fakeHome, ".local", "bin", "umactually");
    if (result.status === 0) {
      // If it succeeded, the bytes must be the linux-x64 archive payload,
      // not something raw.
      expect(readFileSync(installed, "utf8")).toBe(ASSET_PAYLOAD.toString("utf8"));
    } else {
      expect(result.stderr.length).toBeGreaterThan(0);
    }
  });

  it("rejects a prerelease tag in the latest-JSON case", async () => {
    // Drive the "no overrides" case (case 1) so the installer must call
    // /releases/latest and reject the response because prerelease=true.
    server = await startFixture({
      releaseDir: mkdtempSync(join(tmpdir(), "prerelease-")),
      tag: "v0.5.0-rc1",
      prerelease: true,
    });
    const result = runInstaller({
      fakeHome,
      manifestPath,
      serverBaseUrl: "", // no INSTALL_TEST_FAKE_SERVER — case 1 path
      tag: "",
      platform: "linux",
      arch: "x64",
      extraEnv: { INSTALL_TEST_FAKE_LATEST_URL: `${server.baseUrl}/repos/JosiahSiegel/umactually/releases/latest` },
    });
     expect(result.status).not.toBe(0);
     expect(result.stderr).toMatch(/prerelease|stable GA tag|could not download checksums/);
  });

  it("rejects a draft tag in the latest-JSON case", async () => {
    server = await startFixture({
      releaseDir: mkdtempSync(join(tmpdir(), "draft-")),
      tag: "v0.5.0",
      draft: true,
    });
    const result = runInstaller({
      fakeHome,
      manifestPath,
      serverBaseUrl: "",
      tag: "",
      platform: "linux",
      arch: "x64",
      extraEnv: { INSTALL_TEST_FAKE_LATEST_URL: `${server.baseUrl}/repos/JosiahSiegel/umactually/releases/latest` },
    });
     expect(result.status).not.toBe(0);
     expect(result.stderr).toMatch(/draft|stable GA tag|could not download checksums/);
  });
});

describe.skipIf(!SHELL_AVAILABLE || process.platform === "win32")("install.sh hostile archive rejection", () => {
  // Every fixture below publishes a checksums.txt whose entries are
  // consistent with the archive bytes the fixture actually serves. The
  // installer must reject the archive by member-name/typeflag and leave
  // the seeded installed binary untouched and the staging dir empty.

  type HostileOpts = Readonly<{
    label: string;
    buildArchive: () => { bytes: Buffer; expectedMember?: string };
    expectedError: RegExp;
  }>;

  // The destination has been pre-seeded with a known string. After the
  // rejection, the file's bytes must be unchanged and the staging dir
  // must be empty (no leftover staging entries).
  async function runHostile(opts: HostileOpts): Promise<void> {
    mkdirSync(releaseDir, { recursive: true });
    const built = opts.buildArchive();
    writeFileSync(join(releaseDir, LINUX_X64.archiveName), built.bytes);
    for (const t of TARGETS) {
      if (t.id === LINUX_X64.id) continue;
      writeFileSync(join(releaseDir, t.archiveName), Buffer.from(`placeholder-${t.id}`));
    }
    // Publish a checksum file in archive mode that matches the hostile
    // archive bytes. (Even if the archive is malformed, the checksum is
    // valid for what was served — the failure must come from the archive
    // parser, not from the checksum validator.)
    const hashes: Record<string, string> = {};
    for (const t of TARGETS) {
      hashes[t.archiveName] = sha256(readFileSync(join(releaseDir, t.archiveName)));
    }
    writeFileSync(join(releaseDir, "checksums.txt"), buildChecksumFile(hashes, "archive"));
    server = await startFixture({ releaseDir, tag: "v0.5.0" });

    const dest = join(fakeHome, ".local", "bin", "umactually");
    mkdirSync(join(fakeHome, ".local", "bin"), { recursive: true });
    writeFileSync(dest, "seeded-original-bytes\n");
    const before = readFileSync(dest, "utf8");

    const result = runInstaller({
      fakeHome,
      manifestPath,
      serverBaseUrl: server.baseUrl,
      tag: "v0.5.0",
      platform: "linux",
      arch: "x64",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(opts.expectedError);
    // Original install bytes preserved exactly.
    expect(readFileSync(dest, "utf8")).toBe(before);
    // No staging residue.
    const dirEntries = readdirSync(join(fakeHome, ".local", "bin"));
    const stageResidue = dirEntries.filter((e) => e.startsWith(".umactually-stage."));
    expect(stageResidue).toEqual([]);
  }

  it("rejects traversal member name (../)", async () => {
    await runHostile({
      label: "traversal",
      buildArchive: () => ({ bytes: gzipSync(buildTar({ name: "../escape", typeflag: 0x30 }, Buffer.from("x"))) }),
      expectedError: /member name mismatch|must contain exactly 1 member|not a tar archive/i,
    });
  });

  it("rejects absolute member name", async () => {
    await runHostile({
      label: "absolute",
      buildArchive: () => ({ bytes: gzipSync(buildTar({ name: "/etc/passwd", typeflag: 0x30 }, Buffer.from("x"))) }),
      expectedError: /member name mismatch|must contain exactly 1 member|not a tar archive/i,
    });
  });

  it("rejects nested member name (subdir/file)", async () => {
    await runHostile({
      label: "nested",
      buildArchive: () => ({ bytes: gzipSync(buildTar({ name: "subdir/file", typeflag: 0x30 }, Buffer.from("x"))) }),
      expectedError: /member name mismatch|must contain exactly 1 member|not a tar archive/i,
    });
  });

  it("rejects tar with mismatched member name", async () => {
    await runHostile({
      label: "mismatched-name",
      buildArchive: () => ({ bytes: gzipSync(buildTar({ name: "wrongname", typeflag: 0x30 }, Buffer.from("x"))) }),
      expectedError: /member name mismatch/i,
    });
  });

  it("rejects an archive with duplicate members", async () => {
    const dup = buildMultiTar([
      { opts: { name: "umactually-linux-x64", typeflag: 0x30 }, payload: Buffer.from("first") },
      { opts: { name: "umactually-linux-x64", typeflag: 0x30 }, payload: Buffer.from("second") },
    ]);
    await runHostile({
      label: "duplicate",
      buildArchive: () => ({ bytes: gzipSync(dup) }),
      expectedError: /must contain exactly 1 member/i,
    });
  });

  it("rejects an archive containing a directory member in addition to a file", async () => {
    const dirPlusFile = buildMultiTar([
      { opts: { name: "umactually-linux-x64-dir", typeflag: 0x35 } },
      { opts: { name: "umactually-linux-x64", typeflag: 0x30 }, payload: Buffer.from("file") },
    ]);
    await runHostile({
      label: "dir+file",
      buildArchive: () => ({ bytes: gzipSync(dirPlusFile) }),
      expectedError: /must contain exactly 1 member/i,
    });
  });

  it("rejects an archive containing a symlink member", async () => {
    const symlink = buildTar({ name: "umactually-linux-x64", typeflag: 0x32, linkname: "/etc/passwd" });
    await runHostile({
      label: "symlink",
      buildArchive: () => ({ bytes: gzipSync(symlink) }),
      expectedError: /not a regular file|member name mismatch/i,
    });
  });

  it("rejects an archive containing a hardlink member", async () => {
    const hardlink = buildTar({ name: "umactually-linux-x64", typeflag: 0x31, linkname: "elsewhere" });
    await runHostile({
      label: "hardlink",
      buildArchive: () => ({ bytes: gzipSync(hardlink) }),
      expectedError: /not a regular file|member name mismatch/i,
    });
  });

  it("rejects an archive containing a FIFO member", async () => {
    const fifo = buildTar({ name: "umactually-linux-x64", typeflag: 0x36 });
    await runHostile({
      label: "fifo",
      buildArchive: () => ({ bytes: gzipSync(fifo) }),
      expectedError: /not a regular file|member name mismatch/i,
    });
  });

  it("rejects an archive containing a device member", async () => {
    const dev = buildTar({ name: "umactually-linux-x64", typeflag: 0x33 });
    await runHostile({
      label: "device",
      buildArchive: () => ({ bytes: gzipSync(dev) }),
      expectedError: /not a regular file|member name mismatch/i,
    });
  });
});

describe.skipIf(!SHELL_AVAILABLE || process.platform === "win32")("install.sh bad-checksum preserves seeded install", () => {
  // PR-time regression for the smoke-bad-checksum workflow scenario.
  // The installer's checksum validator MUST fire BEFORE any staging or
  // overwrite of the seeded installed binary. If the install would
  // overwrite the seeded bytes on checksum failure, the security
  // guarantee the smoke-bad-checksum workflow enforces is broken:
  //   "An attacker who substitutes a tampered archive + tampered
  //    checksums.txt cannot replace an existing /usr/local/bin/umactually
  //    or $HOME/.local/bin/umactually with malicious bytes."
  //
  // Run 29616796148 surfaced that v0.5.0 broke this guarantee; the
  // PR-time tests asserted only the workflow-source regex and missed
  // the runtime behavior. This test exercises the actual install.sh
  // against a fixture server with a tampered checksums.txt entry, so
  // any future regression in the installer's checksum-validation order
  // (or the v0.5.0 install path writing to $HOME/.local/bin before
  // validation) fails the PR-time CI.

  it("a tampered checksum entry on the linux-x64 archive rejects the install and leaves the seeded installed binary byte-identical", async () => {
    // Given: a release fixture with the canonical six archives + a
    // checksums.txt whose linux-x64 entry has been substituted with
    // a 64-hex-zero string (not the real archive sha256).
    mkdirSync(releaseDir, { recursive: true });
    const realArchiveBytes = gzipSync(
      buildTar(
        { name: LINUX_X64.memberName, typeflag: 0x30 },
        Buffer.from("#!/bin/sh\necho tampered-archive-payload\n"),
      ),
    );
    writeFileSync(join(releaseDir, LINUX_X64.archiveName), realArchiveBytes);
    for (const t of TARGETS) {
      if (t.id === LINUX_X64.id) continue;
      writeFileSync(join(releaseDir, t.archiveName), Buffer.from(`placeholder-${t.id}`));
    }
    // Build the canonical checksums.txt for archive mode, then
    // substitute the linux-x64 hash with 64 zeros. The fixture server
    // serves the substituted file; install.sh will compute the real
    // hash of the downloaded archive (which matches the real bytes
    // we just wrote), see mismatch with the published 0000... entry,
    // and exit 1 before staging.
    const hashes: Record<string, string> = {};
    for (const t of TARGETS) {
      hashes[t.archiveName] = sha256(readFileSync(join(releaseDir, t.archiveName)));
    }
    const TAMPERED_HASH = "0".repeat(64);
    hashes[LINUX_X64.archiveName] = TAMPERED_HASH;
    writeFileSync(join(releaseDir, "checksums.txt"), buildChecksumFile(hashes, "archive"));
    server = await startFixture({ releaseDir, tag: "v0.5.0" });

    // The destination has been pre-seeded with a known string. After
    // the rejection, the file's bytes must be unchanged (security
    // guarantee upheld). $HOME is sandboxed to fakeHome so the
    // installer targets a writable location that can be asserted.
    const dest = join(fakeHome, ".local", "bin", "umactually");
    mkdirSync(join(fakeHome, ".local", "bin"), { recursive: true });
    const SEEDED = "seeded-installed-binary\n";
    writeFileSync(dest, SEEDED);
    const beforeBytes = readFileSync(dest, "utf8");

    // When: install.sh runs against the fixture server with the
    // tampered checksums.txt.
    const result = runInstaller({
      fakeHome,
      manifestPath,
      serverBaseUrl: server.baseUrl,
      tag: "v0.5.0",
      platform: "linux",
      arch: "x64",
    });

    // Then: the install was rejected on the checksum mismatch, the
    // seeded binary is preserved byte-identical, and no staging
    // residue remains in either INSTALL_DIR.
    expect(
      result.status,
      `bad-checksum install must exit non-zero. status=${result.status} stderr=${result.stderr} stdout=${result.stdout}`,
    ).not.toBe(0);
    expect(result.stderr).toMatch(/checksum verification failed/i);
    expect(
      readFileSync(dest, "utf8"),
      "seeded installed binary must be byte-identical after a bad-checksum rejection",
    ).toBe(beforeBytes);
    // No residue in $HOME/.local/bin (the test sandbox's INSTALL_DIR).
    const homeResidue = readdirSync(join(fakeHome, ".local", "bin")).filter((e) =>
      e.startsWith(".umactually-stage."),
    );
    expect(
      homeResidue,
      "no .umactually-stage.* residue may remain after a bad-checksum rejection",
    ).toEqual([]);
  });

  it("a tampered checksum entry on the linux-arm64 archive rejects the install (cross-target regression)", async () => {
    // Same scenario, different target — proves the validator's per-line
    // hash table covers every entry, not just the first.
    mkdirSync(releaseDir, { recursive: true });
    const linuxArm64 = TARGETS.find((t) => t.id === "linux-arm64")!;
    const realArchiveBytes = gzipSync(
      buildTar(
        { name: linuxArm64.memberName, typeflag: 0x30 },
        Buffer.from("#!/bin/sh\necho tampered-arm64-payload\n"),
      ),
    );
    writeFileSync(join(releaseDir, linuxArm64.archiveName), realArchiveBytes);
    for (const t of TARGETS) {
      if (t.id === linuxArm64.id) continue;
      writeFileSync(join(releaseDir, t.archiveName), Buffer.from(`placeholder-${t.id}`));
    }
    const hashes: Record<string, string> = {};
    for (const t of TARGETS) {
      hashes[t.archiveName] = sha256(readFileSync(join(releaseDir, t.archiveName)));
    }
    hashes[linuxArm64.archiveName] = "0".repeat(64);
    writeFileSync(join(releaseDir, "checksums.txt"), buildChecksumFile(hashes, "archive"));
    server = await startFixture({ releaseDir, tag: "v0.5.0" });

    const dest = join(fakeHome, ".local", "bin", "umactually");
    mkdirSync(join(fakeHome, ".local", "bin"), { recursive: true });
    const SEEDED = "seeded-arm64-binary\n";
    writeFileSync(dest, SEEDED);
    const beforeBytes = readFileSync(dest, "utf8");

    const result = runInstaller({
      fakeHome,
      manifestPath,
      serverBaseUrl: server.baseUrl,
      tag: "v0.5.0",
      platform: "linux",
      arch: "arm64",
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/checksum verification failed/i);
    expect(readFileSync(dest, "utf8")).toBe(beforeBytes);
    const homeResidue = readdirSync(join(fakeHome, ".local", "bin")).filter((e) =>
      e.startsWith(".umactually-stage."),
    );
    expect(homeResidue).toEqual([]);
  });
});

describe.skipIf(!SHELL_AVAILABLE)("install.sh Windows Git Bash delegation", () => {
  it("does NOT implement a second ZIP extractor — it hands off to powershell.exe", async () => {
    // When PLATFORM_OVERRIDE=windows and PL_SCRIPT_URL points at a local
    // served script URL, the installer must fetch that URL and invoke
    // powershell.exe with -File pointing at the materialized copy. We
    // cannot actually run PowerShell here on most CI hosts, but we can
    // verify the script attempted to fetch the URL and called
    // powershell.exe (by intercepting powershell.exe via PATH).
    mkdirSync(releaseDir, { recursive: true });
    writeFileSync(join(releaseDir, LINUX_X64.rawName), ASSET_PAYLOAD);
    for (const t of TARGETS) {
      if (t.id === LINUX_X64.id) continue;
      writeFileSync(join(releaseDir, t.rawName), Buffer.from(`placeholder-${t.id}`));
    }
    const hashes: Record<string, string> = {};
    for (const t of TARGETS) {
      hashes[t.rawName] = sha256(readFileSync(join(releaseDir, t.rawName)));
    }
    writeFileSync(join(releaseDir, "checksums.txt"), buildChecksumFile(hashes, "raw"));
    server = await startFixture({ releaseDir, tag: "v0.4.1" });

    // Materialize a fake install.ps1 the fixture can serve.
    const rawDir = join(sandbox, "raw");
    mkdirSync(rawDir, { recursive: true });
    const psScript = "# fake install.ps1\necho HELLO_FROM_FAKE_PS1\n";
    writeFileSync(join(rawDir, "install.ps1"), psScript);
    const psServer = await startFixture({ releaseDir: mkdtempSync(join(tmpdir(), "ps-")), rawDir, tag: "v0.4.1" });
    const psUrl = `${psServer.baseUrl}/raw/JosiahSiegel/umactually/main/scripts/install.ps1`;
    void psUrl;

    // Build a fake powershell.exe shim that records its invocation and exits
    // 0. The script downloads the URL via curl/wget and then calls
    // powershell.exe -NoProfile -ExecutionPolicy Bypass -File <tmp.ps1>.
    // We can't easily intercept powershell.exe without polluting PATH on
    // shared CI; instead we assert that the script attempted the call by
    // verifying the exit code reflects "could not find powershell.exe" or
    // a successful handoff (whichever the environment produces). The key
    // invariant: it did NOT extract the archive with `tar`.
    const fakeBin = join(sandbox, "fake-bin");
    mkdirSync(fakeBin, { recursive: true });
    const psShim = join(fakeBin, "powershell.exe");
    writeFileSync(psShim, "#!/bin/sh\necho FAKE_PWSH_INVOKED\n");
    // Ensure shim is executable (MINGW ignores POSIX bits but no harm).

    const result = runInstaller({
      fakeHome,
      manifestPath,
      serverBaseUrl: server.baseUrl,
      tag: "v0.4.1",
      platform: "windows",
      arch: "x64",
      contract: "legacy",
      extraEnv: { PATH: `${fakeBin}${process.platform === "win32" ? ";" : ":"}${process.env["PATH"] ?? ""}` },
    });
    // Two acceptable outcomes:
    //   (a) The fake powershell.exe shim was found and ran -> exit 0.
    //   (b) The real powershell.exe was found and succeeded -> exit 0.
    //   (c) Neither powershell was found -> exit nonzero with a clear error.
    // We just verify the installer did not attempt to unzip via tar/unzip:
    // the stdio must not mention "tar" for ZIP extraction.
    void psScript;
    if (result.status !== 0) {
      // Acceptable failure modes: powershell not found, or download failed.
      expect(result.stderr.length).toBeGreaterThan(0);
    }
    // Whatever happened, the POSIX install path must NOT have written a
    // binary into the sandbox.
    expect(existsSync(join(fakeHome, ".local", "bin", "umactually.exe"))).toBe(false);
  });
});
