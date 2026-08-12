// SPDX-License-Identifier: MIT
//
// Task 3 — Review-eval gate unit tests (RED → GREEN).
//
// These tests pin:
//   1. v2 report schema (schemaVersion=2 + every required field).
//   2. Per-fixture gradeReviewFixture v2 path (identityDigest ground truth).
//   3. Hard-invariant checks (surviving-fabrication-zero,
//      secret-leakage-zero, parse-fail-not-clean, identity-fields-present).
//   4. Aggregate threshold breach → gate fails.
//   5. Snapshot hash validation: outcome snapshots whose source
//      fixture / mock / package commit don't match the current run
//      MUST be rejected.
//   6. Mock-server hash + version + package-commit capture on the
//      report.
//   7. Per-fixture content hash capture.

import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  aggregateReviewEvalResults,
  assertSnapshotCompatible,
  countMissingIdentityFields,
  countSurvivingOffDiffByPrefix,
  countSurvivingSecretLeaks,
  gradeReviewFixture,
  isParseFailMisclassifiedAsClean,
  matchIdentityGroundTruth,
  resolveMockServerPath,
  resolvePackageCommit,
  sha256File,
  sha256Hex,
  writeReviewEvalReport,
  type ExpectedFindingIdentity,
  type FixtureHardInvariant,
  type ReviewEvalReport,
  type ReviewFixture,
} from "../e2e/review-eval.js";
import type { LiveProviderOutcome, LiveReviewComment } from "../../src/cli/live-shared.js";

function makeComment(overrides: {
  path?: string;
  line?: number;
  severity?: "info" | "low" | "medium" | "high" | "critical";
  body?: string;
  category?: string;
  identityDigest?: string;
  includeIdentity?: boolean;
}): LiveReviewComment {
  const includeIdentity = overrides.includeIdentity !== false;
  const id = overrides.identityDigest ?? "a".repeat(64);
  const base = {
    path: overrides.path ?? "src/example.ts",
    line: overrides.line ?? 1,
    severity: overrides.severity ?? "medium",
    body: overrides.body ?? "default body",
    category: overrides.category ?? "general",
  };
  if (!includeIdentity) {
    return base as LiveReviewComment;
  }
  return {
    ...base,
    durableIdentity: {
      fingerprintVersion: 1,
      fingerprintDigest: "b".repeat(64),
      identityDigest: id,
      canonicalPath: overrides.path ?? "src/example.ts",
      anchorKind: "symbol",
      canonicalAnchor: "x:y",
      normalizedCategory: "general",
      normalizedRuleKey: "rulekey",
    },
  } as LiveReviewComment;
}

