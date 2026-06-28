import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { expectNotImplementedExport } from "../helpers/assert-red-module.js";

type ReferenceRegressionInput = {
  readonly inlineQuoteReference: string;
  readonly rawJsonLeakReference: string;
  readonly rawFencedJson: string;
  readonly expectedArtifact: "artifacts/manual/s3-reference-compatibility.md";
};

type ReferenceRegressionReport = {
  readonly artifactPath: string;
  readonly preservesInlineQuoteEscaping: true;
  readonly preventsRawJsonLeak: true;
  readonly supportsLegacyMarker: true;
  readonly supportsCurrentMarker: true;
};

type VerifyReferenceRegressions = (input: ReferenceRegressionInput) => Promise<ReferenceRegressionReport>;

const referenceModule = "../../src/reference/verify-reference-regressions.js";
const referencePath = "src/reference/verify-reference-regressions.ts";

function isVerifyReferenceRegressions(value: unknown): value is VerifyReferenceRegressions {
  return typeof value === "function";
}

describe("S3 reference compatibility RED contract", () => {
  it("REF-S3-RED-001 preserves inline quote, raw-output, and idempotency reference behavior", async () => {
    // Given: Python reference tests describe prior markdown escaping and raw JSON leak fixes.
    const inlineQuoteReference = await readFile(new URL("../../.reference/test_inline_quote_helpers.py", import.meta.url), "utf8");
    const rawJsonLeakReference = await readFile(new URL("../../.reference/test_raw_json_leak_fix.py", import.meta.url), "utf8");
    const rawFencedJson = await readFile(new URL("../fixtures/provider/raw-fenced-json.txt", import.meta.url), "utf8");
    expect(inlineQuoteReference).toContain("wrap_inline_code");
    expect(rawJsonLeakReference).toContain("FenceClosureGuardTests");
    expect(rawFencedJson).toContain("```json");

    // When: the future TypeScript compatibility verifier evaluates the references without executing Bash or Python.
    const verifyReferenceRegressions = await expectNotImplementedExport(
      referenceModule,
      referencePath,
      "verifyReferenceRegressions",
    );
    if (!isVerifyReferenceRegressions(verifyReferenceRegressions)) {
      expect.fail("RED: src/reference/verify-reference-regressions.ts must export verifyReferenceRegressions(input)");
    }
    const result = await verifyReferenceRegressions({
      inlineQuoteReference,
      rawJsonLeakReference,
      rawFencedJson,
      expectedArtifact: "artifacts/manual/s3-reference-compatibility.md",
    });

    // Then: old and new markers remain compatible while raw JSON and fence leakage stay blocked.
    expect(result).toEqual({
      artifactPath: "artifacts/manual/s3-reference-compatibility.md",
      preservesInlineQuoteEscaping: true,
      preventsRawJsonLeak: true,
      supportsLegacyMarker: true,
      supportsCurrentMarker: true,
    });
  });
});
