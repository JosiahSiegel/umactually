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
 * Detect a verified-facts contradiction in a finding body.
 *
 * Heuristic: if the body contains a "missing from X" phrase and X is
 * one of our known verified lists (package.json#files,
 * action.yml#outputs), check whether any quoted token in the body
 * appears in that list. If a token IS in the list, the body is
 * contradicting a verified fact (e.g. "dist is missing from files"
 * when dist is in files).
 *
 * Returns a human-readable reason if a contradiction is detected,
 * otherwise null.
 */
function detectVerifiedFactsContradiction(
  body: string,
  facts: import("../review/verified-facts.js").VerifiedFacts,
): string | null {
  const lower = body.toLowerCase();
  const hasMissingPhrase = MISSING_PHRASES.some((p) => lower.includes(p));
  if (!hasMissingPhrase) {
    return null;
  }
  // Try to match the body against known lists. We extract candidate
  // tokens (quoted strings, plus a few common ones) and check each
  // against the verified lists.
  const tokens = extractCandidateTokens(body);
  if (facts.packageJsonFiles !== null && facts.packageJsonFiles.files.length > 0) {
    for (const token of tokens) {
      if (facts.packageJsonFiles.files.includes(token)) {
        return `body claims "${token}" is missing from package.json#files, but the verified list includes "${token}"`;
      }
    }
  }
  if (facts.actionOutputs !== null && facts.actionOutputs.outputKeys.length > 0) {
    for (const token of tokens) {
      if (facts.actionOutputs.outputKeys.includes(token)) {
        return `body claims "${token}" output was removed, but the verified list of action.yml#outputs includes "${token}"`;
      }
    }
  }
  return null;
}

/**
 * Extract candidate tokens from a finding body for contradiction
 * checking. We pull quoted strings, backticked identifiers, common
 * bareword file names, AND every standalone identifier in the body.
 * The identifier pass catches tokens like "marker" that aren't quoted
 * or wrapped in backticks but are exactly the keys we want to match
 * against verified lists (e.g. action.yml#outputs keys, package.json
 * files entries).
 */
function extractCandidateTokens(body: string): readonly string[] {
  const tokens = new Set<string>();
  // Quoted strings: "foo", 'foo', `foo`
  const quoted = body.matchAll(/["'`]([^"'`\s]{1,40})["'`]/gu);
  for (const m of quoted) {
    if (m[1] !== undefined) {
      tokens.add(m[1]);
    }
  }
  // Backtick-wrapped paths: `dist/`, `dist/index.js`, `bin/foo.mjs`
  const backticked = body.matchAll(/`([a-zA-Z0-9_./-]+)`/gu);
  for (const m of backticked) {
    if (m[1] !== undefined) {
      tokens.add(m[1]);
    }
  }
  // Common bareword patterns: "dist/", "bin/", "node_modules/", "dist"
  const barewords = body.matchAll(/\b(dist|bin|node_modules|action\.yml|package\.json|README|LICENSE|docs|examples|scripts|src|test)\b/gu);
  for (const m of barewords) {
    if (m[1] !== undefined) {
      tokens.add(m[1]);
    }
  }
  // All standalone identifiers (word chars + hyphens). This is the
  // broad pass that catches output keys like "marker", "marker_text",
  // "inline_count", etc., without us having to enumerate them. We
  // filter out common English stop-words to avoid spurious matches.
  const stopwords = new Set([
    "the", "a", "an", "and", "or", "but", "if", "then", "else", "when",
    "while", "for", "of", "to", "in", "on", "at", "by", "is", "are",
    "was", "were", "be", "been", "being", "have", "has", "had", "do",
    "does", "did", "will", "would", "should", "could", "may", "might",
    "can", "this", "that", "these", "those", "with", "from", "into",
    "about", "between", "through", "during", "before", "after", "above",
    "below", "out", "off", "over", "under", "again", "further", "once",
    "here", "there", "where", "why", "how", "all", "any", "both", "each",
    "few", "more", "most", "other", "some", "such", "no", "nor", "not",
    "only", "own", "same", "so", "than", "too", "very", "just", "still",
    "now", "it", "its", "they", "them", "their", "we", "our", "you",
    "your", "downstream", "consumers", "consumers", "depends",
    "depend", "depends", "include", "includes", "including",
    "outputs", "output", "input", "inputs", "value", "field",
    "block", "entry", "entries", "list", "array", "key", "keys",
    "consumers",
  ]);
  const allIds = body.matchAll(/[A-Za-z][A-Za-z0-9_-]*/gu);
  for (const m of allIds) {
    const word = m[0];
    if (word === undefined || word.length < 2) continue;
    if (stopwords.has(word.toLowerCase())) continue;
    if (word.length > 40) continue; // skip very long matches (probably paths/sentences)
    tokens.add(word);
  }
  return Array.from(tokens);
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
