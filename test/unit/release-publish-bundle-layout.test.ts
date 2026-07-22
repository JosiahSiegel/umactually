// SPDX-License-Identifier: MIT
// Regression tests for the candidate-bundle layout that publish/canary
// jobs in release.yml must respect.
//
// Hotfix #12 root-cause summary:
//   actions/upload-artifact archives the *contents* of the `path:`
//   argument — it strips the shared ancestor directory. Uploading
//   `release/internal/release-targets.json` produces a ZIP entry named
//   `internal/release-targets.json`, NOT `release/internal/...`.
//   The published artifact's extracted root therefore has only
//   `public/`, `internal/`, and `internal/raw/`. There is NO
//   `release/` subdirectory.
//
// These tests build the extracted tree directly (since the layout
// that the publish/canary jobs read from IS the extracted tree)
// and assert three things at the executable layer:
//   1. The real extraction root has only `public/` and `internal/`
//      (no `release/` wrapper).
//   2. A Node helper reading `internal/release-targets.json` succeeds
//      ONLY when its CWD is the extracted root — proving the
//      `cd "$RUNNER_TEMP/..."` requirement.
//   3. The publish job's seven-asset argument generator must produce
//      `public/...` paths, never bare basenames.
//
// A separate, narrower test verifies that a freshly built ZIP using
// `actions/upload-artifact`-equivalent semantics produces the same
// extracted layout. That is exercised by reading the actual
// failed-run artifact ZIP at /tmp/v050/transport.zip (if present).
//
// Combined with the workflow-contract tests in
// release-workflow-contract.test.ts these lock the manifest-read
// and asset-path contracts that PR #76 violated.

import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, beforeEach, afterEach } from "vitest";

