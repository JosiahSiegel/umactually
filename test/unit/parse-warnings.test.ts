import { describe, expect, it } from "vitest";

import type { LiveReviewComment } from "../../src/cli/live-shared.js";
import {
  buildParseWarningsArtifact,
  collectParseWarnings,
} from "../../src/cli/parse-warnings.js";

/**
 * Regression test for PR #56.
 *
 * The Azure-policy review on the umactually self-review (sync PR #56,
 * 4f0aaf7) produced 8 findings citing `dist/cli.js` and `dist/index.js`
 * line numbers. The supplied diff was 122 lines of source-only
 * `src/cli/help.ts` content — no dist/ at all. The model fabricated
 * the dist/ citations from training-data priors.
 *
 * This test pins the failure: the parse-warnings module must catch
 * every one of those 8 fabricated findings AND assign the right
 * reason. If a future change to `selectPostableComments` or
 * `parseDiffPositions` silently starts posting these findings as
 * inline comments, this test will fail in CI.
 */
describe("PR #56 regression: dist/cli.js + dist/index.js citations", () => {
  // The exact 8 findings the model produced (one was on dist/cli.js:2,
  // one on dist/index.js:2470, etc — see the raw review above).
  const pr56SourceDiff = [
    "diff --git a/src/cli/help.ts b/src/cli/help.ts",
    "--- a/src/cli/help.ts",
    "+++ b/src/cli/help.ts",
    "@@ -1,43 +1,81 @@",
    " export const CLI_HELP_TEXT = [",
    "-  \"  --platform <auto|github|azure>\",",
    "+  \"  --platform <auto|github|azure>                  \",",
    " ",
    " ].join(\"\\n\");",
    "",
  ].join("\n");

  const pr56FabricatedComments: LiveReviewComment[] = [
    {
      path: "dist/cli.js",
      line: 1,
      body: "Reviewing a bundled ncc artifact instead of source. The diff adds dist/cli.js (10,258 lines) with no companion source diff, no test diff, no action.yml diff, and no index.js diff. Reviewers cannot evaluate correctness, type soundness, or contract changes from a webpack bundle — the meaningful delta lives in src/.",
      severity: "critical",
      category: "build-artifact",
    },
    {
      path: "dist/cli.js",
      line: 2,
      body: "The canonical CLI marker identifier in src/util/marker.ts is hidden behind several layers of webpack/minified exports. The bundle embeds these as inline string literals across many call sites, which means a typo or paste-drift in any one of them silently breaks marker-based dedup loops on Azure.",
      severity: "high",
      category: "platform-contract",
    },
    {
      path: "dist/cli.js",
      line: 5,
      body: "REVIEW_MARKER is the literal that the runtime greps PR comments for when deciding whether to replace a previous UmActually review. The bundle embeds this exact string in dozens of places.",
      severity: "medium",
      category: "platform-contract",
    },
    {
      path: "dist/index.js",
      line: 1,
      body: "Dist build artifact committed directly. The patch shows /dev/null → a 10,690-line generated bundle with no accompanying source diff.",
      severity: "medium",
      category: "build-distribution",
    },
    {
      path: "dist/index.js",
      line: 2470,
      body: "AZURE_EMPTY_DIFF_STATUS is used as the HTTP status for multiple Azure errors thrown when the diff body is empty or JSON shape is wrong. Reporting status: 200 on a thrown AzureApiError is semantically misleading.",
      severity: "medium",
      category: "error-handling",
    },
    {
      path: "dist/cli.js",
      line: 4,
      body: "The auto-invoke block at the bottom branches on process.argv[1] basename matching. The bundle file is named cli.js here, but the action entry is dist/index.js per the comment.",
      severity: "high",
      category: "platform-contract",
    },
    {
      path: "src/cli/help.ts",
      line: 7,
      body: "Header comment claims FLAG_COLUMN_WIDTH is computed at runtime from the longest entry in HELP_FLAGS (currently --debug-raw-response at 46 chars). The math is off-by-one.",
      severity: "medium",
      category: "correctness",
    },
    {
      path: "dist/cli.js",
      line: 1047,
      body: "dist/cli.js and dist/index.js are committed build artifacts. They were regenerated to match the new source, but shipping dist/ in the same PR as the source change means reviewers can't tell which is the source of truth.",
      severity: "medium",
      category: "build-artifact",
    },
  ];

  it("catches all 7 dist/ fabrications as 'path-not-in-diff' (the source-only diff has no dist/ blocks)", () => {
    const warnings = collectParseWarnings({
      review: { comments: pr56FabricatedComments, suppressedComments: [] },
      diffText: pr56SourceDiff,
    });
    const distWarnings = warnings.filter((w) => w.modelPath.startsWith("dist/"));
    expect(distWarnings).toHaveLength(7);
    for (const w of distWarnings) {
      expect(w.reason).toBe("path-not-in-diff");
    }
  });

  it("flags the docblock comment finding (src/cli/help.ts:7) as 'line-not-in-diff' (path is in diff, line isn't)", () => {
    const warnings = collectParseWarnings({
      review: { comments: pr56FabricatedComments, suppressedComments: [] },
      diffText: pr56SourceDiff,
    });
    const docblockWarning = warnings.find((w) => w.modelPath === "src/cli/help.ts");
    expect(docblockWarning).toBeDefined();
    expect(docblockWarning?.reason).toBe("line-not-in-diff");
    expect(docblockWarning?.modelLine).toBe(7);
  });

  it("returns 0 warnings for the real (path, line) pairs the diff actually shows", () => {
    // The pr56SourceDiff fixture shows 4 new-side lines: 1 (context),
    // 2 (added, +), 3 (context), 4 (context). Lines 5+ are inside the
    // hunk header's declared range but not actually rendered in the
    // diff body, so `parseDiffPositions` doesn't accept them as
    // anchorable. A real review can only cite what's visible.
    const realComments: LiveReviewComment[] = [
      {
        path: "src/cli/help.ts",
        line: 1,
        body: "Real finding: context line at position 1.",
        severity: "high",
        category: "correctness",
      },
      {
        path: "src/cli/help.ts",
        line: 2,
        body: "Real finding: added line at position 2.",
        severity: "medium",
        category: "style",
      },
      {
        path: "src/cli/help.ts",
        line: 3,
        body: "Real finding: context line at position 3.",
        severity: "low",
        category: "style",
      },
      {
        path: "src/cli/help.ts",
        line: 4,
        body: "Real finding: context line at position 4.",
        severity: "low",
        category: "style",
      },
    ];
    const warnings = collectParseWarnings({
      review: { comments: realComments, suppressedComments: [] },
      diffText: pr56SourceDiff,
    });
    expect(warnings).toHaveLength(0);
  });

  it("flags a real-but-not-in-diff line as 'line-not-in-diff'", () => {
    // Position 5 is in the hunk's declared range but not rendered
    // in the diff body. A model that cited line 5 would be hallucinating
    // — the operator can see this in the artifact.
    const realComments: LiveReviewComment[] = [
      {
        path: "src/cli/help.ts",
        line: 5,
        body: "A finding at line 5 — the diff hunk declares 81 new lines but only shows 4.",
        severity: "medium",
        category: "style",
      },
    ];
    const warnings = collectParseWarnings({
      review: { comments: realComments, suppressedComments: [] },
      diffText: pr56SourceDiff,
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.reason).toBe("line-not-in-diff");
    expect(warnings[0]?.modelPath).toBe("src/cli/help.ts");
    expect(warnings[0]?.modelLine).toBe(5);
  });

  it("artifact summary counts match the warning distribution", () => {
    const artifact = buildParseWarningsArtifact({
      review: { comments: pr56FabricatedComments, suppressedComments: [] },
      diffText: pr56SourceDiff,
    });
    expect(artifact.summary.totalComments).toBe(8);
    expect(artifact.summary.invalidCount).toBe(8);
    expect(artifact.summary.byReason["path-not-in-diff"]).toBe(7);
    expect(artifact.summary.byReason["line-not-in-diff"]).toBe(1);
    expect(artifact.summary.bySource.comments).toBe(8);
    expect(artifact.summary.bySource.suppressed_comments).toBe(0);
  });

  it("locks total record count: 8 fabrications (the exact PR #56 number) — guard against a future regression that stops recording", () => {
    const warnings = collectParseWarnings({
      review: { comments: pr56FabricatedComments, suppressedComments: [] },
      diffText: pr56SourceDiff,
    });
    // The model produced 8 findings on the PR #56 sync. If a future
    // change to the warnings pipeline reduces this count silently, this
    // test fails. This is the canary.
    expect(warnings).toHaveLength(8);
  });

  it("truncates body excerpts to <= 200 chars to keep the artifact small", () => {
    const warnings = collectParseWarnings({
      review: { comments: pr56FabricatedComments, suppressedComments: [] },
      diffText: pr56SourceDiff,
    });
    for (const w of warnings) {
      expect(w.bodyExcerpt.length).toBeLessThanOrEqual(201);
    }
  });
});