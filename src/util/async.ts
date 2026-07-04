/** Promise-based timer shared by async provider code; eliminates duplicated sleep helpers. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Combine a caller-provided `AbortSignal` with a per-request timeout into a
 * single signal that fires when EITHER side aborts. When no caller signal
 * is supplied, returns a plain timeout signal. Shared by the OpenAI-
 * compatible and Copilot provider paths so the abort-composition semantics
 * stay byte-identical regardless of which endpoint is in use.
 */
export function composeSignal(
  callerSignal: AbortSignal | undefined,
  timeoutMs: number,
): AbortSignal {
  if (callerSignal === undefined) {
    return AbortSignal.timeout(timeoutMs);
  }
  return AbortSignal.any([callerSignal, AbortSignal.timeout(timeoutMs)]);
}