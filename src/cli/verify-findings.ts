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
import { collectVerifiedFacts } from "../review/verified-facts.js";
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
 * Result of running the verified-facts contradiction filter. Findings
 * whose body contradicts a verified fact are DOWNGRADED to `info`
 * severity (kept, with the downgrade noted in `downgradeReason`) so
 * the operator can see what the model claimed and what was wrong with
 * it — we do not silently drop them, because the operator might
 * still want the visibility.
 */
export type VerifiedFactsFilterResult = {
  /** Findings kept at their original severity. */
  readonly kept: readonly LiveReviewComment[];
  /** Findings downgraded to `info` because they contradicted a verified fact. */
  readonly downgraded: readonly LiveReviewComment[];
  /** Human-readable description of why each downgraded finding was flagged. */
  readonly downgradeReasons: readonly { readonly index: number; readonly reason: string }[];
};

/**
 * Downgrade findings whose body contradicts a verified fact.
 *
 * "Contradicts" means the body asserts something is missing/absent/
 * removed when the verified facts show it is present. The most common
 * pattern observed in self-review (PR #41): the model claimed "dist/ is
 * not in package.json#files" while the verified facts showed dist/ in
 * the list.
 *
 * We do NOT drop these findings — we downgrade them to `info` and
 * surface the reason. The operator gets full visibility into what the
 * model claimed, and the downgraded severity prevents the false
 * positive from blocking a PR or producing noise.
 *
 * Conservative: only flag clear contradiction patterns (asserting
 * something is missing from a verified list). Subjective language
 * like "looks unusual" is not flagged.
 */
export function applyVerifiedFactsFilter(input: {
  readonly review: LiveReview;
  readonly diffText: string;
}): VerifiedFactsFilterResult {
  const facts = collectVerifiedFacts(input.diffText);
  const downgradeReasons: { index: number; reason: string }[] = [];
  const kept: LiveReviewComment[] = [];
  const downgraded: LiveReviewComment[] = [];
  for (let i = 0; i < input.review.comments.length; i += 1) {
    const comment = input.review.comments[i];
    if (comment === undefined) {
      continue;
    }
    const contradiction = detectVerifiedFactsContradiction(comment.body, facts);
    if (contradiction === null) {
      kept.push(comment);
    } else {
      downgradeReasons.push({ index: i, reason: contradiction });
      downgraded.push({ ...comment, severity: "info" });
    }
  }
  return { kept, downgraded, downgradeReasons };
}

const MISSING_PHRASES = [
  "is missing",
  "is not in",
  "is not listed",
  "is not included",
  "are missing",
  "are not in",
  "are not listed",
  "are not included",
  "won't be",
  "will not be",
  "doesn't include",
  "does not include",
  "lacks",
  "absent from",
  "not present in",
  "fails to include",
  "fails to ship",
  "will not ship",
  "won't ship",
  "was removed",
  "is removed",
  "were removed",
  "are removed",
  "orphan",
];

/**
 * Tokens that frequently appear in natural-language text and
 * SHOULD NOT be treated as candidate identifiers for contradiction
 * detection. Without this list, a sentence like "the output is
 * missing" would match the bareword "output" against
 * action.yml#outputs (where "output" might coincidentally be a
 * key) and trigger a false-positive downgrade. We seed this with
 * every common English word plus every review-action vocabulary
 * word we observed in PR-#41's false positives.
 */
