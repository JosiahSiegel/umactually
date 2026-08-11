import {
  buildChatBody,
  detectProviderError,
  diagnoseParseFailure,
  extractTextPayload,
  isNonEmptyReview,
  PARSE_FAIL_RETRY_PROMPT,
  parseProviderUsage,
  parseReviewPayload,
  type ProviderReviewPayload,
} from "./provider-parse.js";
import {
  ProviderError,
  sanitizeHttpStatus,
} from "./provider-error.js";
import type { ProviderUsage } from "./provider-error.js";
import { bailIfAborted, buildParseFailError, computeBumpedMaxOutput } from "./provider-retry.js";
import { performProviderFetch, readResponseText } from "./http.js";
import {
  fetchAndCacheSessionToken,
  getCachedSessionToken,
} from "./copilot-token.js";
import { createRequestId, joinUrl } from "../util/url.js";
import { BRAND } from "../util/brand.js";
import { composeSignal } from "../util/async.js";
import { DEFAULT_GITHUB_API_BASE } from "../util/provider-defaults.js";

const COPILOT_EDITOR_VERSION = "vscode/1.96.0";
const COPILOT_EDITOR_PLUGIN_VERSION = `${BRAND}/0.1.0`;
const COPILOT_INTEGRATION_ID = "vscode-chat";
const COPILOT_USER_AGENT = `${BRAND}/0.1.0`;
const ENDPOINT_CHAT = "chat" as const;

/** Self-healing follow-up message for parse-fail retry (shared with openai-compatible). */
export type CopilotCallConfig = {
  readonly githubToken: string;
  readonly apiBase: string | undefined;
  readonly system: string;
  readonly user: string;
  readonly model: string;
  readonly requestTimeoutMs: number;
  readonly maxOutputTokens?: number;
  readonly reasoningEffort?: "low" | "medium" | "high";
  readonly fetchImpl?: typeof fetch;
  /**
   * Optional strict JSON schema enforced via `response_format`. The
   * Copilot Chat Completions endpoint accepts the same shape as the
   * OpenAI Chat Completions endpoint (it routes to a Copilot-backed
   * model); passing the strict schema in narrows the response to
   * the review shape and prevents prose-wrapped JSON.
   */
  readonly responseFormat?: import("./provider-parse.js").ResponseFormat;
};

export type CopilotCallSuccess = {
  readonly ok: true;
  readonly endpoint: "chat";
  readonly review: ProviderReviewPayload;
  readonly requestId: string;
  /**
   * Token usage block the Copilot provider emitted on the response.
   * Surfaced to the local audit artifact (Task 7) so a downstream
   * consumer can compute cost estimates from explicit per-token
   * prices. NEVER zero-invented: when the provider did not emit a
   * usage block, this field is omitted entirely.
   */
  readonly usage?: ProviderUsage;
};

export type CopilotCallResult =
  | CopilotCallSuccess
  | { readonly ok: false; readonly error: ProviderError };

export async function runCopilotRequest(config: CopilotCallConfig): Promise<CopilotCallResult> {
  const fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const requestId = createRequestId();

  const sessionResult = await resolveSession(config.githubToken, config.apiBase, fetchImpl, requestId);
  if (!sessionResult.ok) {
    return { ok: false, error: sessionResult.error };
  }

  return runChatCall(config, fetchImpl, requestId, sessionResult.session);
}

async function resolveSession(
  githubToken: string,
  apiBase: string | undefined,
  fetchImpl: typeof fetch,
  requestId: string,
): Promise<
  | { readonly ok: true; readonly session: { readonly token: string; readonly apiBase: string } }
  | { readonly ok: false; readonly error: ProviderError }
> {
  const cached = getCachedSessionToken(githubToken);
  if (cached !== undefined) {
    return { ok: true, session: cached };
  }
  const normalizedBase = normalizeApiBase(apiBase);
  return fetchAndCacheSessionToken(
    githubToken,
    buildTokenUrl(normalizedBase),
    buildTokenHeaders(githubToken),
    fetchImpl,
    ENDPOINT_CHAT,
    requestId,
  );
}

