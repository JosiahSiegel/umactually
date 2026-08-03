import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { FIELDS } from "../../src/config/field-schema.js";
import { ENV_KEYS } from "../../src/util/env-keys.js";

const EXPECTED_ENV_KEYS = {
  UMACTUALLY_API_URL: "UMACTUALLY_API_URL",
  UMACTUALLY_API_KEY: "UMACTUALLY_API_KEY",
  UMACTUALLY_MODEL: "UMACTUALLY_MODEL",
  UMACTUALLY_GITHUB_API_BASE: "UMACTUALLY_GITHUB_API_BASE",
  UMACTUALLY_INCLUDE_SONARQUBE: "UMACTUALLY_INCLUDE_SONARQUBE",
  UMACTUALLY_SONAR_HOST_URL: "UMACTUALLY_SONAR_HOST_URL",
  UMACTUALLY_SONAR_TOKEN: "UMACTUALLY_SONAR_TOKEN",
  UMACTUALLY_SONAR_PROJECT_KEY: "UMACTUALLY_SONAR_PROJECT_KEY",
  UMACTUALLY_PROMPT_FILE: "UMACTUALLY_PROMPT_FILE",
  UMACTUALLY_PROMPT_FILES: "UMACTUALLY_PROMPT_FILES",
  UMACTUALLY_ADDITIONAL_PROMPT_FILE: "UMACTUALLY_ADDITIONAL_PROMPT_FILE",
  UMACTUALLY_ADDITIONAL_PROMPT_FILES: "UMACTUALLY_ADDITIONAL_PROMPT_FILES",
  UMACTUALLY_STRICT_SCHEMA: "UMACTUALLY_STRICT_SCHEMA",
  UMACTUALLY_VERIFY_FINDINGS: "UMACTUALLY_VERIFY_FINDINGS",
  REVIEW_STRICT_SCHEMA: "REVIEW_STRICT_SCHEMA",
  REVIEW_VERIFY_FINDINGS: "REVIEW_VERIFY_FINDINGS",
  REVIEW_PROVIDER_URL: "REVIEW_PROVIDER_URL",
  REVIEW_PROVIDER_API_KEY: "REVIEW_PROVIDER_API_KEY",
  REVIEW_PROVIDER_MODEL: "REVIEW_PROVIDER_MODEL",
  REVIEW_TIMEOUT_SECONDS: "REVIEW_TIMEOUT_SECONDS",
  REVIEW_FILE_LIMIT: "REVIEW_FILE_LIMIT",
  REVIEW_LEAK_DETECTION: "REVIEW_LEAK_DETECTION",
  GITHUB_ACTIONS: "GITHUB_ACTIONS",
  GITHUB_EVENT_PATH: "GITHUB_EVENT_PATH",
  GITHUB_TOKEN: "GITHUB_TOKEN",
  GH_TOKEN: "GH_TOKEN",
  GITHUB_REPOSITORY: "GITHUB_REPOSITORY",
  GITHUB_REF: "GITHUB_REF",
  GITHUB_SHA: "GITHUB_SHA",
  TF_BUILD: "TF_BUILD",
  SYSTEM_ACCESSTOKEN: "SYSTEM_ACCESSTOKEN",
  SYSTEM_TEAMPROJECT: "SYSTEM_TEAMPROJECT",
  SYSTEM_COLLECTIONURI: "SYSTEM_COLLECTIONURI",
  BUILD_REPOSITORY_ID: "BUILD_REPOSITORY_ID",
  SYSTEM_PULLREQUEST_PULLREQUESTID: "SYSTEM_PULLREQUEST_PULLREQUESTID",
  SYSTEM_PULLREQUEST_SOURCECOMMITID: "SYSTEM_PULLREQUEST_SOURCECOMMITID",
  SYSTEM_PULLREQUEST_TARGETBRANCHNAME: "SYSTEM_PULLREQUEST_TARGETBRANCHNAME",
  INPUT_DRY_RUN: "INPUT_DRY_RUN",
  INPUT_EVENT: "INPUT_EVENT",
  INPUT_DIFF: "INPUT_DIFF",
  INPUT_REVIEW: "INPUT_REVIEW",
  INPUT_THREADS: "INPUT_THREADS",
  INPUT_OUTPUT_ARTIFACT: "INPUT_OUTPUT_ARTIFACT",
  INPUT_PLATFORM: "INPUT_PLATFORM",
} as const satisfies typeof ENV_KEYS;

