// Pins the fix for the 075cecd parse-fail: the model emits JSON wrapped
// in a markdown code fence WITHOUT the "json" language tag (e.g.
// ```\n{...}\n```). The previous regex required ```json specifically, so
// the fence wasn't detected and `extractFirstBalancedObject` parsed the
// first metadata event's JSON object as the review — empty fields, strict
// check fails, parse-fail fires.
//
// The fix: accept any opening fence with an optional language tag.

import { describe, expect, it } from "vitest";

import { extractJsonBlock } from "../../src/render/json-extract.js";

describe("extractJsonBlock: fence with or without language tag", () => {
  it("extracts JSON from ```...``` fence (no language tag)", () => {
    const text = "```\n{\"summary\": \"hi\", \"verdict\": \"OK\"}\n```";
    const result = extractJsonBlock(text);
    expect(result).toEqual({ summary: "hi", verdict: "OK" });
  });

  it("still extracts JSON from ```json ... ``` fence (explicit tag)", () => {
    const text = "```json\n{\"summary\": \"hi\", \"verdict\": \"OK\"}\n```";
    const result = extractJsonBlock(text);
    expect(result).toEqual({ summary: "hi", verdict: "OK" });
  });

  it("extracts JSON from ```json5 ... ``` fence (other language tag)", () => {
    const text = "```json5\n{\"summary\": \"hi\"}\n```";
    const result = extractJsonBlock(text);
    expect(result).toEqual({ summary: "hi" });
  });

  it("extracts JSON from ```typescript ... ``` fence (unrelated tag)", () => {
    // Some models emit ```typescript or ```javascript by mistake — we
    // should still extract the JSON body.
    const text = "```typescript\n{\"summary\": \"hi\"}\n```";
    const result = extractJsonBlock(text);
    expect(result).toEqual({ summary: "hi" });
  });

  it("returns null when no fence is present", () => {
    const text = "no fence here, just prose";
    const result = extractJsonBlock(text);
    expect(result).toBeNull();
  });
});
