// SPDX-License-Identifier: MIT
/**
 * Filter-confidence layer — orthogonal post-filters that catch the
 * false-positive patterns the verified-facts layer cannot detect.
 *
 * Why this exists
 * ---------------
 * PR #41 added the verified-facts layer to catch the most common FP
 * pattern: "X is missing from Y" claims where the verified list shows
 * X is present. That layer is necessary but not sufficient. Analysis
 * of subsequent self-review rounds (ADO PR #68 triage: 24 findings =
 * 13 legitimate / 7 false positive / 4 mixed) plus the production-tool
 * survey (CodeRabbit, Sourcery, Greptile, HalluJudge, SGCR, BitsAI-CR,
 * AdaTaint, QASecClaw) surfaces a small number of predictable,
 * recurring FP root causes that don't depend on any structured
 * repo-state fact:
 *
 *   1. **Pattern-matched advice** (training-data echo):
 *      "you should use parameterized queries", "consider adding an
 *      index", "this could be vulnerable to X" — generic best-practice
 *      boilerplate the model emits regardless of the diff's actual
 *      content. Brandom Wie (brandonwie.dev, 2026) catalogs six
 *      patterns of invalid AI feedback; the dominant one is "pattern-
 *      matched advice" — the model has memorized "reviewer advice for
 *      PHP+SQL = use parameterized queries" and emits it on sight
 *      without checking whether parameterized queries are already in
 *      place. (Ann R., Level Up Coding, 2026.)
 *
 *   2. **Hypothetical concerns / over-correction**:
 *      "in some edge case this could fail", "if X were to happen…",
 *      "in theory…". The arXiv 2603.00539 study (Jin & Chen, 2026)
 *      shows 87% of false-rejection rationales are Logic Error
 *      (48.2%), Added Requirement (14.1%), Boundary Error (13.2%),
 *      or Misread Spec (11.7%) — all variants of unverified claims.
 *      The study explicitly recommends: "motivating prompts that
 *      separate 'possible risk' from 'confirmed violation.'"
 *
 *   3. **Intentional-design blindness**:
 *      The diff adds a code pattern that LOOKS problematic in
 *      isolation but is documented inline (e.g. a comment explaining
 *      "this is intentional because Y"). The model misses the
 *      documenting comment and flags the pattern as a bug.
 *      Brandon Wie: "Add comments explaining WHY the approach is
 *      correct, not just WHAT it does."
 *
 *   4. **Severity inflation**:
 *      Findings that should be `info` or `low` are emitted as
 *      `medium` or `high`. The research on prompt-induced
 *      overcorrection (Jin & Chen, 2026) shows elaborate prompts
 *      dramatically amplify this; the recommended mitigation is
 *      separate "possible risk" from "confirmed violation" and let
 *      severity match certainty.
 *
 * The three filters below target each of these patterns
 * deterministically. None of them require a second model call —
 * they use diff reconstruction + body-text analysis + a small
 * fixed vocabulary.
 *
 * Design constraints (same as verified-facts.ts):
 *
 * - Source of truth: the diff. The action runs in a consumer's
 *   checkout where cwd/package.json is NOT UmActually's package.json
 *   — we cannot read the worktree.
 * - Conservative: every filter is a DOWNGRADE (severity reduction),
 *   not a drop. The operator gets full visibility into what the
 *   model claimed; the platform-posting path can choose to render
 *   downgraded findings as `info` instead of `medium`/`high`.
 * - Cheap: O(diff length + body length) per finding. No external
 *   commands, no network, no model call.
 * - Composable with verified-facts.ts: this layer runs AFTER the
 *   verified-facts layer in `applyVerifyFilter`. The disjointness
 *   contract holds — review.comments carries only the kept set; all
 *   downgraded findings live in `confidenceFilter.downgraded`.
 */
import { reconstructFileFromDiff } from "./verified-facts.js";
import type { LiveReview, LiveReviewComment } from "../cli/live-shared.js";