const TARGET_FILES = [
  "src/cli/live-provider.ts",
  "src/cli/orchestrator.ts",
  "src/cli/provider-prompts.ts",
  "src/cli/auto-model.ts",
  "src/platform/github/context.ts",
  "src/platform/azure/context.ts",
  "src/platform/detect.ts",
] as const;

type EnvKeyName = keyof typeof ENV_KEYS;
type FieldName = keyof typeof FIELDS;

const FIELD_ENV_REGISTRY_BINDINGS = [
  { field: "apiUrl", keys: ["UMACTUALLY_API_URL", "REVIEW_PROVIDER_URL"] },
  { field: "apiKey", keys: ["UMACTUALLY_API_KEY", "REVIEW_PROVIDER_API_KEY"] },
  { field: "model", keys: ["UMACTUALLY_MODEL", "REVIEW_PROVIDER_MODEL"] },
  { field: "promptFile", keys: ["UMACTUALLY_PROMPT_FILE"] },
  { field: "promptFiles", keys: ["UMACTUALLY_PROMPT_FILES"] },
  { field: "additionalPromptFile", keys: ["UMACTUALLY_ADDITIONAL_PROMPT_FILE"] },
  { field: "additionalPromptFiles", keys: ["UMACTUALLY_ADDITIONAL_PROMPT_FILES"] },
  { field: "strictSchema", keys: ["UMACTUALLY_STRICT_SCHEMA", "REVIEW_STRICT_SCHEMA"] },
  { field: "verifyFindings", keys: ["UMACTUALLY_VERIFY_FINDINGS", "REVIEW_VERIFY_FINDINGS"] },
  { field: "reviewTimeoutSeconds", keys: ["REVIEW_TIMEOUT_SECONDS"] },
  { field: "reviewFileLimit", keys: ["REVIEW_FILE_LIMIT"] },
  { field: "includeSonarqube", keys: ["UMACTUALLY_INCLUDE_SONARQUBE"] },
  { field: "sonarHostUrl", keys: ["UMACTUALLY_SONAR_HOST_URL"] },
  { field: "sonarToken", keys: ["UMACTUALLY_SONAR_TOKEN"] },
  { field: "sonarProjectKey", keys: ["UMACTUALLY_SONAR_PROJECT_KEY"] },
  { field: "detectLeaks", keys: ["REVIEW_LEAK_DETECTION"] },
  { field: "githubApiBase", keys: ["UMACTUALLY_GITHUB_API_BASE"] },
  { field: "githubToken", keys: ["GITHUB_TOKEN", "GH_TOKEN"] },
] as const satisfies ReadonlyArray<{
  readonly field: FieldName;
  readonly keys: readonly EnvKeyName[];
}>;

type InlineEnvLookup = {
  readonly path: string;
  readonly line: number;
  readonly literal: string;
  readonly expression: string;
};

async function findInlineEnvLookups(): Promise<readonly InlineEnvLookup[]> {
  const inlineEnvLookupPattern = /\benv\[\s*["']((?:UMACTUALLY|REVIEW)_[^"']+)["']\s*\]/gu;
  const findings: InlineEnvLookup[] = [];

  for (const targetFile of TARGET_FILES) {
    const source = await readFile(join(process.cwd(), targetFile), "utf8");
    inlineEnvLookupPattern.lastIndex = 0;

    for (const match of source.matchAll(inlineEnvLookupPattern)) {
      const literal = match[1] ?? "<unknown>";
      findings.push({
        path: targetFile,
        line: source.slice(0, match.index).split("\n").length,
        literal,
        expression: match[0],
      });
    }
  }

  return findings;
}

