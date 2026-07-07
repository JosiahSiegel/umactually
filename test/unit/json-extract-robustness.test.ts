// REPRO: GitHub Actions PR #9 self-review posted a parse-fail because the
// model emitted a multi-line JSON review across SSE deltas. The JSON-encoded
// representation of `\n` (newline) appears as a LITERAL NEWLINE in the SSE
// data line source — which the SSE protocol interprets as a line break. The
// SSE parser concatenates the deltas into a string with literal newlines, but
// `JSON.parse` rejects literal newlines in strings. This makes the entire
// review fail to parse, even though the review itself is valid.
//
// Fix: `extractFirstBalancedObject` must escape literal control characters
// inside JSON strings so the resulting substring is valid JSON.
import { describe, expect, it } from "vitest";

import {
  extractFirstBalancedObject,
  extractJsonBlock,
} from "../../src/render/json-extract.js";
import {
  extractTextPayload,
} from "../../src/provider/provider-parse.js";

describe("extractJsonBlock: robustness to literal control chars in JSON strings", () => {
  it("parses a JSON object whose string values contain literal newlines (SSE delta case)", () => {
    // This is what the SSE parser produces when the model emits a multi-line
    // JSON review. The `\n` characters are LITERAL newlines in the source
    // (because JSON's `\n` escape decodes to a newline when JSON.parse runs
    // on the data line — but the data line itself ends at the first \n in
    // the SSE source, so the fragments concatenated across multi-line data
    // end up with literal newlines inside string values).
    const broken =
      '{\n' +
      '  "summary": "Reviewed the auth refactor.\nTwo issues found.",\n' +
      '  "verdict": "NEEDS_FIX",\n' +
      '  "comments": [\n' +
      '    { "path": "src/auth.ts", "line": 12, "body": "Use bcrypt.",\n' +
      '      "severity": "high", "category": "security" }\n' +
      '  ],\n' +
      '  "suppressed_comments": []\n' +
      '}';

    // Without the fix, this returns null (JSON.parse rejects literal newlines
    // in strings even though the structure is balanced).
    const result = extractJsonBlock(broken);
    expect(result).not.toBeNull();
    if (result !== null && typeof result === "object") {
      const obj = result as Record<string, unknown>;
      expect(obj["summary"]).toBe(
        "Reviewed the auth refactor.\nTwo issues found.",
      );
      expect(obj["verdict"]).toBe("NEEDS_FIX");
      const comments = obj["comments"] as readonly unknown[];
      expect(comments).toHaveLength(1);
    }
  });

  it("parses a JSON object whose string values contain literal tabs", () => {
    const broken =
      '{"summary":"col1\tcol2","verdict":"NEEDS_FIX","comments":[],"suppressed_comments":[]}';
    const result = extractJsonBlock(broken);
    expect(result).not.toBeNull();
    if (result !== null && typeof result === "object") {
      const obj = result as Record<string, unknown>;
      expect(obj["summary"]).toBe("col1\tcol2");
    }
  });

  it("parses a JSON object whose string values contain carriage returns", () => {
    const broken =
      '{"summary":"line1\r\nline2","verdict":"NEEDS_FIX","comments":[],"suppressed_comments":[]}';
    const result = extractJsonBlock(broken);
    expect(result).not.toBeNull();
    if (result !== null && typeof result === "object") {
      const obj = result as Record<string, unknown>;
      expect(obj["summary"]).toBe("line1\r\nline2");
    }
  });

  it("does NOT escape newlines that appear OUTSIDE JSON strings (structural)", () => {
    // Newlines between fields are valid JSON whitespace — must not be escaped.
    const valid = `{
  "summary": "clean",
  "verdict": "SHIP",
  "comments": [],
  "suppressed_comments": []
}`;
    const result = extractJsonBlock(valid);
    expect(result).not.toBeNull();
    if (result !== null && typeof result === "object") {
      const obj = result as Record<string, unknown>;
      expect(obj["summary"]).toBe("clean");
      expect(obj["verdict"]).toBe("SHIP");
    }
  });

  it("handles a deeply-nested JSON object with mixed control chars in strings", () => {
    const broken =
      '{\n' +
      '  "summary": "Top\nlevel",\n' +
      '  "comments": [\n' +
      '    { "path": "a.ts", "body": "Nested\nbody",\n' +
      '      "severity": "low" }\n' +
      '  ],\n' +
      '  "meta": { "key": "tab\there" }\n' +
      '}';
    const result = extractJsonBlock(broken);
    expect(result).not.toBeNull();
    if (result !== null && typeof result === "object") {
      const obj = result as Record<string, unknown>;
      expect(obj["summary"]).toBe("Top\nlevel");
      const comments = obj["comments"] as readonly Record<string, unknown>[];
      expect(comments[0]?.["body"]).toBe("Nested\nbody");
      const meta = obj["meta"] as Record<string, unknown>;
      expect(meta["key"]).toBe("tab\there");
    }
  });

  it("preserves a literal backslash-n pair (not double-escaped)", () => {
    // The input has a string value containing the two-char sequence \\n
    // (backslash + n). The function must NOT replace it with the four-char
    // sequence \\\\n. It only escapes raw control characters (\n, \r, \t, \b, \f).
    const input = '{"key":"a\\\\nb"}';
    const result = extractFirstBalancedObject(input);
    expect(result).not.toBeNull();
    if (result !== null) {
      const parsed = JSON.parse(result) as { key: string };
      expect(parsed.key).toBe("a\\nb");
    }
  });

  it("double-escapes stray `\\X` where X is not a valid JSON escape character", () => {
    // REPRO: PR #24 self-review (run 28898948220) emitted a 20,703-char
    // review across SSE deltas. The body fields contained markdown
    // backticks (`` ` ``) inside JSON strings. The model's output had
    // the two-char sequence `\` + `` ` `` (a backslash followed by a
    // backtick) which is not a valid JSON escape (`"`/`\`/`/`/`b`/
    // `f`/`n`/`r`/`t`/`u` are the only valid ones). The balanced-
    // object fallback's existing escape conversion passes `\` through
    // verbatim and lets JSON.parse reject the whole payload with
    // "Bad escaped character in JSON at position 13115", which
    // triggers the parse-fail fallback instead of rendering the real
    // review. Fix: when the escape-conversion walker sees `\` followed
    // by anything outside the valid JSON escape set, emit `\\X` so
    // JSON.parse sees `\\` + `X` → `\` + `X` in the parsed output
    // — the literal `\` + char the model most likely intended.
    //
    // JS source note: in a single-quoted JS literal `\\` is one
    // backslash and `` ` `` is a backtick, so the runtime input
    // contains the two-char sequence `\` + `` ` `` inside the JSON
    // body field — exactly what triggers the parser failure.
    const input = '{"body":"markdown code: \\`code\\` end"}';
    const result = extractFirstBalancedObject(input);
    expect(result).not.toBeNull();
    if (result !== null) {
      const parsed = JSON.parse(result) as { body: string };
      // The model wrote `\` + `` ` `` in its body; the fix preserves
      // that literal sequence in the parsed output.
      expect(parsed.body).toBe("markdown code: \\`code\\` end");
    }
  });

  it("double-escapes stray `\\X` where X is `\\:`, `\\,`, `\\.`, `\\'` (common markdown escapes)", () => {
    // Models writing markdown sometimes emit `\:`, `\,`, `\.`, `\'` —
    // markdown backslash-escapes. None are valid JSON escapes, so
    // without the double-escape fix the parse fails with
    // "Bad escaped character in JSON". The fix preserves the literal
    // `\` + char in the parsed output.
    const cases = [
      { from: "with \\: colon", expected: "with \\: colon" },
      { from: "with \\, comma", expected: "with \\, comma" },
      { from: "with \\. dot", expected: "with \\. dot" },
      { from: "with \\' apostrophe", expected: "with \\' apostrophe" },
    ];
    for (const { from, expected } of cases) {
      const input = `{"body":"${from}"}`;
      const result = extractFirstBalancedObject(input);
      expect(result, `input: ${input}`).not.toBeNull();
      if (result !== null) {
        const parsed = JSON.parse(result) as { body: string };
        expect(parsed.body, `input: ${from}`).toBe(expected);
      }
    }
  });

  it("double-escapes a stray `\\X` mixed with literal control chars (real-world SSE case)", () => {
    // End-to-end shape: literal newlines inside strings (from SSE delta
    // accumulation) AND a stray `\X` in a body field. Both must be
    // repaired for the substring to parse as valid JSON.
    const input = '{\n  "body": "line1\nline2\nwith \`bad\` escape",\n  "ok": true\n}';
    const result = extractFirstBalancedObject(input);
    expect(result).not.toBeNull();
    if (result !== null) {
      const parsed = JSON.parse(result) as { body: string; ok: boolean };
      expect(parsed.body).toBe("line1\nline2\nwith \`bad\` escape");
      expect(parsed.ok).toBe(true);
    }
  });

  it("repairs stray `\\u` followed by non-hex (invalid unicode escape)", () => {
    // REPRO: PR #24 self-review (run 28900452753) failed with
    // "Bad Unicode escape in JSON at position 4157". The model
    // emitted `\u` followed by something that isn't 4 hex digits
    // (truncated `\u00`, or `\uXYZW`, or `\u000G`). JSON.parse
    // rejects with "Bad Unicode escape in JSON". Fix: when the
    // escape-conversion walker sees `\u`, peek 4 chars ahead —
    // if any isn't hex, double-escape the `\u` so the parsed
    // output preserves the literal sequence.
    //
    // JS source note: in a single-quoted JS literal `\\` is one
    // backslash, so the runtime input contains `\u` followed by
    // 4 chars inside the JSON body field — exactly what triggers
    // the parser failure.
    const cases = [
      { from: "with \\u00 truncated", expected: "with \\u00 truncated" },
      { from: "with \\uXYZW non-hex", expected: "with \\uXYZW non-hex" },
      { from: "with \\u000G bad 4th", expected: "with \\u000G bad 4th" },
    ];
    for (const { from, expected } of cases) {
      const input = `{"body":"${from}"}`;
      const result = extractFirstBalancedObject(input);
      expect(result, `input: ${input}`).not.toBeNull();
      if (result !== null) {
        const parsed = JSON.parse(result) as { body: string };
        expect(parsed.body, `input: ${from}`).toBe(expected);
      }
    }
  });

  it("preserves valid `\\uXXXX` escapes through the repair pass", () => {
    // The fix must NOT over-escape valid 4-hex unicode escapes.
    // `\u0041` decodes to 'A', `\u00e9` to 'é', etc.
    const cases = [
      { from: "letter A: \\u0041", expected: "letter A: A" },
      { from: "é: \\u00e9", expected: "é: é" },
      { from: "0xFFFD: \\uFFFD", expected: "0xFFFD: \uFFFD" },
    ];
    for (const { from, expected } of cases) {
      const input = `{"body":"${from}"}`;
      const result = extractFirstBalancedObject(input);
      expect(result, `input: ${input}`).not.toBeNull();
      if (result !== null) {
        const parsed = JSON.parse(result) as { body: string };
        expect(parsed.body, `input: ${from}`).toBe(expected);
      }
    }
  });

  it("preserves all valid JSON escape sequences through the repair pass", () => {
    // Round-trip test: every valid single-char JSON escape must come
    // through the repair unchanged (NOT over-escaped to `\\X`). If
    // any of these were double-escaped, JSON.parse would output a
    // backslash followed by the literal char instead of the
    // decoded escape, and the assertion would fail.
    const cases = [
      { from: "quote: \\\"end", expected: 'quote: "end' },
      { from: "backslash: \\\\end", expected: "backslash: \\end" },
      { from: "slash: \\/end", expected: "slash: /end" },
      { from: "back: \\bend", expected: "back: \bend" },
      { from: "form: \\fend", expected: "form: \fend" },
      { from: "newline: \\nend", expected: "newline: \nend" },
      { from: "carriage: \\rend", expected: "carriage: \rend" },
      { from: "tab: \\tend", expected: "tab: \tend" },
    ];
    for (const { from, expected } of cases) {
      // JS source note: `\\` is one backslash, so the runtime
      // input contains the 2-char sequence `\` + char inside the
      // JSON body field — exactly what JSON.parse expects.
      const input = `{"body":"${from}"}`;
      const result = extractFirstBalancedObject(input);
      expect(result, `input: ${input}`).not.toBeNull();
      if (result !== null) {
        const parsed = JSON.parse(result) as { body: string };
        expect(parsed.body, `input: ${from}`).toBe(expected);
      }
    }
  });
});

