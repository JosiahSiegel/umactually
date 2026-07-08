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
 *   - MERGE-6: the merged `summary` is the LONGEST input summary —
 *     longest text tends to be the most informative prose, which is
 *     what a reviewer wants to read in the parent card.
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
  };
}
