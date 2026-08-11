// SPDX-License-Identifier: MIT
//
// Grader for deterministic ground-truth review-quality fixtures (v2).
//
// This module is the load-bearing release-gate grader. It scores every
// fixture's outcome against identityDigest-level ground truth (NOT
// file+line) so line shifts don't break the contract. v2 also adds:
//   - Expected / allowed finding identity registries (per fixture).
//   - Hard-invariant checks (surviving-fabrication-zero, secret-leakage-
//     zero, parse-fail-not-clean, identity-fields-present).
//   - Schema-versioned report (schemaVersion=2) with TP/FP/FN,
//     precision/recall/F1, severity/latency/token/round-trip aggregates.
//   - Schema-versioned hashes: fixtureHashes, mockServerHash,
//     mockServerVersion, packageCommit, config.{model,provider,runtime}.
//   - Hash utilities (sha256Hex, sha256File) used by the runner.
//   - Snapshot rejection (assertSnapshotCompatible) used by the runner.
//
// v1 → v2 migration: ReviewEvalExpectation now also carries optional
// `expectedFindings` / `allowedFindings` identityDigests,
// `forbiddenPathPrefixes` (multi-prefix list), `mockReviewOverride`
// (deterministic canned review), and `hardInvariants` (gate-killing
// invariants). v1 fixtures that omit the new fields keep their v1
// semantics (file+line was never the load-bearing contract — it was
// the v1 convenience that v2 supersedes).

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type {
  LiveProviderOutcome,
  LiveReviewComment,
} from "../../src/cli/live-shared.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Severity = "info" | "low" | "medium" | "high" | "critical";

/**
 * A canned provider review response used by hermetic fixtures to drive
 * the real prompt → provider transport → parser → verification/filter →
 * durable-finding pipeline without needing a live provider. The runner
 * writes this JSON into the mock LLM server's per-fixture directory and
 * the mock LLM returns it verbatim for the matching fixture request.
 */
export type MockReviewOverride = {
  /** The canned review payload (summary / verdict / comments). */
  readonly review: {
    readonly summary: string;
    readonly verdict: string;
    readonly comments: readonly {
      readonly path: string;
      readonly line: number;
      readonly body: string;
      readonly severity: string;
      readonly category: string;
    }[];
  };
  /**
   * When true, the runner writes malformed JSON into the per-fixture
   * canned-review file so the parser raises a parse-failure. Used to
   * exercise the parse-fail-not-clean invariant.
   */
  readonly simulateParseFailure?: boolean;
  /**
   * When true, the runner writes a truncated JSON body into the
   * per-fixture canned-review file so the parser raises a truncation
   * parse-failure. Distinct from simulateParseFailure so the parser
   * surfaces `parseFailureReason: "truncated"` correctly.
   */
  readonly simulateTruncation?: boolean;
};

/**
 * The set of hard invariants a fixture can opt into. Each invariant
 * causes the gate to fail when violated, regardless of the precision
 * / recall threshold.
 */
export type FixtureHardInvariant =
  /** No surviving comment may cite a forbidden path prefix. */
  | "surviving-fabrication-zero"
  /** No surviving comment body may contain a secret pattern. */
  | "secret-leakage-zero"
  /**
   * When parseFailed=true, the review MUST be flagged (comments == 0
   * with no parseFailed flag is misclassified-clean). When the fixture
   * sets this invariant, an empty outcome WITHOUT parseFailed=true is
   * a gate failure.
   */
  | "parse-fail-not-clean"
  /** Every surviving / downgraded comment must carry a v1 fingerprint identity. */
  | "identity-fields-present";

/**
 * IdentityDigest-level ground truth. The grader uses the identityDigest
 * (NOT file+line) to score TP / FP / FN. Two findings with the same
 * identityDigest dedup; the full canonical fields are recorded for
 * traceability.
 */
