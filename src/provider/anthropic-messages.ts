/**
 * Native Anthropic Messages API client.
 *
 * Implements `POST {baseUrl}/v1/messages` against Anthropic's
 * `/v1/messages` protocol — but with the path-prefix convention of the
 * official @anthropic-ai/sdk: the operator's `baseUrl` is treated as a
 * path-prefix and `/v1/messages` is appended to it (with a guard for
 * the `/v1` and `/v1/messages` already-appended cases). This is the
 * same convention Claude Code uses for `ANTHROPIC_BASE_URL` and the
 * same fix as anthropic-sdk-kotlin's
 * https://github.com/xemantic/anthropic-sdk-kotlin/pull/145.
 *
 * Path-preserving matters because Anthropic-compatible gateways
 * commonly mount the protocol under a path prefix. For example,
 * `https://gateway.example.invalid/llm/anthropic` resolves to
 * `https://gateway.example.invalid/llm/anthropic/v1/messages`. The
 * previous "always strip the path" version of this helper silently
 * returned 404 for such gateways.
 *
 * The wire shape differs from the OpenAI Chat Completions / Responses
 * API in three meaningful ways:
 *
 *  1. **Auth header**: `x-api-key: <key>` (not `Authorization: Bearer ...`)
 *     plus the required `anthropic-version: 2023-06-01` version pin.
 *  2. **Body layout**: `system` is a top-level field, NOT a system-role
 *     message inside `messages[]`. `messages[]` only carries user/assistant
 *     turns.
 *  3. **Response body**: success returns `content: [{type:"text", text:"..."}]`
 *     and `stop_reason: "end_turn" | "max_tokens" | "tool_use" | ...`;
 *     errors are nested as `{type:"error", error:{type, message}}`.
 *
 * Anthropic does NOT support OpenAI's `response_format: { type: "json_schema", ...}`
 * constraint. The strict-JSON contract is enforced entirely by the in-context
 * system prompt and the parser — same fallback the OpenAI client uses AFTER
 * its `response_format`-stripped self-healing retry. So we never send
 * `response_format` and never strip it.
 *
 * The retry / parse-fail / bumped-budget / network-retry / provider-error
 * flows are shared byte-for-byte with `openai-compatible.ts` so the
 * end-to-end behavior (recover from parse-fail, surface truncated-stream
 * diagnostic, hard-fail on router errors) is identical regardless of which
 * provider family the operator picks.
 */
import {
  detectProviderError,
  diagnoseParseFailure,
  isNonEmptyReview,
  PARSE_FAIL_RETRY_PROMPT,
  parseReviewPayload,
  type ProviderEndpoint,
  type ProviderReviewPayload,
} from "./provider-parse.js";
import {
  ProviderError,
  sanitizeMessage,
} from "./provider-error.js";
import { buildParseFailError, computeBumpedMaxOutput, runWithRetry } from "./provider-retry.js";
import { performProviderFetch, readResponseText } from "./http.js";
import { composeSignal } from "../util/async.js";
import {
  createRequestId,
  resolveAnthropicMessagesUrl,
} from "../util/url.js";
import { isRecord, readArrayField, readRecordField, readStringField } from "../util/json-guards.js";

const ENDPOINT: ProviderEndpoint = "anthropic";
const ANTHROPIC_VERSION = "2023-06-01";

type ProviderCallSuccess = {
  readonly ok: true;
  readonly endpoint: ProviderEndpoint;
  readonly review: ProviderReviewPayload;
  readonly requestId: string;
  /**
   * Token usage block the provider emitted on the response. Surfaced
   * to the local audit artifact (Task 7) so a downstream consumer
   * can compute cost estimates from explicit per-token prices.
   * NEVER zero-invented: when the provider did not emit a usage
   * block, this field is omitted entirely.
   */
  readonly usage?: { readonly input_tokens?: number; readonly output_tokens?: number; readonly total_tokens?: number };
};

type ProviderCallFailure = {
  readonly ok: false;
  readonly error: ProviderError;
};

export type AnthropicProviderCallResult = ProviderCallSuccess | ProviderCallFailure;

