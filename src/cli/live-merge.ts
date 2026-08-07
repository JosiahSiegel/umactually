/**
 * Merge multiple per-chunk LiveProviderOutcome results (one per diff
 * chunk) into a single LiveProviderOutcome suitable for posting to the
 * PR.
 *
 * Why this exists:
 *   When `chunkDiffByFile` splits a large PR diff into per-file chunks,
 *   each chunk is reviewed independently and the model may emit
 *   overlapping findings (a file may straddle two chunks if it is
 *   borderline), repeat findings, or diverge on the verdict. The merge
 *   step reconciles all of these into one deterministic review.
 *
 * Contract (pinned by test/unit/live-merge.test.ts):
 *   - MERGE-1: comments from every outcome appear in the merge.
 *   - MERGE-2: comments are sorted by severity (critical → high →
 *     medium → low), then by `path` → `line`.
 *   - MERGE-3: duplicate (path, line) comments are deduped, keeping the
 *     highest-severity one (an upstream "low" comment is lost when a
 *     downstream "critical" comment lands on the same anchor).
 *   - MERGE-4: the merged comment list is truncated to `maxComments`
 *     (defaults to 50, matching the post-side cap).
 *   - MERGE-5: the merged verdict is the worst across inputs
 *     (NEEDS_FIX > DISCUSS > APPROVED).
 *   - MERGE-6: the merged `summary` prefers chunks that contributed
 *     real findings (comments or suppressed comments); among the
 *     surviving chunks, the longest summary wins. A parse-fail
 *     fallback's summary is intentionally LONG (it embeds the raw
 *     provider response in a `<details>` block), so the previous
 *     "longest overall" policy let a parse-fail summary beat a
 *     successful chunk's real summary — contradicting the findings
 *     table. The new policy filters out empty-finding chunks and
 *     falls back to the parse-fail summary ONLY when no chunk
 *     contributed findings.
 *   - Plus (extra): `suppressedComments` are deduped by (path, line),
 *     and `endpoint`/`provider`/`modelId` come from the FIRST input so
 *     downstream `runAzureLive` callers still see the same identity as
 *     a single-call flow.
 */
import type { LiveProviderOutcome, LiveReviewComment } from "./live-shared.js";
import { DEFAULT_MAX_COMMENTS } from "../config/defaults.js";
import { severityRank, countBySeverity } from "../util/severity.js";
import { composeEffectiveVerdict, verdictRank } from "../util/verdict.js";

export type MergeOptions = {
  /**
   * Cap on the number of inline comments in the merged review.
   * Defaults to 50 to match the existing post-side cap in
   * `live-shared.ts:DEFAULT_MAX_COMMENTS`. Always pass an explicit
   * value when wiring `mergeReviewResults` into the live path so the
   * CLI flag `--max-comments` flows through.
   */
  readonly maxComments?: number;
};

/**
 * Merge per-chunk LiveProviderOutcome values into one. Pure function —
 * safe to test without I/O.
 *
 * Empty input returns an empty (COMMENT) review with no comments and
 * no summary so the post path can still complete (e.g. when every
 * chunk returned a parse-fail fallback).
 */
