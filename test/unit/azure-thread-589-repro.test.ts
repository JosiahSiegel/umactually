// SPDX-License-Identifier: MIT
// Reproduces the parse-fail surface seen in Azure DevOps PR #43 thread 589:
//   - MiniMax-M3 SSE stream with `response.output_text.delta` events
//   - Followed by a `response.completed` event whose `response.output[0].content[0].text`
//     contains a TRUNCATED version of the review (e.g. "placeholder" instead of the full text)
//   - The deltas themselves, concatenated, form a complete valid JSON review
//
// The parser must:
//   1. NOT use the `response.completed` placeholder text — it would be wrong
//   2. Concatenate the per-event `delta` field to form the full text
//   3. Pass that full text to `extractJsonBlock` which extracts the balanced {…}
//   4. Successfully parse the review and return it

import { describe, expect, it } from "vitest";
import { extractFirstBalancedObject } from "../../src/render/json-extract.js";
import { tryParseJson } from "../../src/util/json-guards.js";
import { extractTextPayload, parseReviewPayload } from "../../src/provider/provider-parse.js";

function buildSseStream(deltas: readonly string[], completedText: string): string {
  const lines: string[] = [];
  lines.push("event: response.created");
  lines.push("data: {\"type\":\"response.created\",\"response\":{\"id\":\"resp_1\"}}");
  lines.push("");
  for (const d of deltas) {
    lines.push("event: response.output_text.delta");
    // Note: MiniMax emits the JSON-encoded delta value with embedded newlines
    // because the SSE encoder doesn't pre-split on literal `\n`. We must
    // JSON.stringify so the test fixture mirrors the actual transport.
    lines.push(`data: {"type":"response.output_text.delta","item_id":"msg_1","output_index":0,"content_index":0,"delta":${JSON.stringify(d)}}`);
    lines.push("");
  }
  // The response.completed event has a SHORT placeholder — mirrors the
  // MiniMax-M3 behavior of returning an output[] with the model wrapper
  // metadata but NOT the full text. The deltas carry the real text.
  lines.push("event: response.completed");
  lines.push(`data: {"type":"response.completed","response":{"id":"resp_1","output":[{"type":"message","content":[{"type":"output_text","text":${JSON.stringify(completedText)}}]}]}}`);
  lines.push("");
  lines.push("data: [DONE]");
  return lines.join("\n");
}

describe("Azure DevOps thread 589 reproduction — SSE delta concatenation", () => {
  it("extractTextPayload returns the joined deltas when response.completed has a stub/placeholder", () => {
    // This is the actual root cause of the parse-fail surface: the
    // response.completed event carries a stub string ("placeholder") and
    // the real review text is only in the per-fragment deltas. The
    // heuristic-detect-stub path in tryExtractSse must prefer the
    // fragments when the completed text looks like a stub.
    const review = { summary: "Real review with the fix", verdict: "NEEDS_FIX", comments: [{ path: "x.ts", line: 1, body: "y", severity: "high", category: "bug" }] };
    const fullText = JSON.stringify(review);
    const stream = buildSseStream([fullText], "placeholder");
    const extracted = extractTextPayload("responses", stream);
    expect(extracted).toBe(fullText);
    expect(extracted).not.toBe("placeholder");
  });

  it("parseReviewPayload returns a real review from SSE-wrapped MiniMax-M3 response with stub completed text", () => {
    const review = {
      summary: "Valid review after SSE unwrap",
      verdict: "NEEDS_FIX",
      comments: [{ path: "src/x.ts", line: 1, body: "y", severity: "low", category: "general" }],
    };
    const fullText = JSON.stringify(review);
    const stream = buildSseStream([fullText], "placeholder");
    const result = parseReviewPayload(extractTextPayload("responses", stream));
    expect(result).not.toBeNull();
    expect(result!.summary).toBe("Valid review after SSE unwrap");
    expect(result!.verdict).toBe("NEEDS_FIX");
  });

  it("extractFirstBalancedObject handles a real review JSON with embedded newlines from SSE concatenation", () => {
    const review = { summary: "Line one\nLine two\nLine three", verdict: "NEEDS_FIX", comments: [] };
    const fullText = JSON.stringify(review);
    const result = extractFirstBalancedObject(fullText);
    expect(result).not.toBeNull();
    const parsed = tryParseJson(result!);
    expect(parsed).toBeDefined();
    expect((parsed as { summary: string }).summary).toBe(review.summary);
  });

  it("extractTextPayload still prefers response.completed text when it is a real review (not a stub)", () => {
    // Sanity check: the heuristic must NOT regress the canonical case
    // where the completed event carries the full text. A 100-char string
    // with `{` is a real review, not a stub.
    const realReview = JSON.stringify({ summary: "Real full-text completed event", verdict: "NEEDS_FIX", comments: [] });
    const stream = buildSseStream([], realReview);
    const extracted = extractTextPayload("responses", stream);
    expect(extracted).toBe(realReview);
  });
});
