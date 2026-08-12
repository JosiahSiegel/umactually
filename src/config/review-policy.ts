// SPDX-License-Identifier: MIT
// Committed review-policy as code: `umactually.review.json`.
//
// This is the committed team-policy surface — separate from
// `umactually.config.json` (provider connection defaults) and from the
// CLI flag / env var surfaces. The provider connection config is a
// separate security boundary; policy fields MUST NOT mix into the
// provider config serialization.
//
// Resolution order (4-tier precedence):
//   1. CLI flags                 → source = "flag"
//   2. Env vars (where public)   → source = "env"
//   3. Committed review policy   → source = "reviewPolicy"
//   4. Built-in defaults         → source = "default"
//
// Every resolved field carries provenance: source, path (when from a
// file), hash (the sha256 of the canonical serialized policy bytes),
// and version (the policy's schemaVersion).
//
// Strict validation BEFORE any provider/platform call. Order:
//   schema-version → schema-shape → glob/path safety → secret scan →
//   semantic conflicts.
//
// Unknown keys, duplicate/conflicting path rules, invalid globs,
// unsafe paths, secrets, and unsupported versions all fail with typed
// errors and exit code 2 BEFORE any fetch/post and create NO files.

import { join } from "node:path";
import { createHash } from "node:crypto";
import {
  defaultFsAdapter,
  type FsAdapter,
} from "../util/fs-atomic.js";
import { SECRET_REGEX } from "./saved-config.js";
import { REDACTED } from "./errors.js";

// ---------------------------------------------------------------------------
// Schema version
// ---------------------------------------------------------------------------

export const REVIEW_POLICY_SCHEMA_VERSION = 1 as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Effort = "low" | "medium" | "high";
export type Trigger = "opened" | "synchronize" | "reopened";
export type MinimumSeverity = "info" | "warning" | "error";
export type SuggestionMode = "off" | "validated";
export type GateMode = "off" | "warn" | "block";

export type PathRule = {
  readonly pattern: string;
  readonly effort?: Effort;
};

export type Budgets = {
  readonly contextTokens: number | null;
  readonly maxOutputTokens: number | null;
  readonly latencyMs: number | null;
};

export type ReviewPolicy = {
  readonly schemaVersion: typeof REVIEW_POLICY_SCHEMA_VERSION;
  readonly pathRules?: readonly PathRule[];
  readonly excludes?: readonly string[];
  readonly effort?: Effort;
  readonly triggers?: readonly Trigger[];
  readonly reReviewCap?: number;
  readonly budgets?: Budgets;
  readonly minimumSeverity?: MinimumSeverity;
  readonly suggestionMode?: SuggestionMode;
  readonly gateMode?: GateMode;
};

// ---------------------------------------------------------------------------
// Allowed keys (for unknown-key rejection)
// ---------------------------------------------------------------------------

const ALLOWED_TOP_LEVEL_KEYS: ReadonlySet<string> = new Set([
  "schemaVersion",
  "pathRules",
  "excludes",
  "effort",
  "triggers",
  "reReviewCap",
  "budgets",
  "minimumSeverity",
  "suggestionMode",
  "gateMode",
]);

const ALLOWED_PATH_RULE_KEYS: ReadonlySet<string> = new Set([
  "pattern",
  "effort",
]);

const ALLOWED_BUDGET_KEYS: ReadonlySet<string> = new Set([
  "contextTokens",
  "maxOutputTokens",
  "latencyMs",
]);

const VALID_EFFORTS: ReadonlySet<string> = new Set(["low", "medium", "high"]);
const VALID_TRIGGERS: ReadonlySet<string> = new Set(["opened", "synchronize", "reopened"]);
const VALID_MINIMUM_SEVERITIES: ReadonlySet<string> = new Set(["info", "warning", "error"]);
const VALID_SUGGESTION_MODES: ReadonlySet<string> = new Set(["off", "validated"]);
const VALID_GATE_MODES: ReadonlySet<string> = new Set(["off", "warn", "block"]);

// ---------------------------------------------------------------------------
// Path
// ---------------------------------------------------------------------------

export const REVIEW_POLICY_PATH = (cwd: string): string =>
  join(cwd, "umactually.review.json");

