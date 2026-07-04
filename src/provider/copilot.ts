import {
  buildChatBody,
  extractTextPayload,
  isNonEmptyReview,
  PARSE_FAIL_RETRY_PROMPT,
  parseReviewPayload,
  type ProviderReviewPayload,
} from "./provider-parse.js";
import {
  isAbortError,
  ProviderError,
  sanitizeHttpStatus,
  sanitizeMessage,
} from "./provider-error.js";
import {
  fetchAndCacheSessionToken,
  getCachedSessionToken,
} from "./copilot-token.js";
import { createRequestId, joinUrl } from "../util/url.js";
import { BRAND } from "../util/brand.js";
import { composeSignal } from "../util/async.js";

const DEFAULT_GITHUB_API_BASE = "https://api.github.com";
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
};

export type CopilotCallSuccess = {
  readonly ok: true;
  readonly endpoint: "chat";
  readonly review: ProviderReviewPayload;
  readonly requestId: string;
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
  const url = joinUrl(session.apiBase, "/chat/completions");
  const body = buildChatBody({
    model: config.model,
    system: config.system,
    user: config.user,
    ...(config.maxOutputTokens !== undefined ? { maxOutputTokens: config.maxOutputTokens } : {}),
    ...(config.reasoningEffort !== undefined ? { reasoningEffort: config.reasoningEffort } : {}),
  });
  const signal = composeSignal(undefined, config.requestTimeoutMs);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: buildChatHeaders(session.token),
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      return {
        ok: false,
        error: new ProviderError(
          "timeout",
          ENDPOINT_CHAT,
          null,
          requestId,
          `Request to provider ${ENDPOINT_CHAT} timed out after ${config.requestTimeoutMs}ms.`,
        ),
      };
    }
    return {
      ok: false,
      error: new ProviderError(
        "network",
        ENDPOINT_CHAT,
        null,
        requestId,
        sanitizeMessage(error, `Network error contacting provider ${ENDPOINT_CHAT}.`),
        { cause: error },
      ),
    };
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
    rawText = await response.text();
  } catch (error) {
    return {
      ok: false,
      error: new ProviderError(
        "parse",
        ENDPOINT_CHAT,
        response.status,
        requestId,
        sanitizeMessage(error, "Failed to read provider response body."),
        { cause: error },
      ),
    };
  }

  const textPayload = extractTextPayload(ENDPOINT_CHAT, rawText);
  const review = parseReviewPayload(textPayload);
  // Strict check (CLARITY-10): empty summary+verdict+comments counts as
  // a parse failure even when extractJsonBlock returned an object. This
  // catches chat-format responses fed to the responses endpoint and
  // similar misconfigurations.
  if (isNonEmptyReview(review)) {
    return { ok: true, endpoint: ENDPOINT_CHAT, review, requestId };
  }

  // Self-healing parse-fail retry: send a follow-up message asking the
  // model to emit JSON only. Mirrors the openai-compatible path.
  // See openai-compatible.ts:callEndpoint for the full rationale.
  const retryBody = buildChatBody(
    {
      model: config.model,
      system: config.system,
      user: config.user,
      ...(config.maxOutputTokens !== undefined ? { maxOutputTokens: config.maxOutputTokens } : {}),
      ...(config.reasoningEffort !== undefined ? { reasoningEffort: config.reasoningEffort } : {}),
    },
    { userOverride: PARSE_FAIL_RETRY_PROMPT },
  );
  let retryResponse: Response;
  try {
    retryResponse = await fetchImpl(url, {
      method: "POST",
      headers: buildChatHeaders(session.token),
      body: JSON.stringify(retryBody),
      signal,
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
  const retryRawText = await retryResponse.text();
  const retryTextPayload = extractTextPayload(ENDPOINT_CHAT, retryRawText);
  let retryReview: ProviderReviewPayload | null = null;
  const parsedRetry = parseReviewPayload(retryTextPayload);
  if (isNonEmptyReview(parsedRetry)) {
    retryReview = parsedRetry;
  }
  if (retryReview === null) {
    return {
      ok: false,
      error: new ProviderError(
        "parse",
        ENDPOINT_CHAT,
        response.status,
        requestId,
        "Provider response did not contain a JSON review payload after self-healing retry.",
        { rawText },
      ),
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
