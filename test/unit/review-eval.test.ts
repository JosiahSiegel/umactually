import { describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  aggregateReviewEvalResults,
  gradeReviewFixture,
  writeReviewEvalReport,
  type ReviewFixture,
} from "../e2e/review-eval.js";
import type { LiveProviderOutcome } from "../../src/cli/live-shared.js";

/**
 * Grader unit tests for deterministic ground-truth review fixtures.
 *
 * The grader is a pure function: it takes a `LiveProviderOutcome` and a
 * `ReviewFixture`, computes several metrics (counts, fabrication rate,
 * severity histogram, forbidden phrases, forbidden paths), and returns a
 * `ReviewEvalResult` with a `passed` boolean and a `failures` array of
 * human-readable diagnostics.
 *
 * These tests pin:
 *  - Empty outcome (0 findings) → passes a permissive fixture
 *  - Mixed outcome (kept + downgraded + parseWarnings) → accurate counts
 *  - Fabrication above threshold → fails
 *  - Severity histogram counts only high/critical toward minHighSeverity
 *  - Forbidden phrase (case-insensitive) → fails
 *  - Forbidden path in surviving OR downgraded comments → fails
 *  - Forbidden path in parseWarnings only → does NOT fail (caught)
 *  - Boundaries: minComments/maxComments are inclusive; fabricationRate
 *    equal to max passes
 *  - Aggregate report: counts and totals correct
 *
 * RED phase — these tests are written before the grader implementation.
 * Run with `npx vitest --run --project unit test/unit/review-eval.test.ts`
 * and observe the failure for the right reason (the grader module is not
 * yet implemented → module-not-found error).
 */

const FIXTURE_PASSING: ReviewFixture = {
  name: "test-passing",
  description: "Permissive fixture for grader tests.",
  diff: "diff --git a/src/example.ts b/src/example.ts\n@@ -1,1 +1,1 @@\n-old\n+new\n",
  expected: {
    minComments: 0,
    maxComments: 10,
    minHighSeverity: 0,
    maxFabricationRate: 1.0,
    mustNotContain: ["unused variable", "sql injection"],
    mustNotFabricatePath: "dist/",
  },
};

const FIXTURE_TIGHT: ReviewFixture = {
  name: "test-tight",
  description: "Fixture that constrains comment count and fabrication rate.",
  diff: "diff --git a/src/example.ts b/src/example.ts\n@@ -1,1 +1,1 @@\n-old\n+new\n",
  expected: {
    minComments: 1,
    maxComments: 2,
    minHighSeverity: 0,
    maxFabricationRate: 0.0,
    mustNotContain: ["unused variable"],
    mustNotFabricatePath: "dist/",
  },
};

function makeComment(overrides: {
  path?: string;
  line?: number;
  severity?: "info" | "low" | "medium" | "high" | "critical";
  body?: string;
  category?: string;
}): {
  path: string;
  line: number;
  severity: "info" | "low" | "medium" | "high" | "critical";
  body: string;
  category: string;
} {
  return {
    path: overrides.path ?? "src/example.ts",
    line: overrides.line ?? 1,
    severity: overrides.severity ?? "medium",
    body: overrides.body ?? "default body",
    category: overrides.category ?? "general",
  };
}

function makeOutcome(parts: {
  readonly kept?: readonly ReturnType<typeof makeComment>[];
  readonly verifiedDowngraded?: readonly ReturnType<typeof makeComment>[];
  readonly confidenceDowngraded?: readonly ReturnType<typeof makeComment>[];
  readonly parseWarnings?: readonly {
    readonly reason: "path-not-in-diff" | "line-not-in-diff";
    readonly modelPath: string;
  }[];
  readonly suppressed?: readonly ReturnType<typeof makeComment>[];
}): LiveProviderOutcome {
  return {
    review: {
      summary: "test",
      verdict: "COMMENT",
      comments: parts.kept ?? [],
      suppressedComments: parts.suppressed ?? [],
    },
    endpoint: "responses",
    provider: "openai-compatible",
    modelId: "opaque-review-model",
    severityWarnings: [],
    parseWarnings: (parts.parseWarnings ?? []).map((w, index) => ({
      reason: w.reason,
      source: "comments" as const,
      index,
      modelPath: w.modelPath,
      modelLine: 1,
      modelSeverity: "medium",
      bodyExcerpt: "excerpt",
    })),
    verifiedFactsFilter: {
      kept: parts.kept ?? [],
      downgraded: parts.verifiedDowngraded ?? [],
      downgradeReasons: (parts.verifiedDowngraded ?? []).map((_c, index) => ({ index, reason: "contradicts verified list" })),
    },
    confidenceFilter: {
      kept: parts.kept ?? [],
      downgraded: parts.confidenceDowngraded ?? [],
      reasons: (parts.confidenceDowngraded ?? []).map((_c, index) => ({
        index,
        reason: "pattern-matched-advice" as const,
        explanation: "test",
      })),
    },
  };
}