function makeOutcome(parts: {
  readonly kept?: readonly LiveReviewComment[];
  readonly verifiedDowngraded?: readonly LiveReviewComment[];
  readonly confidenceDowngraded?: readonly LiveReviewComment[];
  readonly parseWarnings?: readonly {
    readonly reason: "path-not-in-diff" | "line-not-in-diff";
    readonly modelPath: string;
  }[];
  readonly parseFailed?: boolean;
  readonly durationMs?: number;
  readonly tokenUsage?: { readonly input?: number; readonly output?: number; readonly total?: number };
  readonly roundTrips?: number;
}): LiveProviderOutcome & {
  durationMs?: number;
  tokenUsage?: { input?: number; output?: number; total?: number };
  roundTrips?: number;
} {
  return {
    review: {
      summary: "test",
      verdict: "COMMENT",
      comments: parts.kept ?? [],
      suppressedComments: [],
      ...(parts.parseFailed === true ? { parseFailed: true } : {}),
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
    ...(parts.parseFailed === true ? { parseFailed: true } : {}),
    ...(parts.durationMs !== undefined ? { durationMs: parts.durationMs } : {}),
    ...(parts.tokenUsage !== undefined ? { tokenUsage: parts.tokenUsage } : {}),
    ...(parts.roundTrips !== undefined ? { roundTrips: parts.roundTrips } : {}),
  };
}

const FIXTURE_BASELINE: ReviewFixture = {
  name: "test-baseline",
  description: "Permissive fixture for grader tests.",
  diff: "diff --git a/src/example.ts b/src/example.ts\n@@ -1,1 +1,1 @@\n-old\n+new\n",
  expected: {
    minComments: 0,
    maxComments: 10,
    minHighSeverity: 0,
    maxFabricationRate: 1.0,
    mustNotContain: [],
    mustNotFabricatePath: "",
  },
};

describe("v2 gate report schema", () => {
  it("aggregate produces schemaVersion=2 with every required field", () => {
    const passing = gradeReviewFixture(FIXTURE_BASELINE, makeOutcome({}));
    const report = aggregateReviewEvalResults(
      [passing],
      1,
      {
        fixtureHashes: { "test-baseline": "abc123" },
        mockServerHash: "deadbeef",
        mockServerVersion: "0.0.0",
        packageCommit: "f".repeat(40),
        config: { model: "x", provider: "openai-compatible", runtime: "node24" },
      },
    );
    expect(report.schemaVersion).toBe(2);
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(report.mockServerHash).toBe("deadbeef");
    expect(report.packageCommit).toBe("f".repeat(40));
    expect(report.config).toEqual({
      model: "x",
      provider: "openai-compatible",
      runtime: "node24",
    });
    expect(report).toHaveProperty("TP");
    expect(report).toHaveProperty("FP");
    expect(report).toHaveProperty("FN");
    expect(report).toHaveProperty("precision");
    expect(report).toHaveProperty("recall");
    expect(report).toHaveProperty("F1");
    expect(report).toHaveProperty("fabrication");
    expect(report).toHaveProperty("suppression");
    expect(report).toHaveProperty("severity");
    expect(report).toHaveProperty("latency");
    expect(report).toHaveProperty("token");
    expect(report).toHaveProperty("roundTrip");
    expect(report.severity).toEqual({
      info: 0, low: 0, medium: 0, high: 0, critical: 0,
    });
    expect(report.latency).toHaveProperty("totalMs");
    expect(report.latency).toHaveProperty("perFixtureMeanMs");
    expect(report.token).toHaveProperty("inputTotal");
    expect(report.token).toHaveProperty("outputTotal");
    expect(report.roundTrip).toHaveProperty("total");
    expect(report.roundTrip).toHaveProperty("perFixtureMean");
  });
});

describe("matchIdentityGroundTruth", () => {
  it("computes TP/FP/FN at identityDigest level", () => {
    const expectedId = "c".repeat(64);
    const expected: ExpectedFindingIdentity = {
      identityDigest: expectedId,
      fingerprintDigest: "d".repeat(64),
      canonicalPath: "src/a.ts",
      anchorKind: "symbol",
      canonicalAnchor: "foo:function",
      normalizedCategory: "testing",
      normalizedRuleKey: "rule-x",
    };
    const outcome = makeOutcome({
      kept: [
        makeComment({ identityDigest: expectedId, path: "src/a.ts" }),
        makeComment({ identityDigest: "e".repeat(64), path: "src/b.ts" }),
      ],
    });
    const result = matchIdentityGroundTruth(outcome, {
      expectedFindings: [expected],
    });
    expect(result.tp).toEqual([expectedId]);
    expect(result.fp).toEqual(["e".repeat(64)]);
    expect(result.fn).toEqual([]);
    expect(result.missingIdentity).toEqual([]);
  });

  it("computes FN when expected identity is absent", () => {
    const expectedId = "c".repeat(64);
    const expected: ExpectedFindingIdentity = {
      identityDigest: expectedId,
      fingerprintDigest: "d".repeat(64),
      canonicalPath: "src/a.ts",
      anchorKind: "symbol",
      canonicalAnchor: "foo:function",
      normalizedCategory: "testing",
      normalizedRuleKey: "rule-x",
    };
    const outcome = makeOutcome({ kept: [] });
    const result = matchIdentityGroundTruth(outcome, {
      expectedFindings: [expected],
    });
    expect(result.tp).toEqual([]);
    expect(result.fn).toEqual([expectedId]);
  });

  it("allowed identities do not count as FP or FN", () => {
    const allowedId = "f".repeat(64);
    const allowed: ExpectedFindingIdentity = {
      identityDigest: allowedId,
      fingerprintDigest: "a".repeat(64),
      canonicalPath: "src/c.ts",
      anchorKind: "hunk",
      canonicalAnchor: "b".repeat(64),
      normalizedCategory: "general",
      normalizedRuleKey: "rule",
    };
    const outcome = makeOutcome({
      kept: [makeComment({ identityDigest: allowedId })],
    });
    const result = matchIdentityGroundTruth(outcome, {
      allowedFindings: [allowed],
    });
    expect(result.tp).toEqual([]);
    expect(result.fp).toEqual([]);
    expect(result.fn).toEqual([]);
  });

  it("comments missing durableIdentity are reported separately", () => {
    const c = makeComment({ includeIdentity: false });
    const outcome = makeOutcome({ kept: [c] });
    const result = matchIdentityGroundTruth(outcome, {});
    expect(result.missingIdentity).toHaveLength(1);
  });
});

describe("hard invariant — secret-leakage-zero", () => {
  it("counts comments matching secret patterns", () => {
    const outcome = makeOutcome({
      kept: [
        makeComment({ body: "harmless" }),
        makeComment({ body: "AKIAIOSFODNN7EXAMPLE leaked here" }),
      ],
    });
    expect(countSurvivingSecretLeaks(outcome)).toBe(1);
  });
});

describe("hard invariant — surviving-fabrication-zero", () => {
  it("counts comments citing forbidden path prefixes", () => {
    const outcome = makeOutcome({
      kept: [
        makeComment({ path: "src/a.ts" }),
        makeComment({ path: "dist/cli.js" }),
        makeComment({ path: "build/output.js" }),
      ],
    });
    expect(countSurvivingOffDiffByPrefix(outcome, ["dist/", "build/"])).toBe(2);
  });
});

describe("hard invariant — parse-fail-not-clean", () => {
  it("flags 0-comments + parseFailed=false as misclassified-clean", () => {
    const outcome = makeOutcome({});
    expect(isParseFailMisclassifiedAsClean(outcome)).toBe(true);
  });
  it("does NOT flag when parseFailed=true", () => {
    const outcome = makeOutcome({ parseFailed: true });
    expect(isParseFailMisclassifiedAsClean(outcome)).toBe(false);
  });
  it("does NOT flag when comments are present", () => {
    const c = makeComment({ includeIdentity: false });
    const outcome = makeOutcome({ kept: [c] });
    expect(isParseFailMisclassifiedAsClean(outcome)).toBe(false);
  });
});

describe("hard invariant — identity-fields-present", () => {
  it("counts comments missing fingerprint fields", () => {
    const c1 = makeComment({ identityDigest: "a".repeat(64) });
    const c2 = makeComment({ includeIdentity: false });
    const outcome = makeOutcome({ kept: [c1, c2] });
    expect(countMissingIdentityFields(outcome)).toBe(1);
  });

  it("counts comments with fingerprintVersion != 1 as missing", () => {
    const c = makeComment({ identityDigest: "a".repeat(64) });
    const mutated = {
      ...c,
      durableIdentity: { ...c.durableIdentity!, fingerprintVersion: 2 as unknown as 1 },
    } as LiveReviewComment;
    const outcome = makeOutcome({ kept: [mutated] });
    expect(countMissingIdentityFields(outcome)).toBe(1);
  });
});

describe("gradeReviewFixture — v2 path", () => {
  it("fails when expected identity is missing (FN > 0)", () => {
    const fixture: ReviewFixture = {
      ...FIXTURE_BASELINE,
      expected: {
        ...FIXTURE_BASELINE.expected,
        expectedFindings: [
          {
            identityDigest: "c".repeat(64),
            fingerprintDigest: "d".repeat(64),
            canonicalPath: "src/a.ts",
            anchorKind: "symbol",
            canonicalAnchor: "x:y",
            normalizedCategory: "general",
            normalizedRuleKey: "rule",
          },
        ],
      },
    };
    const result = gradeReviewFixture(fixture, makeOutcome({}));
    expect(result.passed).toBe(false);
    expect(result.fnCount).toBe(1);
    expect(result.failures.some((f) => /missing/i.test(f))).toBe(true);
  });

  it("hard invariant parse-fail-not-clean fires on empty outcome", () => {
    const fixture: ReviewFixture = {
      ...FIXTURE_BASELINE,
      expected: {
        ...FIXTURE_BASELINE.expected,
        hardInvariants: ["parse-fail-not-clean" as FixtureHardInvariant],
        minComments: 1,
      },
    };
    const result = gradeReviewFixture(fixture, makeOutcome({}));
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => /parse-fail-not-clean/i.test(f))).toBe(true);
  });

  it("hard invariant identity-fields-present fires when identities missing", () => {
    const c = makeComment({ includeIdentity: false });
    const fixture: ReviewFixture = {
      ...FIXTURE_BASELINE,
      expected: {
        ...FIXTURE_BASELINE.expected,
        hardInvariants: ["identity-fields-present" as FixtureHardInvariant],
      },
    };
    const result = gradeReviewFixture(fixture, makeOutcome({ kept: [c] }));
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => /identity-fields-present/i.test(f))).toBe(true);
  });

  it("survives when identities match and no invariants breach", () => {
    const id = "c".repeat(64);
    const fixture: ReviewFixture = {
      ...FIXTURE_BASELINE,
      expected: {
        ...FIXTURE_BASELINE.expected,
        expectedFindings: [
          {
            identityDigest: id,
            fingerprintDigest: "d".repeat(64),
            canonicalPath: "src/a.ts",
            anchorKind: "symbol",
            canonicalAnchor: "x:y",
            normalizedCategory: "general",
            normalizedRuleKey: "rule",
          },
        ],
        hardInvariants: ["identity-fields-present" as FixtureHardInvariant],
      },
    };
    const result = gradeReviewFixture(fixture, makeOutcome({ kept: [makeComment({ identityDigest: id })] }));
    expect(result.passed).toBe(true);
    expect(result.tpCount).toBe(1);
  });
});

