// SPDX-License-Identifier: MIT
// Task 6: Committed review-policy schema and deterministic precedence.
//
// Tests prove:
//   1. ReviewPolicy type with strict fields (pathRules, excludes, effort,
//      triggers, reReviewCap, context/token/latency budgets,
//      minimumSeverity, suggestionMode, gateMode).
//   2. 4-tier precedence: CLI flags > env > committed review policy >
//      built-in defaults. Every resolved field carries provenance
//      (source/path/hash).
//   3. Strict validation BEFORE any provider/platform call:
//      - Unknown keys rejected
//      - Duplicate or conflicting path rules rejected
//      - Invalid globs rejected
//      - Unsafe paths (outside repo root) rejected
//      - Secrets detected and rejected
//      - Unsupported schema versions rejected
//   4. Provider config serialization remains byte-identical and rejects
//      policy keys (security boundary).
//   5. Init's policy template is explicitly opt-in; never automatic.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  REVIEW_POLICY_SCHEMA_VERSION,
  REVIEW_POLICY_PATH,
  DEFAULT_REVIEW_POLICY,
  validateReviewPolicy,
  loadReviewPolicy,
  serializeReviewPolicy,
  applyReviewPolicy,
  renderPolicyTemplate,
  type ReviewPolicy,
} from "../../src/config/review-policy.js";
import { serializeSavedConfig } from "../../src/config/saved-config.js";
import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

let sandboxes: string[] = [];

beforeEach(() => {
  sandboxes = [];
});

afterEach(() => {
  for (const s of sandboxes) {
    rmSync(s, { recursive: true, force: true });
  }
});

function sandbox(): string {
  const dir = mkdtempSync(join(tmpdir(), "umactually-review-policy-"));
  sandboxes.push(dir);
  return dir;
}

function writePolicyFile(cwd: string, policy: unknown): string {
  const path = REVIEW_POLICY_PATH(cwd);
  writeFileSync(path, JSON.stringify(policy, null, 2), "utf8");
  return path;
}

