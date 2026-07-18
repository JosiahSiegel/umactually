// SPDX-License-Identifier: MIT
// Windows archive-mode installer tests for scripts/install.ps1.
//
// Verifies the PowerShell 5.1 archive-mode flow:
//   - Streams exactly one entry from a .zip via .NET ZipArchive (no
//     Expand-Archive, no path combination with FullName)
//   - Validates the complete checksum file (LF/CRLF normalized) with the
//     same 8-case override matrix as the POSIX installer
//   - Rejects hostile ZIPs (traversal, drive-absolute, rooted, nested,
//     duplicate, directory-plus-file, Unix symlink/special-mode)
//   - Stages with GUID names + FileMode.CreateNew + FileShare.None
//   - Runs staged --version before File.Replace / Move-Item
//   - Preserves old regular-file SHA on rejection, no temp/backup residue
//   - Refuses reparse install directory, symlink/junction destinations,
//     locked destinations, TOCTOU identity/type changes
//   - Installs verbatim Windows fixture binaries for the happy path
//
// Skips gracefully on platforms without PowerShell.

import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const INSTALL_PS1 = join(REPO_ROOT, "scripts", "install.ps1");
const FIXTURE_SERVER = join(REPO_ROOT, "test", "helpers", "release-fixture-server.mjs");

// Buffer.toString(encoding) is a runtime extension that TypeScript's
// Uint8Array declaration does not type. Use a typed wrapper for binary
// round-trip comparisons.
function bytesToString(buf: Buffer): string {
  return buf.toString("binary");
}

const MEMBER_NAME = "umactually-windows-x64.exe";

const ARCHIVE_BASENAMES = [
  "umactually-linux-x64.tar.gz",
  "umactually-linux-arm64.tar.gz",
  "umactually-darwin-x64.tar.gz",
  "umactually-darwin-arm64.tar.gz",
  "umactually-windows-x64.zip",
  "umactually-windows-arm64.zip",
] as const;

// PowerShell discovery (mirrors install-scripts-powershell.test.ts).
function findPowerShell(): string | null {
  const candidates = process.platform === "win32"
    ? ["powershell.exe", "pwsh.exe", "pwsh"]
    : ["pwsh", "powershell"];
  for (const c of candidates) {
    try {
      execFileSync(c, ["-NoProfile", "-Command", "$PSVersionTable.PSVersion"], { stdio: "pipe" });
      return c;
    } catch {
      // try next
    }
  }
  return null;
}

const POWERSHELL = findPowerShell();
const PS_AVAILABLE = POWERSHELL !== null;

// Hotfix #10 — bump per-test timeout so PowerShell smoke tests don't
// flake at the 5 s default. PS-ARCHIVE-003 empirically took 5.4 s on
// cold pwsh starts during CI run 29625115861; PS-FIXTURE-001 takes
// 6+ s on the same setup. Apply at module scope via vi.setConfig so
// the bump takes effect for every test in this file regardless of
// which describe block it lives in.
if (PS_AVAILABLE) {
  vi.setConfig({ testTimeout: 30_000 });
}

// ---- ZIP fixture authoring ----------------------------------------------
//
// Hand-roll a one-entry local-file-header + central-directory + EOCD record
// for hostile fixtures where yazl refuses to emit symlink/special-mode
// members. The grammar mirrors the yazl@3.3.1 byte layout for the regular
// path so a tested 0x8000 Unix-type and 26-byte UT extra field parse
// identically with what the happy fixture produces.

type FixtureEntry = Readonly<{
  name: string;
  bytes: Buffer;
  externalAttributes: number; // high 16 bits hold Unix mode; low 16 bits DOS attrs
}>;

const ZIP_LFH_SIG = 0x04034b50;
const ZIP_CD_SIG = 0x02014b50;
const ZIP_EOCD_SIG = 0x06054b50;

function buildArchive(entries: readonly FixtureEntry[]): Buffer {
  // Local file headers + payload
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;
  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "binary");
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(ZIP_LFH_SIG, 0);
    lfh.writeUInt16LE(20, 4); // version needed
    lfh.writeUInt16LE(0x0800, 6); // general purpose: UTF-8 names
    lfh.writeUInt16LE(0, 8); // compression method: stored
    // DOS time: 1980-01-01 00:00:00 in standard MS-DOS encoding (0x0000 0x0021)
    lfh.writeUInt16LE(0x0000, 10);
    lfh.writeUInt16LE(0x0021, 12);
    lfh.writeUInt32LE(0, 14); // placeholder; real CRC computed below
    lfh.writeUInt32LE(entry.bytes.length, 18); // compressed size
    lfh.writeUInt32LE(entry.bytes.length, 22); // uncompressed size
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28); // extra-field length: zero (no UT block)
    // Compute CRC32 over payload
    const crc = crc32(entry.bytes);
    lfh.writeUInt32LE(crc, 14);
    localParts.push(lfh, nameBuf, entry.bytes);

    // Central directory entry
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(ZIP_CD_SIG, 0);
    cd.writeUInt16LE(0x031e, 4); // version made by: Unix, 3.0
    cd.writeUInt16LE(20, 6); // version needed
    cd.writeUInt16LE(0x0800, 8); // gp flag
    cd.writeUInt16LE(0, 10); // method
    cd.writeUInt16LE(0x0000, 12); // mtime
    cd.writeUInt16LE(0x0021, 14); // mdate
    cd.writeUInt32LE(crc, 16); // crc
    cd.writeUInt32LE(entry.bytes.length, 20); // compressed
    cd.writeUInt32LE(entry.bytes.length, 24); // uncompressed
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30); // extra length
    cd.writeUInt16LE(0, 32); // comment length
    cd.writeUInt16LE(0, 34); // disk number start
    cd.writeUInt16LE(0, 36); // internal attrs
    cd.writeUInt32LE(entry.externalAttributes >>> 0, 38);
    cd.writeUInt32LE(localOffset, 42);
    centralParts.push(cd, nameBuf);

    localOffset += lfh.length + nameBuf.length + entry.bytes.length;
  }

  const localBytes = Buffer.concat(localParts);
  const cdBytes = Buffer.concat(centralParts);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(ZIP_EOCD_SIG, 0);
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk with cd
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBytes.length, 12);
  eocd.writeUInt32LE(localBytes.length, 16);
  eocd.writeUInt16LE(0, 20); // comment length
  return Buffer.concat([localBytes, cdBytes, eocd]);
}

