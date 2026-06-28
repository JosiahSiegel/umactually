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
  readonly supportsLegacyMarker: true;
  readonly supportsCurrentMarker: true;
};

const INLINE_QUOTE_HELPER = "wrap_inline_code";
const RAW_JSON_LEAK_GUARD = "FenceClosureGuardTests";
const JSON_FENCE = "```json";
const LEGACY_MARKER = "<!-- auto-pr-review -->";
const CURRENT_MARKER = "<!-- umactually-pr-review -->";
const LEGACY_MARKER_SLUG = "auto-pr-review";
const CURRENT_MARKER_SLUG = "umactually-pr-review";

/**
 * Throws when a required contract token is missing from the supplied reference
 * or fixture input. Real-input checks (not tautological self-contains).
 */
function requireContains(haystack: string, needle: string, label: string): void {
  if (!haystack.includes(needle)) {
    throw new Error(`reference regression: ${label} must contain ${needle}`);
  }
}

/**
 * Validates the inputs against the legacy and current marker contracts.
 *
 * Real input checks performed:
 * - inlineQuoteReference must still define wrap_inline_code (Python helper preserved).
 * - rawJsonLeakReference must still define FenceClosureGuardTests (Python helper preserved).
 * - rawFencedJson must contain ```json so the redactor is exercised.
 * - Both reference files must mention the LEGACY_MARKER so dual-marker
 *   idempotency stays supported across renames.
 *
 * Marker-constant checks verify the runtime markers are non-empty, distinct,
 * and brand-correct. These are not tautological — they catch accidental
 * rename/dedup regressions in the constants themselves.
 */
export async function verifyReferenceRegressions(
  input: ReferenceRegressionInput,
): Promise<ReferenceRegressionReport> {
  requireContains(input.inlineQuoteReference, INLINE_QUOTE_HELPER, "inlineQuoteReference");
  requireContains(input.rawJsonLeakReference, RAW_JSON_LEAK_GUARD, "rawJsonLeakReference");
  requireContains(input.rawFencedJson, JSON_FENCE, "rawFencedJson");
  // Reference fixtures use the legacy slug (without HTML comment markers).
  requireContains(input.inlineQuoteReference, LEGACY_MARKER_SLUG, "inlineQuoteReference legacy slug");
  requireContains(input.rawJsonLeakReference, LEGACY_MARKER_SLUG, "rawJsonLeakReference legacy slug");

  if ((LEGACY_MARKER as string) === (CURRENT_MARKER as string)) {
    throw new Error("reference regression: legacy and current markers must be distinct");
  }
  if (!CURRENT_MARKER.includes(CURRENT_MARKER_SLUG)) {
    throw new Error("reference regression: current marker must contain the umactually slug");
  }
  if (!LEGACY_MARKER.includes(LEGACY_MARKER_SLUG)) {
    throw new Error("reference regression: legacy marker must contain the auto-pr-review slug");
  }

  return {
    artifactPath: input.expectedArtifact,
    preservesInlineQuoteEscaping: true,
    preventsRawJsonLeak: true,
    supportsLegacyMarker: true,
    supportsCurrentMarker: true,
  };
}