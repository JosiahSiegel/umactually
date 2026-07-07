// Regression tests for scripts/check-self-review-output.mjs.
//
// PR #18 self-review: the action posted a review with verdict
// `NEEDS_FIX` and `0 inline findings` (the contradiction class —
// every finding was severity-filtered out, but the model's raw
// verdict wasn't reconciled). The CI workflow still passed because
// the script treated zero-finding reviews as `[OK]` warnings. After
// this fix, that class must be `[FAIL]` with exit code 4 so a future
// regression cannot pass CI silently.
//
// These tests invoke the script as a child process (the same way the
// GitHub Actions workflow does) and assert on exit code + stdout.
// They cover all four observable cases:
//   - clean COMMENT review, 0 findings       → exit 0
//   - NEEDS_FIX review with N findings        → exit 0 (legit blocking)
//   - parseFailed=true                        → exit 2
//   - NEEDS_FIX review with 0 findings        → exit 4 (the bug)
//
// Spawning the script — instead of importing its internals — keeps
// the test aligned with the real CI surface. If the script file
// moves or renames, these tests fail loudly with a clear message
// instead of silently testing stale internals.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const HERE = resolve(__dirname, "..", "..");
const SCRIPT = resolve(HERE, "scripts", "check-self-review-output.mjs");
const ARTIFACTS_DIR = resolve(HERE, "artifacts", "manual");
const S1_PATH = join(ARTIFACTS_DIR, "s1-github-self-review.md");
const S4_PATH = join(ARTIFACTS_DIR, "s4-azure-mocked-run.json");

// Snapshot pre-existing artifacts so the test does not clobber
// developer state. The script reads artifacts at fixed paths
// relative to the package root, so the test writes synthetic
// artifacts to those paths and restores the originals afterwards.
let snapshotS1: string | null = null;
let snapshotS4: string | null = null;

function snapshotAndReplaceArtifacts(input: { readonly s1?: string; readonly s4?: string }): void {
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  snapshotS1 = existsSync(S1_PATH) ? readFileSync(S1_PATH, "utf8") : null;
  snapshotS4 = existsSync(S4_PATH) ? readFileSync(S4_PATH, "utf8") : null;
  if (input.s1 === undefined) {
    if (existsSync(S1_PATH)) rmSync(S1_PATH);
  } else {
    writeFileSync(S1_PATH, input.s1, "utf8");
  }
  if (input.s4 === undefined) {
    if (existsSync(S4_PATH)) rmSync(S4_PATH);
  } else {
    writeFileSync(S4_PATH, input.s4, "utf8");
  }
}

function restoreArtifacts(): void {
  // Defensive: if no snapshot is pending (e.g. afterAll runs after a
  // test already restored), do nothing instead of deleting the
  // pre-existing files. The variables are nulled after a restore so
  // a second call from afterAll would otherwise wipe the developer's
  // artifacts directory.
  const hasPendingSnapshot = snapshotS1 !== null || snapshotS4 !== null;
  if (!hasPendingSnapshot) {
    return;
  }
  if (snapshotS1 === null) {
    if (existsSync(S1_PATH)) rmSync(S1_PATH);
  } else {
    writeFileSync(S1_PATH, snapshotS1, "utf8");
  }
  if (snapshotS4 === null) {
    if (existsSync(S4_PATH)) rmSync(S4_PATH);
  } else {
    writeFileSync(S4_PATH, snapshotS4, "utf8");
  }
  snapshotS1 = null;
  snapshotS4 = null;
}