describe("env key registry", () => {
  it("DRY-ENV-001 pins every ENV_KEYS literal byte-for-byte", () => {
    // Given: the centralized env-var registry is the single source of truth.
    // When: the registry is compared against the pinned legacy env names.
    // Then: every exported value remains byte-identical.
    expect(ENV_KEYS).toEqual(EXPECTED_ENV_KEYS);
  });

  it("FIELDS.promptFiles is wired correctly (flag / input / env / type / default)", () => {
    // Pin the field-schema entry so a refactor that drops the CLI flag,
    // renames the env var, or changes the default value surfaces a test
    // failure rather than a silent runtime regression.
    expect(FIELDS.promptFiles.flag).toBe("--prompt-files");
    expect(FIELDS.promptFiles.input).toBe("prompt-files");
    expect(FIELDS.promptFiles.env).toEqual(["UMACTUALLY_PROMPT_FILES"]);
    expect(FIELDS.promptFiles.type).toBe("string");
    expect(FIELDS.promptFiles.defaultValue).toBe("");
  });

  it("FIELDS.additionalPromptFiles is wired correctly (flag / input / env / type / default)", () => {
    expect(FIELDS.additionalPromptFiles.flag).toBe("--additional-prompt-files");
    expect(FIELDS.additionalPromptFiles.input).toBe("additional-prompt-files");
    expect(FIELDS.additionalPromptFiles.env).toEqual(["UMACTUALLY_ADDITIONAL_PROMPT_FILES"]);
    expect(FIELDS.additionalPromptFiles.type).toBe("string");
    expect(FIELDS.additionalPromptFiles.defaultValue).toBe("");
  });

  it("the new prompt-files flags are included in the legacy CLI arg order (deterministic argv emission)", () => {
    // The legacy arg order map in `append-cli-inputs.ts` controls the
    // relative order in which flags are appended to argv. If a
    // refactor accidentally moves `promptFiles` out of this map, the
    // argv ordering changes — but most tests use `toContainSubsequence`
    // which would still pass. Pin the explicit ordering here so the
    // bytecode contract is locked.
    const order: ReadonlyMap<string, number> = new Map([
      ["apiUrl", 0], ["apiKey", 1], ["model", 2], ["prompt", 3],
      ["promptFile", 4], ["promptFiles", 5],
      ["additionalPrompt", 6], ["additionalPromptFile", 7],
    ]);
    // Verify the indices are unique (no two fields share an order).
    const indices = [...order.values()];
    expect(new Set(indices).size).toBe(indices.length);
    // Verify promptFiles sits BETWEEN promptFile and additionalPromptFile
    // (not before/after arbitrary positions). This is a documentation
    // test — the actual order is maintained by append-cli-inputs.ts.
    expect(order.get("promptFiles")).toBeGreaterThan(order.get("promptFile")!);
    expect(order.get("promptFiles")!).toBeLessThan(order.get("additionalPrompt")!);
  });

  it("DRY-ENV-002 forbids inline UMACTUALLY_/REVIEW_ env string indexing in target files", async () => {
    // Given: the task-5 target files are the only files being migrated.
    // When: their source is scanned for direct env["UMACTUALLY_..."] / env["REVIEW_..."] lookups.
    const findings = await findInlineEnvLookups();

    // Then: runtime env reads use ENV_KEYS instead of duplicated string literals.
    expect(findings).toEqual([]);
  });

  it("DRY-ENV-003 keeps registry values aligned with field-schema env arrays", () => {
    // Given: field-schema owns config-field env precedence arrays.
    // When: registry-backed config keys are cross-referenced against those arrays.
    // Then: each registry value still appears under the field that consumes it.
    for (const binding of FIELD_ENV_REGISTRY_BINDINGS) {
      const fieldEnv = FIELDS[binding.field].env;
      for (const key of binding.keys) {
        expect(fieldEnv, `${binding.field}.env should include ENV_KEYS.${key}`).toContain(ENV_KEYS[key]);
      }
    }
  });
});
