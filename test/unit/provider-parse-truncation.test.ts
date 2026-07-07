// Tests for the truncation-detection + token-usage parsing helpers in
// src/provider/provider-parse.ts. These are the building blocks for the
// parse-fail diagnostic that distinguishes "stream truncated by token
// budget" from "stream completed but JSON was malformed" — PR #20's
// self-review hit the truncated case and surfaced only a generic
// "Provider response did not contain a valid JSON review payload"
// headline. This file pins the detection contract so future refactors
// cannot silently regress the two cases into one.

import { describe, expect, it } from "vitest";

import {
  diagnoseParseFailure,
  parseProviderUsage,
  wasResponseStreamTruncated,
} from "../../src/provider/provider-parse.js";

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

  it("does NOT match a 'response.completed' substring inside a non-data: line", () => {
    // Regression for the self-review finding on
    // src/provider/provider-parse.ts:430 — a model reviewing a diff that
    // contains the literal string `"type":"response.completed"`
    // (e.g., reviewing SSE-parser code) must not trick the detector
    // into thinking the stream completed cleanly. The detector
    // scopes its match to `data:` lines only.
    const truncatedStream = [
      'event: response.created',
      'data: {"type":"response.created"}',
      '',
      'event: response.output_text.delta',
      'data: {"type":"response.output_text.delta","delta":"here is the literal: \\"type\\":\\"response.completed\\" appearing inside a review body"}',
      '',
      // No terminal event actually emitted — the substring is just
      // content inside a delta.
    ].join("\n");
    expect(wasResponseStreamTruncated(truncatedStream)).toBe(true);
  });

  it("handles the leading-space variant after 'data:' per the SSE spec", () => {
    // SSE spec says the data: prefix is optionally followed by a
    // single space before the payload. The detector strips it so
    // `data: {...}` and `data: {...}` both parse the same way.
    const completedStream = [
      'event: response.created',
      'data: {"type":"response.created"}',
      '',
      'event: response.completed',
      'data:  {"type":"response.completed"}',
      '',
    ].join("\n");
    expect(wasResponseStreamTruncated(completedStream)).toBe(false);
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

  it("scopes usage extraction to the terminal event's parsed payload", () => {
    // Regression for the self-review finding on
    // src/provider/provider-parse.ts:455 — when the stream contains
    // both a usage-bearing intermediate event AND the terminal
    // event's usage block, parseProviderUsage must return the
    // terminal-event values, not the first occurrence.
    const stream = [
      'event: response.created',
      'data: {"type":"response.created","usage":{"output_tokens":1}}',
      '',
      'event: response.completed',
      'data: {"type":"response.completed","usage":{"output_tokens":7777,"total_tokens":9999}}',
      '',
    ].join("\n");
    expect(parseProviderUsage(stream)).toEqual({
      output_tokens: 7777,
      total_tokens: 9999,
    });
  });
});

describe("diagnoseParseFailure (dedup helper for openai-compatible + copilot)", () => {
  // Both providers wire this helper into the parse-fail throw path
  // so the truncation-detection + usage-extraction logic is not
  // duplicated. Self-review of #20 found the duplication between
  // openai-compatible.ts and copilot.ts; this test pins the shared
  // contract.

  it("returns truncated=true with no usage for a stream missing response.completed", () => {
    const diagnosis = diagnoseParseFailure({
      rawText: 'event: response.created\ndata: {"type":"response.created"}',
    });
    expect(diagnosis.truncated).toBe(true);
    expect(diagnosis.usage).toBeUndefined();
  });

  it("returns truncated=false with usage when the terminal event was emitted", () => {
    const stream = [
      'event: response.completed',
      'data: {"type":"response.completed","usage":{"output_tokens":5000,"total_tokens":6000}}',
      '',
    ].join("\n");
    const diagnosis = diagnoseParseFailure({ rawText: stream });
    expect(diagnosis.truncated).toBe(false);
    expect(diagnosis.usage).toEqual({ output_tokens: 5000, total_tokens: 6000 });
  });

  it("does NOT emit any stderr output (the headroom warning was removed as dead code)", () => {
    // The earlier inline duplicate emitted a ::warning:: line when
    // truncated AND usage was populated. That combination is
    // unreachable in practice (a stream with the terminal event
    // is by definition not truncated), so the warning was dead
    // code. The helper deliberately omits it. If a future provider
    // emits usage on intermediate events, a dedicated
    // parseIntermediateUsage helper should reintroduce the warning.
    const writes: string[] = [];
    const originalWrite = process.stderr.write.bind(process.stderr);
    const spy = ((chunk: string | Uint8Array, ...rest: unknown[]): boolean => {
      if (typeof chunk === "string") writes.push(chunk);
      return originalWrite(chunk as never, ...(rest as never[]));
    }) as typeof process.stderr.write;
    process.stderr.write = spy;
    try {
      diagnoseParseFailure({
        rawText: 'event: response.created\ndata: {"type":"response.created"}',
      });
      expect(writes.length).toBe(0);
    } finally {
      process.stderr.write = originalWrite;
    }
  });
});