export type AnthropicProviderCallConfig = {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
  readonly system: string;
  readonly user: string;
  readonly requestTimeoutMs: number;
  readonly fetchImpl?: typeof fetch;
  readonly signal?: AbortSignal;
  readonly maxOutputTokens?: number;
  /**
   * Optional reasoning-effort hint forwarded from `--effort`. Anthropic's
   * native Messages API does NOT define a `reasoning_effort` field, but
   * some Anthropic-protocol-compatible gateways (e.g. dual-protocol
   * gateways that also serve an OpenAI-style reasoning model) do honor
   * it. We forward the value as `reasoning_effort` on the wire; the
   * gateway decides what to do with it. Native Anthropic.com simply
   * ignores unknown fields per its API spec, so the worst case is a
   * no-op (the value is ignored), not a wire-shape error.
   */
  readonly reasoningEffort?: "low" | "medium" | "high";
};

export { ProviderError };

/**
 * Project the call config down to the body shape expected by
 * `buildAnthropicBody`. Anthropic accepts a top-level `system` field,
 * not a system-role message — this projection is intentionally minimal.
 */
function buildBodyConfig(config: AnthropicProviderCallConfig): {
  readonly model: string;
  readonly system: string;
  readonly user: string;
  readonly maxOutputTokens?: number;
  readonly reasoningEffort?: "low" | "medium" | "high";
} {
  return {
    model: config.model,
    system: config.system,
    user: config.user,
    ...(config.maxOutputTokens !== undefined ? { maxOutputTokens: config.maxOutputTokens } : {}),
    ...(config.reasoningEffort !== undefined ? { reasoningEffort: config.reasoningEffort } : {}),
  };
}

/**
 * Anthropic Messages API body.
 *
 * Sample wire shape (curl):
 *   curl https://api.anthropic.com/v1/messages \
 *     -H 'x-api-key: $ANTHROPIC_API_KEY' \
 *     -H 'anthropic-version: 2023-06-01' \
 *     -H 'content-type: application/json' \
 *     -d '{
 *       "model": "claude-sonnet-4.6",
 *       "max_tokens": 1024,
 *       "system": "You are a code review assistant...",
 *       "messages": [{"role": "user", "content": "..."}]
 *     }'
 *
 * Notably absent (compared to the OpenAI Chat Completions body):
 *   - `response_format` — Anthropic has no equivalent JSON-schema
 *     constraint. The system prompt enforces strict JSON, and the parser
 *     is permissive about prose-wrapped shapes.
 *   - `temperature` — Anthropic does not require it; default 1.0 (was the
 *     Anthropic-only behavior until `temperature` was added in 2024).
 *     Including it is optional and we don't.
 *   - `stream` — non-streaming JSON response; Anthropic default.
 */
export function buildAnthropicBody(
  config: {
    readonly model: string;
    readonly system: string;
    readonly user: string;
    readonly maxOutputTokens?: number;
    /**
     * Optional reasoning-effort hint forwarded from `--effort`. Anthropic's
     * native Messages API does NOT define a `reasoning_effort` field, but
     * some Anthropic-protocol-compatible gateways (e.g. dual-protocol
     * gateways that also serve an OpenAI-style reasoning model) do honor
     * it. We forward the value as `reasoning_effort` on the wire; the
     * gateway decides what to do with it. Native Anthropic.com simply
     * ignores unknown fields per its API spec, so the worst case is a
     * no-op (the value is ignored), not a wire-shape error.
     */
    readonly reasoningEffort?: "low" | "medium" | "high";
  },
  opts?: { readonly userOverride?: string },
): Record<string, unknown> {
  // See PARSE_FAIL_RETRY_PROMPT in provider-parse.ts for why we APPEND
  // the original user content instead of replacing it on retry.
  const userContent = opts?.userOverride !== undefined
    ? `${opts.userOverride}${config.user}`
    : config.user;
  const body: Record<string, unknown> = {
    model: config.model,
    system: config.system,
    messages: [
      { role: "user", content: userContent },
    ],
  };
  // Anthropic REQUIRES `max_tokens`. Without it the API rejects the
  // request with HTTP 400 (`"messages: at least one message is required"` /
  // `"max_tokens: Field required"`). We always send it; default to 4096
  // when the operator did not pin one so the call works even in tests
  // that omit the cap.
  body["max_tokens"] = config.maxOutputTokens ?? 4096;
  // Forward the operator's reasoning-effort hint when set. Omitted
  // entirely (not sent as `null`) when --effort is not set, so
  // gateways that reject unknown fields stay happy. See the field
  // docstring for the wire-compat rationale.
  if (config.reasoningEffort !== undefined) {
    body["reasoning_effort"] = config.reasoningEffort;
  }
  return body;
}

