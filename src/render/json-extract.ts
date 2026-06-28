/**
 * Extract the most likely JSON payload from a provider text response.
 *
 * Order of attempts (mirrors the fence-closure guard in src/render/raw-output.ts):
 *   1. The whole text, parsed as JSON.
 *   2. A ```json ... ``` fence body, parsed as JSON.
 *   3. The first balanced { ... } object, parsed as JSON.
 *
 * Returns the parsed value when one of the attempts succeeds, otherwise null.
 * The whole text is always returned to the caller via `extractJsonBlock` so they
 * can decide what to do with raw context on failure (see renderRawReviewFallback).
 */
export function extractJsonBlock(rawText: string): unknown {
  const wholeAttempt = tryParseJson(rawText);
  if (wholeAttempt !== undefined) {
    return wholeAttempt;
  }

  const fencedAttempt = tryParseJson(extractJsonFenceBody(rawText));
  if (fencedAttempt !== undefined) {
    return fencedAttempt;
  }

  const balanced = extractFirstBalancedObject(rawText);
  if (balanced !== null) {
    const balancedAttempt = tryParseJson(balanced);
    if (balancedAttempt !== undefined) {
      return balancedAttempt;
    }
  }

  return null;
}

/**
 * Find the body of a ```json ... ``` fence, or return the original text when none.
 * Exposed so callers can reuse the fence-closure guard from raw-output.ts.
 */
export function extractJsonFenceBody(rawText: string): string {
  const fenceMatch = /```json\s*\n([\s\S]*?)\n```/.exec(rawText);
  const body = fenceMatch?.[1];

  return body ?? rawText;
}

/**
 * Locate the first balanced `{ ... }` object in `rawText`, respecting nested
 * braces and quoted strings (including \" escapes). Returns null when no
 * balanced object can be found.
 */
export function extractFirstBalancedObject(rawText: string): string | null {
  const startIndex = rawText.indexOf("{");
  if (startIndex === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let index = startIndex; index < rawText.length; index += 1) {
    const char = rawText[index];

    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (char === "\\") {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{") {
      depth += 1;
      continue;
    }
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return rawText.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}

function tryParseJson(candidate: string): unknown {
  try {
    return JSON.parse(candidate);
  } catch {
    return undefined;
  }
}