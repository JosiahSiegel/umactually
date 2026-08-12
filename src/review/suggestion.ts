// SPDX-License-Identifier: MIT
//
// Task 12 — Validated developer-controlled suggestions + agent-ready
// remediation instructions WITHOUT auto-commit.
//
// This module is the single owner of:
//   1. validateSuggestion — the defensive validator that runs path,
//      side, range, original-content hash, diff anchoring, size,
//      secret scan, generated-file exclusion, binary, and multiline
//      boundary checks BEFORE marking a suggestion valid.
//   2. RemediationInstruction — the structured { schemaVersion, objective,
//      targetPath, targetAnchor, constraints[], verificationCommands[] }
//      schema, with 8 KiB total serialized cap, per-string sanitization,
//      closed-set constraints, allowlisted verification commands.
//
// Hard contract (enforced by tests + downstream boundary):
//   - `validatedSuggestion` is rendered to GitHub suggestion fences or
//     Azure suggestion representation ONLY when validation passes.
//   - `remediationInstruction` (including verificationCommands[]) is
//     serialized ONLY to the sanitized JSON/review artifact and NEVER
//     to any platform comment body.
//   - Each string in both structures is sanitized.
//   - targetPath/anchor must already exist in the durable finding.
//   - constraints are selected from a closed policy/context provenance
//     label set.
//   - verification commands come ONLY from an allowlisted repository-
//     policy list.
//   - Total serialized RemediationInstruction size capped at 8 KiB.
//   - NO raw context/source/prompt is copied into either structure.
//   - The module NEVER emits free-form agent prompt text, runs git
//     apply/commit/push, creates PRs, or requests contents write.

import { createHash } from "node:crypto";

import type { DiffPositionIndex } from "../diff/parse-positions.js";
import { isBuildArtifactPath } from "../diff/filter-build-artifacts.js";
import { replaceSecretsLiterally } from "../util/redact.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Total serialized size cap for a RemediationInstruction (8 KiB). */
export const MAX_REMEDIATION_SIZE_BYTES = 8192 as const;

/** Schema version for RemediationInstruction. */
export const REMEDIATION_INSTRUCTION_SCHEMA_VERSION = 1 as const;

/**
 * Closed set of allowed constraint labels. Constraints are selected
 * from policy/context provenance labels — operators can extend the
 * policy file, but every wire value MUST be on this allowlist so a
 * provider prompt cannot inject arbitrary constraint text.
 */
export const ALLOWED_CONSTRAINT_LABELS: readonly string[] = Object.freeze([
  "policy:style",
  "policy:security",
  "policy:performance",
  "policy:correctness",
  "policy:maintainability",
  "policy:tests",
  "policy:documentation",
  "context:provenance",
  "context:diff-anchor",
]);

/**
 * Closed allowlist of verification commands. These are the ONLY commands
 * that may appear in `verificationCommands[]`. They come from a
 * repository-policy allowlist (hard-coded here) — a provider prompt
 * cannot inject arbitrary shell commands.
 *
 * The list intentionally contains only safe, read-only repository
 * validation commands. No git mutation, no network egress, no file
 * writes.
 */
export const ALLOWED_VERIFICATION_COMMANDS: readonly string[] = Object.freeze([
  "npm test",
  "npm run typecheck",
  "npm run lint",
  "npm run build",
  "npm run test:unit",
  "npm run test:scenario",
  "npm run test:e2e",
  "npm run check:dist-freshness",
  "npm run render-docs:check",
  "npm run check:version-alignment",
]);

/**
 * High-confidence secret patterns for replacement scanning. Mirrors
 * the patterns in `src/security/scan-review-secrets.ts` so a secret-
 * shaped literal in a suggestion replacement is caught here BEFORE it
 * can reach the platform comment body. A separate copy (rather than an
 * import) keeps this module's validation pure — it does not depend on
 * the async scanner's artifact-path contract.
 */
const SECRET_PATTERNS: readonly RegExp[] = [
  /\bsk_test_[a-z_]+\b/u,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u,
  /\bghp_[A-Za-z0-9]{36}\b/u,
  /\bgithub_pat_\w{82}\b/u,
  /\bxox[baprs]-[A-Za-z0-9-]+\b/u,
  /\b-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/u,
];