async function runChatCall(
  config: CopilotCallConfig,
  fetchImpl: typeof fetch,
  requestId: string,
  session: { readonly token: string; readonly apiBase: string },
): Promise<CopilotCallResult> {
  // Mirrors the abort-bailout guard from openai-compatible /
  // anthropic-messages. Copilot doesn't yet accept a caller
  // AbortSignal on `CopilotCallConfig`, so the check is a no-op
  // today; when the signal field is added, this guard will start
  // firing automatically.
  const bail = bailIfAborted({ signal: undefined, endpoint: ENDPOINT_CHAT, requestId });
  if (bail !== null) {
    return bail;
  }
  const url = joinUrl(session.apiBase, "/chat/completions");
  const body = buildChatBody({
    model: config.model,
    system: config.system,
    user: config.user,
    ...(config.maxOutputTokens !== undefined ? { maxOutputTokens: config.maxOutputTokens } : {}),
    ...(config.reasoningEffort !== undefined ? { reasoningEffort: config.reasoningEffort } : {}),
    ...(config.responseFormat !== undefined ? { responseFormat: config.responseFormat } : {}),
  });
  const signal = composeSignal(undefined, config.requestTimeoutMs);

  // The signal is composed from a no-op caller signal + the per-request
  // timeout, so today's `signal.aborted === true` branch is unreachable
  // here. Routing through `performProviderFetch` is forward-compatible:
  // the day CopilotCallConfig gains a `signal` field, this site will
  // start honoring caller-aborted requests without further edits. The
  // accepted behavior change for this PR is that pre-aborted signals
  // now surface a typed `ProviderError("aborted")` rather than a
  // leaked connection — pinned by `test/unit/provider-http.test.ts`.
  let response: Response;
  try {
    response = await performProviderFetch({
      url,
      body: JSON.stringify(body),
      signal,
      requestId,
      endpoint: ENDPOINT_CHAT,
      fetchImpl,
      buildHeaders: () => buildChatHeaders(session.token),
    });
  } catch (error) {
    if (error instanceof ProviderError) {
      return { ok: false, error };
    }
    throw error;
  }

  if (!response.ok) {
    return {
      ok: false,
      error: new ProviderError(
        "chat_4xx",
        ENDPOINT_CHAT,
        response.status,
        requestId,
        sanitizeHttpStatus(ENDPOINT_CHAT, response.status),
      ),
    };
  }

  let rawText: string;
  try {
    rawText = await readResponseText(response, ENDPOINT_CHAT, requestId);
  } catch (error) {
    if (error instanceof ProviderError) {
      return { ok: false, error };
    }
    throw error;
  }

  const textPayload = extractTextPayload(ENDPOINT_CHAT, rawText);
  const review = parseReviewPayload(textPayload);
  // Strict check (CLARITY-10): empty summary+verdict+comments counts as
  // a parse failure even when extractJsonBlock returned an object. This
  // catches chat-format responses fed to the responses endpoint and
  // similar misconfigurations.
  if (isNonEmptyReview(review)) {
    const usage = parseProviderUsage(rawText);
    return {
      ok: true,
      endpoint: ENDPOINT_CHAT,
      review,
      requestId,
      ...(usage !== undefined ? { usage } : {}),
    };
  }

  // Provider-error detection: check for router/proxy misconfiguration
  // before the self-healing retry. See openai-compatible.ts for the
  // full rationale — the short version: retrying won't help when no
  // model was invoked.
  const providerError = detectProviderError(rawText);
  if (providerError !== null) {
    return {
      ok: false,
      error: new ProviderError(
        "provider_error",
        ENDPOINT_CHAT,
        response.status,
        requestId,
        providerError.message,
        { rawText, providerErrorDetails: providerError },
      ),
    };
  }

  // Self-healing parse-fail retry: send a follow-up message asking the
  // model to emit JSON only. Mirrors the openai-compatible path.
  // See openai-compatible.ts:callEndpoint for the full rationale.
  const bumpedMaxOutput = computeBumpedMaxOutput({
    currentBudget: config.maxOutputTokens,
    rawTextLength: rawText.length,
    textPayloadLength: textPayload.length,
  });
  const retryBody = buildChatBody(
    {
      model: config.model,
      system: config.system,
      user: config.user,
      ...(bumpedMaxOutput !== undefined ? { maxOutputTokens: bumpedMaxOutput } : {}),
      ...(config.reasoningEffort !== undefined ? { reasoningEffort: config.reasoningEffort } : {}),
    },
    { userOverride: PARSE_FAIL_RETRY_PROMPT },
  );
  let retryResponse: Response;
  try {
    retryResponse = await performProviderFetch({
      url,
      body: JSON.stringify(retryBody),
      signal,
      requestId,
      endpoint: ENDPOINT_CHAT,
      fetchImpl,
      buildHeaders: () => buildChatHeaders(session.token),
    });
  } catch {
    // Retry HTTP call itself failed — surface the ORIGINAL parse failure
    // (not the retry's network error) so the parse-fail path's diagnostic
    // captures the actual root cause.
    return {
      ok: false,
      error: new ProviderError(
        "parse",
        ENDPOINT_CHAT,
        response.status,
        requestId,
        "Provider response did not contain a JSON review payload.",
        { rawText },
      ),
    };
  }
  if (!retryResponse.ok) {
    return {
      ok: false,
      error: new ProviderError(
        "parse",
        ENDPOINT_CHAT,
        retryResponse.status,
        requestId,
        `Provider self-healing retry failed with status ${retryResponse.status}; original parse error remains the root cause.`,
        { rawText },
      ),
    };
  }
  const retryRawText = await readResponseText(retryResponse, ENDPOINT_CHAT, requestId);
  const retryTextPayload = extractTextPayload(ENDPOINT_CHAT, retryRawText);
  let retryReview: ProviderReviewPayload | null = null;
  const parsedRetry = parseReviewPayload(retryTextPayload);
  if (isNonEmptyReview(parsedRetry)) {
    retryReview = parsedRetry;
  }
  if (retryReview === null) {
    const diagnosis = diagnoseParseFailure({ rawText });
    return {
      ok: false,
      error: buildParseFailError({
        endpoint: ENDPOINT_CHAT,
        status: response.status,
        requestId,
        message: "Provider response did not contain a JSON review payload after self-healing retry.",
        rawText,
        truncated: diagnosis.truncated,
        ...(diagnosis.usage !== undefined ? { usage: diagnosis.usage } : {}),
      }),
    };
  }

  return { ok: true, endpoint: ENDPOINT_CHAT, review: retryReview, requestId };
}