// ---------------------------------------------------------------------------
// Typed error
// ---------------------------------------------------------------------------

export type ReviewPolicyErrorKind =
  | "unsupported-schema-version"
  | "missing-schema-version"
  | "unknown-key"
  | "invalid-effort"
  | "invalid-trigger"
  | "invalid-minimum-severity"
  | "invalid-suggestion-mode"
  | "invalid-gate-mode"
  | "invalid-re-review-cap"
  | "invalid-budget"
  | "invalid-glob"
  | "unsafe-path"
  | "duplicate-path-rule"
  | "secret-detected"
  | "corrupt-json"
  | "invalid-type";

export type ReviewPolicyError = {
  readonly kind: ReviewPolicyErrorKind;
  readonly message: string;
};

export type ValidateReviewPolicyResult =
  | { readonly ok: true; readonly policy: ReviewPolicy }
  | { readonly ok: false; readonly error: ReviewPolicyError; readonly exitCode: 2; readonly message: string };

// ---------------------------------------------------------------------------
// Built-in defaults
// ---------------------------------------------------------------------------

export const DEFAULT_REVIEW_POLICY: ReviewPolicy = Object.freeze({
  schemaVersion: REVIEW_POLICY_SCHEMA_VERSION,
  pathRules: Object.freeze([]) as readonly PathRule[],
  excludes: Object.freeze([]) as readonly string[],
  effort: "medium",
  triggers: Object.freeze(["opened", "synchronize", "reopened"]) as readonly Trigger[],
  reReviewCap: 0,
  budgets: Object.freeze({ contextTokens: null, maxOutputTokens: null, latencyMs: null }),
  minimumSeverity: "warning",
  suggestionMode: "off",
  gateMode: "off",
});

// ---------------------------------------------------------------------------
// Glob validation (without compiling — structural check only)
// ---------------------------------------------------------------------------

function isValidGlob(pattern: string): boolean {
  if (typeof pattern !== "string" || pattern.length === 0) return false;
  let braces = 0;
  let brackets = 0;
  let parens = 0;
  for (const ch of pattern) {
    braces = updateBraceCount(ch, braces);
    brackets = updateBracketCount(ch, brackets);
    parens = updateParenCount(ch, parens);
    if (areAnyCountersNegative(braces, brackets, parens)) return false;
  }
  return braces === 0 && brackets === 0 && parens === 0;
}

function updateBraceCount(ch: string, count: number): number {
  if (ch === "{") return count + 1;
  if (ch === "}") return count - 1;
  return count;
}

function updateBracketCount(ch: string, count: number): number {
  if (ch === "[") return count + 1;
  if (ch === "]") return count - 1;
  return count;
}

function updateParenCount(ch: string, count: number): number {
  if (ch === "(") return count + 1;
  if (ch === ")") return count - 1;
  return count;
}

function areAnyCountersNegative(braces: number, brackets: number, parens: number): boolean {
  return braces < 0 || brackets < 0 || parens < 0;
}

function isUnsafePath(pattern: string): boolean {
  if (pattern.startsWith("/")) return true;
  if (/^[A-Za-z]:[\\/]/.test(pattern)) return true;
  const segments = pattern.split(/[\\/]/);
  if (segments.includes("..")) return true;
  return false;
}

function containsSecret(value: string): boolean {
  if (typeof value !== "string") return false;
  const result = SECRET_REGEX.test(value);
  SECRET_REGEX.lastIndex = 0;
  return result;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export function validateReviewPolicy(
  raw: unknown,
  filePath: string,
): ValidateReviewPolicyResult {
  const steps = [
    validateShape,
    validateSchemaVersion,
    validateAllowedKeys,
    validateSecretScan,
    validateEnumAndTypeFields,
    validatePathSafetyAndGlobs,
    validateSecretScanPatterns,
  ];
  for (const step of steps) {
    const result = step(raw, filePath);
    if (!result.ok) return result;
  }
  const policy = buildPolicy(raw as Record<string, unknown>);
  return { ok: true, policy };
}

function validateShape(raw: unknown, filePath: string): ValidateReviewPolicyResult {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return fail("invalid-type", `policy at ${filePath}: expected object, received ${raw === null ? "null" : Array.isArray(raw) ? "array" : typeof raw}`);
  }
  return { ok: true, policy: DEFAULT_REVIEW_POLICY };
}

