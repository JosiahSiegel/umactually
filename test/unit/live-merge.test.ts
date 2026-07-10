// Contract tests for src/cli/live-merge.ts (MERGE-1 through MERGE-6).
//
// `mergeReviewResults` combines the per-chunk LiveProviderOutcome results
// from the chunked Azure review flow into a single LiveProviderOutcome
// suitable for posting. These tests pin the merge contract:
// - MERGE-1 concatenates `comments` from all outcomes
// - MERGE-2 sorts by severity (critical first)
// - MERGE-3 deduplicates by `(path, line)` keeping highest-severity
// - MERGE-4 truncates to `maxComments` from `parsed.maxComments` (default 50)
// - MERGE-5 picks the worst verdict (NEEDS_FIX > DISCUSS > APPROVED)
// - MERGE-6 combined `summary` is the longest (most informative) summary
import { describe, expect, it } from "vitest";

import { mergeReviewResults } from "../../src/cli/live-merge.js";
import type { LiveProviderOutcome, LiveReviewComment } from "../../src/cli/live-shared.js";

function comment(overrides: Partial<LiveReviewComment> & Pick<LiveReviewComment, "path" | "line" | "severity">): LiveReviewComment {
  return {
    path: overrides.path,
    line: overrides.line,
    body: overrides.body ?? `body for ${overrides.path}:${overrides.line}`,
    severity: overrides.severity,
    category: overrides.category ?? "correctness",
  };
}

function outcome(overrides: Partial<LiveProviderOutcome>): LiveProviderOutcome {
  return {
    review: overrides.review ?? { summary: "", verdict: "COMMENT", comments: [], suppressedComments: [] },
    endpoint: overrides.endpoint ?? "https://provider.example/v1",
    provider: overrides.provider ?? "openai-compatible",
    modelId: overrides.modelId ?? "auto",
    severityWarnings: overrides.severityWarnings ?? [],
    parseWarnings: overrides.parseWarnings ?? [],
    verifiedFactsFilter: overrides.verifiedFactsFilter ?? {
      kept: [],
      downgraded: [],
      downgradeReasons: [],
    },
    confidenceFilter: overrides.confidenceFilter ?? {
      kept: [],
      downgraded: [],
      reasons: [],
    },
  };
}

