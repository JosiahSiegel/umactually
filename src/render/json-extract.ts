import { tryParseJson } from "../util/json-guards.js";

/**
 * Valid JSON escape characters (the second character after `\`).
 * Any other character following `\` inside a JSON string is an invalid
 * escape sequence and will cause JSON.parse to reject the document
 * with "Bad escaped character in JSON". Models writing prose (especially
 * markdown) frequently produce stray `\X` sequences inside JSON string
 * fields — `\`` (escaped backtick, common in shell contexts), `\.`,
 * `\:`, `\,`, `\'`, etc. None of these are valid JSON escapes.
 */
const VALID_JSON_ESCAPE_CHARS: ReadonlySet<string> = new Set([
  '"',
  "\\",
  "/",
  "b",
  "f",
  "n",
  "r",
  "t",
  "u",
]);

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
  // Repair the fence body before trying to parse it: the body may
  // contain literal control characters (from SSE delta accumulation,
  // where each delta's `\n` was decoded to a real newline) or stray
  // `\X` sequences (from markdown prose the model wrote unescaped).
  // The repair pass is the same balanced-walk used by the
  // balanced-object fallback below — applied here so the cheaper
  // fence path doesn't fall through unnecessarily on SSE-shaped
  // input.
  const repairedFenceBody = repairJsonStringLiterals(fenceBody);
  const fencedAttempt = tryParseJson(repairedFenceBody);
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
  if (body === undefined) {
    return rawText;
  }
  // Run the JSON-string escape-repair pass on the extracted body. The
  // body may contain literal control characters (from SSE delta
  // accumulation, where each delta's `\n` was decoded to a real
  // newline) or stray `\X` sequences (from markdown prose that the
  // model wrote unescaped). Without this pass, `tryParseJson(body)`
  // rejects with "Bad control character" or "Bad escaped character"
  // and the parser falls through to the slower balanced-object
  // fallback — which then has to repeat the same repair work.
  return repairJsonStringLiterals(body);
}

/**
 * Locate the first balanced `{ ... }` object in `rawText`, respecting nested
 * braces and quoted strings (including \" escapes). Returns null when no
 * balanced object can be found.
 *
 * Returns a JSON-safe substring with two repairs applied:
 *   1. Literal control characters inside JSON strings (`\n \r \t \b \f`)
 *      are escaped to their 2-char JSON-escape equivalents. This handles
 *      SSE delta concatenation, where each delta's `\n` was decoded
 *      to a real newline when the SSE payload was JSON-parsed.
 *   2. Stray `\X` sequences inside JSON strings where X is NOT a valid
 *      JSON escape char (`"`/`\`/`/`/`b`/`f`/`n`/`r`/`t`/`u`) are
 *      double-escaped so JSON.parse sees `\\X` → `\X` in the parsed
 *      output. Models writing markdown prose sometimes produce
 *      `` \` ``, `\:`, `\,`, `\.`, `\'` inside JSON body fields;
 *      these would otherwise reject with "Bad escaped character in
 *      JSON" (live evidence: PR #24 self-review run 28898948220,
 *      body 20,691 chars, fail at position 13115).
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
        // Disambiguate a stray `"` from a legitimate closing quote by
        // peeking ahead. A real closing quote is followed (after
        // optional whitespace) by a structural JSON character
        // (`,`, `}`, `]`, `:`). Anything else means the model forgot
        // to escape a `"` inside the string value (SSE delta
        // concatenation surfaces this as an unescaped quote in the
        // resulting textPayload). Treat the latter as a stray quote
        // — stay inside the string so the depth tracker keeps
        // working AND escape it in the second pass.
        //
        // Note: `"` is NOT a structural JSON character so we don't
        // include it in the close-quote set. If we did, a stray
        // `"` followed by another `"` (e.g. `body: "value" "next":`)
        // would be misclassified as a closing quote.
        const nextNonWs = peekNextNonWhitespace(rawText, index + 1);
        if (
          nextNonWs === -1 ||
          nextNonWs === ",".charCodeAt(0) ||
          nextNonWs === "}".charCodeAt(0) ||
          nextNonWs === "]".charCodeAt(0) ||
          nextNonWs === ":".charCodeAt(0)
        ) {
          inString = false;
        }
        // else: stray quote inside a string. Stay inString; the second
        // pass will escape it.
        continue;
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
        // Validate the escape sequence: only `" \ / b f n r t u` are
        // valid JSON escapes. Models writing markdown prose sometimes
        // emit stray `\X` sequences (`` \` ``, `\:`, `\,`, `\.`, etc.)
        // which JSON.parse rejects with "Bad escaped character in
        // JSON". Double-escape the invalid form so the parsed output
        // preserves the literal `\` + char the model intended.
        //
        // The `\` itself was already pushed when `escape` was set on
        // the previous iteration; here we only emit the second
        // character (or `\\` + char for the invalid case).
        if (!VALID_JSON_ESCAPE_CHARS.has(char)) {
          segments.push("\\" + char);
        } else {
          segments.push(char);
        }
        escape = false;
        continue;
      }
      if (char === "\\") {
        segments.push(char);
        escape = true;
        continue;
      }
      if (char === '"') {
        // Same disambiguation as the first pass: peek ahead to determine
        // whether this `"` is a legitimate closing quote (followed by
        // structural JSON punctuation) or a stray quote from an
        // unescaped model emission. The latter gets escaped so the
        // resulting substring parses as valid JSON.
        const nextNonWs = peekNextNonWhitespace(substring, index + 1);
        if (
          nextNonWs === -1 ||
          nextNonWs === ",".charCodeAt(0) ||
          nextNonWs === "}".charCodeAt(0) ||
          nextNonWs === "]".charCodeAt(0) ||
          nextNonWs === ":".charCodeAt(0)
        ) {
          // Legitimate closing quote: emit the raw `"` and exit the
          // string. The first-pass peek-ahead already determined this
          // was the close.
          segments.push(char);
          inString = false;
          continue;
        }
        // Stray quote inside a string: escape it so the parser keeps
        // the string open. Live evidence (run 28829205474 at
        // 2026-07-06T23:03:58Z): the model's review body contained an
        // unescaped `"` inside a body field, breaking the outer JSON.
        segments.push('\\"');
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

/**
 * Walk `text` (a balanced JSON document — object or array) and return
 * a JSON-safe copy where:
 *   - literal control characters inside JSON strings (`\n \r \t \b \f`)
 *     are escaped to their 2-char JSON-escape equivalents
 *   - stray `\X` sequences inside JSON strings (where X is NOT a valid
 *     JSON escape char: `"`, `\`, `/`, `b`, `f`, `n`, `r`, `t`, `u`)
 *     are double-escaped so JSON.parse sees `\\X` → `\X` in the
 *     parsed output. Without this, models writing markdown prose
 *     that contains `\.`, `\:`, `\,`, `\'`, `` \` ``, etc. produce
 *     valid JSON to a human reader but invalid JSON to JSON.parse,
 *     which fails with "Bad escaped character in JSON" and triggers
 *     the parse-fail fallback.
 *   - stray `"` inside a string (model forgot to escape a quote) is
 *     escaped to `\"` so JSON.parse keeps the string open and can
 *     parse the outer object.
 *
 * Structural whitespace OUTSIDE strings (newlines/tabs between fields)
 * is preserved unchanged — that's already valid JSON whitespace.
 *
 * Uses the same peek-ahead logic for stray-quote disambiguation as
 * `extractFirstBalancedObject`'s second pass; in fact this helper is
 * the same code, factored out so the fence-body path doesn't have to
 * duplicate it.
 *
 * Returns `text` unchanged when it doesn't contain a balanced object
 * or array — the caller can fall through to the balanced-object
 * fallback.
 */
