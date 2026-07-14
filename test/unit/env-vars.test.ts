import { describe, expect, it } from "vitest";

import { parseCliArgs } from "../../src/cli/parse-args.js";
import { InvalidConfigError } from "../../src/config/errors.js";
import { FIELDS } from "../../src/config/field-schema.js";
import { resolveFromSchema } from "../../src/config/field-resolution.js";

const EMPTY_ENV: NodeJS.ProcessEnv = {};

function resolve(
  args: readonly string[] = [],
  env: NodeJS.ProcessEnv = EMPTY_ENV,
) {
  return resolveFromSchema(parseCliArgs(args), env);
}

describe("schema-driven CLI environment resolution", () => {
  it("uses the canonical API URL environment variable when the flag is absent", () => {
    // Given
    const env = { UMACTUALLY_API_URL: "https://canonical.example/v1" };

    // When
    const resolved = resolve([], env);

    // Then
    expect(resolved.apiUrl).toBe("https://canonical.example/v1");
  });

  it("prefers the canonical API URL environment variable to its legacy alias", () => {
    // Given
    const env = {
      UMACTUALLY_API_URL: "https://canonical.example/v1",
      REVIEW_PROVIDER_URL: "https://legacy.example/v1",
    };

    // When
    const resolved = resolve([], env);

    // Then
    expect(resolved.apiUrl).toBe("https://canonical.example/v1");
  });

  it("coerces a false boolean environment value", () => {
    // Given / When
    const resolved = resolve([], { UMACTUALLY_STRICT_SCHEMA: "false" });

    // Then
    expect(resolved.strictSchema).toBe(false);
  });

  it.each(["1", "true", "yes", "on", "y"])(
    "coerces boolean true form %s",
    (value) => {
      // Given / When
      const resolved = resolve([], { UMACTUALLY_WALKTHROUGH: value });

      // Then
      expect(resolved.walkthrough).toBe(true);
    },
  );

  it.each(["0", "false", "no", "off", "n"])(
    "coerces boolean false form %s",
    (value) => {
      // Given / When
      const resolved = resolve([], { UMACTUALLY_STRICT_SCHEMA: value });

      // Then
      expect(resolved.strictSchema).toBe(false);
    },
  );

  it("rejects an invalid boolean without exposing its raw value", () => {
    // Given
    const env = { UMACTUALLY_STRICT_SCHEMA: "banana" };

    // When
    const act = () => resolve([], env);

    // Then
    expect(act).toThrow(InvalidConfigError);
    expect(act).toThrow(/strictSchema/u);
    expect(act).not.toThrow(/banana/u);
  });

  it("coerces an integer environment value to a number", () => {
    // Given / When
    const resolved = resolve([], { UMACTUALLY_MAX_OUTPUT_TOKENS: "32000" });

    // Then
    expect(resolved.maxOutputTokens).toBe(32_000);
  });

  it("rejects a non-integer environment value", () => {
    // Given
    const env = { UMACTUALLY_MAX_OUTPUT_TOKENS: "abc" };

    // When
    const act = () => resolve([], env);

    // Then
    expect(act).toThrow(InvalidConfigError);
    expect(act).toThrow(/maxOutputTokens/u);
    expect(act).not.toThrow(/abc/u);
  });

  it("rejects an integer outside the safe range", () => {
    // Given
    const env = { UMACTUALLY_MAX_OUTPUT_TOKENS: "99999999999999999999" };

    // When
    const act = () => resolve([], env);

    // Then
    expect(act).toThrow(InvalidConfigError);
    expect(act).toThrow(/maxOutputTokens/u);
    expect(act).not.toThrow(/99999999999999999999/u);
  });

  it("coerces a provider enum environment value", () => {
    // Given / When
    const resolved = resolve([], { UMACTUALLY_PROVIDER: "anthropic" });

    // Then
    expect(resolved.provider).toBe("anthropic");
  });

  it("rejects an invalid provider enum without exposing its raw value", () => {
    // Given
    const env = { UMACTUALLY_PROVIDER: "invalid" };

    // When
    const act = () => resolve([], env);

    // Then
    expect(act).toThrow(InvalidConfigError);
    expect(act).toThrow(/provider/u);
    expect(act).not.toThrow(/invalid'/u);
  });

  it("lets an explicit positive boolean flag beat the environment", () => {
    // Given / When
    const resolved = resolve(
      ["--strict-schema"],
      { UMACTUALLY_STRICT_SCHEMA: "false" },
    );

    // Then
    expect(resolved.strictSchema).toBe(true);
  });

  it("lets an explicit negative boolean flag beat the environment", () => {
    // Given / When
    const resolved = resolve(
      ["--no-strict-schema"],
      { UMACTUALLY_STRICT_SCHEMA: "true" },
    );

    // Then
    expect(resolved.strictSchema).toBe(false);
  });

  it.each(["", "  \t  "])(
    "treats API URL environment value %j as missing",
    (value) => {
      // Given / When
      const resolved = resolve([], { UMACTUALLY_API_URL: value });

      // Then
      expect(resolved.apiUrl).toBe(FIELDS.apiUrl.defaultValue);
    },
  );

  it("uses the schema default for every field when flags and environment are absent", () => {
    // Given / When
    const resolved = resolve();

    // Then
    for (const field of Object.values(FIELDS)) {
      expect(resolved[field.field], field.field).toBe(field.defaultValue);
    }
  });

  it("coerces every enum field from its first declared environment alias", () => {
    // Given
    const env: NodeJS.ProcessEnv = {
      UMACTUALLY_PROVIDER: "anthropic",
      UMACTUALLY_EFFORT: "high",
      REVIEW_PLATFORM: "github",
      REVIEW_MINIMUM_SEVERITY: "low",
    };

    // When
    const resolved = resolve([], env);

    // Then
    expect(resolved.provider).toBe("anthropic");
    expect(resolved.effort).toBe("high");
    expect(resolved.platform).toBe("github");
    expect(resolved.minimumSeverity).toBe("low");
  });
});
