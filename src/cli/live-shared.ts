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

export function buildReviewBody(input: {
  readonly review: LiveReview;
  readonly provider: string;
  readonly modelId: string;
  readonly validCommentCount: number;
  readonly suppressedCommentCount: number;
  readonly secrets: readonly string[];
}): string {
  const rawBody = [
    REVIEW_MARKER,
    sanitizeForPost(input.review.summary, input.secrets),
    "",
    `${sanitizeForPost(input.modelId, input.secrets)} (${sanitizeForPost(input.provider, input.secrets)})`,
    "",
    `Findings: ${input.validCommentCount} inline, ${input.suppressedCommentCount} suppressed.`,
  ].join("\n");
  return sanitizeForPost(rawBody, input.secrets);
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
    comments.push({ ...comment, body: sanitizeInlineBody(comment, input.secrets) });
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

function sanitizeInlineBody(comment: LiveReviewComment, secrets: readonly string[]): string {
  const prefix = `**${comment.severity} ${comment.category}**`;
  const body = comment.body.length > 0 ? comment.body : `Finding at ${comment.path}:${comment.line}.`;
  return sanitizeForPost(`${prefix}\n\n${body}`, secrets);
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