function runGuard(input: { readonly s1?: string; readonly s4?: string }): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  snapshotAndReplaceArtifacts(input);
  try {
    const result = spawnSync(process.execPath, [SCRIPT], {
      cwd: HERE,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return {
      status: result.status,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  } finally {
    restoreArtifacts();
  }
}

// The script writes [OK]/[skip] lines to stdout and [FAIL] lines to
// stderr. Combine them so assertions can match against either stream.
function outputOf(result: { stdout: string; stderr: string }): string {
  return `${result.stdout}\n${result.stderr}`;
}

describe("check-self-review-output.mjs (subprocess)", () => {
  beforeAll(() => {
    // Sanity check: ensure the script exists at the expected path.
    const fs = require("node:fs") as typeof import("node:fs");
    if (!fs.existsSync(SCRIPT)) {
      throw new Error(`check-self-review-output.mjs not found at ${SCRIPT}`);
    }
  });

  afterAll(() => {
    // Defensive: if a test throws before restoring, restore on exit.
    restoreArtifacts();
  });

  it("returns exit 0 for a clean COMMENT review with zero findings (legitimate empty review)", () => {
    // Given: a real review posted by the action with verdict
    // COMMENT and 0 inline findings — e.g. the action posted a
    // parent card but the model emitted no postable findings.
    const result = runGuard({
      s1: JSON.stringify({
        event: "COMMENT",
        verdict: "COMMENT",
        inlineThreadCount: 0,
        suppressedCommentCount: 0,
        marker: "<!-- umactually-pr-review -->",
        blockedRawOutput: false,
        parseFailed: false,
      }),
      s4: JSON.stringify({
        postedThreadCount: 0,
        postedStatusState: "succeeded",
        marker: "<!-- umactually-pr-review -->",
        blockedRawOutput: false,
      }),
    });

    expect(result.status).toBe(0);
    expect(outputOf(result)).toContain("[OK]");
    expect(outputOf(result)).not.toContain("[FAIL]");
  });

  it("returns exit 0 for a NEEDS_FIX review WITH findings (legit blocking verdict)", () => {
    // Given: the model emitted NEEDS_FIX and the action posted 3
    // findings. The PR is blocked legitimately.
    const result = runGuard({
      s1: JSON.stringify({
        event: "REQUEST_CHANGES",
        verdict: "NEEDS_FIX",
        inlineThreadCount: 3,
        suppressedCommentCount: 1,
        marker: "<!-- umactually-pr-review -->",
        blockedRawOutput: false,
        parseFailed: false,
      }),
    });

    expect(result.status).toBe(0);
    expect(outputOf(result)).toContain("[OK]");
  });

  it("returns exit 2 for a parseFailed=true artifact (parse-fail surface)", () => {
    // Given: the action posted a parse-fail card (the canonical
    // regression class from PR #17). The artifact writer stamps
    // `parseFailed: true` so this guard can catch it.
    const result = runGuard({
      s1: JSON.stringify({
        event: "",
        verdict: "",
        inlineThreadCount: 0,
        suppressedCommentCount: 0,
        marker: "",
        blockedRawOutput: false,
        parseFailed: true,
      }),
    });

    expect(result.status).toBe(2);
    expect(outputOf(result)).toContain("[FAIL]");
    expect(outputOf(result)).toMatch(/parse-fail/u);
  });

  it("returns exit 4 for NEEDS_FIX review with zero findings AND zero suppressed (the contradiction — PR #18 regression)", () => {
    // Given: the PR #18 regression — model emitted NEEDS_FIX, every
    // finding was severity-filtered out. Without this fix, the
    // guard treats this as a low-signal `[OK]` warning; with the
    // fix, it's a hard `[FAIL]` because NEEDS_FIX + zero findings
    // is contradictory.
    const result = runGuard({
      s1: JSON.stringify({
        event: "REQUEST_CHANGES",
        verdict: "NEEDS_FIX",
        inlineThreadCount: 0,
        suppressedCommentCount: 0,
        marker: "<!-- umactually-pr-review -->",
        blockedRawOutput: false,
        parseFailed: false,
      }),
    });

    expect(result.status).toBe(4);
    expect(outputOf(result)).toContain("[FAIL]");
    expect(outputOf(result)).toMatch(/contradictory-review/u);
    expect(outputOf(result)).toMatch(/NEEDS_FIX/u);
    expect(outputOf(result)).toMatch(/reconcileVerdictForEmptySeverityCounts/u);
  });

  it("returns exit 0 for NEEDS_FIX review when suppressed comments exist (off-diff findings can back the verdict)", () => {
    // Given: the model emitted NEEDS_FIX and 2 comments were
    // suppressed as off-diff. The verdict has backing — the runner
    // is not blocking the PR on a phantom review.
    const result = runGuard({
      s1: JSON.stringify({
        event: "REQUEST_CHANGES",
        verdict: "NEEDS_FIX",
        inlineThreadCount: 0,
        suppressedCommentCount: 2,
        marker: "<!-- umactually-pr-review -->",
        blockedRawOutput: false,
        parseFailed: false,
      }),
    });

    expect(result.status).toBe(0);
    expect(outputOf(result)).toContain("[OK]");
  });

  it("returns exit 1 when no artifacts are present (catch-all)", () => {
    // Given: no artifact files at all. The runner produced nothing.
    const result = runGuard({});
    expect(result.status).toBe(1);
    expect(outputOf(result)).toMatch(/no output artifacts found/u);
  });
});