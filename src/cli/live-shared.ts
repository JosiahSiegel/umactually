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

function summaryBlock(input: {
  readonly review: LiveReview;
  readonly severityCounts: Record<string, number>;
  readonly suppressedCount: number;
  readonly secrets: readonly string[];
}): string {
  const counts = input.severityCounts;
  const countLines = ["high", "medium", "low", "critical"]
    .filter((level) => (counts[level] ?? 0) > 0)
    .map((level) => `- **${level}**: ${counts[level]}`)
    .join("\n");
  const suppressedLine = input.suppressedCount > 0
    ? `- **suppressed** (off-diff): ${input.suppressedCount}\n`
    : "";

  return [
    "<details>",
    "<summary>📊 Findings breakdown</summary>",
    "",
    countLines,
    suppressedLine.length > 0 ? suppressedLine : "",
    "</details>",
    "",
  ].filter((line) => line.length > 0).join("\n");
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
 * Structure:
 *   1. Stable HTML marker (used for dedup)
 *   2. Verdict badge
 *   3. Summary paragraph
 *   4. Collapsed <details> block with severity counts
 *   5. Provider/model line
 *   6. Hidden HTML comment with a JSON manifest for AI agents
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

  const sections = [
    REVIEW_MARKER,
    `## ${verdict}`,
    "",
    safeSummary,
    "",
    summaryBlock({
      review: input.review,
      severityCounts,
      suppressedCount: input.suppressedCommentCount,
      secrets: input.secrets,
    }),
    `*Generated by \`${safeModelId}\` via \`${safeProvider}\`.*`,
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

  return {
    summary: `Provider response did not contain a valid JSON review payload.\n\n${detailsBlock}*Generated by \`${safeModelId}\` via \`${safeProvider}\`.*`,
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

export function mapReviewVerdictToAzureStatus(verdict: string): "succeeded" | "failed" | "pending" {
  switch (verdict) {
    case "NEEDS_FIX":
      return "failed";
    case "APPROVED":
      return "succeeded";
    case "COMMENT":
    case "DISCUSS":
    case "SHIP":
      return "pending";
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
  if (!response.ok) {
    throw new LiveReviewError(code, `${action} failed with HTTP ${response.status}.`);
  }
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
