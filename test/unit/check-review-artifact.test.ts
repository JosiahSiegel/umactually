import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dispatch, type DispatchResult } from "../../src/cli/dispatch.js";

const GITHUB_REVIEW = {
  event: "COMMENT",
  verdict: "COMMENT",
  inlineThreadCount: 2,
  suppressedCommentCount: 0,
  blockedRawOutput: false,
  parseFailed: false,
} as const;

const AZURE_REVIEW = {
  postedThreadCount: 1,
  postedStatusState: "succeeded",
  blockedRawOutput: false,
} as const;

describe("check-review-artifact command", () => {
  let directory = "";
  let stderr = "";

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "umactually-review-artifact-"));
    stderr = "";
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      stderr += String(chunk);
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(directory, { recursive: true, force: true });
  });

  it("returns exit 0 for a valid GitHub review artifact", async () => {
    // Given
    const path = writeArtifact("github.json", GITHUB_REVIEW);

    // When
    const result = await runCheck(path);

    // Then
    expect(result.exitCode).toBe(0);
    expect(stderr).toContain(`${path}: real review (2 findings, verdict=COMMENT)`);
  });

  it("returns exit 0 for a valid Azure review artifact", async () => {
    // Given
    const path = writeArtifact("azure.json", AZURE_REVIEW);

    // When
    const result = await runCheck(path);

    // Then
    expect(result.exitCode).toBe(0);
    expect(stderr).toContain(`${path}: real review (1 findings, verdict=succeeded)`);
  });

  it("returns exit 1 when the artifact is missing", async () => {
    // Given
    const path = join(directory, "missing.json");

    // When
    const result = await runCheck(path);

    // Then
    expect(result.exitCode).toBe(1);
    expect(stderr).toContain(`${path}: file not found`);
  });

  it("returns exit 1 when the artifact is invalid JSON", async () => {
    // Given
    const path = join(directory, "invalid.json");
    writeFileSync(path, "{not-json", "utf8");

    // When
    const result = await runCheck(path);

    // Then
    expect(result.exitCode).toBe(1);
    expect(stderr).toContain(`${path}: invalid JSON`);
  });

  it("returns exit 1 for a parse-fail sentinel artifact", async () => {
    // Given
    const path = writeArtifact("parse-fail.json", {
      event: "COMMENT",
      verdict: "COMMENT",
      inlineThreadCount: 1,
      summary: "Provider response did not contain a valid JSON review payload",
    });

    // When
    const result = await runCheck(path);

    // Then
    expect(result.exitCode).toBe(1);
    expect(stderr).toContain(`${path}: contains parse-fail sentinel`);
  });

  it("returns exit 1 for a contradictory review", async () => {
    // Given
    const path = writeArtifact("contradiction.json", {
      event: "REQUEST_CHANGES",
      verdict: "NEEDS_FIX",
      inlineThreadCount: 0,
      suppressedCommentCount: 2,
      parseFailed: false,
    });

    // When
    const result = await runCheck(path);

    // Then
    expect(result.exitCode).toBe(1);
    expect(stderr).toContain("contradictory review: verdict=NEEDS_FIX with 0 findings");
  });

  it("returns exit 2 when the path argument is missing", async () => {
    // Given / When
    const result = await dispatch(["check-review-artifact"]);

    // Then
    expect(result.exitCode).toBe(2);
    expect(stderr).toContain("usage: umactually check-review-artifact <path>");
  });

  it("returns exit 2 when an extra positional argument is supplied", async () => {
    // Given
    const path = writeArtifact("review.json", GITHUB_REVIEW);

    // When
    const result = await dispatch(["check-review-artifact", path, "extra.json"]);

    // Then
    expect(result.exitCode).toBe(2);
    expect(stderr).toContain("usage: umactually check-review-artifact <path>");
  });

  it("emits a ::warning:: annotation when the review posted with zero provider round-trips", async () => {
    // Given — review is otherwise well-formed (clean verdict, posted)
    // but providerRoundTrips === 0, which is structurally impossible
    // for a real LLM review (every provider call needs at least one
    // completion-API round-trip). Flag as a possible cache hit or
    // short-circuit fallback.
    const path = writeArtifact("zero-roundtrips.json", {
      event: "COMMENT",
      verdict: "COMMENT",
      posted: true,
      inlineThreadCount: 0,
      suppressedCommentCount: 0,
      reviewDurationMs: 12_345,
      providerRoundTrips: 0,
    });

    // When
    const result = await runCheck(path);

    // Then — the artifact is still accepted (ok === true), but the
    // suspicious-signal warning is surfaced to stderr via the test
    // spy's stderr capture, and the CLI exits 0 (advisory).
    expect(result.exitCode).toBe(0);
    expect(stderr).toContain("::warning::provider-roundtrips-zero");
    expect(stderr).toContain("cache hit or short-circuit fallback suspected");
  });

  it("emits a ::warning:: annotation when the review posted in under 3 seconds", async () => {
    // Given — review posted but reviewDurationMs is well below the
    // empirical floor (3s) for any legitimate LLM round-trip, even on
    // a trivial diff. PR #140 (legit, 440-LOC refactor) took 20.6s;
    // PRs #141-#143 (suspected rubber-stamps) took 3-5s. The threshold
    // sits below the rubber-stamp band so genuine small-PR reviews
    // don't trip the warning.
    const path = writeArtifact("fast-review.json", {
      event: "COMMENT",
      verdict: "COMMENT",
      posted: true,
      inlineThreadCount: 0,
      suppressedCommentCount: 0,
      reviewDurationMs: 1_500,
      providerRoundTrips: 1,
    });

    // When
    const result = await runCheck(path);

    // Then
    expect(result.exitCode).toBe(0);
    expect(stderr).toContain("::warning::review-duration-fast");
    expect(stderr).toContain("below 3000ms floor");
  });

  it("emits both warnings when the review has both suspicious signals", async () => {
    // Given — both fast duration AND zero round-trips (the exact
    // profile we observed on PR #141-#143: 3-5s runs with 0
    // [DEBUG-RAW] lines from the provider client). The guard should
    // emit one ::warning:: per signal so the operator sees both.
    const path = writeArtifact("double-suspicious.json", {
      event: "COMMENT",
      verdict: "APPROVED",
      posted: true,
      inlineThreadCount: 0,
      suppressedCommentCount: 0,
      reviewDurationMs: 800,
      providerRoundTrips: 0,
    });

    // When
    const result = await runCheck(path);

    // Then
    expect(result.exitCode).toBe(0);
    expect(stderr).toContain("::warning::provider-roundtrips-zero");
    expect(stderr).toContain("::warning::review-duration-fast");
  });

  it("does NOT emit warnings for a real review with normal telemetry", async () => {
    // Given — review posted with healthy duration (20s+) and a
    // realistic round-trip count (≥1). This mirrors PR #140's
    // behaviour, which the operator judged to be a real review.
    const path = writeArtifact("real-review.json", {
      event: "COMMENT",
      verdict: "COMMENT",
      posted: true,
      inlineThreadCount: 2,
      suppressedCommentCount: 0,
      reviewDurationMs: 20_600,
      providerRoundTrips: 4,
    });

    // When
    const result = await runCheck(path);

    // Then — no ::warning:: annotations; the artifact is accepted
    // as a normal real review.
    expect(result.exitCode).toBe(0);
    expect(stderr).not.toContain("::warning::");
    expect(stderr).toContain("real review (2 findings, verdict=COMMENT)");
  });

  it("does NOT emit warnings when telemetry fields are absent (legacy artifacts)", async () => {
    // Given — a review artifact from before this hardening landed
    // (no reviewDurationMs, no providerRoundTrips). The guard must
    // remain backward-compatible: missing telemetry is not itself
    // suspicious.
    const path = writeArtifact("legacy.json", GITHUB_REVIEW);

    // When
    const result = await runCheck(path);

    // Then
    expect(result.exitCode).toBe(0);
    expect(stderr).not.toContain("::warning::");
  });

  function writeArtifact(name: string, value: object): string {
    const path = join(directory, name);
    writeFileSync(path, JSON.stringify(value), "utf8");
    return path;
  }
});

async function runCheck(path: string): Promise<DispatchResult> {
  const result = await dispatch(["check-review-artifact", path]);
  if (typeof result === "number") {
    return { exitCode: result };
  }
  return result;
}
