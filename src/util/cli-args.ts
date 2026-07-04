/**
 * Default error class thrown by `readEnum` when an enum value is invalid.
 * The class lives here so `readEnum` can throw it without circular
 * imports between `cli-args.ts` and `parse-args.ts` (the parse-args.ts
 * file defines its own `CliUsageError` separately for parse-time
 * errors; callers that want the CLI to recognize the error can pass
 * their own constructor via `readEnum(..., { errorClass: CliUsageError })`).
 */
export class CliArgError extends Error {
  override readonly name = "CliArgError";
}

/** Push optional CLI flag values consistently; eliminates duplicated non-empty string guards in CLI builders. */
export function pushFlagValue(args: string[], flag: string, value: string | undefined): void {
  if (value !== undefined && value.length > 0) {
    args.push(flag, value);
  }
}

/** Push numeric CLI flag values consistently; eliminates repeated number-to-string flag handling. */
export function pushNumber(args: string[], flag: string, value: number): void {
  args.push(flag, String(value));
}

/** Push boolean CLI flags consistently; eliminates duplicated conditional flag append logic. */
export function pushBool(args: string[], condition: boolean, flag: string): void {
  if (condition) {
    args.push(flag);
  }
}

/** Resolve env aliases consistently; eliminates duplicated first-non-empty fallback loops. */
export function envFallback(...values: ReadonlyArray<string | undefined>): string {
  for (const value of values) {
    if (value !== undefined && value.length > 0) {
      return value;
    }
  }
  return "";
}

/**
 * Strict decimal-integer parser that REJECTS partial numeric garbage.
 * `Number.parseInt("12abc", 10)` returns 12; this helper returns null for
 * the same input so callers can fall back or throw a typed error.
 *
 * Accepts:
 *   - Optional leading `+` or `-` sign
 *   - One or more ASCII digits
 *   - Any integer that fits in `Number.isSafeInteger` (±(2^53 - 1))
 *
 * Rejects:
 *   - Empty strings
 *   - Whitespace-only strings (use `trimInt` if you need to tolerate trim)
 *   - Any non-digit content anywhere (including trailing/leading whitespace
 *     inside the body, decimal points, exponent notation)
 *   - Unsigned `"+1"` parses to 1; `"-1"` parses to -1; `"1.5"` returns null.
 *
 * This is the canonical helper for any CLI flag / env var / input field
 * that represents a strict integer. Replaces the five hand-rolled
 * `Number.parseInt + isSafeInteger` sites in `cli/parse-args.ts`,
 * `action/read-inputs.ts`, `platform/github/context.ts`, and
 * `platform/azure/context.ts` so the parsing semantics cannot drift.
 */
export function parseStrictInt(raw: string): number | null {
  if (raw.length === 0) return null;
  // A single optional sign followed by 1+ ASCII digits, and nothing else.
  // Using a regex (rather than a manual loop) keeps the intent grep-able
  // and the cost trivial (this runs only at CLI/env boundary).
  if (!/^[+-]?\d+$/u.test(raw)) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/**
 * Validate a CLI enum value against an accepted set, returning the value
 * when it matches and throwing on miss. Replaces the four hand-coded
 * enum parsers (`readPlatform`, `readEffort`, `readProvider`,
 * `readMinimumSeverity`) in `parse-args.ts` so the CLI accepts the
 * exact same set as `FIELDS.<x>.enumValues` in `field-schema.ts`.
 * Single source of truth — changing the canonical `enumValues` array
 * updates both surfaces.
 *
 * The error class is injectable via the 4th argument so callers that
 * need a typed error (e.g. `CliUsageError` in `parse-args.ts`) can
 * preserve their outer-handler contract; without an explicit class,
 * `readEnum` falls back to `CliArgError` (also exported from this
 * module). The message format matches the original hand-coded parsers
 * (`invalid --flag value: X`) so existing tests and user-facing
 * diagnostics stay byte-identical.
 *
 * The accepted set is typed `readonly T[]` so the literal union narrows
 * naturally without an explicit cast: `readEnum<CliPlatform>("--platform",
 * v, FIELDS.platform.enumValues as readonly CliPlatform[], CliUsageError)`.
 */
export function readEnum<T extends string>(
  flag: string,
  value: string,
  accepted: readonly T[],
  errorClass: new (message: string) => Error = CliArgError,
): T {
  for (const candidate of accepted) {
    if (candidate === value) {
      return candidate;
    }
  }
  throw new errorClass(`invalid ${flag} value: ${value}`);
}
