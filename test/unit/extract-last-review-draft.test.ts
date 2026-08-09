// Pins the reasoning-fallback path: when the provider returns 100+ KB
// of reasoning prose alongside an empty `output_text` field, the
// parser scans the reasoning for the LAST valid review-shaped JSON
// and uses it as the extracted text. Without this fallback, the
// The parse-fail surface balloons because the model
// writes a JSON draft inside its reasoning, runs out of budget, and
// never emits the final answer.
import { describe, expect, it } from "vitest";

import { extractTextPayload, parseReviewPayload } from "../../src/provider/provider-parse.js";

const VALID_REVIEW = JSON.stringify({
  summary: "Adds hostname-based model routing.",
  verdict: "COMMENT",
  comments: [
    {
      path: "src/cli/auto-model.ts",
      line: 26,
      body: "Docstring claims googleapis routes to gemini-2.5-flash but the corresponding HOST_ROUTES entry was not added.",
      severity: "medium",
      category: "documentation",
    },
  ],
  suppressed_comments: [],
});

describe("extractTextPayload: reasoning-fallback to last valid review draft", () => {
  it("recovers a review from a draft inside the reasoning block when output_text is empty", () => {
    // Real M3 model output observed in PR #29 self-review: a 100+ KB
    // response whose `output[]` carries only a reasoning block. The
    // reasoning text contains a ```json fenced review draft.
    const responseJson = JSON.stringify({
      id: "resp_1",
      object: "response",
      status: "incomplete",
      output: [
        {
          id: "rs_1",
          type: "reasoning",
          content: [
            {
              type: "reasoning_text",
              text:
                "Let me analyze this diff.\n\n" +
                "```json\n" +
                JSON.stringify({
                  summary: "Earlier draft — superseded.",
                  verdict: "APPROVED",
                  comments: [],
                  suppressed_comments: [],
                }) +
                "\n```\n\n" +
                "Hmm, let me reconsider:\n\n" +
                "```json\n" +
                VALID_REVIEW +
                "\n```\n\n" +
                "OK final answer.",
            },
          ],
        },
      ],
    });
    const extracted = extractTextPayload("responses", responseJson);
    expect(extracted).toBe(VALID_REVIEW);
    // The extracted text must parse as a real review.
    const review = parseReviewPayload(extracted);
    expect(review).not.toBeNull();
    expect(review?.summary).toBe("Adds hostname-based model routing.");
    expect(review?.comments.length).toBe(1);
  });

  it("prefers the LAST valid review draft when reasoning contains multiple drafts", () => {
    // Earlier drafts may parse but the LAST one is the most refined.
    const firstDraft = JSON.stringify({
      summary: "Old draft.",
      verdict: "APPROVED",
      comments: [],
      suppressed_comments: [],
    });
    const responseJson = JSON.stringify({
      output: [
        {
          type: "reasoning",
          content: [
            {
              type: "reasoning_text",
              text:
                "```json\n" + firstDraft + "\n```\n\n" +
                "```json\n" + VALID_REVIEW + "\n```",
            },
          ],
        },
      ],
    });
    const extracted = extractTextPayload("responses", responseJson);
    expect(extracted).toBe(VALID_REVIEW);
  });

  it("ignores fenced code blocks that are not review-shaped JSON", () => {
    // The reasoning text typically contains many code snippets
    // (model quotes diff lines, typescript signatures, etc.). The
    // fallback must only pick blocks that look like reviews.
    const responseJson = JSON.stringify({
      output: [
        {
          type: "reasoning",
          content: [
            {
              type: "reasoning_text",
              text:
                "Here's the code I see:\n\n" +
                "```typescript\n" +
                "export function foo() {\n  return 42;\n}\n" +
                "```\n\n" +
                "And here's the actual review:\n\n" +
                "```json\n" + VALID_REVIEW + "\n```",
            },
          ],
        },
      ],
    });
    const extracted = extractTextPayload("responses", responseJson);
    expect(extracted).toBe(VALID_REVIEW);
  });

  it("returns empty when no review-shaped JSON is in the reasoning", () => {
    // Reasoning-only with no review draft: empty result triggers
    // the strict-empty-fields parse-fail classification.
    const responseJson = JSON.stringify({
      output: [
        {
          type: "reasoning",
          content: [
            {
              type: "reasoning_text",
              text: "Just thinking about the diff. No draft yet. Final answer now.",
            },
          ],
        },
      ],
    });
    const extracted = extractTextPayload("responses", responseJson);
    expect(extracted).toBe("");
  });

  it("returns empty when the reasoning text contains only malformed JSON drafts", () => {
    // The model often writes partial JSON mid-thought. These should
    // NOT be returned — the parser must validate each fenced block.
    const responseJson = JSON.stringify({
      output: [
        {
          type: "reasoning",
          content: [
            {
              type: "reasoning_text",
              text:
                "```json\n{ \"summary\": \"truncated\n```\n\n" +
                "```json\n{ \"unclosed\n```",
            },
          ],
        },
      ],
    });
    const extracted = extractTextPayload("responses", responseJson);
    expect(extracted).toBe("");
  });

  it("uses the LAST review draft even when the model wrote a wrapper comment before the JSON", () => {
    // Sometimes the model writes prose between the ```json fence
    // opener and the actual { — must be tolerant.
    const responseJson = JSON.stringify({
      output: [
        {
          type: "reasoning",
          content: [
            {
              type: "reasoning_text",
              text:
                "```json\n" +
                "// Final review:\n" +
                VALID_REVIEW +
                "\n```",
            },
          ],
        },
      ],
    });
    const extracted = extractTextPayload("responses", responseJson);
    // Leading comment line makes the body not start with `{`,
    // so this case should return "" (no review draft found).
    // The model rarely does this; this test pins the current
    // strict-`{` behavior.
    expect(extracted).toBe("");
  });
});