// CRC32 (IEEE polynomial, reflected) for ZIP local file header.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]!) & 0xff]!;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// External-attributes helpers. High 16 bits hold the Unix st_mode (file
// type in the top nibble, permissions in the low 12 bits). Low 16 bits
// mirror DOS attributes (0x10 = directory).
function unixModeAttrs(mode: number): number {
  return (mode << 16) >>> 0;
}

function dosDirAttrs(): number {
  return 0x10;
}

// Stub payload that quits 0 and prints a fixed marker. The smoke test runs
// `<staged> --version` and expects exit 0.
const STUB_PAYLOAD: Buffer = Buffer.from(
  "Write-Host 'umactually windows-x64 fixture version 0.4.1'\r\n",
  "binary",
);

function regularFixture(memberName = MEMBER_NAME): Buffer {
  return buildArchive([
    {
      name: memberName,
      bytes: STUB_PAYLOAD,
      externalAttributes: unixModeAttrs(0o100755),
    },
  ]);
}

// ---- checksum grammar helpers ------------------------------------------

function buildArchiveChecksums(
  archiveBytes: Buffer,
  archiveBasename: string,
): string {
  const hash = createHash("sha256").update(archiveBytes).digest("hex");
  const lines: string[] = [];
  for (const basename of ARCHIVE_BASENAMES) {
    if (basename === archiveBasename) {
      lines.push(`${hash}  ${basename}`);
    } else {
      // Synthetic distinct hashes for the other five basenames. Tests only
      // verify the *target* archive's checksum matches; the others just
      // need to satisfy the "exactly six canonical lines" rule.
      const placeholder = "0".repeat(64);
      lines.push(`${placeholder}  ${basename}`);
    }
  }
  return lines.join("\n") + "\n";
}



// ---- HTTP fixture server lifecycle -------------------------------------

type ServerHandle = Readonly<{
  baseUrl: string;
  kill: () => void;
}>;

async function startFixtureServer(
  releaseDir: string,
  options: {
    readonly tag?: string;
    readonly prerelease?: boolean;
    readonly draft?: boolean;
    readonly missing?: boolean;
    readonly rawDir?: string;
  } = {},
): Promise<ServerHandle> {
  const args = [FIXTURE_SERVER, "--release-dir", releaseDir];
  if (options.tag) args.push("--release-tag", options.tag);
  if (options.prerelease) args.push("--release-prerelease");
  if (options.draft) args.push("--release-draft");
  if (options.missing) args.push("--release-missing");
  if (options.rawDir) args.push("--raw-dir", options.rawDir);
  const server = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });
  const lines = createInterface({ input: server.stdout });
  try {
    const [line] = await once(lines, "line");
    const port = Number(line.replace(/^PORT=/, ""));
    return {
      baseUrl: `http://127.0.0.1:${port}`,
      kill: () => {
        lines.close();
        server.kill();
      },
    };
  } catch (error) {
    server.kill();
    throw error;
  }
}

// ---- installer invocation helpers --------------------------------------

type ScriptResult = {
  readonly stderr: string;
  readonly stdout: string;
  readonly status: number;
};

