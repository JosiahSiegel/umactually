import {
  buildChatBody,
  extractTextPayload,
  parseReviewPayload,
  type ProviderEndpoint,
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

const DEFAULT_GITHUB_API_BASE = "https://api.github.com";
const COPILOT_EDITOR_VERSION = "vscode/1.96.0";
const COPILOT_EDITOR_PLUGIN_VERSION = "umactually-pr-review/0.1.0";
const COPILOT_INTEGRATION_ID = "vscode-chat";
const COPILOT_USER_AGENT = "umactually-pr-review/0.1.0";
const ENDPOINT_CHAT: ProviderEndpoint = "chat";

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
  const signal = AbortSignal.timeout(config.requestTimeoutMs);

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
  if (review === null) {
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

  return { ok: true, endpoint: "chat", review, requestId };
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

function joinUrl(baseUrl: string, path: string): string {
  const trimmedBase = baseUrl.replace(/\/+$/u, "");
  const prefixedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${prefixedPath}`;
}

function createRequestId(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof cryptoApi.getRandomValues === "function") {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  const hex: string[] = [];
  for (const byte of bytes) {
    hex.push(byte.toString(16).padStart(2, "0"));
  }
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}