import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { verifyReferenceRegressions } from "../../src/reference/verify-reference-regressions.js";
import { REVIEW_MARKER } from "../../src/util/marker.js";

// Inline reference fixtures. The original `.reference/test_inline_quote_helpers.py`
// and `.reference/test_raw_json_leak_fix.py` are gitignored (the user wanted a
// fresh implementation rather than a vendored copy). The canonical behaviors
// they describe — wrap_inline_code in the inline-quote reference, and the
// FenceClosureGuardTests class in the raw-JSON-leak reference — are pinned
// below with the current marker.
const INLINE_QUOTE_REFERENCE_FRAGMENT = [
  "# round-1 oracle PR review action",
  `# idempotency marker: ${REVIEW_MARKER}`,
  "def wrap_inline_code(value):",
  "    return _safe_inline_code(value)",
  "def _safe_inline_code(value):",
  "    # collapse newlines, cap at 300 chars, preserve backticks",
  "    return value",
].join("\n");

const RAW_JSON_LEAK_REFERENCE_FRAGMENT = [
  "import unittest",
  `# idempotency marker: ${REVIEW_MARKER}`,
  "class FenceClosureGuardTests(unittest.TestCase):",
  "    def test_truncates_at_first_run_of_four_backticks(self):",
  "        # the raw-output renderer must truncate at the first fence",
  "        # so the outer markdown fence cannot close early",
  "        pass",
].join("\n");

describe("S3 reference regression contract", () => {
  it("REF-S3-001 preserves inline quote, raw-output, and current-marker reference behavior", async () => {
    // Given: the round-1 reference describes prior markdown escaping and raw JSON leak fixes.
    const inlineQuoteReference = INLINE_QUOTE_REFERENCE_FRAGMENT;
    const rawJsonLeakReference = RAW_JSON_LEAK_REFERENCE_FRAGMENT;
    const rawFencedJson = await readFile(new URL("../fixtures/provider/raw-fenced-json.txt", import.meta.url), "utf8");
    expect(inlineQuoteReference).toContain("wrap_inline_code");
    expect(rawJsonLeakReference).toContain("FenceClosureGuardTests");
    expect(rawFencedJson).toContain("```json");

    // When: the TypeScript regression verifier evaluates the references without executing Bash or Python.
    const result = await verifyReferenceRegressions({
      inlineQuoteReference,
      rawJsonLeakReference,
      rawFencedJson,
      expectedArtifact: "artifacts/manual/s3-reference-compatibility.md",
    });

    // Then: the current marker remains supported while raw JSON and fence leakage stay blocked.
    expect(result).toEqual({
      artifactPath: "artifacts/manual/s3-reference-compatibility.md",
      preservesInlineQuoteEscaping: true,
      preventsRawJsonLeak: true,
      supportsCurrentMarker: true,
    });
  });
});
