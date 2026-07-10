// SPDX-License-Identifier: MIT
// Regression tests for applySimulateFindings (src/cli/simulate-findings.ts).
//
// Self-review finding on PR #43 thread 3559191395: the simulate-findings
// path was setting `confidenceFilter: { kept: [], downgraded: [], reasons: [] }`
// — an empty result that did NOT reflect the simulated comments. When the
// synthesize-from-fixture outcome was merged via `mergeReviewResults`,
// the aggregator's input-side branch keyed on `o.confidenceFilter === undefined`
// to surface `o.review.comments` as kept. Setting the field to an empty
// object short-circuited that branch and silently dropped the simulated
// comments during merge.
//
// The fix: `confidenceFilter` is now optional on `LiveProviderOutcome`
// (live-shared.ts), and `applySimulateFindings` OMITS the field on its
// synthesized outcome so the legacy-compat branch takes over.
//
// These tests pin both the input-shape contract (no `confidenceFilter`
// field on the synthesized outcome) and the downstream merge behavior
// (the simulated comments surface as kept in the aggregated result).

import { describe, expect, it } from "vitest";

import { applySimulateFindings } from "../../src/cli/simulate-findings.js";
import { buildSimulatedFindings } from "../../src/review/simulated-findings.js";
import type { LiveProviderOutcome } from "../../src/cli/live-shared.js";
import { mergeReviewResults } from "../../src/cli/live-merge.js";

function emptyOutcome(): LiveProviderOutcome {
  // The simulate-findings path is reached only when the live result is
  // structurally empty (zero inline + zero suppressed). Start from a
  // live-shaped empty outcome so the test mirrors the production path.
  return {
    review: { summary: "", verdict: "COMMENT", comments: [], suppressedComments: [] },
    endpoint: "responses",
    provider: "openai-compatible",
    modelId: "auto",
    severityWarnings: [],
    parseWarnings: [],
    verifiedFactsFilter: { kept: [], downgraded: [], downgradeReasons: [] },
  };
}

