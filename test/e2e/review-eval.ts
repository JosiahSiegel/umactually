/**
 * Grader for deterministic ground-truth review-quality fixtures.
 *
 * Pure functions — no I/O, no fetching. The fixture is a static TypeScript
 * export; the outcome is a `LiveProviderOutcome` captured from a live
 * provider call. The grader computes:
 *   - `actualComments`: kept + verified-facts-downgraded + confidence-downgraded
 *   - `fabricationRate`: parseWarnings.length / actualComments
 *   - `severityHistogram`: counts per severity tier across all 3 kept/downgraded arrays
 *   - forbidden-phrase / forbidden-path checks against surviving + downgraded
 *
 * Pass/fail is computed per-fixture against the fixture's local thresholds.
 * Adding a new fixture MUST NOT alter existing fixture thresholds.
 */

import type { LiveProviderOutcome, LiveReviewComment } from "../../src/cli/live-shared.js";

export type Severity = "info" | "low" | "medium" | "high" | "critical";

export type ReviewEvalExpectation = {
  /** Inclusive lower bound on actualComments (kept + verifiedFactsDowngraded + confidenceDowngraded). */
  readonly minComments: number;
  /** Inclusive upper bound on actualComments. */
  readonly maxComments: number;
  /** Minimum number of findings at severity `high` or `critical`. */
  readonly minHighSeverity: number;
  /**
   * Maximum fabrication rate. fabricationRate = parseWarnings.length /
   * (actualComments + parseWarnings.length). If actualComments +
   * parseWarnings.length === 0, the rate is 0.
   */
  readonly maxFabricationRate: number;
  /** Substrings that must NOT appear in any surviving or downgraded comment body. Case-insensitive. */
  readonly mustNotContain: readonly string[];
  /**
   * Path prefix that must NOT appear on any surviving or downgraded comment.
   * parseWarnings that cite this prefix are NOT counted against the fixture —
   * they prove the filter pipeline caught the fabrication.
   */
  readonly mustNotFabricatePath: string;
};

export type ReviewFixture = {
  readonly name: string;
  readonly description: string;
  readonly diff: string;
  readonly expected: ReviewEvalExpectation;
};

export type ReviewEvalResult = {
  readonly fixtureName: string;
  readonly modelId: string;
  readonly actualComments: number;
  readonly fabricationRate: number;
  readonly severityHistogram: Readonly<Record<Severity, number>>;
  readonly failures: readonly string[];
  readonly passed: boolean;
};

export type ReviewEvalReport = {
  readonly schemaVersion: 1;
  readonly modelId: string;
  readonly runsPerFixture: number;
  readonly fixtureCount: number;
  readonly passedCount: number;
  readonly failedCount: number;
  readonly totalProviderCalls: number;
  readonly results: readonly ReviewEvalResult[];
};

/**
 * Pull every comment from the three arrays that the filter pipeline emits:
 * `review.comments` (kept at original severity), `verifiedFactsFilter.downgraded`
 * (always downgraded to `info`), and `confidenceFilter.downgraded` (downgraded
 * per pattern, severity preserved from the comment object).
 *
 * Accepts the structural subset that the e2e suite produces (which omits
 * `severityWarnings[].normalizedFallback`) as well as the full
 * `LiveProviderOutcome` shape.
 */
export function collectPipelineComments(
  outcome: Pick<LiveProviderOutcome, "review" | "verifiedFactsFilter" | "confidenceFilter">,
): readonly LiveReviewComment[] {
  const verified = outcome.verifiedFactsFilter?.downgraded ?? [];
  const confidence = outcome.confidenceFilter?.downgraded ?? [];
  return [...outcome.review.comments, ...verified, ...confidence];
}

/**
 * Build a stable identity for a comment. Uses NUL separators to avoid
 * collisions between fields. Path + line alone is not unique: two findings
 * may cite the same anchor with different bodies (e.g. one a fabrication
 * attempt the other a real concern).
 */
export function commentIdentity(c: LiveReviewComment): string {
  return `${c.path}\0${c.line}\0${c.severity}\0${c.category}\0${c.body}`;
}

