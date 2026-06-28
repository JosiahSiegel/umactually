import { describe, expect, it } from "vitest";

import { expectNotImplementedExport } from "../helpers/assert-red-module.js";

type EvidenceBlockInput = {
  readonly evidenceQuote: string;
  readonly falsificationTest: string;
};

type RenderEvidenceBlock = (input: EvidenceBlockInput) => string;

const markdownModule = "../../src/render/markdown.js";
const markdownPath = "src/render/markdown.ts";

function isRenderEvidenceBlock(value: unknown): value is RenderEvidenceBlock {
  return typeof value === "function";
}

describe("markdown rendering RED unit contract", () => {
  it("REF-S3-RED-001 renders inline evidence and falsification blockquotes without unterminated fences", async () => {
    // Given: hostile reference inputs with backtick fences, newlines, and markdown metacharacters.
    const input: EvidenceBlockInput = {
      evidenceQuote: "```diff\n+ if (x) { return y; }\n```",
      falsificationTest: "This would not be a bug if X held.\nBut X is absent because of Y.",
    };

    // When: the future markdown renderer builds the evidence block.
    const renderEvidenceBlock = await expectNotImplementedExport(markdownModule, markdownPath, "renderEvidenceBlock");
    if (!isRenderEvidenceBlock(renderEvidenceBlock)) {
      expect.fail("RED: src/render/markdown.ts must export renderEvidenceBlock(input)");
    }
    const body = renderEvidenceBlock(input);

    // Then: inline code picks a longer fence and falsification text remains line-by-line blockquoted.
    expect(body).toContain("> **Evidence:** ````");
    expect(body).toContain("```diff");
    expect(body).toContain("> **Falsification test:**");
    expect(body).toContain("> This would not be a bug if X held.");
    expect(body).toContain("> But X is absent because of Y.");
  });
});