// ---------------------------------------------------------------------------
// Types — ValidatedSuggestion
// ---------------------------------------------------------------------------

/**
 * Raw suggestion payload from the provider. This is UNVALIDATED — every
 * field must pass through `validateSuggestion` before it can be used.
 * The `originalTextHash` is a SHA-256 hex of the exact original line
 * text the replacement targets, preventing stale-hash attacks.
 */
export type RawSuggestion = {
  /** The proposed replacement text. */
  readonly replacement: string;
  /** SHA-256 hex of the exact original text at (path, line..endLine). */
  readonly originalTextHash: string;
  /** Optional end line for multi-line suggestions (inclusive). */
  readonly endLine?: number;
};

/**
 * The validated, sanitized suggestion — the only shape that may be
 * rendered to a platform suggestion surface (GitHub fence or Azure
 * representation). Produced exclusively by `validateSuggestion`.
 */
export type ValidatedSuggestion = {
  /** Repository-relative path (validated to exist in the diff). */
  readonly path: string;
  /** Start line (1-based, validated against diff positions). */
  readonly line: number;
  /** End line (inclusive, defaults to line for single-line). */
  readonly endLine: number;
  /** Diff side — always RIGHT for suggestions on the new version. */
  readonly side: "RIGHT";
  /** Sanitized replacement text (secrets redacted). */
  readonly replacement: string;
  /** SHA-256 hex of the original text (for anchoring). */
  readonly originalTextHash: string;
};

// ---------------------------------------------------------------------------
// Types — RemediationInstruction
// ---------------------------------------------------------------------------

/**
 * Structured, bounded remediation data — NOT provider prompt text.
 * Each string is sanitized; constraints come from a closed provenance
 * label set; verification commands come from an allowlisted repository-
 * policy list. Serialized ONLY to the JSON/review artifact.
 */
export type RemediationInstruction = {
  readonly schemaVersion: typeof REMEDIATION_INSTRUCTION_SCHEMA_VERSION;
  readonly objective: string;
  readonly targetPath: string;
  readonly targetAnchor: string;
  readonly constraints: readonly string[];
  readonly verificationCommands: readonly string[];
};

// ---------------------------------------------------------------------------
// Types — typed rejection
// ---------------------------------------------------------------------------

export type SuggestionRejectionKind =
  | "malformed-input"
  | "stale-hash"
  | "off-diff-line"
  | "range-mismatch"
  | "multiline-boundary-escape"
  | "generated-file"
  | "oversized"
  | "binary"
  | "secret-bearing";

export type SuggestionRejection = {
  readonly kind: SuggestionRejectionKind;
  readonly message: string;
};

export type RemediationErrorKind =
  | "malformed-input"
  | "invalid-objective"
  | "invalid-constraint"
  | "invalid-verification-command"
  | "secret-detected"
  | "oversized";

export type RemediationError = {
  readonly kind: RemediationErrorKind;
  readonly message: string;
};

export type ValidateSuggestionResult = {
  readonly validated?: ValidatedSuggestion;
  readonly rejection?: SuggestionRejection;
};

export type BuildRemediationResult =
  | { readonly ok: true; readonly instruction: RemediationInstruction }
  | { readonly ok: false; readonly error: RemediationError };

export type ValidateRemediationInputResult =
  | { readonly ok: true; readonly input: RemediationBuildInput }
  | { readonly ok: false; readonly error: RemediationError };

/** Input shape for building a RemediationInstruction (pre-validation). */
export type RemediationBuildInput = {
  readonly objective: string;
  readonly targetPath: string;
  readonly targetAnchor: string;
  readonly constraints: readonly string[];
  readonly verificationCommands: readonly string[];
};

// ---------------------------------------------------------------------------
// validateSuggestion
// ---------------------------------------------------------------------------

