import {
  buildChatBody,
  buildResponsesBody,
  detectProviderError,
  diagnoseParseFailure,
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
import { BRAND_PREFIX, REDACTED_SECRET_TOKEN } from "../util/brand.js";
import { createRequestId, joinUrl, redactUrlForLog, resolveProviderBaseUrlCandidates } from "../util/url.js";

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
  /**
   * Wire-format strict JSON schema. When provided, the request
   * body is sent with `response_format: { type: "json_schema", strict: true }`
   * (or `text: { format: ... }` for the Responses API) so the
   * provider enforces the schema at decode time. The in-context
   * system prompt is always present; this adds the API-level
   * constraint on top. See the citation-grounding research notes
   * for why we layer this with the path-allowlist + post-filter
   * (structured output catches shape errors; the filter catches
   * semantic errors).
   */
  readonly responseFormat?: import("./provider-parse.js").ResponseFormat;
};

export { ProviderError };
export type { ProviderEndpoint, ProviderReviewPayload };

/**
 * Project the call config down to the body shape expected by
 * `buildResponsesBody` / `buildChatBody`. The strict-schema
 * `responseFormat` rides along so the wire request carries the
 * JSON-schema constraint when the call config provides it.
 */
function buildBodyConfig(config: ProviderCallConfig): {
  readonly model: string;
  readonly system: string;
  readonly user: string;
  readonly maxOutputTokens?: number;
  readonly reasoningEffort?: "low" | "medium" | "high";
  readonly responseFormat?: import("./provider-parse.js").ResponseFormat;
} {
  return {
    model: config.model,
    system: config.system,
    user: config.user,
    ...(config.maxOutputTokens !== undefined ? { maxOutputTokens: config.maxOutputTokens } : {}),
    ...(config.reasoningEffort !== undefined ? { reasoningEffort: config.reasoningEffort } : {}),
    ...(config.responseFormat !== undefined ? { responseFormat: config.responseFormat } : {}),
  };
}

/**
 * Return a copy of the body config with `responseFormat` stripped.
 * Used by the parse-fail self-healing retry: the first attempt
 * sends the wire schema, and if the model returns prose instead of
 * JSON (because the provider silently rejected the schema), the
 * retry drops the schema and relies on the system prompt's prose
 * "Return strict JSON only" instruction.
 */
function stripResponseFormat<T extends { readonly responseFormat?: unknown }>(
  config: T,
): Omit<T, "responseFormat"> & { readonly responseFormat?: never } {
  const { responseFormat: _drop, ...rest } = config;
  void _drop;
  return rest as Omit<T, "responseFormat"> & { readonly responseFormat?: never };
}

