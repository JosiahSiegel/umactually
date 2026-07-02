import { parseDiffPositions } from "../diff/parse-positions.js";
import { REVIEW_MARKER } from "../review/run-review.js";
import { scanReviewSecrets } from "../security/scan-review-secrets.js";
import type { ParsedCliArgs } from "./parse-args.js";

export type FetchImpl = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export type LivePlatform = "github" | "azure";

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
  readonly comments: readonly LiveReviewComment[];
  readonly suppressedComments: readonly LiveReviewComment[];
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

const DEFAULT_MAX_COMMENTS = 50;

/**
 * Visual verdict badge used in the review-header summary. Both GitHub and
 * Azure DevOps render markdown, so the same badge appears on each platform.
 */
function verdictBadge(verdict: string): string {
  const normalized = verdict.toUpperCase();
  if (normalized === "NEEDS_FIX") return "⛔ NEEDS_FIX";
  if (normalized === "APPROVED" || normalized === "SHIP") return "✅ SHIP";
  return "💬 DISCUSS";
}

/**
 * Group comments by severity (low/medium/high/critical). Used by both the
 * GitHub and Azure review-header builders so the collapsed details block
 * reports the same severity tally regardless of platform.
 */
export function countBySeverity(comments: readonly { readonly severity: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const comment of comments) {
    const key = comment.severity.toLowerCase();
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/**
 * Hard upper bound on the inline-finding preview list inside the parent
 * "Top concerns" <details> block. Keeps the parent card from being
 * dominated by a long list when the provider returns many findings.
 */
const TOP_CONCERNS_PREVIEW_LIMIT = 5;

/**
 * Order in which severity levels appear in the counts line and the
 * "Top concerns" header. Critical first (most urgent), then
 * high → medium → low. The `info` level is intentionally excluded —
 * info findings are tracked in the manifest but are not a signal the
 * reviewer needs to act on.
 */
const SEVERITY_ORDER = ["critical", "high", "medium", "low"] as const;

/**
 * Counts line that appears immediately after the verdict badge. Uses
 * emoji + backticks (NOT `**word**` asterisks) because ADO's PR-thread
 * renderer surface has been observed to leak `**...**` as literal
 * asterisks even though the markdown guidance documents that emphasis
 * IS supported. Belt-and-braces compatibility — see CLARITY-3 in
 * test/unit/live-azure-parent-clarity.test.ts.
 *
 * The line ALWAYS renders (even when all counts are zero) so a reviewer
 * can distinguish "0 findings, ship it" from "nothing rendered". That
 * consistency is the contract CLARITY-5 pins.
 */
function countsLine(input: {
  readonly severityCounts: Record<string, number>;
  readonly suppressedCount: number;
}): string {
  const parts: string[] = [];
  for (const level of SEVERITY_ORDER) {
    const count = input.severityCounts[level] ?? 0;
    parts.push(`\`${count}\` ${level}`);
  }
  parts.push(`\`${input.suppressedCount}\` suppressed (off-diff)`);
  return `📊 ${parts.join(" · ")}`;
}

/**
 * Build the "Top concerns" <details> block. Shows a preview of the
 * highest-severity findings so a reviewer can decide which to open in
 * the inline threads. Hidden by default so it does not push the counts
 * line below the fold.
 */
function topConcernsBlock(input: {
  readonly review: LiveReview;
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
  const header = preview.length === 1
    ? "📋 Top concern (1)"
    : `📋 Top concerns (${preview.length})`;
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
}): string {
  if (input.suppressedComments.length === 0) {
    return "";
  }
  const header = input.suppressedComments.length === 1
    ? "🔕 Suppressed (off-diff, 1)"
    : `🔕 Suppressed (off-diff, ${input.suppressedComments.length})`;
  const lines = input.suppressedComments.map((comment) => {
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
    schema: "umactually-pr-review/v1",
    verdict: input.review.verdict,
    provider: input.provider,
    modelId: input.modelId,
    inlineCount: input.validCommentCount,
    suppressedCount: input.suppressedCommentCount,
    severityCounts: input.severityCounts,
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
 *   3. Counts line — emoji + backticks, immediately below the verdict, so a
 *      reviewer sees "how many findings, how many suppressed" within the
 *      first viewport
 *   4. Top-concerns <details> — preview of the highest-severity findings
 *   5. Suppressed <details> — list of off-diff findings
 *   6. Prose summary <details> — long provider narrative, hidden by default
 *   7. Footer — model + provider + inline-thread count, small text
 *   8. Hidden HTML comment with the JSON manifest for AI agents
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
  readonly secrets: readonly string[];
}): string {
  const severityCounts = countBySeverity(input.review.comments);
  const verdict = verdictBadge(input.review.verdict);
  const safeSummary = sanitizeForPost(input.review.summary, input.secrets);
  const safeModelId = sanitizeForPost(input.modelId, input.secrets);
  const safeProvider = sanitizeForPost(input.provider, input.secrets);

  const footer =
    `🤖 Generated by \`${safeModelId}\` via \`${safeProvider}\` · ` +
    `${input.validCommentCount} inline thread(s) posted`;

  const sections = [
    REVIEW_MARKER,
    "",
    `## ${verdict}`,
    "",
    countsLine({
      severityCounts,
      suppressedCount: input.suppressedCommentCount,
    }),
    "",
    topConcernsBlock({ review: input.review }),
    suppressedBlock({ suppressedComments: input.review.suppressedComments }),
    proseBlock(safeSummary),
    footer,
    "",
    metadataManifest({
      review: input.review,
      provider: input.provider,
      modelId: input.modelId,
      validCommentCount: input.validCommentCount,
      suppressedCommentCount: input.suppressedCommentCount,
      severityCounts,
    }),
  ];

  const raw = sections.join("\n");
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
    typeof input.parentThreadId === "number" && Number.isSafeInteger(input.parentThreadId) && input.parentThreadId > 0
      ? `> Reply to PR review summary #${input.parentThreadId}\n\n`
      : "";
  return `${marker}${parentRef}\`${safeSeverity}\` \`${safeCategory}\`\n\n${safeBody}`;
}

/**
 * Hard upper bound on the raw provider text we include in a parse-fail
 * fallback body. Keeps the parent PR-level summary card from being filled
 * with an unbounded provider response if the model misbehaves.
 */
const MALFORMED_PROVIDER_FALLBACK_RAW_MAX = 1000;

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
  const truncated = input.rawText.length > MALFORMED_PROVIDER_FALLBACK_RAW_MAX
    ? `${input.rawText.slice(0, MALFORMED_PROVIDER_FALLBACK_RAW_MAX)}\n…(truncated)`
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

export function countSuppressedComments(review: LiveReview, diffText: string): number {
  const positions = parseDiffPositions(diffText);
  let count = review.suppressedComments.length;
  for (const comment of review.comments) {
    if (!positions.hasPosition(comment)) {
      count += 1;
    }
  }
  return count;
}

export function mapReviewVerdictToGithubEvent(verdict: string): "COMMENT" | "REQUEST_CHANGES" {
  return verdict === "NEEDS_FIX" ? "REQUEST_CHANGES" : "COMMENT";
}

/**
 * Map a review verdict to an Azure DevOps PR-status `state` value.
 *
 * State values per Microsoft Learn:
 *   https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-statuses/create?view=azure-devops-rest-7.1
 *   "State of the status."  (notSet | pending | succeeded | failed | error | notApplicable)
 *
 * Policy:
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
 */
export function mapReviewVerdictToAzureStatus(verdict: string): "succeeded" | "failed" | "pending" {
  switch (verdict) {
    case "APPROVED":
    case "COMMENT":
    case "DISCUSS":
    case "SHIP":
      return "succeeded";
    case "NEEDS_FIX":
    case "":
    default:
      return "pending";
  }
}

export function sanitizeForPost(value: string, secrets: readonly string[]): string {
  let sanitized = value
    .replace(/Authorization:\s*[^\r\n]*/giu, "[REDACTED_AUTHORIZATION_HEADER]")
    .replace(/\bBearer\s+\S+/giu, "[REDACTED_BEARER_TOKEN]");
  for (const secret of secrets) {
    if (secret.length > 0) {
      sanitized = sanitized.split(secret).join("[REDACTED_SECRET]");
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
  return typeof id === "number" && Number.isSafeInteger(id) ? id : undefined;
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
      const snippet = text.length > 500 ? `${text.slice(0, 500)}…(truncated)` : text;
      process.stderr.write(`::debug::umactually-pr-review: ${action} HTTP ${response.status} body=${snippet}\n`);
    })
    .catch(() => {
      // Body read failed; nothing actionable to do here.
    });
  throw new LiveReviewError(code, `${action} failed with HTTP ${response.status}.`);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