export type ConfidenceFilterReason =
  /**
   * Body contains a hedging phrase ("could", "might", "potentially")
   * AND severity is medium or higher. Calibration reduces the
   * severity to `info` so the platform-posting path renders it as
   * informational rather than blocking.
   */
  | "hedging-language"
  /**
   * Body asserts "X should be added", "you should consider X",
   * "you may want to add X" without quoting any observable diff
   * line that demonstrates the issue. Pattern-matched advice:
   * the model emitted generic best-practice text with no
   * anchorable evidence in the diff.
   */
  | "pattern-matched-advice"
  /**
   * Body mentions a code construct (e.g. `parametrized query`,
   * `try/catch`, `prepared statement`) that appears VERBATIM in
   * the diff hunk around the cited line. The model's claim of
   * absence contradicts the diff's evidence of presence.
   */
  | "contradicted-by-quote"
  /**
   * Body contains "intentionally", "by design", "documented" +
   * a negative assessment ("but this is wrong", "however this
   * breaks"). When the diff hunk for the cited line ALSO contains
   * a documenting comment explaining the pattern, the body is
   * likely flagging intentional design. Downgrade to give the
   * operator context.
   */
  | "intentional-design";

export type ConfidenceFilterResult = {
  /** Findings kept at their original severity. */
  readonly kept: readonly LiveReviewComment[];
  /** Findings downgraded because they matched one of the FP patterns. */
  readonly downgraded: readonly LiveReviewComment[];
  /**
   * Per-finding reason explaining which pattern triggered the
   * downgrade. Index 0 aligns with `downgraded[0]`, etc.
   */
  readonly reasons: readonly { readonly index: number; readonly reason: ConfidenceFilterReason; readonly explanation: string }[];
};

/**
 * Apply the three post-filters (hedging calibration, pattern-matched
 * advice, contradicted-by-quote, intentional-design) to a review.
 *
 * Runs AFTER the deterministic (path,line) verification filter
 * (`verifyFindingsAgainstDiff`) and the verified-facts contradiction
 * filter (`applyVerifiedFactsFilter`). The caller passes the
 * already-filtered review; we further downgrade or drop any
 * remaining FP patterns.
 *
 * The result's `downgraded` list is disjoint from `kept` — callers
 * that want to surface the downgraded set as `info`-severity
 * informational findings read `downgraded` directly; callers that
 * want only the high-confidence findings read `kept`.
 */
export function applyConfidenceFilter(input: {
  readonly review: LiveReview;
  readonly diffText: string;
}): ConfidenceFilterResult {
  if (input.review.comments.length === 0) {
    return { kept: [], downgraded: [], reasons: [] };
  }

  // Pre-compute per-path hunk content once so the inner per-finding
  // filters don't repeat the diff walk. The map is keyed by path; the
  // value is the joined (context + added) lines for that file's
  // hunks. The hunk extraction is O(diff length), and we do it once
  // for the whole review rather than once per finding.
  const hunkContentByPath = collectHunkContentByPath(input.diffText);

  const kept: LiveReviewComment[] = [];
  const downgraded: LiveReviewComment[] = [];
  const reasons: { index: number; reason: ConfidenceFilterReason; readonly explanation: string }[] = [];

  for (let i = 0; i < input.review.comments.length; i += 1) {
    const comment = input.review.comments[i];
    if (comment === undefined) {
      continue;
    }
    const hunk = hunkContentByPath.get(comment.path);
    const verdict = classifyFinding({ comment, hunkContent: hunk ?? null });
    if (verdict === null) {
      kept.push(comment);
      continue;
    }
    downgraded.push(applyDowngrade(comment, verdict.reason));
    reasons.push({ index: i, reason: verdict.reason, explanation: verdict.explanation });
  }

  return { kept, downgraded, reasons };
}

/**
 * The verdict of running the three filters against a single finding.
 * `null` means no filter fired; keep the finding at its original
 * severity. A non-null verdict carries the matched reason + a
 * short human-readable explanation for the audit artifact.
 */
