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

const DEFAULT_MAX_COMMENTS = 50;

/**
 * Severity ranking used by MERGE-2 (sort) and MERGE-3 (dedup
 * keep-highest). Higher = more urgent. Unknown severities rank 0 so
 * they sort last.
 */
function severityRank(severity: string): number {
  switch (severity.toLowerCase()) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

/**
 * Verdict ranking used by MERGE-5 (pick worst). Higher = worse. The
 * umbrella strings (COMMENT / SHIP) are treated as best-effort neutral
 * so the worst signal always wins.
 */
function verdictRank(verdict: string): number {
  switch (verdict.toUpperCase()) {
    case "NEEDS_FIX":
      return 4;
    case "DISCUSS":
      return 3;
    case "COMMENT":
    case "SHIP":
    case "APPROVED":
      return 2;
    default:
      return 0;
  }
}

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
  let worstVerdict = "";
  let worstRank = -1;
  for (const outcome of outcomes) {
    const rank = verdictRank(outcome.review.verdict);
    if (rank > worstRank) {
      worstRank = rank;
      worstVerdict = outcome.review.verdict;
    }
  }

  // MERGE-6: pick the longest summary.
  let longestSummary = "";
  for (const outcome of outcomes) {
    if (outcome.review.summary.length > longestSummary.length) {
      longestSummary = outcome.review.summary;
    }
  }

  return {
    review: {
      summary: longestSummary,
      verdict: worstVerdict.length > 0 ? worstVerdict : "COMMENT",
      comments: truncatedComments,
      suppressedComments: sortedSuppressed,
    },
    endpoint: first.endpoint,
    provider: first.provider,
    modelId: first.modelId,
  };
}