/**
 * Generic concat-aggregator for per-chunk filter results (verified-
 * facts and confidence). Walks each outcome in order, concatenates
 * `kept` and `downgraded`, and stamps a `globalIndex` onto every
 * `reasons[]` entry that points at the entry's slot in the merged
 * kept+downgraded array.
 *
 * The per-chunk "extract" is delegated to a `derive` callback so the
 * generic only owns the outer loop + index bookkeeping; each filter's
 * per-record shape (verified-facts uses `{ index, reason: string }`,
 * confidence uses `{ index, reason: ConfidenceFilterReason, explanation }`)
 * lives in its own derive callback.
 *
 * **Index semantics** (load-bearing invariant — pinned by
 * `test/unit/live-merge.test.ts` MERGE-CONFIDENCE / MERGE-FACTSAGG):
 * the `index` on each `reasons` entry points into the AGGREGATED
 * kept+downgraded arrays in concatenation order (kept first, then
 * downgraded, in the order chunks were fed to the merge), NOT into
 * the post-dedup/post-sort/post-truncate `review.comments` array
 * the operator sees in the final review body. The dedup + sort +
 * truncate step in `mergeReviewResults` does not remap the indices.
 * Callers that want to correlate a reason back to a specific finding
 * MUST use `(path, line)` — the index is an internal aid for the
 * audit artifact's order, not a stable handle into the visible
 * review.
 *
 * Why this is not a stable handle: `review.comments` is deduped by
 * `(path, line)` keeping the highest-severity occurrence (so two
 * chunks reporting the same anchor produce ONE entry), sorted by
 * severity desc → path asc → line asc, then truncated to
 * `maxComments` (default 50). None of those operations preserve the
 * pre-merge order, so the audit artifact's `reasons[].index` is only
 * meaningful inside the aggregated kept+downgraded arrays — not
 * against `review.comments[i]`.
 *
 * `T` is the per-record reason shape; its `index` field is what the
 * generic overwrites as it walks.
 */
function aggregateMergeFilter<T extends { index: number }>(
  outcomes: readonly LiveProviderOutcome[],
  derive: (outcome: LiveProviderOutcome) => {
    readonly kept: readonly LiveReviewComment[];
    readonly downgraded: readonly LiveReviewComment[];
    readonly reasons: readonly T[];
  },
): { kept: LiveReviewComment[]; downgraded: LiveReviewComment[]; reasons: T[] } {
  const kept: LiveReviewComment[] = [];
  const downgraded: LiveReviewComment[] = [];
  const reasons: T[] = [];
  let globalIndex = 0;
  for (const o of outcomes) {
    const slice = derive(o);
    for (const c of slice.kept) {
      kept.push(c);
      globalIndex += 1;
    }
    for (let i = 0; i < slice.downgraded.length; i += 1) {
      const c = slice.downgraded[i];
      const reasonRecord = slice.reasons[i];
      if (c === undefined || reasonRecord === undefined) {
        continue;
      }
      downgraded.push(c);
      reasons.push({ ...reasonRecord, index: globalIndex });
      globalIndex += 1;
    }
  }
  return { kept, downgraded, reasons };
}

/**
 * Aggregate the per-chunk verified-facts filter results into a
 * single result for the merged outcome. Concatenates kept/
 * downgraded lists across chunks and emits global indices.
 *
 * See `aggregateMergeFilter` for the index-stability contract —
 * the same invariant applies here.
 */
function aggregateVerifiedFactsFilter(
  outcomes: readonly LiveProviderOutcome[],
): import("./verify-findings.js").VerifiedFactsFilterResult {
  const merged = aggregateMergeFilter<{ index: number; reason: string }>(outcomes, (o) => ({
    kept: o.verifiedFactsFilter.kept,
    downgraded: o.verifiedFactsFilter.downgraded,
    reasons: o.verifiedFactsFilter.downgradeReasons,
  }));
  return {
    kept: merged.kept,
    downgraded: merged.downgraded,
    downgradeReasons: merged.reasons,
  };
}

/**
 * Aggregate the per-chunk confidence-filter results. Mirrors the
 * verified-facts aggregation so the merged outcome's
 * confidenceFilter field has the same shape as any single-chunk
 * outcome's confidenceFilter.
 *
 * Legacy compatibility: when an outcome lacks `confidenceFilter`
 * (simulate-findings path, fixtures, and outcomes from before the
 * confidence filter was wired in `applyVerifyFilter`), we treat
 * its already-post-verified-facts `review.comments` as confidence-
 * kept. The upstream contract is: by the time an outcome is passed
 * here, `o.review.comments` is the POST-VERIFIED-FACTS list
 * (verified-facts drops the contradicted findings, but the
 * confidence-filter pass had not run yet for legacy outcomes). So
 * this is NOT a double-count of `verifiedFactsFilter.kept` — it's
 * the next step in the chain that legacy outcomes just happen to
 * skip. The audit-artifact count for the legacy path will therefore
 * match `review.comments.length` (the post-merge list), not
 * `verifiedFactsFilter.kept.length`. Pinned by
 * `test/unit/live-merge.test.ts` MERGE-CONFIDENCE legacy compat
 * case.
 *
 * See `aggregateMergeFilter` for the index-stability contract.
 */