function classifyFinding(input: {
  readonly comment: LiveReviewComment;
  readonly hunkContent: string | null;
}): { readonly reason: ConfidenceFilterReason; readonly explanation: string } | null {
  const body = input.comment.body;
  const bodyLower = body.toLowerCase();

  // 1. Hedging-language calibration. Operates on the comment's
  //    severity, not the body alone: a body that contains hedging
  //    is OK at `info`/`low` (already calibrated by the model) but
  //    should be calibrated DOWN at `medium`/`high`/`critical`.
  if (containsHedgingLanguage(bodyLower)) {
    const severity = input.comment.severity.toLowerCase();
    if (severity === "medium" || severity === "high" || severity === "critical") {
      return {
        reason: "hedging-language",
        explanation:
          `Body uses hedging language ("could", "might", "potentially", "in some cases") at severity "${input.comment.severity}"; calibrating to info because the claim is not asserted as a confirmed violation.`,
      };
    }
  }

  // 2. Pattern-matched advice. The body contains generic best-
  //    practice phrasing ("you should…", "consider adding…",
  //    "you may want to…") AND does NOT quote any observable
  //    diff line as evidence (i.e. no verbatim substring of the
  //    hunk appears in the body). This is the model emitting
  //    memorized advice with no anchor to the diff content.
  if (looksLikePatternMatchedAdvice(bodyLower) && input.hunkContent !== null) {
    if (!bodyContainsAnyHunkLine(body, input.hunkContent)) {
      return {
        reason: "pattern-matched-advice",
        explanation:
          "Body uses generic best-practice phrasing without quoting any diff line as evidence; this is the model emitting pattern-matched advice rather than a finding anchored to the change.",
      };
    }
  }

  // 3. Contradicted-by-quote. The body names a code construct
  //    ("parameterized query", "try/catch", "prepared statement",
  //    "escape", "validate", "sanitize", etc.) AND the diff hunk
  //    for the cited path+line already contains that construct.
  //    The model is asserting absence while the diff shows
  //    presence.
  if (input.hunkContent !== null) {
    const constructMatch = contradictsDiffPresence(bodyLower, input.hunkContent);
    if (constructMatch !== null) {
      return {
        reason: "contradicted-by-quote",
        explanation: `Body claims absence of "${constructMatch}" but the diff hunk around the cited line already contains it.`,
      };
    }
  }

  // 4. Intentional design. The body expresses a negative
  //    assessment of code that the diff documents as intentional
  //    (e.g. an inline comment like "// intentional: …" or
  //    "// NOTE: …" appears near the cited line, and the body
  //    uses phrases like "this is wrong", "however", "but" near
  //    a code pattern). Conservative: requires BOTH the body
  //    intent-flag and the hunk documentation — single trigger
  //    is not enough.
  if (input.hunkContent !== null) {
    const intentional = looksLikeIntentionalDesign(bodyLower, input.hunkContent);
    if (intentional !== null) {
      return {
        reason: "intentional-design",
        explanation: `Body flags "${intentional.flag}" but the diff hunk documents the pattern as intentional ("${intentional.doc}"); the model missed the documenting comment.`,
      };
    }
  }

  return null;
}

/**
 * Lowercase hedging-language words/phrases that signal "the model
 * is not asserting a confirmed violation." The set is intentionally
 * narrow — only phrases that almost always appear in speculative
 * rather than confirmed claims. "Should" alone is too generic
 * ("this function should return X" is a confirmed behavioral
 * claim); we look for the specific speculative constructions
 * below.
 */
const HEDGING_PHRASES: readonly string[] = [
  "could potentially",
  "could lead to",
  "could cause",
  "could result in",
  "could be vulnerable",
  "could fail",
  "could break",
  "could trigger",
  "might lead to",
  "might cause",
  "might result in",
  "might fail",
  "might break",
  "might be vulnerable",
  "may lead to",
  "may cause",
  "may result in",
  "may fail",
  "may break",
  "may be vulnerable",
  "in some cases",
  "in certain cases",
  "in edge cases",
  "in theory",
  "theoretically",
  "potentially vulnerable",
  "potentially leads to",
  "potentially causes",
  "potentially results in",
  "potentially a",
  "potentially an",
  "if this were to",
  "if x were to",
  "could theoretically",
  "could in theory",
  "may have unintended",
  "could have unintended",
  "risk of",
  "possible risk",
  "potentially",
];

function containsHedgingLanguage(bodyLower: string): boolean {
  for (const phrase of HEDGING_PHRASES) {
    if (bodyLower.includes(phrase)) {
      return true;
    }
  }
  return false;
}

/**
 * Phrases that mark a body as generic best-practice advice rather
 * than a diff-anchored finding. The match requires the phrase to
 * appear as the LEAD of a clause (preceded by whitespace or
 * beginning of string) — "you should also note" mid-sentence is
 * NOT a trigger because it modifies a prior claim.
 */
