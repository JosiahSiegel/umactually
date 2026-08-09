// Reproduce the SSE→review extraction with the EXACT log the user pasted.
// The stream shape is from `created_at:1783376859` (a real opaque-sse-model run).
import { describe, expect, it } from "vitest";
import { extractTextPayload, parseReviewPayload } from "../../src/provider/provider-parse.js";

// Build the exact stream from the user's truncated log. The truncated
// middle (68822 chars omitted) contains the bulk of the JSON review —
// we substitute a synthetic JSON review that has the same shape and
// the same leading/trailing context.
function buildStream(): string {
  const reviewJson = JSON.stringify({
    summary: "The new orchestrator.ts wires together platform detection, Azure/GitHub diff fetching, provider requests (single-call and chunked), leak gating, sonar context, and simulate-findings substitution, with consistent failure-result shapes and helpful logging.",
    verdict: "NEEDS_FIX",
    comments: [
      { path: "src/cli/orchestrator.ts", line: 168, body: "comment 1", severity: "high", category: "correctness" },
      { path: "src/cli/orchestrator.ts", line: 170, body: "comment 2", severity: "high", category: "security" },
      { path: "src/cli/orchestrator.ts", line: 208, body: "comment 3", severity: "medium", category: "observability" },
      { path: "src/cli/orchestrator.ts", line: 225, body: "comment 4", severity: "medium", category: "correctness" },
      { path: "src/cli/orchestrator.ts", line: 231, body: "comment 5", severity: "low", category: "maintainability" },
    ],
    suppressed_comments: [],
  });
  // Deltas in chunks matching the user's log pattern: opening brace, then
  // summary text in 25-char-ish fragments.
  const deltaFragments: string[] = ['{"'];
  const inner = reviewJson.slice(1); // skip the leading '{'
  const chunkSize = 25;
  for (let i = 0; i < inner.length; i += chunkSize) {
    deltaFragments.push(inner.slice(i, i + chunkSize));
  }
  const lines: string[] = [];
  lines.push("event: response.created");
  lines.push(`data: {"type":"response.created","response":{"id":"resp_x","object":"response","status":"in_progress","model":"opaque-sse-model","output":[]}}`);
  lines.push("");
  lines.push("event: response.in_progress");
  lines.push(`data: {"type":"response.in_progress","response":{"id":"resp_x","status":"in_progress"}}`);
  lines.push("");
  lines.push("event: response.output_item.added");
  lines.push(`data: {"type":"response.output_item.added","output_index":0,"item":{"id":"msg_1","type":"message","status":"in_progress","role":"assistant","content":[]}}`);
  lines.push("");
  lines.push("event: response.content_part.added");
  lines.push(`data: {"type":"response.content_part.added","item_id":"msg_1","output_index":0,"content_index":0,"part":{"type":"output_text","text":"","annotations":[]}}`);
  lines.push("");
  for (const d of deltaFragments) {
    lines.push("event: response.output_text.delta");
    lines.push(`data: {"type":"response.output_text.delta","item_id":"msg_1","output_index":0,"content_index":0,"delta":${JSON.stringify(d)}}`);
    lines.push("");
  }
  // response.completed event with the FULL text in output[].content[].text
  // (this is the actual shape the user observed — the parser's fallback
  // path that joins output[] entries)
  lines.push("event: response.completed");
  lines.push(
    `data: {"type":"response.completed","response":{"id":"resp_x","status":"completed","output":[{"type":"message","content":[{"type":"output_text","text":${JSON.stringify(reviewJson)},"annotations":[]}]}],"usage":{"input_tokens":3997,"output_tokens":2219,"total_tokens":6216}}}`,
  );
  lines.push("");
  lines.push("data: [DONE]");
  return lines.join("\n");
}

describe("ADO SSE repro — completed event with output[] shape", () => {
  it("extracts the review from the response.completed output[] shape", () => {
    const stream = buildStream();
    const extracted = extractTextPayload("responses", stream);
    expect(extracted).toBeDefined();
    expect(extracted.length).toBeGreaterThan(0);
    // Parse it
    const review = parseReviewPayload(extracted);
    expect(review).not.toBeNull();
    expect(review!.comments.length).toBe(5);
    expect(review!.summary).toContain("orchestrator.ts wires together");
    expect(review!.verdict).toBe("NEEDS_FIX");
  });
});