function repairJsonStringLiterals(text: string): string {
  const startIndex = text.indexOf("{") === -1 ? text.indexOf("[") : text.indexOf("{");
  if (startIndex === -1) {
    return text;
  }

  // Find the end index of the balanced top-level object/array.
  let endIndex = -1;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];
    if (char === undefined) break;
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
        // Use the same stray-quote peek-ahead as extractFirstBalancedObject.
        const nextNonWs = peekNextNonWhitespace(text, index + 1);
        if (
          nextNonWs === -1 ||
          nextNonWs === ",".charCodeAt(0) ||
          nextNonWs === "}".charCodeAt(0) ||
          nextNonWs === "]".charCodeAt(0) ||
          nextNonWs === ":".charCodeAt(0)
        ) {
          inString = false;
        }
        continue;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === "{" || char === "[") {
      depth += 1;
      continue;
    }
    if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0) {
        endIndex = index;
        break;
      }
    }
  }
  if (endIndex === -1) {
    return text;
  }

  // Second pass: walk the balanced substring and emit a repaired copy.
  const substring = text.slice(startIndex, endIndex + 1);
  const segments: string[] = [];
  inString = false;
  escape = false;
  for (let index = 0; index < substring.length; index += 1) {
    const char = substring.charAt(index);
    if (inString) {
      if (escape) {
        // Validate that the escape sequence is one JSON.parse accepts.
        // Any other character following `\` is an invalid escape
        // (e.g. `` \` ``, `\:`, `\,` from markdown prose); double-
        // escape it to `\\X` so JSON.parse sees a literal backslash
        // followed by the character in the parsed output, which is
        // what the model most likely intended.
        //
        // The `\` itself was already pushed when `escape` was set on
        // the previous iteration; here we only push the second
        // character of the (possibly double-escaped) sequence.
        if (!VALID_JSON_ESCAPE_CHARS.has(char)) {
          segments.push("\\" + char);
        } else {
          segments.push(char);
        }
        escape = false;
        continue;
      }
      if (char === "\\") {
        segments.push(char);
        escape = true;
        continue;
      }
      if (char === '"') {
        const nextNonWs = peekNextNonWhitespace(substring, index + 1);
        if (
          nextNonWs === -1 ||
          nextNonWs === ",".charCodeAt(0) ||
          nextNonWs === "}".charCodeAt(0) ||
          nextNonWs === "]".charCodeAt(0) ||
          nextNonWs === ":".charCodeAt(0)
        ) {
          segments.push(char);
          inString = false;
          continue;
        }
        segments.push('\\"');
        continue;
      }
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
    if (char === '"') {
      inString = true;
    }
    segments.push(char);
  }

  return text.slice(0, startIndex) + segments.join("") + text.slice(endIndex + 1);
}

/**
 * Peek the character code of the next non-whitespace character in
 * `text` starting at `fromIndex`. Returns `-1` when `fromIndex` is past
 * the end of `text`. Used by the balanced-object extractor to
 * disambiguate a stray unescaped `"` inside a JSON string from a
 * legitimate closing quote: the latter is always followed (after
 * optional whitespace) by a structural JSON character (`,`, `}`, `]`,
 * `:`); anything else means the model forgot to JSON-encode the
 * quote.
 */
function peekNextNonWhitespace(text: string, fromIndex: number): number {
  for (let i = fromIndex; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    // JSON whitespace: space (0x20), tab (0x09), LF (0x0A), CR (0x0D).
    if (code !== 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) {
      return code;
    }
  }
  return -1;
}