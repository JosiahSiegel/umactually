// SPDX-License-Identifier: MIT
//
// test/unit/verify-release-sizes.test.ts
// ======================================
// Unit tests for scripts/verify-release-sizes.mjs.
//
// Background
// ----------
// v0.6.0 replaced the Bun --compile verify step (verify-release-assets.mjs)
// with a leaner per-target size check (verify-release-sizes.mjs). The
// new size-report JSON has a deliberately smaller schema than v0.5.x:
//
//   v0.5.x (verify-release-assets.mjs):
//     { targets: [{ id, rawName, archiveName, rawBytes, archiveBytes, ratio, sha256 }], ... }
//
//   v0.6.0 (verify-release-sizes.mjs):
//     { targets: [{ id, rawName, sizeBytes, missing?, tooSmall?, tooLarge? }],
//       generatedAt: <ISO timestamp> }
//
// The release-size-report.json is internal-only (uploaded to the
// canary pre-flight, never to the public release). The downstream
// consumers — .github/workflows/release.yml's `build-package` step
// and the canary pre-publish validation — only check file presence,
// not field shape. These tests lock the v0.6.0 schema so a future
// refactor that silently re-introduces a v0.5.x field (or drops a
// required one) is caught at unit-test time, not on a release run.

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");
const VERIFIER_PATH = resolve(REPO_ROOT, "scripts", "verify-release-sizes.mjs");

interface VerifyResult {
  targets: Array<{
    id: string;
    rawName: string;
    sizeBytes: number;
    missing?: boolean;
    tooSmall?: boolean;
    tooLarge?: boolean;
  }>;
  failed: number;
}

let workRoot = "";
let manifestPath = "";
let releaseDir = "";
let reportPath = "";

beforeAll(async () => {
  // Load the verifier module once for all tests.
  const mod = (await import(VERIFIER_PATH)) as {
    verifyReleaseSizes: (opts: {
      manifestPath: string;
      releaseDir: string;
      reportPath: string;
    }) => VerifyResult;
  };
  (globalThis as Record<string, unknown>).__verifier = mod.verifyReleaseSizes;
});

beforeAll(() => {
  workRoot = join(tmpdir(), `umactually-verify-release-sizes-${Date.now()}`);
  mkdirSync(workRoot, { recursive: true });
  releaseDir = join(workRoot, "release");
  manifestPath = join(workRoot, "manifest.json");
  reportPath = join(releaseDir, "internal", "release-size-report.json");
  mkdirSync(releaseDir, { recursive: true });
});

afterAll(() => {
  if (existsSync(workRoot)) {
    rmSync(workRoot, { recursive: true, force: true });
  }
});

const getVerifier = () =>
  (globalThis as Record<string, unknown>).__verifier as (opts: {
    manifestPath: string;
    releaseDir: string;
    reportPath: string;
  }) => VerifyResult;

function writeTargets(targets: Array<Record<string, unknown>>) {
  writeFileSync(manifestPath, JSON.stringify(targets, null, 2));
}

