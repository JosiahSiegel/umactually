// SPDX-License-Identifier: MIT
// Regression: balanced-object extractor must handle stray unescaped
// `"` inside JSON string values. SSE delta concatenation sometimes
// produces text where the model's review body contains a literal `"`
// (the model forgot to JSON-encode it as `\"`), breaking the outer
// JSON. The extractor must stay inside the string state on stray
// quotes so the depth tracker finds the right balanced substring,
// AND must escape the stray quote so the resulting substring parses.
//
// Live evidence (run 28829205474 at 2026-07-06T23:03:58Z):
//   textPayloadLength=14907, balanced-parse failed at position 13888
//   with "Expected ',' or '}' after property value in JSON". The
//   review body's `body` field contained an unescaped `"` from the
//   model's perspective, breaking the outer JSON.

import { describe, expect, it } from "vitest";
import { extractJsonBlock } from "../../src/render/json-extract.js";

describe("extractJsonBlock — stray quote inside string values", () => {
  it("escapes a stray quote inside a review body field", () => {
    // The substring above is VALID JSON already (the quotes are escaped).
    // The real failure mode is when they are NOT escaped:
    const actuallyBroken = '{"summary":"test","comments":[{"path":"src/x.ts","line":1,"body":"the "quoted" word here","severity":"high","category":"bug"}]}';
    expect(() => JSON.parse(actuallyBroken)).toThrow();
    // After the fix, the extractor recovers a parseable substring:
    const result = extractJsonBlock(actuallyBroken);
    expect(result).not.toBeNull();
    const parsed = result as { comments: ReadonlyArray<{ body: string }> };
    expect(parsed.comments[0]?.body).toContain('the');
    expect(parsed.comments[0]?.body).toContain('"quoted"');
  });

  it("preserves the balanced-object end index when stray quotes appear", () => {
    // The depth tracker must not get confused by stray quotes that look
    // like string terminators. Build a balanced object where a body
    // field contains stray quotes — the trailing `}` must still be
    // detected as the end of the object.
    const actuallyBroken = '{"summary":"x","comments":[{"body":"a"b"c"}]}';
    const result = extractJsonBlock(actuallyBroken);
    expect(result).not.toBeNull();
    const parsed = result as { comments: ReadonlyArray<{ body: string }> };
    // The body is recovered — JSON.parse strips the `\"` escapes back to
    // plain `"`, so the parsed value carries the literal `"` characters.
    expect(parsed.comments[0]?.body).toBe('a"b"c');
  });

  it("does not over-escape correctly-escaped quotes in well-formed JSON", () => {
    // Regression: the fix must not break the well-formed case where
    // every quote inside a string is already JSON-escaped.
    const wellFormed = '{"summary":"x","comments":[{"body":"a \\"b\\" c"}]}';
    const result = extractJsonBlock(wellFormed);
    expect(result).not.toBeNull();
    const parsed = result as { comments: ReadonlyArray<{ body: string }> };
    expect(parsed.comments[0]?.body).toBe('a "b" c');
  });

  it("preserves real JSON structure after escaping stray quotes", () => {
    // The most realistic shape from the live evidence: multiple comments,
    // one with a stray quote, the rest well-formed. The whole review
    // must round-trip after extraction.
    const broken = '{"summary":"Large PR","comments":[{"path":"a.ts","body":"has "quote" here"},{"path":"b.ts","body":"clean"}],"suppressed_comments":[]}';
    const result = extractJsonBlock(broken);
    expect(result).not.toBeNull();
    const parsed = result as { comments: ReadonlyArray<{ body: string }>; suppressed_comments: unknown[] };
    expect(parsed.comments.length).toBe(2);
    expect(parsed.comments[0]?.body).toContain('quote');
    expect(parsed.comments[1]?.body).toBe('clean');
  });
});