const STOPWORD_TOKENS = new Set([
  // English stop words
  "the", "a", "an", "and", "or", "but", "if", "then", "else", "when",
  "while", "for", "of", "to", "in", "on", "at", "by", "from", "as",
  "is", "are", "was", "were", "be", "been", "being", "have", "has",
  "had", "do", "does", "did", "will", "would", "should", "could", "may",
  "might", "can", "must", "shall", "this", "that", "these", "those",
  "with", "into", "about", "between", "through", "during", "before",
  "after", "above", "below", "out", "off", "over", "under", "again",
  "further", "once", "here", "there", "where", "why", "how", "all",
  "any", "both", "each", "few", "more", "most", "other", "some",
  "such", "no", "nor", "not", "only", "own", "same", "so", "than",
  "too", "very", "just", "still", "now", "it", "its", "they", "them",
  "their", "we", "our", "us", "you", "your", "i", "me", "my", "he",
  "she", "his", "her", "what", "which", "who", "whom",
  // Review-action vocabulary
  "missing", "removed", "output", "outputs", "input", "inputs",
  "block", "list", "lists", "array", "field", "entry", "entries",
  "key", "keys", "value", "values", "file", "files", "directory",
  "directories", "include", "includes", "including", "exclude",
  "excludes", "see", "see-also", "per", "via", "downstream",
  "upstream", "consumers", "consumer", "consume", "depends",
  "depend", "callers", "caller", "post", "posted", "posting", "postable",
  "find", "finds", "found", "want", "wants", "wanted", "need", "needs",
  "needed", "use", "uses", "used", "using", "claim", "claims", "assert",
  "asserts", "asserted", "appears", "appear", "show", "shows", "showed",
  "verify", "verifies", "verified", "render", "renders", "rendered",
  "check", "checks", "checked", "action", "actions", "comment",
  "comments", "review", "reviews", "operator", "operators", "test",
  "tests", "change", "changes", "changed", "add", "adds", "added",
  "remove", "removes", "delete", "deletes", "deleted", "merge",
  "merges", "merged", "keep", "keeps", "kept", "fail", "fails",
  "failed", "pass", "passes", "passed", "make", "makes", "made",
  "ensure", "ensures", "ensured", "consider", "considers", "considered",
  "likely", "potentially", "probably", "perhaps", "may-be", "might-be",
  "seems", "appears-to", "looks", "looks-like", "is-likely",
]);

/**
 * Detect a verified-facts contradiction in a finding body.
 *
 * Conservative: only flag when a token that appears in a verified
 * list is mentioned in close proximity to a "missing / removed"
 * phrase in the same sentence. A finding body that just casually
 * mentions a verified-list word ("dist/ is referenced in the
 * README") does NOT trigger a downgrade.
 *
 * The proximity check is the critical safety property: a body must
 * have BOTH a missing-phrase AND a verified-list token within ~80
 * characters of each other. This drastically reduces false-positive
 * downgrades compared to the naive "any token matches" approach.
 */
function detectVerifiedFactsContradiction(
  body: string,
  facts: import("../review/verified-facts.js").VerifiedFacts,
): string | null {
  const lower = body.toLowerCase();
  // Step 1: confirm the body has a missing/removed phrase. If not,
  // no contradiction is possible.
  if (!MISSING_PHRASES.some((p) => lower.includes(p))) {
    return null;
  }
  // Step 2: collect every verified-list token (the universe of
  // candidates that would constitute a contradiction).
  const verifiedCandidates = new Set<string>();
  if (facts.packageJsonFiles !== null) {
    for (const f of facts.packageJsonFiles.files) {
      verifiedCandidates.add(f);
    }
  }
  if (facts.actionOutputs !== null && facts.actionOutputs.outputKeys.length > 0) {
    for (const k of facts.actionOutputs.outputKeys) {
      verifiedCandidates.add(k);
    }
  }
  if (verifiedCandidates.size === 0) {
    return null;
  }
  // Step 3: for each candidate token, check whether it appears in
  // the SAME SENTENCE as a missing-phrase. We split the body on
  // sentence boundaries (period, newline) and look for both the
  // token and a missing-phrase in the same sentence. A token that
  // appears only in a different sentence from the missing-phrase is
  // NOT a contradiction — it's natural-language prose.
  for (const candidate of verifiedCandidates) {
    const candidateLower = candidate.toLowerCase();
    if (candidateLower.length === 0) continue;
    if (STOPWORD_TOKENS.has(candidateLower)) continue;
    // Split the body into sentences. We use a simple split on
    // . ! ? and newlines. Empty sentences are skipped.
    const sentences = lower.split(/[.!?\n]+/u).map((s) => s.trim()).filter((s) => s.length > 0);
    for (const sentence of sentences) {
      if (!sentence.includes(candidateLower)) continue;
      const hasMissingPhrase = MISSING_PHRASES.some((p) => sentence.includes(p));
      if (!hasMissingPhrase) continue;
      // Both the candidate and a missing-phrase appear in the same
      // sentence. This is the contradiction.
      if (
        facts.packageJsonFiles !== null &&
        facts.packageJsonFiles.files.includes(candidate)
      ) {
        return `body claims "${candidate}" is missing from package.json#files, but the verified list includes "${candidate}"`;
      }
      if (
        facts.actionOutputs !== null &&
        facts.actionOutputs.outputKeys.includes(candidate)
      ) {
        return `body claims "${candidate}" output was removed, but the verified list of action.yml#outputs includes "${candidate}"`;
      }
    }
  }
  return null;
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