describe("extractJsonBlock: fence-body literal-control-char repair", () => {
  // The fence body extracted from ```json ... ``` can still contain
  // literal newlines inside JSON strings (because the textPayload came
  // from SSE delta accumulation where each delta's `\n` escape was
  // decoded to a real newline). `tryParseJson(fenceBody)` would reject
  // those literal newlines. The fence-body extraction must therefore
  // run the same escape-repair pass as the balanced-object fallback
  // so the body parses before we fall through to that slower path.
  it("repairs literal newlines inside fence-body strings", () => {
    const fenced = '```json\n{\n  "body": "line1\nline2",\n  "ok": true\n}\n```';
    const result = extractJsonBlock(fenced);
    expect(result).not.toBeNull();
    const parsed = result as { body: string; ok: boolean };
    expect(parsed.body).toBe("line1\nline2");
    expect(parsed.ok).toBe(true);
  });

  it("repairs stray `\\X` in fence-body strings", () => {
    // JS source note: `\\` is one backslash, so the runtime fenced
    // body contains the two-char sequence `\` + `` ` `` inside the
    // JSON body field — exactly the production failure mode. The
    // fix preserves the literal sequence in the parsed output.
    const fenced = '```json\n{\n  "body": "with \\`bad\\` escape"\n}\n```';
    const result = extractJsonBlock(fenced);
    expect(result).not.toBeNull();
    const parsed = result as { body: string };
    expect(parsed.body).toBe("with \\`bad\\` escape");
  });
});

