// SPDX-License-Identifier: MIT
// Table-driven tests for normalizeProviderSeverity — the function that
// maps provider-emitted severity values to our canonical scale so the
// minimum-severity threshold works as intended.
//
// Regression coverage for the cross-platform severity fix: every mapping
// branch plus null/empty/uppercase-mixed input. A regression here silently
// re-classifies provider output and changes what gets posted vs filtered.

import { describe, expect, it, vi } from "vitest";
import { shouldKeepFinding } from "../../src/config/review-config.js";
import {
  normalizeProviderSeverity,
  parseReviewPayload,
} from "../../src/provider/provider-parse.js";

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

  it("integration: security and leak bypass shouldKeepFinding at minimum critical", () => {
    expect(shouldKeepFinding({ minimum: "critical" }, "security")).toBe(true);
    expect(shouldKeepFinding({ minimum: "critical" }, "leak")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Unknown-severity warning contract.
//
// The 5-tier canonical scale (info | low | medium | high | critical) is
// the only vocabulary the live runtime understands (see
// `src/util/severity.ts` `severityRank`). Providers occasionally emit a
// string outside this set — `"warning"`, `"important"`, `"3"`, etc. The
// historical `default:` branch silently coerced every unknown value to
// `"medium"`, which over-ranks style nits and hides the misbehavior from
// the operator.
//
// Contract: when the parser encounters an unrecognized severity string
// (or null/empty), it must (a) still fall back to `"medium"` so the run
// does not crash, but (b) surface a structured warning so operators can
// see which comment was malformed and which provider emitted it. The
// sink is the structured channel; `console.warn` is the operator-visible
// channel.
// ---------------------------------------------------------------------------

describe("normalizeProviderSeverity — unknown severity surfaces via sink", () => {
  it("warns and returns 'medium' for unrecognized string 'warning'", () => {
    const sink = vi.fn();
    const result = normalizeProviderSeverity("warning", null, {
      sink,
      providerName: "openai-compatible",
      commentIndex: 3,
    });
    expect(result).toBe("medium");
    expect(sink).toHaveBeenCalledTimes(1);
    const [raw, normalized, ctx] = sink.mock.calls[0]!;
    expect(raw).toBe("warning");
    expect(normalized).toBe("medium");
    expect(ctx).toMatchObject({ providerName: "openai-compatible", commentIndex: 3 });
  });

  it("returns 'medium' silently for empty string (no warning — providers commonly omit severity)", () => {
    const sink = vi.fn();
    const result = normalizeProviderSeverity("", null, {
      sink,
      providerName: "github-copilot",
      commentIndex: 0,
    });
    expect(result).toBe("medium");
    expect(sink).not.toHaveBeenCalled();
  });

  it("returns 'medium' silently for null (no warning — providers commonly omit severity)", () => {
    const sink = vi.fn();
    const result = normalizeProviderSeverity(null, null, {
      sink,
      providerName: "openai-compatible",
      commentIndex: 1,
    });
    expect(result).toBe("medium");
    expect(sink).not.toHaveBeenCalled();
  });

  it("does NOT warn for canonical value 'critical'", () => {
    const sink = vi.fn();
    expect(
      normalizeProviderSeverity("critical", null, {
        sink,
        providerName: "openai-compatible",
        commentIndex: 0,
      }),
    ).toBe("critical");
    expect(sink).not.toHaveBeenCalled();
  });

  it("does NOT warn for canonical synonym 'blocker'", () => {
    const sink = vi.fn();
    expect(
      normalizeProviderSeverity("blocker", null, {
        sink,
        providerName: "openai-compatible",
        commentIndex: 0,
      }),
    ).toBe("critical");
    expect(sink).not.toHaveBeenCalled();
  });

  it("does NOT warn for canonical synonym 'leak'", () => {
    const sink = vi.fn();
    expect(
      normalizeProviderSeverity("leak", "any body", {
        sink,
        providerName: "openai-compatible",
        commentIndex: 0,
      }),
    ).toBe("critical");
    expect(sink).not.toHaveBeenCalled();
  });

  it("does NOT warn when sink is omitted (backward-compat path)", () => {
    expect(normalizeProviderSeverity("warning")).toBe("medium");
    expect(normalizeProviderSeverity("")).toBe("medium");
    expect(normalizeProviderSeverity(null)).toBe("medium");
    // Sanity: the canonical high-tier value still maps correctly.
    expect(normalizeProviderSeverity("high")).toBe("high");
  });

  it("calls console.warn with the raw value, normalized value, and provider context", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      normalizeProviderSeverity("important", null, {
        sink: () => {},
        providerName: "openai-compatible",
        commentIndex: 7,
      });
      expect(warn).toHaveBeenCalledTimes(1);
      const firstCall = warn.mock.calls[0];
      expect(firstCall).toBeDefined();
      const args = firstCall as readonly unknown[];
      const msg = args[0] as string;
      expect(typeof msg).toBe("string");
      expect(msg).toContain("important");
      expect(msg).toContain("medium");
      expect(msg).toContain("openai-compatible");
      expect(msg).toContain("7");
    } finally {
      warn.mockRestore();
    }
  });

  it("the security body-pattern escalation (LEAK → critical, hardening → high) does NOT warn", () => {
    const sink = vi.fn();
    expect(
      normalizeProviderSeverity("security", "API key committed by accident", {
        sink,
        providerName: "openai-compatible",
        commentIndex: 0,
      }),
    ).toBe("critical");
    expect(
      normalizeProviderSeverity("security", "consider adding CSP", {
        sink,
        providerName: "openai-compatible",
        commentIndex: 1,
      }),
    ).toBe("high");
    expect(
      normalizeProviderSeverity("security", "neutral body", {
        sink,
        providerName: "openai-compatible",
        commentIndex: 2,
      }),
    ).toBe("high");
    expect(sink).not.toHaveBeenCalled();
  });
});

describe("parseReviewPayload — unknown severity surfaces via sink at call site", () => {
  it("emits a sink warning with provider name + comment index when a comment has 'warning'", () => {
    const sink = vi.fn();
    const payload = JSON.stringify({
      summary: "ok",
      verdict: "COMMENT",
      comments: [
        { path: "src/a.ts", line: 1, body: "b1", severity: "high", category: "x" },
        { path: "src/b.ts", line: 2, body: "b2", severity: "warning", category: "y" },
      ],
      suppressed_comments: [],
    });
    const review = parseReviewPayload(payload, { sink, providerName: "openai-compatible" });
    expect(review).not.toBeNull();
    expect(review!.comments[0]!.severity).toBe("high");
    expect(review!.comments[1]!.severity).toBe("medium");
    expect(sink).toHaveBeenCalledTimes(1);
    const [, , ctx] = sink.mock.calls[0]!;
    expect(ctx).toMatchObject({ providerName: "openai-compatible", commentIndex: 1 });
  });

  it("emits a sink warning for every unrecognized-severity comment (but NOT for empty/null), each with its index", () => {
    const sink = vi.fn();
    const payload = JSON.stringify({
      summary: "ok",
      verdict: "COMMENT",
      comments: [
        { path: "src/a.ts", line: 1, body: "b1", severity: "warning", category: "x" },
        { path: "src/b.ts", line: 2, body: "b2", severity: "3", category: "y" },
        { path: "src/c.ts", line: 3, body: "b3", severity: "high", category: "z" },
        // Empty severity: silent fallback to "medium" — no warning,
        // because providers commonly omit the field entirely and
        // warning per-comment would flood the logs (one warning per
        // finding on a 50-finding review).
        { path: "src/d.ts", line: 4, body: "b4", severity: "", category: "w" },
      ],
      suppressed_comments: [],
    });
    parseReviewPayload(payload, { sink, providerName: "github-copilot" });
    expect(sink).toHaveBeenCalledTimes(2);
    const indices = sink.mock.calls.map(
      (c) => (c[2] as { readonly commentIndex: number }).commentIndex,
    );
    expect(indices).toEqual([0, 1]);
    const providers = sink.mock.calls.map(
      (c) => (c[2] as { readonly providerName: string }).providerName,
    );
    expect(providers.every((p) => p === "github-copilot")).toBe(true);
  });

  it("emits a sink warning for suppressed_comments too", () => {
    const sink = vi.fn();
    const payload = JSON.stringify({
      summary: "ok",
      verdict: "COMMENT",
      comments: [],
      suppressed_comments: [
        { path: "src/a.ts", line: 1, body: "b1", severity: "important", category: "x" },
      ],
    });
    parseReviewPayload(payload, { sink, providerName: "openai-compatible" });
    expect(sink).toHaveBeenCalledTimes(1);
    const [, , ctx] = sink.mock.calls[0]!;
    expect(ctx).toMatchObject({ providerName: "openai-compatible", commentIndex: 0 });
  });

  it("parseReviewPayload without options still works (backward-compat path)", () => {
    const payload = JSON.stringify({
      summary: "ok",
      verdict: "COMMENT",
      comments: [
        { path: "src/a.ts", line: 1, body: "b1", severity: "warning", category: "x" },
      ],
      suppressed_comments: [],
    });
    const review = parseReviewPayload(payload);
    expect(review).not.toBeNull();
    expect(review!.comments[0]!.severity).toBe("medium");
  });
});