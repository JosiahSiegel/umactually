// SPDX-License-Identifier: MIT
// Regression test for the v0.5.0 hotfix.
//
// Bug history (see `.omo/notepads/release-binary-download-size/learnings.md`):
// the workflow at .github/workflows/release.yml passed
// `--out-dir release/public` to the packager while passing
// `--release-dir release` to the verifier. The verifier then failed with:
//   verify-release-assets: missing archive for target linux-x64:
//     release/umactually-linux-x64.tar.gz
// Unit tests passed because they used `--release-dir X --out-dir X` (the
// same directory), so the asymmetry was never exercised end-to-end.
//
// This file nails the post-fix contract: packager + verifier work whether
// the user wires them with
//   1. one shared `--release-dir` (the FIXED workflow pattern), or
//   2. distinct `--release-dir` / `--out-dir` (the originally-broken,
//      now-fixed-as-unnecessary workflow pattern).
// In both cases the verifier must exit 0 and write a complete report
// populated from the raws that ALSO live under `--release-dir`.
//
// The scripts themselves do not need to change for this contract — the
// fix is in the workflow. Both wiring patterns are valid; the bug was
// simply inconsistent wiring.

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NODE_24_REQUIRED } from "../helpers/node-version-gate.ts";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const MANIFEST = join(REPO_ROOT, "scripts", "release-targets.json");
const PACKAGER = join(REPO_ROOT, "scripts", "package-release-assets.mjs");
const VERIFIER = join(REPO_ROOT, "scripts", "verify-release-assets.mjs");

type Target = Readonly<{
  id: string;
  rawName: string;
  archiveName: string;
}>;

const targets = JSON.parse(readFileSync(MANIFEST, "utf8")) as readonly Target[];

function sha256Hex(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function runScript(script: string, args: readonly string[]): { status: number | null; stderr: string; stdout: string } {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return {
    status: result.status,
    stderr: typeof result.stderr === "string" ? result.stderr : "",
    stdout: typeof result.stdout === "string" ? result.stdout : "",
  };
}

// Mirrors the `--release-dir X --out-dir X` pattern that pre-fix unit
// tests used, plus the canonical 256 KiB fixture so gzip ratios are
// meaningful.
function seedRawFixtures(dir: string): void {
  mkdirSync(dir, { recursive: true });
  for (const target of targets) {
    const bytes = Buffer.alloc(256 * 1024, `v-${target.id}-`.charCodeAt(0));
    writeFileSync(join(dir, target.rawName), bytes);
  }
}

let sandbox: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "umactually-release-workflow-"));
});