function validateSchemaVersion(raw: unknown, filePath: string): ValidateReviewPolicyResult {
  const obj = raw as Record<string, unknown>;
  if (obj["schemaVersion"] === undefined) {
    return fail("missing-schema-version", `policy at ${filePath}: missing required field "schemaVersion"`);
  }
  if (typeof obj["schemaVersion"] !== "number" || !Number.isInteger(obj["schemaVersion"])) {
    return fail("unsupported-schema-version", `policy at ${filePath}: schemaVersion must be an integer, received ${REDACTED}`);
  }
  if (obj["schemaVersion"] !== REVIEW_POLICY_SCHEMA_VERSION) {
    return fail("unsupported-schema-version", `policy at ${filePath}: unsupported schemaVersion ${obj["schemaVersion"]} (expected ${REVIEW_POLICY_SCHEMA_VERSION})`);
  }
  return { ok: true, policy: DEFAULT_REVIEW_POLICY };
}

function validateAllowedKeys(raw: unknown, filePath: string): ValidateReviewPolicyResult {
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!ALLOWED_TOP_LEVEL_KEYS.has(key)) {
      return fail("unknown-key", `policy at ${filePath}: unknown key "${key}"`);
    }
  }
  return { ok: true, policy: DEFAULT_REVIEW_POLICY };
}

function validateSecretScan(raw: unknown, filePath: string): ValidateReviewPolicyResult {
  const obj = raw as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string" && containsSecret(value)) {
      return fail("secret-detected", `policy at ${filePath}: secret-shaped value detected in field "${key}"`);
    }
  }
  return { ok: true, policy: DEFAULT_REVIEW_POLICY };
}

function validateEnumAndTypeFields(raw: unknown, filePath: string): ValidateReviewPolicyResult {
  const obj = raw as Record<string, unknown>;

  const effortResult = validateEffort(obj, filePath);
  if (!effortResult.ok) return effortResult;

  const triggersResult = validateTriggers(obj, filePath);
  if (!triggersResult.ok) return triggersResult;

  const severityResult = validateMinimumSeverity(obj, filePath);
  if (!severityResult.ok) return severityResult;

  const suggestionResult = validateSuggestionMode(obj, filePath);
  if (!suggestionResult.ok) return suggestionResult;

  const gateResult = validateGateMode(obj, filePath);
  if (!gateResult.ok) return gateResult;

  const reReviewResult = validateReReviewCap(obj, filePath);
  if (!reReviewResult.ok) return reReviewResult;

  const budgetsResult = validateBudgets(obj, filePath);
  if (!budgetsResult.ok) return budgetsResult;

  const pathRulesResult = validatePathRules(obj, filePath);
  if (!pathRulesResult.ok) return pathRulesResult;

  const excludesResult = validateExcludes(obj, filePath);
  if (!excludesResult.ok) return excludesResult;

  return { ok: true, policy: DEFAULT_REVIEW_POLICY };
}

function validatePathSafetyAndGlobs(_raw: unknown, _filePath: string): ValidateReviewPolicyResult {
  return { ok: true, policy: DEFAULT_REVIEW_POLICY };
}

/** `extract` returns null for entries that carry no scannable string. */
function scanForSecrets(
  value: unknown,
  filePath: string,
  fieldLabel: string,
  extract: (entry: unknown) => string | null,
): ValidateReviewPolicyResult {
  if (value === undefined || !Array.isArray(value)) return { ok: true, policy: DEFAULT_REVIEW_POLICY };
  for (const entry of value) {
    const candidate = extract(entry);
    if (candidate !== null && containsSecret(candidate)) {
      return fail("secret-detected", `policy at ${filePath}: secret-shaped value detected in ${fieldLabel}`);
    }
  }
  return { ok: true, policy: DEFAULT_REVIEW_POLICY };
}

