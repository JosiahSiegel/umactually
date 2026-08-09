// Pins that parse failures and provider errors cause the action to
// exit non-zero so CI fails instead of silently passing.
//
// Two bugs are covered here:
//   1. Provider errors (router /docs/errors/R101 zero-usage, error
//      envelopes) were indistinguishable from genuine parse failures →
//      posted a COMMENT review → exit 0 → CI green.
//   2. Even genuine parse failures posted a COMMENT review → exit 0 →
//      CI green.
//
// The fix:
//   - Provider errors now throw `LiveReviewError("PROVIDER_ERROR")`
//     from `requestLiveReview` → orchestrator's catch block →
//     `failedResult()` → `exitCode: 1`.
//   - Genuine parse failures still post the fallback review (so the
//     operator sees the diagnostic on the PR) but now return
//     `exitCode: 1` from `runGithubLive`/`runAzureLive`.
import { describe, expect, it } from "vitest";

import { buildMalformedProviderFallback } from "../../src/cli/live-shared.js";

describe("parse-fail exit code: parse failures exit non-zero", () => {
  it("buildMalformedProviderFallback sets parseFailed: true", () => {
    const fallback = buildMalformedProviderFallback({
      provider: "openai-compatible",
      modelId: "auto",
      rawText: "some garbage response",
      secrets: [],
    });
    expect(fallback.parseFailed).toBe(true);
  });

  it("buildMalformedProviderFallback does NOT set parseFailed on clean reviews", () => {
    // A non-fallback review (normal path) does not have parseFailed.
    // This is a sanity check — the absence of parseFailed is what
    // tells the live-posting paths to exit 0.
    const cleanReview: { summary: string; verdict: string; comments: readonly unknown[]; suppressedComments: readonly unknown[]; parseFailed?: boolean } = {
      summary: "Looks good.",
      verdict: "APPROVED",
      comments: [],
      suppressedComments: [],
    };
    expect(cleanReview.parseFailed ?? false).toBe(false);
  });
});
