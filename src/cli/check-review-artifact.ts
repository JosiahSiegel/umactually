// SPDX-License-Identifier: MIT

import { readFileSync } from "node:fs";

const PARSE_FAIL_MARKERS = [
  "Provider response did not contain a valid JSON review payload",
  "Parse failed — provider response",
  "Parse failed",
] as const;

const CLEAN_VERDICTS = new Set(["APPROVED", "SHIP"]);

export type ReviewArtifactClassification = {
  readonly ok: boolean;
  readonly reason?: string;
  readonly summary?: string;
};

export function classifyReviewArtifact(path: string): ReviewArtifactClassification {
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return { ok: false, reason: "file not found" };
    }
    return {
      ok: false,
      reason: `cannot read artifact: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  if (PARSE_FAIL_MARKERS.some((marker) => content.includes(marker))) {
    return { ok: false, reason: "contains parse-fail sentinel" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { ok: false, reason: "invalid JSON" };
    }
    throw error;
  }

  if (!isRecord(parsed)) {
    return { ok: false, reason: "invalid artifact: expected a JSON object" };
  }

  const event = stringField(parsed, "event");
  const verdict = stringField(parsed, "verdict");
  const postedStatusState = stringField(parsed, "postedStatusState");
  const inlineThreadCount = numberField(parsed, "inlineThreadCount");
  const postedThreadCount = numberField(parsed, "postedThreadCount");
  const suppressedCommentCount = numberField(parsed, "suppressedCommentCount");
  const totalFindings = inlineThreadCount + postedThreadCount;

  if (parsed["parseFailed"] === true) {
    return { ok: false, reason: "parse-fail: artifact explicitly flagged parseFailed=true" };
  }

  const hasSignal =
    event.length > 0 ||
    verdict.length > 0 ||
    postedStatusState.length > 0 ||
    totalFindings > 0;
  if (!hasSignal) {
    return { ok: false, reason: "parse-fail: no event, verdict, status, or findings" };
  }

  if (verdict.toUpperCase() === "NEEDS_FIX" && totalFindings === 0) {
    return {
      ok: false,
      reason: "contradictory review: verdict=NEEDS_FIX with 0 findings",
    };
  }

  const isCleanVerdict =
    CLEAN_VERDICTS.has(verdict.toUpperCase()) ||
    CLEAN_VERDICTS.has(postedStatusState.toUpperCase());
  if (totalFindings === 0 && suppressedCommentCount === 0 && !isCleanVerdict) {
    return { ok: true, summary: "accepted low-signal review" };
  }

  const reviewVerdict = verdict || postedStatusState || event;
  return {
    ok: true,
    summary: `real review (${totalFindings} findings, verdict=${reviewVerdict})`,
  };
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
