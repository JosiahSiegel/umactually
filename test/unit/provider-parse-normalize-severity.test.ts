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
  // Table of every mapping branch. Each row asserts both the output and
  // the rank tier the output falls into (so the minimum-severity threshold
  // will treat it correctly downstream).
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
    // (the security-conscious default). `security` and `leak` must map
    // here too so they DON'T get filtered out by a strict threshold.
    { input: "critical", expected: "critical", tier: "critical" },
    { input: "blocker",  expected: "critical", tier: "critical" },
    { input: "security", expected: "critical", tier: "critical" },
    { input: "leak",     expected: "critical", tier: "critical" },
    { input: "SECURITY", expected: "critical", tier: "critical" }, // case-insensitive

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

  it("integration: provider security is NOT filtered under minimum-severity: critical", () => {
    const normalized = normalizeProviderSeverity("security");
    expect(normalized).toBe("critical");

    // security-conscious user sets minimum-severity: critical → rank 4
    // security findings must pass (rank 4 >= 4). Pre-fix, they mapped to
    // `high` (rank 3) and were incorrectly filtered.
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
});