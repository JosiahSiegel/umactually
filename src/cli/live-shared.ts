import { readFile } from "node:fs/promises";

import { parseDiffPositions } from "../diff/parse-positions.js";
import { runProviderRequest, type ProviderReviewPayload } from "../provider/openai-compatible.js";
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

export type LiveProviderOutcome = {
  readonly review: LiveReview;
  readonly endpoint: string;
  readonly provider: string;
  readonly modelId: string;
};

export type LiveRuntimeConfig = {
  readonly parsed: ParsedCliArgs;
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly fetchImpl: FetchImpl;
};

export class LiveReviewError extends Error {
  override readonly name = "LiveReviewError";

  constructor(readonly code: string, message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

const DEFAULT_MODEL = "auto";
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_COMMENTS = 50;
const PROVIDER_NAME = "openai-compatible";

export async function requestLiveReview(input: {
  readonly parsed: ParsedCliArgs;
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly fetchImpl: FetchImpl;
  readonly platform: LivePlatform;
  readonly diffText: string;
  readonly platformToken: string;
}): Promise<LiveProviderOutcome> {
  await scanReviewSecrets({
    diffText: input.diffText,
    expectedArtifact: "artifacts/manual/s5-redaction-report.json",
  });
  const providerUrl = readRequiredConfig(input.parsed.apiUrl ?? input.env["UMACTUALLY_API_URL"], "UMACTUALLY_API_URL");
  const providerApiKey = readRequiredConfig(input.parsed.apiKey ?? input.env["UMACTUALLY_API_KEY"], "UMACTUALLY_API_KEY");
  const modelId = readConfiguredModel(input.parsed, input.env);
  const prompts = await buildProviderPrompts(input);
  const result = await runProviderRequest({
    baseUrl: providerUrl,
    apiKey: providerApiKey,
    model: modelId,
    system: prompts.system,
    user: prompts.user,
    requestTimeoutMs: readRequestTimeoutMs(input.parsed),
    fetchImpl: input.fetchImpl,
  });

  if (result.ok) {
    return {
      review: normalizeProviderReview(result.review, [providerApiKey, input.platformToken]),
      endpoint: result.endpoint,
      provider: PROVIDER_NAME,
      modelId,
    };
  }

  if (result.error.code === "parse") {
    return {
      review: buildMalformedProviderFallback(),
      endpoint: result.error.endpoint,
      provider: PROVIDER_NAME,
      modelId,
    };
  }

  throw new LiveReviewError("PROVIDER_REQUEST_FAILED", result.error.message, { cause: result.error });
}

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

async function buildProviderPrompts(input: {
  readonly parsed: ParsedCliArgs;
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly platform: LivePlatform;
  readonly diffText: string;
}): Promise<{ readonly system: string; readonly user: string }> {
  const additionalPrompt = await readAdditionalPrompt(input);
  return {
    system: [
      "You are UmActually, a precise pull request reviewer.",
      "Return strict JSON only with this schema:",
      "{\"summary\":string,\"verdict\":\"COMMENT\"|\"APPROVED\"|\"NEEDS_FIX\",\"comments\":[{\"path\":string,\"line\":number,\"body\":string,\"severity\":string,\"category\":string}],\"suppressed_comments\":[{\"path\":string,\"line\":number,\"body\":string,\"severity\":string,\"category\":string}]}",
      "Anchor comments only to changed or context lines present in the diff. Do not include secrets.",
    ].join("\n"),
    user: [
      `Platform: ${input.platform}`,
      additionalPrompt.length > 0 ? `Additional instructions:\n${additionalPrompt}` : "Additional instructions: none",
      "Diff:",
      input.diffText,
    ].join("\n\n"),
  };
}

async function readAdditionalPrompt(input: {
  readonly parsed: ParsedCliArgs;
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
}): Promise<string> {
  const filePath = input.parsed.additionalPromptFile ?? input.env["UMACTUALLY_ADDITIONAL_PROMPT_FILE"];
  if (filePath === undefined || filePath.length === 0) {
    return "";
  }
  return readFile(new URL(filePath, `file://${input.cwd.replace(/\\/gu, "/")}/`), "utf8");
}

function normalizeProviderReview(payload: ProviderReviewPayload, secrets: readonly string[]): LiveReview {
  return {
    summary: sanitizeForPost(payload.summary, secrets),
    verdict: payload.verdict,
    comments: payload.comments.map((comment) => normalizeProviderComment(comment, secrets)),
    suppressedComments: payload.suppressed_comments.map((comment) => normalizeProviderComment(comment, secrets)),
  };
}

function normalizeProviderComment(
  comment: ProviderReviewPayload["comments"][number],
  secrets: readonly string[],
): LiveReviewComment {
  return {
    path: comment.path,
    line: comment.line,
    body: sanitizeForPost(comment.body, secrets),
    severity: sanitizeForPost(comment.severity, secrets),
    category: sanitizeForPost(comment.category, secrets),
  };
}

function sanitizeInlineBody(comment: LiveReviewComment, secrets: readonly string[]): string {
  const prefix = `**${comment.severity} ${comment.category}**`;
  const body = comment.body.length > 0 ? comment.body : `Finding at ${comment.path}:${comment.line}.`;
  return sanitizeForPost(`${prefix}\n\n${body}`, secrets);
}

function readRequiredConfig(value: string | undefined | null, name: string): string {
  if (value === undefined || value === null || value.length === 0) {
    throw new LiveReviewError("LIVE_CONFIG_MISSING", `${name} must be set for live review.`);
  }
  return value;
}

function readConfiguredModel(parsed: ParsedCliArgs, env: NodeJS.ProcessEnv): string {
  const fromArgs = parsed.model;
  if (fromArgs !== null && fromArgs.length > 0) {
    return fromArgs;
  }
  const fromEnv = env["UMACTUALLY_MODEL"];
  return fromEnv === undefined || fromEnv.length === 0 ? DEFAULT_MODEL : fromEnv;
}

function readRequestTimeoutMs(parsed: ParsedCliArgs): number {
  const seconds = parsed.perRequestTimeoutSeconds ?? parsed.reviewTimeoutSeconds;
  return seconds === null || seconds <= 0 ? DEFAULT_REQUEST_TIMEOUT_MS : seconds * 1_000;
}

function buildMalformedProviderFallback(): LiveReview {
  return {
    summary: "Provider response did not contain a valid JSON review payload.",
    verdict: "COMMENT",
    comments: [],
    suppressedComments: [],
  };
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
