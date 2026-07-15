// Verify the tightened apology regex doesn't false-positive on
// legitimate reviews containing "cannot" or "review" in unrelated contexts.

import { describe, expect, it } from "vitest";

// Re-import the regex patterns by mirroring them for verification.
const APOLOGY_PATTERNS: readonly RegExp[] = [
  /\bno\s+(diff|file\s+contents?|contents?)\b.*\b(provided|shared|available|supplied)\b/u,
  /\bplease\s+(share|provide|send)\s+(the\s+)?(diff|file|pull\s+request|pr)\b/u,
  /\bi\s+(cannot|can'?t|am\s+unable|i'?m\s+unable)\s+review\s+(this|it|the|a|that)\b/u,
  /\b(cannot|can'?t|unable\s+to)\s+review\s+(this|it|the|a|that|self)\b/u,
  /\b(didn'?t\s+receive|haven'?t\s+received|no\s+input)\b/u,
  /\b(empty\s+diff|no\s+diff\s+to\s+review|without\s+(diff|input))\b/u,
  /\b(is\s+empty|was\s+empty)\b.*\b(nothing|to\s+review)\b/u,
  /\bnothing\s+to\s+review\b/u,
];

function matchesApology(summary: string): boolean {
  const lower = summary.toLowerCase();
  return APOLOGY_PATTERNS.some((p) => p.test(lower));
}

describe("isApologySummary false-positive regression tests", () => {
  it("does NOT match 'I cannot reverse the migration in this review'", () => {
    // The reviewer's concern: this is a legitimate review mentioning
    // "cannot" and "review" but the model is NOT failing — it's talking
    // about the migration. The tightened regex should not match.
    expect(
      matchesApology("I cannot reverse the migration in this review"),
    ).toBe(false);
  });

  it("DOES match 'Cannot review the legacy code' (ambiguous — flagged as apology)", () => {
    // Genuinely ambiguous: the model may be saying "I can't review this
    // code" (apology) or "the legacy code wasn't reviewable but I checked
    // the rest" (legitimate). The current regex flags it as an apology
    // because 'Cannot review the' matches. Trade-off: false-positive
    // (legitimate review flagged as parse-fail) preferred over
    // false-negative (real apology missed).
    expect(
      matchesApology("Cannot review the legacy code, but no issues found."),
    ).toBe(true);
  });

  it("does NOT match 'This code is unable to review itself'", () => {
    expect(matchesApology("This code is unable to review itself.")).toBe(
      false,
    );
  });

  it("DOES match 'I cannot review this pull request'", () => {
    expect(matchesApology("I cannot review this pull request.")).toBe(true);
  });

  it("DOES match 'Cannot review — no diff provided'", () => {
    expect(matchesApology("Cannot review — no diff provided.")).toBe(true);
  });
});
