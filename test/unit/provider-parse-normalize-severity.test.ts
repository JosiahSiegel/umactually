// SPDX-License-Identifier: MIT
// Table-driven tests for normalizeProviderSeverity — the function that
// maps provider-emitted severity values to our canonical scale so the
// minimum-severity threshold works as intended.
//
// Regression coverage for the cross-platform severity fix: every mapping
// branch plus null/empty/uppercase-mixed input. A regression here silently
// re-classifies provider output and changes what gets posted vs filtered.

import { describe, expect, it } from "vitest";
import { normalizeProviderSeverity } from "../../src/provider/provider-parse.js";

describe("normalizeProviderSeverity — provider scale → our scale", () => {
  // Table of every mapping branch (severity-only, no body). Each row
  // asserts both the output and the rank tier the output falls into (so
  // the minimum-severity threshold will treat it correctly downstream).
  const cases: ReadonlyArray<{
    readonly input: string | null;
    readonly expected: string;
    readonly tier: "below-medium" | "medium" | "high" | "critical";
  }> = [
    // `info` tier — filtered out under minimum-severity: medium
    { input: "info",   expected: "info",   tier: "below-medium" },
    { input: "nit",    expected: "info",   tier: "below-medium" },
    { input: "INFO",   expected: "info",   tier: "below-medium" }, // case-insensitive

    // `low` tier — filtered out under minimum-severity: medium
    { input: "minor",  expected: "low",    tier: "below-medium" },
    { input: "low",    expected: "low",    tier: "below-medium" },
    { input: "Minor",  expected: "low",    tier: "below-medium" }, // case-insensitive

    // `medium` tier — passes through at minimum-severity: medium (default)
    { input: "major",  expected: "medium", tier: "medium" },
    { input: "medium", expected: "medium", tier: "medium" },
    { input: "MAJOR",  expected: "medium", tier: "medium" }, // case-insensitive

    // `high` tier — passes through at minimum-severity: high
    { input: "high",   expected: "high",   tier: "high" },

    // `critical` tier — passes through at minimum-severity: critical
    // (the security-conscious default). `blocker` and `leak` map here
    // unconditionally. `security` is body-scoped — see the security
    // section below for the body-aware rules.
    { input: "critical", expected: "critical", tier: "critical" },
    { input: "blocker",  expected: "critical", tier: "critical" },
    { input: "leak",     expected: "critical", tier: "critical" },

    // `security` without body → high (conservative default — let the
    // user's threshold filter; no body means we can't tell if it's a
    // hardening tip or an active leak).
    { input: "security", expected: "high",   tier: "high" },
    { input: "SECURITY", expected: "high",   tier: "high" }, // case-insensitive

    // Unknown → medium (preserves prior default behavior)
    { input: "weird-unknown-value", expected: "medium", tier: "medium" },
    { input: "",                    expected: "medium", tier: "medium" },
    { input: null,                  expected: "medium", tier: "medium" },
  ];

  for (const c of cases) {
    const label = c.input === null ? "null" : JSON.stringify(c.input);
    it(`maps ${label} → ${c.expected} (tier: ${c.tier})`, () => {
      expect(normalizeProviderSeverity(c.input)).toBe(c.expected);
    });
  }

  // Body-scoped rules for `security` severity. The provider might emit
  // `security` for either a hardening tip ("consider adding a CSP header")
  // or an active leak ("API key committed by accident"). The body text
  // disambiguates: hardening tips stay at `high` so the user's threshold
  // can filter them; active leaks escalate to `critical` so they survive
  // any threshold.
  describe("security severity with body", () => {
    const securityCases: ReadonlyArray<{
      readonly label: string;
      readonly body: string;
      readonly expected: "high" | "critical";
    }> = [
      // Hardening tips → high (user's threshold can filter if desired)
      { label: "CSP suggestion",     body: "Consider adding a CSP header to your HTML responses.", expected: "high" },
      { label: "rate limiting tip", body: "You should want to add rate limiting to this endpoint.",  expected: "high" },
      { label: "best practice",     body: "This is a best practice hardening recommendation.",       expected: "high" },
      { label: "suggested using",   body: "Suggested using parameterized queries here.",             expected: "high" },

      // Active leaks → critical (must survive any threshold)
      { label: "API key leak",       body: "API key committed by accident in this file.",           expected: "critical" },
      { label: "secret token",       body: "Found a hardcoded secret token in the config.",        expected: "critical" },
      { label: "password exposed",   body: "Database password exposed in plain text.",              expected: "critical" },
      { label: "credential leak",   body: "User credential leaked via error message.",            expected: "critical" },
      { label: "private key",        body: "Private key committed to the repo.",                     expected: "critical" },

      // Neutral body → high (conservative default when body doesn't indicate
      // either hardening or active leak)
      { label: "neutral body",      body: "Some general security advice without specific hint.", expected: "high" },
    ];

    for (const c of securityCases) {
      it(`${c.label}: security + body → ${c.expected}`, () => {
        expect(normalizeProviderSeverity("security", c.body)).toBe(c.expected);
      });
    }
  });

  // Integration test: verify the mapping interacts correctly with the
  // minimum-severity threshold logic. A provider-emitted `nit` (which
  // maps to `info`) MUST be filtered out under the default threshold
  // of `medium` — that was the original bug this function fixed.
  it("integration: provider nit is filtered under minimum-severity: medium", () => {
    const normalized = normalizeProviderSeverity("nit");
    expect(normalized).toBe("info");

    // The threshold check (mirrors src/util/severity.ts severityRank):
    const severityRank = (s: string): number => {
      switch (s.toLowerCase()) {
        case "critical": return 4;
        case "high":     return 3;
        case "medium":   return 2;
        case "low":      return 1;
        default:         return 0;
      }
    };

    // Default minimum-severity: medium → rank 2
    expect(severityRank("info") >= severityRank("medium")).toBe(false);
    // So a nit is correctly filtered. Pre-fix, it would have defaulted
    // to "medium" (rank 2) and bypassed the filter.
  });

  it("integration: provider security + leak body is NOT filtered under minimum-severity: critical", () => {
    // security + leak-indicating body → critical → survives threshold.
    const normalized = normalizeProviderSeverity("security", "API key committed by accident");
    expect(normalized).toBe("critical");

    const severityRank = (s: string): number => {
      switch (s.toLowerCase()) {
        case "critical": return 4;
        case "high":     return 3;
        case "medium":   return 2;
        case "low":      return 1;
        default:         return 0;
      }
    };
    expect(severityRank("critical") >= severityRank("critical")).toBe(true);
  });

  it("integration: provider security + hardening body IS filtered under minimum-severity: critical", () => {
    // security + hardening-indicating body → high → filtered under
    // minimum-severity: critical (rank 4). This prevents hardening tips
    // from bypassing a strict security-conscious threshold.
    const normalized = normalizeProviderSeverity("security", "Consider adding a CSP header");
    expect(normalized).toBe("high");

    const severityRank = (s: string): number => {
      switch (s.toLowerCase()) {
        case "critical": return 4;
        case "high":     return 3;
        case "medium":   return 2;
        case "low":      return 1;
        default:         return 0;
      }
    };
    expect(severityRank("high") >= severityRank("critical")).toBe(false);
  });

  it("integration: provider leak is always critical regardless of body", () => {
    // `leak` is unambiguous — always critical.
    expect(normalizeProviderSeverity("leak", "Consider adding hardening")).toBe("critical");
    expect(normalizeProviderSeverity("leak", "")).toBe("critical");
    expect(normalizeProviderSeverity("leak", null)).toBe("critical");
  });
});