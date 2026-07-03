// Pins the SSE-streaming parser's coverage of the OpenAI Responses API
// format (response.output_text.delta, response.completed), which is the
// format that produced a 0-finding fallback review on PR #3. The
// previous parser only knew about chat-completions delta.content and
// a top-level delta string — neither matched the Responses API shape.
import { describe, expect, it } from "vitest";

import {
  buildResponsesBody,
  extractTextPayload,
  parseReviewPayload,
  type ProviderReviewPayload,
} from "../../src/provider/provider-parse.js";

describe("extractTextPayload: SSE streaming coverage", () => {
  it("parses the OpenAI Responses API streaming format (response.output_text.delta)", () => {
    // This is the exact shape the opencode/MiniMax model returned
    // against PR #3 — fragment events wrapped in a {type, delta}
    // envelope with `type: "response.output_text.delta"`. The parser
    // must accumulate the per-fragment `delta` strings into a single
    // text payload so parseReviewPayload can extract the review JSON.
    const sse =
      'event: response.created\n' +
      'data: {"type":"response.created","response":{"id":"resp_1","status":"in_progress","output":[]}}\n' +
      '\n' +
      'event: response.output_text.delta\n' +
      `data: {"type":"response.output_text.delta","delta":${JSON.stringify('{"summary":"all clean", "verdict":"APPROVED", "comments":[], "suppressed_comments":[]}')}}\n` +
      '\n' +
      'event: response.completed\n' +
      'data: {"type":"response.completed","response":{"id":"resp_1","status":"completed"}}\n';
    const text = extractTextPayload("responses", sse);
    expect(text).toBe('{"summary":"all clean", "verdict":"APPROVED", "comments":[], "suppressed_comments":[]}');
  });

  it("prefers the final response.completed output_text over accumulated deltas", () => {
    // Some providers (notably those that wrap Responses API streaming
    // weirdly) only send the final event with output_text and skip the
    // per-fragment deltas. We should prefer the completed response's
    // full text over fragment accumulation.
    const completedResponse = {
      type: "response.completed",
      response: {
        id: "resp_2",
        status: "completed",
        output_text: '{"summary":"full output from completed event","verdict":"NEEDS_FIX","comments":[],"suppressed_comments":[]}',
      },
    };
    const sse =
      'event: response.created\n' +
      `data: ${JSON.stringify(completedResponse)}\n`;
    const text = extractTextPayload("responses", sse);
    expect(text).toBe(completedResponse.response.output_text);
  });

  it("falls back to the output[] array join when response.completed has no output_text", () => {
    const sse =
      'event: response.completed\n' +
      'data: {"type":"response.completed","response":{"id":"resp_3","output":[{"content":[{"text":"joined"}]}]}}\n';
    const text = extractTextPayload("responses", sse);
    expect(text).toBe("joined");
  });

  it("returns null for SSE input that has no usable text fragments", () => {
    // Pure metadata events, no output_text delta or response.completed.
    // This is the failure mode that hit PR #3.
    const sse =
      'event: response.created\n' +
      'data: {"type":"response.created","response":{"id":"resp_4","status":"in_progress","output":[]}}\n';
    const text = extractTextPayload("responses", sse);
    expect(text).toBeNull();
  });
});

describe("parseReviewPayload + end-to-end SSE → review payload", () => {
  it("extracts the review payload from a Responses API SSE stream", () => {
    const review = {
      summary: "Found one issue.",
      verdict: "NEEDS_FIX",
      comments: [
        { path: "src/auth.ts", line: 12, body: "Use bcrypt.", severity: "high", category: "security" },
      ],
      suppressed_comments: [],
    };
    const sse =
      'event: response.output_text.delta\n' +
      `data: {"type":"response.output_text.delta","delta":${JSON.stringify(JSON.stringify(review))}}\n` +
      '\n' +
      'event: response.completed\n' +
      'data: {"type":"response.completed","response":{"id":"resp_5","status":"completed"}}\n';
    const text = extractTextPayload("responses", sse);
    expect(text).not.toBeNull();
    const payload: ProviderReviewPayload | null = parseReviewPayload(text!);
    expect(payload).not.toBeNull();
    expect(payload?.summary).toBe("Found one issue.");
    expect(payload?.verdict).toBe("NEEDS_FIX");
    expect(payload?.comments).toHaveLength(1);
    expect(payload?.comments[0]?.path).toBe("src/auth.ts");
    expect(payload?.comments[0]?.severity).toBe("high");
  });

  it("returns null for an SSE stream with no usable review content", () => {
    const sse =
      'event: response.created\n' +
      'data: {"type":"response.created","response":{"id":"resp_6","status":"in_progress","output":[]}}\n' +
      '\n' +
      'event: response.completed\n' +
      'data: {"type":"response.completed","response":{"id":"resp_6","status":"completed","output":[]}}\n';
    const text = extractTextPayload("responses", sse);
    // null because no output_text delta, no response.completed output_text,
    // and output[] is empty.
    expect(text).toBeNull();
  });
});

describe("buildResponsesBody: self-healing retry override", () => {
  it("accepts a userOverride that replaces the user message", () => {
    const body = buildResponsesBody(
      {
        model: "auto",
        system: "you are a reviewer",
        user: "review this diff",
      },
      { userOverride: "Please output JSON only" },
    );
    const input = body["input"] as ReadonlyArray<{ readonly role: string; readonly content: string }>;
    expect(input[1]?.content).toBe("Please output JSON only");
    expect(input[0]?.content).toBe("you are a reviewer");
  });

  it("falls back to the original user message when no override is supplied", () => {
    const body = buildResponsesBody({
      model: "auto",
      system: "you are a reviewer",
      user: "review this diff",
    });
    const input = body["input"] as ReadonlyArray<{ readonly role: string; readonly content: string }>;
    expect(input[1]?.content).toBe("review this diff");
  });
});