/** Tally severity counts across the supplied comments. Unknown severities are ignored. */
export function countSeverityHistogram(
  comments: readonly LiveReviewComment[],
): Readonly<Record<Severity, number>> {
  const counts: Record<Severity, number> = {
    info: 0,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  for (const c of comments) {
    if (c.severity in counts) {
      counts[c.severity as Severity] += 1;
    }
  }
  return counts;
}

/**
 * Grade a single fixture outcome against the fixture's local thresholds.
 *
 * Returns a `ReviewEvalResult` with a `passed` boolean and a `failures`
 * array. Each failure is a stable diagnostic string suitable for
 * surfacing in console.warn and the JSON eval artifact.
 *
 * Accepts the structural subset used by the e2e suite as well as the
 * full `LiveProviderOutcome` shape.
 */
export function gradeReviewFixture(
  fixture: ReviewFixture,
  outcome: Pick<LiveProviderOutcome, "review" | "verifiedFactsFilter" | "confidenceFilter" | "parseWarnings" | "modelId">,
): ReviewEvalResult {
  const failures: string[] = [];

  const pipelineComments = collectPipelineComments(outcome);
  const parseWarnings = outcome.parseWarnings ?? [];
  const actualComments = pipelineComments.length;
  // fabricationRate denominator per the plan: totalEmitted = actualComments + parseWarnings.length
  const totalEmitted = actualComments + parseWarnings.length;
  const fabricationRate = totalEmitted === 0 ? 0 : parseWarnings.length / totalEmitted;
  const severityHistogram = countSeverityHistogram(pipelineComments);
  const highSeverityCount =
    (severityHistogram.high ?? 0) + (severityHistogram.critical ?? 0);

  // 1. minComments
  if (actualComments < fixture.expected.minComments) {
    failures.push(
      `actualComments (${actualComments}) < minComments (${fixture.expected.minComments})`,
    );
  }
  // 2. maxComments
  if (actualComments > fixture.expected.maxComments) {
    failures.push(
      `actualComments (${actualComments}) > maxComments (${fixture.expected.maxComments})`,
    );
  }
  // 3. fabricationRate
  if (fabricationRate > fixture.expected.maxFabricationRate) {
    failures.push(
      `fabricationRate (${fabricationRate.toFixed(3)}) > maxFabricationRate (${fixture.expected.maxFabricationRate})`,
    );
  }
  // 4. minHighSeverity
  if (highSeverityCount < fixture.expected.minHighSeverity) {
    failures.push(
      `highSeverityCount (${highSeverityCount}) < minHighSeverity (${fixture.expected.minHighSeverity})`,
    );
  }
  // 5. mustNotContain (case-insensitive substring match against every pipeline comment body)
  for (const phrase of fixture.expected.mustNotContain) {
    const lowered = phrase.toLowerCase();
    for (const c of pipelineComments) {
      if (c.body.toLowerCase().includes(lowered)) {
        failures.push(
          `forbidden phrase "${phrase}" found in surviving/downgraded body at ${c.path}:${c.line}`,
        );
      }
    }
  }
  // 6. mustNotFabricatePath (surviving + downgraded comments only; parseWarnings are caught, not surviving)
  const forbiddenPrefix = fixture.expected.mustNotFabricatePath;
  if (forbiddenPrefix.length > 0) {
    for (const c of pipelineComments) {
      if (c.path.startsWith(forbiddenPrefix)) {
        failures.push(
          `forbidden path "${forbiddenPrefix}" found on surviving/downgraded comment at ${c.path}:${c.line}`,
        );
      }
    }
  }

  return {
    fixtureName: fixture.name,
    modelId: outcome.modelId,
    actualComments,
    fabricationRate,
    severityHistogram,
    failures,
    passed: failures.length === 0,
  };
}

/**
 * Aggregate per-fixture results into a single report. The aggregator is
 * pure: no I/O. Callers should serialize via `writeReviewEvalReport` (added
 * separately by the live runner).
 */
export function aggregateReviewEvalResults(
  results: readonly ReviewEvalResult[],
  totalProviderCalls: number = 0,
): ReviewEvalReport {
  return {
    schemaVersion: 1,
    modelId: results[0]?.modelId ?? "unknown",
    runsPerFixture: 1,
    fixtureCount: results.length,
    passedCount: results.filter((r) => r.passed).length,
    failedCount: results.filter((r) => !r.passed).length,
    totalProviderCalls,
    results,
  };
}

/**
 * Serialize a review-eval report to disk as pretty-printed JSON.
 * Creates parent directories if needed. Returns the absolute path
 * written.
 */
export async function writeReviewEvalReport(
  report: ReviewEvalReport,
  artifactPath: string,
): Promise<string> {
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { dirname: dn } = await import("node:path");
  await mkdir(dn(artifactPath), { recursive: true });
  await writeFile(artifactPath, JSON.stringify(report, null, 2), "utf8");
  return artifactPath;
}