describe("extractTextPayload: SSE end-to-end with newline-containing deltas", () => {
  // End-to-end coverage of the production case: model emits a multi-line
  // JSON review (with real newlines in summary, comments[].body, etc.) across
  // SSE response.output_text.delta events. The JSON-encoded value has the
  // newline as `\n` in the SSE source (which JSON.parse decodes to a real
  // newline), but extractTextPayload must still produce text that
  // parseReviewPayload can handle.
  it("extracts a multi-line review from SSE deltas and parses it correctly", async () => {
    const modelOutput =
      '{"summary":"Reviewed the auth refactor.\nTwo issues found.",' +
      '"verdict":"NEEDS_FIX",' +
      '"comments":[{"path":"src/auth.ts","line":12,"body":"Use bcrypt.","severity":"high","category":"security"}],' +
      '"suppressed_comments":[]}';

    // Build the SSE stream where the delta value is JSON-encoded with literal \n
    const stream =
      'event: response.created\n' +
      'data: {"type":"response.created","response":{"id":"r1","status":"in_progress","output":[]}}\n' +
      '\n' +
      'event: response.output_text.delta\n' +
      'data: {"type":"response.output_text.delta","delta":' +
      JSON.stringify(modelOutput) +
      '}\n' +
      '\n' +
      'data: [DONE]\n';

    const text = extractTextPayload("responses", stream);
    expect(text).not.toBeNull();
    // The extracted text should contain the multi-line review (with real newlines)
    expect(text).toContain('"summary":"Reviewed the auth refactor.\nTwo issues found."');

    // Now check that parseReviewPayload succeeds.
    const { parseReviewPayload } = await import("../../src/provider/provider-parse.js");
    const review = parseReviewPayload(text);
    expect(review).not.toBeNull();
    expect(review?.summary).toBe("Reviewed the auth refactor.\nTwo issues found.");
    expect(review?.verdict).toBe("NEEDS_FIX");
    expect(review?.comments).toHaveLength(1);
  });

  it("extracts a review with stray `\\X` sequences in body fields (real PR #24 failure mode)", async () => {
    // REPRO: PR #24 self-review run 28898948220 emitted a review
    // where body fields contained `\` followed by `` ` `` (markdown
    // backtick escape). The textPayload accumulated real newlines
    // from SSE delta accumulation AND had stray `\X` sequences —
    // both needed repair for JSON.parse to accept the document.
    //
    // Construct a model output that has BOTH failure modes in one
    // string: a literal newline (from delta accumulation) AND a
    // stray `\`` (from markdown prose).
    const modelOutput =
      '{"summary":"Reviewed.\\nHas findings.",' +
      '"verdict":"NEEDS_FIX",' +
      '"comments":[{"path":"src/a.ts","line":1,"body":"line1\\nwith \\`tick\\` here","severity":"medium","category":"style"}],' +
      '"suppressed_comments":[]}';

    const stream =
      'event: response.created\n' +
      'data: {"type":"response.created","response":{"id":"r2","status":"in_progress","output":[]}}\n' +
      '\n' +
      'event: response.output_text.delta\n' +
      'data: {"type":"response.output_text.delta","delta":' +
      JSON.stringify(modelOutput) +
      '}\n' +
      '\n' +
      'data: [DONE]\n';

    const { parseReviewPayload } = await import("../../src/provider/provider-parse.js");
    const text = extractTextPayload("responses", stream);
    expect(text).not.toBeNull();
    const review = parseReviewPayload(text);
    expect(review).not.toBeNull();
    if (review !== null) {
      // summary: literal newline preserved (decoded from `\n` in source)
      expect(review.summary).toBe("Reviewed.\nHas findings.");
      expect(review.verdict).toBe("NEEDS_FIX");
      expect(review.comments).toHaveLength(1);
      // The body has BOTH: a real newline AND the literal `\`` sequence
      // (what the model wrote). The fix preserves both in the parsed
      // output — that's the whole point of double-escaping.
      expect(review.comments[0]?.body).toBe("line1\nwith \\`tick\\` here");
      expect(review.comments[0]?.path).toBe("src/a.ts");
      expect(review.comments[0]?.line).toBe(1);
      expect(review.comments[0]?.severity).toBe("medium");
    }
  });
});