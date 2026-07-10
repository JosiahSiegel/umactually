import { describe, expect, it } from "vitest";

import {
  applyVerifiedFactsFilter,
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
/**
 * Verified-facts contradiction filter — the Layer 4.5 defensive post-filter
 * that downgrades findings whose body asserts something is missing from a
 * verified list (e.g. "dist/ is missing from package.json#files") when the
 * verified list actually contains it. Pins the PR-#41 false-positive
 * pattern that the self-review bot flagged as Critical.
 */
describe("applyVerifiedFactsFilter (Layer 4.5 verified-facts contradiction post-filter)", () => {
  const PR_41_DIFF = [
    "diff --git a/package.json b/package.json",
    "--- a/package.json",
    "+++ b/package.json",
    "@@ -10,8 +35,14 @@",
    '   "bin": {',
    '     "umactually-pr-review": "bin/umactually-pr-review.mjs"',
    "   },",
    '   "files": [',
    '     "dist",',
    '     "bin",',
    '     "action.yml",',
    '     "README.md",',
    '-    "LICENSE"',
    '+    "LICENSE",',
    '+    "docs",',
    '+    "examples",',
    '+    "scripts"',
    "   ],",
  ].join("\n");

  it("downgrades a finding whose body claims dist/ is missing from files (the PR-#41 false-positive pattern)", () => {
    const review: LiveReview = {
      summary: "test",
      verdict: "COMMENT",
      comments: [
        {
          path: "package.json",
          line: 1,
          body: "The `outputs:` block was deleted entirely and replaced with `branding:`. dist/ is missing from package.json#files so the published package will fail at runtime.",
          severity: "critical",
          category: "packaging",
        },
      ],
      suppressedComments: [],
    };
    const result = applyVerifiedFactsFilter({ review, diffText: PR_41_DIFF });
    // The finding contradicted the verified facts (dist/ IS in files),
    // so it should be downgraded to info, not dropped.
    expect(result.kept).toHaveLength(0);
    expect(result.downgraded).toHaveLength(1);
    expect(result.downgraded[0]?.severity).toBe("info");
    expect(result.downgradeReasons).toHaveLength(1);
    expect(result.downgradeReasons[0]?.reason).toContain("dist");
    expect(result.downgradeReasons[0]?.reason).toContain("missing");
    expect(result.downgradeReasons[0]?.reason).toContain("package.json#files");
  });

  it("keeps a finding whose body mentions dist/ but does NOT claim it is missing", () => {
    const review: LiveReview = {
      summary: "test",
      verdict: "COMMENT",
      comments: [
        {
          path: "package.json",
          line: 1,
          body: "The dist/ directory is included in the published tarball via the files array. Verify the .npmignore does not conflict.",
          severity: "low",
          category: "verification",
        },
      ],
      suppressedComments: [],
    };
    const result = applyVerifiedFactsFilter({ review, diffText: PR_41_DIFF });
    expect(result.kept).toHaveLength(1);
    expect(result.downgraded).toHaveLength(0);
  });

  it("keeps a finding whose claim is genuinely about something missing that IS missing", () => {
    // No missing entries in the PR-#41 files array — every entry
    // claimed missing should actually be present, so any finding
    // claiming "scripts/ is missing from files" would be wrong.
    // But a finding claiming "tests/ is missing from files" would
    // be a correct observation — tests/ was never in files.
    const review: LiveReview = {
      summary: "test",
      verdict: "COMMENT",
      comments: [
        {
          path: "package.json",
          line: 1,
          body: "tests/ is missing from the files array — runtime artifacts may not ship.",
          severity: "medium",
          category: "packaging",
        },
      ],
      suppressedComments: [],
    };
    const result = applyVerifiedFactsFilter({ review, diffText: PR_41_DIFF });
    // tests/ is genuinely not in files, so the finding is NOT a
    // contradiction — it should be kept.
    expect(result.kept).toHaveLength(1);
    expect(result.downgraded).toHaveLength(0);
  });

  it("preserves the original comment shape on downgraded findings except for severity", () => {
    const review: LiveReview = {
      summary: "test",
      verdict: "COMMENT",
      comments: [
        {
          path: "package.json",
          line: 1,
          body: "docs is missing from package.json#files so consumers won't get the example workflows.",
          severity: "critical",
          category: "packaging",
        },
      ],
      suppressedComments: [],
    };
    const result = applyVerifiedFactsFilter({ review, diffText: PR_41_DIFF });
    expect(result.downgraded[0]?.path).toBe("package.json");
    expect(result.downgraded[0]?.line).toBe(1);
    expect(result.downgraded[0]?.body).toBe(
      review.comments[0]?.body,
    );
    expect(result.downgraded[0]?.category).toBe("packaging");
    // Only severity changes (critical -> info).
    expect(result.downgraded[0]?.severity).toBe("info");
  });

  it("returns an empty result when the diff contains no package.json/action.yml", () => {
    const diff = [
      "diff --git a/README.md b/README.md",
      "--- a/README.md",
      "+++ b/README.md",
      "@@ -1,1 +1,1 @@",
      "-old",
      "+new",
    ].join("\n");
    const review: LiveReview = {
      summary: "test",
      verdict: "COMMENT",
      comments: [
        {
          path: "README.md",
          line: 1,
          body: "dist is missing from files.",
          severity: "low",
          category: "test",
        },
      ],
      suppressedComments: [],
    };
    const result = applyVerifiedFactsFilter({ review, diffText: diff });
    // No verified facts available → no contradictions to detect →
    // finding kept at original severity.
    expect(result.kept).toHaveLength(1);
    expect(result.downgraded).toHaveLength(0);
  });

  it("downgrades a finding that claims an action.yml output was removed when it still exists", () => {
    const diff = [
      "diff --git a/action.yml b/action.yml",
      "--- a/action.yml",
      "+++ b/action.yml",
      "@@ -1,1 +1,4 @@",
      "+outputs:",
      "+  marker:",
      "+    description: x.",
    ].join("\n");
    const review: LiveReview = {
      summary: "test",
      verdict: "COMMENT",
      comments: [
        {
          path: "action.yml",
          line: 1,
          body: "The marker output was removed but downstream consumers still depend on it.",
          severity: "high",
          category: "api",
        },
      ],
      suppressedComments: [],
    };
    const result = applyVerifiedFactsFilter({ review, diffText: diff });
    // Verified facts say marker is in the outputs list — finding
    // contradicts, downgrade to info.
    expect(result.downgraded).toHaveLength(1);
    expect(result.downgraded[0]?.severity).toBe("info");
    expect(result.downgradeReasons[0]?.reason).toContain("marker");
  });
});