afterEach(() => {
  if (sandbox !== "" && existsSync(sandbox)) {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

describe.skipIf(NODE_24_REQUIRED)("release.yml packager + verifier wiring", () => {
  // The workflow's FIXED invocation pattern: packager and verifier both
  // point at the SAME --release-dir (the packager writes archives into
  // --release-dir by default when --out-dir is omitted). The staging
  // step then renames them into public/<archives> + internal/raw/<raw>.
  it("FIXED workflow pattern: packager --release-dir X (no --out-dir) + verifier --release-dir X", () => {
    const releaseDir = join(sandbox, "release");
    seedRawFixtures(releaseDir);

    const packagerResult = runScript(PACKAGER, [
      "--manifest", MANIFEST,
      "--release-dir", releaseDir,
    ]);
    expect(packagerResult.status, `packager stderr: ${packagerResult.stderr}`).toBe(0);
    // Archives landed next to the raws (the workflow's flat layout).
    for (const target of targets) {
      expect(existsSync(join(releaseDir, target.archiveName))).toBe(true);
      expect(existsSync(join(releaseDir, target.rawName))).toBe(true);
    }

    const reportPath = join(sandbox, "release-size-report.json");
    const verifierResult = runScript(VERIFIER, [
      "--manifest", MANIFEST,
      "--release-dir", releaseDir,
      "--measure",
      "--report", reportPath,
    ]);
    expect(verifierResult.status, `verifier stderr: ${verifierResult.stderr}`).toBe(0);

    const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
      targets: ReadonlyArray<{
        id: string;
        archiveName: string;
        rawBytes: number;
        archiveBytes: number;
        ratio: number;
        sha256: string;
      }>;
    };
    expect(report.targets).toHaveLength(6);
    for (const row of report.targets) {
      const onDiskArchive = readFileSync(join(releaseDir, row.archiveName));
      expect(row.sha256).toBe(sha256Hex(onDiskArchive));
      // Raw bytes are present in --release-dir alongside the archives.
      expect(row.rawBytes).toBeGreaterThan(0);
      expect(row.archiveBytes).toBe(onDiskArchive.length);
    }
  });

  // The workflow's PRE-FIX (buggy) invocation pattern, rescued from
  // being a footgun: packager --release-dir B --out-dir A and verifier
  // --release-dir A. The original bug had the verifier pointed at B
  // (NOT A), which is what made the workflow fail. Pin this pattern
  // so future workflow authors cannot accidentally reintroduce the
  // mismatch.
  it("PRE-FIX workflow pattern: packager --release-dir B --out-dir A + verifier --release-dir A succeeds", () => {
    const releaseDirB = join(sandbox, "release-b");
    const releaseDirA = join(sandbox, "release-a");
    seedRawFixtures(releaseDirB);

    const packagerResult = runScript(PACKAGER, [
      "--manifest", MANIFEST,
      "--release-dir", releaseDirB,
      "--out-dir", releaseDirA,
    ]);
    expect(packagerResult.status, `packager stderr: ${packagerResult.stderr}`).toBe(0);

    // Archives are in A, raws stayed in B. The verifier looks in A for
    // archives (and tolerates missing raws — they default to 0).
    for (const target of targets) {
      expect(existsSync(join(releaseDirA, target.archiveName))).toBe(true);
    }

    const reportPath = join(sandbox, "report.json");
    const verifierResult = runScript(VERIFIER, [
      "--manifest", MANIFEST,
      "--release-dir", releaseDirA,
      "--measure",
      "--report", reportPath,
    ]);
    expect(verifierResult.status, `verifier stderr: ${verifierResult.stderr}`).toBe(0);

    const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
      targets: ReadonlyArray<{ id: string; archiveName: string; sha256: string; archiveBytes: number }>;
    };
    expect(report.targets).toHaveLength(6);
    for (const row of report.targets) {
      const onDiskArchive = readFileSync(join(releaseDirA, row.archiveName));
      expect(row.sha256).toBe(sha256Hex(onDiskArchive));
    }
  });

  // The pre-fix failure mode, frozen as an invariant: verifier pointed
  // at the SAME dir the packager reads (B), NOT the dir the packager
  // wrote to (A), must continue to fail-closed with a target-specific
  // diagnostic naming the missing archive. If this regression ever
  // flips (the verifier starts tolerating missing archives), the
  // contract that produced the v0.5.0 failure message has shifted
  // silently and the workflow's safety net is gone.
  it("regression: verifier --release-dir B (where packager wrote to A) still fails with the v0.5.0 diagnostic", () => {
    const releaseDirB = join(sandbox, "release-b");
    const releaseDirA = join(sandbox, "release-a");
    seedRawFixtures(releaseDirB);

    const packagerResult = runScript(PACKAGER, [
      "--manifest", MANIFEST,
      "--release-dir", releaseDirB,
      "--out-dir", releaseDirA,
    ]);
    expect(packagerResult.status).toBe(0);

    const reportPath = join(sandbox, "report.json");
    const verifierResult = runScript(VERIFIER, [
      "--manifest", MANIFEST,
      "--release-dir", releaseDirB,
      "--measure",
      "--report", reportPath,
    ]);
    expect(verifierResult.status).not.toBe(0);
    expect(verifierResult.stderr).toMatch(/missing archive for target linux-x64/);
    // No report is written on failure (verifier errors out before
    // writing); assert that too so the failure surface stays narrow.
    expect(existsSync(reportPath)).toBe(false);
  });

  // End-to-end rehearsal of the staging step that ships in the workflow:
  // packager and verifier run first, THEN the flat release/ root is
  // split via rename into public/<archives>, public/checksums.txt,
  // internal/raw/<raws>, and the verifier's report at
  // internal/release-size-report.json. After the rename, all of the
  // file paths the smoke + publish jobs expect to exist must exist.
  it("end-to-end: packager → verifier → staging rename produces the candidate-bundle layout", () => {
    const releaseDir = join(sandbox, "release");
    seedRawFixtures(releaseDir);

    const packagerResult = runScript(PACKAGER, [
      "--manifest", MANIFEST,
      "--release-dir", releaseDir,
    ]);
    expect(packagerResult.status).toBe(0);

    const reportPath = join(releaseDir, "internal", "release-size-report.json");
    const verifierResult = runScript(VERIFIER, [
      "--manifest", MANIFEST,
      "--release-dir", releaseDir,
      "--measure",
      "--bun-version", "1.3.14",
      "--report", reportPath,
    ]);
    expect(verifierResult.status).toBe(0);

    // Mirror the staging step in release.yml (line 102+).
    const stagingResult = spawnSync(
      process.execPath,
      [
        "-e",
        `
          const fs = require("node:fs");
          const targets = JSON.parse(fs.readFileSync(${JSON.stringify(MANIFEST)}, "utf8"));
          fs.mkdirSync("release/public", { recursive: true });
          fs.mkdirSync("release/internal/raw", { recursive: true });
          for (const t of targets) {
            fs.renameSync(\`release/\${t.archiveName}\`, \`release/public/\${t.archiveName}\`);
            fs.renameSync(\`release/\${t.rawName}\`, \`release/internal/raw/\${t.rawName}\`);
          }
          fs.renameSync("release/checksums.txt", "release/public/checksums.txt");
        `,
      ],
      { cwd: sandbox, encoding: "utf8" },
    );
    expect(stagingResult.status, `staging stderr: ${stagingResult.stderr ?? ""}`).toBe(0);

    // Exact root layout the publish job (`Validate exact candidate
    // bundle layout`, `gh release create (draft)`, and the smoke jobs
    // that `sha256sum -c checksums.txt`) expect.
    for (const target of targets) {
      expect(existsSync(join(releaseDir, "public", target.archiveName))).toBe(true);
      expect(existsSync(join(releaseDir, "internal", "raw", target.rawName))).toBe(true);
    }
    expect(existsSync(join(releaseDir, "public", "checksums.txt"))).toBe(true);
    expect(existsSync(join(releaseDir, "internal", "release-size-report.json"))).toBe(true);
    // After staging, the flat root has been drained.
    expect(existsSync(join(releaseDir, "checksums.txt"))).toBe(false);
    for (const target of targets) {
      expect(existsSync(join(releaseDir, target.archiveName))).toBe(false);
      expect(existsSync(join(releaseDir, target.rawName))).toBe(false);
    }
  });
});
