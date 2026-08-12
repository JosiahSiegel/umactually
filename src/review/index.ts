// SPDX-License-Identifier: MIT
//
// Task 4 — Barrel re-export for the durable finding + artifact contract.
//
// All downstream consumers (provider-parse, filters, renderers, platform
// adapters, evals, artifacts) import from this single entry point so the
// schema-versioned contract has one canonical surface.

export {
  FingerprintCollisionError,
  assertNoFingerprintCollision,
  computeDurableFindingIdentity,
  computeHunkAnchor,
  normalizeCanonicalPath,
  normalizeCategory,
  normalizeRuleKey,
  serializeCanonicalFields,
} from "./fingerprint.js";

export type {
  CanonicalFindingInput,
  DurableFindingIdentity,
  FindingForCollisionCheck,
  PathRewrite,
} from "./fingerprint.js";

export {
  ARTIFACT_SCHEMA_VERSION,
  parseReviewArtifact,
  serializeReviewArtifact,
} from "./artifact-schema.js";

export type {
  DurableReviewArtifact,
  DurableReviewComment,
  LegacyReviewArtifact,
  LegacyReviewComment,
  ParsedReviewArtifact,
  ReviewArtifactParseError,
  ReviewArtifactParseResult,
  ReviewFindingProvenance,
  SchemaVersionedArtifact,
} from "./artifact-schema.js";
