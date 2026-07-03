/**
 * Type guard for a JSON object (excludes arrays, null, primitives).
 * Replaces the 6+ copies scattered across the codebase, including one
 * buggy copy in `src/azure/run-azure-review.ts:142` that does NOT exclude
 * arrays — that copy returned `true` for any JSON including arrays.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Type guard for a JSON array (excludes objects, null, primitives).
 * Centralized so duplicated `Array.isArray(value)` checks across
 * `src/sonar/run-sonar-import.ts`, `src/azure/run-azure-review.ts`, and
 * `src/provider/provider-parse.ts` share one definition.
 */
export function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

/** Centralizes positive integer guards so CLI and provider paths stop open-coding safe-number checks. */
export function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/**
 * Safe-integer guard (zero and negatives allowed). Centralizes the
 * predicate that was inlined at 9+ sites across `src/cli/live-azure.ts`,
 * `src/cli/live-shared.ts`, `src/cli/live-github.ts`,
 * `src/cli/parse-args.ts`, `src/action/read-inputs.ts`, and
 * the platform context modules.
 */
export function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

/**
 * Type-narrowed field reader for a string value at the given key.
 * Returns `null` for missing keys or non-string values; callers can map
 * `null` to a default or surface a parse error.
 *
 * Replaces the byte-identical local copies in `src/provider/provider-parse.ts`
 * and `src/provider/copilot-token.ts` (one definition, many call sites).
 */
export function readStringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

/**
 * Throwing variant of `readStringField` for fixtures and contract-driven
 * paths that require a value to be present (S4 mocked run, RED fixtures).
 * Replaces the open-coded `typeof !== "string" throw` blocks previously
 * duplicated in `src/azure/run-azure-review.ts:142` and
 * `src/review/run-review.ts`.
 */
export function readStringFieldOrThrow(record: Record<string, unknown>, key: string, label?: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    const field = label ?? key;
    throw new TypeError(`Expected field '${field}' to be a string, received: ${typeof value}`);
  }
  return value;
}

/**
 * Type-narrowed field reader for a safe-integer number at the given key.
 * Returns `null` for missing keys, non-number values, NaN/Infinity, or
 * non-integer floats. Callers that want any safe integer (incl. 0/negative)
 * use this; callers that want a positive safe integer use
 * `isPositiveSafeInteger` directly.
 */
export function readSafeIntegerField(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return isSafeInteger(value) ? value : null;
}

/**
 * Throwing variant of `readSafeIntegerField` for fixtures and contract-driven
 * paths. Replaces the open-coded `typeof !== "number" throw` blocks
 * previously duplicated in `src/azure/run-azure-review.ts:134` and
 * `src/review/run-review.ts`.
 */
export function readSafeIntegerFieldOrThrow(record: Record<string, unknown>, key: string, label?: string): number {
  const value = record[key];
  if (!isSafeInteger(value)) {
    const field = label ?? key;
    throw new TypeError(`Expected field '${field}' to be a number, received: ${typeof value}`);
  }
  return value;
}

/**
 * Type-narrowed field reader for an array at the given key.
 * Returns `null` when the key is missing or the value is not an array.
 * The `readonly` element type signals that the returned array should not
 * be mutated; callers that want a mutable copy use `.slice()`.
 */
export function readArrayField(record: Record<string, unknown>, key: string): readonly unknown[] | null {
  const value = record[key];
  return isUnknownArray(value) ? value : null;
}

/**
 * Type-narrowed field reader for a nested JSON object at the given key.
 * Returns `null` when the key is missing or the value is not a JSON
 * object (excludes arrays and primitives). The two-step guard makes the
 * function safe to call on `unknown` records.
 */
export function readRecordField(value: unknown, key: string): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }
  const inner = value[key];
  return isRecord(inner) ? inner : null;
}

/**
 * Read-and-parse a JSON text body into a typed record. Returns `null`
 * when the body is empty OR when the parsed value is not a JSON object.
 * Centralizes the recipe that was duplicated across
 * `src/sonar/run-sonar-import.ts`, `src/review/*`, and
 * `src/platform/azure/payload.ts`.
 */
export function readJsonRecord(text: string): Record<string, unknown> | null {
  if (text.length === 0) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  return isRecord(parsed) ? parsed : null;
}

/**
 * Read-and-parse a JSON text body into a typed array. Returns `null`
 * when the body is empty OR when the parsed value is not a JSON array.
 * Centralizes the recipe that was duplicated across `src/sonar/*` and
 * the platform payload parsers.
 */
export function readJsonArray(text: string): readonly unknown[] | null {
  if (text.length === 0) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  return isUnknownArray(parsed) ? parsed : null;
}