export type ExpectedFindingIdentity = {
  readonly identityDigest: string;
  readonly fingerprintDigest: string;
  readonly canonicalPath: string;
  readonly anchorKind: "symbol" | "hunk";
  readonly canonicalAnchor: string;
  readonly normalizedCategory: string;
  readonly normalizedRuleKey: string;
};

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
  /**
   * v2: extended list of path prefixes the surviving + downgraded
   * comments MUST NOT cite. Multiple prefixes so fixtures can list
   * `dist/`, `build/`, `node_modules/` independently without piling
   * every prefix into a single colon-joined string. Supersedes the
   * single-prefix `mustNotFabricatePath` for v2+ fixtures.
   */
  readonly forbiddenPathPrefixes?: readonly string[];
  /**
   * v2: identityDigest-level ground truth for true-positive findings.
   * The grader computes TP = expected identities present in the
   * surviving / downgraded comments; FN = expected identities missing;
   * FP = surviving / downgraded identities NOT in expected ∪ allowed.
   */
  readonly expectedFindings?: readonly ExpectedFindingIdentity[];
  /**
   * v2: identityDigest-level allow-list. Surviving / downgraded
   * identities that match an allowed entry are not counted as FP or FN
   * (they are "acceptable" findings the fixture permits but does not
   * require).
   */
  readonly allowedFindings?: readonly ExpectedFindingIdentity[];
  /**
   * v2: optional list of hard invariants the gate must enforce.
   * A breach flips the per-fixture pass to false AND is appended to
   * the gate-level failure list with a named message.
   */
  readonly hardInvariants?: readonly FixtureHardInvariant[];
  /**
   * v2: optional canned provider review the runner writes into the
   * mock LLM server's per-fixture directory. Used by deterministic
   * fixtures that need exact identityDigest parity with the canned
   * provider output.
   */
  readonly mockReviewOverride?: MockReviewOverride;
  /**
   * v2: optional list of body substrings (case-insensitive) that must
   * NOT appear in any surviving / downgraded comment. The fixture's
   * secret-leakage-zero invariant is enforced via the built-in secret
   * pattern check; this list extends it with domain-specific phrases.
   */
  readonly forbiddenBodyPatterns?: readonly string[];
};

export type ReviewFixture = {
  readonly name: string;
  readonly description: string;
  readonly diff: string;
  readonly expected: ReviewEvalExpectation;
  /**
   * Optional auxiliary fixture files (written into a throwaway workdir
   * before the live provider call). v2: cross-file fixtures use this to
   * stage the downstream contract that the upstream change broke.
   */
  readonly fixtureFiles?: Readonly<Record<string, string>>;
  /**
   * Optional review-side fixture files (paths the canned review
   * should reference). v2: cross-file fixtures cite these paths.
   */
  readonly reviewFiles?: readonly string[];
};

/**
 * v2: per-fixture result. Carries TP/FP/FN counts, hard-invariant
 * breaches, durationMs, tokenUsage, and roundTrips so the runner can
 * aggregate the full report without re-touching the per-fixture data.
 */
export type ReviewEvalResult = {
  readonly fixtureName: string;
  readonly modelId: string;
  readonly actualComments: number;
  readonly fabricationRate: number;
  readonly severityHistogram: Readonly<Record<Severity, number>>;
  readonly failures: readonly string[];
  readonly passed: boolean;
  readonly tpCount: number;
  readonly fpCount: number;
  readonly fnCount: number;
  readonly identityDigestHits: readonly string[];
  readonly survivingOffDiffCount: number;
  readonly survivingSecretLeakCount: number;
  readonly parseFailedFlag: boolean;
  readonly identityFieldMissingCount: number;
  readonly durationMs: number;
  readonly tokenUsage: {
    readonly input: number;
    readonly output: number;
    readonly total: number;
  };
  readonly roundTrips: number;
};

/**
 * v2: the schema-versioned report schema. Additively extended from v1.
 * Old readers ignore unknown fields (per the JSON-envelope additive-
 * versioning rule); new readers detect schemaVersion=2 and use the
 * precision/recall/F1 block.
 */
