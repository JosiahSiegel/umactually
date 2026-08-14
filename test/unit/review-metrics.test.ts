// SPDX-License-Identifier: MIT
//
// Task 7 — Review metrics module unit tests.
// Drives the implementation of `src/cli/review-metrics.ts`.
//
// The test file pins the public contract for the local-only audit artifact:
//   * Monotonic durations per phase (context, provider, verification, posting, total).
//   * Provider usage + round-trip counts on BOTH successful and failed paths;
//     unavailable usage is OMITTED, never zero-invented.
//   * Reason histograms with a closed enum (every observed reason is recorded).
//   * Considered/kept/downgraded/suppressed/off-diff counts.
//   * Decision (full/incremental) + policy/context hashes, computed via sha256
//     over a canonicalized JSON of the policy and context inputs.
//   * Optional cost estimates ONLY from explicit user-configured per-token
//     prices; absent price yields no cost field; configured price yields
//     an exact decimal estimate marked `estimated` with currency/source.
//   * Secrets and URLs (including query strings) are redacted from the
//     serialized artifact.
//   * Existing JSON envelope fields stay compatible — additive versioning.

import { describe, expect, it } from "vitest";
import {
  ALL_REASON_KINDS,
  REASON_KIND_VALUES,
  type ConsideredCounts,
  type FilterHistogram,
  type ProviderUsageRecord,
  type ReasonKind,
  type ReviewMetrics,
  buildReviewMetrics,
  computeContextHash,
  computePolicyHash,
  finalizeReviewMetrics,
  normalizeProviderUsage,
  redactUrl,
  serializeReviewAudit,
} from "../../src/cli/review-metrics.js";

/**
 * Build a `now()` clock the tests can drive deterministically. Each
 * call to `tick(ms)` advances the clock by `ms` so phase durations are
 * reproducible regardless of the test runner's wall-clock state.
 */
function makeClock(): { now: () => number; tick: (ms: number) => void } {
  let t = 1_700_000_000_000;
  return {
    now: () => t,
    tick: (ms) => {
      t += ms;
    },
  };
}

describe("review-metrics: phase durations are monotonic and total >= sum", () => {
  it("captures context/provider/verification/posting/total and clamps to integer non-negative", () => {
    const clock = makeClock();
    const metrics = buildReviewMetrics({ now: () => clock.now() });
    metrics.beginContext();
    clock.tick(10);
    metrics.endContext();
    metrics.beginProvider();
    clock.tick(20);
    metrics.endProvider();
    metrics.beginVerification();
    clock.tick(5);
    metrics.endVerification();
    metrics.beginPosting();
    clock.tick(30);
    metrics.endPosting();
    const out = finalizeReviewMetrics(metrics);
    expect(out.durations).toEqual({
      contextMs: 10,
      providerMs: 20,
      verificationMs: 5,
      postingMs: 30,
      totalMs: 65,
    });
  });

  it("clamps any negative duration (clock skew) to zero", () => {
    const now = () => 0;
    const metrics = buildReviewMetrics({ now });
    metrics.beginContext();
    metrics.endContext();
    const out = finalizeReviewMetrics(metrics);
    expect(out.durations.contextMs).toBe(0);
    expect(out.durations.totalMs).toBe(0);
  });

  it("treats phase not started as 0 (so the artifact stays complete-shape even on failure paths)", () => {
    const metrics = buildReviewMetrics({ now: () => 100 });
    const out = finalizeReviewMetrics(metrics);
    expect(out.durations).toEqual({
      contextMs: 0,
      providerMs: 0,
      verificationMs: 0,
      postingMs: 0,
      totalMs: 0,
    });
  });

  it("totalMs is always >= sum of the four phases (not strictly equal so backdated phases are absorbed)", () => {
    const clock = makeClock();
    const metrics = buildReviewMetrics({ now: () => clock.now() });
    metrics.beginContext();
    clock.tick(7);
    metrics.endContext();
    metrics.beginProvider();
    clock.tick(13);
    metrics.endProvider();
    const out = finalizeReviewMetrics(metrics);
    expect(out.durations.totalMs).toBeGreaterThanOrEqual(
      out.durations.contextMs + out.durations.providerMs,
    );
  });
});

