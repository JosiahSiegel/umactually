// SPDX-License-Identifier: MIT
//
// Task 4 — Schema-versioned review artifact parser.
//
// Accepts BOTH the legacy sample format (schemaVersion absent or 0)
// and the new v1 schema (schemaVersion: 1). Unknown future versions
// produce a typed error. Malformed JSON, invalid shapes, and missing
// fingerprint fields all produce typed errors.
//
// The parser is the boundary contract shared by provider parsing,
// filters, renderers, platform adapters, evals, and artifacts.

import type { DurableFindingIdentity } from "./fingerprint.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ARTIFACT_SCHEMA_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// Types — durable finding (v1)
// ---------------------------------------------------------------------------

/**
 * A durable review comment carrying the fingerprint identity fields
 * plus mutable prose, severity, and optional provenance/suggestion.
 *
 * The fingerprint fields are stable across line shifts; the mutable
 * fields are never fingerprint inputs.
 */
export type DurableReviewComment = {
  readonly path: string;
  readonly line: number;
  readonly body: string;
  readonly severity: string;
  readonly category: string;

  // Fingerprint identity fields (from DurableFindingIdentity).
  readonly fingerprintVersion: number;
  readonly fingerprintDigest: string;
  readonly identityDigest: string;
  readonly canonicalPath: string;
  readonly anchorKind: "symbol" | "hunk";
  readonly canonicalAnchor: string;
  readonly normalizedCategory: string;
  readonly normalizedRuleKey: string;

  /** Optional evidence/context provenance references. */
  readonly provenance?: ReviewFindingProvenance;
  /** Optional validated suggestion. */
  readonly suggestion?: string;
};

export type ReviewFindingProvenance = {
  readonly provider?: string;
  readonly modelId?: string;
  readonly contextRefs?: readonly string[];
};

/**
 * A v1 schema-versioned review artifact. All comments carry the full
 * fingerprint identity.
 */
export type DurableReviewArtifact = {
  readonly schemaVersion: 1;
  readonly summary: string;
  readonly verdict: string;
  readonly comments: readonly DurableReviewComment[];
  readonly suppressedComments: readonly DurableReviewComment[];
};

/**
 * A legacy (unversioned) artifact. schemaVersion is absent or 0 in the
 * source JSON. Comments do NOT carry fingerprint fields.
 */
export type LegacyReviewArtifact = {
  readonly schemaVersion: 0;
  readonly summary: string;
  readonly verdict: string;
  readonly comments: readonly LegacyReviewComment[];
  readonly suppressedComments: readonly LegacyReviewComment[];
};

export type LegacyReviewComment = {
  readonly path: string;
  readonly line: number;
  readonly body: string;
  readonly severity: string;
  readonly category: string;
};

/**
 * Union type for any parsed artifact. The `schemaVersion` discriminates.
 */
export type ParsedReviewArtifact = DurableReviewArtifact | LegacyReviewArtifact;

/**
 * The minimal shape a serialized artifact must have: a `schemaVersion`.
 * Used for round-trip assertions.
 */
