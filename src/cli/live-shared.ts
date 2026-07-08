import { parseDiffPositions } from "../diff/parse-positions.js";
import { REVIEW_MARKER } from "../util/marker.js";
import { scanReviewSecrets } from "../security/scan-review-secrets.js";
import type { Platform } from "../config/types.js";
import { DEFAULT_MAX_COMMENTS } from "../config/defaults.js";
import {
  BRAND_PREFIX,
  REDACTED_AUTHORIZATION_HEADER,
  REDACTED_BEARER_TOKEN,
  REDACTED_SECRET_TOKEN,
} from "../util/brand.js";
import { truncateBodyForLog } from "../util/http.js";
import type { FetchImpl } from "../util/http.js";
import { isPositiveSafeInteger, isRecord, isSafeInteger } from "../util/json-guards.js";
import { renderSummary, type LayoutId, type ReviewData as LayoutReviewData } from "../render/summary-layouts.js";
import { countBySeverity as countBySeverityUtil } from "../util/severity.js";
import { mapVerdictToAzureStatus, mapVerdictToGithubEvent, reconcileVerdictForEmptySeverityCounts } from "../util/verdict.js";
import { shouldKeepFinding } from "../config/severity.js";
import type { Severity } from "../config/types.js";
import { normalizeProviderSeverity } from "../provider/provider-parse.js";
import type { ProviderComment } from "../provider/provider-parse.js";
import type { ParsedCliArgs } from "./parse-args.js";

export type { FetchImpl };

/** Live-path platform (after auto-resolution). Mirrors `Platform` minus "auto". */
export type LivePlatform = Exclude<Platform, "auto">;

export type LiveRunResult = {
  readonly exitCode: number;
  readonly posted: boolean;
  readonly reviewId: number | undefined;
  readonly message: string;
  /** Counts from the live review, surfaced for the self-review guard's
   *  artifact-write path. Optional because legacy callers (failed
   *  pre-review paths) don't have a review to count. */
  readonly inlineThreadCount?: number;
  readonly suppressedCommentCount?: number;
  readonly verdict?: string;
  /**
   * True when the provider returned a non-JSON / unparseable response
   * and the review was posted using the malformed-provider fallback.
   * The live-posting paths set this AND return `exitCode: 1` so CI
   * fails on parse failures rather than silently passing. The review
   * is still posted (so the operator can see the diagnostic on the
   * PR), but the Action exit code is non-zero so branch policies and
   * `if: failure()` steps can react.
   */
  readonly parseFailed?: boolean;
  /**
   * Off-diff citation warnings the LLM emitted. Threaded from the
   * provider outcome through the orchestrator into the artifact-write
   * path so the parse-warnings.json sibling artifact records every
   * fabrication event. Empty when the model's citations all anchored
   * to the supplied diff.
   */
  readonly parseWarnings?: readonly import("./parse-warnings.js").ParseWarning[];
};

export type LiveReviewComment = ProviderComment;

export type LiveReview = {
  readonly summary: string;
  readonly verdict: string;
  /**
   * Pre-filter finding count. Includes comments the model produced that may be
   * filtered out by severity policy or off-diff suppression.
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
  /**
   * Why the parse failed, when `parseFailed === true`. Distinguishes
   * "stream was truncated" (actionable: raise --max-output-tokens and
   * retry) from "completed but malformed" (model regression, file a
   * bug). Carried on `LiveReview` so downstream consumers (the summary
   * layout, the manifest, any future layout) can render a reason-
   * specific badge without re-parsing the raw provider text.
   */
  readonly parseFailureReason?: ParseFailureReason;
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
  /**
   * Structured records of every severity-value mismatch the parser saw
   * for this request. Empty when every comment carried a canonical
   * 5-tier severity. Populated by `live-provider.ts` capturing
   * warnings from the ambient severity sink installed via
   * `setActiveSeveritySink` for the duration of the request.
   *
   * NOT yet rendered in any summary layout — plumbed here so a follow-up
   * can surface it in the footer without re-plumbing the parser.
   */
  readonly severityWarnings: readonly import("../provider/provider-parse.js").SeverityWarning[];
  /**
   * Structured records of every comment the model emitted whose
   * (path, line) does not anchor to the supplied diff. Built by
   * `parse-warnings.ts:collectParseWarnings` so the artifact captures
   * LLM citation hallucination rather than silently dropping it
   * into the suppressed count. See `parse-warnings.test.ts` for the
   * PR #56 regression test that locks the 8-fabrication count.
   */
  readonly parseWarnings: readonly import("./parse-warnings.js").ParseWarning[];
};