function aggregateConfidenceFilter(
  outcomes: readonly LiveProviderOutcome[],
): import("../review/filter-confidence.js").ConfidenceFilterResult {
  return aggregateMergeFilter<{ index: number; reason: import("../review/filter-confidence.js").ConfidenceFilterReason; readonly explanation: string }>(
    outcomes,
    (o) => {
      if (o.confidenceFilter === undefined) {
        // Legacy: synthesize a "kept-only" slice where every
        // post-verified-facts comment is treated as confidence-kept.
        // Reasons are intentionally absent — there is no per-chunk
        // downgrade to attribute on the legacy path.
        const keptComments = o.review.comments;
        return {
          kept: keptComments,
          downgraded: [],
          reasons: [],
        };
      }
      return {
        kept: o.confidenceFilter.kept,
        downgraded: o.confidenceFilter.downgraded,
        reasons: o.confidenceFilter.reasons,
      };
    },
  );
}

export function mergeReviewResults(
  outcomes: readonly LiveProviderOutcome[],
  options?: MergeOptions,
): LiveProviderOutcome {
  const maxComments = options?.maxComments ?? DEFAULT_MAX_COMMENTS;

  if (outcomes.length === 0) {
    return {
      review: { summary: "", verdict: "COMMENT", comments: [], suppressedComments: [] },
      endpoint: "",
      provider: "",
      modelId: "",
      // No inputs → no warnings to surface.
      severityWarnings: [],
      parseWarnings: [],
      verifiedFactsFilter: { kept: [], downgraded: [], downgradeReasons: [] },
      confidenceFilter: { kept: [], downgraded: [], reasons: [] },
    };
  }

  const first = outcomes[0]!;

  // Collect + dedup comments by (path, line), keeping highest severity.
  const dedupedComments = new Map<string, LiveReviewComment>();
  const dedupedSuppressed = new Map<string, LiveReviewComment>();

  for (const outcome of outcomes) {
    for (const comment of outcome.review.comments) {
      const key = `${comment.path}:${comment.line}`;
      const existing = dedupedComments.get(key);
      if (existing === undefined || severityRank(comment.severity) > severityRank(existing.severity)) {
        dedupedComments.set(key, comment);
      }
    }
    for (const suppressed of outcome.review.suppressedComments) {
      const key = `${suppressed.path}:${suppressed.line}`;
      const existing = dedupedSuppressed.get(key);
      if (existing === undefined || severityRank(suppressed.severity) > severityRank(existing.severity)) {
        dedupedSuppressed.set(key, suppressed);
      }
    }
  }

  // MERGE-2: sort by severity desc, then path asc, then line asc.
  const sortedComments = [...dedupedComments.values()].sort((a, b) => {
    const rankDelta = severityRank(b.severity) - severityRank(a.severity);
    if (rankDelta !== 0) return rankDelta;
    const pathDelta = a.path.localeCompare(b.path);
    if (pathDelta !== 0) return pathDelta;
    return a.line - b.line;
  });

  // MERGE-4: truncate to maxComments.
  const truncatedComments = sortedComments.slice(0, maxComments);

  const sortedSuppressed = [...dedupedSuppressed.values()].sort((a, b) => a.path.localeCompare(b.path));

  // MERGE-5: pick worst verdict.
  //
  // Apply the same severity-counts reconciliation the live path uses
  // (`composeEffectiveVerdict`) BEFORE ranking, so a chunk whose
  // verdict contradicts its own findings list (NEEDS_FIX + empty
  // counts from PR #18, or non-blocking + non-empty counts from PR
  // #183 review pass) doesn't pollute the "worst verdict" pick.
  let worstVerdict = "";
  let worstRank = -1;
  for (const outcome of outcomes) {
    const composed = composeEffectiveVerdict({
      rawVerdict: outcome.review.verdict,
      severityCounts: countBySeverity(outcome.review.comments),
    });
    const rank = verdictRank(composed.verdict);
    if (rank > worstRank) {
      worstRank = rank;
      worstVerdict = composed.verdict;
    }
  }

  // MERGE-6: pick the best summary across all chunk outcomes.
  //
  // The previous implementation picked the LONGEST summary. That was
  // wrong: a parse-fail fallback's summary (built by
  // `buildMalformedProviderFallback`) is intentionally long because it
  // embeds a `<details>` block with the raw provider response, so it
  // ALWAYS beat the successful chunk's real summary. The merged card
  // then contradicted itself — real findings in the findings table,
  // parse-fail diagnostic in the summary section.
  //
  // New policy: prefer summaries from chunks that contributed real
  // findings (comments or suppressed comments). The parse-fail fallback
  // has both arrays empty AND `parseFailed: true` set, so it's filtered
  // out. Among the surviving chunks, pick the longest summary (real
  // review summaries tend to vary in length and the longest is usually
  // the most informative). If NO chunk contributed findings, fall back
  // to the parse-fail summary as the only honest diagnostic.
  let summarySource: string | null = null;
  let summarySourceLength = -1;
  let fallbackSummary = "";
  for (const outcome of outcomes) {
    const isParseFail = outcome.review.parseFailed === true;
    const hasFindings =
      outcome.review.comments.length > 0 ||
      outcome.review.suppressedComments.length > 0;
    if (isParseFail || !hasFindings) {
      if (outcome.review.summary.length > fallbackSummary.length) {
        fallbackSummary = outcome.review.summary;
      }
      continue;
    }
    if (outcome.review.summary.length > summarySourceLength) {
      summarySource = outcome.review.summary;
      summarySourceLength = outcome.review.summary.length;
    }
  }
  const longestSummary = summarySource ?? fallbackSummary;
  // The merged review is parseFailed only when no chunk contributed
  // real findings — i.e. every chunk was a parse-fail fallback OR was
  // structurally empty (in which case summarySource is null and the
  // fallback summary was used). When at least one chunk succeeded,
  // the merged card has real findings and should NOT be marked
  // parseFailed even if other chunks failed.
  const mergedParseFailed = summarySource === null;

  return {
    review: {
      summary: longestSummary,
      verdict: worstVerdict.length > 0 ? worstVerdict : "COMMENT",
      comments: truncatedComments,
      suppressedComments: sortedSuppressed,
      ...(mergedParseFailed ? { parseFailed: true } : {}),
    },
    endpoint: first.endpoint,
    provider: first.provider,
    modelId: first.modelId,
    // MERGE severity warnings: concatenate each input outcome's warnings
    // (each retains its own providerName + commentIndex, so the consumer
    // can disambiguate per-source attribution). The merge itself does
    // not generate new warnings.
    severityWarnings: outcomes.flatMap((o) => o.severityWarnings),
    // Same pattern for parse warnings (off-diff citations) — each chunk
    // review emits its own set, and the merged outcome surfaces all of
    // them so the parse-warnings.json artifact reflects the full run.
    parseWarnings: outcomes.flatMap((o) => o.parseWarnings),
    // Aggregate verified-facts downgrades across all chunks. Each chunk's
    // filter ran independently against the same diff so we dedup by
    // (index, reason) so a finding flagged in two chunks doesn't double-
    // count in the summary.
    verifiedFactsFilter: aggregateVerifiedFactsFilter(outcomes),
    confidenceFilter: aggregateConfidenceFilter(outcomes),
  };
}