export type SchemaVersionedArtifact = {
  readonly schemaVersion: number;
  readonly [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Types — parse result
// ---------------------------------------------------------------------------

export type ReviewArtifactParseResult =
  | { readonly ok: true; readonly artifact: ParsedReviewArtifact }
  | { readonly ok: false; readonly error: ReviewArtifactParseError };

export type ReviewArtifactParseError =
  | { readonly kind: "malformed-json"; readonly message: string }
  | { readonly kind: "invalid-shape"; readonly message: string }
  | { readonly kind: "unsupported-schema-version"; readonly supportedVersion: number; readonly unsupportedVersion: number }
  | { readonly kind: "missing-fingerprint-fields"; readonly message: string };

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse a JSON string into a schema-versioned review artifact.
 *
 * Accepts:
 *   - Legacy format (no `schemaVersion` or `schemaVersion: 0`): comments
 *     do not carry fingerprint fields. Parsed as LegacyReviewArtifact.
 *   - v1 format (`schemaVersion: 1`): every comment MUST carry the full
 *     fingerprint identity. Parsed as DurableReviewArtifact.
 *
 * Rejects with typed errors:
 *   - malformed-json: invalid JSON syntax.
 *   - invalid-shape: top-level value is not an object, or required fields missing.
 *   - unsupported-schema-version: schemaVersion > ARTIFACT_SCHEMA_VERSION.
 *   - missing-fingerprint-fields: v1 comment missing fingerprint identity.
 */
export function parseReviewArtifact(jsonText: string): ReviewArtifactParseResult {
  const parsed = tryParseJsonObject(jsonText);
  if (parsed.kind === "error") return parsed.error;
  return buildReviewArtifactFromRecord(parsed.value);
}

type JsonObjectOk = { readonly kind: "ok"; readonly value: Record<string, unknown> };
type JsonObjectErr = { readonly kind: "error"; readonly error: ReviewArtifactParseResult };

function tryParseJsonObject(jsonText: string): JsonObjectOk | JsonObjectErr {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    return {
      kind: "error",
      error: {
        ok: false,
        error: {
          kind: "malformed-json",
          message: error instanceof Error ? error.message : String(error),
        },
      },
    };
  }
  if (!isRecord(parsed)) {
    return {
      kind: "error",
      error: {
        ok: false,
        error: {
          kind: "invalid-shape",
          message: "expected a JSON object at the top level",
        },
      },
    };
  }
  return { kind: "ok", value: parsed };
}

function buildReviewArtifactFromRecord(parsed: Record<string, unknown>): ReviewArtifactParseResult {
  const schemaVersionResult = parseSchemaVersion(parsed);
  if (!schemaVersionResult.ok) {
    return {
      ok: false,
      error: schemaVersionResult.error,
    };
  }
  const schemaVersion = schemaVersionResult.value;
  const shapeResult = validateShapeIfV1(parsed, schemaVersion);
  if (!shapeResult.ok) return shapeResult;

  const rawComments = readArray(parsed["comments"]);
  const rawSuppressed = readArray(
    parsed["suppressedComments"] ?? parsed["suppressed_comments"],
  );

  if (schemaVersion === 0) {
    return buildLegacyArtifact(parsed, rawComments, rawSuppressed);
  }
  return buildDurableArtifact(parsed, rawComments, rawSuppressed);
}

function parseSchemaVersion(parsed: Record<string, unknown>): { readonly ok: false; readonly error: ReviewArtifactParseError } | { readonly ok: true; readonly value: number } {
  const rawSchemaVersion = parsed["schemaVersion"];
  const schemaVersion = typeof rawSchemaVersion === "number" ? rawSchemaVersion : 0;
  if (schemaVersion > ARTIFACT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: {
        kind: "unsupported-schema-version",
        supportedVersion: ARTIFACT_SCHEMA_VERSION,
        unsupportedVersion: schemaVersion,
      },
    };
  }
  return { ok: true, value: schemaVersion };
}

function validateShapeIfV1(
  parsed: Record<string, unknown>,
  schemaVersion: number,
): ReviewArtifactParseResult {
  if (schemaVersion < 1) {
    return { ok: true, artifact: undefined as unknown as ParsedReviewArtifact };
  }
  const hasSummary = typeof parsed["summary"] === "string";
  const hasVerdict = typeof parsed["verdict"] === "string";
  const hasComments = parsed["comments"] !== undefined && parsed["comments"] !== null;
  if (hasSummary && hasVerdict && hasComments) {
    return { ok: true, artifact: undefined as unknown as ParsedReviewArtifact };
  }
  const missing = describeMissingShapeFields(hasSummary, hasVerdict, hasComments);
  return {
    ok: false,
    error: {
      kind: "invalid-shape",
      message: `v1 artifact missing required field(s):${missing}`,
    },
  };
}

function describeMissingShapeFields(hasSummary: boolean, hasVerdict: boolean, hasComments: boolean): string {
  const parts: string[] = [];
  if (!hasSummary) parts.push(" summary");
  if (!hasVerdict) parts.push(" verdict");
  if (!hasComments) parts.push(" comments");
  return parts.join("");
}

function buildLegacyArtifact(
  parsed: Record<string, unknown>,
  rawComments: readonly unknown[],
  rawSuppressed: readonly unknown[],
): ReviewArtifactParseResult {
  const comments: LegacyReviewComment[] = rawComments.map(readLegacyComment);
  const suppressedComments: LegacyReviewComment[] = rawSuppressed.map(readLegacyComment);
  return {
    ok: true,
    artifact: {
      schemaVersion: 0,
      summary: readStringField(parsed, "summary"),
      verdict: readStringField(parsed, "verdict"),
      comments,
      suppressedComments,
    },
  };
}