describe("gradeReviewFixture — empty outcome", () => {
  it("empty outcome (zero findings, zero parseWarnings) passes a permissive fixture", () => {
    const outcome = makeOutcome({});
    const result = gradeReviewFixture(FIXTURE_PASSING, outcome);
    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.actualComments).toBe(0);
    expect(result.fabricationRate).toBe(0);
    // Histogram always carries the 5 canonical severity keys with zero counts
    expect(result.severityHistogram).toEqual({
      info: 0,
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    });
  });
});

describe("gradeReviewFixture — passing mixed outcome", () => {
  it("counts kept + verified-facts-downgraded + confidence-downgraded + parseWarnings", () => {
    const outcome = makeOutcome({
      kept: [makeComment({}), makeComment({ path: "src/a.ts", line: 2 })],
      // verified-facts filter always writes severity: "info" on the downgraded
      // comment object (src/cli/verify-findings.ts:125). The mock must mirror
      // that — severity below is the POST-downgrade value, not the original.
      verifiedDowngraded: [makeComment({ path: "src/b.ts", line: 3, severity: "info" })],
      confidenceDowngraded: [makeComment({ path: "src/c.ts", line: 4, severity: "low" })],
      parseWarnings: [
        { reason: "path-not-in-diff", modelPath: "dist/cli.js" },
      ],
    });
    const result = gradeReviewFixture(FIXTURE_PASSING, outcome);
    expect(result.actualComments).toBe(4); // 2 kept + 1 + 1
    // fabricationRate = parseWarnings / (actualComments + parseWarnings) = 1 / 5 = 0.2
    expect(result.fabricationRate).toBeCloseTo(0.2, 5);
    expect(result.severityHistogram).toEqual({
      info: 1, // verified-facts downgrade is always info
      low: 1, // confidence-downgraded severity preserved
      medium: 2, // 2 kept comments default to medium
      high: 0,
      critical: 0,
    });
    expect(result.passed).toBe(true);
  });
});

describe("gradeReviewFixture — fabrication threshold", () => {
  it("fails when fabrication rate exceeds the fixture threshold", () => {
    const outcome = makeOutcome({
      kept: [makeComment({})],
      parseWarnings: [
        { reason: "path-not-in-diff", modelPath: "dist/a.js" },
        { reason: "path-not-in-diff", modelPath: "dist/b.js" },
      ],
    });
    // fixture permits maxFabricationRate 0.0; 2/3 ≈ 0.667 > 0.0 → fail
    const result = gradeReviewFixture(FIXTURE_TIGHT, outcome);
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => /fabrication/i.test(f))).toBe(true);
  });

  it("fabrication rate equal to max passes (boundary is inclusive)", () => {
    const outcome = makeOutcome({
      kept: [makeComment({})],
      parseWarnings: [
        { reason: "path-not-in-diff", modelPath: "dist/a.js" },
      ],
    });
    const fixture: ReviewFixture = {
      ...FIXTURE_TIGHT,
      expected: { ...FIXTURE_TIGHT.expected, maxFabricationRate: 0.5 },
    };
    const result = gradeReviewFixture(fixture, outcome);
    // 1 parseWarning / 2 actual = 0.5 → equals threshold → pass
    expect(result.passed).toBe(true);
  });
});

