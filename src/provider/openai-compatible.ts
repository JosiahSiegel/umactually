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
import { REDACTED_SECRET_TOKEN } from "../util/brand.js";
import { createRequestId, joinUrl } from "../util/url.js";

const ENDPOINT_RESPONSES: ProviderEndpoint = "responses";
const ENDPOINT_CHAT: ProviderEndpoint = "chat";
const DEBUG_SECRET_PATTERNS: readonly RegExp[] = [
  /\bsk_test_[a-z_]+\b/gu,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/gu,
  /\bghp_[A-Za-z0-9]{36}\b/gu,
];

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
  // [DEBUG-RAW] Emit extracted text length + first/last 200 chars so the
  // GitHub Actions log shows what the parser actually saw. Pinned by the
  // --debug-raw-response action input. This is the only way to diagnose
  // production parse-fails without re-running the model — the action
  // does not log the raw response by default (it would dump 100+ KB to
  // the log on every run).
  if (process.env["UMACTUALLY_DEBUG_RAW"] === "1") {
    writeDebugRaw(
      `[DEBUG-RAW] requestId=${requestId} endpoint=${endpoint} ` +
      `rawTextLength=${rawText.length} textPayloadLength=${textPayload.length}\n`,
      config,
    );
    const safeTextPayload = redactDebugSecrets(textPayload, config);
    writeDebugRaw(`[DEBUG-RAW] textPayload first 200: ${JSON.stringify(safeTextPayload.slice(0, 200))}\n`, config);
    writeDebugRaw(`[DEBUG-RAW] textPayload last 200:  ${JSON.stringify(safeTextPayload.slice(-200))}\n`, config);
    writeDebugRaw(`[DEBUG-RAW] hasResponseCompletedEvent: ${rawText.includes('"type":"response.completed"')}\n`, config);
  }
  const review = parseReviewPayload(textPayload);
  // [DEBUG-RAW] Trace the parse decision so the next parse-fail run can
  // show exactly what `parseReviewPayload` returned. Without this, we
  // see "retry fired" in the log but not WHY (null vs all-empty-fields
  // vs apology-summary-detected are all indistinguishable from outside).
  if (process.env["UMACTUALLY_DEBUG_RAW"] === "1") {
    const trace = review === null
      ? "null"
      : `summary.len=${review.summary.length} verdict='${review.verdict}' comments=${review.comments.length} suppressed=${review.suppressed_comments.length}`;
    writeDebugRaw(`[DEBUG-RAW] parseReviewPayload returned: ${trace}\n`, config);
    writeDebugRaw(`[DEBUG-RAW] isNonEmptyReview: ${isNonEmptyReview(review)}\n`, config);
    // Also try the JSON extraction ourselves to see if `tryParseJson`
    // works on the whole textPayload (vs only on the balanced object).
    // If `tryParseJson(textPayload)` succeeds and returns a record, but
    // `parseReviewPayload` still returned null, the soft parse-fail
    // detector (apology-summary) is the culprit. Otherwise the
    // `extractJsonBlock` fallback path produced a non-record.
    try {
      const wholeParsed = JSON.parse(textPayload);
      const isRec = wholeParsed !== null && typeof wholeParsed === "object" && !Array.isArray(wholeParsed);
      if (isRec) {
        const s = (wholeParsed as Record<string, unknown>)["summary"];
        const v = (wholeParsed as Record<string, unknown>)["verdict"];
        const c = (wholeParsed as Record<string, unknown>)["comments"];
        const sc = (wholeParsed as Record<string, unknown>)["suppressed_comments"];
        writeDebugRaw(
          `[DEBUG-RAW] wholeJsonParse: ok summary.len=${typeof s === "string" ? s.length : "?"} ` +
          `verdict=${typeof v === "string" ? JSON.stringify(v) : "?"} ` +
          `comments=${Array.isArray(c) ? c.length : "?"} ` +
          `suppressed=${Array.isArray(sc) ? sc.length : "?"}\n`,
          config,
        );
      } else {
        writeDebugRaw(`[DEBUG-RAW] wholeJsonParse: ok but not a record (type=${typeof wholeParsed}, isArray=${Array.isArray(wholeParsed)})\n`, config);
      }
    } catch (parseErr) {
      writeDebugRaw(`[DEBUG-RAW] wholeJsonParse: FAILED (${parseErr instanceof Error ? parseErr.message : String(parseErr)})\n`, config);
    }
  }
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
      if (process.env["UMACTUALLY_DEBUG_RAW"] === "1") {
        writeDebugRaw(
          `[DEBUG-RAW] retry requestId=${requestId} ` +
          `rawTextLength=${retryRawText.length} textPayloadLength=${retryTextPayload.length}\n`,
          config,
        );
        const safeRetryTextPayload = redactDebugSecrets(retryTextPayload, config);
        writeDebugRaw(`[DEBUG-RAW] retry textPayload first 200: ${JSON.stringify(safeRetryTextPayload.slice(0, 200))}\n`, config);
        writeDebugRaw(`[DEBUG-RAW] retry textPayload last 200:  ${JSON.stringify(safeRetryTextPayload.slice(-200))}\n`, config);
      }
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

function writeDebugRaw(message: string, config: ProviderCallConfig): void {
  process.stderr.write(redactDebugSecrets(message, config));
}

function redactDebugSecrets(value: string, config: ProviderCallConfig): string {
  let redacted = value;
  for (const secret of [config.apiKey, config.promptOverride ?? "", config.additionalPromptOverride ?? ""]) {
    if (secret.length > 0) {
      redacted = redacted.split(secret).join(REDACTED_SECRET_TOKEN);
    }
  }
  for (const pattern of DEBUG_SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, REDACTED_SECRET_TOKEN);
  }
  return redacted;
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
