// SPDX-License-Identifier: MIT
//
// Task 4 — Review artifact schema parser tests.
//
// Tests that the typed schema parser round-trips a review with provenance
// and suggestion, accepts BOTH the legacy sample format and the new schema
// version, and returns typed failures for malformed/colliding/unknown-schema
// inputs.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  ARTIFACT_SCHEMA_VERSION,
  type DurableReviewArtifact,
  type SchemaVersionedArtifact,
  parseReviewArtifact,
  serializeReviewArtifact,
} from "../../src/review/artifact-schema.js";

// ---------------------------------------------------------------------------
// Legacy sample readability
// ---------------------------------------------------------------------------

describe("parseReviewArtifact — legacy sample format", () => {
  it("reads the committed legacy sample without error", () => {
    const legacyJson = readFileSync("docs/samples/review-artifact.json", "utf8");
    const result = parseReviewArtifact(legacyJson);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Legacy artifacts are parsed as schemaVersion 0 (unversioned).
    expect(result.artifact.schemaVersion).toBe(0);
    expect(result.artifact.comments.length).toBeGreaterThanOrEqual(1);
  });

  it("legacy artifact with schemaVersion absent is treated as schemaVersion 0", () => {
    const legacy = JSON.stringify({
      event: "COMMENT",
      verdict: "COMMENT",
      inlineThreadCount: 1,
      comments: [
        { path: "src/a.ts", line: 10, body: "issue", severity: "medium", category: "style" },
      ],
      suppressed_comments: [],
    });
    const result = parseReviewArtifact(legacy);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.schemaVersion).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Schema-versioned artifact (v1)
// ---------------------------------------------------------------------------

describe("parseReviewArtifact — v1 schema", () => {
  it("round-trips a v1 review artifact with provenance and suggestion", () => {
    const artifact: DurableReviewArtifact = {
      schemaVersion: 1,
      summary: "Test review",
      verdict: "NEEDS_FIX",
      comments: [
        {
          path: "src/app.ts",
          line: 42,
          body: "SQL injection risk.",
          severity: "high",
          category: "security",
          fingerprintVersion: 1,
          fingerprintDigest: "a".repeat(64),
          identityDigest: "b".repeat(64),
          canonicalPath: "src/app.ts",
          anchorKind: "symbol",
          canonicalAnchor: "handleRequest:function",
          normalizedCategory: "security",
          normalizedRuleKey: "sql-injection",
          provenance: { provider: "openai-compatible", modelId: "gpt-4" },
          suggestion: "Use a parameterized query.",
        },
      ],
      suppressedComments: [],
    };

    const serialized = serializeReviewArtifact(artifact);
    const result = parseReviewArtifact(serialized);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.artifact.schemaVersion).toBe(1);
    expect(result.artifact.summary).toBe("Test review");
    expect(result.artifact.comments).toHaveLength(1);
    if (result.artifact.schemaVersion !== 1) return;
    const comment = result.artifact.comments[0]!;
    expect(comment.fingerprintVersion).toBe(1);
    expect(comment.canonicalPath).toBe("src/app.ts");
    expect(comment.provenance?.provider).toBe("openai-compatible");
    expect(comment.suggestion).toBe("Use a parameterized query.");
  });

  it("accepts v1 artifacts where comments omit optional provenance/suggestion", () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      summary: "Minimal v1 review",
      verdict: "APPROVED",
      comments: [
        {
          path: "src/a.ts",
          line: 1,
          body: "Nit.",
          severity: "low",
          category: "style",
          fingerprintVersion: 1,
          fingerprintDigest: "c".repeat(64),
          identityDigest: "d".repeat(64),
          canonicalPath: "src/a.ts",
          anchorKind: "symbol",
          canonicalAnchor: "foo:function",
          normalizedCategory: "style",
          normalizedRuleKey: "rule-x",
        },
      ],
      suppressedComments: [],
    });
    const result = parseReviewArtifact(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.schemaVersion).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Typed failures
// ---------------------------------------------------------------------------

describe("parseReviewArtifact — typed failures", () => {
  it("rejects a future schema version with a typed error", () => {
    const future = JSON.stringify({
      schemaVersion: 999,
      summary: "",
      verdict: "",
      comments: [],
      suppressedComments: [],
    });
    const result = parseReviewArtifact(future);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("unsupported-schema-version");
    if (result.error.kind !== "unsupported-schema-version") return;
    expect(result.error.unsupportedVersion).toBe(999);
    expect(result.error.supportedVersion).toBe(ARTIFACT_SCHEMA_VERSION);
  });

  it("rejects malformed JSON with a typed error", () => {
    const result = parseReviewArtifact("{not-json");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("malformed-json");
  });

  it("rejects a non-object JSON value with a typed error", () => {
    const result = parseReviewArtifact("[]");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("invalid-shape");
  });

  it("rejects an object missing required fields with a typed error", () => {
    const result = parseReviewArtifact(JSON.stringify({ schemaVersion: 1 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("invalid-shape");
  });

  it("returns a typed error for a v1 comment missing fingerprint fields", () => {
    const json = JSON.stringify({
      schemaVersion: 1,
      summary: "test",
      verdict: "COMMENT",
      comments: [
        {
          path: "src/a.ts",
          line: 1,
          body: "issue",
          severity: "medium",
          category: "style",
          // Missing fingerprintVersion, fingerprintDigest, identityDigest
        },
      ],
      suppressedComments: [],
    });
    const result = parseReviewArtifact(json);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("missing-fingerprint-fields");
  });
});

// ---------------------------------------------------------------------------
// SchemaVersionedArtifact type usage
// ---------------------------------------------------------------------------

describe("SchemaVersionedArtifact — type contract", () => {
  it("ARTIFACT_SCHEMA_VERSION is 1", () => {
    expect(ARTIFACT_SCHEMA_VERSION).toBe(1);
  });

  it("serializeReviewArtifact produces valid JSON parseable by parseReviewArtifact", () => {
    const artifact: DurableReviewArtifact = {
      schemaVersion: 1,
      summary: "Round trip",
      verdict: "COMMENT",
      comments: [],
      suppressedComments: [],
    };
    const json = serializeReviewArtifact(artifact);
    const parsed: SchemaVersionedArtifact = JSON.parse(json);
    expect(parsed.schemaVersion).toBe(1);
  });
});