function validateSecretScanPatterns(raw: unknown, filePath: string): ValidateReviewPolicyResult {
  const obj = raw as Record<string, unknown>;
  const pathRules = scanForSecrets(obj["pathRules"], filePath, "pathRule pattern", (rule) =>
    isRecord(rule) && typeof rule["pattern"] === "string" ? rule["pattern"] : null,
  );
  if (!pathRules.ok) return pathRules;
  return scanForSecrets(obj["excludes"], filePath, "exclude pattern", (ex) =>
    typeof ex === "string" ? ex : null,
  );
}

function validateEffort(obj: Record<string, unknown>, filePath: string): ValidateReviewPolicyResult {
  if (obj["effort"] === undefined) return { ok: true, policy: DEFAULT_REVIEW_POLICY };
  if (typeof obj["effort"] !== "string" || !VALID_EFFORTS.has(obj["effort"])) {
    return fail("invalid-effort", `policy at ${filePath}: invalid effort ${REDACTED} (expected one of low, medium, high)`);
  }
  return { ok: true, policy: DEFAULT_REVIEW_POLICY };
}

function validateTriggers(obj: Record<string, unknown>, filePath: string): ValidateReviewPolicyResult {
  if (obj["triggers"] === undefined) return { ok: true, policy: DEFAULT_REVIEW_POLICY };
  if (!Array.isArray(obj["triggers"])) {
    return fail("invalid-trigger", `policy at ${filePath}: triggers must be an array`);
  }
  for (const t of obj["triggers"]) {
    if (typeof t !== "string" || !VALID_TRIGGERS.has(t)) {
      return fail("invalid-trigger", `policy at ${filePath}: invalid trigger ${REDACTED} (expected one of opened, synchronize, reopened)`);
    }
  }
  return { ok: true, policy: DEFAULT_REVIEW_POLICY };
}

function validateMinimumSeverity(obj: Record<string, unknown>, filePath: string): ValidateReviewPolicyResult {
  if (obj["minimumSeverity"] === undefined) return { ok: true, policy: DEFAULT_REVIEW_POLICY };
  if (typeof obj["minimumSeverity"] !== "string" || !VALID_MINIMUM_SEVERITIES.has(obj["minimumSeverity"])) {
    return fail("invalid-minimum-severity", `policy at ${filePath}: invalid minimumSeverity ${REDACTED} (expected one of info, warning, error)`);
  }
  return { ok: true, policy: DEFAULT_REVIEW_POLICY };
}

function validateSuggestionMode(obj: Record<string, unknown>, filePath: string): ValidateReviewPolicyResult {
  if (obj["suggestionMode"] === undefined) return { ok: true, policy: DEFAULT_REVIEW_POLICY };
  if (typeof obj["suggestionMode"] !== "string" || !VALID_SUGGESTION_MODES.has(obj["suggestionMode"])) {
    return fail("invalid-suggestion-mode", `policy at ${filePath}: invalid suggestionMode ${REDACTED} (expected one of off, validated)`);
  }
  return { ok: true, policy: DEFAULT_REVIEW_POLICY };
}

function validateGateMode(obj: Record<string, unknown>, filePath: string): ValidateReviewPolicyResult {
  if (obj["gateMode"] === undefined) return { ok: true, policy: DEFAULT_REVIEW_POLICY };
  if (typeof obj["gateMode"] !== "string" || !VALID_GATE_MODES.has(obj["gateMode"])) {
    return fail("invalid-gate-mode", `policy at ${filePath}: invalid gateMode ${REDACTED} (expected one of off, warn, block)`);
  }
  return { ok: true, policy: DEFAULT_REVIEW_POLICY };
}

function validateReReviewCap(obj: Record<string, unknown>, filePath: string): ValidateReviewPolicyResult {
  if (obj["reReviewCap"] === undefined) return { ok: true, policy: DEFAULT_REVIEW_POLICY };
  if (typeof obj["reReviewCap"] !== "number" || !Number.isInteger(obj["reReviewCap"]) || obj["reReviewCap"] < 0) {
    return fail("invalid-re-review-cap", `policy at ${filePath}: reReviewCap must be a non-negative integer`);
  }
  return { ok: true, policy: DEFAULT_REVIEW_POLICY };
}

