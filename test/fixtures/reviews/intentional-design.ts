/**
 * Fixture: intentional-design
 *
 * A diff that adds a seemingly-suspicious pattern with an explicit
 * inline documentation comment marking it as intentional. The confidence
 * filter (`src/review/filter-confidence.ts:243-251`) is supposed to
 * downgrade findings that criticize this pattern by matching
 * "intentional" or "by design" tokens in the diff hunk AND negative
 * assessment phrases in the body.
 *
 * The test verifies that:
 *   - A reviewer may emit 0-N findings (often 0 on a clean docstring)
 *   - If findings ARE emitted about the "fallback" or "compatibility",
 *     the confidence filter must downgrade them to `info` severity
 *     with reason `intentional-design`
 *   - No fabrication of `dist/` paths
 *
 * Thresholds are PERMISSIVE because the model may emit zero findings:
 *   - minComments=0: no required count
 *   - maxComments=3: tolerance for split findings
 *   - minHighSeverity=0: no required severity
 */
import type { ReviewFixture } from "../../e2e/review-eval.js";

export const intentionalDesignFixture: ReviewFixture = {
  name: "intentional-design",
  description: "Suspicious pattern with intentional marker; confidence filter must downgrade criticism.",
  diff: [
    "diff --git a/src/compat.ts b/src/compat.ts",
    "index 0000000..1111111 100644",
    "--- a/src/compat.ts",
    "+++ b/src/compat.ts",
    "@@ -1,1 +1,3 @@",
    " export function legacyBridge() {",
    "+  // intentional: this fallback preserves compatibility with legacy payloads",
    "+  return handleLegacy(req);",
  ].join("\n"),
  expected: {
    minComments: 0,
    maxComments: 3,
    minHighSeverity: 0,
    maxFabricationRate: 0.5,
    mustNotContain: ["remove this intentional fallback", "legacy compatibility is unnecessary"],
    mustNotFabricatePath: "dist/",
    forbiddenPathPrefixes: ["dist/", "build/", "node_modules/"],
    hardInvariants: ["identity-fields-present", "surviving-fabrication-zero"],
    mockReviewOverride: {
      review: {
        summary: "Diff is annotated as intentional. Confidence filter must downgrade criticism if the model emits any.",
        verdict: "comment",
        comments: [],
      },
    },
  },
};