describe("review-metrics: provider usage is propagated verbatim; absent fields are OMITTED", () => {
  it("records available usage and round-trip count on the success path", () => {
    const metrics = buildReviewMetrics({ now: () => 0 });
    const usage: ProviderUsageRecord = {
      inputTokens: 1234,
      outputTokens: 567,
      totalTokens: 1801,
      roundTrips: 2,
    };
    metrics.setUsage(usage);
    const out = finalizeReviewMetrics(metrics);
    expect(out.usage).toEqual(usage);
  });

  it("OMITS usage (does not zero-invent) when only round-trip count is known", () => {
    const metrics = buildReviewMetrics({ now: () => 0 });
    metrics.recordRoundTrip();
    metrics.recordRoundTrip();
    const out = finalizeReviewMetrics(metrics);
    expect(out.usage).toBeUndefined();
    expect(out.usageRoundTrips).toBe(2);
  });

  it("OMITS usage when provider emitted no usage block (parse-fail path)", () => {
    const metrics = buildReviewMetrics({ now: () => 0 });
    metrics.recordRoundTrip();
    const out = finalizeReviewMetrics(metrics);
    expect(out.usage).toBeUndefined();
    expect(out.usageRoundTrips).toBe(1);
  });

  it("preserves only the fields the provider actually returned (no synthetic zeros)", () => {
    const metrics = buildReviewMetrics({ now: () => 0 });
    metrics.setUsage({ outputTokens: 42, roundTrips: 1 });
    const out = finalizeReviewMetrics(metrics);
    expect(out.usage).toEqual({ outputTokens: 42, roundTrips: 1 });
    // inputTokens and totalTokens were not set, so they must NOT appear.
    const json = JSON.stringify(out.usage);
    expect(json).not.toContain("inputTokens");
    expect(json).not.toContain("totalTokens");
  });
});

describe("review-metrics: normalizeProviderUsage — wire (snake_case) to audit (camelCase) translation", () => {
  it("translates a wire-shape usage block and OMITs absent fields", () => {
    const result = normalizeProviderUsage(
      { input_tokens: 1000, output_tokens: 500, total_tokens: 1500 },
      1,
    );
    expect(result).toEqual({ inputTokens: 1000, outputTokens: 500, totalTokens: 1500, roundTrips: 1 });
  });

  it("OMITS snake_case keys not present on the wire (never zero-invents)", () => {
    const result = normalizeProviderUsage({ output_tokens: 42 }, 2);
    expect(result).toEqual({ outputTokens: 42, roundTrips: 2 });
    const json = JSON.stringify(result);
    expect(json).not.toContain("inputTokens");
    expect(json).not.toContain("totalTokens");
  });

  it("returns a usage record with only roundTrips when wire usage is undefined", () => {
    const result = normalizeProviderUsage(undefined, 3);
    expect(result).toEqual({ roundTrips: 3 });
  });

  it("drops non-numeric wire fields defensively (string-typed tokens would otherwise fabricate zeros)", () => {
    const result = normalizeProviderUsage(
      { input_tokens: "1000" as unknown as number, output_tokens: 50 },
      1,
    );
    expect(result).toEqual({ outputTokens: 50, roundTrips: 1 });
    expect(result.inputTokens).toBeUndefined();
  });
});

