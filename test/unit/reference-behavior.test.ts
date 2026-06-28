import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { expectNotImplementedExport } from "../helpers/assert-red-module.js";

type ReviewCompatibilityInput = {
  readonly existingCommentsJson: string;
  readonly providerResponsesJson: string;
  readonly chatFallbackJson: string;
  readonly diffText: string;
};

type ReviewCompatibilityReport = {
  readonly recognizesLegacyMarker: true;
  readonly recognizesCurrentMarker: true;
  readonly providerFallbackOrder: readonly ["responses", "chat"];
  readonly invalidDiffCommentSuppressed: true;
};

type VerifyReviewCompatibility = (input: ReviewCompatibilityInput) => Promise<ReviewCompatibilityReport>;

const compatibilityModule = "../../src/review/compatibility.js";
const compatibilityPath = "src/review/compatibility.ts";

function isVerifyReviewCompatibility(value: unknown): value is VerifyReviewCompatibility {
  return typeof value === "function";
}

describe("reference behavior RED unit contract", () => {
  it("GH-S1-RED-001 preserves idempotency markers, provider fallback shape, and diff-position suppression", async () => {
    // Given: legacy/current review markers, provider Responses/chat payloads, and a full diff position surface.
    const existingCommentsJson = await readFile(new URL("../fixtures/github/existing-review-comments.json", import.meta.url), "utf8");
    const providerResponsesJson = await readFile(new URL("../fixtures/provider/responses-success.json", import.meta.url), "utf8");
    const chatFallbackJson = await readFile(new URL("../fixtures/provider/chat-fallback-success.json", import.meta.url), "utf8");
    const diffText = await readFile(new URL("../fixtures/github/full-pr.diff", import.meta.url), "utf8");
    expect(existingCommentsJson).toContain("<!-- auto-pr-review -->");
    expect(existingCommentsJson).toContain("<!-- umactually-pr-review -->");
    expect(providerResponsesJson).toContain("output_text");
    expect(chatFallbackJson).toContain("choices");

    // When: the future compatibility verifier evaluates idempotency, provider fallback, and diff-line contracts.
    const verifyReviewCompatibility = await expectNotImplementedExport(
      compatibilityModule,
      compatibilityPath,
      "verifyReviewCompatibility",
    );
    if (!isVerifyReviewCompatibility(verifyReviewCompatibility)) {
      expect.fail("RED: src/review/compatibility.ts must export verifyReviewCompatibility(input)");
    }
    const result = await verifyReviewCompatibility({
      existingCommentsJson,
      providerResponsesJson,
      chatFallbackJson,
      diffText,
    });

    // Then: duplicate detection, provider fallback, and off-diff suppression are stable contracts.
    expect(result).toEqual({
      recognizesLegacyMarker: true,
      recognizesCurrentMarker: true,
      providerFallbackOrder: ["responses", "chat"],
      invalidDiffCommentSuppressed: true,
    });
  });
});