/**
 * Defensive validator for a raw provider suggestion. Runs ALL of these
 * checks BEFORE marking the suggestion valid:
 *
 *   1. malformed-input: rawSuggestion present, replacement non-empty,
 *      originalTextHash non-empty.
 *   2. generated-file: path must NOT match build-artifact / generated
 *      patterns (dist/, build/, *.min.js, lockfiles, etc.).
 *   3. off-diff-line: (path, line) must exist in the diff position index.
 *   4. range-mismatch: when endLine is provided, endLine >= line.
 *   5. stale-hash: SHA-256 of originalLineText must match originalTextHash.
 *   6. multiline-boundary-escape: replacement must not contain ``` (the
 *      markdown fence closer) which would escape the suggestion block.
 *   7. binary: replacement must not contain null bytes or other control
 *      characters characteristic of binary content.
 *   8. oversized: replacement must not exceed the 8 KiB cap.
 *   9. secret-bearing: replacement must not contain high-confidence
 *      secret patterns.
 *
 * The replacement is sanitized (secrets redacted via the shared scanner)
 * in the returned ValidatedSuggestion so downstream rendering never
 * leaks a secret through the suggestion body.
 */
export function validateSuggestion(input: {
  readonly rawSuggestion: RawSuggestion | undefined | null;
  readonly path: string;
  readonly line: number;
  readonly diffPositions: DiffPositionIndex;
  readonly originalLineText: string;
}): ValidateSuggestionResult {
  const { rawSuggestion, path, line, diffPositions, originalLineText } = input;

  // 1. Malformed input.
  if (rawSuggestion === undefined || rawSuggestion === null) {
    return reject("malformed-input", "suggestion is absent");
  }
  if (typeof rawSuggestion.replacement !== "string" || rawSuggestion.replacement.length === 0) {
    return reject("malformed-input", "replacement must be a non-empty string");
  }
  if (typeof rawSuggestion.originalTextHash !== "string" || rawSuggestion.originalTextHash.length === 0) {
    return reject("malformed-input", "originalTextHash must be a non-empty string");
  }

  // 2. Generated-file exclusion.
  if (isBuildArtifactPath(path)) {
    return reject("generated-file", `suggestion targets a generated/build-artifact path: ${path}`);
  }

  // 3. Off-diff line.
  if (!diffPositions.hasPosition({ path, line })) {
    return reject("off-diff-line", `suggestion anchor ${path}:${line} is not in the diff`);
  }

  // 4. Range mismatch.
  const endLine = rawSuggestion.endLine ?? line;
  if (endLine < line) {
    return reject("range-mismatch", `endLine (${endLine}) < line (${line})`);
  }

  // 5. Stale hash.
  const computedHash = sha256Hex(originalLineText);
  if (computedHash !== rawSuggestion.originalTextHash) {
    return reject("stale-hash", "originalTextHash does not match the actual line content");
  }

  // 6. Multiline boundary escape — replacement must not contain a
  //    closing fence that would break out of the suggestion block.
  if (rawSuggestion.replacement.includes("```")) {
    return reject("multiline-boundary-escape", "replacement contains a markdown fence delimiter");
  }

  // 7. Binary — reject null bytes or a high concentration of control
  //    characters (a strong signal of binary content, not source code).
  if (containsBinaryContent(rawSuggestion.replacement)) {
    return reject("binary", "replacement contains binary/control characters");
  }

  // 8. Oversized.
  if (rawSuggestion.replacement.length > MAX_REMEDIATION_SIZE_BYTES) {
    return reject("oversized", `replacement exceeds ${MAX_REMEDIATION_SIZE_BYTES} bytes`);
  }

  // 9. Secret-bearing.
  if (containsSecret(rawSuggestion.replacement)) {
    return reject("secret-bearing", "replacement contains a high-confidence secret pattern");
  }

  // All checks passed — sanitize and return.
  const sanitizedReplacement = sanitizeSuggestionText(rawSuggestion.replacement);

  return {
    validated: {
      path,
      line,
      endLine,
      side: "RIGHT",
      replacement: sanitizedReplacement,
      originalTextHash: rawSuggestion.originalTextHash,
    },
  };
}

// ---------------------------------------------------------------------------
// buildRemediationInstruction
// ---------------------------------------------------------------------------

/**
 * Build a validated RemediationInstruction from typed input. Every
 * string is sanitized; constraints must be on the closed allowlist;
 * verification commands must be on the allowlisted repository-policy
 * list; total serialized size must be <= 8 KiB.
 *
 * Returns `{ ok: false, error }` with a typed error kind on any
 * violation — the caller decides how to surface (typically: serialize
 * the typed error into the artifact, keep the explanatory finding).
 */
