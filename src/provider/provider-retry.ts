/**
 * Shared retry-loop helpers for provider clients.
 *
 * The OpenAI-compatible, Anthropic Messages, and Copilot providers each
 * implement the same retry/backoff pattern with provider-specific
 * `runOnce` callbacks. These helpers consolidate the pieces that are
 * byte-identical (or near-byte-identical) across the three: the
 * backoff schedule, the retryable-error predicate, the abort-bailout
 * block, and the bumped-budget heuristic. Provider-specific call sites
 * wire the `runOnce` callback to their own request/parse logic.
 */
import { ProviderError, type ProviderEndpoint } from "./provider-error.js";
import { sleep } from "../util/async.js";

/**
 * Backoff schedule for transient-error retries. Attempt 0 fires
 * immediately; attempt 1 sleeps 250ms first; attempt 2 sleeps 1s
 * first; then the loop returns the last failure.
 *
 * Three attempts total (initial + 2 retries). Empirically tuned: 250ms
 * is enough to clear a TCP RST on the same connection pool, 1s is
 * enough to clear a transient router/scheduler hiccup, and longer
 * waits don't materially improve recovery rate.
 */
export const RETRY_BACKOFF_MS: ReadonlyArray<number> = [250, 1_000];

/**
 * True when `error` represents a transient failure that the next retry
 * might recover from:
 *   - `network` (no HTTP status, e.g. connection reset, DNS hiccup)
 *   - `timeout` (slow stream, gateway reset)
 *   - HTTP 429 (rate limit, often retried after backoff)
 *   - HTTP >= 500 (server-side failure, often retried after backoff)
 *
 * Provider-specific failures (`parse`, `provider_error`, `aborted`,
 * `4xx other than 429`) are NOT retried — retrying them would just
 * re-surface the same broken state.
 */
export function isRetryable(error: ProviderError): boolean {
  if (error.code === "network") return true;
  if (error.code === "timeout") return true;
  return error.status === 429 || (typeof error.status === "number" && error.status >= 500);
}

/**
 * Bail early when the caller's AbortSignal is already aborted, BEFORE
 * composing the next retry's timeout signal.
 *
 * Without this guard, the next `runOnce` would compose a fresh
 * timeout AbortController with an already-aborted caller signal.
 * `AbortSignal.any([aborted, ...])` is itself aborted, so the next
 * fetch would fail immediately with a "timeout" error — even though
 * the underlying connection was healthy. That makes the
 * "timeout is transient, retry it" rationale void (we'd be reporting
 * a fake timeout, not a real one).
 *
 * Returns a `{ ok: false, error: ProviderError("aborted", ...) }`
 * failure when the signal is aborted, otherwise `null`. The caller
 * short-circuits its retry loop on the failure result.
 */
export function bailIfAborted(args: {
  readonly signal: AbortSignal | undefined;
  readonly endpoint: ProviderEndpoint;
  readonly requestId: string;
}): { readonly ok: false; readonly error: ProviderError } | null {
  if (args.signal?.aborted !== true) return null;
  return {
    ok: false,
    error: new ProviderError(
      "aborted",
      args.endpoint,
      null,
      args.requestId,
      "Caller aborted the request before retry.",
    ),
  };
}

/**
 * Compute the bumped `maxOutputTokens` for the parse-fail retry.
 *
 * When the first attempt's raw response is "large but empty"
 * (`rawText.length > 16_000 && textPayload.length < 200`), the model
 * likely produced a reasoning-only response that got truncated before
 * the JSON review. Double the budget for the retry so the model has
 * more room. Capped at 128K to avoid blowing past provider limits.
 *
 * Returns `undefined` when no bump is warranted — the caller should
 * then pass `undefined` (or simply omit the field) on the wire body
 * to preserve `exactOptionalPropertyTypes`.
 *
 * The `currentBudget` argument is the cap from the call config (may
 * itself be undefined for providers that don't pin one).
 */
export function computeBumpedMaxOutput(args: {
  readonly currentBudget: number | undefined;
  readonly rawTextLength: number;
  readonly textPayloadLength: number;
}): number | undefined {
  if (args.currentBudget === undefined) return undefined;
  const needsMore = args.rawTextLength > 16_000 && args.textPayloadLength < 200;
  return needsMore ? Math.min(args.currentBudget * 2, 128_000) : args.currentBudget;
}

/**
 * Generic retry loop shared by every provider client.
 *
 * Calls `runOnce` repeatedly until one of three exit conditions:
 *   1. `runOnce` succeeds (returns `{ ok: true, ... }`) — propagate as-is.
 *   2. `runOnce` returns a non-retryable error (per `isRetryable`) — propagate
 *      the error result without burning another attempt.
 *   3. The retry budget (`RETRY_BACKOFF_MS.length` retries) is exhausted —
 *      return the last failure wrapped in a generic "retry failure" envelope.
 *
 * Each provider client supplies its own `runOnce` callback that performs
 * the request/parse step. The callback's return shape is provider-specific
 * (e.g. `ProviderCallResult` for openai-compatible, `AnthropicProviderCallResult`
 * for anthropic-messages), so the helper is generic over the result shape —
 * callers narrow via TypeScript generics at the call site.
 *
 * Before each attempt, calls `bailIfAborted` to short-circuit when the
 * caller's `AbortSignal` is already aborted (would otherwise produce a
 * fake-timeout error after composing with an aborted signal).
 */
export async function runWithRetry<T extends { readonly ok: true } | { readonly ok: false; readonly error: ProviderError }>(args: {
  readonly signal: AbortSignal | undefined;
  readonly runOnce: () => Promise<T>;
  readonly endpoint: ProviderEndpoint;
  readonly requestId: string;
  readonly fallbackMessage: string;
}): Promise<T> {
  let lastFailure: ProviderError | null = null;
  for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt += 1) {
    const bail = bailIfAborted({ signal: args.signal, endpoint: args.endpoint, requestId: args.requestId });
    if (bail !== null) {
      return bail as unknown as T;
    }
    const result = await args.runOnce();
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
  return {
    ok: false,
    error: lastFailure ?? new ProviderError("network", args.endpoint, null, args.requestId, args.fallbackMessage),
  } as unknown as T;
}

export { sleep };
