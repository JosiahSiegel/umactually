// SPDX-License-Identifier: MIT

import { readFileSync } from "node:fs";
import { ARTIFACT_SCHEMA_VERSION } from "../review/artifact-schema.js";

const PARSE_FAIL_MARKERS = [
  "Provider response did not contain a valid JSON review payload",
  "Parse failed — provider response",
  "Parse failed",
] as const;

const CLEAN_VERDICTS = new Set(["APPROVED", "SHIP"]);

/**
 * Floor (milliseconds) below which a successful review is flagged as
 * suspiciously fast. A genuine provider round-trip to a hosted LLM
 * (Anthropic, OpenAI, Copilot) is rarely under 3 seconds even for a
 * trivial diff — TLS handshake + auth + completion latency dominates.
 * A sub-3s "real" review almost always indicates a cache hit, a test
 * fixture, or a short-circuit fallback rather than a fresh model call.
 *
 * Empirically grounded: PR #140 (legit, 440-LOC refactor) took 20.6s;
 * PRs #141-#143 (suspected rubber-stamps) took 3-5s. The threshold
 * sits below the rubber-stamp band so genuine small-PR reviews don't
 * trip the warning while clearly-short-circuited runs do.
 */
const SUSPICIOUS_FAST_REVIEW_MS = 3000;

/**
 * Floor (provider round-trips) below which a successful post is
 * flagged as having no real provider interaction. Every legitimate
 * review (even the simplest) requires at least one completion-API
 * call. Zero round-trips after a successful post indicates the
 * review body was produced without contacting the configured model.
 */
const MIN_EXPECTED_PROVIDER_ROUND_TRIPS = 1;

export type ReviewArtifactClassification = {
  readonly ok: boolean;
  readonly reason?: string;
  readonly summary?: string;
  /**
   * Advisory warnings about signals that are non-fatal but suspicious
   * — typically indicating a possible rubber-stamp review. Always
   * empty when `ok === false` (fatal signals take precedence). The
   * self-review workflow surfaces each warning as a `::warning::`
   * GitHub Actions annotation so the failure is visible in the PR's
   * checks view without turning the overall job red.
   */
  readonly warnings: readonly string[];
};

export function classifyReviewArtifact(path: string): ReviewArtifactClassification {
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return { ok: false, reason: "file not found", warnings: [] };
    }
    return {
      ok: false,
      reason: `cannot read artifact: ${error instanceof Error ? error.message : String(error)}`,
      warnings: [],
    };
  }

  if (PARSE_FAIL_MARKERS.some((marker) => content.includes(marker))) {
    return { ok: false, reason: "contains parse-fail sentinel", warnings: [] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { ok: false, reason: "invalid JSON", warnings: [] };
    }
    throw error;
  }

  if (!isRecord(parsed)) {
    return { ok: false, reason: "invalid artifact: expected a JSON object", warnings: [] };
  }

  const rawSchemaVersion = parsed["schemaVersion"];
  if (typeof rawSchemaVersion === "number" && rawSchemaVersion > ARTIFACT_SCHEMA_VERSION) {
    return {
      ok: false,
      reason: `unsupported-schema-version: artifact declares schemaVersion ${rawSchemaVersion}, supported max is ${ARTIFACT_SCHEMA_VERSION}`,
      warnings: [],
    };
  }

  const event = stringField(parsed, "event");
  const verdict = stringField(parsed, "verdict");
  const postedStatusState = stringField(parsed, "postedStatusState");
  const inlineThreadCount = numberField(parsed, "inlineThreadCount");
  const postedThreadCount = numberField(parsed, "postedThreadCount");
  const suppressedCommentCount = numberField(parsed, "suppressedCommentCount");
  const reviewDurationMs = numberFieldOrUndefined(parsed, "reviewDurationMs");
  const providerRoundTrips = numberFieldOrUndefined(parsed, "providerRoundTrips");
  const posted = parsed["posted"] === true;
  const totalFindings = inlineThreadCount + postedThreadCount;

  if (parsed["parseFailed"] === true) {
    return { ok: false, reason: "parse-fail: artifact explicitly flagged parseFailed=true", warnings: [] };
  }

  const hasSignal =
    event.length > 0 ||
    verdict.length > 0 ||
    postedStatusState.length > 0 ||
    totalFindings > 0;
  if (!hasSignal) {
    return { ok: false, reason: "parse-fail: no event, verdict, status, or findings", warnings: [] };
  }

  if (verdict.toUpperCase() === "NEEDS_FIX" && totalFindings === 0) {
    return {
      ok: false,
      reason: "contradictory review: verdict=NEEDS_FIX with 0 findings",
      warnings: [],
    };
  }

  const reviewVerdict = verdict || postedStatusState || event;
  const warnings = detectSuspiciousSignals({
    posted,
    reviewDurationMs,
    providerRoundTrips,
    totalFindings,
    verdict: reviewVerdict,
  });

  const isCleanVerdict =
    CLEAN_VERDICTS.has(verdict.toUpperCase()) ||
    CLEAN_VERDICTS.has(postedStatusState.toUpperCase());
  if (totalFindings === 0 && suppressedCommentCount === 0 && !isCleanVerdict) {
    return { ok: true, summary: "accepted low-signal review", warnings };
  }

  return {
    ok: true,
    summary: `real review (${totalFindings} findings, verdict=${reviewVerdict})`,
    warnings,
  };
}

