// SPDX-License-Identifier: MIT
//
// M3 — `umactually verify` is an alias for `umactually check-review-artifact`.
// Both names invoke the same handler (`runCheckReviewArtifactBranch`) and
// must produce identical exit codes, stderr/stdout, and (with --json) the
// same EnvelopeV1 shape with `command: "verify"`.
//
// See .omo/plans/cli-simplification-hyperplan-bundle.md §1.M3 for the
// contract spec.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dispatch, type DispatchResult } from "../../src/cli/dispatch.js";

const VALID_GITHUB_REVIEW = {
  event: "COMMENT",
  verdict: "COMMENT",
  inlineThreadCount: 1,
  suppressedCommentCount: 0,
  blockedRawOutput: false,
  parseFailed: false,
} as const;

interface StdoutStderrCapture {
  readonly restore: () => void;
  readonly stdout: { readonly text: string };
  readonly stderr: { readonly text: string };
}

function captureStdoutStderr(): StdoutStderrCapture {
  const originalStdout = process.stdout.write.bind(process.stdout);
  const originalStderr = process.stderr.write.bind(process.stderr);
  const stdoutState = { text: "" };
  const stderrState = { text: "" };
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    stdoutState.text += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    stderrState.text += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }) as typeof process.stderr.write;
  return {
    stdout: stdoutState,
    stderr: stderrState,
    restore: () => {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
    },
  };
}

async function runDispatch(argv: readonly string[]): Promise<{
  readonly result: DispatchResult;
  readonly stdout: string;
  readonly stderr: string;
}> {
  const capture = captureStdoutStderr();
  try {
    const result = await dispatch([...argv]);
    const dispatchResult: DispatchResult =
      typeof result === "number" ? { exitCode: result } : result;
    return {
      result: dispatchResult,
      stdout: capture.stdout.text,
      stderr: capture.stderr.text,
    };
  } finally {
    capture.restore();
  }
}