function validateBudgets(obj: Record<string, unknown>, filePath: string): ValidateReviewPolicyResult {
  if (obj["budgets"] === undefined) return { ok: true, policy: DEFAULT_REVIEW_POLICY };
  if (obj["budgets"] === null || typeof obj["budgets"] !== "object" || Array.isArray(obj["budgets"])) {
    return fail("invalid-budget", `policy at ${filePath}: budgets must be an object`);
  }
  const rawBudgets = obj["budgets"] as Record<string, unknown>;
  for (const key of Object.keys(rawBudgets)) {
    if (!ALLOWED_BUDGET_KEYS.has(key)) {
      return fail("unknown-key", `policy at ${filePath}: unknown budget key "${key}"`);
    }
  }
  const budgetFieldResult = validateBudgetField(rawBudgets, "contextTokens", filePath);
  if (!budgetFieldResult.ok) return budgetFieldResult;
  const maxOutputResult = validateBudgetField(rawBudgets, "maxOutputTokens", filePath);
  if (!maxOutputResult.ok) return maxOutputResult;
  const latencyResult = validateBudgetField(rawBudgets, "latencyMs", filePath);
  if (!latencyResult.ok) return latencyResult;
  return { ok: true, policy: DEFAULT_REVIEW_POLICY };
}

function validateBudgetField(rawBudgets: Record<string, unknown>, field: string, filePath: string): ValidateReviewPolicyResult {
  const value = rawBudgets[field];
  if (value === undefined || value === null) return { ok: true, policy: DEFAULT_REVIEW_POLICY };
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return fail("invalid-budget", `policy at ${filePath}: ${field} must be a non-negative integer`);
  }
  return { ok: true, policy: DEFAULT_REVIEW_POLICY };
}

function validateOnePathRule(
  rule: unknown,
  filePath: string,
  seenPatterns: Set<string>,
): ValidateReviewPolicyResult {
  if (rule === null || typeof rule !== "object" || Array.isArray(rule)) {
    return fail("invalid-glob", `policy at ${filePath}: pathRule must be an object`);
  }
  const r = rule as Record<string, unknown>;
  for (const key of Object.keys(r)) {
    if (!ALLOWED_PATH_RULE_KEYS.has(key)) {
      return fail("unknown-key", `policy at ${filePath}: unknown pathRule key "${key}"`);
    }
  }
  if (typeof r["pattern"] !== "string") {
    return fail("invalid-glob", `policy at ${filePath}: pathRule.pattern must be a string`);
  }
  const pattern = r["pattern"];
  if (!isValidGlob(pattern)) {
    return fail("invalid-glob", `policy at ${filePath}: invalid glob pattern ${REDACTED}`);
  }
  if (isUnsafePath(pattern)) {
    return fail("unsafe-path", `policy at ${filePath}: pathRule pattern escapes repo root`);
  }
  if (seenPatterns.has(pattern)) {
    return fail("duplicate-path-rule", `policy at ${filePath}: duplicate path rule pattern detected`);
  }
  seenPatterns.add(pattern);
  if (r["effort"] !== undefined && (typeof r["effort"] !== "string" || !VALID_EFFORTS.has(r["effort"]))) {
    return fail("invalid-effort", `policy at ${filePath}: invalid pathRule effort ${REDACTED}`);
  }
  return { ok: true, policy: DEFAULT_REVIEW_POLICY };
}

function validatePathRules(obj: Record<string, unknown>, filePath: string): ValidateReviewPolicyResult {
  if (obj["pathRules"] === undefined) return { ok: true, policy: DEFAULT_REVIEW_POLICY };
  if (!Array.isArray(obj["pathRules"])) {
    return fail("invalid-glob", `policy at ${filePath}: pathRules must be an array`);
  }
  const seenPatterns = new Set<string>();
  for (const rule of obj["pathRules"]) {
    const result = validateOnePathRule(rule, filePath, seenPatterns);
    if (!result.ok) return result;
  }
  return { ok: true, policy: DEFAULT_REVIEW_POLICY };
}

