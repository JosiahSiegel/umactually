/**
 * Strict-integer parsing helper — leaf module that breaks the
 * `cli/parse-args.ts ↔ config/parsers.ts` circular-import cycle.
 *
 * This module's only upstream is `src/config/errors.ts`, which is itself
 * a leaf (no `cli/` imports, no back-reference to either call site). The
 * dependency direction stays strictly: `cli-args.ts → strict-integer.ts
 * → config/errors.ts` and `parsers.ts → strict-integer.ts →
 * config/errors.ts`, with `config/errors.ts` as a sink. No cycle is
 * re-introduced. Both call sites (`src/util/cli-args.ts` and
 * `src/config/parsers.ts`) consume `tryParseStrictInt` below; neither
 * needs to import the other through this path.
 *
 * ## Sign tolerance
 *
 * The helper is **sign-tolerant by design**: it accepts `"+1"`, `"-1"`,
 * `"+0"`, `"-0"` etc. The positivity / non-negativity check is the
 * CALLER's responsibility. This split keeps the helper reusable for
 * signed CLI flags (none today, but the schema may grow) while every
 * existing caller that wants positive-integer semantics already adds
 * its own `parsed <= 0` guard.
 *
 * ## Accepted shapes
 *   - Optional leading `+` or `-` sign
 *   - One or more ASCII digits
 *   - Any integer that fits in `Number.isSafeInteger` (±(2^53 - 1))
 *
 * ## Rejected shapes
 *   - Empty strings
 *   - Whitespace-only or whitespace-padded strings (callers that need
 *     to tolerate trim should `.trim()` first)
 *   - Any non-digit content anywhere (decimal points, exponent notation,
 *     trailing letters, internal whitespace)
 *
 * ## Caller contract
 *   - `tryParseStrictInt` does NOT do a `Number.isSafeInteger` check;
 *     that bound is the caller's responsibility (the CLI returns `null`
 *     for out-of-range; the config loader throws).
 *   - `parsed === 0` is a successful parse. Caller decides whether
 *     `0` is in-range.
 *   - `parsed < 0` is a successful parse. Caller decides whether
 *     negatives are in-range.
 */

/**
 * Regex matching an optional leading sign followed by one or more ASCII
 * digits, and nothing else. Anchored at both ends (no implicit matches).
 * The `u` flag is a future-proofing choice (no current consumers use
 * Unicode digits; the ASCII class is intentional — non-ASCII digits
 * silently round-trip through `Number.parseInt` with locale surprises).
 */
export const STRICT_INTEGER_RE = /^[+-]?\d+$/u;

/**
 * Parse a string as a strict decimal integer.
 *
 * Returns the parsed number on success, or `null` if `raw` is empty,
 * contains non-digit characters, or has any whitespace. Does NOT
 * enforce the safe-integer bound — the caller decides whether
 * `Number.isSafeInteger` is required.
 *
 * The caller is also responsible for the in-range semantics (positive
 * only, non-negative only, min/max bounds, etc.). This helper only
 * answers the syntactic question "is this string a well-formed
 * integer literal?".
 */
export function tryParseStrictInt(raw: string): number | null {
  if (raw.length === 0) return null;
  if (!STRICT_INTEGER_RE.test(raw)) return null;
  return Number.parseInt(raw, 10);
}