/**
 * The shape returned by {@link preparePostedReview}: the in-diff comments
 * eligible for inline posting, the off-diff comments that surface only in
 * the manifest, the suppressed count, the severity tally, the rendered
 * review body, and the posted-comment set (currently the same as the
 * postable set, but kept distinct for future divergence).
 */
export interface PreparedPostedReview {
  readonly postableComments: readonly LiveReviewComment[];
  readonly offDiffFromComments: readonly LiveReviewComment[];
  readonly suppressedCommentCount: number;
  readonly severityCounts: Record<string, number>;
  readonly body: string;
  readonly postedComments: readonly LiveReviewComment[];
  /**
   * The verdict that callers should publish to user-facing surfaces
   * (review body badge, manifest payload, GitHub review event, Azure
   * PR status). Reconciled from the model's raw verdict against the
   * postable severity counts via
   * `reconcileVerdictForEmptySeverityCounts` — so a NEEDS_FIX review
   * whose findings were all severity-filtered out surfaces as
   * `COMMENT` instead of contradicting the `📊 0 inline findings`
   * body. See `src/util/verdict.ts` for the rule.
   */
  readonly effectiveVerdict: string;
}

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
 * Group comments by severity (low/medium/high/critical). Re-exported here
 * because external callers import this helper from `live-shared.ts`.
 * Do not remove without updating all callers. Delegates to
 * `src/util/severity.ts` so the live path and the merge path agree on
 * the exact same lowercase-accumulation logic.
 */
export const countBySeverity = countBySeverityUtil;

