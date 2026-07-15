import { describe, expect, it } from "vitest";

import {
  extractTextPayload,
  parseReviewPayload,
} from "../../src/provider/provider-parse.js";

function responseDeltaEvent(delta: string): string {
  return [
    "event: response.output_text.delta",
    "data: {\"type\":\"response.output_text.delta\",",
    `data: \"delta\":${JSON.stringify(delta)}}`,
    "",
  ].join("\n");
}

describe("provider SSE parsing: multi-line data events", () => {
  it("joins multi-line data fields and preserves JSON string newlines through parseReviewPayload", () => {
    // Given: realistic Responses API SSE where the event JSON itself is split
    // across multiple data: lines. The model's review JSON contains literal
    // newlines inside string values after the outer SSE wrapper is decoded.
    const reviewJson = [
      '{"summary":"Line one',
      'Line two",',
      '"verdict":"NEEDS_FIX",',
      '"comments":[{"path":"src/a.ts","line":12,"body":"Use a guard',
      'before writing.","severity":"medium","category":"correctness"}],',
      '"suppressed_comments":[]}',
    ].join("\n");
    const stream = [
      "event: response.created",
      "data: {\"type\":\"response.created\",\"response\":{\"id\":\"r1\"}}",
      "",
      responseDeltaEvent(reviewJson),
      "data: [DONE]",
      "",
    ].join("\n");

    // When: the SSE stream is reduced to provider text and parsed as a review.
    const textPayload = extractTextPayload("responses", stream);
    const review = parseReviewPayload(textPayload);

    // Then: data: lines were joined with newlines per SSE spec, and the
    // existing balanced-object recovery escaped raw control chars so JSON.parse
    // round-trips the original string values.
    expect(textPayload).toContain('"summary":"Line one\nLine two"');
    expect(review).not.toBeNull();
    expect(review?.summary).toBe("Line one\nLine two");
    expect(review?.comments).toHaveLength(1);
    expect(review?.comments[0]?.body).toBe("Use a guard\nbefore writing.");
  });
});