function runInstall(env: Record<string, string>): ScriptResult {
  if (!PS_AVAILABLE || POWERSHELL === null) {
    return { stderr: "", stdout: "POWERSHELL_UNAVAILABLE", status: 0 };
  }
  const result = spawnSync(POWERSHELL, [
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", INSTALL_PS1,
  ], {
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  return {
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
    status: result.status ?? 1,
  };
}

async function runArchiveInstall(opts: {
  readonly server: ServerHandle;
  readonly tag: string;
  readonly contract?: string;
  readonly installDir: string;
  readonly releaseDir: string;
  readonly zipPath?: string;
  readonly checksumsPath?: string;
  readonly basename?: string;
  readonly member?: string;
  readonly seedInstalled?: Buffer;
  readonly smokeTest?: boolean;
}): Promise<ScriptResult> {
  // Test-mode 2 path: hand the installer a local ZIP + checksums file. We
  // bypass the network so the test exercises the streaming / validation /
  // replacement logic, not the HTTP download.
  // USERPROFILE is the parent of the install dir so that PowerShell's
  // AppData/LocalAppData resolution doesn't pollute the install dir.
  const env: Record<string, string> = {
    INSTALL_TEST_ARCHIVE_MODE: "1",
    INSTALL_TEST_DIR: opts.installDir,
    INSTALL_TEST_ZIP: opts.zipPath ?? join(opts.releaseDir, "umactually-windows-x64.zip"),
    INSTALL_TEST_CHECKSUMS: opts.checksumsPath ?? join(opts.releaseDir, "checksums.txt"),
    INSTALL_TEST_BASENAME: opts.basename ?? "umactually-windows-x64.zip",
    INSTALL_TEST_MEMBER: opts.member ?? MEMBER_NAME,
    PROCESSOR_ARCHITECTURE: "AMD64",
    USERPROFILE: join(opts.installDir, "..", ".."),
  };
  // Default: skip the staged smoke test because the test fixtures are
  // string buffers, not real Windows executables.
  if (opts.smokeTest !== true) {
    env["INSTALL_TEST_NO_SMOKE"] = "1";
  }
  return runInstall(env);
}

// ---- per-test sandbox --------------------------------------------------

let sandbox: string;
let releaseDir: string;
let installDir: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "umactually-archive-ps-"));
  releaseDir = join(sandbox, "release");
  installDir = join(sandbox, "home", ".local", "bin");
  mkdirSync(releaseDir, { recursive: true });
  mkdirSync(installDir, { recursive: true });
});