export function buildRemediationInstruction(
  input: RemediationBuildInput,
): BuildRemediationResult {
  // Objective.
  if (typeof input.objective !== "string" || input.objective.length === 0) {
    return remediationFail("invalid-objective", "objective must be a non-empty string");
  }

  // targetPath / targetAnchor — must be non-empty strings. The caller
  // (pipeline boundary) MUST verify they exist in the durable finding
  // BEFORE calling this builder; this function only checks structural
  // validity (non-empty, no secret).
  if (typeof input.targetPath !== "string" || input.targetPath.length === 0) {
    return remediationFail("invalid-objective", "targetPath must be a non-empty string");
  }
  if (typeof input.targetAnchor !== "string" || input.targetAnchor.length === 0) {
    return remediationFail("invalid-objective", "targetAnchor must be a non-empty string");
  }

  // Constraints — closed set.
  if (!Array.isArray(input.constraints)) {
    return remediationFail("invalid-constraint", "constraints must be an array");
  }
  for (const c of input.constraints) {
    if (typeof c !== "string" || !ALLOWED_CONSTRAINT_LABELS.includes(c)) {
      return remediationFail("invalid-constraint", `constraint "${String(c)}" is not on the allowlist`);
    }
  }

  // Verification commands — allowlist.
  if (!Array.isArray(input.verificationCommands)) {
    return remediationFail("invalid-verification-command", "verificationCommands must be an array");
  }
  for (const v of input.verificationCommands) {
    if (typeof v !== "string" || !ALLOWED_VERIFICATION_COMMANDS.includes(v)) {
      return remediationFail("invalid-verification-command", `verification command "${String(v)}" is not on the allowlist`);
    }
  }

  // Secret scan over every string field.
  const allStrings: readonly string[] = [
    input.objective,
    input.targetPath,
    input.targetAnchor,
    ...input.constraints,
    ...input.verificationCommands,
  ];
  for (const s of allStrings) {
    if (containsSecret(s)) {
      return remediationFail("secret-detected", "a RemediationInstruction string contains a secret-shaped literal");
    }
  }

  // Sanitize every string.
  const instruction: RemediationInstruction = {
    schemaVersion: REMEDIATION_INSTRUCTION_SCHEMA_VERSION,
    objective: sanitizeSuggestionText(input.objective),
    targetPath: sanitizeSuggestionText(input.targetPath),
    targetAnchor: sanitizeSuggestionText(input.targetAnchor),
    constraints: input.constraints.map(sanitizeSuggestionText),
    verificationCommands: input.verificationCommands.map(sanitizeSuggestionText),
  };

  // Size cap — check the serialized size.
  const serialized = serializeRemediationInstruction(instruction);
  if (serialized.length > MAX_REMEDIATION_SIZE_BYTES) {
    return remediationFail("oversized", `serialized RemediationInstruction exceeds ${MAX_REMEDIATION_SIZE_BYTES} bytes`);
  }

  return { ok: true, instruction };
}

// ---------------------------------------------------------------------------
// validateRemediationInput — defensive parse from unknown
// ---------------------------------------------------------------------------

/**
 * Parse an unknown raw value into a typed RemediationBuildInput. Used
 * at the boundary where untrusted provider output first enters the
 * remediation pipeline. Returns a typed error on any structural issue.
 */
export function validateRemediationInput(raw: unknown): ValidateRemediationInputResult {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return remediationInputFail("malformed-input", "remediation input must be an object");
  }
  const obj = raw as Record<string, unknown>;
  const objective = obj["objective"];
  const targetPath = obj["targetPath"];
  const targetAnchor = obj["targetAnchor"];
  const constraints = obj["constraints"];
  const verificationCommands = obj["verificationCommands"];

  if (typeof objective !== "string" || typeof targetPath !== "string" || typeof targetAnchor !== "string") {
    return remediationInputFail("malformed-input", "objective, targetPath, targetAnchor must be strings");
  }
  if (constraints !== undefined && !Array.isArray(constraints)) {
    return remediationInputFail("malformed-input", "constraints must be an array");
  }
  if (verificationCommands !== undefined && !Array.isArray(verificationCommands)) {
    return remediationInputFail("malformed-input", "verificationCommands must be an array");
  }

  return {
    ok: true,
    input: {
      objective,
      targetPath,
      targetAnchor,
      constraints: Array.isArray(constraints) ? (constraints as unknown[]).filter((v): v is string => typeof v === "string") : [],
      verificationCommands: Array.isArray(verificationCommands) ? (verificationCommands as unknown[]).filter((v): v is string => typeof v === "string") : [],
    },
  };
}

