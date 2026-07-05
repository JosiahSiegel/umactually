import { describe, it, expect } from "vitest";
import { extractTextPayload } from "../../src/provider/provider-parse.js";
import { parseReviewPayload, isNonEmptyReview } from "../../src/provider/provider-parse.js";

// Reconstruct the 17,566-byte SSE stream shape from the 2026-07-05T23:43:45Z
// debug log. We don't have the full rawText, but the key signal is:
//   - first 200 chars of payload: "{\"summary\":\"This is a very large PR (~5k lines of src/ts..."
//   - last 200 chars of payload:  "...e cross-platform constraint... No issues — positive note on rendering correctness.\"}]}"
//   - payload size: 17566
//   - hasResponseCompletedEvent: true
// That shape corresponds to a real review where the model said "No issues".

describe("PR-9 SSE→payload→parse trace", () => {
  it("reconstructs a no-issues review from the SSE debug log shape", () => {
    // The "real review" payload that tryExtractSse should return.
    // It's a JSON object with summary, verdict, empty comments, empty suppressed_comments.
    const realReview = {
      summary: "This is a very large PR (~5k lines of src/ts + ~5k lines of dist/ bundles + 7 new scripts + 6 new tests). It introduces a 20-layout system for the review summary card, replaces the existing buildReviewBody helper with a severity-table layout, and adds new tests for control-char escaping in the JSON extractor and stub-completed detection in the SSE parser. The cross-platform constraint (no raw `<table>` HTML, no task lists, no fragile Unicode) is respected across all 20 renderers per the S5/S6 tests. No issues — positive note on rendering correctness. ".repeat(30),
      verdict: "NEEDS_FIX",
      comments: [],
      suppressed_comments: [],
    };
    const realReviewJson = JSON.stringify(realReview);

    // The SSE stream: a response.output_text.delta event whose `delta`
    // value carries the real review as a JSON-encoded string. The
    // response.completed event's output[] carries a STUB "placeholder"
    // (the MiniMax-M3 failure mode fixed by 937cdc4).
    const deltaEnvelope = JSON.stringify({
      type: "response.output_text.delta",
      delta: realReviewJson,
    });
    const completedEnvelope = JSON.stringify({
      type: "response.completed",
      response: {
        output: [{ content: [{ text: "placeholder" }] }],
      },
    });
    const sse = [
      `data: ${deltaEnvelope}`,
      "",
      `data: ${completedEnvelope}`,
      "",
    ].join("\n");

    const textPayload = extractTextPayload("responses", sse);
    console.log("textPayload length:", textPayload.length);
    console.log("textPayload first 200:", JSON.stringify(textPayload.slice(0, 200)));
    console.log("textPayload last 200:", JSON.stringify(textPayload.slice(-200)));

    // The real review (concatenated from deltas) should come through, NOT
    // the stub. The stub-completed-text fix from 937cdc4 should make
    // tryExtractSse prefer the deltas when the completed text is a stub.
    expect(textPayload).not.toBe("placeholder");
    expect(textPayload.length).toBeGreaterThan(1000);
    expect(textPayload).toContain('"summary"');

    const review = parseReviewPayload(textPayload);
    expect(review).not.toBeNull();
    expect(review!.summary.length).toBeGreaterThan(0);
    expect(isNonEmptyReview(review!)).toBe(true);
  });

  it("DEBUG: alternative — what if completed event has the real text in output[]?", () => {
    // Some providers (e.g. OpenAI proper) put the real text in
    // response.completed.output[].content[].text AND also emit deltas.
    // tryExtractSse prefers the completed text when non-stub.
    const realReview = {
      summary: "Test summary.",
      verdict: "NEEDS_FIX",
      comments: [],
      suppressed_comments: [],
    };
    const realReviewJson = JSON.stringify(realReview);

    const sse = [
      'data: {"type":"response.output_text.delta","delta":"' + realReviewJson + '"}',
      '',
      'data: {"type":"response.completed","response":{"output":[{"content":[{"text":"' + realReviewJson.replace(/"/g, '\\"') + '"}]}]}}',
      '',
    ].join("\n");

    const textPayload = extractTextPayload("responses", sse);
    expect(textPayload).toContain('"summary"');
  });
});
