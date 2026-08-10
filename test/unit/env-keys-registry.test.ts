import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { FIELDS } from "../../src/config/field-schema.js";
import { ENV_KEYS } from "../../src/util/env-keys.js";

const EXPECTED_ENV_KEYS = {
  UMACTUALLY_API_URL: "UMACTUALLY_API_URL",
  UMACTUALLY_API_KEY: "UMACTUALLY_API_KEY",
  UMACTUALLY_MODEL: "UMACTUALLY_MODEL",
  UMACTUALLY_PROVIDER: "UMACTUALLY_PROVIDER",
  UMACTUALLY_GITHUB_API_BASE: "UMACTUALLY_GITHUB_API_BASE",
  UMACTUALLY_INSTRUCTION_FILES: "UMACTUALLY_INSTRUCTION_FILES",
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

const PUBLIC_ENV_NAMES = [
  "UMACTUALLY_API_KEY",
  "UMACTUALLY_API_URL",
  "UMACTUALLY_GITHUB_API_BASE",
  "UMACTUALLY_INSTRUCTION_FILES",
  "UMACTUALLY_MODEL",
  "UMACTUALLY_PROVIDER",
] as const;

const FIELD_ENV_REGISTRY_BINDINGS = [
  { field: "apiUrl", keys: ["UMACTUALLY_API_URL"] },
  { field: "apiKey", keys: ["UMACTUALLY_API_KEY"] },
  { field: "model", keys: ["UMACTUALLY_MODEL"] },
  { field: "provider", keys: ["UMACTUALLY_PROVIDER"] },
  { field: "githubApiBase", keys: ["UMACTUALLY_GITHUB_API_BASE"] },
  { field: "instructionFiles", keys: ["UMACTUALLY_INSTRUCTION_FILES"] },
  { field: "githubToken", keys: ["GITHUB_TOKEN", "GH_TOKEN"] },
] as const satisfies ReadonlyArray<{
  readonly field: keyof typeof FIELDS;
  readonly keys: readonly (keyof typeof ENV_KEYS)[];
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
  it("exposes exactly the five supported public UMACTUALLY variables", () => {
    // Given: field-schema is the public user-controlled environment contract.
    // When: all UMACTUALLY-prefixed field bindings are enumerated.
    const publicEnvNames = Object.values(FIELDS)
      .flatMap((field) => field.env)
      .filter((name) => name.startsWith("UMACTUALLY_"))
      .sort();

    // Then: only credentials and connection settings remain environment-controlled.
    expect(publicEnvNames).toEqual(PUBLIC_ENV_NAMES);
  });

  it("pins every supported ENV_KEYS literal byte-for-byte", () => {
    expect(ENV_KEYS).toEqual(EXPECTED_ENV_KEYS);
  });

  it("keeps prompt-files flags and defaults while removing their env bindings", () => {
    expect(FIELDS.promptFiles).toMatchObject({
      flag: "--prompt-files",
      input: "prompt-files",
      env: [],
      type: "string",
      defaultValue: "",
    });
    expect(FIELDS.additionalPromptFiles).toMatchObject({
      flag: "--additional-prompt-files",
      input: "additional-prompt-files",
      env: [],
      type: "string",
      defaultValue: "",
    });
  });

  it("omits the model default rather than using the auto sentinel", () => {
    expect(FIELDS.model.defaultValue).toBe("");
  });

  it("forbids inline public or legacy env string indexing in target files", async () => {
    expect(await findInlineEnvLookups()).toEqual([]);
  });

  it("keeps registry values aligned with field-schema env arrays", () => {
    for (const binding of FIELD_ENV_REGISTRY_BINDINGS) {
      const fieldEnv = FIELDS[binding.field].env;
      for (const key of binding.keys) {
        expect(fieldEnv, `${binding.field}.env should include ENV_KEYS.${key}`).toContain(ENV_KEYS[key]);
      }
    }
  });
});