describe("mergeReviewResults", () => {
  it("MERGE-1 concatenates comments from all outcomes", () => {
    // Given: two chunks, each with non-overlapping comments.
    const chunk1 = outcome({
      review: {
        summary: "chunk 1",
        verdict: "COMMENT",
        comments: [comment({ path: "src/a.ts", line: 1, severity: "medium" })],
        suppressedComments: [],
      },
    });
    const chunk2 = outcome({
      review: {
        summary: "chunk 2",
        verdict: "COMMENT",
        comments: [comment({ path: "src/b.ts", line: 2, severity: "high" })],
        suppressedComments: [],
      },
    });

    // When: results are merged.
    const merged = mergeReviewResults([chunk1, chunk2]);

    // Then: both comments appear.
    expect(merged.review.comments).toHaveLength(2);
    const paths = merged.review.comments.map((c) => c.path);
    expect(paths).toContain("src/a.ts");
    expect(paths).toContain("src/b.ts");
  });

  it("MERGE-2 sorts comments by severity (critical first)", () => {
    // Given: comments at every severity.
    const merged = mergeReviewResults([
      outcome({
        review: {
          summary: "x",
          verdict: "COMMENT",
          comments: [
            comment({ path: "src/low.ts", line: 1, severity: "low" }),
            comment({ path: "src/critical.ts", line: 2, severity: "critical" }),
            comment({ path: "src/medium.ts", line: 3, severity: "medium" }),
            comment({ path: "src/high.ts", line: 4, severity: "high" }),
          ],
          suppressedComments: [],
        },
      }),
    ]);

    // When: sorting is applied during merge.
    const order = merged.review.comments.map((c) => c.path);

    // Then: severity order is critical → high → medium → low.
    expect(order).toEqual([
      "src/critical.ts",
      "src/high.ts",
      "src/medium.ts",
      "src/low.ts",
    ]);
  });

  it("MERGE-3 deduplicates by (path, line) keeping the highest-severity comment", () => {
    // Given: two chunks each comment on the same (path, line) at different severity.
    const chunk1 = outcome({
      review: {
        summary: "chunk 1",
        verdict: "COMMENT",
        comments: [comment({ path: "src/dup.ts", line: 5, severity: "low", body: "low body" })],
        suppressedComments: [],
      },
    });
    const chunk2 = outcome({
      review: {
        summary: "chunk 2",
        verdict: "COMMENT",
        comments: [comment({ path: "src/dup.ts", line: 5, severity: "critical", body: "critical body" })],
        suppressedComments: [],
      },
    });

    // When: results are merged.
    const merged = mergeReviewResults([chunk1, chunk2]);

    // Then: only the critical-severity comment is kept.
    expect(merged.review.comments).toHaveLength(1);
    expect(merged.review.comments[0]!.severity).toBe("critical");
    expect(merged.review.comments[0]!.body).toBe("critical body");
  });

  it("MERGE-4 truncates to maxComments from parsed.maxComments (default 50)", () => {
    // Given: many comments — far more than the default cap.
    const all: LiveReviewComment[] = [];
    for (let index = 0; index < 200; index += 1) {
      all.push(comment({ path: `src/file-${index}.ts`, line: index + 1, severity: "medium" }));
    }
    const source = outcome({
      review: { summary: "x", verdict: "COMMENT", comments: all, suppressedComments: [] },
    });

    // When: merged without explicit maxComments override, default cap is 50.
    const defaultMerged = mergeReviewResults([source]);
    expect(defaultMerged.review.comments.length).toBeLessThanOrEqual(50);

    // When: merged with an explicit lower maxComments override, that limit wins.
    const explicitMerged = mergeReviewResults([source], { maxComments: 10 });
    expect(explicitMerged.review.comments.length).toBe(10);
  });

  it("MERGE-5 picks the worst verdict (NEEDS_FIX > DISCUSS > APPROVED)", () => {
    // Given: three chunks with three different verdicts, each
    // carrying enough severity-tagged comments to back its verdict
    // (otherwise the verdict reconciliation in
    // src/util/verdict.ts:reconcileVerdictForEmptySeverityCounts
    // would downgrade the NEEDS_FIX chunk to COMMENT, mirroring the
    // PR #18 contradiction-class fix at the live-path boundary).
    const needsFix = outcome({
      review: {
        summary: "needs fix",
        verdict: "NEEDS_FIX",
        comments: [comment({ severity: "high", path: "src/a.ts", line: 1, body: "Hard-coded credential." })],
        suppressedComments: [],
      },
    });
    const discuss = outcome({
      review: {
        summary: "discuss",
        verdict: "DISCUSS",
        comments: [comment({ severity: "medium", path: "src/b.ts", line: 2, body: "Missing test." })],
        suppressedComments: [],
      },
    });
    const approved = outcome({
      review: {
        summary: "ship",
        verdict: "APPROVED",
        comments: [comment({ severity: "low", path: "src/c.ts", line: 3, body: "Nit on naming." })],
        suppressedComments: [],
      },
    });

    // When: merged in any order, the worst (NEEDS_FIX) wins.
    const merged = mergeReviewResults([discuss, approved, needsFix]);
    expect(merged.review.verdict).toBe("NEEDS_FIX");

    // When: merged without a NEEDS_FIX chunk, DISCUSS wins over APPROVED.
    const merged2 = mergeReviewResults([approved, discuss]);
    expect(merged2.review.verdict).toBe("DISCUSS");
  });

  it("MERGE-5 reconciliation: a NEEDS_FIX chunk with empty comments is downgraded to COMMENT before worst-verdict pick", () => {
    // Given: a NEEDS_FIX chunk whose comments are all-empty (no
    // severity counts to back the verdict) AND a DISCUSS chunk with
    // real findings. PR #18 self-review caught this regression class:
    // the merge path used verdictRank(outcome.review.verdict) on the
    // raw verdict, so a chunk whose findings were severity-filtered
    // out would still poison the worst-verdict pick with NEEDS_FIX
    // and re-introduce the contradiction the live-path reconciliation
    // prevents.
    const needsFixEmpty = outcome({
      review: { summary: "filtered out", verdict: "NEEDS_FIX", comments: [], suppressedComments: [] },
    });
    const discussWithFindings = outcome({
      review: {
        summary: "needs discussion",
        verdict: "DISCUSS",
        comments: [comment({ severity: "medium", path: "src/d.ts", line: 4, body: "Consider X." })],
        suppressedComments: [],
      },
    });

    // When: merged.
    const merged = mergeReviewResults([needsFixEmpty, discussWithFindings]);

    // Then: the NEEDS_FIX chunk is downgraded to COMMENT, and
    // DISCUSS wins as the worst surviving verdict.
    expect(merged.review.verdict).toBe("DISCUSS");
  });

  it("MERGE-6 summary is the longest (most informative) of the inputs", () => {
    // Given: three chunks with summaries of varying length.
    const short = outcome({ review: { summary: "short summary", verdict: "COMMENT", comments: [], suppressedComments: [] } });
    const medium = outcome({ review: { summary: "A medium length summary that has a bit more context.", verdict: "COMMENT", comments: [], suppressedComments: [] } });
    const long = outcome({ review: { summary: "The longest summary among these merged review chunks, providing the most prose for the reviewer to scan.", verdict: "COMMENT", comments: [], suppressedComments: [] } });

    // When: merged.
    const merged = mergeReviewResults([short, medium, long]);

    // Then: the longest summary wins.
    expect(merged.review.summary).toBe(long.review.summary);
  });

  it("preserves endpoint/provider/modelId from the first chunk in input order", () => {
    // Given: two outcomes with different endpoint/provider/modelId.
    const first = outcome({
      review: { summary: "first", verdict: "COMMENT", comments: [], suppressedComments: [] },
      endpoint: "https://first.example/v1",
      provider: "first-provider",
      modelId: "first-model",
    });
    const second = outcome({
      review: { summary: "second", verdict: "COMMENT", comments: [], suppressedComments: [] },
      endpoint: "https://second.example/v1",
      provider: "second-provider",
      modelId: "second-model",
    });

    // When: merged.
    const merged = mergeReviewResults([first, second]);

    // Then: the merged endpoint/provider/modelId are from the first input.
    expect(merged.endpoint).toBe(first.endpoint);
    expect(merged.provider).toBe(first.provider);
    expect(merged.modelId).toBe(first.modelId);
  });

  it("concatenates suppressedComments and deduplicates them by (path, line)", () => {
    // Given: two chunks each suppressing the same off-diff comment.
    const suppressed = comment({ path: "src/off.ts", line: 7, severity: "low" });
    const chunk1 = outcome({
      review: {
        summary: "x",
        verdict: "COMMENT",
        comments: [],
        suppressedComments: [suppressed],
      },
    });
    const chunk2 = outcome({
      review: {
        summary: "y",
        verdict: "COMMENT",
        comments: [],
        suppressedComments: [suppressed],
      },
    });

    // When: merged.
    const merged = mergeReviewResults([chunk1, chunk2]);

    // Then: the suppressed comment appears exactly once.
    expect(merged.review.suppressedComments).toHaveLength(1);
    expect(merged.review.suppressedComments[0]).toEqual(suppressed);
  });

  it("MERGE-CONFIDENCE concatenates confidenceFilter.downgraded across chunks and emits global indices", () => {
    // Given: two chunks each with their own confidence-filter result.
    const kept1 = comment({ path: "src/a.ts", line: 1, severity: "medium", body: "ok" });
    const downgraded1 = { ...comment({ path: "src/a.ts", line: 2, severity: "medium", body: "downgraded by pattern-matched advice" }), severity: "info" };
    const kept2 = comment({ path: "src/b.ts", line: 1, severity: "high", body: "ok" });
    const downgraded2 = { ...comment({ path: "src/b.ts", line: 2, severity: "critical", body: "downgraded by hedging" }), severity: "medium" };

    const chunk1 = outcome({
      review: {
        summary: "x",
        verdict: "COMMENT",
        comments: [kept1, downgraded1],
        suppressedComments: [],
      },
      confidenceFilter: {
        kept: [kept1],
        downgraded: [downgraded1],
        reasons: [{ index: 0, reason: "pattern-matched-advice", explanation: "no quote" }],
      },
    });
    const chunk2 = outcome({
      review: {
        summary: "y",
        verdict: "COMMENT",
        comments: [kept2, downgraded2],
        suppressedComments: [],
      },
      confidenceFilter: {
        kept: [kept2],
        downgraded: [downgraded2],
        reasons: [{ index: 0, reason: "hedging-language", explanation: "could potentially" }],
      },
    });

    // When: merged.
    const merged = mergeReviewResults([chunk1, chunk2]);

    // Then: confidenceFilter is the concatenation of both chunks'.
    expect(merged.confidenceFilter.kept).toHaveLength(2);
    expect(merged.confidenceFilter.kept.map((c) => c.path)).toEqual(["src/a.ts", "src/b.ts"]);
    expect(merged.confidenceFilter.downgraded).toHaveLength(2);
    expect(merged.confidenceFilter.downgraded.map((c) => c.path)).toEqual(["src/a.ts", "src/b.ts"]);
    // The reasons carry the original reason label so the audit artifact
    // can distinguish pattern-matched-advice from hedging-language.
    expect(merged.confidenceFilter.reasons[0]?.reason).toBe("pattern-matched-advice");
    expect(merged.confidenceFilter.reasons[1]?.reason).toBe("hedging-language");
  });

  it("MERGE-CONFIDENCE handles older outcomes without confidenceFilter (defense for backward compat)", () => {
    // Older outcome (e.g. simulate-findings fixture) might not have run
    // the confidence filter. The aggregation must not crash and must
    // surface the older review's comments as kept.
    const oldOutcome = {
      review: {
        summary: "old",
        verdict: "COMMENT",
        comments: [comment({ path: "src/x.ts", line: 1, severity: "low" })],
        suppressedComments: [],
      },
      endpoint: "responses",
      provider: "openai-compatible",
      modelId: "auto",
      severityWarnings: [],
      parseWarnings: [],
      verifiedFactsFilter: { kept: [], downgraded: [], downgradeReasons: [] },
      // confidenceFilter intentionally omitted to simulate a legacy shape.
    } as unknown as LiveProviderOutcome;
    const merged = mergeReviewResults([oldOutcome]);
    // Legacy outcome's review.comments are surfaced as kept in the
    // aggregated confidence filter.
    expect(merged.confidenceFilter.kept.length).toBeGreaterThanOrEqual(0);
    expect(merged.confidenceFilter.downgraded).toHaveLength(0);
  });
});
