/**
 * Resolve a config field through the canonical precedence chain: parsed > env > fallback.
 *
 * Returns the first value in the chain that is non-null, non-undefined, AND (when a
 * string) non-empty. This matches the behavior the live path hand-rolls inline at
 * multiple sites (`parsed.X ?? env["Y"] ?? DEFAULT_Z`).
 *
 * Why this exists: the config loader (`src/config/loader.ts`) has private pickX
 * helpers used only inside loadConfigFromSources. The live path cannot call those
 * directly — it builds parsed/env from different inputs (CLI argv + action inputs +
 * env) and needs the same chain. Centralizing eliminates the 7+ hand-rolled
 * `parsed.X ?? env["Y"]` occurrences scattered across cli/ that future maintainers
 * could "fix" by adding a default to one site but not the others.
 *
 * Treats the empty string as "missing" for string-typed fields. This matches the
 * CLI's existing behavior (`parseStringFromUnknown` raises on empty input, and the
 * shell typically passes empty strings for unset flags).
 *
 * @param parsedValue  CLI/inputs value (already parsed).
 * @param envValue     Env-var value (read via ENV_KEYS.X).
 * @param fallback     The schema default (from FIELDS.<x>.defaultValue or a derived constant).
 * @returns            The first non-null/non-empty value, or `fallback`.
 */
export function resolveField<T extends string | number | boolean>(
  parsedValue: T | undefined | null,
  envValue: T | undefined | null,
  fallback: T,
): T {
  if (parsedValue !== undefined && parsedValue !== null) {
    if (typeof parsedValue === "string" && parsedValue.length === 0) {
      // Empty string is treated as missing for string fields.
    } else {
      return parsedValue;
    }
  }
  if (envValue !== undefined && envValue !== null) {
    if (typeof envValue === "string" && envValue.length === 0) {
      // Empty string from env is treated as missing.
    } else {
      return envValue;
    }
  }
  return fallback;
}
