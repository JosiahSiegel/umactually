/**
 * Fixture: missing-tests
 *
 * A behavior change with no accompanying test. The canned review
 * surfaces a high-severity missing-tests finding so the gate exercises
 * the missing-tests hard invariant.
 */
import type { ReviewFixture } from "../../e2e/review-eval.js";

export const missingTestsFixture: ReviewFixture = {
  name: "missing-tests",
  description: "Behavior change with no accompanying test; missing-tests finding expected.",
  diff: [
    "diff --git a/src/pricer.ts b/src/pricer.ts",
    "index 0000000..1111111 100644",
    "--- a/src/pricer.ts",
    "+++ b/src/pricer.ts",
    "@@ -1,1 +1,5 @@",
    "-export function price(qty: number, unit: number) { return qty * unit; }",
    "+export function price(qty: number, unit: number) {",
    "+  if (qty < 0) throw new Error('negative qty');",
    "+  return qty * unit;",
    "+}",
  ].join("\n"),
  expected: {
    minComments: 1,
    maxComments: 4,
    minHighSeverity: 0,
    maxFabricationRate: 0.3,
    mustNotContain: ["sql injection"],
    mustNotFabricatePath: "dist/",
    forbiddenPathPrefixes: ["dist/", "build/", "node_modules/"],
    hardInvariants: ["identity-fields-present", "surviving-fabrication-zero"],
    mockReviewOverride: {
      review: {
        summary: "Behavior change adds a negative-qty guard but no test covers the new branch.",
        verdict: "request_changes",
        comments: [
          {
            path: "src/pricer.ts",
            line: 3,
            body: "New negative-qty branch lacks test coverage. Add a unit test that exercises the throw path so the contract is locked in.",
            severity: "medium",
            category: "testing",
          },
        ],
      },
    },
  },
};
