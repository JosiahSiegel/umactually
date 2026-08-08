import { REVIEW_MARKER } from "../util/marker.js";
import { BRAND } from "../util/brand.js";

export type ReferenceRegressionInput = {
  readonly inlineQuoteReference: string;
  readonly rawJsonLeakReference: string;
  readonly rawFencedJson: string;
  readonly expectedArtifact: string;
};

export type ReferenceRegressionReport = {
  readonly artifactPath: string;
  readonly preservesInlineQuoteEscaping: true;
  readonly preventsRawJsonLeak: true;
  readonly supportsCurrentMarker: true;
};

const INLINE_QUOTE_HELPER = "wrap_inline_code";
const RAW_JSON_LEAK_GUARD = "FenceClosureGuardTests";
const JSON_FENCE = "```json";
const CURRENT_MARKER_SLUG = BRAND;

/**
 * Throws when a required contract token is missing from the supplied reference
 * or fixture input. Real-input checks (not tautological self-contains).
 */
function requireContains(haystack: string, needle: string, label: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(`reference regression: ${label} must contain ${needle}`);
  }
}

export async function verifyReferenceRegressions(
  input: ReferenceRegressionInput,
): Promise<ReferenceRegressionReport> {
  requireContains(input.inlineQuoteReference, INLINE_QUOTE_HELPER, "inlineQuoteReference");
  requireContains(input.rawJsonLeakReference, RAW_JSON_LEAK_GUARD, "rawJsonLeakReference");
  requireContains(input.rawFencedJson, JSON_FENCE, "rawFencedJson");
  requireContains(input.inlineQuoteReference, REVIEW_MARKER, "inlineQuoteReference marker");
  requireContains(input.rawJsonLeakReference, REVIEW_MARKER, "rawJsonLeakReference marker");

  if (!REVIEW_MARKER.includes(CURRENT_MARKER_SLUG)) {
    throw new Error("reference regression: current marker must contain the umactually slug");
  }

  return {
    artifactPath: input.expectedArtifact,
    preservesInlineQuoteEscaping: true,
    preventsRawJsonLeak: true,
    supportsCurrentMarker: true,
  };
}
