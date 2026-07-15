/**
 * Fixture: greeting-i18n-clean
 *
 * A small, well-formed i18n helper addition. The diff adds two new
 * lines: a TODO comment and a single ternary helper. No secrets, no
 * destructive operations, no security concerns.
 *
 * Calibrated for MiniMax-M3 (api.minimax.io). The fixture does NOT
 * claim the model MUST emit zero findings — MiniMax-M3 may legitimately
 * emit 0-3 minor findings on a clean diff. The thresholds are:
 *   - minComments=0: a clean review may emit zero findings
 *   - maxComments=3: even if it finds something, it's a small diff
 *   - minHighSeverity=0: no required high-severity finding
 *   - maxFabricationRate=0.5: at most half the emitted items may be
 *     parseWarnings (off-diff citations); on a clean diff this should
 *     be 0 but we allow tolerance
 *
 * Forbidden phrases guard against common hallucination patterns:
 *   - "unused variable" — would imply a variable is unused when the
 *     diff has no variable declaration
 *   - "sql injection" — irrelevant to this diff
 *   - "hardcoded secret" — irrelevant
 *
 * Forbidden path "dist/" guards against fabricated build-artifact
 * citations (the PR #56 lesson).
 */
import type { ReviewFixture } from "../../e2e/review-eval.js";

export const greetingI18nCleanFixture: ReviewFixture = {
  name: "greeting-i18n-clean",
  description: "Small i18n helper addition; clean review expected.",
  diff: [
    "diff --git a/src/example.ts b/src/example.ts",
    "index 0000000..1111111 100644",
    "--- a/src/example.ts",
    "+++ b/src/example.ts",
    "@@ -1,1 +1,3 @@",
    " export const greeting = 'hello';",
    "+// TODO: improve greeting to support i18n",
    "+export const greeting2 = (lang: string) => lang === 'en' ? 'hello' : 'hola';",
  ].join("\n"),
  expected: {
    minComments: 0,
    maxComments: 3,
    minHighSeverity: 0,
    maxFabricationRate: 0.5,
    mustNotContain: ["unused variable", "sql injection", "hardcoded secret"],
    mustNotFabricatePath: "dist/",
  },
};