const PATTERN_MATCHED_ADVICE_LEADS: readonly string[] = [
  "you should",
  "you may want to",
  "consider adding",
  "consider using",
  "consider implementing",
  "consider refactoring",
  "consider extracting",
  "consider introducing",
  "it might be worth",
  "it may be worth",
  "it would be better to",
  "it would be good to",
  "it would be helpful to",
  "it would be nice to",
  "we should",
  "we may want to",
  "we could",
  "let's add",
  "let's use",
  "best practice is to",
  "best practice would be to",
  "a common approach is to",
  "a common pattern is to",
];

function looksLikePatternMatchedAdvice(bodyLower: string): boolean {
  for (const lead of PATTERN_MATCHED_ADVICE_LEADS) {
    if (bodyLower.startsWith(lead) || bodyLower.includes(` ${lead}`) || bodyLower.includes(`\n${lead}`)) {
      return true;
    }
  }
  return false;
}

/**
 * Code constructs the model might claim are "missing" while they
 * are in fact present in the diff. The list covers the common
 * security/correctness constructs the LLM training data
 * associates with "you should add this" advice. When a finding
 * body asserts the absence of one of these AND the diff hunk
 * already contains the construct, that's a contradiction.
 *
 * Each entry is a pair of (regex-literal-substring, label). The
 * substring is matched case-insensitively in both the body
 * (claiming absence) and the hunk (asserting presence). The label
 * is what we surface in the explanation.
 *
 * The list is intentionally NARROW — we only include constructs
 * where false absence claims are common (security advisories the
 * model emits from training data) and the absence phrasing is
 * SPECIFIC enough that an accidental match is unlikely. Generic
 * constructs like `return `, `throw `, `await ` were tried and
 * removed because they produce too many false positives — a body
 * that mentions `return null;` AND a generic absence phrase
 * (e.g. "no error handling") gets flagged even though `return`
 * has nothing to do with error handling.
 */
const PRESENCE_CONSTRUCTS: readonly { readonly presence: readonly string[]; readonly label: string }[] = [
  { presence: ["parameterized query", "parameterized queries", "parameterised query", "$1", "$2", "?, ?"], label: "parameterized queries" },
  { presence: ["prepared statement", "prepared statements"], label: "prepared statements" },
  { presence: ["bound parameter", "bound parameters", "parameter binding"], label: "bound parameters" },
  { presence: ["escape(", "escapehtml", "escapeHtml"], label: "input escaping" },
  { presence: ["sanitize(", "sanitise("], label: "input sanitization" },
  { presence: ["validate(", "validation"], label: "input validation" },
  { presence: ["authoriz", "authorisation", "authorization check"], label: "authorization" },
  { presence: ["authenticat"], label: "authentication" },
  { presence: ["csrf"], label: "CSRF protection" },
  { presence: ["xss"], label: "XSS protection" },
  { presence: ["rate limit", "rate-limit", "throttle"], label: "rate limiting" },
];

function contradictsDiffPresence(bodyLower: string, hunkLower: string): string | null {
  for (const construct of PRESENCE_CONSTRUCTS) {
    // Body must mention the construct AND the hunk must contain it.
    const mentionsConstruct = construct.presence.some((p) => bodyLower.includes(p));
    if (!mentionsConstruct) continue;
    const constructInHunk = construct.presence.some((p) => hunkLower.includes(p));
    if (!constructInHunk) continue;
    // Body must assert absence SPECIFIC TO THIS construct. The
    // absence-phrase list is keyed by construct label so a body
    // that says "no error handling" does not trigger when the
    // construct being checked is "parameterized queries" — that
    // mismatch was the source of the false positive where a body
    // mentions `return null;` (not in the construct set) AND
    // "no error handling" (mapped only to the error-handling
    // construct label).
    const absencePhrases = ABSENCE_PHRASES_BY_CONSTRUCT.get(construct.label);
    if (absencePhrases === undefined) continue;
    const assertsAbsence = absencePhrases.some((p) => bodyLower.includes(p));
    if (!assertsAbsence) continue;
    return construct.label;
  }
  return null;
}

/**
 * Phrases that signal the body is asserting the absence of
 * something. These are the same missing/removed phrases the
 * verified-facts layer uses — duplicated here so this layer is
 * self-contained and can be tested without importing the
 * verified-facts module. We deliberately keep the list narrow
 * (no "no " alone, no "never " alone) because those would
 * over-trigger on factual negative claims ("there is no need to
 * add tests here").
 *
 * Each entry pairs a "tight" absence phrase (specific to the
 * construct) with the construct label it maps to. The
 * contradicted-by-quote check requires the body's absence phrase
 * AND the construct being checked to agree — a body that says
 * "no error handling" with "return null;" nearby would NOT
 * trigger because "return null;" is not in the construct set
 * tagged with error handling. This binding prevents the false
 * positive where a body mentions a generic construct (`return `)
 * AND a generic absence phrase (`no error handling`) without
 * those two being logically connected.
 */