// ---------------------------------------------------------------------------
// serializeRemediationInstruction
// ---------------------------------------------------------------------------

/**
 * Deterministic serialization of a RemediationInstruction for the JSON
 * artifact. Keys are in fixed order; secrets were already sanitized at
 * build time. The output MUST stay under MAX_REMEDIATION_SIZE_BYTES.
 */
export function serializeRemediationInstruction(instruction: RemediationInstruction): string {
  const ordered: Record<string, unknown> = {
    schemaVersion: instruction.schemaVersion,
    objective: instruction.objective,
    targetPath: instruction.targetPath,
    targetAnchor: instruction.targetAnchor,
    constraints: instruction.constraints,
    verificationCommands: instruction.verificationCommands,
  };
  return JSON.stringify(ordered);
}

// ---------------------------------------------------------------------------
// Rendering — GitHub suggestion fence
// ---------------------------------------------------------------------------

/**
 * Render a validated suggestion as a GitHub suggestion fence. The
 * GitHub native suggestion block uses ```suggestion … ``` so a reviewer
 * can click "Commit suggestion" directly. ONLY a ValidatedSuggestion
 * (produced by `validateSuggestion`) may be passed here.
 *
 * Contract:
 *   - Opens with ```suggestion and closes with ```.
 *   - No remediationInstruction content is ever included.
 *   - The replacement was already sanitized at validation time.
 */
export function renderGithubSuggestionFence(suggestion: ValidatedSuggestion): string {
  return "```suggestion\n" + suggestion.replacement + "\n```";
}

// ---------------------------------------------------------------------------
// Rendering — Azure suggestion representation
// ---------------------------------------------------------------------------

/**
 * Render a validated suggestion for Azure DevOps. Azure DevOps does not
 * have a native "suggestion" button like GitHub, but it DOES support
 * the same ```suggestion markdown fence inside inline thread comments
 * (rendered as a code block with the suggested text). The thread's
 * `threadContext` (filePath + rightFileStart/end) carries the anchor,
 * not the body — so the body just needs the fence.
 *
 * Contract: same as the GitHub fence — no remediationInstruction content.
 */
export function renderAzureSuggestionBlock(suggestion: ValidatedSuggestion): string {
  return "```suggestion\n" + suggestion.replacement + "\n```";
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function reject(kind: SuggestionRejectionKind, message: string): ValidateSuggestionResult {
  return { rejection: { kind, message } };
}

function remediationFail(kind: RemediationErrorKind, message: string): BuildRemediationResult {
  return { ok: false, error: { kind, message } };
}

function remediationInputFail(kind: RemediationErrorKind, message: string): ValidateRemediationInputResult {
  return { ok: false, error: { kind, message } };
}

function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Detect binary content: null bytes or a high ratio of control
 * characters. Source-code replacements should contain only printable
 * ASCII/UTF-8, whitespace, and standard line endings.
 */
function containsBinaryContent(text: string): boolean {
  if (text.includes("\x00")) return true;
  // Count control characters (excluding common whitespace: \t \n \r).
  let controlCount = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? -1;
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) {
      controlCount += 1;
    }
    if (code === 0x7f) {
      controlCount += 1;
    }
  }
  // Binary if >10% control characters and at least 2.
  return controlCount >= 2 && controlCount / text.length > 0.1;
}

/**
 * Scan text for high-confidence secret patterns. Mirrors the patterns
 * in `src/security/scan-review-secrets.ts`.
 */
function containsSecret(text: string): boolean {
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  return false;
}

/**
 * Sanitize suggestion/remediation text. Redacts any literal secret
 * patterns with the canonical REDACTED token. The `secrets` array
 * (per-run known secrets) is empty here because suggestion validation
 * is a pre-posting boundary — the platform-specific secrets list is
 * applied later by `sanitizeForPost` in the renderer.
 */
function sanitizeSuggestionText(text: string): string {
  // Redact high-confidence secret patterns with the REDACTED token.
  let out = text;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`), "REDACTED");
  }
  // Also run through the literal replace with an empty secrets list —
  // identity when no per-run secrets are known.
  return replaceSecretsLiterally(out, []);
}