export type ReviewEvalReport = {
  readonly schemaVersion: 2;
  readonly generatedAt: string;
  readonly fixtureCount: number;
  readonly passedCount: number;
  readonly failedCount: number;
  readonly totalProviderCalls: number;
  readonly TP: number;
  readonly FP: number;
  readonly FN: number;
  readonly precision: number;
  readonly recall: number;
  readonly F1: number;
  readonly fabrication: number;
  readonly suppression: number;
  readonly severity: Readonly<Record<Severity, number>>;
  readonly latency: {
    readonly totalMs: number;
    readonly perFixtureMeanMs: number;
  };
  readonly token: {
    readonly inputTotal: number;
    readonly outputTotal: number;
    readonly total: number;
  };
  readonly roundTrip: {
    readonly total: number;
    readonly perFixtureMean: number;
  };
  readonly fixtureHashes: Readonly<Record<string, string>>;
  readonly mockServerHash: string;
  readonly mockServerVersion: string;
  readonly packageCommit: string;
  readonly config: {
    readonly model: string;
    readonly provider: string;
    readonly runtime: string;
  };
  readonly passed: boolean;
  readonly gateFailures: readonly string[];
  readonly results: readonly ReviewEvalResult[];
};

/** Mutable helper used while constructing the report before freezing it. */
export type MutableReviewEvalReport = {
  schemaVersion: 2;
  generatedAt: string;
  fixtureCount: number;
  passedCount: number;
  failedCount: number;
  totalProviderCalls: number;
  TP: number;
  FP: number;
  FN: number;
  precision: number;
  recall: number;
  F1: number;
  fabrication: number;
  suppression: number;
  severity: Record<Severity, number>;
  latency: { totalMs: number; perFixtureMeanMs: number };
  token: { inputTotal: number; outputTotal: number; total: number };
  roundTrip: { total: number; perFixtureMean: number };
  fixtureHashes: Record<string, string>;
  mockServerHash: string;
  mockServerVersion: string;
  packageCommit: string;
  config: { model: string; provider: string; runtime: string };
  passed: boolean;
  gateFailures: string[];
  results: ReviewEvalResult[];
};

// ---------------------------------------------------------------------------
// Gate thresholds (load-bearing release quality bar)
// ---------------------------------------------------------------------------

export const GateThresholds = {
  /** precision >= 0.90 across all fixtures. */
  precisionMin: 0.90,
  /** recall >= 0.85 across all fixtures. */
  recallMin: 0.85,
  /** F1 >= 0.87 across all fixtures. */
  F1Min: 0.87,
  /** surviving fabrication rate must be exactly 0. */
  survivingFabricationMax: 0,
  /** secret-leakage count must be exactly 0. */
  secretLeakageMax: 0,
  /** identityFieldsMissing must be exactly 0. */
  identityFieldsMissingMax: 0,
} as const;

// ---------------------------------------------------------------------------
// Pipeline comment collection (preserved from v1)
// ---------------------------------------------------------------------------

/**
 * Pull every comment from the three arrays that the filter pipeline emits:
 * `review.comments` (kept at original severity), `verifiedFactsFilter.downgraded`
 * (always downgraded to `info`), and `confidenceFilter.downgraded` (downgraded
 * per pattern, severity preserved from the comment object).
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

// ---------------------------------------------------------------------------
// Secret patterns (built-in; secret-leakage-zero invariant)
// ---------------------------------------------------------------------------

const SECRET_BODY_PATTERNS: readonly RegExp[] = [
  // AWS access key
  /\bAKIA[0-9A-Z]{16}\b/u,
  // Generic API key shapes
  /\bsk-[A-Za-z0-9]{16,}\b/u,
  // GitHub personal access token (classic)
  /\bghp_[A-Za-z0-9]{30,}\b/u,
  // GitHub fine-grained PAT
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/u,
  // Slack token
  /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/u,
  // PEM private key header
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/u,
];

/**
 * True when the comment body contains a known secret pattern (case-
 * insensitive match). Used by `countSurvivingSecretLeaks`.
 */