function validateExcludes(obj: Record<string, unknown>, filePath: string): ValidateReviewPolicyResult {
  if (obj["excludes"] === undefined) return { ok: true, policy: DEFAULT_REVIEW_POLICY };
  if (!Array.isArray(obj["excludes"])) {
    return fail("invalid-glob", `policy at ${filePath}: excludes must be an array`);
  }
  for (const ex of obj["excludes"]) {
    if (typeof ex !== "string") {
      return fail("invalid-glob", `policy at ${filePath}: exclude entry must be a string`);
    }
    if (!isValidGlob(ex)) {
      return fail("invalid-glob", `policy at ${filePath}: invalid exclude glob ${REDACTED}`);
    }
    if (isUnsafePath(ex)) {
      return fail("unsafe-path", `policy at ${filePath}: exclude pattern escapes repo root`);
    }
  }
  return { ok: true, policy: DEFAULT_REVIEW_POLICY };
}

function buildPolicy(obj: Record<string, unknown>): ReviewPolicy {
  const policy: {
    schemaVersion: typeof REVIEW_POLICY_SCHEMA_VERSION;
    effort?: Effort;
    triggers?: readonly Trigger[];
    minimumSeverity?: MinimumSeverity;
    suggestionMode?: SuggestionMode;
    gateMode?: GateMode;
    reReviewCap?: number;
    budgets?: Budgets;
    pathRules?: readonly PathRule[];
    excludes?: readonly string[];
  } = { schemaVersion: REVIEW_POLICY_SCHEMA_VERSION };

  if (obj["effort"] !== undefined) policy.effort = obj["effort"] as Effort;
  if (obj["triggers"] !== undefined) policy.triggers = obj["triggers"] as readonly Trigger[];
  if (obj["minimumSeverity"] !== undefined) policy.minimumSeverity = obj["minimumSeverity"] as MinimumSeverity;
  if (obj["suggestionMode"] !== undefined) policy.suggestionMode = obj["suggestionMode"] as SuggestionMode;
  if (obj["gateMode"] !== undefined) policy.gateMode = obj["gateMode"] as GateMode;
  if (obj["reReviewCap"] !== undefined) policy.reReviewCap = obj["reReviewCap"] as number;

  if (obj["budgets"] !== undefined) {
    const rawBudgets = obj["budgets"] as Record<string, unknown>;
    policy.budgets = {
      contextTokens: rawBudgets["contextTokens"] === undefined || rawBudgets["contextTokens"] === null ? null : rawBudgets["contextTokens"] as number,
      maxOutputTokens: rawBudgets["maxOutputTokens"] === undefined || rawBudgets["maxOutputTokens"] === null ? null : rawBudgets["maxOutputTokens"] as number,
      latencyMs: rawBudgets["latencyMs"] === undefined || rawBudgets["latencyMs"] === null ? null : rawBudgets["latencyMs"] as number,
    };
  }

  if (obj["pathRules"] !== undefined) {
    policy.pathRules = (obj["pathRules"] as readonly Record<string, unknown>[]).map((r) => {
      const effort = r["effort"] as Effort | undefined;
      return { pattern: r["pattern"] as string, ...(effort !== undefined ? { effort } : {}) };
    });
  }

  if (obj["excludes"] !== undefined) {
    policy.excludes = obj["excludes"] as readonly string[];
  }

  return policy as ReviewPolicy;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(kind: ReviewPolicyErrorKind, message: string): ValidateReviewPolicyResult {
  return { ok: false, error: { kind, message }, exitCode: 2, message };
}

// ---------------------------------------------------------------------------
// File I/O
// ---------------------------------------------------------------------------

export type LoadReviewPolicyResult = {
  readonly policy: ReviewPolicy | null;
  readonly path: string;
  readonly hash: string | null;
  readonly warning: string | null;
  readonly error: ReviewPolicyError | null;
  readonly exitCode: 2 | null;
};

export type LoadReviewPolicyDeps = {
  readonly cwd: string;
  readonly fs?: FsAdapter;
};

export function loadReviewPolicy(deps: LoadReviewPolicyDeps): LoadReviewPolicyResult {
  const fs = deps.fs ?? defaultFsAdapter;
  const path = REVIEW_POLICY_PATH(deps.cwd);

  if (!fs.exists(path)) {
    return { policy: null, path, hash: null, warning: null, error: null, exitCode: null };
  }

  if (fs.isSymlink(path)) {
    return {
      policy: null,
      path,
      hash: null,
      warning: `refusing to read review policy: ${path} is a symlink; remove it and re-run`,
      error: { kind: "unsafe-path", message: `refusing to read review policy: ${path} is a symlink` },
      exitCode: 2,
    };
  }

  if (!fs.isFile(path)) {
    return {
      policy: null,
      path,
      hash: null,
      warning: `refusing to read review policy: ${path} is not a regular file`,
      error: { kind: "unsafe-path", message: `refusing to read review policy: ${path} is not a regular file` },
      exitCode: 2,
    };
  }

  let raw: string;
  try {
    raw = fs.readFile(path);
  } catch {
    return {
      policy: null,
      path,
      hash: null,
      warning: `corrupt review policy at ${path}: read failed; rm ${path} to recover`,
      error: { kind: "corrupt-json", message: `read failed at ${path}` },
      exitCode: 2,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      policy: null,
      path,
      hash: null,
      warning: `corrupt review policy at ${path}: invalid JSON; rm ${path} to recover`,
      error: { kind: "corrupt-json", message: `invalid JSON at ${path}` },
      exitCode: 2,
    };
  }

  const result = validateReviewPolicy(parsed, path);
  if (!result.ok) {
    return {
      policy: null,
      path,
      hash: null,
      warning: result.message,
      error: result.error,
      exitCode: 2,
    };
  }

  const hash = sha256Bytes(serializeReviewPolicy(result.policy));
  return {
    policy: result.policy,
    path,
    hash,
    warning: null,
    error: null,
    exitCode: null,
  };
}

// ---------------------------------------------------------------------------
// Serialization (deterministic key order)
// ---------------------------------------------------------------------------

export function serializeReviewPolicy(policy: ReviewPolicy): string {
  const ordered: Record<string, unknown> = {
    schemaVersion: policy.schemaVersion,
  };
  if (policy.pathRules !== undefined) ordered["pathRules"] = policy.pathRules;
  if (policy.excludes !== undefined) ordered["excludes"] = policy.excludes;
  if (policy.effort !== undefined) ordered["effort"] = policy.effort;
  if (policy.triggers !== undefined) ordered["triggers"] = policy.triggers;
  if (policy.reReviewCap !== undefined) ordered["reReviewCap"] = policy.reReviewCap;
  if (policy.budgets !== undefined) ordered["budgets"] = policy.budgets;
  if (policy.minimumSeverity !== undefined) ordered["minimumSeverity"] = policy.minimumSeverity;
  if (policy.suggestionMode !== undefined) ordered["suggestionMode"] = policy.suggestionMode;
  if (policy.gateMode !== undefined) ordered["gateMode"] = policy.gateMode;
  return JSON.stringify(ordered, null, 2) + "\n";
}

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

export type PolicyProvenance = {
  readonly source: "flag" | "env" | "reviewPolicy" | "default";
  readonly path?: string;
  readonly hash?: string;
  readonly envName?: string;
};

export type PolicyFieldProvenanceMap = Readonly<Record<string, PolicyProvenance>>;

export type ReviewPolicyField =
  | "effort"
  | "triggers"
  | "reReviewCap"
  | "budgets"
  | "minimumSeverity"
  | "suggestionMode"
  | "gateMode"
  | "pathRules"
  | "excludes";

export type PolicyMeta = {
  readonly path: string | null;
  readonly hash: string | null;
  readonly version: number | null;
};

export type SchemaResolvedPolicy = {
  readonly resolved: ReviewPolicy;
  readonly provenance: PolicyFieldProvenanceMap;
  readonly policyMeta: PolicyMeta;
};

// ---------------------------------------------------------------------------
// Apply 4-tier precedence
// ---------------------------------------------------------------------------

export type ApplyReviewPolicyInput = {
  readonly policy: ReviewPolicy | null;
  readonly policyPath: string;
  readonly policyHash: string | null;
  readonly flagValues: Partial<Pick<ReviewPolicy, ReviewPolicyField>>;
  readonly envValues: Partial<Pick<ReviewPolicy, ReviewPolicyField>>;
  readonly defaults: ReviewPolicy;
};

export function applyReviewPolicy(input: ApplyReviewPolicyInput): SchemaResolvedPolicy {
  const { policy, policyPath, policyHash } = input;
  const version = policy?.schemaVersion ?? null;

  const FIELDS_TO_RESOLVE: readonly ReviewPolicyField[] = [
    "effort",
    "triggers",
    "reReviewCap",
    "budgets",
    "minimumSeverity",
    "suggestionMode",
    "gateMode",
    "pathRules",
    "excludes",
  ];

  const resolved: Record<string, unknown> = {};
  const provenance: Record<string, PolicyProvenance> = {};

  for (const field of FIELDS_TO_RESOLVE) {
    const outcome = resolveOneField(field, input);
    resolved[field] = outcome.value;
    provenance[field] = outcome.provenance;
  }

  const result: ReviewPolicy = {
    schemaVersion: REVIEW_POLICY_SCHEMA_VERSION,
    ...(resolved["effort"] !== undefined ? { effort: resolved["effort"] as Effort } : {}),
    ...(resolved["triggers"] !== undefined ? { triggers: resolved["triggers"] as readonly Trigger[] } : {}),
    ...(resolved["reReviewCap"] !== undefined ? { reReviewCap: resolved["reReviewCap"] as number } : {}),
    ...(resolved["budgets"] !== undefined ? { budgets: resolved["budgets"] as Budgets } : {}),
    ...(resolved["minimumSeverity"] !== undefined ? { minimumSeverity: resolved["minimumSeverity"] as MinimumSeverity } : {}),
    ...(resolved["suggestionMode"] !== undefined ? { suggestionMode: resolved["suggestionMode"] as SuggestionMode } : {}),
    ...(resolved["gateMode"] !== undefined ? { gateMode: resolved["gateMode"] as GateMode } : {}),
    ...(resolved["pathRules"] !== undefined ? { pathRules: resolved["pathRules"] as readonly PathRule[] } : {}),
    ...(resolved["excludes"] !== undefined ? { excludes: resolved["excludes"] as readonly string[] } : {}),
  };

  return {
    resolved: result,
    provenance,
    policyMeta: {
      path: policy !== null ? policyPath : null,
      hash: policy !== null ? policyHash : null,
      version,
    },
  };
}

type FieldResolution = {
  readonly value: unknown;
  readonly provenance: PolicyProvenance;
};

function resolveOneField(
  field: ReviewPolicyField,
  input: ApplyReviewPolicyInput,
): FieldResolution {
  const { policy, policyPath, policyHash, flagValues, envValues, defaults } = input;

  const flagValue = flagValues[field];
  if (flagValue !== undefined) {
    return { value: flagValue, provenance: { source: "flag" } };
  }

  const envValue = envValues[field];
  if (envValue !== undefined) {
    return { value: envValue, provenance: { source: "env", envName: policyEnvName(field) } };
  }

  if (policy !== null) {
    const policyValue = policy[field];
    if (policyValue !== undefined) {
      return {
        value: policyValue,
        provenance: {
          source: "reviewPolicy",
          path: policyPath,
          ...(policyHash !== null ? { hash: policyHash } : {}),
        },
      };
    }
  }

  return { value: defaults[field], provenance: { source: "default" } };
}

function prefixUppercase(c: string): string {
  return `_${c}`;
}

function policyEnvName(field: ReviewPolicyField): string {
  return `UMACTUALLY_REVIEW_${field.replace(/[A-Z]/g, prefixUppercase).toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Policy template (opt-in)
// ---------------------------------------------------------------------------

export function renderPolicyTemplate(): string {
  const template = {
    schemaVersion: REVIEW_POLICY_SCHEMA_VERSION,
    effort: "medium",
    triggers: ["opened", "synchronize", "reopened"],
    minimumSeverity: "warning",
    suggestionMode: "off",
    gateMode: "off",
    reReviewCap: 0,
    pathRules: [{ pattern: "src/**/*.ts" }],
    excludes: ["node_modules/**", "vendor/**"],
    budgets: {
      contextTokens: 8000,
      maxOutputTokens: 16000,
      latencyMs: 30000,
    },
  };
  return JSON.stringify(template, null, 2) + "\n";
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

function sha256Bytes(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}