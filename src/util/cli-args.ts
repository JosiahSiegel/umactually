import { tryParseStrictInt } from "./strict-integer.js";

/**
 * Strict decimal-integer parser that REJECTS partial numeric garbage.
 * `Number.parseInt("12abc", 10)` returns 12; this helper returns null for
 * the same input so callers can fall back or throw a typed error.
 *
 * ## Sign tolerance
 *
 * The helper is **sign-tolerant by design**: it accepts `"+1"`, `"-1"`,
 * `"+0"`, `"-0"` etc. The positivity / non-negativity check is the
 * CALLER's responsibility (see `parsePrNumber` for `parsed <= 0` and
 * `readAzurePrNumber` for the same). This split keeps the helper
 * reusable for signed CLI flags (none today, but the schema may grow)
 * while every existing caller that wants positive-integer semantics
 * already adds its own `parsed <= 0` guard.
 *
 * ## Accepted shapes
 *   - Optional leading `+` or `-` sign
 *   - One or more ASCII digits
 *   - Any integer that fits in `Number.isSafeInteger` (±(2^53 - 1))
 *
 * ## Rejected shapes
 *   - Empty strings
 *   - Whitespace-only or whitespace-padded strings (callers that need
 *     to tolerate trim should `.trim()` first — see action/read-inputs.ts)
 *   - Any non-digit content anywhere (decimal points, exponent notation,
 *     trailing letters, internal whitespace)
 *
 * ## Caller contract
 *   - `parsed === null` means "not a valid strict integer". Caller
 *     decides whether to throw, fall back to a default, or branch.
 *   - `parsed === 0` is a successful parse. Caller decides whether
 *     `0` is in-range.
 *   - `parsed < 0` is a successful parse. Caller decides whether
 *     negatives are in-range.
 *
 * This is the canonical helper for any CLI flag / env var / input field
 * that represents a strict integer. Replaces the five hand-rolled
 * `Number.parseInt + isSafeInteger` sites in `cli/parse-args.ts`,
 * `action/read-inputs.ts`, `platform/github/context.ts`, and
 * `platform/azure/context.ts` so the parsing semantics cannot drift.
 */
export function parseStrictInt(raw: string): number | null {
  const n = tryParseStrictInt(raw);
  return n !== null && Number.isSafeInteger(n) ? n : null;
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
 * The error class is **required** and is passed in by the caller so it
 * can preserve its outer-handler contract (e.g. `CliUsageError` in
 * `parse-args.ts`). The message format matches the original hand-coded
 * parsers (`invalid --flag value: X`) so existing tests and user-facing
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
  errorClass: new (message: string, hint?: string) => Error,
): T {
  for (const candidate of accepted) {
    if (candidate === value) {
      return candidate;
    }
  }
  // Hint the operator at the accepted values alongside the bare
  // "invalid --flag value" error so they don't need to dig through
  // --help. Cheap deterministic suggestion: list the accepted values,
  // capped at 8 entries (enum values past 8 are usually an internal
  // schema bug, not a user-facing surface).
  const acceptedPreview =
    accepted.length <= 8
      ? accepted.join(", ")
      : `${accepted.slice(0, 8).join(", ")}, ...`;
  const hint = `Accepted values for ${flag}: ${acceptedPreview}. Run \`umactually --help\` or \`umactually review --help\` for the full list of flags and their accepted shapes.`;
  throw new errorClass(`invalid ${flag} value: ${value}`, hint);
}

/**
 * Compute a "did you mean ...?" suggestion for an unknown CLI flag.
 *
 * Returns the closest known flag by Levenshtein distance, or `null` when
 * no known flag is reasonably close. Empty/null input returns null.
 *
 * The threshold is calibrated so single-character transpositions on
 * longer flags ("--minimun-severity" for "--minimum-severity") still
 * suggest a match, while completely-different flags
 * ("--platformx" vs "--platform") do not. The exact cut-off for the
 * returned distance is `Math.max(2, Math.floor(input.length / 4))`
 * which scales with flag length: short flags get a tight tolerance, long
 * flags get a looser one (intentional — typed-by-eye typos on long
 * flags are usually 1-2 characters off).
 *
 * Pure function — no side effects, no I/O, deterministic. Safe to call
 * at parse-time.
 */
export function didYouMean(
  input: string,
  candidates: readonly string[],
): string | null {
  if (input.length === 0) return null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestCandidate: string | null = null;
  const maxDistance = Math.max(2, Math.floor(input.length / 4));
  for (const candidate of candidates) {
    const distance = levenshtein(input, candidate);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestCandidate = candidate;
    }
  }
  return bestDistance <= maxDistance ? bestCandidate : null;
}

/**
 * Classic iterative Levenshtein distance with two rolling rows.
 * O(n*m) time, O(min(n,m)) space. Empty-string handling: distance is
 * the length of the other string. Use via `didYouMean`; exported for
 * unit-test reachability rather than direct consumer use.
 */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = new Array<number>(b.length + 1);
  let current = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) previous[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      const deletion = (previous[j] ?? 0) + 1;
      const insertion = (current[j - 1] ?? 0) + 1;
      const substitution = (previous[j - 1] ?? 0) + cost;
      current[j] = Math.min(deletion, insertion, substitution);
    }
    const swap = previous;
    previous = current;
    current = swap;
  }
  return previous[b.length] ?? 0;
}