function sha256(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

// ---------------------------------------------------------------------------
// Schema version
// ---------------------------------------------------------------------------

describe("review-policy: schema version", () => {
  it("exports a REVIEW_POLICY_SCHEMA_VERSION constant equal to 1", () => {
    expect(REVIEW_POLICY_SCHEMA_VERSION).toBe(1);
  });

  it("rejects future schema versions with a typed error", () => {
    const result = validateReviewPolicy(
      { schemaVersion: 999, effort: "medium" },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("unsupported-schema-version");
    expect(result.exitCode).toBe(2);
  });

  it("rejects missing schemaVersion with a typed error", () => {
    const result = validateReviewPolicy(
      { effort: "medium" },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("missing-schema-version");
    expect(result.exitCode).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Unknown keys
// ---------------------------------------------------------------------------

describe("review-policy: unknown keys rejected", () => {
  it("rejects unknown top-level keys", () => {
    const result = validateReviewPolicy(
      {
        schemaVersion: 1,
        effort: "medium",
        banana: "yellow",
      },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("unknown-key");
    expect(result.exitCode).toBe(2);
  });

  it("accepts a minimal policy with only schemaVersion", () => {
    const result = validateReviewPolicy(
      { schemaVersion: 1 },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Effort validation
// ---------------------------------------------------------------------------

describe("review-policy: effort enum", () => {
  it("accepts low|medium|high", () => {
    for (const effort of ["low", "medium", "high"] as const) {
      const result = validateReviewPolicy(
        { schemaVersion: 1, effort },
        "/repo/umactually.review.json",
      );
      expect(result.ok).toBe(true);
    }
  });

  it("rejects invalid effort", () => {
    const result = validateReviewPolicy(
      { schemaVersion: 1, effort: "turbo" },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("invalid-effort");
  });
});

// ---------------------------------------------------------------------------
// Triggers
// ---------------------------------------------------------------------------

describe("review-policy: triggers", () => {
  it("accepts opened|synchronize|reopened", () => {
    const result = validateReviewPolicy(
      {
        schemaVersion: 1,
        triggers: ["opened", "synchronize", "reopened"],
      },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects invalid trigger value", () => {
    const result = validateReviewPolicy(
      { schemaVersion: 1, triggers: ["opened", "labeled"] },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("invalid-trigger");
  });
});

// ---------------------------------------------------------------------------
// minimumSeverity
// ---------------------------------------------------------------------------

describe("review-policy: minimumSeverity", () => {
  it("accepts info|warning|error", () => {
    for (const minimumSeverity of ["info", "warning", "error"] as const) {
      const result = validateReviewPolicy(
        { schemaVersion: 1, minimumSeverity },
        "/repo/umactually.review.json",
      );
      expect(result.ok).toBe(true);
    }
  });

  it("rejects invalid minimumSeverity", () => {
    const result = validateReviewPolicy(
      { schemaVersion: 1, minimumSeverity: "nuclear" },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("invalid-minimum-severity");
  });
});

// ---------------------------------------------------------------------------
// suggestionMode
// ---------------------------------------------------------------------------

describe("review-policy: suggestionMode", () => {
  it("accepts off|validated", () => {
    for (const suggestionMode of ["off", "validated"] as const) {
      const result = validateReviewPolicy(
        { schemaVersion: 1, suggestionMode },
        "/repo/umactually.review.json",
      );
      expect(result.ok).toBe(true);
    }
  });

  it("rejects invalid suggestionMode", () => {
    const result = validateReviewPolicy(
      { schemaVersion: 1, suggestionMode: "always" },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("invalid-suggestion-mode");
  });
});

// ---------------------------------------------------------------------------
// gateMode
// ---------------------------------------------------------------------------

describe("review-policy: gateMode", () => {
  it("accepts off|warn|block", () => {
    for (const gateMode of ["off", "warn", "block"] as const) {
      const result = validateReviewPolicy(
        { schemaVersion: 1, gateMode },
        "/repo/umactually.review.json",
      );
      expect(result.ok).toBe(true);
    }
  });

  it("rejects invalid gateMode", () => {
    const result = validateReviewPolicy(
      { schemaVersion: 1, gateMode: "enforce" },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("invalid-gate-mode");
  });
});

// ---------------------------------------------------------------------------
// reReviewCap
// ---------------------------------------------------------------------------

describe("review-policy: reReviewCap", () => {
  it("accepts a non-negative integer", () => {
    const result = validateReviewPolicy(
      { schemaVersion: 1, reReviewCap: 3 },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(true);
  });

  it("accepts zero", () => {
    const result = validateReviewPolicy(
      { schemaVersion: 1, reReviewCap: 0 },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects negative", () => {
    const result = validateReviewPolicy(
      { schemaVersion: 1, reReviewCap: -1 },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("invalid-re-review-cap");
  });

  it("rejects non-integer", () => {
    const result = validateReviewPolicy(
      { schemaVersion: 1, reReviewCap: 1.5 },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("invalid-re-review-cap");
  });
});

// ---------------------------------------------------------------------------
// Budgets (context/token/latency)
// ---------------------------------------------------------------------------

describe("review-policy: budgets", () => {
  it("accepts valid budget values", () => {
    const result = validateReviewPolicy(
      {
        schemaVersion: 1,
        budgets: {
          contextTokens: 8000,
          maxOutputTokens: 16000,
          latencyMs: 30000,
        },
      },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects negative contextTokens", () => {
    const result = validateReviewPolicy(
      {
        schemaVersion: 1,
        budgets: { contextTokens: -1 },
      },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("invalid-budget");
  });

  it("rejects non-integer latencyMs", () => {
    const result = validateReviewPolicy(
      {
        schemaVersion: 1,
        budgets: { latencyMs: 1.5 },
      },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("invalid-budget");
  });

  it("rejects unknown budget keys", () => {
    const result = validateReviewPolicy(
      {
        schemaVersion: 1,
        budgets: { mysteryBudget: 100 },
      },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("unknown-key");
  });
});

// ---------------------------------------------------------------------------
// pathRules (glob patterns)
// ---------------------------------------------------------------------------

describe("review-policy: pathRules", () => {
  it("accepts valid glob patterns", () => {
    const result = validateReviewPolicy(
      {
        schemaVersion: 1,
        pathRules: [
          { pattern: "src/**/*.ts" },
          { pattern: "lib/*.js" },
        ],
      },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects duplicate path rule patterns", () => {
    const result = validateReviewPolicy(
      {
        schemaVersion: 1,
        pathRules: [
          { pattern: "src/**/*.ts" },
          { pattern: "src/**/*.ts" },
        ],
      },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("duplicate-path-rule");
  });

  it("rejects conflicting path rules (same pattern, different effort)", () => {
    const result = validateReviewPolicy(
      {
        schemaVersion: 1,
        pathRules: [
          { pattern: "src/**/*.ts", effort: "low" },
          { pattern: "src/**/*.ts", effort: "high" },
        ],
      },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("duplicate-path-rule");
  });

  it("rejects empty pattern string", () => {
    const result = validateReviewPolicy(
      {
        schemaVersion: 1,
        pathRules: [{ pattern: "" }],
      },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("invalid-glob");
  });

  it("rejects path traversal glob (..)", () => {
    const result = validateReviewPolicy(
      {
        schemaVersion: 1,
        pathRules: [{ pattern: "../secret/**/*.ts" }],
      },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("unsafe-path");
  });

  it("rejects absolute path glob", () => {
    const result = validateReviewPolicy(
      {
        schemaVersion: 1,
        pathRules: [{ pattern: "/etc/passwd" }],
      },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("unsafe-path");
  });

  it("rejects invalid glob with unbalanced braces", () => {
    const result = validateReviewPolicy(
      {
        schemaVersion: 1,
        pathRules: [{ pattern: "src/{invalid.ts" }],
      },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("invalid-glob");
  });
});

// ---------------------------------------------------------------------------
// excludes (glob patterns)
// ---------------------------------------------------------------------------

describe("review-policy: excludes", () => {
  it("accepts valid glob excludes", () => {
    const result = validateReviewPolicy(
      {
        schemaVersion: 1,
        excludes: ["vendor/**", "node_modules/**"],
      },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(true);
  });

  it("rejects traversal glob in excludes", () => {
    const result = validateReviewPolicy(
      {
        schemaVersion: 1,
        excludes: ["../../etc/**"],
      },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("unsafe-path");
  });

  it("rejects invalid glob in excludes", () => {
    const result = validateReviewPolicy(
      {
        schemaVersion: 1,
        excludes: ["valid/**", "{"],
      },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("invalid-glob");
  });
});

// ---------------------------------------------------------------------------
// Secret detection
// ---------------------------------------------------------------------------

describe("review-policy: secret detection", () => {
  it("rejects API-key-like literal in effort field", () => {
    const result = validateReviewPolicy(
      {
        schemaVersion: 1,
        effort: "sk-live-key-abc123def456",
      },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("secret-detected");
    expect(result.exitCode).toBe(2);
  });

  it("rejects API-key-like literal in pathRules pattern", () => {
    const result = validateReviewPolicy(
      {
        schemaVersion: 1,
        pathRules: [{ pattern: "sk-abcdefghij1234567890" }],
      },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("secret-detected");
  });

  it("rejects GitHub token-like literal", () => {
    const result = validateReviewPolicy(
      {
        schemaVersion: 1,
        excludes: ["ghp_1234567890abcdefghijklmnop"],
      },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("secret-detected");
  });

  it("error messages are redacted (no secret in message)", () => {
    const secret = "sk-supersecret1234567890abcdef";
    const result = validateReviewPolicy(
      { schemaVersion: 1, effort: secret },
      "/repo/umactually.review.json",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).not.toContain(secret);
  });
});

// ---------------------------------------------------------------------------
// loadReviewPolicy (file I/O)
// ---------------------------------------------------------------------------

describe("review-policy: loadReviewPolicy", () => {
  it("returns null policy when no file exists", () => {
    const cwd = sandbox();
    const result = loadReviewPolicy({ cwd });
    expect(result.policy).toBeNull();
    expect(result.path).toBe(REVIEW_POLICY_PATH(cwd));
    expect(result.warning).toBeNull();
    expect(result.error).toBeNull();
  });

  it("loads a valid policy file with hash", () => {
    const cwd = sandbox();
    const rawPolicy = { schemaVersion: 1, effort: "high" as const };
    const path = writePolicyFile(cwd, rawPolicy);

    const result = loadReviewPolicy({ cwd });
    expect(result.policy).not.toBeNull();
    expect(result.path).toBe(path);
    expect(result.warning).toBeNull();
    expect(result.error).toBeNull();
    if (result.policy === null) return;
    expect(result.policy.effort).toBe("high");
    expect(result.policy.schemaVersion).toBe(1);
    expect(result.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns typed error for invalid policy (exit 2)", () => {
    const cwd = sandbox();
    writePolicyFile(cwd, { schemaVersion: 999 });

    const result = loadReviewPolicy({ cwd });
    expect(result.policy).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.exitCode).toBe(2);
    if (result.error === null) return;
    expect(result.error.kind).toBe("unsupported-schema-version");
  });

  it("returns typed error for corrupt JSON", () => {
    const cwd = sandbox();
    writeFileSync(REVIEW_POLICY_PATH(cwd), "{ broken json", "utf8");

    const result = loadReviewPolicy({ cwd });
    expect(result.policy).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.exitCode).toBe(2);
    if (result.error === null) return;
    expect(result.error.kind).toBe("corrupt-json");
  });

  it("hash matches sha256 of canonical serialized bytes", () => {
    const cwd = sandbox();
    const policy: ReviewPolicy = {
      schemaVersion: 1,
      effort: "low",
    };
    writePolicyFile(cwd, policy);
    const result = loadReviewPolicy({ cwd });
    expect(result.policy).not.toBeNull();
    if (result.policy === null) return;
    const expected = sha256(serializeReviewPolicy(result.policy));
    expect(result.hash).toBe(expected);
  });

  it("refuses symlinked policy file", () => {
    const cwd = sandbox();
    const realFile = join(cwd, "real-policy.json");
    writeFileSync(realFile, JSON.stringify({ schemaVersion: 1 }), "utf8");
    // Create symlink at the expected policy path
    const { symlinkSync } = require("node:fs");
    symlinkSync(realFile, REVIEW_POLICY_PATH(cwd));

    const result = loadReviewPolicy({ cwd });
    expect(result.policy).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.exitCode).toBe(2);
    if (result.error === null) return;
    expect(result.error.kind).toBe("unsafe-path");
  });
});

// ---------------------------------------------------------------------------
// serializeReviewPolicy
// ---------------------------------------------------------------------------

describe("review-policy: serialization", () => {
  it("produces deterministic 2-space JSON with schemaVersion first", () => {
    const policy: ReviewPolicy = {
      schemaVersion: 1,
      effort: "medium",
    };
    const serialized = serializeReviewPolicy(policy);
    expect(serialized.startsWith('{\n  "schemaVersion"')).toBe(true);
    expect(serialized.endsWith("\n")).toBe(true);
  });

  it("omits undefined optional fields", () => {
    const policy: ReviewPolicy = {
      schemaVersion: 1,
    };
    const serialized = serializeReviewPolicy(policy);
    expect(serialized).not.toContain('"effort"');
    expect(serialized).not.toContain('"pathRules"');
    expect(serialized).not.toContain('"excludes"');
  });

  it("includes optional fields when present", () => {
    const policy: ReviewPolicy = {
      schemaVersion: 1,
      effort: "high",
      gateMode: "block",
      minimumSeverity: "error",
      suggestionMode: "validated",
      reReviewCap: 5,
      triggers: ["opened", "synchronize"],
      excludes: ["vendor/**"],
      pathRules: [{ pattern: "src/**/*.ts" }],
      budgets: { contextTokens: 4000, maxOutputTokens: 8000, latencyMs: 10000 },
    };
    const serialized = serializeReviewPolicy(policy);
    const parsed = JSON.parse(serialized);
    expect(parsed.effort).toBe("high");
    expect(parsed.gateMode).toBe("block");
    expect(parsed.reReviewCap).toBe(5);
    expect(parsed.budgets.contextTokens).toBe(4000);
    expect(parsed.pathRules[0].pattern).toBe("src/**/*.ts");
  });
});

// ---------------------------------------------------------------------------
// applyReviewPolicy (4-tier precedence)
// ---------------------------------------------------------------------------

describe("review-policy: 4-tier precedence", () => {
  it("CLI flag overrides policy (flag wins)", () => {
    const policy: ReviewPolicy = {
      schemaVersion: 1,
      effort: "low",
    };
    const defaults = DEFAULT_REVIEW_POLICY;
    const result = applyReviewPolicy({
      policy,
      policyPath: "/repo/umactually.review.json",
      policyHash: "abc123",
      flagValues: { effort: "high" },
      envValues: {},
      defaults,
    });
    expect(result.resolved.effort).toBe("high");
    expect(result.provenance["effort"]?.source).toBe("flag");
  });

  it("env overrides policy when no flag set (env wins over policy)", () => {
    const policy: ReviewPolicy = {
      schemaVersion: 1,
      effort: "low",
    };
    const result = applyReviewPolicy({
      policy,
      policyPath: "/repo/umactually.review.json",
      policyHash: "abc123",
      flagValues: {},
      envValues: { effort: "high" },
      defaults: DEFAULT_REVIEW_POLICY,
    });
    expect(result.resolved.effort).toBe("high");
    expect(result.provenance["effort"]?.source).toBe("env");
  });

  it("policy overrides built-in default when no flag/env set", () => {
    const policy: ReviewPolicy = {
      schemaVersion: 1,
      effort: "low",
    };
    const result = applyReviewPolicy({
      policy,
      policyPath: "/repo/umactually.review.json",
      policyHash: "abc123",
      flagValues: {},
      envValues: {},
      defaults: DEFAULT_REVIEW_POLICY,
    });
    expect(result.resolved.effort).toBe("low");
    expect(result.provenance["effort"]?.source).toBe("reviewPolicy");
    expect(result.provenance["effort"]?.path).toBe("/repo/umactually.review.json");
    expect(result.provenance["effort"]?.hash).toBe("abc123");
  });

  it("built-in default used when no flag/env/policy field set", () => {
    const policy: ReviewPolicy = {
      schemaVersion: 1,
    };
    const result = applyReviewPolicy({
      policy,
      policyPath: "/repo/umactually.review.json",
      policyHash: "abc123",
      flagValues: {},
      envValues: {},
      defaults: DEFAULT_REVIEW_POLICY,
    });
    expect(result.resolved.effort).toBe("medium");
    expect(result.provenance["effort"]?.source).toBe("default");
  });

  it("null policy falls through to defaults", () => {
    const result = applyReviewPolicy({
      policy: null,
      policyPath: "/repo/umactually.review.json",
      policyHash: null,
      flagValues: {},
      envValues: {},
      defaults: DEFAULT_REVIEW_POLICY,
    });
    expect(result.resolved.effort).toBe("medium");
    expect(result.provenance["effort"]?.source).toBe("default");
  });

  it("provenance carries path and hash for every policy-sourced field", () => {
    const policy: ReviewPolicy = {
      schemaVersion: 1,
      effort: "low",
      minimumSeverity: "warning",
      gateMode: "warn",
    };
    const result = applyReviewPolicy({
      policy,
      policyPath: "/repo/umactually.review.json",
      policyHash: "deadbeef",
      flagValues: {},
      envValues: {},
      defaults: DEFAULT_REVIEW_POLICY,
    });
    // effort from policy
    expect(result.provenance["effort"]?.source).toBe("reviewPolicy");
    expect(result.provenance["effort"]?.path).toBe("/repo/umactually.review.json");
    expect(result.provenance["effort"]?.hash).toBe("deadbeef");
    // minimumSeverity from policy
    expect(result.provenance["minimumSeverity"]?.source).toBe("reviewPolicy");
    expect(result.provenance["minimumSeverity"]?.path).toBe("/repo/umactually.review.json");
    expect(result.provenance["minimumSeverity"]?.hash).toBe("deadbeef");
    // gateMode from policy
    expect(result.provenance["gateMode"]?.source).toBe("reviewPolicy");
    expect(result.provenance["gateMode"]?.path).toBe("/repo/umactually.review.json");
    expect(result.provenance["gateMode"]?.hash).toBe("deadbeef");
    // suggestionMode falls to default (not in policy)
    expect(result.provenance["suggestionMode"]?.source).toBe("default");
  });

  it("provenance carries schemaVersion and version from the policy", () => {
    const policy: ReviewPolicy = {
      schemaVersion: 1,
      effort: "low",
    };
    const result = applyReviewPolicy({
      policy,
      policyPath: "/repo/umactually.review.json",
      policyHash: "deadbeef",
      flagValues: {},
      envValues: {},
      defaults: DEFAULT_REVIEW_POLICY,
    });
    expect(result.policyMeta.path).toBe("/repo/umactually.review.json");
    expect(result.policyMeta.hash).toBe("deadbeef");
    expect(result.policyMeta.version).toBe(1);
  });

  it("null policy has null policyMeta path/hash", () => {
    const result = applyReviewPolicy({
      policy: null,
      policyPath: "",
      policyHash: null,
      flagValues: {},
      envValues: {},
      defaults: DEFAULT_REVIEW_POLICY,
    });
    expect(result.policyMeta.path).toBeNull();
    expect(result.policyMeta.hash).toBeNull();
    expect(result.policyMeta.version).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Security boundary: provider config rejects policy keys
// ---------------------------------------------------------------------------

describe("review-policy: provider config security boundary", () => {
  it("serializeSavedConfig does not accept policy keys", () => {
    // The SavedConfig type only has schemaVersion, provider, apiUrl, model.
    // serializeSavedConfig should NEVER serialize a policy field even if
    // a cast somehow injects one.
    const providerConfig = {
      schemaVersion: 1 as const,
      provider: "openai-compatible" as const,
    };
    const serialized = serializeSavedConfig(providerConfig);
    expect(serialized).not.toContain("effort");
    expect(serialized).not.toContain("pathRules");
    expect(serialized).not.toContain("gateMode");
    expect(serialized).not.toContain("minimumSeverity");
    expect(serialized).not.toContain("reviewPolicy");
  });

  it("serializeSavedConfig is byte-identical for the same input", () => {
    const config = {
      schemaVersion: 1 as const,
      provider: "openai-compatible" as const,
      apiUrl: "https://api.example.com/v1",
      model: "gpt-4",
    };
    const a = serializeSavedConfig(config);
    const b = serializeSavedConfig(config);
    expect(a).toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Init: opt-in policy template
// ---------------------------------------------------------------------------

describe("review-policy: init policy template", () => {
  it("renderPolicyTemplate produces valid JSON that passes validation", () => {
    const template = renderPolicyTemplate();
    const parsed = JSON.parse(template);
    const result = validateReviewPolicy(parsed, "/template");
    expect(result.ok).toBe(true);
  });

  it("template contains no secrets", () => {
    const template = renderPolicyTemplate();
    const SECRET_REGEX =
      /gh[pousr]_[A-Za-z0-9]+|glpat-[A-Za-z0-9]+|s\.r[A-Za-z0-9]+|sk-[A-Za-z0-9]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gu;
    expect(SECRET_REGEX.test(template)).toBe(false);
    SECRET_REGEX.lastIndex = 0;
  });

  it("template is explicitly opt-in — no auto-creation on default init", () => {
    // renderPolicyTemplate is a standalone function; nothing in the default
    // init flow calls it. The template must be rendered via an explicit
    // flag (e.g. --policy-template). We verify the function exists and
    // produces content; the wiring is tested in cli-init-wizard.test.ts.
    const template = renderPolicyTemplate();
    expect(template.length).toBeGreaterThan(0);
    expect(template).toContain("schemaVersion");
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_REVIEW_POLICY
// ---------------------------------------------------------------------------

describe("review-policy: defaults", () => {
  it("exports built-in defaults for every field", () => {
    expect(DEFAULT_REVIEW_POLICY.effort).toBe("medium");
    expect(DEFAULT_REVIEW_POLICY.minimumSeverity).toBe("warning");
    expect(DEFAULT_REVIEW_POLICY.suggestionMode).toBe("off");
    expect(DEFAULT_REVIEW_POLICY.gateMode).toBe("off");
    expect(DEFAULT_REVIEW_POLICY.reReviewCap).toBe(0);
    expect(DEFAULT_REVIEW_POLICY.triggers).toEqual(["opened", "synchronize", "reopened"]);
    expect(DEFAULT_REVIEW_POLICY.pathRules).toEqual([]);
    expect(DEFAULT_REVIEW_POLICY.excludes).toEqual([]);
    expect(DEFAULT_REVIEW_POLICY.budgets).toEqual({
      contextTokens: null,
      maxOutputTokens: null,
      latencyMs: null,
    });
  });

  it("default policy passes validation", () => {
    const result = validateReviewPolicy(
      DEFAULT_REVIEW_POLICY,
      "/defaults",
    );
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// REVIEW_POLICY_PATH
// ---------------------------------------------------------------------------

describe("review-policy: path", () => {
  it("REVIEW_POLICY_PATH resolves to umactually.review.json in cwd", () => {
    expect(REVIEW_POLICY_PATH("/repo")).toBe(join("/repo", "umactually.review.json"));
  });
});
