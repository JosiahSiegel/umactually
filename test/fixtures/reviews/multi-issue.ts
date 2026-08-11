/**
 * Fixture: multi-issue
 *
 * A diff with multiple independent defects that should produce findings
 * of varying severity:
 *   - Swallowed error (high severity — operation continues on failure)
 *   - Sensitive data logged in plaintext (critical — leaks credentials)
 *   - Unconditional infinite loop (critical — DoS risk)
 *   - console.log left in production code (low — style/hygiene)
 *
 * The diff adds 4 problematic lines with unambiguous signals to grade.
 * Thresholds:
 *   - minComments=1: at least one finding expected
 *   - maxComments=8: reviewers may split findings; tolerate up to 8
 *   - minHighSeverity=1: at least one high/critical finding expected
 *   - maxFabricationRate=0.5: fabrication tolerance
 *
 * Note: this fixture does NOT assert exact category. The model's
 * category label is free-form; only severity is graded.
 */
import type { ReviewFixture } from "../../e2e/review-eval.js";

export const multiIssueFixture: ReviewFixture = {
  name: "multi-issue",
  description: "Multiple independent defects; ≥1 high-severity finding expected.",
  diff: [
    "diff --git a/src/handler.ts b/src/handler.ts",
    "index 0000000..1111111 100644",
    "--- a/src/handler.ts",
    "+++ b/src/handler.ts",
    "@@ -1,1 +1,7 @@",
    " export function handle(req: any, res: any) {",
    "+  try { doWork(req); } catch (err) { /* swallow */ }",
    "+  console.log('user password:', req.body.password);",
    "+  while (true) { doWork(req); }",
    "+  console.log('debug:', req);",
    "+  res.send('ok');",
    "+}",
  ].join("\n"),
  expected: {
    minComments: 1,
    maxComments: 8,
    minHighSeverity: 1,
    maxFabricationRate: 0.5,
    mustNotContain: ["issue in an unchanged file"],
    mustNotFabricatePath: "dist/",
    forbiddenPathPrefixes: ["dist/", "build/", "node_modules/"],
    hardInvariants: ["identity-fields-present", "surviving-fabrication-zero"],
    mockReviewOverride: {
      review: {
        summary:
          "Multi-issue diff: swallowed error, plaintext credential logging, and an infinite loop. Three findings expected.",
        verdict: "request_changes",
        comments: [
          {
            path: "src/handler.ts",
            line: 2,
            body: "Swallowed error in the try/catch silently continues operation. Surface the failure so the caller can react.",
            severity: "high",
            category: "correctness",
          },
          {
            path: "src/handler.ts",
            line: 3,
            body: "Sensitive data logged in plaintext via console.log with the user password. This is a credential leak; redact or remove.",
            severity: "critical",
            category: "security",
          },
          {
            path: "src/handler.ts",
            line: 4,
            body: "Unconditional infinite loop wraps doWork with no exit condition. DoS risk; introduce a max-iterations guard.",
            severity: "critical",
            category: "correctness",
          },
        ],
      },
    },
  },
};