function buildDurableArtifact(
  parsed: Record<string, unknown>,
  rawComments: readonly unknown[],
  rawSuppressed: readonly unknown[],
): ReviewArtifactParseResult {
  const commentsResult = rawComments.map((c) => readDurableComment(c));
  const suppressedResult = rawSuppressed.map((c) => readDurableComment(c));
  for (const r of [...commentsResult, ...suppressedResult]) {
    if (!r.ok) return r;
  }
  return {
    ok: true,
    artifact: {
      schemaVersion: 1,
      summary: readStringField(parsed, "summary"),
      verdict: readStringField(parsed, "verdict"),
      comments: commentsResult.map((r) => (r as { ok: true; comment: DurableReviewComment }).comment),
      suppressedComments: suppressedResult.map((r) => (r as { ok: true; comment: DurableReviewComment }).comment),
    },
  };
}

function readStringField(parsed: Record<string, unknown>, key: string): string {
  return typeof parsed[key] === "string" ? (parsed[key] as string) : "";
}

// ---------------------------------------------------------------------------
// Serializer
// ---------------------------------------------------------------------------

/**
 * Serialize a DurableReviewArtifact to JSON. The output is parseable
 * by `parseReviewArtifact` (round-trip).
 */
export function serializeReviewArtifact(artifact: DurableReviewArtifact): string {
  return JSON.stringify(artifact, null, 2);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readArray(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) return [];
  return value;
}

function readString(value: unknown, key: string): string {
  const v = (value as Record<string, unknown>)[key];
  return typeof v === "string" ? v : "";
}

type ReadDurableResult =
  | { readonly ok: true; readonly comment: DurableReviewComment }
  | { readonly ok: false; readonly error: ReviewArtifactParseError };

function readDurableComment(raw: unknown): ReadDurableResult {
  if (!isRecord(raw)) {
    return {
      ok: false,
      error: { kind: "missing-fingerprint-fields", message: "comment is not an object" },
    };
  }

  const required: Array<keyof DurableFindingIdentity> = [
    "fingerprintVersion",
    "fingerprintDigest",
    "identityDigest",
    "canonicalPath",
    "anchorKind",
    "canonicalAnchor",
    "normalizedCategory",
    "normalizedRuleKey",
  ];

  for (const field of required) {
    if (raw[field] === undefined || raw[field] === null) {
      return {
        ok: false,
        error: {
          kind: "missing-fingerprint-fields",
          message: `comment is missing required fingerprint field "${String(field)}"`,
        },
      };
    }
  }

  const anchorKind = raw["anchorKind"];
  if (anchorKind !== "symbol" && anchorKind !== "hunk") {
    return {
      ok: false,
      error: {
        kind: "missing-fingerprint-fields",
        message: `anchorKind must be "symbol" or "hunk" (got "${String(anchorKind)}")`,
      },
    };
  }

  const comment: DurableReviewComment = {
    path: readString(raw, "path"),
    line: typeof raw["line"] === "number" ? raw["line"] : 0,
    body: readString(raw, "body"),
    severity: readString(raw, "severity"),
    category: readString(raw, "category"),
    fingerprintVersion: raw["fingerprintVersion"] as number,
    fingerprintDigest: raw["fingerprintDigest"] as string,
    identityDigest: raw["identityDigest"] as string,
    canonicalPath: raw["canonicalPath"] as string,
    anchorKind,
    canonicalAnchor: raw["canonicalAnchor"] as string,
    normalizedCategory: raw["normalizedCategory"] as string,
    normalizedRuleKey: raw["normalizedRuleKey"] as string,
    ...(raw["provenance"] !== undefined
      ? { provenance: raw["provenance"] as ReviewFindingProvenance }
      : {}),
    ...(raw["suggestion"] !== undefined
      ? { suggestion: raw["suggestion"] as string }
      : {}),
  };

  return { ok: true, comment };
}

function readLegacyComment(raw: unknown): LegacyReviewComment {
  if (!isRecord(raw)) {
    return { path: "", line: 0, body: "", severity: "", category: "" };
  }
  return {
    path: readString(raw, "path"),
    line: typeof raw["line"] === "number" ? raw["line"] : 0,
    body: readString(raw, "body"),
    severity: readString(raw, "severity"),
    category: readString(raw, "category"),
  };
}
