/**
 * Layer 4: two-pass verification (opt-in via `--verify-findings`).
 *
 * After the first model call returns a review, run a small per-finding
 * verification pass that asks the model to copy the diff lines that
 * justify each finding. Findings where the model cannot produce a
 * supporting quote are dropped before posting.
 *
 * Per the citation-grounding research:
 *   - SWR-Bench (1000 PRs): multi-pass aggregation gives +43.7% F1
 *   - HalluJudge (Atlassian production): Tree-of-Thoughts verifier
 *     F1 = 0.85, $0.009/comment
 *   - CodeRabbit: explicit "verification agent" before posting
 *   - Ellipsis: Generate-then-Filter architecture; filter rejects
 *     findings the generator cannot ground in evidence
 *
 * This implementation is intentionally narrow: a single cheap
 * verification call per finding, with a strict JSON schema that
 * only permits `verified: true|false` + the supporting quote (or
 * empty quote for unverified). The findings list is processed in
 * order; a verified=true flag is kept, anything else is dropped.
 *
 * Off by default. The cost is roughly 2x the per-PR review cost
 * (a small per-finding call). For high-stakes repos that need the
 * extra accuracy, opt in via `--verify-findings`.
 */
import { parseDiffPositions } from "../diff/parse-positions.js";
import type { LiveReviewComment, LiveReview } from "./live-shared.js";

export type VerifiedFinding = {
  readonly original: LiveReviewComment;
  readonly verified: boolean;
  /** The exact diff line(s) the model cited as evidence. Empty if unverified. */
  readonly supportingQuote: string;
};

export type VerificationResult = {
  /** Comments the verification pass kept (verified=true). */
  readonly verified: readonly LiveReviewComment[];
  /** Comments the verification pass dropped (verified=false or no quote). */
  readonly dropped: readonly LiveReviewComment[];
};

/**
 * Pure post-filter that drops findings whose (path, line) doesn't anchor
 * to the supplied diff. This is the deterministic verification — the
 * cheap path that runs WITHOUT a second model call. The `--verify-findings`
 * flag adds an additional model-based check on top.
 *
 * Useful as a standalone entry point for callers that want the
 * deterministic filter without the model overhead (e.g. tests,
 * dry-run, smoke tests).
 */
export function verifyFindingsAgainstDiff(input: {
  readonly review: LiveReview;
  readonly diffText: string;
}): VerificationResult {
  const positions = parseDiffPositions(input.diffText);
  const verified: LiveReviewComment[] = [];
  const dropped: LiveReviewComment[] = [];
  for (const comment of input.review.comments) {
    if (positions.hasPosition(comment)) {
      verified.push(comment);
    } else {
      dropped.push(comment);
    }
  }
  return { verified, dropped };
}

/**
 * Model-based verification. Sends a per-finding prompt to the same
 * provider, asking the model to copy the diff lines that justify
 * each finding. Findings where the model returns `verified: false`
 * or an empty `quote` are dropped.
 *
 * Not yet wired into the live flow — the `requestLiveReview` and
 * `runGithubLive` / `runAzureLive` paths would need to call this
 * after the first model response and before posting. Wiring is
 * tracked as a follow-up: this function exists so callers can
 * opt in via a higher-level orchestration, and the deterministic
 * `verifyFindingsAgainstDiff` covers the common case.
 */
export async function verifyFindingsWithModel(input: {
  readonly review: LiveReview;
  readonly diffText: string;
  /**
   * Batched verifier: receives ALL findings and returns a verified-or-
   * dropped decision for each. Implementations typically send one
   * per-finding prompt to the model and return the decisions in the
   * same order as `review.comments`.
   */
  readonly verifier: (input: { readonly systemPrompt: string; readonly userPrompt: string; readonly findings: readonly LiveReviewComment[] }) => Promise<readonly VerifiedFinding[]>;
}): Promise<VerificationResult> {
  const systemPrompt = "You are a strict reviewer verifying that each finding is supported by the diff. Return JSON { verified: boolean, quote: string } for each.";
  const userPrompt = [
    "Verify each finding against the diff below. Copy the EXACT diff lines that justify it into `quote`. If the diff does not support the finding, return verified: false with quote: \"\".",
    ...input.review.comments.map((c, i) => `Finding ${i + 1}: path=${c.path} line=${c.line} body=${c.body}`),
    "",
    "Diff:",
    input.diffText,
  ].join("\n\n");
  const result = await input.verifier({
    systemPrompt,
    userPrompt,
    findings: input.review.comments,
  });
  const verified: LiveReviewComment[] = [];
  const dropped: LiveReviewComment[] = [];
  // Walk in lockstep with the input comments so the verifier's
  // decision for finding N maps to review.comments[N].
  for (let i = 0; i < input.review.comments.length; i += 1) {
    const comment = input.review.comments[i];
    const verdict = result[i];
    if (comment === undefined) {
      continue;
    }
    if (verdict !== undefined && verdict.verified && verdict.supportingQuote.length > 0) {
      verified.push(comment);
    } else {
      dropped.push(comment);
    }
  }
  return { verified, dropped };
}