describe("verify-release-sizes.mjs report schema (v0.6.0)", () => {
  it("writes a report with the v0.6.0 field shape (id/rawName/sizeBytes/generatedAt)", () => {
    // Drop any leftover raw files from a prior test run.
    for (const f of ["umactually-linux-x64", "umactually-darwin-arm64"]) {
      const p = join(releaseDir, f);
      if (existsSync(p)) rmSync(p, { force: true });
    }
    writeTargets([
      { id: "linux-x64", rawName: "umactually-linux-x64" },
      { id: "darwin-arm64", rawName: "umactually-darwin-arm64" },
    ]);
    // Write 50 MiB raw binaries so they pass MIN/MAX bounds (1 MiB / 200 MiB).
    const ok = Buffer.alloc(50 * 1024 * 1024, 0);
    writeFileSync(join(releaseDir, "umactually-linux-x64"), ok);
    writeFileSync(join(releaseDir, "umactually-darwin-arm64"), ok);

    const result = getVerifier()({ manifestPath, releaseDir, reportPath });
    expect(result.failed).toBe(0);

    // The report file must exist at the pinned path.
    expect(existsSync(reportPath)).toBe(true);

    const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
      targets: Array<Record<string, unknown>>;
      generatedAt: string;
    };

    // Top-level shape: v0.6.0 dropped `failed` / `summary` and
    // only carries `targets` + `generatedAt`. Lock that here so a
    // future bump that adds a v0.5.x field is intentional, not
    // accidental.
    expect(Object.keys(report).sort()).toEqual(["generatedAt", "targets"]);

    // generatedAt is an ISO 8601 timestamp.
    expect(typeof report.generatedAt).toBe("string");
    expect(() => new Date(report.generatedAt).toISOString()).not.toThrow();

    // Per-target shape: id/rawName/sizeBytes are required.
    // missing/tooSmall/tooLarge are optional flags — must NOT be
    // present on a clean pass.
    for (const t of report.targets) {
      expect(typeof t.id).toBe("string");
      expect(typeof t.rawName).toBe("string");
      expect(typeof t.sizeBytes).toBe("number");
      expect(t).not.toHaveProperty("missing");
      expect(t).not.toHaveProperty("tooSmall");
      expect(t).not.toHaveProperty("tooLarge");
      // v0.5.x fields that were dropped in v0.6.0: if any of these
      // reappear, the schema drifted and the canary probe that
      // only checks `report` existence will silently accept a
      // regressed shape.
      expect(t).not.toHaveProperty("archiveName");
      expect(t).not.toHaveProperty("rawBytes");
      expect(t).not.toHaveProperty("archiveBytes");
      expect(t).not.toHaveProperty("ratio");
      expect(t).not.toHaveProperty("sha256");
    }
  });

  it("marks missing targets with the missing flag (no throw, no sha256 in report)", () => {
    // Drop any files left behind by the previous test so the
    // "missing" assertion is deterministic — otherwise the previous
    // test's 100-byte linux-x64 + this test's 50 MiB linux-x64 +
    // a leftover darwin-arm64 from the first test would mask the
    // missing-target path.
    for (const f of ["umactually-linux-x64", "umactually-darwin-arm64"]) {
      const p = join(releaseDir, f);
      if (existsSync(p)) rmSync(p, { force: true });
    }
    writeTargets([
      { id: "linux-x64", rawName: "umactually-linux-x64" },
      { id: "darwin-arm64", rawName: "umactually-darwin-arm64" },
    ]);
    // Only one of the two raw files is present.
    writeFileSync(
      join(releaseDir, "umactually-linux-x64"),
      Buffer.alloc(50 * 1024 * 1024, 0),
    );

    const result = getVerifier()({ manifestPath, releaseDir, reportPath });
    expect(result.failed).toBe(1);
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
      targets: Array<{ id: string; missing?: boolean }>;
    };
    const missing = report.targets.find((t) => t.id === "darwin-arm64");
    expect(missing?.missing).toBe(true);
    // Even on the failure path, v0.5.x fields must stay out of the
    // report — a regression here would be a silent canary-pierce.
    for (const t of report.targets) {
      expect(t).not.toHaveProperty("sha256");
      expect(t).not.toHaveProperty("ratio");
    }
  });

  it("reports tooSmall / tooLarge without leaking v0.5.x shape", () => {
    // Drop leftover raw files from the previous test so the
    // 100-byte "too small" assertion is the only failure the
    // verifier sees in this scenario.
    for (const f of ["umactually-linux-x64", "umactually-darwin-arm64"]) {
      const p = join(releaseDir, f);
      if (existsSync(p)) rmSync(p, { force: true });
    }
    writeTargets([{ id: "linux-x64", rawName: "umactually-linux-x64" }]);
    // 100 bytes < MIN_RAW_BYTES (1 MiB)
    writeFileSync(join(releaseDir, "umactually-linux-x64"), Buffer.alloc(100, 0));

    const result = getVerifier()({ manifestPath, releaseDir, reportPath });
    expect(result.failed).toBe(1);
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
      targets: Array<Record<string, unknown>>;
    };
    const t = report.targets[0];
    expect(t.tooSmall).toBe(true);
    expect(t).not.toHaveProperty("sha256");
  });
});
