/**
 * Fixture: parse-failure-not-clean
 *
 * A diff that simulates a malformed provider response. The runner
 * writes `{not-valid-json` into the per-fixture canned-review file,
 * forcing the parser to raise a parse-failure. The fixture's
 * expectation requires parseFailed=true; the `parse-fail-not-clean`
 * invariant ensures the runner does NOT misclassify the empty outcome
 * as a clean bill of health.
 */
import type { ReviewFixture } from "../../e2e/review-eval.js";

export const parseFailureNotCleanFixture: ReviewFixture = {
  name: "parse-failure-not-clean",
  description: "Malformed provider response; parseFailed=true expected.",
  diff: [
    "diff --git a/src/legacy.ts b/src/legacy.ts",
    "index 0000000..1111111 100644",
    "--- a/src/legacy.ts",
    "+++ b/src/legacy.ts",
    "@@ -1,1 +1,3 @@",
    " export function legacy() { return 1; }",
    "+// refactored below",
    "+export function legacy2() { return legacy() + 1; }",
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
      simulateParseFailure: true,
      review: {
        summary: "fallback",
        verdict: "COMMENT",
        comments: [],
      },
    },
  },
};
