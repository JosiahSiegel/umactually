// REPRO: Latest self-review on 075cecd posted a parse-fail. The diagnostic
// shows the model emitted a real review wrapped in markdown fences across
// many SSE delta events. The parser SHOULD extract this — and now does
// after the regex fix in json-extract.ts (accepts ``` without language tag).

import { describe, it } from "vitest";

import {
  extractTextPayload,
  parseReviewPayload,
} from "../../src/provider/provider-parse.js";

describe("REPRO: 075cecd parse-fail — markdown-fenced JSON in SSE deltas", () => {
  it("extracts JSON wrapped in ```...``` (no language tag) across many SSE deltas", () => {
    // The 075cecd incident: model emitted ```\n{...}\n``` (no 'json' tag).
    const reviewJson = JSON.stringify({
      summary: "Found three issues.",
      verdict: "NEEDS_FIX",
      comments: [
        { path: "src/a.ts", line: 1, body: "issue A", severity: "high", category: "security" },
        { path: "src/b.ts", line: 2, body: "issue B", severity: "medium", category: "logic" },
      ],
      suppressed_comments: [],
    });
    // NO 'json' language tag — this is the regression case.
    const wrappedText = "```\n" + reviewJson + "\n```";

    // Build the SSE stream as if the model emitted it character-by-character.
    const FRAGMENT_SIZE = 8;
    const deltas: string[] = [];
    for (let i = 0; i < wrappedText.length; i += FRAGMENT_SIZE) {
      deltas.push(wrappedText.slice(i, i + FRAGMENT_SIZE));
    }

    const sseLines: string[] = [
      'event: response.created',
      'data: {"type":"response.created","response":{"id":"r1","status":"in_progress","output":[]}}',
      "",
      'event: response.in_progress',
      'data: {"type":"response.in_progress","response":{"id":"r1","status":"in_progress","output":[]}}',
      "",
      'event: response.output_item.added',
      'data: {"type":"response.output_item.added","item_id":"m1","output_index":0}',
      "",
      'event: response.content_part.added',
      'data: {"type":"response.content_part.added","item_id":"m1","output_index":0,"content_index":0,"part":{"type":"output_text","text":"","annotations":[]}}',
      "",
    ];
    for (const delta of deltas) {
      sseLines.push("event: response.output_text.delta");
      sseLines.push(
        `data: ${JSON.stringify({ type: "response.output_text.delta", item_id: "m1", output_index: 0, content_index: 0, delta })}`,
      );
      sseLines.push("");
    }
    sseLines.push("event: response.completed");
    sseLines.push(
      'data: {"type":"response.completed","response":{"id":"r1","status":"completed"}}',
    );
    sseLines.push("");
    sseLines.push("data: [DONE]");
    const sse = sseLines.join("\n");

    const textPayload = extractTextPayload("responses", sse);
    const review = parseReviewPayload(textPayload);

    // The parser MUST extract the JSON successfully — even without
    // the 'json' language tag in the opening fence.
    expect(review).not.toBeNull();
    if (review !== null) {
      expect(review.summary).toBe("Found three issues.");
      expect(review.verdict).toBe("NEEDS_FIX");
      expect(review.comments).toHaveLength(2);
    }
  });

  it("extracts JSON wrapped in ```json ... ``` (explicit tag) — backward compatibility", () => {
    const reviewJson = JSON.stringify({
      summary: "Backward compat test.",
      verdict: "DISCUSS",
      comments: [],
      suppressed_comments: [],
    });
    const wrappedText = "```json\n" + reviewJson + "\n```";

    const sseLines: string[] = [
      'event: response.created',
      'data: {"type":"response.created","response":{"id":"r1","status":"in_progress","output":[]}}',
      "",
      'event: response.output_text.delta',
      `data: ${JSON.stringify({ type: "response.output_text.delta", delta: wrappedText })}`,
      "",
      'event: response.completed',
      'data: {"type":"response.completed","response":{"id":"r1","status":"completed"}}',
      "",
    ];
    const sse = sseLines.join("\n");
    const textPayload = extractTextPayload("responses", sse);
    const review = parseReviewPayload(textPayload);

    expect(review).not.toBeNull();
    if (review !== null) {
      expect(review.summary).toBe("Backward compat test.");
      expect(review.verdict).toBe("DISCUSS");
    }
  });
});