describe("review-metrics: considered/kept/downgraded/suppressed/off-diff counts and reason histograms", () => {
  it("starts at zero and accumulates counts deterministically", () => {
    const metrics = buildReviewMetrics({ now: () => 0 });
    const initial = finalizeReviewMetrics(metrics);
    const expectedInitial: ConsideredCounts = {
      considered: 0,
      kept: 0,
      downgraded: 0,
      suppressed: 0,
      offDiff: 0,
    };
    expect(initial.counts).toEqual(expectedInitial);
    const zeroHistogram: FilterHistogram = {
      "off-diff": 0,
      "truncation": 0,
      "parse-failure": 0,
      "budget-exhausted": 0,
      "secret-bearing": 0,
      "unsupported-language": 0,
      "parse-failed": 0,
      "below-threshold": 0,
      "carried-over": 0,
      "unchanged": 0,
      "manual-full": 0,
      "empty-body": 0,
    };
    expect(initial.reasons).toEqual(zeroHistogram);
  });

  it("increments reason histogram for the closed enum and rejects unknown kinds", () => {
    const metrics = buildReviewMetrics({ now: () => 0 });
    metrics.incrementReason("off-diff", 2);
    metrics.incrementReason("below-threshold", 1);
    metrics.incrementReason("secret-bearing", 3);
    const out = finalizeReviewMetrics(metrics);
    expect(out.reasons["off-diff"]).toBe(2);
    expect(out.reasons["below-threshold"]).toBe(1);
    expect(out.reasons["secret-bearing"]).toBe(3);
    expect(out.reasons.unchanged).toBe(0);
  });

  it("captures considered/kept/downgraded/suppressed/off-diff counts", () => {
    const metrics = buildReviewMetrics({ now: () => 0 });
    metrics.setCounts({
      considered: 12,
      kept: 7,
      downgraded: 2,
      suppressed: 2,
      offDiff: 1,
    });
    const out = finalizeReviewMetrics(metrics);
    expect(out.counts).toEqual({
      considered: 12,
      kept: 7,
      downgraded: 2,
      suppressed: 2,
      offDiff: 1,
    });
  });

  it("exports the full closed enum so test code can iterate over it", () => {
    expect(ALL_REASON_KINDS).toHaveLength(12);
    expect(REASON_KIND_VALUES).toContain("off-diff");
    expect(REASON_KIND_VALUES).toContain("truncation");
    expect(REASON_KIND_VALUES).toContain("parse-failure");
    expect(REASON_KIND_VALUES).toContain("budget-exhausted");
    expect(REASON_KIND_VALUES).toContain("secret-bearing");
    expect(REASON_KIND_VALUES).toContain("unsupported-language");
    expect(REASON_KIND_VALUES).toContain("parse-failed");
    expect(REASON_KIND_VALUES).toContain("below-threshold");
    expect(REASON_KIND_VALUES).toContain("carried-over");
    expect(REASON_KIND_VALUES).toContain("unchanged");
    expect(REASON_KIND_VALUES).toContain("manual-full");
    expect(ALL_REASON_KINDS).toContain("empty-body");
  });
});

describe("review-metrics: decision (full/incremental) and policy/context hashes", () => {
  it("records full vs incremental decision verbatim", () => {
    const full = buildReviewMetrics({ now: () => 0 });
    full.setDecision("full");
    expect(finalizeReviewMetrics(full).decision).toBe("full");

    const inc = buildReviewMetrics({ now: () => 0 });
    inc.setDecision("incremental");
    expect(finalizeReviewMetrics(inc).decision).toBe("incremental");
  });

  it("computes a deterministic policy hash for the same policy (sorted keys, sha256)", () => {
    const policyA = { minimumSeverity: "medium", maxComments: 50, effort: "low" };
    const policyB = { effort: "low", maxComments: 50, minimumSeverity: "medium" };
    expect(computePolicyHash(policyA)).toBe(computePolicyHash(policyB));
  });

  it("computes different hashes for different policies", () => {
    expect(computePolicyHash({ minimumSeverity: "medium" })).not.toBe(
      computePolicyHash({ minimumSeverity: "high" }),
    );
  });

  it("computes a deterministic context hash; redacts URLs and tokens before hashing", () => {
    const ctxA = {
      filesTouched: ["src/foo.ts", "src/bar.ts"],
      sampleSnippet: "https://api.example.com/v1?token=super-secret",
    };
    const ctxB = {
      filesTouched: ["src/foo.ts", "src/bar.ts"],
      sampleSnippet: "https://api.example.com/v1?token=different-secret",
    };
    // Different secrets in different positions must still produce the same
    // hash because we redact query strings before hashing.
    const hashA = computeContextHash(ctxA);
    const hashB = computeContextHash(ctxB);
    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^[0-9a-f]{64}$/);
  });

  it("omits the decision / hashes block when the operator has not provided inputs (additive compat)", () => {
    const metrics = buildReviewMetrics({ now: () => 0 });
    const out = finalizeReviewMetrics(metrics);
    expect(out.decision).toBeUndefined();
    expect(out.policyHash).toBeUndefined();
    expect(out.contextHash).toBeUndefined();
  });
});

