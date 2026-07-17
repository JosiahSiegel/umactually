// SPDX-License-Identifier: MIT
// Contract tests for scripts/release-size-budget.json and the budget
// loader in scripts/verify-release-assets.mjs.
//
// Lock the plan-mandated formula and reject every malformed budget
// shape that the verifier's budget loader must catch:
//
//   - missing-manifest-id perTarget key
//   - negative / non-numeric / non-integer / NaN / Infinity maxArchiveBytes
//   - global.maxRatio > 1
//
// The plan's per-target formula is
// `maxArchiveBytes = ceil((baselineArchiveBytes * 1.10) / 1MiB) * 1MiB`.
// A baseline of 61.6 MiB → ceiling = 68 MiB is the canonical example
// (the same arithmetic that produced the darwin-arm64 / linux-x64
// ceilings in scripts/release-size-budget.json).
//
// The test exercises the verifier in --enforce mode against synthetic
// budgets and packages fixture archives via scripts/package-release-assets.mjs
// the same way `test/unit/release-assets.test.ts` does, so the
// exit-code assertions reflect the production CLI surface.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const VERIFIER = join(REPO_ROOT, "scripts", "verify-release-assets.mjs");
const MANIFEST = join(REPO_ROOT, "scripts", "release-targets.json");
const PACKAGER = join(REPO_ROOT, "scripts", "package-release-assets.mjs");
const BUDGET = join(REPO_ROOT, "scripts", "release-size-budget.json");

const MIB = 1024 * 1024;

type Target = Readonly<{
  id: string;
  rawName: string;
  archiveName: string;
  archiveType: string;
}>;
const targets = JSON.parse(readFileSync(MANIFEST, "utf8")) as readonly Target[];

function packageFixture(releaseDir: string): void {
  mkdirSync(releaseDir, { recursive: true });
  for (const target of targets) {
    const bytes = Buffer.alloc(256 * 1024, `v-${target.id}-`.charCodeAt(0));
    writeFileSync(join(releaseDir, target.rawName), bytes);
  }
  const result = spawnSync(
    process.execPath,
    [
      PACKAGER,
      "--manifest",
      MANIFEST,
      "--release-dir",
      releaseDir,
      "--out-dir",
      releaseDir,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    const stderr = typeof result.stderr === "string" ? result.stderr : "";
    const stdout = typeof result.stdout === "string" ? result.stdout : "";
    throw new Error(`packager failed (status=${result.status}): ${stderr}${stdout}`);
  }
}

type SpawnResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

function runVerifier(args: readonly string[]): SpawnResult {
  const result = spawnSync(process.execPath, [VERIFIER, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

let sandbox: string;
let releaseDir: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "umactually-release-budget-"));
  releaseDir = join(sandbox, "release");
  packageFixture(releaseDir);
});

