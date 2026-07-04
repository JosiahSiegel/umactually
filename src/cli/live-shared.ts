import { parseDiffPositions } from "../diff/parse-positions.js";
import { REVIEW_MARKER } from "../review/run-review.js";
import { scanReviewSecrets } from "../security/scan-review-secrets.js";
import type { Platform } from "../config/types.js";
import { DEFAULT_MAX_COMMENTS } from "../config/defaults.js";
import { REDACTED_SECRET_TOKEN } from "../util/brand.js";
import { truncateBodyForLog } from "../util/http.js";
import { isPositiveSafeInteger, isRecord, isSafeInteger } from "../util/json-guards.js";
import { MANIFEST_SCHEMA } from "../util/marker.js";
import { countBySeverity as countBySeverityUtil, SEVERITY_ORDER, severityRank } from "../util/severity.js";
import { mapVerdictToAzureStatus, mapVerdictToGithubEvent } from "../util/verdict.js";
import type { ParsedCliArgs } from "./parse-args.js";

export type FetchImpl = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

/** Live-path platform (after auto-resolution). Mirrors `Platform` minus "auto". */
export type LivePlatform = Exclude<Platform, "auto">;

export type LiveRunResult = {
  readonly exitCode: number;
  readonly posted: boolean;
  readonly reviewId: number | undefined;
  readonly message: string;
};

export type LiveReviewComment = {
  readonly path: string;
  readonly line: number;
  readonly body: string;
  readonly severity: string;
  readonly category: string;
};

export type LiveReview = {
  readonly summary: string;
  readonly verdict: string;
  /**
   * Pre-filter finding count. Includes comments the model produced that may be
   * filtered out by severity policy, off-diff suppression, or `ignore-minor`.
   * Use this for the "Considered" metric in the parent card.
   */
  readonly comments: readonly LiveReviewComment[];
  readonly suppressedComments: readonly LiveReviewComment[];
  /**
   * True when the provider returned a non-JSON / unparseable response and
   * we fell back to `buildMalformedProviderFallback`. CRITICAL for the
   * Posted/Considered/Suppressed row — when true, the reader sees a
   * distinct "parse failed" badge so a 0-finding review cannot be
   * mistaken for a clean bill of health. The fallback path renders the
   * raw provider text in a collapsed <details> block for diagnostics.
   *
   * Defaults to false. Only the malformed-fallback path sets this.
   */
  readonly parseFailed?: boolean;
};

/**
 * A provider outcome is structurally empty when it carries no inline comments
 * AND no suppressed comments. Used by `simulate-findings` to decide whether
 * the live result should be replaced with the deterministic fixture.
 */
export function isStructurallyEmptyReview(review: LiveReview): boolean {
  return review.comments.length === 0 && review.suppressedComments.length === 0;
}

export type LiveProviderOutcome = {
  readonly review: LiveReview;
  readonly endpoint: string;
  readonly provider: string;
  readonly modelId: string;
};

export class LiveReviewError extends Error {
  override readonly name = "LiveReviewError";