function buildTokenHeaders(githubToken: string): Record<string, string> {
  return {
    authorization: `token ${githubToken}`,
    accept: "application/json",
    "editor-version": COPILOT_EDITOR_VERSION,
    "editor-plugin-version": COPILOT_EDITOR_PLUGIN_VERSION,
    "copilot-integration-id": COPILOT_INTEGRATION_ID,
    "user-agent": COPILOT_USER_AGENT,
  };
}

function buildChatHeaders(sessionToken: string): Record<string, string> {
  return {
    authorization: `Bearer ${sessionToken}`,
    "content-type": "application/json",
    "editor-version": COPILOT_EDITOR_VERSION,
    "editor-plugin-version": COPILOT_EDITOR_PLUGIN_VERSION,
    "copilot-integration-id": COPILOT_INTEGRATION_ID,
    "user-agent": COPILOT_USER_AGENT,
  };
}

function normalizeApiBase(apiBase: string | undefined): string {
  if (apiBase === undefined || apiBase.length === 0) {
    return DEFAULT_GITHUB_API_BASE;
  }
  return apiBase;
}

function buildTokenUrl(apiBase: string): string {
  const trimmedBase = apiBase.replace(/\/+$/u, "");
  if (trimmedBase === DEFAULT_GITHUB_API_BASE) {
    return `${trimmedBase}/copilot_internal/v2/token`;
  }
  return `${trimmedBase}/api/copilot_internal/v2/token`;
}
