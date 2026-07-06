// Pins the SSE parser's handling of response.completed events whose
// output_text field contains real newlines at fence boundaries.
// When the JSON encoder emits such output_text on the wire, the
// newlines appear as literal \n characters inside the data: line
// — which the old `tryExtractSse` corrupted by splitting on \n
// without respecting JSON string boundaries.
//
// Regression test for the GitHub self-review parse-fail observed on
// PR #17 (commit f16921f): the self-review posted a parse-failure
// diagnostic card instead of a real review, even though the provider
// returned a valid JSON review in the SSE stream.

import { describe, expect, it } from "vitest";

import {
  extractTextPayload,
  parseReviewPayload,
} from "../../src/provider/provider-parse.js";

/**
 * Build the SSE wire-format string with a response.completed event
 * whose output_text contains a real newline at fence boundaries.
 * The data: line is a SINGLE physical line whose JSON value, when
 * parsed, unwraps to a string containing REAL \n characters.
 */
function buildSse(outputText: string): string {
  const completedDataLine =
    "data: " +
    JSON.stringify({
      type: "response.completed",
      response: {
        id: "resp_1",
        status: "completed",
        output_text: outputText,
      },
    });
  return [
    "event: response.created",
    'data: {"type":"response.created","response":{"id":"resp_1","status":"in_progress"}}',
    "",
    completedDataLine,
    "",
    "data: [DONE]",
    "",
  ].join("\n");
}

describe("provider SSE parsing: response.completed.output_text with real newlines", () => {
  it("extracts the full review when output_text has real newlines at fence boundaries", () => {
    const outputText =
      "```json\n{\"summary\":\"This PR is a large refactor\",\"verdict\":\"NEEDS_FIX\",\"comments\":[{\"path\":\"scripts/resolve-pr-17-threads.mjs\",\"line\":1,\"body\":\"one-shot\"}],\"suppressed_comments\":[]}\n```";
    const sseStream = buildSse(outputText);

    const textPayload = extractTextPayload("responses", sseStream);
    const review = parseReviewPayload(textPayload);

    expect(review).not.toBeNull();
    expect(review?.summary).toBe("This PR is a large refactor");
    expect(review?.verdict).toBe("NEEDS_FIX");
    expect(review?.comments).toHaveLength(1);
    expect(review?.comments[0]?.path).toBe("scripts/resolve-pr-17-threads.mjs");
  });

  it("extracts the full review when output_text uses 2-char \\n escapes at fence boundaries", () => {
    const outputText =
      '```json\\n{"summary":"clean","verdict":"APPROVED","comments":[],"suppressed_comments":[]}\\n```';
    const sseStream = buildSse(outputText);

    const textPayload = extractTextPayload("responses", sseStream);
    const review = parseReviewPayload(textPayload);

    expect(review).not.toBeNull();
    expect(review?.verdict).toBe("APPROVED");
  });
});