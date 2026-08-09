// SPDX-License-Identifier: MIT
// Reproduces the parse-fail surface from Azure DevOps PR self-review
// where the action posts "Provider response did not contain a valid JSON
// review payload" despite the SSE stream actually carrying real review
// deltas. The truncated diagnostic log showed only 2 deltas before the
// 16 KB card-comment truncate, but the parser must still round-trip a
// complete review when the FULL stream is captured.
//
// Two regression classes:
//   A. The stream IS complete but the parser fails to extract the
//      review because the concatenated delta fragments need a
//      balanced-object extractor that handles a truncated JSON prefix.
//   B. The stream is INCOMPLETE in flight (provider dropped mid-stream)
//      and the parser needs a guard for that case rather than spinning
//      into the retry path with garbage.

import { describe, expect, it } from "vitest";
import {
  extractTextPayload,
  parseReviewPayload,
} from "../../src/provider/provider-parse.js";

function buildLiveEvidenceStream(opts: {
  readonly includeCompleted?: boolean;
  readonly completedText?: string;
  readonly deltas?: readonly string[];
}): string {
  const lines: string[] = [
    "event: response.created",
    'data: {"type":"response.created","response":{"id":"resp_x","object":"response","status":"in_progress","model":"opaque-sse-model","output":[]}}',
    "",
    "event: response.in_progress",
    'data: {"type":"response.in_progress","response":{"id":"resp_x","status":"in_progress"}}',
    "",
    "event: response.output_item.added",
    'data: {"type":"response.output_item.added","output_index":0,"item":{"id":"msg_1","type":"message","status":"in_progress","role":"assistant","content":[]}}',
    "",
    "event: response.content_part.added",
    'data: {"type":"response.content_part.added","item_id":"msg_1","output_index":0,"content_index":0,"part":{"type":"output_text","text":"","annotations":[]}}',
    "",
  ];
  const deltas = opts.deltas ?? [];
  for (const d of deltas) {
    lines.push("event: response.output_text.delta");
    lines.push(
      `data: {"type":"response.output_text.delta","item_id":"msg_1","output_index":0,"content_index":0,"delta":${JSON.stringify(d)}}`,
    );
    lines.push("");
  }
  if (opts.includeCompleted === true) {
    lines.push("event: response.completed");
    const completedText = opts.completedText ?? "";
    lines.push(
      `data: {"type":"response.completed","response":{"id":"resp_x","output_text":${JSON.stringify(completedText)}}}`,
    );
    lines.push("");
  }
  lines.push("data: [DONE]");
  return lines.join("\n");
}

describe("Azure DevOps PR parse-fail repro — raw-fragment delta streams", () => {
  // The full review we expect to recover from the stream. Matches the
  // PR-summary shape the parser would emit against an actual diff.
  const expectedReview = {
    summary: "Valid review after SSE unwrap",
    verdict: "NEEDS_FIX",
    comments: [
      { path: "src/x.ts", line: 1, body: "y", severity: "low", category: "general" },
    ],
  };

  it("parses a stream where deltas carry raw JSON fragments and the completed event has the full text", () => {
    // Shape: deltas emit fragments that build up to nothing meaningful on
    // their own (just the opening brace + summary start), and the
    // response.completed event carries the FULL text in `output_text`.
    // The parser must prefer the completed text over the partial deltas.
    const fullText = JSON.stringify(expectedReview);
    const stream = buildLiveEvidenceStream({
      includeCompleted: true,
      completedText: fullText,
      deltas: ['{"', 'summary":"partial'] as unknown as readonly string[],
    });
    const extracted = extractTextPayload("responses", stream);
    expect(extracted).toBe(fullText);
    const review = parseReviewPayload(extracted);
    expect(review).not.toBeNull();
    expect(review!.summary).toBe(expectedReview.summary);
  });

  it("parses a stream where deltas carry raw JSON fragments and there is NO response.completed event (truncated mid-stream)", () => {
    // Real-world case: the stream got cut off mid-delta. The full review
    // JSON is split across the deltas but the closing events never
    // arrived. The parser must round-trip the review as long as the
    // concatenated deltas form a balanced JSON object (or, when they
    // don't, surface a parse-fail so the retry path fires).
    const fullText = JSON.stringify(expectedReview);
    // Split the full text into small fragments to simulate token-streaming.
    const fragments: string[] = [];
    const chunkSize = 25;
    for (let i = 0; i < fullText.length; i += chunkSize) {
      fragments.push(fullText.slice(i, i + chunkSize));
    }
    const stream = buildLiveEvidenceStream({ deltas: fragments });
    const extracted = extractTextPayload("responses", stream);
    expect(extracted).toBe(fullText);
    const review = parseReviewPayload(extracted);
    expect(review).not.toBeNull();
    expect(review!.summary).toBe(expectedReview.summary);
  });

  it("returns the partial text when the stream is truncated mid-JSON and there is no completed event", () => {
    // True regression: the stream really IS truncated (provider cut off).
    // The parser must NOT silently pretend the partial JSON is a valid
    // review; it must surface enough for the strict empty-fields check
    // to fire so the parse-fail card posts instead of a half-rendered
    // review. This test pins the FAILURE MODE — if the parser becomes
    // too clever and starts accepting truncated JSON, this test breaks.
    const truncated = '{"summary":"New module src/provider/provider-parse.ts consolidates provider payload parsing/normalization (';
    const stream = buildLiveEvidenceStream({ deltas: [truncated] });
    const extracted = extractTextPayload("responses", stream);
    expect(extracted).toBe(truncated);
    const review = parseReviewPayload(extracted);
    // The balanced-object extractor cannot recover a complete object
    // from a truncated prefix, so parseReviewPayload must return null.
    expect(review).toBeNull();
  });

  it("handles the response.completed event with output[] legacy shape AND stub text", () => {
    // opaque-sse-model sometimes emits the completed event with the legacy
    // `output[].content[].text` shape (instead of `output_text`). When
    // that text is a stub like "placeholder", the parser must prefer
    // the concatenated deltas.
    const fullText = JSON.stringify(expectedReview);
    const lines: string[] = [
      "event: response.created",
      'data: {"type":"response.created","response":{"id":"resp_y"}}',
      "",
    ];
    lines.push(
      `data: {"type":"response.output_text.delta","item_id":"msg_2","output_index":0,"content_index":0,"delta":${JSON.stringify(fullText)}}`,
    );
    lines.push("");
    lines.push("event: response.completed");
    lines.push(
      `data: {"type":"response.completed","response":{"id":"resp_y","output":[{"type":"message","content":[{"type":"output_text","text":"placeholder"}]}]}}`,
    );
    lines.push("");
    lines.push("data: [DONE]");
    const stream = lines.join("\n");
    const extracted = extractTextPayload("responses", stream);
    expect(extracted).toBe(fullText);
    const review = parseReviewPayload(extracted);
    expect(review).not.toBeNull();
    expect(review!.summary).toBe(expectedReview.summary);
  });
});