describe("M3 — `verify` is an alias for `check-review-artifact`", () => {
  let directory = "";
  let validPath = "";

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "umactually-verify-alias-"));
    validPath = join(directory, "review.json");
    writeFileSync(validPath, JSON.stringify(VALID_GITHUB_REVIEW), "utf8");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(directory, { recursive: true, force: true });
  });

  it("M3-001: `verify <path>` exits 0 and emits the same human-readable stderr as `check-review-artifact <path>`", async () => {
    // Given — a valid review artifact and two equivalent invocations of
    // the future dispatch layer.
    //   1. `verify <path>` — the new top-level alias.
    //   2. `check-review-artifact <path>` — the existing canonical name.
    // Both must reach the same handler and produce the same exit code
    // and stderr message (the human-readable form goes to stderr in
    // `runCheckReviewArtifactBranch`).
    const verifyRun = await runDispatch(["verify", validPath]);
    const canonicalRun = await runDispatch(["check-review-artifact", validPath]);

    // Then — both exit 0 with identical stderr.
    expect(verifyRun.result.exitCode).toBe(0);
    expect(canonicalRun.result.exitCode).toBe(0);
    // The human-readable message is the same module-level summary line.
    expect(verifyRun.stderr).toContain(`${validPath}: real review (1 findings, verdict=COMMENT)`);
    expect(canonicalRun.stderr).toContain(`${validPath}: real review (1 findings, verdict=COMMENT)`);
    // The two invocations must produce byte-for-byte identical stderr so
    // CI logs and downstream tooling cannot tell them apart.
    expect(verifyRun.stderr).toBe(canonicalRun.stderr);
  });

  it("M3-002: `verify --json` and `check-review-artifact --json` produce EnvelopeV1 with `command: 'verify'`", async () => {
    // Given — both names with --json must emit the same EnvelopeV1
    // record. The existing M1 wiring already stamps `command: "verify"`
    // inside the dispatch handler (see runCheckReviewArtifactBranch in
    // src/cli/dispatch.ts:159-197), so both names inherit that.
    const verifyRun = await runDispatch(["verify", "--json", validPath]);
    const canonicalRun = await runDispatch(["check-review-artifact", "--json", validPath]);

    // Then — both exit 0.
    expect(verifyRun.result.exitCode).toBe(0);
    expect(canonicalRun.result.exitCode).toBe(0);
    // Both produce non-empty JSON stdout.
    expect(verifyRun.stdout.trim()).not.toBe("");
    expect(canonicalRun.stdout.trim()).not.toBe("");
    // Both envelopes have command: "verify" (per the M1 wiring).
    const verifyEnvelope = JSON.parse(verifyRun.stdout.trim()) as {
      readonly command: string;
      readonly schemaVersion: number;
      readonly exitCode: number;
      readonly ok: boolean;
      readonly data: Record<string, unknown>;
    };
    const canonicalEnvelope = JSON.parse(canonicalRun.stdout.trim()) as {
      readonly command: string;
      readonly schemaVersion: number;
      readonly exitCode: number;
      readonly ok: boolean;
      readonly data: Record<string, unknown>;
    };
    expect(verifyEnvelope.command).toBe("verify");
    expect(canonicalEnvelope.command).toBe("verify");
    // Both are valid EnvelopeV1 records (schemaVersion 1).
    expect(verifyEnvelope.schemaVersion).toBe(1);
    expect(canonicalEnvelope.schemaVersion).toBe(1);
    // Both are byte-for-byte identical because the handler is the same.
    expect(verifyRun.stdout).toBe(canonicalRun.stdout);
  });

  it("M3-003: `verify` without a path argument exits 2 with the same usage error as `check-review-artifact`", async () => {
    // Given — no path supplied. The existing handler returns
    // exit 2 with `usage: umactually check-review-artifact <path>`.
    // The alias must produce an equivalent error.
    const verifyRun = await runDispatch(["verify"]);
    const canonicalRun = await runDispatch(["check-review-artifact"]);

    // Then — both exit 2 and emit the same usage error.
    expect(verifyRun.result.exitCode).toBe(2);
    expect(canonicalRun.result.exitCode).toBe(2);
    expect(verifyRun.stderr).toContain("usage: umactually check-review-artifact <path>");
    expect(canonicalRun.stderr).toContain("usage: umactually check-review-artifact <path>");
  });

  it("M3-004: `verify` with an extra positional argument exits 2 with the same usage error", async () => {
    // Given — two positional arguments. The handler enforces exactly
    // one positional; the alias must preserve that contract.
    const verifyRun = await runDispatch(["verify", validPath, "extra.json"]);
    const canonicalRun = await runDispatch(["check-review-artifact", validPath, "extra.json"]);

    // Then — both exit 2.
    expect(verifyRun.result.exitCode).toBe(2);
    expect(canonicalRun.result.exitCode).toBe(2);
    expect(verifyRun.stderr).toContain("usage: umactually check-review-artifact <path>");
  });

  it("M3-005: `verify` with a missing file exits 1 with the same error as `check-review-artifact`", async () => {
    // Given — path that does not exist.
    const missingPath = join(directory, "does-not-exist.json");
    const verifyRun = await runDispatch(["verify", missingPath]);
    const canonicalRun = await runDispatch(["check-review-artifact", missingPath]);

    // Then — both exit 1.
    expect(verifyRun.result.exitCode).toBe(1);
    expect(canonicalRun.result.exitCode).toBe(1);
    expect(verifyRun.stderr).toContain(`${missingPath}: file not found`);
    expect(canonicalRun.stderr).toContain(`${missingPath}: file not found`);
  });

  it("M3-006: `verify` accepts --json before the path argument (flag ordering parity)", async () => {
    // Given — flag ordering should not change the result.
    const verifyRun = await runDispatch(["verify", "--json", validPath]);
    const verifyRunReordered = await runDispatch(["verify", validPath, "--json"]);

    // Then — both produce the same exit code and JSON output.
    expect(verifyRun.result.exitCode).toBe(0);
    expect(verifyRunReordered.result.exitCode).toBe(0);
    expect(verifyRun.stdout).toBe(verifyRunReordered.stdout);
  });
});
