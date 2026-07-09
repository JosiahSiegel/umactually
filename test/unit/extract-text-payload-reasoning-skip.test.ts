// Pins the parser's behavior when a Responses API response contains
// BOTH reasoning content (`output[].type = "reasoning"`, parts with
// `type = "reasoning_text"`) AND the final answer (`output[].type =
// "message"`, parts with `type = "output_text"`).
//
// Regression: MiniMax-M3 self-review on PR #29 emitted a 100+ KB
// response whose `output[]` carried a reasoning block followed by the
// truncated final message. `joinOutputText` previously concatenated
// EVERY `part.text` regardless of part type, so the text payload
// became 100 KB of reasoning prose + a tiny JSON tail. `parseReviewPayload`
// then tried to parse the first balanced `{` (inside the reasoning
// prose) and failed with "Expected property name or '}' in JSON".
//
// The fix: `joinOutputText` and the SSE delta accumulator must skip
// any part whose type is in the reasoning family. Only the
// `output_text` (or untyped) parts contribute to the final text payload.
import { describe, expect, it } from "vitest";

import {
  extractTextPayload,
  parseReviewPayload,
} from "../../src/provider/provider-parse.js";

describe("extractTextPayload: skip reasoning_text parts", () => {
  it("returns only the output_text part when output[] has a reasoning block followed by a message", () => {
    // The Responses API shape the M3 model returned: a `reasoning`
    // entry with a 100+ KB chain-of-thought `reasoning_text` part,
    // then a `message` entry with the JSON answer in an `output_text`
    // part. The fix: skip the reasoning entry entirely.
    const finalJson = JSON.stringify({
      summary: "Three findings",
      verdict: "COMMENT",
      comments: [
        {
          path: "src/cli/auto-model.ts",
          line: 100,
          body: "Sample finding body",
          severity: "low",
          category: "documentation",
        },
      ],
      suppressed_comments: [],
    });
    const responseJson = JSON.stringify({
      id: "resp_1",
      object: "response",
      status: "completed",
      output: [
        {
          id: "rs_1",
          type: "reasoning",
          status: "completed",
          content: [
            {
              type: "reasoning_text",
              text: "Let me carefully analyze this diff. ".repeat(2000),
            },
          ],
        },
        {
          id: "msg_1",
          type: "message",
          status: "completed",
          content: [
            { type: "output_text", text: finalJson },
          ],
        },
      ],
    });
    const extracted = extractTextPayload("responses", responseJson);
    // The reasoning text must NOT appear in the extracted payload.
    expect(extracted.includes("Let me carefully analyze")).toBe(false);
    // The final JSON answer must be the only thing the parser sees.
    expect(extracted).toBe(finalJson);
    // parseReviewPayload extracts a valid review from the answer.
    const review = parseReviewPayload(extracted);
    expect(review).not.toBeNull();
    expect(review?.summary).toBe("Three findings");
    expect(review?.comments.length).toBe(1);
  });

  it("returns only output_text deltas when SSE has both reasoning_text.delta and output_text.delta events", () => {
    // Streaming variant: a reasoning delta event followed by an
    // output_text delta event. The reasoning delta must be skipped.
    const finalJson = JSON.stringify({
      summary: "ok",
      verdict: "APPROVED",
      comments: [],
      suppressed_comments: [],
    });
    const sse =
      "event: response.created\n" +
      'data: {"type":"response.created","response":{"id":"resp_1"}}\n' +
      "\n" +
      "event: response.reasoning_text.delta\n" +
      'data: {"type":"response.reasoning_text.delta","delta":"chain of thought prose "}\n' +
      "\n" +
      "event: response.reasoning_text.delta\n" +
      'data: {"type":"response.reasoning_text.delta","delta":"more chain of thought"}\n' +
      "\n" +
      "event: response.output_text.delta\n" +
      `data: {"type":"response.output_text.delta","delta":${JSON.stringify(finalJson)}}\n` +
      "\n" +
      "event: response.completed\n" +
      'data: {"type":"response.completed","response":{"id":"resp_1"}}\n' +
      "\n";
    const extracted = extractTextPayload("responses", sse);
    expect(extracted.includes("chain of thought")).toBe(false);
    // The final text should still parse as a review.
    const review = parseReviewPayload(extracted);
    expect(review).not.toBeNull();
    expect(review?.verdict).toBe("APPROVED");
  });

  it("does not concatenate reasoning text when the only content is reasoning (no final message)", () => {
    // Edge case: the model burned its budget on reasoning and never
    // emitted the final answer. The extracted text MUST NOT contain
    // the reasoning prose. The current `extractTextPayload` falls
    // through to `return rawText` (the JSON envelope itself) when
    // `joinOutputText` returns empty — the strict-empty-fields
    // check downstream (`isNonEmptyReview`) then catches it as a
    // parse failure because the envelope has no `summary`/`verdict`/
    // `comments`. The key invariant: the reasoning text never makes
    // it into the extracted payload.
    const reasoningProse = "truncated chain of thought the model was about to emit";
    const responseJson = JSON.stringify({
      id: "resp_1",
      status: "incomplete",
      output: [
        {
          id: "rs_1",
          type: "reasoning",
          content: [
            { type: "reasoning_text", text: reasoningProse },
          ],
        },
      ],
    });
    const extracted = extractTextPayload("responses", responseJson);
    expect(extracted.includes(reasoningProse)).toBe(false);
    // The downstream strict check: the envelope has no review fields,
    // so the parsed review must be null (parse failure) or have all
    // empty fields.
    const review = parseReviewPayload(extracted);
    if (review !== null) {
      expect(review.summary).toBe("");
      expect(review.comments.length).toBe(0);
      expect(review.suppressed_comments.length).toBe(0);
    }
  });
});