describe("aggregate gate thresholds", () => {
  function makeResult(over: Partial<{ tp: number; fp: number; fn: number; identityMissing: number }>) {
    return {
      fixtureName: "x",
      modelId: "m",
      actualComments: 0,
      fabricationRate: 0,
      severityHistogram: { info: 0, low: 0, medium: 0, high: 0, critical: 0 },
      tpCount: over.tp ?? 0,
      fpCount: over.fp ?? 0,
      fnCount: over.fn ?? 0,
      identityDigestHits: [],
      survivingOffDiffCount: 0,
      survivingSecretLeakCount: 0,
      parseFailedFlag: false,
      identityFieldMissingCount: over.identityMissing ?? 0,
      durationMs: 0,
      tokenUsage: { input: 0, output: 0, total: 0 },
      roundTrips: 0,
      failures: [],
      passed: true,
    };
  }

  it("precision >= 0.90 / recall >= 0.85 / F1 >= 0.87 passes", () => {
    const r = makeResult({ tp: 9, fp: 1, fn: 1 });
    const report = aggregateReviewEvalResults([r], 1, {
      fixtureHashes: {},
      mockServerHash: "h",
      mockServerVersion: "0.0.0",
      packageCommit: "p",
      config: { model: "m", provider: "openai-compatible", runtime: "node24" },
    });
    expect(report.precision).toBeCloseTo(0.9, 5);
    expect(report.recall).toBeCloseTo(0.9, 5);
    expect(report.F1).toBeCloseTo(0.9, 5);
    expect(report.passed).toBe(true);
  });

  it("precision < 0.90 fails with named failure", () => {
    const r = makeResult({ tp: 5, fp: 10, fn: 5 });
    const report = aggregateReviewEvalResults([r], 1, {
      fixtureHashes: {},
      mockServerHash: "h",
      mockServerVersion: "0.0.0",
      packageCommit: "p",
      config: { model: "m", provider: "openai-compatible", runtime: "node24" },
    });
    expect(report.passed).toBe(false);
    expect(report.gateFailures.some((f) => /precision/.test(f))).toBe(true);
  });

  it("survivingFabrication > 0 fails with named failure", () => {
    const r = makeResult({});
    r.survivingOffDiffCount = 1;
    const report = aggregateReviewEvalResults([r], 1, {
      fixtureHashes: {},
      mockServerHash: "h",
      mockServerVersion: "0.0.0",
      packageCommit: "p",
      config: { model: "m", provider: "openai-compatible", runtime: "node24" },
    });
    expect(report.passed).toBe(false);
    expect(report.gateFailures.some((f) => /survivingFabrication/.test(f))).toBe(true);
  });

  it("identityFieldMissing > 0 fails with named failure", () => {
    const r = makeResult({ identityMissing: 1 });
    const report = aggregateReviewEvalResults([r], 1, {
      fixtureHashes: {},
      mockServerHash: "h",
      mockServerVersion: "0.0.0",
      packageCommit: "p",
      config: { model: "m", provider: "openai-compatible", runtime: "node24" },
    });
    expect(report.passed).toBe(false);
    expect(report.gateFailures.some((f) => /identityFieldsMissing/.test(f))).toBe(true);
  });

  it("secretLeakage > 0 fails with named failure", () => {
    const r = makeResult({});
    r.survivingSecretLeakCount = 1;
    const report = aggregateReviewEvalResults([r], 1, {
      fixtureHashes: {},
      mockServerHash: "h",
      mockServerVersion: "0.0.0",
      packageCommit: "p",
      config: { model: "m", provider: "openai-compatible", runtime: "node24" },
    });
    expect(report.passed).toBe(false);
    expect(report.gateFailures.some((f) => /secretLeakage/.test(f))).toBe(true);
  });
});

