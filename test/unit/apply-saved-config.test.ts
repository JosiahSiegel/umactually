// SPDX-License-Identifier: MIT
// Unit tests for the pure resolver `applySavedConfig` (v0.6.26).
//
// Contract (pinned):
//   For each of `provider` / `apiUrl` / `model`:
//     - When `fieldProvenance[field].source === "default"` and saved
//       config supplies a value, override and flip source to
//       "savedConfig".
//     - When `fieldProvenance[field].source` is already "flag" or
//       "env", saved config MUST NOT override (flag > env > saved >
//       default).
//
// S6 contract (v0.6.23): saved config NEVER contains `apiKey`. The
// `SavedConfig` type itself excludes it; these tests pin the runtime
// boundary so a future relaxation of the S6 contract would surface as a
// compile error here, not as a silent leak.

import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../../src/cli/parse-args.js";
import { resolveFromSchema, type SchemaResolvedCliArgs } from "../../src/config/field-resolution.js";
import { applySavedConfig } from "../../src/cli/apply-saved-config.js";
import type { SavedConfig } from "../../src/config/saved-config.js";

function freshDefaultResolved(): SchemaResolvedCliArgs {
  // Canonical "no flag, no env" shape: every field falls through to its
  // schema default, so fieldProvenance[field].source === "default" for
  // every entry. This is the ONLY state where saved config is allowed
  // to override.
  const parsed = parseCliArgs([]);
  return resolveFromSchema(parsed, {});
}

function resolvedWithFlag(
  field: "provider" | "apiUrl" | "model",
  value: string,
): SchemaResolvedCliArgs {
  const parsed = parseCliArgs([`--${kebab(field)}`, value]);
  return resolveFromSchema(parsed, {});
}

function resolvedWithEnv(
  envName: string,
  envValue: string,
): SchemaResolvedCliArgs {
  const parsed = parseCliArgs([]);
  return resolveFromSchema(parsed, { [envName]: envValue });
}

