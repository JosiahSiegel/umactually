import {
  buildChatBody,
  buildResponsesBody,
  extractTextPayload,
  isNonEmptyReview,
  PARSE_FAIL_RETRY_PROMPT,
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
import { composeSignal, sleep } from "../util/async.js";
import { createRequestId, joinUrl } from "../util/url.js";

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

/**
 * Self-healing follow-up message sent to the model when its first response
 * could not be parsed as a JSON review payload. Some providers ignore
 * `stream: false` and return an empty SSE stream; some wrap their output
 * in markdown fences or prose; some omit the JSON entirely. We retry
 * once with an explicit reminder before falling back to the parse-fail
 * surface — that often recovers the review without operator intervention.
 *
 * The shared prompt constant lives in `provider-parse.ts` so the Copilot
 * path can reuse it byte-for-byte (DRY-12).
 */

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
  // Treat an empty-summary+empty-verdict parse as a parse failure even
  // when `extractJsonBlock` returned an object. The parser is permissive
  // about JSON shape (returns `ProviderReviewPayload` with empty fields
  // for any JSON object), so a chat-format response (`{choices: [...]}`)
  // fed to the responses endpoint can otherwise pass as a 0-finding
  // "empty review" — see CLARITY-10.
  if (isNonEmptyReview(review)) {
    return { ok: true, endpoint, review, requestId };
  }

  // Self-healing: parse failed on first attempt. Try once more with an
  // explicit JSON-only reminder. Some providers (notably those that
  // emit only an SSE stream of metadata events with no actual output)
  // recover cleanly when reminded to emit JSON.
  //
  // Note: any network/HTTP error on the retry is collapsed back into a
  // `parse` error (with the ORIGINAL rawText attached) so the parse-fail
  // path's diagnostic captures the actual root cause — the model
  // couldn't produce a parseable review, regardless of whether the retry
  // request itself reached the provider.
  const retryBody = endpoint === ENDPOINT_RESPONSES
    ? buildResponsesBody(config, { userOverride: PARSE_FAIL_RETRY_PROMPT })
    : buildChatBody(config, { userOverride: PARSE_FAIL_RETRY_PROMPT });
  let retryReview: ProviderReviewPayload | null = null;
  // Track the retry's HTTP status (if it reached performFetch and
  // returned a response) so the parse-fail ProviderError can surface
  // it. When the retry fails with HTTP 4xx/5xx, that's the most
  // informative root cause; when the retry succeeds with a still-
  // unparseable payload, the ORIGINAL response status is the right
  // signal — the model couldn't produce a review, not a transport
  // failure. Both cases match `src/provider/copilot.ts`'s contract.
  let retryResponseStatus: number | null = null;
  try {
    const retryResponse = await performFetch(fetchImpl, url, retryBody, signal, config, requestId, endpoint);
    retryResponseStatus = retryResponse.status;
    if (retryResponse.ok) {
      const retryRawText = await readBody(retryResponse, endpoint, requestId);
      const retryTextPayload = extractTextPayload(endpoint, retryRawText);
      const parsedRetry = parseReviewPayload(retryTextPayload);
      // Same strict check on the retry: must have actual review content.
      if (isNonEmptyReview(parsedRetry)) {
        retryReview = parsedRetry;
      }
    }
  } catch {
    // Retry HTTP/parse path threw (network error, body read error,
    // etc.) — fall through to the parse-error throw below with the
    // ORIGINAL rawText. retryResponseStatus stays null in this branch.
  }
  if (retryReview === null) {
    throw new ProviderError(
      "parse",
      endpoint,
      retryResponseStatus ?? response.status,
      requestId,
      "Provider response did not contain a JSON review payload after self-healing retry.",
      { rawText },
    );
  }

  return { ok: true, endpoint, review: retryReview, requestId };
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
