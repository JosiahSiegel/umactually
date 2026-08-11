/**
 * Fixture: truncation
 *
 * A diff where the canned provider response is truncated mid-JSON.
 * The runner writes a half-serialized JSON body so the parser raises
 * a truncation-style parse-failure.
 */
import type { ReviewFixture } from "../../e2e/review-eval.js";

export const truncationFixture: ReviewFixture = {
  name: "truncation",
  description: "Truncated provider response; parseFailed=true with truncation reason.",
  diff: [
    "diff --git a/src/streamer.ts b/src/streamer.ts",
    "index 0000000..1111111 100644",
    "--- a/src/streamer.ts",
    "+++ b/src/streamer.ts",
    "@@ -1,1 +1,3 @@",
    " export function stream() { return []; }",
    "+export function stream2() { return stream(); }",
  ].join("\n"),
  expected: {
    minComments: 0,
    maxComments: 0,
    minHighSeverity: 0,
    maxFabricationRate: 1.0,
    mustNotContain: [],
    mustNotFabricatePath: "",
    forbiddenPathPrefixes: [],
    hardInvariants: ["parse-fail-not-clean"],
    mockReviewOverride: {
      simulateTruncation: true,
      review: {
        summary: "fallback",
        verdict: "COMMENT",
        comments: [],
      },
    },
  },
};
