/**
 * Single boundary for the `UMACTUALLY_DEBUG_RAW` env-var toggle. The literal
 * name used to appear at 10 sites across 3 files (provider/openai-compatible.ts,
 * render/json-extract.ts, cli/run.ts); every site asked the same question —
 * "is debug-raw logging on?" — and every site did the env-var lookup inline.
 *
 * Centralizing the lookup here means:
 *   - the env-var name is named in exactly one place (`DEBUG_RAW_ENV`),
 *   - read sites stay a one-liner (`if (isDebugRawActive()) { ... }`),
 *   - the dispatcher's set/restore semantics (`cli/run.ts`'s try/finally)
 *     get a typed helper that cannot leak `process.env` state on throw.
 *
 * Behavior is preserved bit-for-bit: `isDebugRawActive()` is exactly
 * `process.env["UMACTUALLY_DEBUG_RAW"] === "1"`, and `withDebugRawEnv`
 * performs the same capture/restore dance the inline code did (delete
 * the var if it was undefined before, restore the previous value if it
 * was set).
 */

/** Env-var name. Single source of truth. */
export const DEBUG_RAW_ENV = "UMACTUALLY_DEBUG_RAW";

/** True when debug-raw logging is enabled for the current process. */
export function isDebugRawActive(): boolean {
  return process.env[DEBUG_RAW_ENV] === "1";
}

/**
 * Run `fn` with `UMACTUALLY_DEBUG_RAW` set to `"1"` when `enabled` is true.
 *
 * Set/restore semantics — behavior-preserving against the prior inline
 * pattern in `cli/run.ts`:
 *   1. Capture `process.env[DEBUG_RAW_ENV]` (may be undefined).
 *   2. If `enabled`, write `"1"`; otherwise leave env untouched.
 *   3. Run `fn()`; if it throws, the error propagates AFTER the restore.
 *   4. In `finally`: if the prior value was undefined, delete the var;
 *      otherwise restore it verbatim.
 *
 * Pass-through when `enabled` is false so callers that gate on a parsed
 * CLI flag (`withDebugRawEnv(parsed.debugRawResponse === true, fn)`)
 * don't touch `process.env` at all on the off-path.
 */
export async function withDebugRawEnv<T>(
  enabled: boolean,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = process.env[DEBUG_RAW_ENV];
  if (enabled) {
    process.env[DEBUG_RAW_ENV] = "1";
  }
  try {
    return await fn();
  } finally {
    if (previous === undefined) {
      delete process.env[DEBUG_RAW_ENV];
    } else {
      process.env[DEBUG_RAW_ENV] = previous;
    }
  }
}