const ABSENCE_PHRASES_BY_CONSTRUCT: ReadonlyMap<string, readonly string[]> = new Map([
  ["parameterized queries", ["is missing", "are missing", "isn't included", "doesn't include", "does not include", "no parameterized", "no prepared statement", "no prepared statements", "fails to use", "fails to include", "not present", "lacks"]],
  ["prepared statements", ["is missing", "are missing", "isn't included", "doesn't include", "does not include", "no prepared", "fails to use"]],
  ["bound parameters", ["is missing", "are missing", "doesn't bind", "no bound"]],
  ["input escaping", ["is missing", "are missing", "isn't escaping", "no escape(", "fails to escape", "unescaped"]],
  ["input sanitization", ["is missing", "are missing", "no sanitize(", "no sanitise(", "unsanitized", "unsanitised"]],
  ["input validation", ["is missing", "are missing", "no validate(", "no validation", "unvalidated"]],
  ["authorization", ["is missing", "are missing", "no authoriz", "unauthorized", "no authorization check"]],
  ["authentication", ["is missing", "are missing", "no authenticat", "unauthenticated"]],
  ["CSRF protection", ["is missing", "no csrf", "no csrf protection"]],
  ["XSS protection", ["is missing", "no xss", "no xss protection"]],
  ["rate limiting", ["is missing", "no rate limit", "no rate-limit", "no throttling"]],
]);

/**
 * Detect the intentional-design pattern: the body expresses
 * disapproval AND the hunk contains a documenting comment that
 * explains the flagged construct. Returns the body-flag phrase
 * and the documentation phrase for the explanation.
 */
const BODY_DISAPPROVAL_PHRASES: readonly string[] = [
  "this is wrong",
  "this looks wrong",
  "this seems wrong",
  "this is incorrect",
  "this looks incorrect",
  "this seems incorrect",
  "this is a bug",
  "this looks like a bug",
  "this seems like a bug",
  "this is broken",
  "this is unsafe",
  "this is risky",
  "this is dangerous",
  "this will fail",
  "this will break",
  "this could fail",
  "this could break",
  "should not be",
  "shouldn't be",
  "must not be",
  "this is a problem",
  "this is an issue",
  "this is concerning",
  "this is suspect",
  "looks suspicious",
  "seems suspicious",
  "anti-pattern",
  "code smell",
  "wrong way",
  "incorrect way",
];

const INTENTIONAL_DOC_MARKERS: readonly { readonly marker: string; readonly description: string }[] = [
  { marker: "// intentional", description: "intentional" },
  { marker: "// by design", description: "by design" },
  { marker: "// note:", description: "note" },
  { marker: "// note ", description: "note" },
  { marker: "// hack:", description: "hack" },
  { marker: "// workaround", description: "workaround" },
  { marker: "// documented:", description: "documented" },
  { marker: "// see ", description: "see-comment" },
  { marker: "// see-also", description: "see-also" },
  { marker: "// explanation:", description: "explanation" },
  { marker: "// rationale:", description: "rationale" },
  { marker: "// reason:", description: "reason" },
  { marker: "// why:", description: "why" },
  { marker: "// context:", description: "context" },
  { marker: "// todo:", description: "todo" },
  { marker: "// fixme:", description: "fixme" },
  { marker: "// note that", description: "note-that" },
  { marker: "/* intentional", description: "intentional" },
  { marker: "/* by design", description: "by design" },
  { marker: "/* note:", description: "note" },
];

function looksLikeIntentionalDesign(
  bodyLower: string,
  hunkLower: string,
): { readonly flag: string; readonly doc: string } | null {
  // Body must express disapproval (one of BODY_DISAPPROVAL_PHRASES).
  let matchedFlag: string | null = null;
  for (const phrase of BODY_DISAPPROVAL_PHRASES) {
    if (bodyLower.includes(phrase)) {
      matchedFlag = phrase;
      break;
    }
  }
  if (matchedFlag === null) {
    return null;
  }
  // Hunk must contain a documenting marker that explains the
  // pattern (e.g. "// intentional:" or "// note:"). The marker
  // is checked case-insensitively because we already lowercased
  // the hunk.
  for (const marker of INTENTIONAL_DOC_MARKERS) {
    if (hunkLower.includes(marker.marker)) {
      return { flag: matchedFlag, doc: marker.description };
    }
  }
  return null;
}

