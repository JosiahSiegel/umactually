import { tryParseJson } from "../util/json-guards.js";

/**
 * Extract the most likely JSON payload from a provider text response.
 *
 * Order of attempts (mirrors the fence-closure guard in src/render/raw-output.ts):
 *   1. The whole text, parsed as JSON.
 *   2. A ```json ... ``` fence body, parsed as JSON.
 *   3. The first balanced { ... } object, parsed as JSON — with control
 *      characters inside JSON strings escaped to make the substring
 *      valid JSON (see `extractFirstBalancedObject`).
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

  const fenceBody = extractJsonFenceBody(rawText);
  const fencedAttempt = tryParseJson(fenceBody);
  if (fencedAttempt !== undefined) {
    return fencedAttempt;
  }

  const balanced = extractFirstBalancedObject(rawText);
  if (balanced !== null) {
    const balancedAttempt = tryParseJson(balanced);
    if (balancedAttempt !== undefined) {
      return balancedAttempt;
    } else if (process.env["UMACTUALLY_DEBUG_RAW"] === "1") {
      try {
        JSON.parse(balanced);
      } catch (e) {
        process.stderr.write(`[DEBUG-RAW] balanced-parse failed at length ${balanced.length}: ${e instanceof Error ? e.message : String(e)}\n`);
        // Show the char at the failure position
        const pos = 16692;  // known from last run
        if (pos < balanced.length) {
          const start = Math.max(0, pos - 50);
          const end = Math.min(balanced.length, pos + 50);
          process.stderr.write(`[DEBUG-RAW] around pos ${pos}: ${JSON.stringify(balanced.slice(start, end))}\n`);
        }
      }
    }
  }

  return null;
}

/**
 * Find the body of a ```...``` fence (with or without a language tag),
 * or return the original text when none. Exposed so callers can reuse
 * the fence-closure guard from raw-output.ts.
 *
 * Accepts any opening fence (```` ```json ````, ```` ```json5 ````, or just
 * ```` ``` ````) because the model sometimes drops the language tag from
 * markdown code blocks wrapping a JSON payload. The matching closing
 * fence is found lazily after the first newline, so the body's content
 * is captured verbatim including internal whitespace and newlines.
 *
 * Two newline shapes are accepted at the fence boundaries:
 *   1. Real newlines (0x0A) — the response arrived as a raw markdown
 *      block outside any JSON envelope.
 *   2. JSON-escaped `\n` (the 2-char sequence backslash + n) — the
 *      response arrived as a string value inside a JSON envelope (e.g.
 *      an SSE `response.output_text.delta` event). The model wrote the
 *      fence boundaries using JSON-escaped newlines because the entire
 *      response was itself a JSON string. The first regex (real newlines)
 *      does NOT match this shape; without the second regex, the fence
 *      body would not be extracted and the parser would fall through to
 *      the balanced-object fallback, which can return null on long
 *      payloads (regression observed 2026-07-05T23:59:46Z, requestId
 *      771a64b3). The two alternations are tried in order; the first
 *      match wins.
 */
export function extractJsonFenceBody(rawText: string): string {
  // Real-newline boundaries: ```[tag]\n[body]\n```
  const realNewline = /```[a-zA-Z0-9_+\-]*\s*\n([\s\S]*?)\n```/.exec(rawText);
  // JSON-escaped-newline boundaries: ```[tag]\n[body]\n```  (where \n is
  // the literal 2-char sequence). The opening ```[tag] is followed by
  // either a real newline OR the 2-char escape, same for the closing.
  // In a regex literal, the 2-char sequence `\n` requires 4 backslashes
  // (`\\\\n` in source → `\\n` in the regex pattern → matches literal
  // backslash + n in input).
  const escapedNewline = /```[a-zA-Z0-9_+\-]*\s*\\n([\s\S]*?)\\n```/u.exec(rawText);

  let body: string | undefined = realNewline?.[1] ?? escapedNewline?.[1];
  if (body !== undefined && escapedNewline !== null && realNewline === null) {
    // The body was extracted from a JSON-escaped-newline fence. The
    // content was the inside of a JSON string, so its `\n` characters
    // are 2-char escapes, NOT real newlines. To make this parseable
    // as a JSON object, we need to convert the 2-char `\n` (and
    // other JSON escapes) to their real-character equivalents. Wrap
    // the body in a JSON string and re-parse so the standard JSON
    // unescape logic handles the conversion.
    try {
      body = JSON.parse('"' + body.replace(/"/gu, '\\"') + '"');
    } catch {
      // Body is not a valid JSON-string-encoded value; fall through
      // and return it as-is so the caller's `tryParseJson` (and the
      // balanced-object fallback) can try other shapes.
    }
  }
  return body ?? rawText;
}

/**
 * Locate the first balanced `{ ... }` object in `rawText`, respecting nested
 * braces and quoted strings (including \" escapes). Returns null when no
 * balanced object can be found.
 *
 * Returns a JSON-safe substring with literal control characters (newlines,
 * tabs, carriage returns) inside JSON strings escaped to their JSON-escape
 * equivalents (`\n`, `\t`, `\r`). This is required for parser robustness
 * because some provider streaming formats (notably SSE `response.output_text.delta`
 * events) JSON-encode delta values such that the JSON-escape for newline
 * (`\n`) becomes a literal newline in the SSE data line source — and the
 * SSE protocol treats that newline as a line break. After concatenating
 * fragments, the result contains literal newlines inside what should be
 * JSON strings, which makes the substring invalid JSON. This function walks
 * the balanced substring and escapes those control characters back to their
 * JSON-escape equivalents so the result is valid JSON.
 *
 * Newlines/tabs OUTSIDE strings (structural whitespace between fields) are
 * preserved — they're already valid JSON whitespace.
 */
export function extractFirstBalancedObject(rawText: string): string | null {
  const startIndex = rawText.indexOf("{");
  if (startIndex === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escape = false;

  // First pass: find the end index of the balanced object.
  let endIndex = -1;
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
        endIndex = index;
        break;
      }
    }
  }

  if (endIndex === -1) {
    return null;
  }

  // Second pass: walk the balanced substring and escape literal control
  // characters that appear INSIDE JSON strings. We re-walk because the
  // first pass above only tracked depth, not the output positions.
  const substring = rawText.slice(startIndex, endIndex + 1);
  const segments: string[] = [];
  inString = false;
  escape = false;
  for (let index = 0; index < substring.length; index += 1) {
    const char = substring.charAt(index);
    if (inString) {
      if (escape) {
        segments.push(char);
        escape = false;
        continue;
      }
      if (char === "\\") {
        segments.push(char);
        escape = true;
        continue;
      }
      if (char === '"') {
        segments.push(char);
        inString = false;
        continue;
      }
      // Inside a string: escape literal control characters that are
      // invalid in JSON strings. \n, \r, \t are the common ones from
      // SSE delta concatenation; we also handle \b, \f for completeness.
      if (char === "\n") {
        segments.push("\\n");
        continue;
      }
      if (char === "\r") {
        segments.push("\\r");
        continue;
      }
      if (char === "\t") {
        segments.push("\\t");
        continue;
      }
      if (char === "\b") {
        segments.push("\\b");
        continue;
      }
      if (char === "\f") {
        segments.push("\\f");
        continue;
      }
      segments.push(char);
      continue;
    }
    // Outside a string: control characters are valid JSON whitespace,
    // so just copy them through.
    if (char === '"') {
      inString = true;
    }
    segments.push(char);
  }

  return segments.join("");
}