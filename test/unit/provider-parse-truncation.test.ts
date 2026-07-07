// Tests for the truncation-detection + token-usage parsing helpers in
// src/provider/provider-parse.ts. These are the building blocks for the
// parse-fail diagnostic that distinguishes "stream truncated by token
// budget" from "stream completed but JSON was malformed" — PR #20's
// self-review hit the truncated case and surfaced only a generic
// "Provider response did not contain a valid JSON review payload"
// headline. This file pins the detection contract so future refactors
// cannot silently regress the two cases into one.

import { describe, expect, it } from "vitest";

import { parseProviderUsage, wasResponseStreamTruncated } from "../../src/provider/provider-parse.js";

describe("wasResponseStreamTruncated", () => {
  it("returns true for an SSE stream that never emitted response.completed", () => {
    // Live evidence (PR #20 self-review, run 28870867167): the model
    // emitted valid-looking JSON deltas but the stream ended without
    // the terminal `response.completed` event because the token
    // budget ran out.
    const truncatedStream = [
      'event: response.created',
      'data: {"type":"response.created","response":{"id":"resp_x"}}',
      '',
      'event: response.in_progress',
      'data: {"type":"response.in_progress"}',
      '',
      'event: response.output_text.delta',
      'data: {"type":"response.output_text.delta","delta":"{\\"summary\\":"}',
      '',
      'event: response.output_text.delta',
      'data: {"type":"response.output_text.delta","delta":"truncated mid-stream"}',
      '',
      // No response.completed event follows.
    ].join("\n");
    expect(wasResponseStreamTruncated(truncatedStream)).toBe(true);
  });

  it("returns false when response.completed is present", () => {
    const completedStream = [
      'event: response.created',
      'data: {"type":"response.created"}',
      '',
      'event: response.completed',
      'data: {"type":"response.completed","response":{"output_text":"{}"}}',
      '',
    ].join("\n");
    expect(wasResponseStreamTruncated(completedStream)).toBe(false);
  });

  it("returns false when response.done is present (alternate terminal event)", () => {
    const doneStream = [
      'event: response.done',
      'data: {"type":"response.done"}',
      '',
    ].join("\n");
    expect(wasResponseStreamTruncated(doneStream)).toBe(false);
  });

  it("returns false for non-SSE responses (single-shot JSON envelopes)", () => {
    // /chat/completions returns a single JSON envelope, not a stream.
    // The "truncated" concept does not apply. Without this guard, the
    // PR #20 self-review test that stubs `{"output_text":"..."}` would
    // be misclassified as truncated.
    const nonSse = '{"output_text":"not actually a review"}';
    expect(wasResponseStreamTruncated(nonSse)).toBe(false);
  });

  it("returns false for empty input", () => {
    expect(wasResponseStreamTruncated("")).toBe(false);
  });

  it("returns false for plain prose (no SSE markers)", () => {
    expect(wasResponseStreamTruncated("the model said hello")).toBe(false);
  });
});

describe("parseProviderUsage", () => {
  it("extracts input_tokens, output_tokens, total_tokens from a completed event", () => {
    const stream = [
      'event: response.completed',
      'data: {"type":"response.completed","response":{"id":"resp_x"},"usage":{"input_tokens":4701,"input_tokens_details":{"cached_tokens":128},"output_tokens":2772,"output_tokens_details":{"reasoning_tokens":0},"total_tokens":7473}}',
      '',
    ].join("\n");
    expect(parseProviderUsage(stream)).toEqual({
      input_tokens: 4701,
      output_tokens: 2772,
      total_tokens: 7473,
    });
  });

  it("returns undefined when the stream never emitted a terminal event", () => {
    // Truncated stream has no `response.completed` — usage can't be
    // extracted because the usage block lives inside the terminal
    // event payload.
    expect(parseProviderUsage("event: response.created\ndata: {}")).toBeUndefined();
  });

  it("returns undefined when the terminal event has no usage block", () => {
    const stream = 'event: response.completed\ndata: {"type":"response.completed","response":{}}';
    expect(parseProviderUsage(stream)).toBeUndefined();
  });

  it("returns a partial shape when only some usage fields are present", () => {
    // Some providers report only output_tokens. We shouldn't pretend
    // the others are 0; surface what we know and let the consumer
    // handle missing fields defensively.
    const stream = 'event: response.completed\ndata: {"type":"response.completed","usage":{"output_tokens":42}}';
    expect(parseProviderUsage(stream)).toEqual({ output_tokens: 42 });
  });

  it("ignores usage-like JSON that isn't inside a terminal event", () => {
    // Defensive: a stray `"usage":{...}` substring somewhere in the
    // stream must not be parsed as the canonical usage block. Only
    // the usage block inside the terminal event counts.
    const stream = [
      'event: response.created',
      'data: {"type":"response.created","usage":{"output_tokens":999}}',
      '',
      // No response.completed follows.
    ].join("\n");
    expect(parseProviderUsage(stream)).toBeUndefined();
  });
});