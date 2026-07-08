import { describe, expect, it } from "vitest";

import {
  verifyFindingsAgainstDiff,
  verifyFindingsWithModel,
} from "../../src/cli/verify-findings.js";
import type { LiveReviewComment, LiveReview } from "../../src/cli/live-shared.js";

const SAMPLE_DIFF = [
  "diff --git a/src/cli/help.ts b/src/cli/help.ts",
  "--- a/src/cli/help.ts",
  "+++ b/src/cli/help.ts",
  "@@ -1,3 +1,4 @@",
  " export const x = 1;",
  "+export const added = true;",
  " export const y = 2;",
  "",
].join("\n");

describe("verifyFindingsAgainstDiff (deterministic Layer 4 path)", () => {
  it("keeps comments whose (path, line) anchors to the diff", () => {
    const review: LiveReview = {
      summary: "test",
      verdict: "COMMENT",
      comments: [
        { path: "src/cli/help.ts", line: 2, body: "The added line is at position 2.", severity: "medium", category: "test" },
        { path: "src/cli/help.ts", line: 1, body: "Context line 1.", severity: "low", category: "test" },
      ],
      suppressedComments: [],
    };
    const result = verifyFindingsAgainstDiff({ review, diffText: SAMPLE_DIFF });
    expect(result.verified).toHaveLength(2);
    expect(result.dropped).toHaveLength(0);
  });

  it("drops comments whose path is not in the diff (Layer 4 + Layer 3 contract)", () => {
    const review: LiveReview = {
      summary: "test",
      verdict: "COMMENT",
      comments: [
        { path: "src/cli/help.ts", line: 2, body: "Real finding.", severity: "medium", category: "test" },
        { path: "dist/cli.js", line: 1, body: "Hallucinated dist/ finding.", severity: "high", category: "test" },
      ],
      suppressedComments: [],
    };
    const result = verifyFindingsAgainstDiff({ review, diffText: SAMPLE_DIFF });
    expect(result.verified).toHaveLength(1);
    expect(result.verified[0]?.path).toBe("src/cli/help.ts");
    expect(result.dropped).toHaveLength(1);
    expect(result.dropped[0]?.path).toBe("dist/cli.js");
  });

  it("locks the PR #56 regression at the verification layer too: 7 dist/ + 1 off-line findings get dropped", () => {
    // The same regression that the parse-warnings test pins, this time
    // pinned at the Layer 4 verification surface. Both layers catch
    // the same fabrication, so a future regression that breaks one
    // (e.g. someone disables parse-warnings) is still caught here.
    const pr56Fabricated: LiveReviewComment[] = [
      { path: "dist/cli.js", line: 1, body: "x", severity: "critical", category: "b" },
      { path: "dist/cli.js", line: 2, body: "x", severity: "high", category: "b" },
      { path: "dist/cli.js", line: 5, body: "x", severity: "medium", category: "b" },
      { path: "dist/cli.js", line: 4, body: "x", severity: "high", category: "b" },
      { path: "dist/cli.js", line: 1047, body: "x", severity: "medium", category: "b" },
      { path: "dist/index.js", line: 1, body: "x", severity: "medium", category: "b" },
      { path: "dist/index.js", line: 2470, body: "x", severity: "medium", category: "b" },
      { path: "src/cli/help.ts", line: 7, body: "x", severity: "medium", category: "b" },
    ];
    const review: LiveReview = { summary: "t", verdict: "COMMENT", comments: pr56Fabricated, suppressedComments: [] };
    const result = verifyFindingsAgainstDiff({ review, diffText: SAMPLE_DIFF });
    expect(result.dropped).toHaveLength(8);
    expect(result.verified).toHaveLength(0);
  });
});

describe("verifyFindingsWithModel (Layer 4 model-based path)", () => {
  it("drops findings the verifier rejects", async () => {
    const review: LiveReview = {
      summary: "t",
      verdict: "COMMENT",
      comments: [
        { path: "src/cli/help.ts", line: 2, body: "real", severity: "medium", category: "t" },
        { path: "src/cli/help.ts", line: 99, body: "fake line", severity: "medium", category: "t" },
      ],
      suppressedComments: [],
    };
    const verifier = async (input: {
      readonly systemPrompt: string;
      readonly userPrompt: string;
      readonly findings: readonly LiveReviewComment[];
    }): Promise<readonly { readonly original: LiveReviewComment; readonly verified: boolean; readonly supportingQuote: string }[]> => {
      // Reject the second finding (line 99 is not in the diff).
      const result = [];
      for (const c of input.findings) {
        if (c.line === 99) {
          result.push({ original: c, verified: false, supportingQuote: "" });
        } else {
          result.push({ original: c, verified: true, supportingQuote: "export const x = 1;" });
        }
      }
      return result;
    };
    const result = await verifyFindingsWithModel({ review, diffText: SAMPLE_DIFF, verifier });
    expect(result.verified).toHaveLength(1);
    expect(result.verified[0]?.line).toBe(2);
    expect(result.dropped).toHaveLength(1);
    expect(result.dropped[0]?.line).toBe(99);
  });
});