/**
 * Extract the user's text payload from an Anthropic Messages response.
 *
 * Anthropic returns `content: [{type:"text", text:"..."}]` for
 * non-streaming success responses, plus `usage` and `stop_reason`
 * fields. We concatenate ALL `text` blocks (multi-block responses can
 * happen when a tool_use block precedes or follows a text block) and
 * ignore non-text blocks (Anthropic's tool_use is a separate content
 * type we don't support).
 *
 * Returns the empty string when the response has no text blocks; the
 * downstream `parseReviewPayload` will classify that as a parse-fail
 * (per `isNonEmptyReview`), which trips the self-healing retry path.
 */
export function extractAnthropicTextPayload(rawText: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return rawText;
  }
  if (!isRecord(parsed)) {
    return rawText;
  }
  const content = readArrayField(parsed, "content");
  if (content === null) {
    // No `content` array — typical for Anthropic error envelopes that
    // use `{type:"error", error:{type, message}}` instead of `content[]`.
    // The downstream `detectProviderError` will catch that case.
    return rawText;
  }
  const fragments: string[] = [];
  for (const block of content) {
    if (!isRecord(block)) continue;
    const type = readStringField(block, "type");
    if (type !== "text") continue;
    const text = readStringField(block, "text");
    if (text !== null && text.length > 0) fragments.push(text);
  }
  return fragments.length > 0 ? fragments.join("") : rawText;
}

/**
 * Read the `stop_reason` from a parsed Anthropic response. Returns
 * `"max_tokens"` when the model hit its output budget, `null` otherwise
 * or when the field is absent. Used by `diagnoseParseFailure` to
 * distinguish "truncated stream" from "bad JSON".
 */
function readStopReason(parsed: unknown): string | null {
  if (!isRecord(parsed)) return null;
  const stopReason = readStringField(parsed, "stop_reason");
  if (stopReason === null || stopReason.length === 0) return null;
  return stopReason;
}

/**
 * Read the `usage` block from a parsed Anthropic response. Returns
 * undefined when absent or malformed — the parse-fail diagnostic only
 * surfaces usage when the provider actually reported it.
 */
function readUsage(parsed: unknown): { readonly input_tokens?: number; readonly output_tokens?: number; readonly total_tokens?: number } | undefined {
  if (!isRecord(parsed)) return undefined;
  const usage = readRecordField(parsed, "usage");
  if (usage === null || !isRecord(usage)) return undefined;
  const inputTokens = readNumberField(usage, "input_tokens");
  const outputTokens = readNumberField(usage, "output_tokens");
  const totalTokens = readNumberField(usage, "total_tokens");
  if (inputTokens === undefined && outputTokens === undefined && totalTokens === undefined) {
    return undefined;
  }
  // Build mutable then freeze-via-cast — preserves the readonly surface
  // the consumers (ProviderError.usage) expect while keeping the
  // construction site ergonomic.
  const mutable: { input_tokens?: number; output_tokens?: number; total_tokens?: number } = {};
  if (inputTokens !== undefined) mutable.input_tokens = inputTokens;
  if (outputTokens !== undefined) mutable.output_tokens = outputTokens;
  if (totalTokens !== undefined) mutable.total_tokens = totalTokens;
  return mutable as { readonly input_tokens?: number; readonly output_tokens?: number; readonly total_tokens?: number };
}

function readNumberField(record: Record<string, unknown>, key: string): number | undefined {
  const raw = record[key];
  if (typeof raw !== "number") return undefined;
  return raw;
}

export async function runAnthropicRequest(
  config: AnthropicProviderCallConfig,
): Promise<AnthropicProviderCallResult> {
  const fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const requestId = createRequestId();

  // Resolve to the full Anthropic Messages URL, preserving any
  // operator-supplied path prefix. This matches the OFFICIAL
  // @anthropic-ai/sdk convention (Claude Code's `ANTHROPIC_BASE_URL`
  // becomes `<baseURL>/v1/messages`) and the path-preserving fix in
  // https://github.com/xemantic/anthropic-sdk-kotlin/pull/145.
  //
  // Critically, this supports Anthropic-compatible gateways whose
  // endpoints live under a path prefix, such as
  // `https://gateway.example.invalid/llm/anthropic` →
  // `https://gateway.example.invalid/llm/anthropic/v1/messages`.
  //
  // Anthropic.com itself only serves `/v1/messages` at the bare host,
  // so an operator pointing at `https://api.anthropic.com/anthropic`
  // would still produce `/anthropic/v1/messages` (which 404s on
  // anthropic.com — operator error) — but that's the SDK's behavior
  // too. Self-hosted gateways under a path prefix are the supported
  // case here.
  const url = resolveAnthropicMessagesUrl(config.baseUrl);

  return runWithRetryLoop(config, fetchImpl, requestId, url);
}

