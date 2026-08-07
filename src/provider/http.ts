/**
 * Shared HTTP transport helpers for provider clients.
 *
 * `performProviderFetch` and `readResponseText` consolidate the
 * fetch-level concerns that every provider client previously
 * re-implemented inline:
 *
 *  - `performProviderFetch` — POST a JSON body with provider-specific
 *    headers, pre-flight abort check, and try/catch around the fetch
 *    call that maps abort / network failures to typed `ProviderError`s.
 *    Returns the raw `Response`; the caller still owns the
 *    `response.ok` / status-code mapping so each provider's specific
 *    4xx code (`responses_4xx` / `chat_4xx` / `anthropic_4xx`) stays
 *    at the call site.
 *  - `readResponseText` — best-effort `response.text()` wrapper that
 *    maps a body-read failure to `ProviderError("parse")`.
 *
 * The three provider clients (`openai-compatible`, `anthropic-messages`,
 * `copilot`) each had a near-byte-identical inline fetch wrapper; this
 * module is the single byte-identical implementation they all now
 * delegate to.
 */
import {
  isAbortError,
  ProviderError,
  sanitizeMessage,
  type ProviderEndpoint,
} from "./provider-error.js";

export type FetchImpl = typeof fetch;

/**
 * Input for `performProviderFetch`. The body is pre-serialized by the
 * caller so the helper does not need to know the body shape — keeping
 * the wire-format concerns (`buildResponsesBody` vs `buildChatBody` vs
 * `buildAnthropicBody`) at the call sites preserves the false-DRY
 * §4.1 contract.
 */
export type PerformProviderFetchInput = {
  readonly url: string;
  readonly body: string;
  /**
   * The composed signal (caller signal + per-request timeout). Pre-abort
   * check uses `signal.aborted` to short-circuit before invoking
   * `fetchImpl`; this is the new caller-aborted branch Copilot gains
   * (its inline `fetchImpl` previously had no such check).
   */
  readonly signal: AbortSignal | undefined;
  readonly requestId: string;
  readonly endpoint: ProviderEndpoint;
  readonly fetchImpl: FetchImpl;
  /** Returns the headers for this specific request. Called once per fetch. */
  readonly buildHeaders: () => Record<string, string>;
};

/**
 * POST `body` to `url` using `fetchImpl` with the headers returned by
 * `buildHeaders`. Throws `ProviderError("aborted")` when `signal` is
 * already aborted before the call (caller-initiated abort), `ProviderError("timeout")`
 * when `fetchImpl` itself throws an abort error during the request
 * (the composed timeout fired), or `ProviderError("network")` on any
 * other fetch failure. Returns the raw `Response` so the caller can
 * inspect `response.ok` and decide its own 4xx mapping.
 */
export async function performProviderFetch(input: PerformProviderFetchInput): Promise<Response> {
  // Pre-flight abort check. The Copilot call site did not have this
  // branch before the refactor (its inline fetchImpl just called fetch
  // without checking signal.aborted). Routing through this helper is
  // the strict bug fix the PR accepts as a Copilot behavior change:
  // pre-aborted signals now surface a typed "aborted" error rather
  // than the leaked-connection / leaked-timeout mix that used to
  // result. Pinned by a test in `test/unit/provider-http.test.ts`.
  if (input.signal?.aborted === true) {
    throw new ProviderError(
      "aborted",
      input.endpoint,
      null,
      input.requestId,
      "Request was aborted by the caller.",
    );
  }
  try {
    return await input.fetchImpl(input.url, {
      method: "POST",
      headers: input.buildHeaders(),
      body: input.body,
      ...(input.signal !== undefined ? { signal: input.signal } : {}),
    });
  } catch (error) {
    if (isAbortError(error)) {
      // fetchImpl threw an abort — that's the composed timeout firing
      // (the pre-abort case above already returned for caller-aborts).
      throw new ProviderError(
        "timeout",
        input.endpoint,
        null,
        input.requestId,
        `Request to provider ${input.endpoint} timed out.`,
      );
    }
    throw new ProviderError(
      "network",
      input.endpoint,
      null,
      input.requestId,
      sanitizeMessage(error, `Network error contacting provider ${input.endpoint}.`),
      { cause: error },
    );
  }
}

/**
 * Read the response body as text. Throws `ProviderError("parse")` when
 * `response.text()` itself throws (truncated stream, broken socket,
 * decode failure). Provider-specific JSON-shape parse failures are
 * handled at the call sites — this helper only owns the read step.
 */
export async function readResponseText(
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
