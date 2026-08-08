import { describe, expect, it } from "vitest";

import { parseCliArgs } from "../../src/cli/parse-args.js";
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
  it("resolves the five public user configuration variables", () => {
    // Given: every supported public environment variable has a distinct value.
    const env = {
      UMACTUALLY_API_KEY: "supported-key",
      UMACTUALLY_API_URL: "https://supported.example/v1",
      UMACTUALLY_GITHUB_API_BASE: "https://github.supported.example",
      UMACTUALLY_MODEL: "supported-model",
      UMACTUALLY_PROVIDER: "anthropic",
    };

    // When: the schema resolves environment configuration.
    const resolved = resolve([], env);

    // Then: every supported value reaches its field.
    expect(resolved.apiKey).toBe("supported-key");
    expect(resolved.apiUrl).toBe("https://supported.example/v1");
    expect(resolved.githubApiBase).toBe("https://github.supported.example");
    expect(resolved.model).toBe("supported-model");
    expect(resolved.provider).toBe("anthropic");
  });

  it("ignores legacy provider environment variables", () => {
    // Given: only removed provider aliases are set.
    const env = {
      REVIEW_PROVIDER_API_KEY: "legacy-key",
      REVIEW_PROVIDER_URL: "https://legacy.example/v1",
      REVIEW_PROVIDER_MODEL: "legacy-model",
    };

    // When: the schema resolves environment configuration.
    const resolved = resolve([], env);

    // Then: legacy values do not resolve.
    expect(resolved.apiKey).toBe(FIELDS.apiKey.defaultValue);
    expect(resolved.apiUrl).toBe(FIELDS.apiUrl.defaultValue);
    expect(resolved.model).toBe(FIELDS.model.defaultValue);
  });

  it("ignores behavioral environment variables", () => {
    // Given: removed behavioral aliases attempt to override defaults.
    const env = {
      UMACTUALLY_PROMPT_FILES: "legacy.md",
      UMACTUALLY_STRICT_SCHEMA: "false",
      UMACTUALLY_WALKTHROUGH: "true",
      REVIEW_PLATFORM: "github",
    };

    // When: the schema resolves environment configuration.
    const resolved = resolve([], env);

    // Then: defaults remain authoritative.
    expect(resolved.promptFiles).toBe(FIELDS.promptFiles.defaultValue);
    expect(resolved.strictSchema).toBe(FIELDS.strictSchema.defaultValue);
    expect(resolved.walkthrough).toBe(FIELDS.walkthrough.defaultValue);
    expect(resolved.platform).toBe(FIELDS.platform.defaultValue);
  });

  it("keeps behavioral CLI flags", () => {
    const resolved = resolve([
      "--prompt-files",
      "one.md,two.md",
      "--no-strict-schema",
      "--walkthrough",
      "--platform",
      "github",
    ]);

    expect(resolved.promptFiles).toBe("one.md,two.md");
    expect(resolved.strictSchema).toBe(false);
    expect(resolved.walkthrough).toBe(true);
    expect(resolved.platform).toBe("github");
  });

  it("keeps GitHub and Azure runner-owned environment inputs", () => {
    const resolved = resolve([], {
      GITHUB_TOKEN: "github-token",
      AZURE_DEVOPS_ORG: "azure-org",
      AZURE_DEVOPS_PROJECT: "azure-project",
      AZURE_DEVOPS_REPO: "azure-repo",
      AZURE_DEVOPS_PULL_REQUEST_ID: "42",
      AZURE_DEVOPS_TOKEN: "azure-token",
    });

    expect(resolved.githubToken).toBe("github-token");
    expect(resolved["azureOrg"]).toBe("azure-org");
    expect(resolved["azureProject"]).toBe("azure-project");
    expect(resolved["azureRepo"]).toBe("azure-repo");
    expect(resolved["azurePullRequestId"]).toBe(42);
    expect(resolved["azureToken"]).toBe("azure-token");
  });

  it("uses the schema default for every field when flags and environment are absent", () => {
    const resolved = resolve();

    for (const field of Object.values(FIELDS)) {
      expect(resolved[field.field], field.field).toBe(field.defaultValue);
    }
  });
});