describe("snapshot hash validation", () => {
  it("report carries fixtureHashes, mockServerHash, packageCommit for snapshot comparison", () => {
    const r = gradeReviewFixture(FIXTURE_BASELINE, makeOutcome({}));
    const report = aggregateReviewEvalResults([r], 1, {
      fixtureHashes: { "test-baseline": "abc123" },
      mockServerHash: "deadbeef",
      mockServerVersion: "0.0.0",
      packageCommit: "f".repeat(40),
      config: { model: "m", provider: "openai-compatible", runtime: "node24" },
    });
    expect(report.fixtureHashes["test-baseline"]).toBe("abc123");
    expect(report.mockServerHash).toBe("deadbeef");
    expect(report.packageCommit).toBe("f".repeat(40));
  });

  it("rejects a snapshot whose fixture/mock/package hashes do NOT match the current run", async () => {
    const dir = await mkdtemp(join(tmpdir(), "review-eval-snap-"));
    try {
      const r = gradeReviewFixture(FIXTURE_BASELINE, makeOutcome({}));
      const report = aggregateReviewEvalResults([r], 1, {
        fixtureHashes: { "test-baseline": "newhash" },
        mockServerHash: "newhash",
        mockServerVersion: "0.0.0",
        packageCommit: "newcommit",
        config: { model: "m", provider: "openai-compatible", runtime: "node24" },
      });
      const snapPath = join(dir, "snap.json");
      await writeFile(snapPath, JSON.stringify(report, null, 2), "utf8");

      const snapText = await readFile(snapPath, "utf8");
      const snap = JSON.parse(snapText) as ReviewEvalReport;

      const currentHash = {
        fixtureHashes: report.fixtureHashes,
        mockServerHash: report.mockServerHash,
        packageCommit: report.packageCommit,
      };
      const snapHash = {
        fixtureHashes: snap.fixtureHashes,
        mockServerHash: snap.mockServerHash,
        packageCommit: snap.packageCommit,
      };
      expect(snapHash).toEqual(currentHash);

      const tampered: ReviewEvalReport = {
        ...snap,
        mockServerHash: "tampered",
      };
      const verdict = assertSnapshotCompatible(report, snapPath);
      expect(verdict.compatible).toBe(true);

      // Tampered snapshot is rejected by assertSnapshotCompatible when
      // it doesn't match the current run.
      const tamperedPath = join(dir, "tampered.json");
      await writeFile(tamperedPath, JSON.stringify(tampered, null, 2), "utf8");
      const tamperedVerdict = assertSnapshotCompatible(report, tamperedPath);
      expect(tamperedVerdict.compatible).toBe(false);
      expect(tamperedVerdict.reason).toMatch(/mockServerHash/);
      expect(tampered.mockServerHash).not.toEqual(report.mockServerHash);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("writeReviewEvalReport + hash utilities", () => {
  it("writeReviewEvalReport round-trips a v2 report", async () => {
    const dir = await mkdtemp(join(tmpdir(), "review-eval-write-"));
    try {
      const r = gradeReviewFixture(FIXTURE_BASELINE, makeOutcome({}));
      const report = aggregateReviewEvalResults([r], 1, {
        fixtureHashes: {},
        mockServerHash: "h",
        mockServerVersion: "0.0.0",
        packageCommit: "p",
        config: { model: "m", provider: "openai-compatible", runtime: "node24" },
      });
      const out = join(dir, "nested", "r.json");
      const written = await writeReviewEvalReport(report, out);
      expect(written).toBe(out);
      const text = await readFile(out, "utf8");
      const parsed = JSON.parse(text) as ReviewEvalReport;
      expect(parsed.schemaVersion).toBe(2);
      expect(parsed.fixtureCount).toBe(1);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("sha256Hex is deterministic and 64 hex chars", () => {
    const a = sha256Hex("hello");
    const b = sha256Hex("hello");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("sha256File hashes a file by content", async () => {
    const dir = await mkdtemp(join(tmpdir(), "review-eval-sha-"));
    try {
      const file = join(dir, "x.txt");
      await writeFile(file, "abc", "utf8");
      expect(sha256File(file)).toBe(sha256Hex("abc"));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("resolveMockServerPath returns the bundled mock-llm-server.mjs", () => {
    const path = resolveMockServerPath();
    expect(path.endsWith("mock-llm-server.mjs")).toBe(true);
  });

  it("resolvePackageCommit returns 'unknown' outside a git repo", () => {
    const out = resolvePackageCommit("/tmp/not-a-git-repo-xyz");
    expect(out).toBe("unknown");
  });
});