  constructor(readonly code: string, message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export type LeakGateResult =
  | { readonly ok: true; readonly leakCount: 0 }
  | { readonly ok: false; readonly leakCount: number; readonly message: string };

/**
 * Gate that refuses to post when high-confidence secrets are detected in the
 * diff. This is the runtime side of `identify leaks` — the scanner counts
 * leaks and redacts the diff, but the gate enforces that no provider response
 * can leak secrets through the posted review body. `detect-leaks: false`
 * bypasses the gate (operator opt-out).
 */
export async function evaluateLeakGate(input: {
  readonly diffText: string;
  readonly detectLeaks: boolean;
}): Promise<LeakGateResult> {
  if (!input.detectLeaks) {
    return { ok: true, leakCount: 0 };
  }
  const report = await scanReviewSecrets({
    diffText: input.diffText,
    expectedArtifact: "artifacts/manual/s5-redaction-report.json",
  });
  if (report.highConfidenceLeakCount === 0) {
    return { ok: true, leakCount: 0 };
  }
  return {
    ok: false,
    leakCount: report.highConfidenceLeakCount,
    message: `Refusing to post: ${report.highConfidenceLeakCount} high-confidence secret(s) detected in the diff. Set --no-detect-leaks to override (NOT recommended).`,
  };
}

/**
 * Visual verdict badge used in the review-header summary. Both GitHub and
 * Azure DevOps render markdown, so the same badge appears on each platform.
 *
 * CLARITY-14f: When the model said `NEEDS_FIX` but no findings are
 * actionable (zero posted + zero suppressed), the verdict is
 * downgraded to `💬 DISCUSS` rather than `⛔ NEEDS_FIX`. Showing
 * `NEEDS_FIX` for a card that lists zero items to fix is misleading —
 * a reviewer would search the diff for things to act on, find nothing,
 * and lose trust in the verdict signal. `DISCUSS` is the right
 * semantic: there's nothing to fix, but the review is not a clean
 * bill of health either (the model said something is wrong; we just
 * can't surface what).
 */
function verdictBadge(input: {
  readonly verdict: string;
  readonly validCommentCount: number;
  readonly suppressedCommentCount: number;
}): string {
  const normalized = input.verdict.toUpperCase();
  const nothingActionable =
    input.validCommentCount === 0 && input.suppressedCommentCount === 0;
  if (normalized === "NEEDS_FIX" && !nothingActionable) return "⛔ NEEDS_FIX";
  if (normalized === "APPROVED" || normalized === "SHIP") return "✅ SHIP";
  return "💬 DISCUSS";
}

/**
 * Group comments by severity (low/medium/high/critical). Used by both the
 * GitHub and Azure review-header builders so the collapsed details block
 * reports the same severity tally regardless of platform.
 *
 * Delegates to `src/util/severity.ts` so the live path and the merge path
 * agree on the exact same lowercase-accumulation logic. Was previously a
 * local copy that drifted subtly from `live-merge.ts`'s version.
 */
export const countBySeverity = countBySeverityUtil;

/**
 * Hard upper bound on the inline-finding preview list inside the parent
 * "Top concerns" <details> block. Keeps the parent card from being
 * dominated by a long list when the provider returns many findings.
 */
const TOP_CONCERNS_PREVIEW_LIMIT = 5;

function countsLine(input: {
  readonly severityCounts: Record<string, number>;
}): string {
  const parts: string[] = [];
  let total = 0;
  for (const level of SEVERITY_ORDER) {
    const count = input.severityCounts[level] ?? 0;
    total += count;
    parts.push(`\`${count}\` ${level}`);
  }
  // CLARITY-14c: when there are zero findings across all severities,
  // hide the tally entirely. A row of `📊 0 critical · 0 high · 0
  // medium · 0 low` adds nothing for a reviewer who's scanning the
  // card for actionable info — and it explicitly duplicates the "0
  // inline" footer count when nothing was posted.
  if (total === 0) {
    return "";
  }
  return `📊 ${parts.join(" · ")}`;
}

/**
 * Build the "Top concerns" <details> block. Shows a preview of the
 * highest-severity findings the MODEL produced (pre-filter — this is
 * NOT the same set as the inline threads posted). The summary line
 * explicitly says "from model (N of Z)" so the reader knows this is
 * the pre-filter list. Hidden by default so it does not push the
 * severity tally below the fold.
 *
 * CLARITY-11: when `validCommentCount === 0` but `consideredCount > 0`,
 * the pre-filter findings were ALL filtered out (severity policy,
 * max-comments cap, or off-diff suppression). The block must make this
 * explicit so the reader doesn't confuse "0 posted + N concerns
 * listed" with a clean bill of health. We re-label the header as
 * "Filtered findings" and prefix the body with a one-line explanation
 * of *why* nothing was posted.
 */
function topConcernsBlock(input: {
  readonly review: LiveReview;
  readonly validCommentCount: number;
}): string {
  const sorted = [...input.review.comments].sort((a, b) => {
    const ra = severityRank(a.severity);
    const rb = severityRank(b.severity);
    if (ra !== rb) return rb - ra;
    return a.path.localeCompare(b.path);
  });
  const preview = sorted.slice(0, TOP_CONCERNS_PREVIEW_LIMIT);
  if (preview.length === 0) {
    return "";
  }
  const total = input.review.comments.length;
  const shown = preview.length;
  const filteredAll = input.validCommentCount === 0 && total > 0;
  // CLARITY-14g: drop "from model" suffix — the block IS the model
  // output, so labeling it "from model" is redundant. Use plain
  // "Top concerns (N)" when findings landed and "Filtered findings
  // (N of Z shown)" when none landed.
  const header = filteredAll
    ? shown === 1
      ? `🔕 Filtered finding (1 of ${total} shown)`
      : `🔕 Filtered findings (${shown} of ${total} shown)`
    : shown === 1
      ? `📋 Top concern (1)`
      : `📋 Top concerns (${shown})`;
  const explainer = filteredAll
    ? `\n_The model produced ${total} finding(s); all were filtered by severity policy, the \`max-comments\` cap, or off-diff suppression. The list below is the pre-filter view for transparency — no inline comments were posted._\n`
    : "";
  const lines = preview.map((comment, index) => {
    const safeBody = sanitizeForPost(comment.body, []);
    const oneLiner = safeBody.replace(/\s+/gu, " ").trim();
    const bodySnippet = oneLiner.length > 120 ? `${oneLiner.slice(0, 117)}…` : oneLiner;
    return `${index + 1}. \`${comment.path}:${comment.line}\` — ${bodySnippet}`;
  });
  return [
    "<details>",
    `<summary>${header}</summary>`,
    "",
    explainer.trimStart(),
    lines.join("\n"),
    "</details>",
    "",
  ].join("\n");
}

/**
 * Build the "Suppressed (off-diff)" <details> block. Lists every
 * comment the system suppressed because its line is not on the diff.
 * Hidden by default — only the count is visible above the fold.
 */
function suppressedBlock(input: {
  readonly suppressedComments: readonly LiveReviewComment[];
  readonly offDiffFromComments: readonly LiveReviewComment[];
}): string {
  const combined = [...input.suppressedComments, ...input.offDiffFromComments];
  if (combined.length === 0) {
    return "";
  }
  const header = combined.length === 1
    ? "🔕 Suppressed (off-diff, 1)"
    : `🔕 Suppressed (off-diff, ${combined.length})`;
  const lines = combined.map((comment) => {
    const safeBody = sanitizeForPost(comment.body, []);
    const oneLiner = safeBody.replace(/\s+/gu, " ").trim();
    const bodySnippet = oneLiner.length > 100 ? `${oneLiner.slice(0, 97)}…` : oneLiner;
    return `- \`${comment.path}:${comment.line}\` — ${bodySnippet}`;
  });
  return [
    "<details>",
    `<summary>${header}</summary>`,
    "",
    lines.join("\n"),
    "</details>",
    "",
  ].join("\n");
}

/**
 * Wrap the provider's prose summary in a collapsed <details> block so
 * the counts line stays in the first viewport. CLARITY-4 pins this
 * contract: long prose MUST live inside <details>, not inline.
 *
 * If the summary already starts with an HTML <details> block (the
 * malformed-fallback path includes a raw-response <details>), the
 * summary is used verbatim — wrapping it in another <details> would
 * be confusing.
 */
function proseBlock(summary: string): string {
  const trimmed = summary.trim();
  if (trimmed.length === 0) {
    return "";
  }
  // If the summary already contains a <details> block (parse-fail
  // fallback), surface it as-is under the "📝 Summary" toggle.
  if (trimmed.startsWith("<details>") || trimmed.includes("\n<details>")) {
    return [
      "<details>",
      "<summary>📝 Summary</summary>",
      "",
      trimmed,
      "</details>",
      "",
    ].join("\n");
  }
  return [
    "<details>",
    "<summary>📝 Summary</summary>",
    "",
    trimmed,
    "</details>",
    "",
  ].join("\n");
}

function metadataManifest(input: {
  readonly review: LiveReview;
  readonly provider: string;
  readonly modelId: string;
  readonly validCommentCount: number;
  readonly suppressedCommentCount: number;
  readonly severityCounts: Record<string, number>;
}): string {
  const manifest = JSON.stringify({
    schema: MANIFEST_SCHEMA,
    verdict: input.review.verdict,
    provider: input.provider,
    modelId: input.modelId,
    inlineCount: input.validCommentCount,
    suppressedCount: input.suppressedCommentCount,
    severityCounts: input.severityCounts,
    ...(input.review.parseFailed === true ? { parseFailed: true } : {}),
  });
  return `<!-- umactually-pr-review:manifest ${manifest} -->`;
}

/**
 * Build the body of the overall review (GitHub review body or Azure thread
 * starter comment). Both platforms must produce an equivalent contract so AI
 * agents and humans see the same information regardless of platform.
 *
 * Clarity-first shape (CLARITY-* contract in
 * test/unit/live-azure-parent-clarity.test.ts):
 *
 *   1. Stable HTML marker (used for dedup)
 *   2. Verdict badge — large, first thing after the marker
 *   3. Posted / Considered / Suppressed row — three labeled counts that
 *      tell the reviewer what actually landed, what the model produced,
 *      and what was rejected (off-diff). CLARITY-9.
 *   4. Severity tally — emoji + backticks for critical → high → medium → low
 *      immediately after the verdict, so a reviewer sees the per-severity
 *      split within the first viewport. The `info` level is excluded here
 *      (intentionally — info findings are not actionable) which is why the
 *      "Considered" count above is the authoritative total.
 *   5. Top-concerns <details> — preview of the highest-severity findings
 *      the MODEL produced (pre-filter). The summary line explicitly says
 *      "from model (N of Z)" so the reader knows this is pre-filter, not
 *      a duplicate of the "Posted" count.
 *   6. Suppressed <details> — list of off-diff findings
 *   7. Prose summary <details> — long provider narrative, hidden by default
 *   8. Footer — model + provider + inline-thread count, small text
 *   9. Hidden HTML comment with the JSON manifest for AI agents
 *
 * The shape is identical regardless of verdict, finding count, or whether
 * the provider returned a parse-fail fallback — that consistency is what
 * lets a reviewer scan the card in 5 seconds.
 */
export function buildReviewBody(input: {
  readonly review: LiveReview;
  readonly provider: string;
  readonly modelId: string;
  readonly validCommentCount: number;
  readonly suppressedCommentCount: number;
  /**
   * Findings from `review.comments` whose `path:line` is NOT on the diff.
   * Rendered alongside `review.suppressedComments` so the
   * `🔕 Suppressed (off-diff, N)` block lists every finding the row
   * counts — see CLARITY-13. Required parameter; pass `[]` when the
   * caller has no off-diff findings to surface.
   */
  readonly offDiffFromComments: readonly LiveReviewComment[];
  /**
   * Severity distribution of the POSTED comments (i.e. the comments
   * that survived `selectPostableComments` filtering). Used for both
   * the rendered tally and the manifest's `severityCounts` so they
   * agree by construction. Callers MUST compute this from the same set
   * that produced `validCommentCount`; computing from `review.comments`
   * is a CLARITY-15 violation (tally would over-report by the number
   * of filtered-out findings).
   */
  readonly severityCounts: Record<string, number>;
  readonly secrets: readonly string[];
}): string {
  const verdict = verdictBadge({
    verdict: input.review.verdict,
    validCommentCount: input.validCommentCount,
    suppressedCommentCount: input.suppressedCommentCount,
  });
  const safeSummary = sanitizeForPost(input.review.summary, input.secrets);
  const safeModelId = sanitizeForPost(input.modelId, input.secrets);
  const safeProvider = sanitizeForPost(input.provider, input.secrets);

  // CLARITY-14: Actionable-only card. Build the body section-by-section,
  // skipping sections that don't apply to the current review shape:
  //   - Parse-failed banner — only when parseFailed
  //   - Off-diff inline note — only when suppressed > 0
  //   - Severity tally — only when at least one finding has a severity
  //   - Top concerns / filtered findings — only when comments exist
  //   - Suppressed details — only when suppressed > 0
  //   - Summary <details> — only when summary is non-empty
  // The result is a card that scales with the review: a clean review is
  // 3 lines (marker + verdict + footer); a busy review shows everything.
  const parseFailedBanner = input.review.parseFailed === true
    ? `> ⚠️ \`Parse failed\` — provider response was not a valid JSON review payload. The raw provider text is included in the Summary section below for diagnostics.\n`
    : "";
  const offDiffNote =
    input.suppressedCommentCount > 0
      ? `> 🔕 ${input.suppressedCommentCount} off-diff finding${input.suppressedCommentCount === 1 ? " was" : "s were"} not on this PR's diff.\n`
      : "";
  const tally = countsLine({ severityCounts: input.severityCounts });
  const topConcerns = topConcernsBlock({
    review: input.review,
    validCommentCount: input.validCommentCount,
  });
  const suppressed = suppressedBlock({
    suppressedComments: input.review.suppressedComments,
    offDiffFromComments: input.offDiffFromComments,
  });

  // CLARITY-14e: terse footer — `X inline` is enough; the verbose
  // "X inline thread(s) posted" adds noise without information.
  const footer =
    `🤖 Generated by \`${safeModelId}\` via \`${safeProvider}\` · ` +
    `${input.validCommentCount} inline`;

  // Assemble sections. Each section is "" if it doesn't apply, so we
  // join with `\n\n` and trim trailing blanks.
  const sections: string[] = [
    REVIEW_MARKER,
    "",
    `## ${verdict}`,
    "",
    parseFailedBanner,
    offDiffNote,
    tally,
    topConcerns,
    suppressed,
    proseBlock(safeSummary),
    footer,
    "",
    metadataManifest({
      review: input.review,
      provider: input.provider,
      modelId: input.modelId,
      validCommentCount: input.validCommentCount,
      suppressedCommentCount: input.suppressedCommentCount,
      severityCounts: input.severityCounts,
    }),
  ];

  const raw = sections.filter((s) => s.length > 0).join("\n");
  return sanitizeForPost(raw, input.secrets);
}

/**
 * Build a single inline-comment body. Both GitHub review comments and Azure
 * DevOps thread comments use the same shape:
 *   1. [optional] Stable marker
 *   2. Severity + category badges
 *   3. Body text (or fallback placeholder when empty)
 *   4. [optional] A parent-review reference line so humans reading the PR
 *      can correlate the inline finding with the parent summary card.
 */
export function buildInlineCommentBody(input: {
  readonly comment: LiveReviewComment;
  readonly secrets: readonly string[];
  readonly includeMarker?: boolean;
  readonly parentThreadId?: number;
}): string {
  const safeSeverity = sanitizeForPost(input.comment.severity.toLowerCase(), input.secrets);
  const safeCategory = sanitizeForPost(input.comment.category, input.secrets);
  const safePath = sanitizeForPost(input.comment.path, input.secrets);
  const fallback = `Finding at ${safePath}:${input.comment.line}.`;
  const safeBody = input.comment.body.length > 0
    ? sanitizeForPost(input.comment.body, input.secrets)
    : sanitizeForPost(fallback, input.secrets);
  const marker = input.includeMarker === true ? `${REVIEW_MARKER}\n` : "";
  const parentRef =
    isPositiveSafeInteger(input.parentThreadId)
      ? `> Reply to PR review summary #${input.parentThreadId}\n\n`
      : "";
  return `${marker}${parentRef}\`${safeSeverity}\` \`${safeCategory}\`\n\n${safeBody}`;
}

/**
 * Hard upper bound on the raw provider text we include in a parse-fail
 * fallback body. Keeps the parent PR-level summary card from being filled
 * with an unbounded provider response if the model misbehaves.
 */
/**
 * Total character budget for the parse-fail diagnostic block. The block
 * shows BOTH the head (provider's opening metadata events) and the tail
 * (the final `response.completed` event with `output_text`) so reviewers
 * can see what the model began with AND where it ended up — not just
 * whichever end happened to land first. CLARITY-12.
 *
 * 4000 chars is enough to capture metadata (~400 chars) plus a typical
 * model review (~2000-3500 chars of JSON) without truncation; long reviews
 * get head+tail with a quantifier in the middle.
 */
const MALFORMED_PROVIDER_FALLBACK_RAW_MAX = 4000;
/** Size of each end-piece (head / tail) when the raw text exceeds the budget. */
const MALFORMED_PROVIDER_FALLBACK_HALF_BUDGET = Math.floor(
  MALFORMED_PROVIDER_FALLBACK_RAW_MAX / 2,
);

/**
 * Build a head + tail diagnostic snippet from a long rawText, with a
 * quantifier showing exactly how many chars were omitted in the middle.
 * Used by the parse-fail body so reviewers can see both ends of the
 * stream — typically the opening `response.created`/`response.in_progress`
 * metadata events AND the final `response.completed` with `output_text`.
 *
 * Truncates on a newline boundary where possible so the head/tail pieces
 * end cleanly. If no newline exists within the last 80 chars of the head
 * budget, falls back to a hard cut (better than dropping content silently).
 *
 * @param rawText  Full raw provider response body
 * @param halfBudget  Number of chars to take from each end
 * @returns  Head + quantifier + tail string suitable for the diagnostic block
 */
function truncateHeadAndTail(rawText: string, halfBudget: number): string {
  if (rawText.length <= halfBudget * 2) {
    return rawText;
  }
  const head = trimToNewline(rawText.slice(0, halfBudget), "head");
  const tail = trimToNewline(rawText.slice(rawText.length - halfBudget), "tail");
  const omitted = rawText.length - head.length - tail.length;
  return `${head}\n\n… [${omitted} chars omitted] …\n\n${tail}`;
}

/**
 * Trim a head/tail piece to the nearest clean line so the snippet
 * doesn't end mid-string. For the head, finds the LAST newline in the
 * piece (so we cut cleanly before the next event). For the tail, finds
 * the FIRST newline that starts a "real" line (skipping the leading
 * newline that sits at the start of the tail slice).
 */
function trimToNewline(piece: string, end: "head" | "tail"): string {
  if (end === "head") {
    // For head: trim to the last newline. Everything after the last
    // newline within the head piece is a partial line — drop it.
    const lastNewline = piece.lastIndexOf("\n");
    if (lastNewline === -1) {
      return piece;
    }
    return piece.slice(0, lastNewline);
  }
  // For tail: the first char of the tail slice is often a newline
  // (because we cut at a line boundary in the original stream). Skip
  // past leading whitespace + newlines to land on the first real
  // character of the tail content.
  let i = 0;
  while (i < piece.length && (piece[i] === "\n" || piece[i] === " " || piece[i] === "\r")) {
    i += 1;
  }
  return piece.slice(i);
}

/**
 * Build a `LiveReview` to use when the provider returned a non-JSON or
 * unparseable response. Returns `verdict: "COMMENT"` with zero findings
 * and a summary that names the model + provider. The raw provider text is
 * included so reviewers can diagnose the failure without leaving the PR.
 *
 * `buildReviewBody` will fold this summary into the parent PR-level card
 * along with a collapsed `<details>` block containing the raw provider
 * text — see the helper for the exact rendering.
 */
export function buildMalformedProviderFallback(input: {
  readonly provider: string;
  readonly modelId: string;
  readonly rawText: string;
  readonly secrets: readonly string[];
}): LiveReview {
  const safeProvider = sanitizeForPost(input.provider, input.secrets);
  const safeModelId = sanitizeForPost(input.modelId, input.secrets);
  // CLARITY-12: show head + tail with a quantifier in the middle so the
  // diagnostic captures both the opening events and the final
  // response.completed output_text — not just whichever end happened
  // to fit in the first N chars. The previous "first N chars only"
  // truncation hid the actual response.completed event, leading
  // reviewers to incorrectly conclude the model returned only metadata.
  const truncated = input.rawText.length > MALFORMED_PROVIDER_FALLBACK_RAW_MAX
    ? truncateHeadAndTail(input.rawText, MALFORMED_PROVIDER_FALLBACK_HALF_BUDGET)
    : input.rawText;
  const safeRaw = sanitizeForPost(truncated, input.secrets);

  const detailsBlock = [
    "<details>",
    "<summary>📨 Raw provider response (truncated)</summary>",
    "",
    "```text",
    safeRaw.length > 0 ? safeRaw : "(empty)",
    "```",
    "",
    `Provider: \`${safeProvider}\` · Model: \`${safeModelId}\``,
    "</details>",
    "",
  ].join("\n");

  // Note: the summary intentionally does NOT include a "Generated by"
  // footer — `buildReviewBody` emits that footer in its own block so
  // this fallback path would otherwise show the same metadata twice.
  return {
    summary: `Provider response did not contain a valid JSON review payload.\n\n${detailsBlock}`,
    verdict: "COMMENT",
    comments: [],
    suppressedComments: [],
    parseFailed: true,
  };
}

/**
 * Fallback review when the PR's diff touches more than
 * `reviewFileLimit` files. We skip the chunked review path entirely
 * and surface a clear "diff too large to review" verdict rather than
 * feeding the LLM arbitrarily-large per-file chunks (which produces
 * hallucinated findings that look substantive but aren't grounded in
 * the code).
 *
 * The user can override the cap via `--review-file-limit N` (or
 * `REVIEW_FILE_LIMIT=N`) — set to 0 to disable the limit and accept
 * whatever the model produces.
 */
export function buildTooLargeFallback(input: {
  readonly fileCount: number;
  readonly reviewFileLimit: number;
  readonly provider: string;
  readonly modelId: string;
  readonly secrets: readonly string[];
}): LiveReview {
  const safeProvider = sanitizeForPost(input.provider, input.secrets);
  const safeModelId = sanitizeForPost(input.modelId, input.secrets);
  const summary = [
    `This PR changes \`${input.fileCount}\` files, which is more than the configured \`--review-file-limit\` of \`${input.reviewFileLimit}\`.`,
    "",
    "Live review is intentionally skipped on very large diffs because the per-chunk LLM reviews produce hallucinated findings that aren't grounded in the code.",
    "",
    "**To enable review on this PR:**",
    "",
    `- Raise the limit: \`--review-file-limit ${input.fileCount}\` (or set \`REVIEW_FILE_LIMIT=${input.fileCount}\`).`,
    "- Or split this PR into smaller PRs.",
    "",
    "The merge gate is unaffected — this is a review-quality choice, not a policy decision.",
    "",
    `Provider: \`${safeProvider}\` · Model: \`${safeModelId}\``,
  ].join("\n");
  return {
    summary,
    verdict: "COMMENT",
    comments: [],
    suppressedComments: [],
  };
}

export function selectPostableComments(input: {
  readonly review: LiveReview;
  readonly diffText: string;
  readonly parsed: ParsedCliArgs;
  readonly secrets: readonly string[];
}): readonly LiveReviewComment[] {
  const positions = parseDiffPositions(input.diffText);
  const maxComments = input.parsed.maxComments ?? DEFAULT_MAX_COMMENTS;
  const comments: LiveReviewComment[] = [];
  for (const comment of input.review.comments) {
    if (comments.length >= maxComments) {
      break;
    }
    if (!positions.hasPosition(comment)) {
      continue;
    }
    if (!passesSeverityPolicy(comment, input.parsed)) {
      continue;
    }
    comments.push({
      ...comment,
      body: sanitizeForPost(comment.body, input.secrets),
    });
  }
  return comments;
}

export function selectOffDiffComments(
  review: LiveReview,
  diffText: string,
): readonly LiveReviewComment[] {
  const positions = parseDiffPositions(diffText);
  return review.comments.filter((comment) => !positions.hasPosition(comment));
}

export function countSuppressedComments(review: LiveReview, diffText: string): number {
  return review.suppressedComments.length + selectOffDiffComments(review, diffText).length;
}

/**
 * Map a review verdict to a GitHub review-submission event. Delegates to
 * `src/util/verdict.ts` so the merge-path verdict-rank table and the
 * live-path event mapping share the same canonical definitions.
 */
export const mapReviewVerdictToGithubEvent: (verdict: string) => "COMMENT" | "REQUEST_CHANGES" =
  mapVerdictToGithubEvent;

/**
 * Map a review verdict to an Azure DevOps PR-status `state` value.
 *
 * State values per Microsoft Learn:
 *   https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-statuses/create?view=azure-devops-rest-7.1
 *   "State of the status."  (notSet | pending | succeeded | failed | error | notApplicable)
 *
 * Policy (current — same as the live CLI):
 *   - A failing UmActually review is a **finding**, not a merge-blocking
 *     check. The merge gate is owned by the ADO branch-policy build
 *     validation check (which runs the actual CI pipeline and is
 *     independent of verdict semantics). Mapping `NEEDS_FIX` to
 *     `"failed"` used to make the Checks panel light up red even when
 *     the underlying build succeeded — that is the visual problem this
 *     function fixes.
 *   - `pending` means "the check ran; here is something the human
 *     should look at". APPROVED / COMMENT / DISCUSS / SHIP all
 *     indicate the CLI ran cleanly, so we collapse those to
 *     `"succeeded"` and reserve `"pending"` for "ran and found things
 *     to look at" (`NEEDS_FIX`) plus the safe-default fallthrough.
 *
 * Delegates to `src/util/verdict.ts` with the `"current"` policy so the
 * legacy S4 RED-contract mapping (NEEDS_FIX → "failed") stays in one
 * place and is selectable per call site.
 */
export const mapReviewVerdictToAzureStatus: (verdict: string) => "succeeded" | "failed" | "pending" = (
  verdict: string,
) => mapVerdictToAzureStatus(verdict, "current");

export function sanitizeForPost(value: string, secrets: readonly string[]): string {
  let sanitized = value
    .replace(/Authorization:\s*[^\r\n]*/giu, "[REDACTED_AUTHORIZATION_HEADER]")
    .replace(/\bBearer\s+\S+/giu, "[REDACTED_BEARER_TOKEN]");
  for (const secret of secrets) {
    if (secret.length > 0) {
      sanitized = sanitized.split(secret).join(REDACTED_SECRET_TOKEN);
    }
  }
  return sanitized;
}

export async function readTextResponse(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    throw new LiveReviewError("HTTP_RESPONSE_READ_FAILED", "Failed to read REST response body.", { cause: error });
  }
}

export async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await readTextResponse(response);
  if (text.length === 0) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new LiveReviewError("HTTP_JSON_PARSE_FAILED", "REST response was not valid JSON.", { cause: error });
    }
    throw error;
  }
}

