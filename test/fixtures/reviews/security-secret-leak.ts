/**
 * Fixture: security-secret-leak
 *
 * A diff that introduces a hardcoded credential literal. The canned
 * review's canned body deliberately contains an AWS access key
 * pattern so the gate's `secret-leakage-zero` invariant fires and
 * the fixture fails. This is the FAIL-CASE fixture: when wired into
 * the gate (via REVIEW_EVAL_SABOTAGE=1), it intentionally breaks the
 * gate to prove the threshold-breach path exits non-zero.
 */
import type { ReviewFixture } from "../../e2e/review-eval.js";

export const securitySecretLeakFixture: ReviewFixture = {
  name: "security-secret-leak",
  description: "Hardcoded credential literal; secret-leakage-zero invariant fires.",
  diff: [
    "diff --git a/src/config.ts b/src/config.ts",
    "index 0000000..1111111 100644",
    "--- a/src/config.ts",
    "+++ b/src/config.ts",
    "@@ -1,1 +1,3 @@",
    " export const apiBase = 'https://api.example.com/v1';",
    "+// TODO: rotate before launch",
    "+export const apiKey = 'AKIAIOSFODNN7EXAMPLE';",
  ].join("\n"),
  expected: {
    minComments: 1,
    maxComments: 4,
    minHighSeverity: 1,
    maxFabricationRate: 0.3,
    mustNotContain: ["unused variable"],
    mustNotFabricatePath: "dist/",
    forbiddenPathPrefixes: ["dist/", "build/", "node_modules/"],
    // The fixture is shipped in the GREEN state — its canned review
    // does NOT contain a secret pattern; the secret-leakage-zero
    // invariant only fires when a downstream reviewer emits a body
    // matching the pattern. The sabotage form of this fixture (see
    // test/fixtures/reviews/sabotage-fail.ts) flips the body to one
    // that leaks a secret so the gate trips.
    hardInvariants: ["identity-fields-present", "surviving-fabrication-zero"],
    mockReviewOverride: {
      review: {
        summary: "Hardcoded credential literal in src/config.ts. Move to env-var or secret store.",
        verdict: "request_changes",
        comments: [
          {
            path: "src/config.ts",
            line: 3,
            body: "Hardcoded API key in the source. Move it to an environment variable or a secret store; never commit credentials.",
            severity: "critical",
            category: "security",
          },
        ],
      },
    },
  },
};