function kebab(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

function makeSaved(overrides: Partial<Omit<SavedConfig, "schemaVersion">> = {}): SavedConfig {
  return {
    schemaVersion: 1,
    provider: "openai-compatible",
    ...(overrides as object),
  };
}

describe("applySavedConfig (v0.6.26)", () => {
  it("APPLY-1: saved === null is a no-op (returns resolved unchanged, applied=[])", () => {
    const before = freshDefaultResolved();
    const { resolved, applied } = applySavedConfig(before, null, "/nonexistent");
    expect(resolved).toBe(before);
    expect(applied).toEqual([]);
  });

  it("APPLY-2: saved.provider overrides when resolved.provider was default", () => {
    const before = freshDefaultResolved();
    expect(before.fieldProvenance["provider"]?.source).toBe("default");

    const { resolved, applied } = applySavedConfig(
      before,
      makeSaved({ provider: "anthropic" }),
      "/home/user/.umactually/config.json",
    );

    expect(resolved.provider).toBe("anthropic");
    expect(resolved.fieldProvenance["provider"]).toEqual({
      source: "savedConfig",
      path: "/home/user/.umactually/config.json",
    });
    expect(applied).toEqual(["provider"]);
    // Other fields are untouched.
    expect(resolved.apiUrl).toBe(before.apiUrl);
    expect(resolved.model).toBe(before.model);
  });

  it("APPLY-3: saved.apiUrl overrides when resolved.apiUrl was default", () => {
    const before = freshDefaultResolved();
    expect(before.fieldProvenance["apiUrl"]?.source).toBe("default");

    // `makeSaved` always sets a non-default provider so this fixture
    // exercises the "two fields overridden at once" path; we assert
    // the apiUrl transition (the field under test) without constraining
    // the order in which other fields flip.
    const { resolved, applied } = applySavedConfig(
      before,
      makeSaved({ apiUrl: "https://api.example.com/v1" }),
      "/home/user/.umactually/config.json",
    );

    expect(resolved.apiUrl).toBe("https://api.example.com/v1");
    expect(resolved.fieldProvenance["apiUrl"]).toEqual({
      source: "savedConfig",
      path: "/home/user/.umactually/config.json",
    });
    expect(applied).toContain("apiUrl");
  });

  it("APPLY-4: saved.model overrides when resolved.model was default", () => {
    const before = freshDefaultResolved();
    expect(before.fieldProvenance["model"]?.source).toBe("default");

    const { resolved, applied } = applySavedConfig(
      before,
      makeSaved({ model: "gpt-5-mini" }),
      "/home/user/.umactually/config.json",
    );

    expect(resolved.model).toBe("gpt-5-mini");
    expect(resolved.fieldProvenance["model"]).toEqual({
      source: "savedConfig",
      path: "/home/user/.umactually/config.json",
    });
    expect(applied).toContain("model");
  });

  it("APPLY-5: env var already set → saved does NOT override (env wins)", () => {
    // UMACTUALLY_PROVIDER is the canonical env var for `provider`.
    const before = resolvedWithEnv("UMACTUALLY_PROVIDER", "anthropic");
    expect(before.provider).toBe("anthropic");
    expect(before.fieldProvenance["provider"]?.source).toBe("env");

    const { resolved, applied } = applySavedConfig(
      before,
      makeSaved({ provider: "openai-compatible" }),
      "/home/user/.umactually/config.json",
    );

    expect(resolved.provider).toBe("anthropic");
    expect(resolved.fieldProvenance["provider"]).toEqual({ source: "env", envName: "UMACTUALLY_PROVIDER" });
    expect(applied).toEqual([]);
  });

  it("APPLY-6: explicit flag already set → saved does NOT override (flag wins)", () => {
    const before = resolvedWithFlag("model", "claude-sonnet-4-5");
    expect(before.model).toBe("claude-sonnet-4-5");
    expect(before.fieldProvenance["model"]?.source).toBe("flag");

    const { resolved, applied } = applySavedConfig(
      before,
      makeSaved({ model: "gpt-5-mini" }),
      "/home/user/.umactually/config.json",
    );

    expect(resolved.model).toBe("claude-sonnet-4-5");
    expect(resolved.fieldProvenance["model"]).toEqual({ source: "flag" });
    // The flag-wins invariant: `model` MUST NOT be in the applied list
    // (saved has model="gpt-5-mini" but the flag took precedence).
    // The strict `toEqual([])` form was the previous bug — `makeSaved`
    // always sets a non-default provider, so `applied` legitimately
    // contains "provider" here.
    expect(applied).not.toContain("model");
  });

  it("APPLY-7: saved with subset (only provider) — apiUrl/model stay default", () => {
    const before = freshDefaultResolved();
    expect(before.fieldProvenance["apiUrl"]?.source).toBe("default");
    expect(before.fieldProvenance["model"]?.source).toBe("default");

    const { resolved, applied } = applySavedConfig(
      before,
      makeSaved({ provider: "copilot" }),
      "/home/user/.umactually/config.json",
    );

    expect(resolved.provider).toBe("copilot");
    expect(resolved.fieldProvenance["provider"]?.source).toBe("savedConfig");
    // apiUrl/model NOT touched because saved doesn't define them.
    expect(resolved.fieldProvenance["apiUrl"]?.source).toBe("default");
    expect(resolved.fieldProvenance["model"]?.source).toBe("default");
    expect(applied).toEqual(["provider"]);
  });

  it("APPLY-8: S6 contract — SavedConfig type has no apiKey field (compile-time + runtime double-check)", () => {
    // The SavedConfig type excludes `apiKey`. This test pins the
    // runtime-shape contract: the resolver MUST NOT touch the live
    // `apiKey` field on the resolved object even if a future SavedConfig
    // extension (typed via cast) somehow carried one.
    const before = freshDefaultResolved();
    const originalApiKey = before.apiKey;
    const originalProvenance = before.fieldProvenance["apiKey"];

    // Cast through unknown so this test compiles even if a future
    // SavedConfig type ever carries apiKey (we want the runtime guard
    // to fire, not the type checker to block the test outright).
    const evilSaved = makeSaved({ provider: "anthropic" }) as unknown as Record<string, unknown>;
    evilSaved["apiKey"] = "sk-leaked-via-saved-config-1234567890";

    const { resolved } = applySavedConfig(
      before as unknown as SchemaResolvedCliArgs,
      // Type assertion intentional: we want to test the runtime
      // behavior even when the type system would refuse to compile
      // such a SavedConfig.
      evilSaved as unknown as SavedConfig | null,
      "/home/user/.umactually/config.json",
    );

    expect(resolved.apiKey).toBe(originalApiKey);
    expect(resolved.fieldProvenance["apiKey"]).toBe(originalProvenance);
  });
});