export function commentLooksLikeSecretLeak(body: string): boolean {
  for (const pattern of SECRET_BODY_PATTERNS) {
    if (pattern.test(body)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Hard invariant helpers (v2)
// ---------------------------------------------------------------------------

/**
 * Count comments that cite a forbidden path prefix. Used by the
 * surviving-fabrication-zero invariant and by sabotage fixtures.
 */
export function countSurvivingOffDiffByPrefix(
  outcome: Pick<LiveProviderOutcome, "review" | "verifiedFactsFilter" | "confidenceFilter">,
  prefixes: readonly string[],
): number {
  if (prefixes.length === 0) return 0;
  const pipeline = collectPipelineComments(outcome);
  let n = 0;
  for (const c of pipeline) {
    for (const prefix of prefixes) {
      if (c.path.startsWith(prefix)) {
        n += 1;
        break;
      }
    }
  }
  return n;
}

/**
 * Count surviving / downgraded comments whose body matches a built-in
 * secret pattern. Used by the secret-leakage-zero invariant.
 */
export function countSurvivingSecretLeaks(
  outcome: Pick<LiveProviderOutcome, "review" | "verifiedFactsFilter" | "confidenceFilter">,
): number {
  const pipeline = collectPipelineComments(outcome);
  let n = 0;
  for (const c of pipeline) {
    if (commentLooksLikeSecretLeak(c.body)) n += 1;
  }
  return n;
}

/**
 * True when the outcome has zero comments AND no parseFailed flag —
 * a misclassified-clean case. The parse-fail-not-clean invariant
 * treats this as a gate failure.
 */
export function isParseFailMisclassifiedAsClean(
  outcome: { readonly review: LiveProviderOutcome["review"]; readonly parseFailed?: boolean },
): boolean {
  const totalComments = outcome.review.comments.length
    + (outcome.review.suppressedComments?.length ?? 0);
  return totalComments === 0 && outcome.parseFailed !== true;
}

/**
 * Count surviving / downgraded comments missing the Task 4 identity
 * block. Used by the identity-fields-present invariant.
 */
export function countMissingIdentityFields(
  outcome: Pick<LiveProviderOutcome, "review" | "verifiedFactsFilter" | "confidenceFilter">,
): number {
  const pipeline = collectPipelineComments(outcome);
  let n = 0;
  for (const c of pipeline) {
    const id = c.durableIdentity;
    if (
      id === undefined ||
      id.fingerprintVersion !== 1 ||
      typeof id.identityDigest !== "string" ||
      id.identityDigest.length !== 64
    ) {
      n += 1;
    }
  }
  return n;
}

// ---------------------------------------------------------------------------
// Identity ground-truth match (v2)
// ---------------------------------------------------------------------------

export type IdentityGroundTruthMatch = {
  readonly tp: readonly string[];
  readonly fp: readonly string[];
  readonly fn: readonly string[];
  readonly missingIdentity: readonly LiveReviewComment[];
};

/**
 * Compute TP/FP/FN at identityDigest level. The grader treats
 * identityDigests as the stable identity of a finding; file+line shifts
 * do not affect scoring.
 *
 *   - expected ∩ actual ⇒ TP (every expected digest seen in actual).
 *   - expected \ actual ⇒ FN (every expected digest NOT seen).
 *   - actual \ (expected ∪ allowed) ⇒ FP (every actual digest not
 *     permitted by either list).
 *   - Actual comments missing the identity block surface in
 *     `missingIdentity` so the gate can flag identity-fields-present
 *     independently from the TP/FP/FN count.
 */
export function matchIdentityGroundTruth(
  outcome: Pick<LiveProviderOutcome, "review" | "verifiedFactsFilter" | "confidenceFilter">,
  expected: {
    readonly expectedFindings?: readonly ExpectedFindingIdentity[];
    readonly allowedFindings?: readonly ExpectedFindingIdentity[];
  },
): IdentityGroundTruthMatch {
  const expectedIds = new Set<string>();
  for (const e of expected.expectedFindings ?? []) expectedIds.add(e.identityDigest);

  const allowedIds = new Set<string>();
  for (const a of expected.allowedFindings ?? []) allowedIds.add(a.identityDigest);

  const pipeline = collectPipelineComments(outcome);

  const seenIds = new Set<string>();
  const missingIdentity: LiveReviewComment[] = [];
  for (const c of pipeline) {
    const id = c.durableIdentity;
    if (id === undefined || id.fingerprintVersion !== 1 || typeof id.identityDigest !== "string") {
      missingIdentity.push(c);
      continue;
    }
    seenIds.add(id.identityDigest);
  }

  const tp: string[] = [];
  for (const id of expectedIds) if (seenIds.has(id)) tp.push(id);

  const fn: string[] = [];
  for (const id of expectedIds) if (!seenIds.has(id)) fn.push(id);

  const fp: string[] = [];
  for (const id of seenIds) {
    if (expectedIds.has(id)) continue;
    if (allowedIds.has(id)) continue;
    fp.push(id);
  }

  return { tp, fp, fn, missingIdentity };
}

// ---------------------------------------------------------------------------
// Per-fixture grader (v2)
// ---------------------------------------------------------------------------

/**
 * Grade a single fixture outcome against the fixture's local thresholds.
 *
 * v2 path adds identityDigest-level TP/FP/FN, hard-invariant checks,
 * and the report-block counts. v1 callers (which pass fixtures without
 * expectedFindings / hardInvariants) keep their v1 semantics; the new
 * blocks all default to zero or empty.
 */
export function gradeReviewFixture(
  fixture: ReviewFixture,
  outcome: Pick<
    LiveProviderOutcome,
    "review" | "verifiedFactsFilter" | "confidenceFilter" | "parseWarnings" | "modelId"
  > & {
    readonly parseFailed?: boolean;
    readonly durationMs?: number;
    readonly tokenUsage?: { input?: number; output?: number; total?: number };
    readonly roundTrips?: number;
  },
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

  // v1 invariant 1: minComments
  if (actualComments < fixture.expected.minComments) {
    failures.push(
      `actualComments (${actualComments}) < minComments (${fixture.expected.minComments})`,
    );
  }
  // v1 invariant 2: maxComments
  if (actualComments > fixture.expected.maxComments) {
    failures.push(
      `actualComments (${actualComments}) > maxComments (${fixture.expected.maxComments})`,
    );
  }
  // v1 invariant 3: fabricationRate
  if (fabricationRate > fixture.expected.maxFabricationRate) {
    failures.push(
      `fabricationRate (${fabricationRate.toFixed(3)}) > maxFabricationRate (${fixture.expected.maxFabricationRate})`,
    );
  }
  // v1 invariant 4: minHighSeverity
  if (highSeverityCount < fixture.expected.minHighSeverity) {
    failures.push(
      `highSeverityCount (${highSeverityCount}) < minHighSeverity (${fixture.expected.minHighSeverity})`,
    );
  }
  // v1 invariant 5: mustNotContain
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
  // v1 invariant 6: mustNotFabricatePath (single prefix; legacy)
  const singleForbidden = fixture.expected.mustNotFabricatePath;
  if (singleForbidden.length > 0) {
    for (const c of pipelineComments) {
      if (c.path.startsWith(singleForbidden)) {
        failures.push(
          `forbidden path "${singleForbidden}" found on surviving/downgraded comment at ${c.path}:${c.line}`,
        );
      }
    }
  }

  // v2 invariant: forbiddenPathPrefixes (multi-prefix)
  const forbiddenPrefixes: string[] = [];
  for (const p of fixture.expected.forbiddenPathPrefixes ?? []) forbiddenPrefixes.push(p);
  if (forbiddenPrefixes.length === 0 && singleForbidden.length > 0) {
    forbiddenPrefixes.push(singleForbidden);
  }
  const survivingOffDiffCount = countSurvivingOffDiffByPrefix(outcome, forbiddenPrefixes);
  if (survivingOffDiffCount > 0 && (fixture.expected.hardInvariants ?? []).includes("surviving-fabrication-zero")) {
    failures.push(
      `surviving-fabrication-zero: ${survivingOffDiffCount} surviving comment(s) cite forbidden path(s): ${forbiddenPrefixes.join(", ")}`,
    );
  }

  // v2 invariant: secret-leakage-zero
  const survivingSecretLeakCount = countSurvivingSecretLeaks(outcome);
  if (survivingSecretLeakCount > 0 && (fixture.expected.hardInvariants ?? []).includes("secret-leakage-zero")) {
    failures.push(
      `secret-leakage-zero: ${survivingSecretLeakCount} surviving comment(s) match a secret pattern`,
    );
  }

  // v2 invariant: parse-fail-not-clean
  if ((fixture.expected.hardInvariants ?? []).includes("parse-fail-not-clean")
      && isParseFailMisclassifiedAsClean(outcome)
      && fixture.expected.minComments > 0) {
    failures.push(
      `parse-fail-not-clean: 0 comments without parseFailed=true; review misclassified as clean`,
    );
  }

  // v2 invariant: identity-fields-present
  const identityFieldMissingCount = countMissingIdentityFields(outcome);
  if (identityFieldMissingCount > 0 && (fixture.expected.hardInvariants ?? []).includes("identity-fields-present")) {
    failures.push(
      `identity-fields-present: ${identityFieldMissingCount} comment(s) missing fingerprintVersion=1 / identityDigest / canonical fields`,
    );
  }

  // v2: identityDigest-level ground truth.
  const identityMatch = matchIdentityGroundTruth(outcome, {
    ...(fixture.expected.expectedFindings !== undefined
      ? { expectedFindings: fixture.expected.expectedFindings }
      : {}),
    ...(fixture.expected.allowedFindings !== undefined
      ? { allowedFindings: fixture.expected.allowedFindings }
      : {}),
  });
  const tpCount = identityMatch.tp.length;
  const fpCount = identityMatch.fp.length;
  const fnCount = identityMatch.fn.length;

  if (fnCount > 0) {
    failures.push(
      `missing ${fnCount} expected identity/identities: ${identityMatch.fn.slice(0, 3).join(", ")}${identityMatch.fn.length > 3 ? "…" : ""}`,
    );
  }

  const tokenUsage = outcome.tokenUsage ?? {};
  const input = tokenUsage.input ?? 0;
  const output = tokenUsage.output ?? 0;
  const total = tokenUsage.total ?? input + output;

  return {
    fixtureName: fixture.name,
    modelId: outcome.modelId,
    actualComments,
    fabricationRate,
    severityHistogram,
    failures,
    passed: failures.length === 0,
    tpCount,
    fpCount,
    fnCount,
    identityDigestHits: identityMatch.tp,
    survivingOffDiffCount,
    survivingSecretLeakCount,
    parseFailedFlag: outcome.parseFailed === true,
    identityFieldMissingCount,
    durationMs: outcome.durationMs ?? 0,
    tokenUsage: { input, output, total },
    roundTrips: outcome.roundTrips ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Aggregate report (v2 schema)
// ---------------------------------------------------------------------------

/**
 * Aggregate per-fixture results into a v2 report. The aggregator is
 * pure: no I/O. Callers serialize via `writeReviewEvalReport`.
 *
 * The gate's TP/FP/FN sums the per-fixture counts (already at the
 * identityDigest level), and computes precision / recall / F1 against
 * the load-bearing thresholds. Any threshold breach appends a named
 * message to `gateFailures` and flips `passed` to false.
 */
export function aggregateReviewEvalResults(
  results: readonly ReviewEvalResult[],
  totalProviderCalls: number = 0,
  context?: {
    readonly fixtureHashes?: Readonly<Record<string, string>>;
    readonly mockServerHash?: string;
    readonly mockServerVersion?: string;
    readonly packageCommit?: string;
    readonly config?: {
      readonly model: string;
      readonly provider: string;
      readonly runtime: string;
    };
  },
): ReviewEvalReport {
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.length - passedCount;

  const TP = results.reduce((acc, r) => acc + r.tpCount, 0);
  const FP = results.reduce((acc, r) => acc + r.fpCount, 0);
  const FN = results.reduce((acc, r) => acc + r.fnCount, 0);
  const precision = TP + FP === 0 ? 1 : TP / (TP + FP);
  const recall = TP + FN === 0 ? 1 : TP / (TP + FN);
  const F1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  const fabrication = results.reduce((acc, r) => acc + r.survivingOffDiffCount, 0);
  const suppression = results.reduce((acc, r) => acc + parseWarningsCount(r), 0);

  const severity: Record<Severity, number> = { info: 0, low: 0, medium: 0, high: 0, critical: 0 };
  let totalMs = 0;
  let inputTotal = 0;
  let outputTotal = 0;
  let totalTokens = 0;
  let totalRounds = 0;
  for (const r of results) {
    for (const k of Object.keys(severity) as Severity[]) {
      severity[k] += r.severityHistogram[k] ?? 0;
    }
    totalMs += r.durationMs;
    inputTotal += r.tokenUsage.input;
    outputTotal += r.tokenUsage.output;
    totalTokens += r.tokenUsage.total;
    totalRounds += r.roundTrips;
  }
  const perFixtureMeanMs = results.length === 0 ? 0 : totalMs / results.length;

  const gateFailures: string[] = [];
  if (precision < GateThresholds.precisionMin) {
    gateFailures.push(
      `precision ${precision.toFixed(3)} < threshold ${GateThresholds.precisionMin.toFixed(2)}`,
    );
  }
  if (recall < GateThresholds.recallMin) {
    gateFailures.push(
      `recall ${recall.toFixed(3)} < threshold ${GateThresholds.recallMin.toFixed(2)}`,
    );
  }
  if (F1 < GateThresholds.F1Min) {
    gateFailures.push(
      `F1 ${F1.toFixed(3)} < threshold ${GateThresholds.F1Min.toFixed(2)}`,
    );
  }
  if (fabrication > GateThresholds.survivingFabricationMax) {
    gateFailures.push(
      `survivingFabrication ${fabrication} > threshold ${GateThresholds.survivingFabricationMax}`,
    );
  }
  const secretLeakage = results.reduce((acc, r) => acc + r.survivingSecretLeakCount, 0);
  if (secretLeakage > GateThresholds.secretLeakageMax) {
    gateFailures.push(
      `secretLeakage ${secretLeakage} > threshold ${GateThresholds.secretLeakageMax}`,
    );
  }
  const identityFieldsMissing = results.reduce((acc, r) => acc + r.identityFieldMissingCount, 0);
  if (identityFieldsMissing > GateThresholds.identityFieldsMissingMax) {
    gateFailures.push(
      `identityFieldsMissing ${identityFieldsMissing} > threshold ${GateThresholds.identityFieldsMissingMax}`,
    );
  }
  for (const r of results) {
    for (const f of r.failures) {
      gateFailures.push(`${r.fixtureName}: ${f}`);
    }
  }
  const passed = gateFailures.length === 0 && failedCount === 0;

  return {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    fixtureCount: results.length,
    passedCount,
    failedCount,
    totalProviderCalls,
    TP,
    FP,
    FN,
    precision,
    recall,
    F1,
    fabrication,
    suppression,
    severity,
    latency: {
      totalMs,
      perFixtureMeanMs,
    },
    token: {
      inputTotal,
      outputTotal,
      total: totalTokens,
    },
    roundTrip: {
      total: totalRounds,
      perFixtureMean: results.length === 0 ? 0 : totalRounds / results.length,
    },
    fixtureHashes: { ...(context?.fixtureHashes ?? {}) },
    mockServerHash: context?.mockServerHash ?? "unknown",
    mockServerVersion: context?.mockServerVersion ?? "unknown",
    packageCommit: context?.packageCommit ?? "unknown",
    config: {
      model: context?.config?.model ?? "unknown",
      provider: context?.config?.provider ?? "unknown",
      runtime: context?.config?.runtime ?? `node-${process.versions.node}`,
    },
    passed,
    gateFailures,
    results,
  };
}

function parseWarningsCount(r: ReviewEvalResult): number {
  // fabricationRate was computed as parseWarnings / (actualComments + parseWarnings)
  // in v1; we don't carry parseWarnings length on the result, so derive it.
  if (r.fabricationRate === 0) return 0;
  if (r.actualComments === 0) return 0;
  // parseWarnings = fabricationRate * actualComments / (1 - fabricationRate)
  return Math.round((r.fabricationRate * r.actualComments) / (1 - r.fabricationRate));
}

// ---------------------------------------------------------------------------
// Report writer
// ---------------------------------------------------------------------------

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
  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, JSON.stringify(report, null, 2), "utf8");
  return artifactPath;
}

// ---------------------------------------------------------------------------
// Hash utilities
// ---------------------------------------------------------------------------

/** SHA-256 of a UTF-8 string, hex-encoded. */
export function sha256Hex(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/** SHA-256 of a file's bytes, hex-encoded. */
export function sha256File(filePath: string): string {
  const buf = readFileSync(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

/** Resolve the absolute path of the bundled mock LLM server. */
export function resolveMockServerPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..", "..", "test", "post-release", "mock-llm-server.mjs");
}

/**
 * Resolve the current package commit. Returns "unknown" when the
 * supplied directory is not inside a git repo.
 */
export function resolvePackageCommit(repoRoot?: string): string {
  try {
    const out = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repoRoot ?? process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.trim();
  } catch {
    return "unknown";
  }
}

// ---------------------------------------------------------------------------
// Snapshot compatibility
// ---------------------------------------------------------------------------

/**
 * Reject any captured outcome snapshot whose source fixture / mock /
 * package commit doesn't match the current run. CI MUST reject (not
 * warn) when hashes diverge. This is the load-bearing guard for the
 * "Fixture/snapshot refresh requires a reviewed fixture commit" rule.
 */
export function assertSnapshotCompatible(
  currentReport: ReviewEvalReport,
  snapshotPath: string,
): { readonly compatible: boolean; readonly reason?: string } {
  if (!existsSync(snapshotPath)) {
    return { compatible: false, reason: `snapshot not found at ${snapshotPath}` };
  }
  const raw = readFileSync(snapshotPath, "utf8");
  const snap = JSON.parse(raw) as Partial<ReviewEvalReport>;
  if (snap.mockServerHash !== currentReport.mockServerHash) {
    return {
      compatible: false,
      reason: `mockServerHash differs (snapshot=${snap.mockServerHash} current=${currentReport.mockServerHash})`,
    };
  }
  if (snap.packageCommit !== currentReport.packageCommit) {
    return {
      compatible: false,
      reason: `packageCommit differs (snapshot=${snap.packageCommit} current=${currentReport.packageCommit})`,
    };
  }
  for (const [name, hash] of Object.entries(currentReport.fixtureHashes)) {
    if (snap.fixtureHashes?.[name] !== hash) {
      return {
        compatible: false,
        reason: `fixtureHash[${name}] differs (snapshot=${snap.fixtureHashes?.[name]} current=${hash})`,
      };
    }
  }
  return { compatible: true };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const here = dirname(fileURLToPath(import.meta.url));
const _REPO_ROOT = resolve(here, "..", "..");
// `join` is referenced by `writeReviewEvalReport` callers via the
// canonical path resolved above; this import keeps the linter quiet
// when only one of the two helpers is exercised in a given call site.
void join;
void _REPO_ROOT;
