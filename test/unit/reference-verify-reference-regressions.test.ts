// SPDX-License-Identifier: MIT
//
// Unit tests for src/reference/verify-reference-regressions.ts. The module
// enforces a contract on three reference fixture strings:
//
//   1. `inlineQuoteReference` must contain `wrap_inline_code` AND the
//      current `<!-- umactually -->` marker.
//   2. `rawJsonLeakReference` must contain `FenceClosureGuardTests` AND
//      the current marker.
//   3. `rawFencedJson` must contain the opening fence ```` ```json ````.
//
// Plus: the current marker must contain the BRAND slug
// ("umactually"). Each contract branch throws a plain `Error` with
// the "reference regression:" prefix so CI can grep for the failure
// shape.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BRAND } from "../../src/util/brand.js";
import { REVIEW_MARKER } from "../../src/util/marker.js";

import * as referenceModule from "../../src/reference/verify-reference-regressions.js";

const {
  verifyReferenceRegressions,
} = referenceModule;

import type { ReferenceRegressionInput } from "../../src/reference/verify-reference-regressions.js";

const INLINE_QUOTE_REFERENCE = [
  "# round-1 oracle PR review action",
  `# idempotency marker: ${REVIEW_MARKER}`,
  "def wrap_inline_code(value):",
  "    return _safe_inline_code(value)",
].join("\n");

const RAW_JSON_LEAK_REFERENCE = [
  "import unittest",
  `# idempotency marker: ${REVIEW_MARKER}`,
  "class FenceClosureGuardTests(unittest.TestCase):",
  "    def test_truncates_at_first_run_of_four_backticks(self):",
  "        pass",
].join("\n");

const RAW_FENCED_JSON = [
  "```json",
  "{",
  '  "marker": "umactually"',
  "}",
  "```",
].join("\n");

const EXPECTED_ARTIFACT = "artifacts/manual/s3-reference-compatibility.md";

function makeInput(
  overrides: Partial<ReferenceRegressionInput> = {},
): ReferenceRegressionInput {
  return {
    inlineQuoteReference: INLINE_QUOTE_REFERENCE,
    rawJsonLeakReference: RAW_JSON_LEAK_REFERENCE,
    rawFencedJson: RAW_FENCED_JSON,
    expectedArtifact: EXPECTED_ARTIFACT,
    ...overrides,
  };
}

const PROD_MARKER = "<!-- umactually -->";

describe("verifyReferenceRegressions — happy path", () => {
  it("returns a passing report when all 5 requireContains checks succeed", async () => {
    // Given: the canonical fixture inputs that satisfy every contract
    // token (wrap_inline_code, FenceClosureGuardTests, ```json, marker in
    // inlineQuoteReference, marker in rawJsonLeakReference).
    const input = makeInput();

    // When: the verifier runs.
    const report = await verifyReferenceRegressions(input);

    // Then: every required boolean is true and the artifact path is
    // echoed through.
    expect(report.preservesInlineQuoteEscaping).toBe(true);
    expect(report.preventsRawJsonLeak).toBe(true);
    expect(report.supportsCurrentMarker).toBe(true);
    expect(report.artifactPath).toBe(EXPECTED_ARTIFACT);
  });

  it("accepts the production marker because REVIEW_MARKER already contains the BRAND slug", () => {
    // Sanity: the production marker (the same string the runtime
    // uses everywhere else) contains the BRAND slug. The verifier's
    // internal marker-slug check passes.
    expect(REVIEW_MARKER).toBe(PROD_MARKER);
    expect(REVIEW_MARKER).toContain(BRAND);
  });
});

describe("verifyReferenceRegressions — missing contract tokens", () => {
  it("throws when inlineQuoteReference is missing wrap_inline_code", async () => {
    // Given: an inlineQuoteReference that lacks the wrap_inline_code token.
    const input = makeInput({
      inlineQuoteReference: `# marker: ${REVIEW_MARKER}\nno helper here`,
    });

    // When/Then: a reference-regression-shaped Error is thrown.
    await expect(verifyReferenceRegressions(input)).rejects.toThrow(
      /reference regression: inlineQuoteReference must contain wrap_inline_code/,
    );
  });

  it("throws when rawJsonLeakReference is missing FenceClosureGuardTests", async () => {
    // Given: a rawJsonLeakReference that lacks FenceClosureGuardTests.
    const input = makeInput({
      rawJsonLeakReference: `# marker: ${REVIEW_MARKER}\nno class here`,
    });

    // When/Then: a reference-regression-shaped Error is thrown.
    await expect(verifyReferenceRegressions(input)).rejects.toThrow(
      /reference regression: rawJsonLeakReference must contain FenceClosureGuardTests/,
    );
  });

  it("throws when rawFencedJson is missing the ```json fence", async () => {
    // Given: a rawFencedJson that lacks the ```json fence.
    const input = makeInput({
      rawFencedJson: "this is not a fenced json block",
    });

    // When/Then: a reference-regression-shaped Error is thrown.
    await expect(verifyReferenceRegressions(input)).rejects.toThrow(
      /reference regression: rawFencedJson must contain ```json/,
    );
  });

  it("throws when inlineQuoteReference is missing the marker", async () => {
    // Given: an inlineQuoteReference that has wrap_inline_code but no marker.
    const input = makeInput({
      inlineQuoteReference: "def wrap_inline_code(value):\n    return value",
    });

    // When/Then: the second inlineQuoteReference check (for the marker)
    // throws.
    await expect(verifyReferenceRegressions(input)).rejects.toThrow(
      /reference regression: inlineQuoteReference marker must contain <!-- umactually -->/,
    );
  });

  it("throws when rawJsonLeakReference is missing the marker", async () => {
    // Given: a rawJsonLeakReference that has FenceClosureGuardTests but no marker.
    const input = makeInput({
      rawJsonLeakReference: "class FenceClosureGuardTests:\n    pass",
    });

    // When/Then: the second rawJsonLeakReference check (for the marker)
    // throws.
    await expect(verifyReferenceRegressions(input)).rejects.toThrow(
      /reference regression: rawJsonLeakReference marker must contain <!-- umactually -->/,
    );
  });
});

describe("verifyReferenceRegressions — marker / brand slug integrity", () => {
  let markerSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    markerSpy = undefined;
  });

  afterEach(() => {
    markerSpy?.mockRestore();
  });

  it("throws when REVIEW_MARKER is replaced with one that omits the BRAND slug", async () => {
    // Given: the marker module is spied on to return a fake marker
    // that DOES NOT contain the BRAND slug. The fixture inputs use
    // that same fake marker so steps 1-5 of the verifier pass, and
    // the slug-integrity check (step 6) is the one that throws.
    const fakeMarker = "<!-- competitor-tool -->";
    const markerModule = await import("../../src/util/marker.js");
    markerSpy = vi
      .spyOn(markerModule, "REVIEW_MARKER", "get")
      .mockReturnValue(fakeMarker as unknown as typeof REVIEW_MARKER);

    const input = makeInput({
      inlineQuoteReference: `def wrap_inline_code(value):\n# ${fakeMarker}`,
      rawJsonLeakReference: `class FenceClosureGuardTests:\n# ${fakeMarker}`,
    });

    // When/Then: the slug check throws — the helper bails out before
    // constructing the report.
    await expect(verifyReferenceRegressions(input)).rejects.toThrow(
      /reference regression: current marker must contain the umactually slug/,
    );
  });
});