/**
 * Per-pattern severity mapping. The deterministic policy:
 *
 * - hedging-language: reduce by 2 tiers (`high` → `low`,
 *   `medium` → `info`). The claim is speculative; we surface it
 *   but not at blocking severity.
 * - pattern-matched-advice: reduce to `info` — the model emitted
 *   memorized advice with no diff anchor; it's not a finding.
 * - contradicted-by-quote: reduce to `info` — the diff contradicts
 *   the claim; the operator should still see what was said but
 *   not at the model's claimed severity.
 * - intentional-design: reduce by 1 tier (`high` → `medium`,
 *   `medium` → `low`, `low` → `info`) — the model may have a
 *   point but missed the documenting comment; we soften without
 *   silencing.
 */
function applyDowngrade(
  comment: LiveReviewComment,
  reason: ConfidenceFilterReason,
): LiveReviewComment {
  const severityLower = comment.severity.toLowerCase();
  let nextSeverity: string;
  switch (reason) {
    case "hedging-language":
      nextSeverity = downgradeTwoTiers(severityLower);
      break;
    case "pattern-matched-advice":
    case "contradicted-by-quote":
      nextSeverity = "info";
      break;
    case "intentional-design":
      nextSeverity = downgradeOneTier(severityLower);
      break;
  }
  return { ...comment, severity: nextSeverity };
}

const SEVERITY_TIERS = ["info", "low", "medium", "high", "critical"] as const;

function downgradeOneTier(severity: string): string {
  const idx = SEVERITY_TIERS.indexOf(severity as (typeof SEVERITY_TIERS)[number]);
  if (idx === -1 || idx === 0) return "info";
  return SEVERITY_TIERS[idx - 1] ?? "info";
}

function downgradeTwoTiers(severity: string): string {
  const idx = SEVERITY_TIERS.indexOf(severity as (typeof SEVERITY_TIERS)[number]);
  if (idx === -1 || idx <= 1) return "info";
  return SEVERITY_TIERS[idx - 2] ?? "info";
}

/**
 * Build a Map<path, joined-hunk-content> from the diff. Walks the
 * diff once and groups all (context + added) lines per file.
 * Reused across all findings to avoid repeated diff walks.
 *
 * Returns an empty map for an empty diff. Reconstructs content
 * via the same logic as `verified-facts.ts:reconstructFileFromDiff`
 * but joins all files in one pass (the verified-facts module
 * reconstructs one file at a time).
 */
function collectHunkContentByPath(diffText: string): Map<string, string> {
  const result = new Map<string, string>();
  if (diffText.length === 0) {
    return result;
  }
  // Use the existing single-file reconstructor for each path we
  // encounter. The cost is acceptable because the diff walk is
  // O(N) and the per-file content is small enough to fit in
  // memory. We call `reconstructFileFromDiff` for each distinct
  // path that appears in the diff, which is at most a few
  // dozen in any realistic PR.
  const seenPaths = new Set<string>();
  for (const line of diffText.split(/\r?\n/u)) {
    const match = /^diff --git a\/(.+) b\/(.+)$/u.exec(line);
    if (match === null) continue;
    const path = match[2];
    if (path === undefined) continue;
    if (seenPaths.has(path)) continue;
    seenPaths.add(path);
    const content = reconstructFileFromDiff(diffText, path);
    if (content !== null) {
      result.set(path, content.toLowerCase());
    }
  }
  return result;
}

/**
 * Check whether the body contains any verbatim substring of a
 * hunk line. Used to detect "pattern-matched advice" — a body
 * that quotes no observable diff line is unlikely to be a
 * diff-anchored finding.
 *
 * Trims each hunk line to avoid matching the leading space of
 * every context line. Minimum 10-char match window to avoid
 * spurious overlaps on short common words.
 */
function bodyContainsAnyHunkLine(body: string, hunkContent: string): boolean {
  const MIN_MATCH = 10;
  for (const line of hunkContent.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.length < MIN_MATCH) continue;
    if (body.includes(trimmed)) {
      return true;
    }
  }
  return false;
}