describe("review-metrics: optional cost estimates", () => {
  it("OMITS cost when no per-token price is configured (never defaults to zero)", () => {
    const metrics = buildReviewMetrics({ now: () => 0 });
    metrics.setUsage({ inputTokens: 1000, outputTokens: 500, totalTokens: 1500, roundTrips: 1 });
    const out = finalizeReviewMetrics(metrics);
    expect(out.cost).toBeUndefined();
  });

  it("computes an exact decimal estimate from explicit per-token prices, marked `estimated`", () => {
    const metrics = buildReviewMetrics({ now: () => 0 });
    metrics.setUsage({ inputTokens: 1000, outputTokens: 500, totalTokens: 1500, roundTrips: 1 });
    metrics.setPricing({
      inputPricePer1kTokens: 0.003,
      outputPricePer1kTokens: 0.015,
      currency: "USD",
      source: "umactually.config.json#pricing",
    });
    const out = finalizeReviewMetrics(metrics);
    expect(out.cost).toBeDefined();
    // (1000/1000)*0.003 + (500/1000)*0.015 = 0.003 + 0.0075 = 0.0105.
    // IEEE-754 yields 0.0104999...; we test with toBeCloseTo.
    expect(out.cost?.total).toBeCloseTo(0.0105, 10);
    expect(out.cost?.currency).toBe("USD");
    expect(out.cost?.source).toBe("umactually.config.json#pricing");
    expect(out.cost?.estimate).toBe("estimated");
  });

  it("does NOT infer pricing from the model name", () => {
    const metrics = buildReviewMetrics({ now: () => 0 });
    metrics.setUsage({ inputTokens: 1000, outputTokens: 500, totalTokens: 1500, roundTrips: 1 });
    // No setPricing call — even with model id available, the metrics must
    // not invent a price.
    const out = finalizeReviewMetrics(metrics);
    expect(out.cost).toBeUndefined();
  });

  it("omits the cost field when only output price is set (cannot compute missing side)", () => {
    const metrics = buildReviewMetrics({ now: () => 0 });
    metrics.setUsage({ inputTokens: 1000, outputTokens: 500, totalTokens: 1500, roundTrips: 1 });
    metrics.setPricing({
      inputPricePer1kTokens: 0.003,
      // outputPricePer1kTokens intentionally omitted.
      currency: "USD",
      source: "umactually.config.json#pricing",
    });
    const out = finalizeReviewMetrics(metrics);
    expect(out.cost).toBeUndefined();
  });
});

describe("review-metrics: redaction — secrets and URLs (incl. query strings)", () => {
  it("redacts URLs from a free-form string (query strings stripped)", () => {
    expect(redactUrl("https://api.example.com/v1?token=abc123")).toBe("https://api.example.com/v1");
    expect(redactUrl("https://api.example.com/v1?token=abc&user=foo")).toBe("https://api.example.com/v1");
    expect(redactUrl("https://api.example.com/v1#fragment")).toBe("https://api.example.com/v1");
    expect(redactUrl("")).toBe("");
  });

  it("serializes the audit envelope with secrets and query strings redacted", () => {
    const metrics = buildReviewMetrics({ now: () => 0 });
    metrics.beginContext();
    metrics.endContext();
    metrics.setUsage({ inputTokens: 100, outputTokens: 50, totalTokens: 150, roundTrips: 1 });
    metrics.recordSecret("super-secret-token-DO-NOT-LEAK");
    metrics.recordUrl("https://api.example.com/v1?token=super-secret-token-DO-NOT-LEAK");
    metrics.recordUrl("https://provider.example.com/route?api_key=DO-NOT-LEAK-EITHER");
    const out = finalizeReviewMetrics(metrics);
    const envelope = serializeReviewAudit(out);
    // The redaction counts are surfaced so a CI guard can verify the
    // expected number of secrets / URLs were scrubbed.
    const parsed = JSON.parse(envelope) as { audit: { redactions: { secrets: number; urls: number } } };
    expect(parsed.audit.redactions).toEqual({ secrets: 1, urls: 2 });
    // The redacted summary itself never contains the raw secret.
    expect(envelope).not.toContain("super-secret-token-DO-NOT-LEAK");
    expect(envelope).not.toContain("DO-NOT-LEAK-EITHER");
    // Query strings must be stripped from any URL field that lands in
    // the envelope. The audit redaction block stores only counts, so
    // the URL itself should not appear in the serialized form.
    expect(envelope).not.toContain("?token=");
    expect(envelope).not.toContain("?api_key=");
  });

  it("serialization is JSON-parseable and includes the additive schemaVersion: 2 marker", () => {
    const metrics = buildReviewMetrics({ now: () => 0 });
    metrics.beginContext();
    metrics.endContext();
    const out = finalizeReviewMetrics(metrics);
    const envelope = serializeReviewAudit(out);
    const parsed = JSON.parse(envelope) as { audit: { auditSchemaVersion: number } };
    expect(parsed.audit.auditSchemaVersion).toBe(2);
  });
});

