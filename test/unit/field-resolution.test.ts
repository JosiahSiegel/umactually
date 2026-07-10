import { describe, expect, it } from "vitest";

import { resolveField } from "../../src/config/field-resolution.js";

describe("resolveField", () => {
  it("DRY-FIELD-001 returns the parsed value when both parsed and env are set", () => {
    // Given: parsed, env, and fallback values are all present.
    // When: resolving the field through the precedence chain.
    const value = resolveField("cli-value", "env-value", "default");

    // Then: the parsed CLI/input value wins.
    expect(value).toBe("cli-value");
  });

  it("DRY-FIELD-002 returns the env value when parsed is undefined", () => {
    // Given: parsed is missing and env plus fallback values are present.
    // When: resolving the field through the precedence chain.
    const value = resolveField(undefined, "env-value", "default");

    // Then: the env value wins over the fallback.
    expect(value).toBe("env-value");
  });

  it("DRY-FIELD-003 returns the fallback when parsed and env are undefined", () => {
    // Given: parsed and env values are missing.
    // When: resolving the field through the precedence chain.
    const value = resolveField(undefined, undefined, "default");

    // Then: the fallback is returned.
    expect(value).toBe("default");
  });

  it("DRY-FIELD-004 treats empty-string and null values as missing", () => {
    // Given: parsed/env values can be empty strings or null.
    // When/Then: empty parsed is skipped in favor of env.
    expect(resolveField("", "env-value", "default")).toBe("env-value");

    // When/Then: empty env is skipped in favor of fallback.
    expect(resolveField(undefined, "", "default")).toBe("default");

    // When/Then: null parsed/env are skipped in favor of fallback.
    expect(resolveField(null, null, "default")).toBe("default");
  });
});
