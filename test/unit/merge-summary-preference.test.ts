// SPDX-License-Identifier: MIT
// Regression: chunked review merges the parse-fail fallback's summary
// over a successful chunk's summary, producing a card that says
// "Provider response did not contain..." while also rendering real
// findings from the successful chunk.
//
// The bug lives in `src/cli/live-merge.ts` MERGE-6: it picks the LONGEST
// summary across all chunk outcomes without any awareness that one of
// them is a parse-fail fallback. The fallback summary is intentionally
// long (it embeds a <details> block with the raw provider response),
// so the merge ALWAYS picks it over a successful review's summary.
//
// Live evidence (ADO PR #51, 2026-07-06T22:35:25Z): the parent card has
//   50 inline findings (from successful chunks) + a parse-fail summary
//   text in the <details> block (from a failed chunk's fallback).
// The user sees a contradictory card: real findings AND a parse-fail
// diagnostic in the same review.

import { describe, expect, it } from "vitest";
import { mergeReviewResults } from "../../src/cli/live-merge.js";
import type { LiveProviderOutcome } from "../../src/cli/live-shared.js";

function successOutcome(summary: string, commentCount: number): LiveProviderOutcome {
  return {
    review: {
      summary,
      verdict: "NEEDS_FIX",
      comments: Array.from({ length: commentCount }, (_, i) => ({
        path: `src/file-${i}.ts`,
        line: i + 1,
        body: `finding ${i}`,
        severity: "medium",
        category: "general",
      })),
      suppressedComments: [],
    },
    endpoint: "responses",
    provider: "openai-compatible",
    modelId: "auto",
    severityWarnings: [],
    parseWarnings: [],
    verifiedFactsFilter: { kept: [], downgraded: [], downgradeReasons: [] },
    confidenceFilter: { kept: [], downgraded: [], reasons: [] },
  };
}

function parseFailOutcome(): LiveProviderOutcome {
  // Mirrors the shape produced by buildMalformedProviderFallback in
  // src/cli/live-shared.ts:406-448 — summary is intentionally long
  // because it embeds the raw provider response.
  const rawSnippet = "event: response.created\ndata: {...truncated 16KB diagnostic...}\n\n";
  return {
    review: {
      summary:
        `Provider response did not contain a valid JSON review payload.\n\n` +
        `<details>\n<summary>📨 Raw provider response (truncated)</summary>\n\n` +
        `\`\`\`text\n${rawSnippet}\n\`\`\`\n\n` +
        `Provider: \`openai-compatible\` · Model: \`auto\`\n</details>\n\n`,
      verdict: "COMMENT",
      comments: [],
      suppressedComments: [],
      parseFailed: true,
    },
    endpoint: "responses",
    provider: "openai-compatible",
    modelId: "auto",
    severityWarnings: [],
    parseWarnings: [],
    verifiedFactsFilter: { kept: [], downgraded: [], downgradeReasons: [] },
    confidenceFilter: { kept: [], downgraded: [], reasons: [] },
  };
}

describe("mergeReviewResults — pick summary from the chunk that contributed findings", () => {
  it("prefers the successful chunk's summary even when a parse-fail fallback has a longer one", () => {
    const outcomes = [
      successOutcome("Real review of the diff with 5 findings", 5),
      parseFailOutcome(),
    ];
    const merged = mergeReviewResults(outcomes);
    // The merged card should show the REAL summary, not the parse-fail
    // fallback's diagnostic block. A merge that picks the fallback
    // summary contradicts the findings table (5 real comments).
    expect(merged.review.summary).toBe("Real review of the diff with 5 findings");
    expect(merged.review.summary).not.toContain("Provider response did not contain");
    // Findings should still be merged in.
    expect(merged.review.comments.length).toBe(5);
    expect(merged.review.verdict).toBe("NEEDS_FIX");
  });

  it("falls back to the parse-fail summary ONLY when no chunk produced findings", () => {
    // If every chunk failed, the merge has nothing real to show. The
    // parse-fail fallback's summary is the only honest diagnostic.
    const outcomes = [parseFailOutcome(), parseFailOutcome()];
    const merged = mergeReviewResults(outcomes);
    expect(merged.review.summary).toContain("Provider response did not contain");
    expect(merged.review.comments.length).toBe(0);
  });

  it("merges findings from a successful chunk even when another chunk has parseFailed: true", () => {
    const outcomes = [
      successOutcome("Real review", 3),
      parseFailOutcome(),
    ];
    const merged = mergeReviewResults(outcomes);
    expect(merged.review.comments.length).toBe(3);
    expect(merged.review.summary).toBe("Real review");
  });
});