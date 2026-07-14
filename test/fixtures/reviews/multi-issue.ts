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
 * The diff adds 4 problematic lines so MiniMax-M3 has unambiguous
 * signals to grade. Calibrated thresholds:
 *   - minComments=1: at least one finding expected
 *   - maxComments=8: MiniMax-M3 sometimes splits findings; tolerate up to 8
 *   - minHighSeverity=1: at least one high/critical finding expected
 *   - maxFabricationRate=0.5: fabrication tolerance
 *
 * Note: this fixture does NOT assert exact category. The model's
 * category label is free-form; only severity is graded.
 *
 * Calibrated for MiniMax-M3 (api.minimax.io).
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
  },
};