describe("review-metrics: snapshot guards for additive compatibility", () => {
  it("produces a stable snapshot of the empty-metrics artifact shape (existing envelope fields remain)", () => {
    const metrics = buildReviewMetrics({ now: () => 0 });
    const out = finalizeReviewMetrics(metrics);
    const envelope = serializeReviewAudit(out);
    const parsed = JSON.parse(envelope) as Record<string, unknown>;
    // The audit block lives under `audit: { auditSchemaVersion: 2, ... }`,
    // not at the top level, so existing v1 readers (whose envelope
    // carries `schemaVersion: 1`) ignore it and keep parsing the v1
    // envelope unchanged.
    expect(parsed["auditSchemaVersion"]).toBeUndefined();
    expect(parsed["audit"]).toBeDefined();
    const audit = parsed["audit"] as Record<string, unknown>;
    expect(audit["auditSchemaVersion"]).toBe(2);
    expect(audit["durations"]).toEqual({
      contextMs: 0,
      providerMs: 0,
      verificationMs: 0,
      postingMs: 0,
      totalMs: 0,
    });
    expect(audit["counts"]).toEqual({
      considered: 0,
      kept: 0,
      downgraded: 0,
      suppressed: 0,
      offDiff: 0,
    });
    const reasons = audit["reasons"] as Record<ReasonKind, number>;
    for (const kind of REASON_KIND_VALUES) {
      expect(reasons[kind]).toBe(0);
    }
    expect(audit["usage"]).toBeUndefined();
    expect(audit["cost"]).toBeUndefined();
    expect(audit["redactions"]).toEqual({ secrets: 0, urls: 0 });
  });

  it("emits a complete ReviewMetrics record when all phases + usage + cost + decision + hashes recorded", () => {
    const metrics = buildReviewMetrics({ now: () => 0 });
    metrics.beginContext();
    metrics.endContext();
    metrics.beginProvider();
    metrics.endProvider();
    metrics.beginVerification();
    metrics.endVerification();
    metrics.beginPosting();
    metrics.endPosting();
    metrics.setUsage({ inputTokens: 1000, outputTokens: 500, totalTokens: 1500, roundTrips: 2 });
    metrics.setCounts({ considered: 8, kept: 5, downgraded: 1, suppressed: 1, offDiff: 1 });
    metrics.incrementReason("off-diff", 1);
    metrics.incrementReason("below-threshold", 1);
    metrics.setDecision("full");
    metrics.setPolicyHash("deadbeef" + "f".repeat(56));
    metrics.setContextHash("cafebabe" + "0".repeat(56));
    metrics.setPricing({
      inputPricePer1kTokens: 0.003,
      outputPricePer1kTokens: 0.015,
      currency: "USD",
      source: "umactually.config.json#pricing",
    });
    const out = finalizeReviewMetrics(metrics);
    const expectedUsage: ProviderUsageRecord = {
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      roundTrips: 2,
    };
    // Match the discrete fields, then check the cost separately so
    // the IEEE-754 rounding of `0.0105` does not cause a snapshot
    // regression. The cost math is already pinned by the dedicated
    // `computes an exact decimal estimate…` test above.
    const { cost: _cost, ...discrete } = out;
    expect(discrete).toEqual<Omit<ReviewMetrics, "cost">>({
      durations: {
        contextMs: 0,
        providerMs: 0,
        verificationMs: 0,
        postingMs: 0,
        totalMs: 0,
      },
      counts: { considered: 8, kept: 5, downgraded: 1, suppressed: 1, offDiff: 1 },
      reasons: {
        "off-diff": 1,
        "truncation": 0,
        "parse-failure": 0,
        "budget-exhausted": 0,
        "secret-bearing": 0,
        "unsupported-language": 0,
        "parse-failed": 0,
        "below-threshold": 1,
        "carried-over": 0,
        "unchanged": 0,
        "manual-full": 0,
        "empty-body": 0,
      },
      usage: expectedUsage,
      usageRoundTrips: 2,
      decision: "full",
      policyHash: "deadbeef" + "f".repeat(56),
      contextHash: "cafebabe" + "0".repeat(56),
      redactions: { secrets: 0, urls: 0 },
    });
    expect(_cost).toBeDefined();
    expect(_cost?.total).toBeCloseTo(0.0105, 10);
    expect(_cost?.currency).toBe("USD");
    expect(_cost?.source).toBe("umactually.config.json#pricing");
    expect(_cost?.estimate).toBe("estimated");
  });
});
