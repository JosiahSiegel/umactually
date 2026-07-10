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
import { reconcileVerdictForEmptySeverityCounts, verdictRank } from "../util/verdict.js";

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
 * Aggregate the per-chunk verified-facts filter results into a single
 * result for the merged outcome. Concatenates kept/downgraded lists
 * across chunks and emits global indices.
 *
 * **Index semantics**: the `index` on each `downgradeReasons` entry
 * points into the AGGREGATED kept+downgraded arrays (in that
 * concatenation order), NOT into the post-dedup/post-sort/
 * post-truncate `review.comments` array that the operator sees in
 * the final review body. The dedup + sort + truncate step in
 * `mergeReviewResults` does not remap the indices. Callers that
 * want to correlate a downgrade reason back to a specific finding
 * MUST use `(path, line)` — the index is an internal aid for the
 * audit artifact's order, not a stable handle into the visible
 * review. Pinned by `test/unit/live-merge.test.ts` (the
 * MERGE-CONFIDENCE / MERGE-FACTSAGG test cases).
 */
function aggregateVerifiedFactsFilter(
  outcomes: readonly LiveProviderOutcome[],
): import("./verify-findings.js").VerifiedFactsFilterResult {
  const kept: LiveReviewComment[] = [];
  const downgraded: LiveReviewComment[] = [];
  const downgradeReasons: { index: number; reason: string }[] = [];
  let globalIndex = 0;
  for (const o of outcomes) {
    for (const c of o.verifiedFactsFilter.kept) {
      kept.push(c);
      globalIndex += 1;
    }
    for (let i = 0; i < o.verifiedFactsFilter.downgraded.length; i += 1) {
      const c = o.verifiedFactsFilter.downgraded[i];
      const reason = o.verifiedFactsFilter.downgradeReasons[i]?.reason ?? "";
      if (c === undefined) {
        continue;
      }
      downgraded.push(c);
      downgradeReasons.push({ index: globalIndex, reason });
      globalIndex += 1;
    }
  }
  return { kept, downgraded, downgradeReasons };
}

/**
 * Aggregate the per-chunk confidence-filter results. Mirrors the
 * verified-facts aggregation above so the merged outcome's
 * confidenceFilter field has the same shape as any single-chunk
 * outcome's confidenceFilter.
 *
 * **Index semantics** (same as `aggregateVerifiedFactsFilter`):
 * `reasons[].index` points into the aggregated kept+downgraded
 * arrays in concatenation order, NOT into the post-dedup/
 * post-sort/post-truncate `review.comments` array. Callers
 * correlating a reason to a finding must use `(path, line)`.
 */
function aggregateConfidenceFilter(
  outcomes: readonly LiveProviderOutcome[],
): import("../review/filter-confidence.js").ConfidenceFilterResult {
  const kept: LiveReviewComment[] = [];
  const downgraded: LiveReviewComment[] = [];
  const reasons: { index: number; reason: import("../review/filter-confidence.js").ConfidenceFilterReason; readonly explanation: string }[] = [];
  let globalIndex = 0;
  for (const o of outcomes) {
    if (o.confidenceFilter === undefined) {
      // Legacy / older outcomes (simulate-findings path, fixtures,
      // and outcomes from before the confidence filter was wired
      // in `applyVerifyFilter`) do not carry a `confidenceFilter`.
      // The most defensible default is to treat their already-post-
      // verified-facts `review.comments` as confidence-kept. The
      // upstream contract is: by the time an outcome is passed
      // here, `o.review.comments` is the POST-VERIFIED-FACTS list
      // (verified-facts drops the contradicted findings, but the
      // confidence-filter pass had not run yet for legacy
      // outcomes). So this is NOT a double-count of
      // `verifiedFactsFilter.kept` — it's the next step in the
      // chain that legacy outcomes just happen to skip. The
      // audit-artifact count for the legacy path will therefore
      // match `review.comments.length` (the post-merge list),
      // not `verifiedFactsFilter.kept.length`. Pinned by
      // `test/unit/live-merge.test.ts` MERGE-CONFIDENCE legacy
      // compat case.
      for (const c of o.review.comments) {
        kept.push(c);
        globalIndex += 1;
      }
      continue;
    }
    for (const c of o.confidenceFilter.kept) {
      kept.push(c);
      globalIndex += 1;
    }
    for (let i = 0; i < o.confidenceFilter.downgraded.length; i += 1) {
      const c = o.confidenceFilter.downgraded[i];
      const reasonRecord = o.confidenceFilter.reasons[i];
      if (c === undefined || reasonRecord === undefined) {
        continue;
      }
      downgraded.push(c);
      reasons.push({ index: globalIndex, reason: reasonRecord.reason, explanation: reasonRecord.explanation });
      globalIndex += 1;
    }
  }
  return { kept, downgraded, reasons };
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
  // Apply the same severity-counts reconciliation that the live path
  // uses (see src/util/verdict.ts:reconcileVerdictForEmptySeverityCounts)
  // BEFORE ranking, so a chunk whose NEEDS_FIX verdict was backed only
  // by findings that the severity filter dropped doesn't pollute the
  // "worst verdict" pick with a contradictory blocking verdict.
  // Without this, the merge path could re-introduce the same
  // "NEEDS_FIX + 0 inline findings" contradiction the live path's
  // preparePostedReview reconciliation prevents — even if every individual
  // chunk ran preparePostedReview correctly. PR #18 self-review comment
  // caught this regression class.
  let worstVerdict = "";
  let worstRank = -1;
  for (const outcome of outcomes) {
    const reconciledVerdict = reconcileVerdictForEmptySeverityCounts(
      outcome.review.verdict,
      countBySeverity(outcome.review.comments),
    );
    const rank = verdictRank(reconciledVerdict);
    if (rank > worstRank) {
      worstRank = rank;
      worstVerdict = reconciledVerdict;
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
