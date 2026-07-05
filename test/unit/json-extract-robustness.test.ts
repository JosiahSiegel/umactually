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
});