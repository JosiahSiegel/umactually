// Pins CLARITY-12: parse-fail diagnostic must show BOTH the head and tail
// of a long stream so reviewers can see what the model began with AND
// the final response.completed event. The previous diagnostic truncated
// to the first 1000 chars, hiding the actual response.completed output.
// A reviewer seeing only the head could incorrectly conclude "the model
// returned only metadata" when the real cause (text was truncated from
// the diagnostic) was hidden.
//
// Also pins the diagnostic budget (MALFORMED_PROVIDER_FALLBACK_RAW_MAX
// in src/cli/live-shared.ts) so the value cannot silently regress below
// what's needed to capture a typical SSE stream. PR #5 self-review
// repeatedly produced `parseFailed:true` because the budget was too
// small to include the final `response.completed` payload; raising it
// to 16 000 chars lets the diagnostic include a typical modern review
// JSON (2-12 KB) verbatim, while still fitting inside GitHub's
// 65 536-char comment body limit.

import { describe, expect, it } from "vitest";

import { buildMalformedProviderFallback } from "../../src/cli/live-shared.js";

describe("CLARITY-12: parse-fail diagnostic shows head + tail", () => {
  it("shows the full rawText when it fits within the diagnostic budget", () => {
    const shortStream = "event: response.created\ndata: {\"type\":\"response.created\"}\n";
    const fallback = buildMalformedProviderFallback({
      provider: "openai-compatible",
      modelId: "auto",
      rawText: shortStream,
      secrets: [],
    });
    expect(fallback.summary).toContain(shortStream);
    expect(fallback.summary).not.toContain("…");
  });

  it("shows both head and tail when the stream exceeds the diagnostic budget, with a clear truncation marker", () => {
    // Build a stream that looks like the PR #3 incident: metadata events
    // followed by a long review JSON, totaling more than the budget.
    const head =
      "event: response.created\n" +
      'data: {"type":"response.created","response":{"id":"resp_1","output":[]}}\n\n' +
      "event: response.in_progress\n" +
      'data: {"type":"response.in_progress","response":{"id":"resp_1","output":[]}}\n\n';
    const tail =
      "event: response.completed\n" +
      'data: {"type":"response.completed","response":{"id":"resp_1","status":"completed","output_text":"REVIEW_JSON_HERE"}}\n';
    // Padding must be large enough to exceed MALFORMED_PROVIDER_FALLBACK_RAW_MAX
    // (16 000) so head+tail truncation kicks in. Stream ends up > 32 000 chars.
    const padding = "x".repeat(32_000);
    const longStream = head + padding + tail;

    const fallback = buildMalformedProviderFallback({
      provider: "openai-compatible",
      modelId: "auto",
      rawText: longStream,
      secrets: [],
    });

    // The diagnostic must include BOTH the head (metadata events) AND the
    // tail (response.completed with output_text). The previous head-only
    // truncation hid the response.completed event entirely.
    expect(fallback.summary).toContain("event: response.created");
    expect(fallback.summary).toContain("event: response.completed");
    expect(fallback.summary).toContain("REVIEW_JSON_HERE");
    // The padding in the middle must be omitted (or at least not the full 32 000 chars).
    expect(fallback.summary).not.toContain(padding);
  });

  it("the truncation marker indicates how many chars were omitted", () => {
    // Must exceed MALFORMED_PROVIDER_FALLBACK_RAW_MAX (16 000) for head+tail
    // truncation to kick in.
    const head = "A".repeat(10_000);
    const tail = "B".repeat(10_000);
    const longStream = head + tail;
    const fallback = buildMalformedProviderFallback({
      provider: "openai-compatible",
      modelId: "auto",
      rawText: longStream,
      secrets: [],
    });
    // The marker should quantify the omission so reviewers know what they
    // didn't see — e.g., "… [N chars omitted] …"
    expect(fallback.summary).toMatch(/\[(\d+) chars omitted\]/u);
  });

  it("preserves a full 12 KB review JSON inline (the upper bound of typical modern reviews)", () => {
    // Regression: PR #5 self-review produced parseFailed:true repeatedly
    // because the diagnostic budget was 4000 chars and the actual JSON
    // review was larger. Pin that a 12 KB review body now fits in the
    // diagnostic without head+tail truncation.
    const reviewJson = "X".repeat(12_000);
    const stream =
      "event: response.created\ndata: {}\n\n" +
      "event: response.completed\ndata: " +
      reviewJson + "\n";
    const fallback = buildMalformedProviderFallback({
      provider: "openai-compatible",
      modelId: "auto",
      rawText: stream,
      secrets: [],
    });
    expect(fallback.summary).toContain(reviewJson);
    expect(fallback.summary).not.toContain("chars omitted");
  });

  it("keeps the diagnostic block small enough for GitHub's 65 536-char comment body limit", () => {
    // Sanity: even with a 16 000-char raw stream, the full diagnostic
    // block (wrapped in <details> + summary + manifest) must stay well
    // under GitHub's comment body limit.
    const rawText = "y".repeat(60_000); // pathological SSE stream
    const fallback = buildMalformedProviderFallback({
      provider: "openai-compatible",
      modelId: "auto",
      rawText,
      secrets: [],
    });
    expect(fallback.summary.length).toBeLessThan(20_000);
  });
});