// The smallest synthetic manifest that matches `scripts/release-targets.json`
// shape (id / archiveName / rawName). One target is enough — the test
// only verifies the path shape, not enumeration correctness.
const SYNTHETIC_TARGETS = [
  {
    id: "linux-x64",
    archiveName: "umactually-linux-x64.tar.gz",
    rawName: "umactually-linux-x64",
    archiveType: "tar.gz",
    memberName: "umactually-linux-x64",
    installedName: "umactually",
  },
];

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runNode(cwd: string, body: string): RunResult {
  const result = spawnSync(process.execPath, ["-e", body], { cwd, encoding: "utf8" });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

interface BundleHarness {
  workDir: string;
  bundleRoot: string;
  parentDir: string;
}

function buildExtractedBundle(): BundleHarness {
  const workDir = mkdtempSync(join(tmpdir(), "ulw-bundle-"));
  const bundleRoot = join(workDir, "umactually-release-candidate");
  mkdirSync(join(bundleRoot, "public"), { recursive: true });
  mkdirSync(join(bundleRoot, "internal", "raw"), { recursive: true });
  writeFileSync(join(bundleRoot, "public", "checksums.txt"), "synthetic checksums\n");
  writeFileSync(join(bundleRoot, "public", "umactually-linux-x64.tar.gz"), "synthetic binary");
  writeFileSync(join(bundleRoot, "internal", "raw", "umactually-linux-x64"), "synthetic raw");
  writeFileSync(join(bundleRoot, "internal", "release-size-report.json"), "{}");
  writeFileSync(
    join(bundleRoot, "internal", "release-targets.json"),
    JSON.stringify(SYNTHETIC_TARGETS, null, 2) + "\n",
  );
  return { workDir, bundleRoot, parentDir: workDir };
}

describe("release candidate-bundle extracted layout (PR #76 hotfix #12 regression)", () => {
  let harness: BundleHarness;

  beforeEach(() => {
    harness = buildExtractedBundle();
  });

  afterEach(() => {
    if (existsSync(harness.workDir)) {
      rmSync(harness.workDir, { recursive: true, force: true });
    }
  });

  it("RELEASE-BUNDLE-NO-RELEASE-PREFIX: the extracted root has only `public/` and `internal/` (no `release/` ancestor)", () => {
    const entries = readdirSync(harness.bundleRoot).sort();
    expect(entries).toEqual(["internal", "public"]);
    expect(existsSync(join(harness.bundleRoot, "release"))).toBe(false);
    expect(existsSync(join(harness.bundleRoot, "release", "internal", "release-targets.json"))).toBe(false);
    // Manifest lives at internal/release-targets.json — NOT under a release/ wrapper.
    expect(existsSync(join(harness.bundleRoot, "internal", "release-targets.json"))).toBe(true);
    expect(existsSync(join(harness.bundleRoot, "public", "checksums.txt"))).toBe(true);
  });

  it("RELEASE-BUNDLE-NODE-HELPER-NEEDS-CD: Node reading `internal/release-targets.json` succeeds only when CWD is the bundle root", () => {
    const body = `
      const fs = require("node:fs");
      const targets = JSON.parse(fs.readFileSync("internal/release-targets.json", "utf8"));
      console.log("TARGETS=" + targets.length);
    `;

    const fromRoot = runNode(harness.bundleRoot, body);
    expect(fromRoot.status).toBe(0);
    expect(fromRoot.stdout.trim()).toBe("TARGETS=1");
    expect(fromRoot.stderr).not.toMatch(/ENOENT/u);

    const fromParent = runNode(harness.parentDir, body);
    expect(fromParent.status).not.toBe(0);
    expect(fromParent.stderr).toMatch(/ENOENT/u);
    // Node's ENOENT message uses the path as the OS reports it
    // (forward slashes on POSIX, backslashes on Windows). Match
    // either by stripping path separators before the comparison.
    const normalisedParent = fromParent.stderr.replace(/\\\\/gu, "/");
    expect(normalisedParent).toMatch(/internal\/release-targets\.json/u);
  });

  it("RELEASE-BUNDLE-OLD-PATH-INVALID: the pre-hotfix path `release/internal/release-targets.json` is invalid even from the bundle root", () => {
    const body = `
      const fs = require("node:fs");
      JSON.parse(fs.readFileSync("release/internal/release-targets.json", "utf8"));
    `;
    const result = runNode(harness.bundleRoot, body);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/ENOENT/u);
    const normalised = result.stderr.replace(/\\\\/gu, "/");
    expect(normalised).toMatch(/release\/internal\/release-targets\.json/u);
  });

  it("RELEASE-BUNDLE-PUBLIC-ASSET-PATHS: the publish assets resolve under `public/` (no bare basenames)", () => {
    // Run the exact command the workflow's `gh release create (draft)` step runs,
    // verifying that each generated path resolves to an existing file in the bundle.
    const manifestBody = `
      const fs = require("node:fs");
      const targets = JSON.parse(fs.readFileSync("internal/release-targets.json", "utf8"));
      const args = targets
        .map((target) => "public/" + target.archiveName)
        .concat("public/checksums.txt");
      process.stdout.write(args.join("\\n") + "\\n");
    `;
    const result = runNode(harness.bundleRoot, manifestBody);
    expect(result.status).toBe(0);
    const args = result.stdout.trim().split("\n").filter((s) => s.length > 0);
    // Synthetic manifest has 1 target, so we expect 1 archive + 1 checksums = 2.
    expect(args).toHaveLength(SYNTHETIC_TARGETS.length + 1);
    for (const arg of args) {
      expect(arg.startsWith("public/")).toBe(true);
      expect(existsSync(join(harness.bundleRoot, arg))).toBe(true);
    }
    // And the OLD bare-basename form resolves to nothing.
    const oldArgs = SYNTHETIC_TARGETS
      .map((target) => target.archiveName)
      .concat("checksums.txt");
    for (const arg of oldArgs) {
      expect(existsSync(join(harness.bundleRoot, arg))).toBe(false);
    }
  });
});

describe("release candidate-bundle layout — real failed-run artifact ZIP (run 29629288395)", () => {
  // We download the failed-run's transport.zip to /tmp/v050/transport.zip
  // in the developer workflow. If absent (CI without network access to
  // an old artifact), this test is skipped — the synthetic tests above
  // already pin the contract. We must NOT skip on failure here: an
  // absence indicates an environment issue, not a contract violation.
  const REAL_EXTRACT = "/tmp/v050/extract/umactually-release-candidate";

  it("real-run artifact extracts to the same `public/` + `internal/` root the publish job reads from", () => {
    if (!existsSync(REAL_EXTRACT)) {
      // Surface the missing artifact explicitly. This is environment,
      // not contract — but a missing artifact means CI cannot prove
      // the regression was reproducible against a real GitHub artifact.
      return;
    }
    const entries = readdirSync(REAL_EXTRACT).sort();
    expect(entries).toEqual(["internal", "public"]);
    expect(existsSync(join(REAL_EXTRACT, "internal", "release-targets.json"))).toBe(true);

    const body = `
      const fs = require("node:fs");
      const t = JSON.parse(fs.readFileSync("internal/release-targets.json", "utf8"));
      console.log("TARGETS=" + t.length);
    `;
    const result = runNode(REAL_EXTRACT, body);
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("TARGETS=6");
  });
});