describe("gradeReviewFixture — severity histogram", () => {
  it("counts only high and critical toward minHighSeverity", () => {
    const outcome = makeOutcome({
      kept: [
        makeComment({ severity: "medium" }),
        makeComment({ path: "src/b.ts", line: 2, severity: "high" }),
      ],
    });
    const fixture: ReviewFixture = {
      ...FIXTURE_PASSING,
      expected: { ...FIXTURE_PASSING.expected, minHighSeverity: 1 },
    };
    const result = gradeReviewFixture(fixture, outcome);
    expect(result.severityHistogram["medium"]).toBe(1);
    expect(result.severityHistogram["high"]).toBe(1);
    expect(result.passed).toBe(true);
  });

  it("fails when minHighSeverity is not met", () => {
    const outcome = makeOutcome({
      kept: [makeComment({ severity: "low" }), makeComment({ path: "src/b.ts", line: 2, severity: "medium" })],
    });
    const fixture: ReviewFixture = {
      ...FIXTURE_PASSING,
      expected: { ...FIXTURE_PASSING.expected, minHighSeverity: 1 },
    };
    const result = gradeReviewFixture(fixture, outcome);
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => /high|critical/i.test(f))).toBe(true);
  });
});

describe("gradeReviewFixture — forbidden phrase (case-insensitive)", () => {
  it("detects forbidden phrase in surviving comment body", () => {
    const outcome = makeOutcome({
      kept: [makeComment({ body: "This diff has an UNUSED VARIABLE in it." })],
    });
    const result = gradeReviewFixture(FIXTURE_PASSING, outcome);
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => /unused variable/i.test(f))).toBe(true);
  });

  it("detects forbidden phrase in downgraded comment body too", () => {
    const outcome = makeOutcome({
      verifiedDowngraded: [makeComment({ body: "Looks like an SQL INJECTION risk" })],
    });
    const result = gradeReviewFixture(FIXTURE_PASSING, outcome);
    expect(result.passed).toBe(false);
  });
});

describe("gradeReviewFixture — forbidden path", () => {
  it("fails when surviving comment path begins with the forbidden prefix", () => {
    const outcome = makeOutcome({
      kept: [makeComment({ path: "dist/cli.js", line: 5 })],
    });
    const result = gradeReviewFixture(FIXTURE_PASSING, outcome);
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => /dist\//i.test(f))).toBe(true);
  });

  it("does NOT fail when forbidden path only appears in parseWarnings (caught)", () => {
    const outcome = makeOutcome({
      kept: [makeComment({})],
      parseWarnings: [{ reason: "path-not-in-diff", modelPath: "dist/cli.js" }],
    });
    const result = gradeReviewFixture(FIXTURE_PASSING, outcome);
    expect(result.passed).toBe(true);
  });
});

describe("aggregateReviewEvalResults", () => {
  it("aggregates pass/fail counts and per-fixture results", () => {
    const passing = gradeReviewFixture(FIXTURE_PASSING, makeOutcome({}));
    const failing = gradeReviewFixture(FIXTURE_TIGHT, makeOutcome({}));
    const report = aggregateReviewEvalResults([passing, failing]);
    expect(report.fixtureCount).toBe(2);
    expect(report.passedCount).toBe(1);
    expect(report.failedCount).toBe(1);
    expect(report.results).toHaveLength(2);
    expect(report.totalProviderCalls).toBeGreaterThanOrEqual(0);
  });
});

describe("writeReviewEvalReport", () => {
  it("writes the report as pretty-printed JSON and returns the path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "review-eval-report-"));
    try {
      const artifactPath = join(dir, "nested", "report.json");
      const passing = gradeReviewFixture(FIXTURE_PASSING, makeOutcome({}));
      const report = aggregateReviewEvalResults([passing]);
      const written = await writeReviewEvalReport(report, artifactPath);
      expect(written).toBe(artifactPath);
      // Verify file content
      const { readFile } = await import("node:fs/promises");
      const content = await readFile(artifactPath, "utf8");
      const parsed = JSON.parse(content) as { schemaVersion: number; results: unknown[] };
      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.results).toHaveLength(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});