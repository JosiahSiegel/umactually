import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { expectNotImplementedExport } from "../helpers/assert-red-module.js";

type RawReviewInput = {
  readonly rawText: string;
  readonly marker: "<!-- umactually-pr-review -->";
};

type RenderedRawReview = {
  readonly body: string;
  readonly recoveredSummary: "Recovered without raw JSON leak.";
  readonly rawJsonVisibleInTopLevelBody: false;
  readonly closesFenceEarly: false;
};

type RenderRawReviewFallback = (input: RawReviewInput) => RenderedRawReview;

const rawOutputModule = "../../src/render/raw-output.js";
const rawOutputPath = "src/render/raw-output.ts";

function isRenderRawReviewFallback(value: unknown): value is RenderRawReviewFallback {
  return typeof value === "function";
}

describe("raw output safety RED unit contract", () => {
  it("SEC-S5-RED-001 recovers summaries from fenced JSON and guards raw fence closure", async () => {
    // Given: a provider response that wraps otherwise useful JSON in a markdown fence.
    const rawText = await readFile(new URL("../fixtures/provider/raw-fenced-json.txt", import.meta.url), "utf8");
    expect(rawText).toContain("Recovered without raw JSON leak.");
    expect(rawText).toContain("```json");

    // When: the future raw-output fallback renderer handles the response.
    const renderRawReviewFallback = await expectNotImplementedExport(
      rawOutputModule,
      rawOutputPath,
      "renderRawReviewFallback",
    );
    if (!isRenderRawReviewFallback(renderRawReviewFallback)) {
      expect.fail("RED: src/render/raw-output.ts must export renderRawReviewFallback(input)");
    }
    const result = renderRawReviewFallback({
      rawText,
      marker: "<!-- umactually-pr-review -->",
    });

    // Then: top-level markdown contains the summary, not leaked raw JSON, and debug fences stay closed.
    expect(result).toEqual({
      body: expect.stringContaining("Recovered without raw JSON leak."),
      recoveredSummary: "Recovered without raw JSON leak.",
      rawJsonVisibleInTopLevelBody: false,
      closesFenceEarly: false,
    });
  });
});