afterEach(() => {
  if (sandbox !== "" && existsSync(sandbox)) {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

describe("release-size-budget.json — formula correctness", () => {
  it("derives 68 MiB from a 61.6 MiB baseline", () => {
    // The plan's canonical example: 61.6 MiB → 68 MiB.
    const baselineBytes = 61.6 * MIB;
    const ceiling = Math.ceil((baselineBytes * 1.10) / MIB) * MIB;
    expect(ceiling).toBe(68 * MIB);
    expect(ceiling).toBe(71303168);
  });

  it("derives per-target ceilings for the six manifest targets", () => {
    // The budget file is committed with these exact values. Each value
    // is the result of `ceil((baselineMiB * 1.10) / 1MiB) * 1MiB`.
    type BudgetFile = Readonly<{
      bunVersion: string;
      packagingVersion: {
        schema: number;
        node: string;
        zlib: string;
        tarStream: string;
        yazl: string;
        yauzl: string;
      };
      perTarget: Record<string, { maxArchiveBytes: number }>;
    }>;
    const budget = JSON.parse(readFileSync(BUDGET, "utf8")) as BudgetFile;

    // bunVersion pinned to 1.3.14 per the plan.
    expect(budget.bunVersion).toBe("1.3.14");

    // packagingVersion is a frozen snapshot of the build environment
    // recorded when scripts/release-size-budget.json was last
    // regenerated. The file is committed to the repo, so its
    // `node` / `zlib` fields reflect the Node + zlib versions of the
    // regenerator — NOT the Node version running this test. Asserting
    // equality against `process.versions.node` made the test pass on
    // the regenerating machine (Node 24.15.0) and fail on every other
    // Node version (e.g. CI's Node 24.18.0 on Linux).
    //
    // What this test should actually lock down:
    //  - schema is the contract version (currently 1)
    //  - the three npm-version pins are exact (tar-stream, yazl, yauzl)
    //  - the node / zlib strings look like valid semver-like build
    //    identifiers (informational, not a runtime invariant)
    expect(budget.packagingVersion.schema).toBe(1);
    expect(budget.packagingVersion.tarStream).toBe("3.2.0");
    expect(budget.packagingVersion.yazl).toBe("3.3.1");
    expect(budget.packagingVersion.yauzl).toBe("3.4.0");
    expect(budget.packagingVersion.node).toMatch(/^\d+\.\d+\.\d+/);
    expect(budget.packagingVersion.zlib).toMatch(/^\d+\.\d+\.\d+/);

    // Per-target ceilings match the formula against the v0.4.1
    // baseline values recorded in .omo/drafts/release-binary-download-size.md.
    const expected = {
      "linux-x64": 68 * MIB,
      "linux-arm64": 67 * MIB,
      "darwin-x64": 93 * MIB,
      "darwin-arm64": 93 * MIB,
      "windows-x64": 83 * MIB,
      "windows-arm64": 82 * MIB,
    };
    for (const [id, ceiling] of Object.entries(expected)) {
      expect(budget.perTarget[id]?.maxArchiveBytes).toBe(ceiling);
    }

    // Sanity-check the arithmetic: each ceiling equals the recorded
    // baseline (in MiB) multiplied by 1.10 then rounded up.
    const baselines = {
      "linux-x64": 61.6,
      "linux-arm64": 60.9,
      "darwin-x64": 84,
      "darwin-arm64": 84,
      "windows-x64": 75,
      "windows-arm64": 74,
    };
    for (const [id, baselineMiB] of Object.entries(baselines)) {
      const derived = Math.ceil((baselineMiB * MIB * 1.10) / MIB) * MIB;
      expect(budget.perTarget[id]?.maxArchiveBytes).toBe(derived);
    }
  });

  it("global limits match the verifier's built-in fallback", () => {
    type BudgetFile = Readonly<{
      global: { maxRatio: number; maxArchiveBytes: number };
    }>;
    const budget = JSON.parse(readFileSync(BUDGET, "utf8")) as BudgetFile;
    // 50% ratio cap, 50 MiB absolute cap — these are the plan's
    // global rules from `Scope` line 40.
    expect(budget.global.maxRatio).toBe(0.5);
    expect(budget.global.maxArchiveBytes).toBe(52428800);
  });
});

describe("verify-release-assets — budget-loader validation", () => {
  // Generate a checksums.txt up front (one per test) so the
  // `--enforce --budget <path>` invocation has something to verify
  // against. The verifier's CLI requires either an existing
  // checksums.txt or `--measure` to be passed together with
  // `--enforce`; pre-measuring keeps every test self-contained.
  let measuredDir: string;
  beforeEach(() => {
    measuredDir = join(sandbox, "measured");
    mkdirSync(measuredDir, { recursive: true });
    for (const target of targets) {
      const bytes = Buffer.alloc(256 * 1024, `v-${target.id}-`.charCodeAt(0));
      writeFileSync(join(measuredDir, target.rawName), bytes);
    }
    const result = spawnSync(
      process.execPath,
      [
        PACKAGER,
        "--manifest",
        MANIFEST,
        "--release-dir",
        measuredDir,
        "--out-dir",
        measuredDir,
      ],
      { encoding: "utf8" },
    );
    expect(result.status, `packager failed: ${result.stderr}`).toBe(0);
    const verifierResult = runVerifier([
      "--manifest",
      MANIFEST,
      "--release-dir",
      measuredDir,
      "--measure",
    ]);
    expect(verifierResult.status, `measure failed: ${verifierResult.stderr}`).toBe(0);
  });

  function writeBudget(name: string, payload: unknown): string {
    const path = join(sandbox, name);
    writeFileSync(path, JSON.stringify(payload), "utf8");
    return path;
  }

  function runEnforceWithBudget(budgetPath: string): SpawnResult {
    return runVerifier([
      "--manifest",
      MANIFEST,
      "--release-dir",
      measuredDir,
      "--enforce",
      "--budget",
      budgetPath,
    ]);
  }

  function permissiveGlobalBudget(): Record<string, unknown> {
    return {
      global: { maxRatio: 0.5, maxArchiveBytes: 52428800 },
    };
  }

  it("accepts the committed budget file (regression guard)", () => {
    // The committed budget file must pass --enforce against the
    // fixture archive sizes (256 KiB raw → tiny archives).
    const result = runEnforceWithBudget(BUDGET);
    expect(result.status, `stderr: ${result.stderr}`).toBe(0);
  });

  it("reducing one per-target ceiling to actual-1 exits 1 and names that target", () => {
    // Read the actual archive sizes from the freshly-measured dir.
    const reportPath = join(sandbox, "report.json");
    const measureResult = runVerifier([
      "--manifest",
      MANIFEST,
      "--release-dir",
      measuredDir,
      "--measure",
      "--report",
      reportPath,
    ]);
    expect(measureResult.status).toBe(0);
    const report = JSON.parse(readFileSync(reportPath, "utf8")) as {
      targets: Array<{ id: string; archiveBytes: number }>;
    };
    const victim = report.targets[2]!; // deterministic pick: darwin-x64
    const budget = {
      global: { maxRatio: 0.5, maxArchiveBytes: 52428800 },
      perTarget: {
        [victim.id]: { maxArchiveBytes: victim.archiveBytes - 1 },
      },
    };
    const budgetPath = writeBudget("minus-one.json", budget);
    const enforceResult = runEnforceWithBudget(budgetPath);
    expect(enforceResult.status).not.toBe(0);
    const combined = `${enforceResult.stderr}${enforceResult.stdout}`;
    expect(combined).toContain(victim.id);
    expect(combined.toLowerCase()).toMatch(/exceeds|maxarchivebytes|ceiling/);
  });

  it("rejects a perTarget key that is not a manifest id", () => {
    const budget = {
      global: { maxRatio: 0.5, maxArchiveBytes: 52428800 },
      perTarget: {
        "rogue-target": { maxArchiveBytes: 100 },
      },
    };
    const budgetPath = writeBudget("rogue.json", budget);
    const result = runEnforceWithBudget(budgetPath);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("rogue-target");
    expect(result.stderr.toLowerCase()).toMatch(/not a manifest/);
  });

  it("rejects a negative maxArchiveBytes in perTarget", () => {
    const budget = {
      ...permissiveGlobalBudget(),
      perTarget: {
        "linux-x64": { maxArchiveBytes: -100 },
      },
    };
    const budgetPath = writeBudget("negative.json", budget);
    const result = runEnforceWithBudget(budgetPath);
    expect(result.status).not.toBe(0);
    expect(result.stderr.toLowerCase()).toMatch(/positive integer|negative/);
  });

  it("rejects a non-integer maxArchiveBytes in perTarget", () => {
    const budget = {
      ...permissiveGlobalBudget(),
      perTarget: {
        "linux-x64": { maxArchiveBytes: 1.5 },
      },
    };
    const budgetPath = writeBudget("float.json", budget);
    const result = runEnforceWithBudget(budgetPath);
    expect(result.status).not.toBe(0);
    expect(result.stderr.toLowerCase()).toMatch(/positive integer|integer/);
  });

  it("rejects a non-numeric maxArchiveBytes in perTarget", () => {
    const budget = {
      ...permissiveGlobalBudget(),
      perTarget: {
        "linux-x64": { maxArchiveBytes: "nope" },
      },
    };
    const budgetPath = writeBudget("string.json", budget);
    const result = runEnforceWithBudget(budgetPath);
    expect(result.status).not.toBe(0);
    expect(result.stderr.toLowerCase()).toMatch(/positive integer/);
  });

  it("rejects Infinity maxArchiveBytes in perTarget (1e400 parses to Infinity)", () => {
    // JSON does not accept literal `NaN` / `Infinity`, but `1e400`
    // parses to `Infinity` after `JSON.parse` — both are caught by
    // Number.isFinite. JSON's "Cannot parse" error masks the literal
    // cases, so the verifier only needs to defend against numbers
    // that survive JSON.parse and then fail the integer / finite
    // checks.
    const budgetPath = join(sandbox, "inf.json");
    writeFileSync(
      budgetPath,
      `{
        "global": {"maxRatio": 0.5, "maxArchiveBytes": 52428800},
        "perTarget": {"linux-x64": {"maxArchiveBytes": 1e400}}
      }`,
      "utf8",
    );
    const result = runEnforceWithBudget(budgetPath);
    expect(result.status).not.toBe(0);
    expect(result.stderr.toLowerCase()).toMatch(/positive integer/);
  });

  it("rejects global.maxRatio > 1", () => {
    const budget = {
      global: { maxRatio: 1.5, maxArchiveBytes: 52428800 },
    };
    const budgetPath = writeBudget("ratio-too-high.json", budget);
    const result = runEnforceWithBudget(budgetPath);
    expect(result.status).not.toBe(0);
    expect(result.stderr.toLowerCase()).toMatch(/maxratio/);
  });

  it("rejects global.maxRatio <= 0", () => {
    const budget = {
      global: { maxRatio: 0, maxArchiveBytes: 52428800 },
    };
    const budgetPath = writeBudget("ratio-zero.json", budget);
    const result = runEnforceWithBudget(budgetPath);
    expect(result.status).not.toBe(0);
    expect(result.stderr.toLowerCase()).toMatch(/maxratio/);
  });

  it("rejects a negative global.maxArchiveBytes", () => {
    const budget = {
      global: { maxRatio: 0.5, maxArchiveBytes: -1 },
    };
    const budgetPath = writeBudget("neg-global.json", budget);
    const result = runEnforceWithBudget(budgetPath);
    expect(result.status).not.toBe(0);
    expect(result.stderr.toLowerCase()).toMatch(/positive integer/);
  });

  it("rejects a non-object global branch", () => {
    const budgetPath = join(sandbox, "global-array.json");
    writeFileSync(
      budgetPath,
      `{"global": ["not", "an", "object"]}`,
      "utf8",
    );
    const result = runEnforceWithBudget(budgetPath);
    expect(result.status).not.toBe(0);
    expect(result.stderr.toLowerCase()).toMatch(/global/);
  });

  it("rejects a non-object perTarget branch", () => {
    const budgetPath = join(sandbox, "pertarget-array.json");
    writeFileSync(budgetPath, `{"perTarget": [1, 2, 3]}`, "utf8");
    const result = runEnforceWithBudget(budgetPath);
    expect(result.status).not.toBe(0);
    expect(result.stderr.toLowerCase()).toMatch(/pertarget/);
  });

  it("rejects a non-object perTarget.<id> entry", () => {
    const budgetPath = join(sandbox, "pertarget-entry-string.json");
    writeFileSync(
      budgetPath,
      `{"perTarget": {"linux-x64": "nope"}}`,
      "utf8",
    );
    const result = runEnforceWithBudget(budgetPath);
    expect(result.status).not.toBe(0);
    expect(result.stderr.toLowerCase()).toMatch(/object/);
  });

  it("rejects a perTarget.<id> entry missing maxArchiveBytes", () => {
    const budget = {
      ...permissiveGlobalBudget(),
      perTarget: {
        "linux-x64": {},
      },
    };
    const budgetPath = writeBudget("missing-bytes.json", budget);
    const result = runEnforceWithBudget(budgetPath);
    expect(result.status).not.toBe(0);
    expect(result.stderr.toLowerCase()).toMatch(/maxarchivebytes/);
  });
});