export async function runProviderRequest(config: ProviderCallConfig): Promise<ProviderCallResult> {
  const fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const requestId = createRequestId();
  // URL resolution strategy: try the operator's URL as-pasted first
  // (after trimming trailing slashes), then fall back to the
  // origin-stripped URL with /v1/ appended. This is the "robust to
  // any URL shape" contract: no matter what path the operator typed
  // (`/v1`, `/openai`, `/anthropic`, `/api/v2`, or none at all), the
  // action finds a working endpoint.
  //
  // See resolveProviderBaseUrlCandidates in src/util/url.ts for the
  // candidate list construction.
  const baseUrlCandidates = resolveProviderBaseUrlCandidates(config.baseUrl);
  // Surface the candidate list so operators can verify the URL
  // resolution is doing what they expect. Without these annotation
  // lines, a 400/404 from the action's last attempt is opaque — the
  // operator can't tell whether the action tried the URL they pasted
  // or jumped straight to the origin+prefix form. The `::notice::`
  // annotations are visible in the GitHub Actions log and survive
  // even if the action's `process.stderr.write` is captured.
  if (baseUrlCandidates.length > 1) {
    process.stderr.write(
      `::notice::${BRAND_PREFIX}Resolving provider base URL: trying ${baseUrlCandidates.length} candidates in order: ${baseUrlCandidates.map(redactUrlForLog).join(", ")}\n`,
    );
  }

  let lastAttempt: ProviderCallResult = { ok: false, error: new ProviderError("network", ENDPOINT_RESPONSES, null, requestId, "No base URL candidates resolved.") };
  for (const candidate of baseUrlCandidates) {
    process.stderr.write(
      `::notice::${BRAND_PREFIX}Trying base URL: ${redactUrlForLog(candidate)}\n`,
    );
    const firstAttempt = await runWithRetry(config, fetchImpl, requestId, ENDPOINT_RESPONSES, candidate);
    if (firstAttempt.ok) {
      return firstAttempt;
    }
    if (shouldFallback(firstAttempt.error)) {
      const chatAttempt = await runWithRetry(config, fetchImpl, requestId, ENDPOINT_CHAT, candidate);
      if (chatAttempt.ok) {
        return chatAttempt;
      }
      // Chat fallback also failed. Move to the next URL candidate
      // (the operator-pasted URL failed → try origin-stripped, etc.)
      // unless the error is NOT a 404/400 (e.g. auth failure, server
      // error) — in that case, retrying with a different URL won't
      // help, so return immediately.
      if (!isRoutableFailure(chatAttempt.error)) {
        return chatAttempt;
      }
      process.stderr.write(
        `::notice::${BRAND_PREFIX}Base URL ${redactUrlForLog(candidate)} returned routable failure (status=${chatAttempt.error.status}); advancing to next candidate.\n`,
      );
      lastAttempt = chatAttempt;
      continue;
    }
    // The /responses endpoint failed with a non-routable status
    // (e.g. 401, 500). Retrying with a different URL won't help.
    if (!isRoutableFailure(firstAttempt.error)) {
      return firstAttempt;
    }
    process.stderr.write(
      `::notice::${BRAND_PREFIX}Base URL ${redactUrlForLog(candidate)} returned routable failure (status=${firstAttempt.error.status}); advancing to next candidate.\n`,
    );
    lastAttempt = firstAttempt;
  }
  return lastAttempt;
}

/**
 * True when the failure was a routing-level rejection (404 Not Found
 * or 400 Bad Request) that would benefit from trying a different URL
 * shape. False for auth failures (401/403), server errors (5xx),
 * parse failures, and timeouts — those have a single root cause and
 * a different URL won't help.
 */
function isRoutableFailure(error: ProviderError): boolean {
  return error.status === 404 || error.status === 400;
}