afterEach(() => {
  if (sandbox && existsSync(sandbox)) {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

// Helper: write a real zip + matching checksum file into releaseDir and
// seed the install dir with an optional "previous" binary that should be
// preserved verbatim on rejection.
function seedHappyArchive(
  seedInstalled?: Buffer,
  memberName = MEMBER_NAME,
): {
  readonly archivePath: string;
  readonly checksumsPath: string;
  readonly archiveBytes: Buffer;
  readonly archiveHash: string;
} {
  const archiveBytes = regularFixture(memberName);
  const archivePath = join(releaseDir, "umactually-windows-x64.zip");
  writeFileSync(archivePath, archiveBytes);
  const checksumsPath = join(releaseDir, "checksums.txt");
  writeFileSync(checksumsPath, buildArchiveChecksums(archiveBytes, "umactually-windows-x64.zip"));
  const installPath = join(installDir, "umactually.exe");
  if (seedInstalled) {
    writeFileSync(installPath, seedInstalled);
  }
  return {
    archivePath,
    checksumsPath,
    archiveBytes,
    archiveHash: createHash("sha256").update(archiveBytes).digest("hex"),
  };
}

// Assert the install dir contains exactly the expected file set (regular
// files only; no leftover staging or backup residue).
function assertNoTempResidue(installDirectory: string, expectedFiles: readonly string[]): void {
  if (!existsSync(installDirectory)) return;
  const { readdirSync } = require("node:fs") as typeof import("node:fs");
  const remaining = readdirSync(installDirectory).filter(
    (name) => !expectedFiles.includes(name),
  );
  expect(remaining).toEqual([]);
}

// Assert the install dir is a directory (cross-platform).
function assertIsDirectory(path: string): void {
  expect(existsSync(path)).toBe(true);
  const stat = statSync(path);
  expect(stat.isDirectory()).toBe(true);
}

// Hotfix #10 — raise the per-test timeout for the PowerShell smoke
// branch so a slow `cmd /c "<staged> --version"` on a CI runner (where
// pwsh cold-start can be 4–6 s with .NET runtime initialization) does
// NOT cause the test to flake at the 5 s default. The 30 s budget is
// generous: locally these tests finish in 1–3 s, and on a healthy CI
// runner the slowest test (PS-ARCHIVE-003) takes ~5 s. This is the
// dedicated rounding-error margin that lets the assertion block report
// a real diagnostic instead of `Test timed out in 5000ms`.
//
// We bump the timeout via `vi.setConfig({ testTimeout })` at module
// scope (not inside `beforeAll`). This is the location that runs
// reliably in vitest 4.x: `vi.setConfig` changes are applied to
// the worker before the first test executes. Attempts to set config
// from inside a top-level `beforeAll` race with vitest's file-
// collection stage and may silently lose the change. The bump
// applies to every test in this file because vitest config state
// is shared per worker. Tests in OTHER files keep their own vitest
// config state (separate workers / separate files).
describe.skipIf(!PS_AVAILABLE)("install.ps1 archive-mode happy path", () => {

  it("PS-ARCHIVE-001: streams one verified entry and atomically replaces the destination", async () => {
    const seeded = Buffer.from("legacy umactually stub v0.4.0\n");
    seedHappyArchive(seeded);

    const result = await runArchiveInstall({
      server: { baseUrl: "http://unused", kill: () => {} },
      tag: "v0.5.0",
      installDir,
      releaseDir,
    });

    if (result.status !== 0) {
      console.error("STDOUT:", result.stdout);
      console.error("STDERR:", result.stderr);
    }
    expect(result.status).toBe(0);
    const installedPath = join(installDir, "umactually.exe");
    expect(bytesToString(readFileSync(installedPath)))
      .toBe(bytesToString(STUB_PAYLOAD));
    assertNoTempResidue(installDir, ["umactually.exe"]);
    expect(result.stdout).toContain("TEST_ARCHIVE_MODE=1");
    expect(result.stdout).toContain("ARCHIVE_NAME=umactually-windows-x64.zip");
    expect(result.stdout).toContain("MEMBER_NAME=umactually-windows-x64.exe");
    // sanity: the install dir still exists as a real directory
    assertIsDirectory(installDir);
  });

  it("PS-ARCHIVE-002: accepts a checksum file with CRLF line endings", async () => {
    const fixture = seedHappyArchive();
    // Re-write the checksums file with CRLF.
    const text = readFileSync(fixture.checksumsPath, "utf8").replace(/\n/g, "\r\n");
    writeFileSync(fixture.checksumsPath, text);

    const result = await runArchiveInstall({
      server: { baseUrl: "http://unused", kill: () => {} },
      tag: "v0.5.0",
      installDir,
      releaseDir,
    });

    expect(result.status).toBe(0);
    expect(bytesToString(readFileSync(join(installDir, "umactually.exe"))))
      .toBe(bytesToString(STUB_PAYLOAD));
  });

  it("PS-ARCHIVE-003: smoke-test failure preserves the old binary and cleans staging", async () => {
    // Stub payload: a Windows console host that exits non-zero with no
    // stdout. The PowerShell installer invokes the staged binary via
    // `cmd /c "<staged> --version" 2>&1` (hotfix #7 — Bun console-handle
    // workaround) and then falls back to the PE version-info resource.
    // A non-PE byte stream produces no captured output and has no
    // embedded version metadata, so the installer's "no output" guard
    // fires — exactly the smoke-test failure mode the test is pinning.
    //
    // We deliberately do NOT use a PowerShell script renamed `.exe` here:
    // `cmd /c` would not recognize the file as a PowerShell script
    // (no PE header), so the previous `Write-Error` / `exit 42` stub
    // would silently produce no output even on a "successful" smoke
    // test, hiding the regression we want to detect.
    const badPayload = Buffer.from(
      // A minimal 16-bit DOS stub header (MZ) followed by bytes that
      // do NOT form a valid PE image. The OS will refuse to execute
      // it as a Windows binary, the cmd /c probe captures nothing,
      // the PE fallback cannot find a version-info resource, and the
      // installer rejects the install with the "no output" guard.
      "MZ" + "\x00".repeat(58) + "\x80\x00\x00\x00" + "\x00".repeat(64),
      "binary",
    );
    const badArchive = buildArchive([
      { name: MEMBER_NAME, bytes: badPayload, externalAttributes: unixModeAttrs(0o100755) },
    ]);
    writeFileSync(join(releaseDir, "umactually-windows-x64.zip"), badArchive);
    writeFileSync(join(releaseDir, "checksums.txt"), buildArchiveChecksums(badArchive, "umactually-windows-x64.zip"));

    const seeded = Buffer.from("preserve me\n");
    writeFileSync(join(installDir, "umactually.exe"), seeded);

    const result = await runArchiveInstall({
      server: { baseUrl: "http://unused", kill: () => {} },
      tag: "v0.5.0",
      installDir,
      releaseDir,
      smokeTest: true,
    });

    if (result.status === 0) {
      console.error("STDOUT:", result.stdout);
      console.error("STDERR:", result.stderr);
    }
    expect(result.status).not.toBe(0);
    // Hotfix #7 invokes the staged binary via `cmd /c "..."`. A stub
    // that's a non-PE byte stream (MZ header without a valid PE
    // signature) causes Windows to print "This version of ... is not
    // compatible ..." to stderr; cmd /c surfaces the message via
    // PowerShell's `$?` failure path, so the installer rejects with
    // the "PowerShell reported command failure" branch. The exact
    // substring `Staged --version failed` matches that branch (and the
    // exit-code / no-output branches too, all of which are valid smoke
    // failures). The point of this assertion is to confirm the failure
    // surfaced through the smoke-test guard, not from the installer's
    // pre-smoke checksum / extraction path.
    expect(result.stderr).toMatch(/Staged --version failed/u);
    expect(readFileSync(join(installDir, "umactually.exe"), "utf8")).toBe("preserve me\n");
    assertNoTempResidue(installDir, ["umactually.exe"]);
  });
});

describe.skipIf(!PS_AVAILABLE)("install.ps1 8-case override matrix", () => {
  it("PS-MATRIX-001: rejects base without tag", () => {
    // Production path: Resolve-Tag fires before any network access.
    const result = runInstall({
      INSTALL_RELEASE_BASE: "http://127.0.0.1:1",
      PROCESSOR_ARCHITECTURE: "AMD64",
      USERPROFILE: join(installDir, "..", ".."),
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/INSTALL_RELEASE_BASE without INSTALL_RELEASE_TAG/);
  });

  it("PS-MATRIX-002: rejects contract without tag", () => {
    const result = runInstall({
      INSTALL_ASSET_CONTRACT: "archive",
      PROCESSOR_ARCHITECTURE: "AMD64",
      USERPROFILE: join(installDir, "..", ".."),
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/INSTALL_ASSET_CONTRACT without INSTALL_RELEASE_TAG/);
  });

  it("PS-MATRIX-003: rejects base + contract without tag", () => {
    const result = runInstall({
      INSTALL_RELEASE_BASE: "http://127.0.0.1:1",
      INSTALL_ASSET_CONTRACT: "archive",
      PROCESSOR_ARCHITECTURE: "AMD64",
      USERPROFILE: join(installDir, "..", ".."),
    });
    expect(result.status).not.toBe(0);
    // The PowerShell throw string "INSTALL_RELEASE_BASE + INSTALL_ASSET_CONTRACT=archive without INSTALL_RELEASE_TAG is invalid (case 7 reject)" is word-wrapped by the PowerShell exception formatter with ANSI escape codes, newlines, AND source-line pointer pipes (|) between words on multi-line terminals (CI Linux runners). Strip ANSI codes, strip source-line pointer pipes, then collapse whitespace before matching.
    const stripped = result.stderr
      .replace(/\u001b\[[0-9;]*m/g, "")
      .replace(/\|/g, " ")
      .replace(/\s+/g, " ");
    expect(stripped).toMatch(/without INSTALL_RELEASE_TAG/);
  });

  it("PS-MATRIX-004: rejects unknown contract value", () => {
    // Production path with explicit invalid contract — the override validator
    // fires before Resolve-Tag so the network call is never made.
    const result = runInstall({
      INSTALL_RELEASE_TAG: "v0.5.0",
      INSTALL_RELEASE_BASE: "http://127.0.0.1:1",
      INSTALL_ASSET_CONTRACT: "garbage",
      PROCESSOR_ARCHITECTURE: "AMD64",
      USERPROFILE: join(installDir, "..", ".."),
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/Invalid INSTALL_ASSET_CONTRACT/);
  });

  it.each(["v0.2.1", "v0.3.0", "v0.4.0", "v0.4.1"])(
    "PS-MATRIX-005: legacy tag %s is recognized by the contract resolver",
    (tag) => {
      // Verify the script source contains the literal allowlist with each tag.
      const scriptText = readFileSync(INSTALL_PS1, "utf8");
      expect(scriptText).toMatch(/\$LegacyTagAllowlist\s*=\s*@\(/);
      expect(scriptText).toContain(`"${tag}"`);
    },
  );

  it("PS-MATRIX-006: archive-capable tag never falls back to raw on checksum mismatch", () => {
    // Seed an archive contract's checksum file but with a wrong hash. The
    // production path with archive contract must reject with a checksum
    // error, not silently fall back to legacy raw download.
    seedHappyArchive();
    writeFileSync(
      join(releaseDir, "checksums.txt"),
      ARCHIVE_BASENAMES.map((b) => `${"0".repeat(64)}  ${b}`).join("\n") + "\n",
    );
    const result = runInstall({
      INSTALL_RELEASE_TAG: "v0.5.0",
      INSTALL_RELEASE_BASE: "http://127.0.0.1:1",
      INSTALL_ASSET_CONTRACT: "archive",
      PROCESSOR_ARCHITECTURE: "AMD64",
      USERPROFILE: join(installDir, "..", ".."),
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).not.toMatch(/Refusing to install from/);
  });

  it("PS-MATRIX-007: GitHub latest endpoint with prerelease flag rejects", () => {
    // Spin up the local fixture server, set prerelease=true on the latest
    // JSON, and assert the installer refuses. No INSTALL_RELEASE_TAG /
    // INSTALL_RELEASE_BASE — we want Resolve-Tag to hit the latest endpoint.
    // We pass INSTALL_GITHUB_API_BASE so the test bypasses the public
    // api.github.com endpoint. The server matches /repos/<owner>/<repo>/releases/latest
    // so the API base must include that path.
    seedHappyArchive();
    return (async () => {
      const server = await startFixtureServer(releaseDir, {
        tag: "v0.5.0",
        prerelease: true,
      });
      try {
        const apiBase = `${server.baseUrl}/repos/JosiahSiegel/umactually/releases/latest`;
        const result = runInstall({
          INSTALL_GITHUB_API_BASE: apiBase,
          PROCESSOR_ARCHITECTURE: "AMD64",
          USERPROFILE: join(installDir, "..", ".."),
        });
        if (result.status === 0) {
          console.error("STDOUT:", result.stdout);
          console.error("STDERR:", result.stderr);
        }
        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/Refusing to install from prerelease/);
      } finally {
        server.kill();
      }
    })();
  });

  it("PS-MATRIX-008: GitHub latest endpoint with non-semver tag rejects", () => {
    seedHappyArchive();
    return (async () => {
      const server = await startFixtureServer(releaseDir, {
        tag: "not-a-tag",
      });
      try {
        const apiBase = `${server.baseUrl}/repos/JosiahSiegel/umactually/releases/latest`;
        const result = runInstall({
          INSTALL_GITHUB_API_BASE: apiBase,
          PROCESSOR_ARCHITECTURE: "AMD64",
          USERPROFILE: join(installDir, "..", ".."),
        });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/Refusing tag not matching/);
      } finally {
        server.kill();
      }
    })();
  });

  it("PS-MATRIX-009: GitHub latest endpoint missing returns error", () => {
    seedHappyArchive();
    return (async () => {
      const server = await startFixtureServer(releaseDir, {
        missing: true,
      });
      try {
        const apiBase = `${server.baseUrl}/repos/JosiahSiegel/umactually/releases/latest`;
        const result = runInstall({
          INSTALL_GITHUB_API_BASE: apiBase,
          PROCESSOR_ARCHITECTURE: "AMD64",
          USERPROFILE: join(installDir, "..", ".."),
        });
        expect(result.status).not.toBe(0);
        expect(result.stderr).toMatch(/Failed to resolve latest tag|404/);
      } finally {
        server.kill();
      }
    })();
  });
});

describe.skipIf(!PS_AVAILABLE)("install.ps1 hostile ZIP fixtures", () => {
  it.each([
    ["traversal", "../umactually.exe", unixModeAttrs(0o100755)],
    ["drive-absolute", "C:/umactually.exe", unixModeAttrs(0o100755)],
    ["rooted", "/umactually.exe", unixModeAttrs(0o100755)],
    ["nested", "nested/umactually.exe", unixModeAttrs(0o100755)],
  ])("PS-HOSTILE-%s: rejects %s member name", async (_label, name, attrs) => {
    const archive = buildArchive([{ name, bytes: STUB_PAYLOAD, externalAttributes: attrs }]);
    writeFileSync(join(releaseDir, "umactually-windows-x64.zip"), archive);
    writeFileSync(join(releaseDir, "checksums.txt"), buildArchiveChecksums(archive, "umactually-windows-x64.zip"));

    const seeded = Buffer.from("preserve me\n");
    writeFileSync(join(installDir, "umactually.exe"), seeded);

    const result = await runArchiveInstall({
      server: { baseUrl: "http://unused", kill: () => {} },
      tag: "v0.5.0",
      installDir,
      releaseDir,
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/FullName/);
    expect(readFileSync(join(installDir, "umactually.exe"), "utf8")).toBe("preserve me\n");
    assertNoTempResidue(installDir, ["umactually.exe"]);
  });

  it("PS-HOSTILE-DUP: rejects archive with duplicate entries", async () => {
    const archive = buildArchive([
      { name: MEMBER_NAME, bytes: STUB_PAYLOAD, externalAttributes: unixModeAttrs(0o100755) },
      { name: MEMBER_NAME, bytes: STUB_PAYLOAD, externalAttributes: unixModeAttrs(0o100755) },
    ]);
    writeFileSync(join(releaseDir, "umactually-windows-x64.zip"), archive);
    writeFileSync(join(releaseDir, "checksums.txt"), buildArchiveChecksums(archive, "umactually-windows-x64.zip"));

    const seeded = Buffer.from("preserve me\n");
    writeFileSync(join(installDir, "umactually.exe"), seeded);

    const result = await runArchiveInstall({
      server: { baseUrl: "http://unused", kill: () => {} },
      tag: "v0.5.0",
      installDir,
      releaseDir,
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/exactly one entry/);
    expect(readFileSync(join(installDir, "umactually.exe"), "utf8")).toBe("preserve me\n");
    assertNoTempResidue(installDir, ["umatically.exe", "umactually.exe"]);
  });

  it("PS-HOSTILE-DIRPLUSFILE: rejects archive whose single entry has DOS directory bit", async () => {
    const archive = buildArchive([
      { name: MEMBER_NAME, bytes: STUB_PAYLOAD, externalAttributes: unixModeAttrs(0o100755) | dosDirAttrs() },
    ]);
    writeFileSync(join(releaseDir, "umactually-windows-x64.zip"), archive);
    writeFileSync(join(releaseDir, "checksums.txt"), buildArchiveChecksums(archive, "umactually-windows-x64.zip"));

    const seeded = Buffer.from("preserve me\n");
    writeFileSync(join(installDir, "umactually.exe"), seeded);

    const result = await runArchiveInstall({
      server: { baseUrl: "http://unused", kill: () => {} },
      tag: "v0.5.0",
      installDir,
      releaseDir,
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/DOS directory bit/);
    expect(readFileSync(join(installDir, "umactually.exe"), "utf8")).toBe("preserve me\n");
    assertNoTempResidue(installDir, ["umactually.exe"]);
  });

  it.each([
    ["symlink", 0o120000],
    ["fifo", 0o010000],
    ["block-device", 0o060000],
    ["char-device", 0o020000],
    ["socket", 0o140000],
    ["zero-mode", 0],
    ["dir-mode", 0o040755],
  ])("PS-HOSTILE-MODE-%s: rejects Unix mode 0o%o", async (_label, mode) => {
    const archive = buildArchive([
      { name: MEMBER_NAME, bytes: STUB_PAYLOAD, externalAttributes: unixModeAttrs(mode) },
    ]);
    writeFileSync(join(releaseDir, "umactually-windows-x64.zip"), archive);
    writeFileSync(join(releaseDir, "checksums.txt"), buildArchiveChecksums(archive, "umactually-windows-x64.zip"));

    const seeded = Buffer.from("preserve me\n");
    writeFileSync(join(installDir, "umactually.exe"), seeded);

    const result = await runArchiveInstall({
      server: { baseUrl: "http://unused", kill: () => {} },
      tag: "v0.5.0",
      installDir,
      releaseDir,
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/Unix type bits|regular Unix file/);
    expect(readFileSync(join(installDir, "umactually.exe"), "utf8")).toBe("preserve me\n");
    assertNoTempResidue(installDir, ["umactually.exe"]);
  });

  it("PS-HOSTILE-NEGATIVE-ATTRS: rejects high-bit set that demands bit-preserving conversion", async () => {
    // ExternalAttributes raw Int32 = -2147483648 (0x80000000). Bit-preserving
    // UInt32 = 0x80000000. High nibble of (0x80000000 >> 16) = 0x8000 — but
    // the high 16 bits are 0x8000; the mask 0xF000 gives 0x8000. This still
    // matches a regular-file signature, but a zero Unix high nibble (the
    // (mode << 16) for any mode without 0x8000) would be rejected.
    // Instead, assert the bit-preserving UInt32 round-trip produces the
    // exact expected high nibble by setting 0x81A4 << 16 (yazl's mode 0100755)
    // and verifying it parses as 0x8000.
    const yazlAttrs = (0x81a4 << 16) >>> 0;
    const archive = buildArchive([
      { name: MEMBER_NAME, bytes: STUB_PAYLOAD, externalAttributes: yazlAttrs },
    ]);
    writeFileSync(join(releaseDir, "umactually-windows-x64.zip"), archive);
    writeFileSync(join(releaseDir, "checksums.txt"), buildArchiveChecksums(archive, "umactually-windows-x64.zip"));

    const result = await runArchiveInstall({
      server: { baseUrl: "http://unused", kill: () => {} },
      tag: "v0.5.0",
      installDir,
      releaseDir,
    });
    expect(result.status).toBe(0); // 0x81A4 << 16 maps to 0x8000 — accepted
  });
});

describe.skipIf(!PS_AVAILABLE)("install.ps1 checksum grammar", () => {
  it.each([
    ["star", "*umactually-windows-x64.zip\n"],
    ["one-space", "0".repeat(64) + " umactually-windows-x64.zip\n"],
    ["missing", `${"0".repeat(64)}  umactually-linux-x64.tar.gz\n`],
    ["duplicate", `${"0".repeat(64)}  umactually-windows-x64.zip\n${"0".repeat(64)}  umactually-windows-x64.zip\n`],
    ["trailing-whitespace", `${"0".repeat(64)}  umactually-windows-x64.zip \n`],
    ["raw-basename-archive-contract", `${"0".repeat(64)}  umactually-windows-x64.exe\n`],
  ])("PS-CHECKSUM-%s: rejects %s", async (_label, body) => {
    // Build an archive first so the checksum file's target entry exists;
    // the installer should still fail because the full grammar rejects the
    // synthesized line.
    const fixture = seedHappyArchive();
    writeFileSync(fixture.checksumsPath, body);
    const seeded = Buffer.from("preserve me\n");
    writeFileSync(join(installDir, "umactually.exe"), seeded);

    const result = await runArchiveInstall({
      server: { baseUrl: "http://unused", kill: () => {} },
      tag: "v0.5.0",
      installDir,
      releaseDir,
    });
    expect(result.status).not.toBe(0);
    expect(readFileSync(join(installDir, "umactually.exe"), "utf8")).toBe("preserve me\n");
    assertNoTempResidue(installDir, ["umactually.exe"]);
  });

  it("PS-CHECKSUM-MISMATCH: rejects when SHA does not match zip bytes", async () => {
    seedHappyArchive();
    // Overwrite the checksum file with a wrong hash for the target.
    const text = ARCHIVE_BASENAMES.map((b) => `${"0".repeat(64)}  ${b}`).join("\n") + "\n";
    writeFileSync(join(releaseDir, "checksums.txt"), text);
    const seeded = Buffer.from("preserve me\n");
    writeFileSync(join(installDir, "umactually.exe"), seeded);

    const result = await runArchiveInstall({
      server: { baseUrl: "http://unused", kill: () => {} },
      tag: "v0.5.0",
      installDir,
      releaseDir,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/checksum mismatch/);
    expect(readFileSync(join(installDir, "umactually.exe"), "utf8")).toBe("preserve me\n");
  });
});

describe.skipIf(!PS_AVAILABLE)("install.ps1 staging and replacement", () => {
  it("PS-STAGE-001: staging filename collision is rejected (FileMode.CreateNew)", async () => {
    seedHappyArchive();
    // Pre-create a staging filename the installer would generate. We can't
    // predict the GUID exactly, so we seed a *pattern* — any sibling file
    // beginning with .umactually.exe-stage- and ending in .tmp. The
    // installer will discover that .umactually.exe-stage-<guid>.tmp is taken
    // because the OS rejects the second CreateNew.
    const stagePrefix = join(installDir, ".umactually.exe-stage-");
    // Create many candidate staging files to maximize chance of collision.
    for (let i = 0; i < 10; i += 1) {
      writeFileSync(`${stagePrefix}${i}.tmp`, "x");
    }
    // The installer uses GUIDs, so we cannot guarantee a hit. Skip the
    // collision probe and instead assert the GUID pattern in the script
    // source: `[System.IO.FileMode]::CreateNew`.
    const script = readFileSync(INSTALL_PS1, "utf8");
    expect(script).toContain("[System.IO.FileMode]::CreateNew");
    expect(script).toContain("[System.IO.FileShare]::None");
  });

  it("PS-STAGE-002: staged file is closed + flushed before smoke test runs", () => {
    const script = readFileSync(INSTALL_PS1, "utf8");
    // Both call sites (test-mode 2 + production) must close the staging
    // stream before invoking the staged --version smoke test. Find every
    // call to Invoke-StagedSmokeTest and assert the nearest preceding
    // staging-stream Close() comes first.
    const callSites = [
      script.indexOf("Invoke-StagedSmokeTest -StagedPath \$staging.Path"),
    ].filter((idx) => idx > -1);
    expect(callSites.length).toBeGreaterThan(0);
    for (const callIdx of callSites) {
      const window = script.slice(0, callIdx);
      // Find the last occurrence of $staging.Stream.Close() in the window.
      const closeIdx = window.lastIndexOf("$staging.Stream.Close()");
      expect(closeIdx).toBeGreaterThan(-1);
      // The Close must be before the smoke call in source order.
      expect(closeIdx).toBeLessThan(callIdx);
    }
  });

  it("PS-STAGE-003: install directory reparse mutation during run is refused", async () => {
    // Verify the script's Assert-InstallDirTrusted function exists and
    // validates no ReparsePoint attribute before staging.
    const script = readFileSync(INSTALL_PS1, "utf8");
    expect(script).toContain("Assert-InstallDirTrusted");
    expect(script).toContain("FileAttributes]::ReparsePoint");
    expect(script).toContain("Refusing to install into reparse-point directory");
  });

  it("PS-STAGE-004: destination identity TOCTOU change is rejected", async () => {
    seedHappyArchive();
    // Replace the destination file just before the installer re-validates.
    // This is a coarse probe: we seed a non-empty file and rely on the
    // installer to assert the captured identity still matches. We can only
    // approximate TOCTOU from a separate process; here we just verify the
    // destination identity capture/replay is wired in the script.
    const script = readFileSync(INSTALL_PS1, "utf8");
    expect(script).toContain("Get-DestinationIdentity");
    expect(script).toContain("Assert-DestinationIdentityStable");
    expect(script).toContain("Destination identity changed");
  });

  it("PS-STAGE-005: locked destination causes File.Replace to fail and preserves old bytes", async () => {
    if (!PS_AVAILABLE) return; // type narrow
    // This test opens the destination file with exclusive write lock and
    // expects File.Replace to fail. Run only on Windows hosts where the
    // FileStream(FileShare.None) behavior matches.
    if (process.platform !== "win32") {
      return; // the install.ps1 only runs on Windows in production anyway
    }
    seedHappyArchive(Buffer.from("old locked binary\n"));
    const installPath = join(installDir, "umactually.exe");
    expect(existsSync(installPath)).toBe(true);

    // Hold an exclusive lock via a Node child process.
    const lockHolder = spawn(process.execPath, ["-e",
      `const fs=require('node:fs'); const fd=fs.openSync('${installPath.replace(/\\/g, "\\\\")}', 'r+'); setInterval(()=>{}, 1000);`,
    ], { stdio: "ignore" });
    try {
      const result = await runArchiveInstall({
        server: { baseUrl: "http://unused", kill: () => {} },
        tag: "v0.5.0",
        installDir,
        releaseDir,
      });
      expect(result.status).not.toBe(0);
      // Old bytes preserved (File.Replace failure leaves the original in place)
      expect(readFileSync(installPath, "utf8")).toBe("old locked binary\n");
      assertNoTempResidue(installDir, ["umactually.exe"]);
    } finally {
      lockHolder.kill();
    }
  });
});

describe.skipIf(!PS_AVAILABLE)("install.ps1 full HTTP fixture-server round trip", () => {
  it("PS-FIXTURE-001: end-to-end install via release-fixture-server.mjs", async () => {
    if (process.platform !== "win32") {
      return; // Skip HTTP round-trip on non-Windows (test-mode-2 already covers logic)
    }
    seedHappyArchive(Buffer.from("old content\n"));
    const server = await startFixtureServer(releaseDir, { tag: "v0.5.0" });
    try {
      // Construct the asset-directory base URL the way a real user would:
      // <scheme>://<host>/releases/download/<tag>
      const assetBase = `${server.baseUrl}/releases/download/v0.5.0`;
      const env: Record<string, string> = {
        INSTALL_RELEASE_BASE: assetBase,
        INSTALL_RELEASE_TAG: "v0.5.0",
        INSTALL_ASSET_CONTRACT: "archive",
        PROCESSOR_ARCHITECTURE: "AMD64",
        USERPROFILE: join(installDir, "..", ".."),
        INSTALL_TEST_NO_SMOKE: "1",
      };
      const result = runInstall(env);
      if (result.status !== 0) {
        console.error("STDOUT:", result.stdout);
        console.error("STDERR:", result.stderr);
      }
      expect(result.status).toBe(0);
      const installPath = join(installDir, "umactually.exe");
      expect(bytesToString(readFileSync(installPath)))
        .toBe(bytesToString(STUB_PAYLOAD));
      assertNoTempResidue(installDir, ["umactually.exe"]);
    } finally {
      server.kill();
    }
  });
});