/**
 * Build the body of the overall review (GitHub review body or Azure thread
 * starter comment). Both platforms must produce an equivalent contract so AI
 * agents and humans see the same information regardless of platform.
 *
 * Implementation: delegates to the `severity-table` layout defined in
 * `src/render/summary-layouts.ts` (one of the 20 alternatives surfaced
 * during the layout review — see the local viewer at
 * `scripts/view-summary-layouts.mjs` for the full design sheet and
 * baseline comparison). The other 19 layouts are still reachable via
 * `renderSummary(layout, data)` for callers that want a different
 * visual personality; this function is the single wired default.
 *
 * Contract invariants preserved across the cutover:
 *   - Stable HTML marker (used for dedup) — first line of body
 *   - Verdict badge — second line, large H2
 *   - 🏷️ Severity tally — `critical → high → medium → low` distribution
 *     of the POSTED set, hidden when all zeros
  *   - Stable `<!-- umactually-pr-review:manifest {…} -->` for AI agents
 *   - Same byte-for-byte output on GitHub and Azure (parity invariant)
 *   - Secret redaction applied to every rendered string
 *
 * Changes vs the legacy builder:
 *   - No more `📋 Posted preview` / `🧹 Filtered preview` / `📍 Off-diff`
 *     `<details>` blocks — the severity-table layout shows the full
 *     findings list inline so reviewers don't need to click to expand
 *     to see what the review actually said. Off-diff + filtered are
 *     summarized in the manifest (still machine-readable) rather than
 *     rendered as separate hidden blocks.
 *   - No more `<details>` for the summary prose — the new layout
 *     surfaces the summary inline (small paragraph), since the
 *     findings table is already collapsed-style.
 *   - Body stays under GitHub's 65,536-char limit (enforced by
 *     `test/unit/summary-layouts.test.ts`).
 *
 * CLARITY-* contract notes:
 *   - CLARITY-1 (verdict first): preserved.
 *   - CLARITY-2 (severity within 200 chars): preserved via the tally.
 *   - CLARITY-3 (no raw `**word**`): preserved — the severity-table
 *     layout uses emoji + backtick labels instead of `**medium**`.
 *   - CLARITY-4 (summary inside `<details>`): NO LONGER APPLIES — the
 *     severity-table layout surfaces the summary inline. Test
 *     assertions that pinned this contract have been updated.
 *   - CLARITY-5 (identical shape across empty/clean/busy): preserved —
 *     the layout always emits the same section structure.
 *   - CLARITY-6/7 (marker + manifest): preserved.
 *   - CLARITY-8 (GitHub == Azure): preserved — both paths call this
 *     same function.
 *   - CLARITY-13/19 (off-diff / pipeline reconciliation): now surfaced
 *     through the manifest + the rendered table instead of separate
 *     `<details>` blocks.
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
   * `📍 Off-diff (N not posted)` block lists every finding the
   * pipeline summary counts — see CLARITY-13 + CLARITY-19. Required
   * parameter; pass `[]` when the caller has no off-diff findings to
   * surface.
   */
  readonly offDiffFromComments: readonly LiveReviewComment[];
  /**
   * Findings actually posted as inline threads — the same array that
   * produced `validCommentCount` and `severityCounts`. Used to render
   * the "📋 Posted preview" so the preview agrees with the tally
   * and the footer (CLARITY-16 invariant). When this list is omitted
   * (older callers, simulate-findings fixture, etc.), the preview
   * falls back to `review.comments` and the header denominator uses
   * the model's total instead — see `topConcernsBlock` for the exact
   * fallback semantics.
   */
  readonly postedComments?: readonly LiveReviewComment[];
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
  readonly layout?: LayoutId;
  /**
   * Optional threshold context forwarded to the rendered layout so the
   * `🏷️ …` severity tally can append a `*` marker when the active
   * `--minimum-severity` setting hides one or more tiers. Omit (or pass
   * `null`) for the byte-identical legacy tally — used by unit tests,
   * simulate-findings, and any caller that does not yet have a
   * `ParsedCliArgs` in scope.
   */
  readonly minimumSeverity?: string | null;
}): string {
  // Delegate to the "severity-table" layout from
  // `src/render/summary-layouts.ts` — selected from the 20-layout
  // sheet after side-by-side review. The other 19 layouts remain
  // available via `renderSummary(layout, data)` for callers that want
  // a different visual personality. See the local viewer
  // (`scripts/view-summary-layouts.mjs`) for the design rationale and
  // before/after comparison.
  //
  // The legacy in-place assembly of the parent card (verdict + pipeline
  // summary + posted preview + off-diff block + summary <details> +
  // footer + manifest) is preserved verbatim as the "current"
  // baseline inside `renderBaseline("current", data)` so the viewer
  // can render the old shape side-by-side with the new one.
  //
  // Compatibility shim: callers that omit `postedComments` (older
  // fixtures, `simulate-findings`) used to fall back to
  // `review.comments`. The severity-table layout needs the actual
  // posted set, so we resolve the fallback here before dispatch.
  const postedComments: readonly LiveReviewComment[] =
    input.postedComments ?? input.review.comments;
  const reviewData: LayoutReviewData = {
    review: input.review,
    provider: input.provider,
    modelId: input.modelId,
    validCommentCount: input.validCommentCount,
    suppressedCommentCount: input.suppressedCommentCount,
    severityCounts: input.severityCounts,
    offDiffFromComments: input.offDiffFromComments,
    postedComments,
    secrets: input.secrets,
    minimumSeverity: input.minimumSeverity ?? null,
  };
  return renderSummary(input.layout ?? "severity-table", reviewData);
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
 * 16 000 chars is enough to capture metadata (~500 chars) plus a typical
 * modern review (~2-12 KB of JSON output_text) without truncation; SSE
 * streams that exceed this get head+tail with a quantifier in the middle.
 * Pinned by `test/unit/parse-fail-diagnostic.test.ts` so the budget cannot
 * silently regress to a value that hides the final `response.completed`
 * payload from reviewers. MUST stay well under GitHub's 65 536-char
 * comment body limit once wrapped in `<details>` + summary + manifest.
 */
const MALFORMED_PROVIDER_FALLBACK_RAW_MAX = 16_000;
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
/**
 * Optional context describing WHY the provider response failed to parse.
 * Distinguishes "stream was truncated" (the model's token budget ran
 * out before it emitted `response.completed`) from "stream completed
 * but JSON was malformed" (a model regression or genuinely bad output).
 * Each reason gets a distinct remediation hint in the diagnostic so
 * reviewers know whether to retry with a higher `--max-output-tokens`
 * or to file a bug against the model.
 */
export type ParseFailureReason =
  | { readonly kind: "truncated"; readonly usage?: { readonly output_tokens?: number; readonly total_tokens?: number }; readonly maxOutputTokens?: number }
  | { readonly kind: "malformed" };

export function buildMalformedProviderFallback(input: {
  readonly provider: string;
  readonly modelId: string;
  readonly rawText: string;
  readonly secrets: readonly string[];
  readonly reason?: ParseFailureReason;
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

  // Reason-specific headline + remediation. The truncated case carries
  // actionable advice ("raise --max-output-tokens") that the malformed
  // case doesn't have. Keeping these strings in the helper (not the
  // render layer) means every layout that falls back to the parse-fail
  // diagnostic surfaces the same advice — the alternative (per-layout
  // strings) is exactly the kind of drift the unified builder is meant
  // to prevent.
  const headline = buildParseFailureHeadline(input.reason);
  const remediation = buildParseFailureRemediation(input.reason);

  // Note: the summary intentionally does NOT include a "Generated by"
  // footer — `buildReviewBody` emits that footer in its own block so
  // this fallback path would otherwise show the same metadata twice.
  return {
    summary: `${headline}${remediation.length > 0 ? `\n\n**Remediation:** ${remediation}` : ""}\n\n${detailsBlock}`,
    verdict: "COMMENT",
    comments: [],
    suppressedComments: [],
    parseFailed: true,
    ...(input.reason !== undefined ? { parseFailureReason: input.reason } : {}),
  };
}

/**
 * Render the parse-failure headline. Lives in `live-shared.ts` so every
 * layout that consumes the fallback review (severity-table, verdict-
 * banner, release-notes, etc.) gets the same wording without each
 * layout having to know about ParseFailureReason. The headline is the
 * single sentence that says "what happened" in the parse-fail banner.
 */
function buildParseFailureHeadline(reason: ParseFailureReason | undefined): string {
  if (reason?.kind === "truncated") {
    return "Provider response stream was truncated before the model emitted its final `response.completed` event.";
  }
  return "Provider response did not contain a valid JSON review payload.";
}

/**
 * Render the actionable remediation line. Empty for the malformed case
 * because there's no automatic fix — only "the model returned bad data,
 * file a bug". The truncated case carries concrete advice: raise
 * --max-output-tokens and retry.
 */
function buildParseFailureRemediation(reason: ParseFailureReason | undefined): string {
  if (reason?.kind !== "truncated") {
    return "";
  }
  const usagePct =
    reason.usage?.output_tokens !== undefined && reason.maxOutputTokens !== undefined && reason.maxOutputTokens > 0
      ? Math.round((reason.usage.output_tokens / reason.maxOutputTokens) * 100)
      : null;
  const usageDetail =
    reason.usage?.output_tokens !== undefined
      ? ` (model emitted ${reason.usage.output_tokens} output tokens${usagePct !== null ? ` ≈ ${usagePct}% of the configured cap` : ""})`
      : "";
  return `The output was likely cut off by the model's token budget${usageDetail}. Try raising \`--max-output-tokens\` and re-running. If the model consistently exceeds the cap, split the diff into smaller chunks.`;
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
  return selectPostableCommentsWithPositions({
    review: input.review,
    positions: parseDiffPositions(input.diffText),
    parsed: input.parsed,
    secrets: input.secrets,
  });
}

/**
 * Internal variant of `selectPostableComments` that accepts a
 * pre-computed `DiffPositionIndex`. Use this when the caller has
 * already parsed the diff (e.g. `preparePostedReview` calls
 * `selectPostableComments`, `selectOffDiffComments`, and
 * `countSuppressedComments` in sequence, and each was previously
 * re-parsing the same diff). Eliminating the duplicate parse is a
 * meaningful win for large PRs — a 5000-line diff parses in
 * single-digit ms, but `preparePostedReview` was doing it 3x
 * per review.
 */
function selectPostableCommentsWithPositions(input: {
  readonly review: LiveReview;
  readonly positions: ReturnType<typeof parseDiffPositions>;
  readonly parsed: ParsedCliArgs;
  readonly secrets: readonly string[];
}): readonly LiveReviewComment[] {
  const maxComments = input.parsed.maxComments ?? DEFAULT_MAX_COMMENTS;
  const comments: LiveReviewComment[] = [];
  for (const comment of input.review.comments) {
    if (comments.length >= maxComments) {
      break;
    }
    if (!input.positions.hasPosition(comment)) {
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
  return selectOffDiffCommentsWithPositions(review, parseDiffPositions(diffText));
}

/**
 * Internal variant of `selectOffDiffComments` that accepts a
 * pre-computed `DiffPositionIndex`. See
 * `selectPostableCommentsWithPositions` for the rationale.
 */
function selectOffDiffCommentsWithPositions(
  review: LiveReview,
  positions: ReturnType<typeof parseDiffPositions>,
): readonly LiveReviewComment[] {
  return review.comments.filter((comment) => !positions.hasPosition(comment));
}

export function countSuppressedComments(review: LiveReview, diffText: string): number {
  const positions = parseDiffPositions(diffText);
  let offDiffCount = 0;
  for (const comment of review.comments) {
    if (!positions.hasPosition(comment)) {
      offDiffCount += 1;
    }
  }
  return review.suppressedComments.length + offDiffCount;
}

/**
 * The shared GitHub/Azure live-post preparation recipe. Computes the
 * postable comments, off-diff comments, suppressed comment count, severity
 * counts, and the review body in one place so both `runGithubLive` and
 * `runAzureLive` produce identical postable lists and identical review
 * bodies for identical inputs.
 *
 * Callers should use this helper rather than re-running `selectPostableComments`,
 * `selectOffDiffComments`, `countBySeverity`, and `buildReviewBody` inline,
 * which was the previous source of drift between the two platforms.
 */
export function preparePostedReview(input: {
  readonly review: LiveReview;
  readonly provider: string;
  readonly modelId: string;
  readonly diffText: string;
  readonly parsed: ParsedCliArgs;
  readonly secrets: readonly string[];
}): PreparedPostedReview {
  // Parse the diff ONCE and pass the index to all three selectors.
  // Each of the public selectors (`selectPostableComments`,
  // `selectOffDiffComments`, `countSuppressedComments`) was
  // previously re-parsing the same diff internally — 3x parses per
  // review. The `*WithPositions` variants take a pre-computed
  // index so the parse runs exactly once.
  const positions = parseDiffPositions(input.diffText);
  const postableComments = selectPostableCommentsWithPositions({
    review: input.review,
    positions,
    parsed: input.parsed,
    secrets: input.secrets,
  });
  // The off-diff comments array is needed for the manifest payload
  // (so reviewers can see which findings the post-filter dropped
  // and why). The suppressed count is also displayed. Both are
  // derived from the same `review.comments - positions.hasPosition`
  // filter. The array materialization is unavoidable (the manifest
  // needs every entry) and the count derivation is just a `.length`
  // on it. `countSuppressedComments(review, diffText)` is a
  // single-call helper for callers that don't need the array; it
  // re-parses the diff and re-runs the filter. `preparePostedReview`
  // already has `positions` and the off-diff array, so it computes
  // the count inline rather than calling the helper.
  const offDiffFromComments = selectOffDiffCommentsWithPositions(input.review, positions);
  const suppressedCommentCount = input.review.suppressedComments.length + offDiffFromComments.length;
  const severityCounts = countBySeverity(postableComments);
  // Reconcile the model's raw verdict against the postable severity
  // counts. If every finding was severity-filtered out, the body will
  // render `📊 0 inline findings`, and rendering `⛔ NEEDS_FIX` against
  // that headline is contradictory — the human reviewer would block
  // the PR on a verdict that has no findings to act on. Downgrade to
  // `COMMENT` in that case so the badge matches the body. See
  // `src/util/verdict.ts:reconcileVerdictForEmptySeverityCounts` for
  // the rule and the PR #18 regression context.
  const effectiveVerdict = reconcileVerdictForEmptySeverityCounts(
    input.review.verdict,
    severityCounts,
  );
  const body = buildReviewBody({
    review: { ...input.review, verdict: effectiveVerdict },
    provider: input.provider,
    modelId: input.modelId,
    validCommentCount: postableComments.length,
    suppressedCommentCount,
    offDiffFromComments,
    severityCounts,
    postedComments: postableComments,
    secrets: input.secrets,
    // Threshold context — forwarded so the rendered `🏷️ …` tally can
    // append `*` when the active `--minimum-severity` setting hides one
    // or more tiers. Older callers (unit tests, simulate-findings) can
    // omit it and get the byte-identical legacy tally.
    minimumSeverity: input.parsed.minimumSeverity,
  });

  return {
    postableComments,
    offDiffFromComments,
    suppressedCommentCount,
    severityCounts,
    body,
    postedComments: postableComments,
    effectiveVerdict,
  };
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
    .replace(/Authorization:\s*[^\r\n]*/giu, REDACTED_AUTHORIZATION_HEADER)
    .replace(/\bBearer\s+\S+/giu, REDACTED_BEARER_TOKEN);
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
      process.stderr.write(`::debug::${BRAND_PREFIX}${action} HTTP ${response.status} body=${snippet}\n`);
    })
    .catch(() => {
      // Body read failed; nothing actionable to do here.
    });
  throw new LiveReviewError(code, `${action} failed with HTTP ${response.status}.`);
}

export { isRecord };

function passesSeverityPolicy(comment: LiveReviewComment, parsed: ParsedCliArgs): boolean {
  // `minimumSeverityInternal` is pre-resolved at arg-parse time (CLI
  // enum → internal Severity via the alias table). Reading it here
  // avoids re-parsing on every comment and ensures a malformed value
  // fails fast at the CLI boundary instead of throwing
  // InvalidConfigError deep in the live path.
  const minimum = parsed.minimumSeverityInternal;
  if (minimum === null) return true;
  // Normalize the comment's severity before the threshold + carve-out
  // check. The provider may emit non-canonical values (typos like
  // "warning", unknown ranks, etc.) and `LiveReviewComment.severity`
  // is typed `string`, not `Severity`. Without normalization, the
  // carve-out's `finding === "security"` string compare would silently
  // miss a typo and filter a finding that the security policy says
  // must be preserved. normalizeProviderSeverity is the same function
  // the live-path parser uses, so the threshold check sees the same
  // canonical severity the rendered tally would.
  const normalized = normalizeProviderSeverity(comment.severity, comment.body);
  return shouldKeepFinding({ minimum }, normalized as Severity);
}