async function runWithEndpoint(
  config: ProviderCallConfig,
  fetchImpl: typeof fetch,
  requestId: string,
  endpoint: ProviderEndpoint,
  baseUrl: string,
): Promise<ProviderCallResult> {
  try {
    return await callEndpoint(config, fetchImpl, requestId, endpoint, baseUrl);
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
  baseUrl: string,
): Promise<ProviderCallResult> {
  let lastFailure: ProviderError | null = null;
  for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt += 1) {
    const result = await runWithEndpoint(config, fetchImpl, requestId, endpoint, baseUrl);
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
  // Transient network failures (no HTTP status) should be retried —
  // the connection may have been reset, the provider may be in the
  // middle of a failover, etc. Without this, a single TCP hiccup
  // kills the whole review.
  if (error.code === "network") {
    return true;
  }
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
  baseUrl: string,
): Promise<ProviderCallSuccess> {
  const url = joinUrl(baseUrl, endpoint === ENDPOINT_RESPONSES ? "/responses" : "/chat/completions");
  const body = endpoint === ENDPOINT_RESPONSES
    ? buildResponsesBody(buildBodyConfig(config))
    : buildChatBody(buildBodyConfig(config));
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
  // Surface parse-decision signals so future parse-fail runs can tell
  // whether the self-healing retry was skipped (detectProviderError
  // matched) or actually ran. The M3 model can produce a 100+ KB
  // response whose only content is reasoning — `joinOutputText`
  // returns empty and the parser correctly classifies it as
  // parse-fail, but we need to know whether the retry fired.
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

  // Provider-error detection: before attempting the self-healing
  // retry, check whether the raw response is a provider error (router
  // misconfiguration, no providers configured, invalid API key, etc.)
  // rather than a genuine parse failure. Provider errors are NOT
  // retryable — retrying with a JSON-reminder prompt won't help when
  // no model was invoked in the first place. Short-circuiting here
  // saves a wasted retry and surfaces a specific error code
  // (`provider_error`) so the live-review layer can hard-fail instead
  // of posting a 0-finding COMMENT review that exits 0.
  const providerError = detectProviderError(rawText);
  if (providerError !== null) {
    throw new ProviderError(
      "provider_error",
      endpoint,
      response.status,
      requestId,
      providerError.message,
      { rawText, providerErrorDetails: providerError },
    );
  }

  // Self-healing: parse failed on first attempt. Try once more with an
  // explicit JSON-only reminder. Some providers (notably those that
  // emit only an SSE stream of metadata events with no actual output)
  // recover cleanly when reminded to emit JSON.
  //
  // The retry DROPS the strict `response_format` constraint. Some
  // providers silently reject the wire schema and produce prose
  // instead of JSON — the retry lets the system prompt's "Return
  // strict JSON only" prose instruction carry the contract instead.
  // This makes the action dynamically adapt to any provider without
  // a hardcoded compatibility list.
  //
  // Note: any network/HTTP error on the retry is collapsed back into a
  // `parse` error (with the ORIGINAL rawText attached) so the parse-fail
  // path's diagnostic captures the actual root cause — the model
  // couldn't produce a parseable review, regardless of whether the retry
  // request itself reached the provider.
  //
  // Bumped-budget retry: some providers (notably MiniMax-M3) emit
  // long reasoning blocks that consume the entire output budget
  // before the model can write the JSON review. When the first
  // attempt's raw response is large (suggests the model produced
  // content) but the extracted text payload is small or empty
  // (suggests the actual review didn't make it through), raise
  // `maxOutputTokens` for the retry so the model has more room.
  // The retry still uses the same prompt, same schema, same model
  // — just more output budget.
  const firstAttemptBodyConfig = stripResponseFormat(buildBodyConfig(config));
  // Heuristic: when the response is "large but empty" (rawText > 16K
  // but textPayload < 200 chars), the model likely produced reasoning
  // only and was truncated before the JSON review. Double the budget
  // for the retry. Capped at 128K to avoid blowing past provider
  // limits.
  const needsMoreBudget = rawText.length > 16_000 && textPayload.length < 200;
  const bumpedMaxOutput = needsMoreBudget && config.maxOutputTokens !== undefined
    ? Math.min(config.maxOutputTokens * 2, 128_000)
    : config.maxOutputTokens;
  if (process.env["UMACTUALLY_DEBUG_RAW"] === "1" && needsMoreBudget) {
    writeDebugRaw(
      `[DEBUG-RAW] bumped-budget retry: rawText.length=${rawText.length} textPayload.length=${textPayload.length} bumpedMaxOutput=${bumpedMaxOutput}\n`,
      config,
    );
  }
  const retryBodyConfig: ReturnType<typeof buildBodyConfig> = {
    ...firstAttemptBodyConfig,
    ...(bumpedMaxOutput !== undefined ? { maxOutputTokens: bumpedMaxOutput } : {}),
  };
  const retryBody = endpoint === ENDPOINT_RESPONSES
    ? buildResponsesBody(retryBodyConfig, { userOverride: PARSE_FAIL_RETRY_PROMPT })
    : buildChatBody(retryBodyConfig, { userOverride: PARSE_FAIL_RETRY_PROMPT });
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
    // Fresh signal for the retry so it gets the full timeout budget.
    // Reusing the first-attempt signal would give the retry only
    // whatever time was left on the original 300s AbortSignal.
    // Some models (e.g. MiniMax-M3 with bumped-budget retry) need
    // 3-5 minutes per attempt.
    const retrySignal = composeSignal(config.signal, config.requestTimeoutMs);
    const retryResponse = await performFetch(fetchImpl, url, retryBody, retrySignal, config, requestId, endpoint);
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
    // Distinguish "truncated stream" (model hit its token budget before
    // emitting response.completed) from "completed stream with malformed
    // JSON" (model returned bad data). The former is actionable: the
    // operator can raise --max-output-tokens and retry. The latter
    // usually means a model regression. Both surface in the parse-fail
    // diagnostic via `ProviderError.truncated` so the render layer can
    // show different remediation advice.
    const diagnosis = diagnoseParseFailure({ rawText });
    throw new ProviderError(
      "parse",
      endpoint,
      retryResponseStatus ?? response.status,
      requestId,
      "Provider response did not contain a JSON review payload after self-healing retry.",
      {
        rawText,
        truncated: diagnosis.truncated,
        ...(diagnosis.usage !== undefined ? { usage: diagnosis.usage } : {}),
      },
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