async function runWithRetryLoop(
  config: AnthropicProviderCallConfig,
  fetchImpl: typeof fetch,
  requestId: string,
  url: string,
): Promise<AnthropicProviderCallResult> {
  return runWithRetry<AnthropicProviderCallResult>({
    signal: config.signal,
    endpoint: ENDPOINT,
    requestId,
    fallbackMessage: "Unknown Anthropic retry failure.",
    runOnce: () => runOnce(config, fetchImpl, requestId, url),
  });
}

async function runOnce(
  config: AnthropicProviderCallConfig,
  fetchImpl: typeof fetch,
  requestId: string,
  url: string,
): Promise<AnthropicProviderCallResult> {
  // `url` is the FULL messages URL already resolved by
  // `resolveAnthropicMessagesUrl` (which appends `/v1/messages`,
  // preserves the operator's path prefix, and short-circuits on the
  // `/v1/messages` already-appended case). No further joining is
  // needed here — appending `/messages` again would produce a doubled
  // `/v1/messages/messages` segment.
  const body = buildAnthropicBody(buildBodyConfig(config));
  const signal = composeSignal(config.signal, config.requestTimeoutMs);

  let response: Response;
  try {
    response = await performProviderFetch({
      url,
      body: JSON.stringify(body),
      signal,
      requestId,
      endpoint: ENDPOINT,
      fetchImpl,
      buildHeaders: () => buildAnthropicHeaders(config.apiKey, requestId),
    });
  } catch (error) {
    if (error instanceof ProviderError) {
      return { ok: false, error };
    }
    throw error;
  }

  if (!response.ok) {
    // Anthropic returns errors as `{type:"error", error:{type, message}}`
    // with a status (401, 404, 429, 5xx). The 4xx/5xx envelope itself
    // doesn't usually have a recognizable signal beyond the HTTP status,
    // so we just throw a typed ProviderError with the status. The
    // body text is read ONLY so the diagnostic can cite it.
    let errorBodyText = "";
    try {
      errorBodyText = await readResponseText(response, ENDPOINT, requestId);
    } catch {
      // Body read failure shouldn't mask the original status.
    }
    return {
      ok: false,
      error: new ProviderError(
        "anthropic_4xx",
        ENDPOINT,
        response.status,
        requestId,
        `Anthropic Messages API responded with HTTP ${response.status}.`,
        { ...(errorBodyText.length > 0 ? { rawText: errorBodyText } : {}) },
      ),
    };
  }

  let rawText: string;
  try {
    rawText = await readResponseText(response, ENDPOINT, requestId);
  } catch (error) {
    return {
      ok: false,
      error: new ProviderError("parse", ENDPOINT, response.status, requestId,
        sanitizeMessage(error, "Failed to read Anthropic response body."),
        { cause: error }),
    };
  }

  const textPayload = extractAnthropicTextPayload(rawText);

  // Provider-error detection: a 200 OK whose body is an Anthropic error
  // envelope (router misconfiguration, model not found, content policy
  // rejection returned with 200 OK in some setups) should be classified
  // as provider_error, NOT as a parse failure. Same logic the OpenAI
  // path runs.
  const providerError = detectProviderError(rawText);
  if (providerError !== null) {
    return {
      ok: false,
      error: new ProviderError("provider_error", ENDPOINT, response.status, requestId,
        providerError.message,
        { rawText, providerErrorDetails: providerError }),
    };
  }

  const review = parseReviewPayload(textPayload);
  if (isNonEmptyReview(review)) {
    // Try to read usage from the response body even on the success
    // path so the local audit artifact can compute cost estimates.
    let successUsage: { input_tokens?: number; output_tokens?: number; total_tokens?: number } | undefined;
    try {
      const parsedRaw: unknown = JSON.parse(rawText);
      successUsage = readUsage(parsedRaw);
    } catch {
      // rawText wasn't JSON; no usage to surface.
    }
    return {
      ok: true,
      endpoint: ENDPOINT,
      review,
      requestId,
      ...(successUsage !== undefined ? { usage: successUsage } : {}),
    };
  }

  // Empty JSON or "truncated stream" parse-fail path. We check
  // `stop_reason === "max_tokens"` AND `rawText.length > 16K` to
  // distinguish "model ran out of tokens" from "model returned bad JSON".
  // Both surface as parse errors, but the diagnostic in `truncated: true`
  // lets the operator know raising `--max-output-tokens` would help.
  let parsedStopReason: string | null = null;
  let parsedUsage: { input_tokens?: number; output_tokens?: number; total_tokens?: number } | undefined;
  try {
    const parsedRaw: unknown = JSON.parse(rawText);
    parsedStopReason = readStopReason(parsedRaw);
    parsedUsage = readUsage(parsedRaw);
  } catch {
    // rawText wasn't JSON; that's exactly why the parse failed.
  }
  const truncatedByStopReason = parsedStopReason === "max_tokens";

  // Bumped-budget retry heuristic: large empty stream → likely a
  // truncation / reasoning-only response. Re-issue with more budget.
  // Same heuristic as openai-compatible.ts.
  const bumpedMaxOutput = computeBumpedMaxOutput({
    currentBudget: config.maxOutputTokens,
    rawTextLength: rawText.length,
    textPayloadLength: textPayload.length,
  });

  // Self-healing retry with the JSON-only reminder prefix.
  const retryBodyConfig = {
    ...buildBodyConfig(config),
    ...(bumpedMaxOutput !== undefined ? { maxOutputTokens: bumpedMaxOutput } : {}),
  };
  const retryBody = buildAnthropicBody(retryBodyConfig, { userOverride: PARSE_FAIL_RETRY_PROMPT });
  let retryReview: ProviderReviewPayload | null = null;
  let retryResponseStatus: number | null = null;
  try {
    // Fresh signal: same rationale as openai-compatible.
    const retrySignal = composeSignal(config.signal, config.requestTimeoutMs);
    const retryResponse = await performProviderFetch({
      url,
      body: JSON.stringify(retryBody),
      signal: retrySignal,
      requestId,
      endpoint: ENDPOINT,
      fetchImpl,
      buildHeaders: () => buildAnthropicHeaders(config.apiKey, requestId),
    });
    retryResponseStatus = retryResponse.status;
    if (retryResponse.ok) {
      const retryRawText = await readResponseText(retryResponse, ENDPOINT, requestId);
      const retryTextPayload = extractAnthropicTextPayload(retryRawText);
      const parsedRetry = parseReviewPayload(retryTextPayload);
      if (isNonEmptyReview(parsedRetry)) {
        retryReview = parsedRetry;
      }
    }
  } catch {
    // Retry path threw — fall through to the original-rawText parse-fail
    // throw below. retryResponseStatus stays null in this branch.
  }

  if (retryReview !== null) {
    return { ok: true, endpoint: ENDPOINT, review: retryReview, requestId };
  }

  // Distinguish "truncated stream" from "completed but malformed" by
  // checking the ORIGINAL response's stop_reason. When the first
  // attempt ended at `max_tokens`, the operator's remediation is to
  // raise `--max-output-tokens`; otherwise the model returned bad JSON
  // (model regression or schema mismatch).
  const diagnosis = diagnoseParseFailure({ rawText });
  // diagnoseParseFailure's `truncated` heuristic is based on a missing
  // SSE-completed event marker; for Anthropic that marker doesn't apply,
  // so override with our explicit stop_reason check when we have one.
  const effectiveTruncated = truncatedByStopReason || diagnosis.truncated;
  // Prefer the Anthropic-reported usage over the diagnosis's
  // SSE-completed-event-derived `usage`.
  const usage = parsedUsage ?? diagnosis.usage;

  return {
    ok: false,
    error: buildParseFailError({
      endpoint: ENDPOINT,
      status: retryResponseStatus ?? response.status,
      requestId,
      message: "Anthropic response did not contain a JSON review payload after self-healing retry.",
      rawText,
      truncated: effectiveTruncated,
      ...(usage !== undefined ? { usage } : {}),
    }),
  };
}

/**
 * Build the headers for an Anthropic Messages request. Exported so the
 * test fixture can pin the exact shape. The api-key comes from the call
 * config, NOT from the body, because we don't want the key landing in
 * any request artifact / log / debug dump.
 */
export function buildAnthropicHeaders(apiKey: string, requestId: string): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
    "x-request-id": requestId,
  };
}
