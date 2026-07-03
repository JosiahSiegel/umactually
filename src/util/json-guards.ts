/**
 * Type guard for a JSON object (excludes arrays, null, primitives).
 * Replaces the 6+ copies scattered across the codebase, including one
 * buggy copy in `src/azure/run-azure-review.ts:142` that does NOT exclude
 * arrays — that copy returned `true` for any JSON including arrays.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Centralizes response JSON parsing so duplicated HTTP callers share one empty-body convention. */
export function readJsonResponse(text: string): unknown {
  if (text.length === 0) {
    return null;
  }
  return JSON.parse(text);
}

/** Centralizes positive integer guards so CLI and provider paths stop open-coding safe-number checks. */
export function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
