import { runCopilotRequest } from "../provider/copilot.js";
import { runProviderRequest, type ProviderReviewPayload } from "../provider/openai-compatible.js";
import { scanReviewSecrets } from "../security/scan-review-secrets.js";
import {
  LiveReviewError,
  sanitizeForPost,
  type FetchImpl,
  type LivePlatform,
  type LiveProviderOutcome,
  type LiveReview,
  type LiveReviewComment,
} from "./live-shared.js";
import type { ParsedCliArgs } from "./parse-args.js";
import { buildProviderPrompts } from "./provider-prompts.js";

const DEFAULT_MODEL = "auto";
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
const PROVIDER_NAME = "openai-compatible";
const COPILOT_PROVIDER_NAME = "github-copilot";

export async function requestLiveReview(input: {
  readonly parsed: ParsedCliArgs;
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly fetchImpl: FetchImpl;
  readonly platform: LivePlatform;
  readonly diffText: string;
  readonly platformToken: string;
  readonly sonarContext?: string;
}): Promise<LiveProviderOutcome> {
  await scanReviewSecrets({
    diffText: input.diffText,
    expectedArtifact: "artifacts/manual/s5-redaction-report.json",
  });
  const providerUrl = readRequiredConfig(input.parsed.apiUrl ?? input.env["UMACTUALLY_API_URL"], "UMACTUALLY_API_URL");
  const providerApiKey = readRequiredConfig(input.parsed.apiKey ?? input.env["UMACTUALLY_API_KEY"], "UMACTUALLY_API_KEY");
  const modelId = readConfiguredModel(input.parsed, input.env);
  const prompts = await buildProviderPrompts(input);

  if (input.parsed.provider === "copilot") {
    const result = await runCopilotRequest({
      githubToken: providerApiKey,
      apiBase: input.parsed.githubApiBase ?? input.env["UMACTUALLY_GITHUB_API_BASE"] ?? "https://api.github.com",
      system: prompts.system,
      user: prompts.user,
      model: modelId,
      requestTimeoutMs: readRequestTimeoutMs(input.parsed),
      ...(input.parsed.maxOutputTokens !== null ? { maxOutputTokens: input.parsed.maxOutputTokens } : {}),
      ...(input.parsed.effort !== null ? { reasoningEffort: input.parsed.effort } : {}),
      fetchImpl: input.fetchImpl as typeof fetch,
    });
    if (result.ok) {
      return {
        review: normalizeProviderReview(result.review, [providerApiKey, input.platformToken]),
        endpoint: result.endpoint,
        provider: COPILOT_PROVIDER_NAME,
        modelId,
      };
    }
    if (result.error.code === "parse") {
      return {
        review: buildMalformedProviderFallback(),
        endpoint: result.error.endpoint,
        provider: COPILOT_PROVIDER_NAME,
        modelId,
      };
    }
    throw new LiveReviewError("PROVIDER_REQUEST_FAILED", result.error.message, { cause: result.error });
  }

  const result = await runProviderRequest({
    baseUrl: providerUrl,
    apiKey: providerApiKey,
    model: modelId,
    system: prompts.system,
    user: prompts.user,
    requestTimeoutMs: readRequestTimeoutMs(input.parsed),
    ...(input.parsed.maxOutputTokens !== null ? { maxOutputTokens: input.parsed.maxOutputTokens } : {}),
    ...(input.parsed.effort !== null ? { reasoningEffort: input.parsed.effort } : {}),
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