/**
 * Surface advisory warnings about signals that don't fail the
 * artifact but suggest the review body may not reflect a real
 * provider round-trip. The self-review workflow emits each warning
 * as a `::warning::` annotation; the artifact itself remains
 * `ok === true` so the guard's exit code stays advisory-only.
 *
 * Returns an empty array when no suspicious signals fire.
 */
function detectSuspiciousSignals(input: {
  readonly posted: boolean;
  readonly reviewDurationMs: number | undefined;
  readonly providerRoundTrips: number | undefined;
  readonly totalFindings: number;
  readonly verdict: string;
}): readonly string[] {
  const warnings: string[] = [];

  if (input.posted) {
    // Signal: posted=true with providerRoundTrips === 0 means the
    // review body was published without any provider HTTP call. This
    // is structurally impossible for a real LLM review and indicates
    // either a cache hit or a short-circuit fallback. Flag loudly.
    if (input.providerRoundTrips === 0) {
      warnings.push(
        "provider-roundtrips-zero: review posted without contacting the provider (cache hit or short-circuit fallback suspected)",
      );
    } else if (input.providerRoundTrips !== undefined && input.providerRoundTrips < MIN_EXPECTED_PROVIDER_ROUND_TRIPS) {
      warnings.push(
        `provider-roundtrips-low: only ${input.providerRoundTrips} provider round-trip${input.providerRoundTrips === 1 ? "" : "s"} for a posted review (expected at least ${MIN_EXPECTED_PROVIDER_ROUND_TRIPS})`,
      );
    }

    // Signal: posted=true with reviewDurationMs below the empirical
    // floor. Even the fastest legitimate LLM review involves a TLS
    // handshake + auth + completion; sub-3s posts suggest the review
    // was assembled from a cached or pre-baked response.
    if (input.reviewDurationMs !== undefined && input.reviewDurationMs < SUSPICIOUS_FAST_REVIEW_MS) {
      warnings.push(
        `review-duration-fast: review posted in ${input.reviewDurationMs}ms (below ${SUSPICIOUS_FAST_REVIEW_MS}ms floor); possible rubber-stamp or cache short-circuit`,
      );
    }
  }

  return warnings;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function stringField(value: Record<string, unknown>, key: string): string {
  const field = value[key];
  return field === undefined || field === null ? "" : String(field).trim();
}

function numberField(value: Record<string, unknown>, key: string): number {
  return Number(value[key] ?? 0);
}

function numberFieldOrUndefined(
  value: Record<string, unknown>,
  key: string,
): number | undefined {
  const field = value[key];
  if (field === undefined || field === null) return undefined;
  const parsed = Number(field);
  return Number.isFinite(parsed) ? parsed : undefined;
}