/**
 * Fixture: false-positive-trap
 *
 * A diff that adds a defensive null check — a code pattern some
 * reviewers flag as "unnecessary" while others treat it as
 * belt-and-suspenders. The fixture pins that the model MAY emit a
 * finding (allowedFindings) but MUST NOT regress to a 0-finding
 * high-precision review.
 *
 * IdentityDigest ground truth: NO required TP; one allowed
 * identityDigest covers the optional defensive finding.
 */
import type { ReviewFixture } from "../../e2e/review-eval.js";

export const falsePositiveTrapFixture: ReviewFixture = {
  name: "false-positive-trap",
  description: "Defensive null-check; allowed but not required.",
  diff: [
    "diff --git a/src/util.ts b/src/util.ts",
    "index 0000000..1111111 100644",
    "--- a/src/util.ts",
    "+++ b/src/util.ts",
    "@@ -1,1 +1,4 @@",
    " export function safeLen(s: string | null) {",
    "+  if (s === null) return 0;",
    "+  return s.length;",
    "+}",
  ].join("\n"),
  expected: {
    minComments: 0,
    maxComments: 2,
    minHighSeverity: 0,
    maxFabricationRate: 0.5,
    mustNotContain: ["sql injection", "hardcoded secret"],
    mustNotFabricatePath: "dist/",
    forbiddenPathPrefixes: ["dist/", "build/", "node_modules/"],
    hardInvariants: ["identity-fields-present", "surviving-fabrication-zero"],
    mockReviewOverride: {
      review: {
        summary: "Defensive null-check. No required findings; any critique is acceptable but optional.",
        verdict: "comment",
        comments: [],
      },
    },
  },
};
