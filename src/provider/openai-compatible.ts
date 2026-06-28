import {
  buildChatBody,
  buildResponsesBody,
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

const ENDPOINT_RESPONSES: ProviderEndpoint = "responses";
const ENDPOINT_CHAT: ProviderEndpoint = "chat";

type ProviderCallSuccess = {
  readonly ok: true;
  readonly endpoint: ProviderEndpoint;
  readonly review: ProviderReviewPayload;
  readonly requestId: string;
};

type ProviderCallFailure = {
  readonly ok: false;
  readonly error: ProviderError;
};

export type ProviderCallResult = ProviderCallSuccess | ProviderCallFailure;

export type ProviderCallConfig = {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
  readonly system: string;
  readonly user: string;
  readonly requestTimeoutMs: number;
  readonly fetchImpl?: typeof fetch;
  readonly signal?: AbortSignal;
  readonly maxOutputTokens?: number;
  readonly reasoningEffort?: "low" | "medium" | "high";
  readonly promptOverride?: string;
  readonly additionalPromptOverride?: string;
  readonly githubApiBase?: string;
};

export { ProviderError };
export type { ProviderEndpoint, ProviderReviewPayload };

export async function runProviderRequest(config: ProviderCallConfig): Promise<ProviderCallResult> {
  const fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const requestId = createRequestId();

  const firstAttempt = await runWithRetry(config, fetchImpl, requestId, ENDPOINT_RESPONSES);
  if (firstAttempt.ok) {
    return firstAttempt;
  }
  if (shouldFallback(firstAttempt.error)) {
    return runWithRetry(config, fetchImpl, requestId, ENDPOINT_CHAT);
  }
  return firstAttempt;
}

async function runWithEndpoint(
  config: ProviderCallConfig,
  fetchImpl: typeof fetch,
  requestId: string,
  endpoint: ProviderEndpoint,
): Promise<ProviderCallResult> {
  try {
    return await callEndpoint(config, fetchImpl, requestId, endpoint);
  } catch (error) {
    if (error instanceof ProviderError) {
      return { ok: false, error };
    }
    throw error;
  }
}

const RETRY_BACKOFF_MS: ReadonlyArray<number> = [250, 1_000];

async function runWithRetry(
  config: ProviderCallConfig,
  fetchImpl: typeof fetch,
  requestId: string,
  endpoint: ProviderEndpoint,
): Promise<ProviderCallResult> {
  let lastFailure: ProviderError | null = null;
  for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt += 1) {
    const result = await runWithEndpoint(config, fetchImpl, requestId, endpoint);
    if (result.ok) {
      return result;
    }
    lastFailure = result.error;
    if (!isRetryable(result.error)) {
      return result;
    }
    if (attempt < RETRY_BACKOFF_MS.length) {
      const backoffMs = RETRY_BACKOFF_MS[attempt] ?? 0;
      await sleep(backoffMs);
    }
  }
  return { ok: false, error: lastFailure ?? new ProviderError("network", endpoint, null, requestId, "Unknown retry failure.") };
}

function isRetryable(error: ProviderError): boolean {
  return error.status === 429 || (typeof error.status === "number" && error.status >= 500);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function callEndpoint(
  config: ProviderCallConfig,
  fetchImpl: typeof fetch,
  requestId: string,
  endpoint: ProviderEndpoint,
): Promise<ProviderCallSuccess> {
  const url = joinUrl(config.baseUrl, endpoint === ENDPOINT_RESPONSES ? "/responses" : "/chat/completions");
  const body = endpoint === ENDPOINT_RESPONSES
    ? buildResponsesBody(config)
    : buildChatBody(config);
  const signal = composeSignal(config.signal, config.requestTimeoutMs);

  const response = await performFetch(fetchImpl, url, body, signal, config, requestId, endpoint);

  if (!response.ok) {
    throw new ProviderError(
      endpoint === ENDPOINT_RESPONSES ? "responses_4xx" : "chat_4xx",
      endpoint,
      response.status,
      requestId,
      sanitizeHttpStatus(endpoint, response.status),
    );
  }

  const rawText = await readBody(response, endpoint, requestId);
  const textPayload = extractTextPayload(endpoint, rawText);
  const review = parseReviewPayload(textPayload);
  if (review === null) {
    throw new ProviderError(
      "parse",
      endpoint,
      response.status,
      requestId,
      "Provider response did not contain a JSON review payload.",
    );
  }

  return { ok: true, endpoint, review, requestId };
}

async function performFetch(
  fetchImpl: typeof fetch,
  url: string,
  body: Record<string, unknown>,
  signal: AbortSignal,
  config: ProviderCallConfig,
  requestId: string,
  endpoint: ProviderEndpoint,
): Promise<Response> {
  try {
    return await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
        "x-request-id": requestId,
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      if (config.signal?.aborted === true) {
        throw new ProviderError("aborted", endpoint, null, requestId, "Request was aborted by the caller.");
      }
      throw new ProviderError(
        "timeout",
        endpoint,
        null,
        requestId,
        `Request to provider ${endpoint} timed out after ${config.requestTimeoutMs}ms.`,
      );
    }
    throw new ProviderError(
      "network",
      endpoint,
      null,
      requestId,
      sanitizeMessage(error, `Network error contacting provider ${endpoint}.`),
      { cause: error },
    );
  }
}

async function readBody(
  response: Response,
  endpoint: ProviderEndpoint,
  requestId: string,
): Promise<string> {
  try {
    return await response.text();
  } catch (error) {
    throw new ProviderError(
      "parse",
      endpoint,
      response.status,
      requestId,
      sanitizeMessage(error, "Failed to read provider response body."),
      { cause: error },
    );
  }
}

function shouldFallback(error: ProviderError): boolean {
  return error.status === 404 || error.status === 400;
}

function composeSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  if (signal === undefined) {
    return AbortSignal.timeout(timeoutMs);
  }
  return AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
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