describe("applySimulateFindings", () => {
  it("OMITS confidenceFilter on the synthesized outcome (not set to empty)", () => {
    // Given: a structurally empty live outcome + simulate-findings enabled.
    const outcome = emptyOutcome();

    // When: the simulate path runs.
    const synthesized = applySimulateFindings({
      outcome,
      simulateFindings: true,
      repo: "octo-org/octo-repo",
      prNumber: 42,
      headSha: "1111111111111111111111111111111111111111",
      diffText: "+// sample diff line\n+const x = 1;\n",
      secrets: [],
    });

    // Then: the synthesized outcome carries synthesized comments.
    expect(synthesized.review.comments.length).toBeGreaterThan(0);

    // And: the confidenceFilter field is OMITTED (not set to an empty
    // object). This is the contract the legacy-compat branch in
    // `aggregateConfidenceFilter` keys on — `=== undefined` triggers
    // the legacy path that forwards `o.review.comments` as kept.
    // Setting an empty object would short-circuit the branch and drop
    // the comments during merge. This is the regression pin for the
    // self-review finding on PR #43 thread 3559191395.
    expect("confidenceFilter" in synthesized).toBe(false);
  });

  it("MERGE-SIMULATE: synthesized comments survive mergeReviewResults (legacy-compat branch)", () => {
    // The full chain: live outcome is empty, simulate findings
    // synthesizes a populated outcome, merge aggregates the synthesized
    // comments. Pre-fix, the synthesized outcome carried an empty
    // `confidenceFilter` and the merge silently dropped the comments.
    // Post-fix, the synthesize step omits the field and the legacy
    // branch surfaces the comments as kept.
    const outcome = emptyOutcome();
    const synthesized = applySimulateFindings({
      outcome,
      simulateFindings: true,
      repo: "octo-org/octo-repo",
      prNumber: 42,
      headSha: "1111111111111111111111111111111111111111",
      diffText: "+// sample diff line\n+const x = 1;\n",
      secrets: [],
    });

    // Sanity: the synthesize step produced comments.
    expect(synthesized.review.comments.length).toBeGreaterThan(0);

    // When: merge aggregates the synthesized outcome.
    const merged = mergeReviewResults([synthesized]);

    // Then: the merged result surfaces the synthesized comments
    // (legacy-compat branch in aggregateConfidenceFilter forwards
    // `o.review.comments` as kept when `o.confidenceFilter === undefined`).
    expect(merged.review.comments.length).toBeGreaterThan(0);
    expect(merged.review.comments.length).toBe(synthesized.review.comments.length);
  });

  it("does NOT synthesize findings when the live outcome is non-empty (live findings win)", () => {
    // Given: a live outcome with one inline comment + simulate enabled.
    const liveComment = {
      path: "src/already-reviewed.ts",
      line: 1,
      body: "live finding body",
      severity: "medium",
      category: "general",
    } as const;
    const outcome: LiveProviderOutcome = {
      review: { summary: "live summary", verdict: "COMMENT", comments: [liveComment], suppressedComments: [] },
      endpoint: "responses",
      provider: "openai-compatible",
      modelId: "auto",
      severityWarnings: [],
      parseWarnings: [],
      verifiedFactsFilter: { kept: [], downgraded: [], downgradeReasons: [] },
    };

    // When: the simulate path runs on a NON-empty live outcome.
    const result = applySimulateFindings({
      outcome,
      simulateFindings: true,
      repo: "octo-org/octo-repo",
      prNumber: 42,
      headSha: "1111111111111111111111111111111111111111",
      diffText: "+// sample diff line\n+const x = 1;\n",
      secrets: [],
    });

    // Then: the original live outcome is returned unchanged (live findings
    // always win). The confidenceFilter field is still omitted because
    // the returned object IS the original outcome (which had no
    // confidenceFilter set).
    expect(result).toBe(outcome);
    expect(result.review.comments).toEqual([liveComment]);
    expect("confidenceFilter" in result).toBe(false);
  });

  it("passes through unchanged when simulateFindings is false", () => {
    // Given: simulate disabled, regardless of outcome shape.
    const outcome = emptyOutcome();

    // When: the simulate path runs with simulateFindings=false.
    const result = applySimulateFindings({
      outcome,
      simulateFindings: false,
      repo: "octo-org/octo-repo",
      prNumber: 42,
      headSha: "1111111111111111111111111111111111111111",
      diffText: "+// sample diff line\n+const x = 1;\n",
      secrets: [],
    });

    // Then: the original outcome is returned unchanged.
    expect(result).toBe(outcome);
  });

  it("integration: live-shape + simulate + merge keeps the synthesized comments end-to-end", () => {
    // End-to-end: this is the path the live pipeline takes when the
    // provider returns a structurally-empty review on a PR where the
    // operator passed --simulate-findings. The synthesize step
    // substitutes a deterministic fixture, the merge aggregates, and
    // the comments must reach the post-side output.
    const liveEmpty = emptyOutcome();
    const synthesized = applySimulateFindings({
      outcome: liveEmpty,
      simulateFindings: true,
      repo: "octo-org/octo-repo",
      prNumber: 42,
      headSha: "1111111111111111111111111111111111111111",
      diffText: "+// sample diff line\n+const x = 1;\n",
      secrets: [],
    });
    // Sanity: the buildSimulatedFindings fixture is non-empty.
    const fixture = buildSimulatedFindings(
      "octo-org/octo-repo",
      42,
      "1111111111111111111111111111111111111111",
      "+// sample diff line\n+const x = 1;\n",
    );
    expect(fixture.comments.length).toBeGreaterThan(0);
    expect(synthesized.review.comments.length).toBe(fixture.comments.length);

    // The end-to-end pin: the synthesized comments reach the merged
    // outcome intact. Pre-fix, the empty confidenceFilter on the
    // synthesized outcome caused the merge to drop them.
    const merged = mergeReviewResults([synthesized]);
    expect(merged.review.comments.length).toBe(fixture.comments.length);
  });
});
