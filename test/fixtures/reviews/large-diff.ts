/**
 * Fixture: large-diff
 *
 * A multi-file change spanning 4 files. The canned review emits one
 * finding per file so the runner verifies scaling behavior and the
 * aggregate token/latency report stays sane for larger diffs.
 */
import type { ReviewFixture } from "../../e2e/review-eval.js";

function fileDiff(name: string, before: string, after: string): string {
  return [
    `diff --git a/src/${name} b/src/${name}`,
    "index 0000000..1111111 100644",
    "--- a/src/" + name,
    "+++ b/src/" + name,
    "@@ -1,1 +1,3 @@",
    `-${before}`,
    `+${after}`,
    "+// appended line",
  ].join("\n");
}

export const largeDiffFixture: ReviewFixture = {
  name: "large-diff",
  description: "Multi-file change spanning 4 files; scaling behavior.",
  diff: [
    fileDiff("alpha.ts", "export const a = 1;", "export const a = 2;"),
    fileDiff("beta.ts", "export const b = 1;", "export const b = 2;"),
    fileDiff("gamma.ts", "export const c = 1;", "export const c = 2;"),
    fileDiff("delta.ts", "export const d = 1;", "export const d = 2;"),
  ].join("\n"),
  fixtureFiles: {
    "src/alpha.ts": "export const a = 2;\n// appended line\n",
    "src/beta.ts": "export const b = 2;\n// appended line\n",
    "src/gamma.ts": "export const c = 2;\n// appended line\n",
    "src/delta.ts": "export const d = 2;\n// appended line\n",
  },
  expected: {
    minComments: 1,
    maxComments: 8,
    minHighSeverity: 0,
    maxFabricationRate: 0.3,
    mustNotContain: ["sql injection"],
    mustNotFabricatePath: "dist/",
    forbiddenPathPrefixes: ["dist/", "build/", "node_modules/"],
    hardInvariants: ["identity-fields-present", "surviving-fabrication-zero"],
    mockReviewOverride: {
      review: {
        summary: "Multi-file change; one minor finding per file.",
        verdict: "comment",
        comments: [
          {
            path: "src/alpha.ts",
            line: 2,
            body: "Constant bump from 1 to 2; consider whether downstream tests rely on the literal value.",
            severity: "info",
            category: "testing",
          },
          {
            path: "src/beta.ts",
            line: 2,
            body: "Constant bump from 1 to 2; consider whether downstream tests rely on the literal value.",
            severity: "info",
            category: "testing",
          },
          {
            path: "src/gamma.ts",
            line: 2,
            body: "Constant bump from 1 to 2; consider whether downstream tests rely on the literal value.",
            severity: "info",
            category: "testing",
          },
          {
            path: "src/delta.ts",
            line: 2,
            body: "Constant bump from 1 to 2; consider whether downstream tests rely on the literal value.",
            severity: "info",
            category: "testing",
          },
        ],
      },
    },
  },
};