export function readResponseId(value: unknown): number | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const id = value["id"];
  return isSafeInteger(id) ? id : undefined;
}

export function ensureHttpOk(response: Response, code: string, action: string): void {
  if (response.ok) {
    return;
  }
  // Capture the response body so the thrown error includes enough context
  // for the operator to diagnose 4xx/5xx without re-running the build.
  // We best-effort read the body: it may already be consumed by a prior
  // `readJsonResponse` call, in which case the text will be empty and the
  // diagnostic will fall back to a generic message.
  void response
    .clone()
    .text()
    .then((text) => {
      if (text.length === 0) {
        return;
      }
      // Surface the server-side error message on stderr for operators;
      // the thrown LiveReviewError keeps its short public form.
      const snippet = truncateBodyForLog(text, 500);
      process.stderr.write(`::debug::umactually-pr-review: ${action} HTTP ${response.status} body=${snippet}\n`);
    })
    .catch(() => {
      // Body read failed; nothing actionable to do here.
    });
  throw new LiveReviewError(code, `${action} failed with HTTP ${response.status}.`);
}

export { isRecord };

function passesSeverityPolicy(comment: LiveReviewComment, parsed: ParsedCliArgs): boolean {
  if (parsed.ignoreMinor && comment.severity.toLowerCase() === "low") {
    return false;
  }
  const minimum = parsed.minimumSeverity;
  if (minimum === null) {
    return true;
  }
  return severityRank(comment.severity) >= severityRank(minimum);
}
