import { ALL_FIELDS } from "./field-schema.js";
import type { EnvSources } from "./types.js";

const ENV_SOURCE_FIELDS = {
  apiUrl: "providerUrl",
  apiKey: "providerApiKey",
  model: "providerModel",
  promptFile: "promptSystemFile",
  additionalPromptFile: "promptUserFile",
  stallSeconds: "stallTimeoutSeconds",
  includeSonarqube: "sonarEnabled",
  sonarHostUrl: "sonarHost",
  sonarProjectKey: "sonarProject",
  detectLeaks: "leakDetection",
} as const satisfies Partial<Record<string, keyof EnvSources>>;

type FieldSchemaName = keyof typeof ENV_SOURCE_FIELDS;

function mapFieldToEnvSource(field: string): keyof EnvSources | null {
  if (isMappedField(field)) {
    return ENV_SOURCE_FIELDS[field];
  }
  if (isEnvSourceField(field)) {
    return field;
  }
  return null;
}

function isMappedField(field: string): field is FieldSchemaName {
  return Object.hasOwn(ENV_SOURCE_FIELDS, field);
}

function isEnvSourceField(field: string): field is keyof EnvSources {
  return [
    "promptByteCap",
    "walkthrough",
    "diagnostic",
    "dryRun",
    "debugRawResponse",
    "simulateFindings",
    "reviewTimeoutSeconds",
    "perRequestTimeoutSeconds",
    "maxOutputTokens",
    "ignoreMinor",
    "minimumSeverity",
    "maxComments",
    "reviewFileLimit",
    "sonarToken",
    "sonarTimeoutSeconds",
    "redactorEnabled",
    "platform",
    "githubApiBase",
    "githubToken",
    "azureOrg",
    "azureProject",
    "azureRepo",
    "azurePullRequestId",
    "azureToken",
  ].includes(field);
}

/**
 * Pure: extracts the known env-var keys from `env` into an EnvSources object.
 * UMACTUALLY_* takes precedence over REVIEW_* when both are set.
 * Never logs values. Empty/missing keys are simply omitted.
 *
 * The canonical env-var set is derived from `FIELDS` in
 * `src/config/field-schema.ts`.
 */
export function readEnvSources(env: NodeJS.ProcessEnv = process.env): EnvSources {
  const out: {
    -readonly [K in keyof EnvSources]: EnvSources[K];
  } = {};
  for (const def of ALL_FIELDS) {
    if (def.env.length === 0) {
      continue;
    }
    const envSourceField = mapFieldToEnvSource(def.field);
    if (envSourceField === null) {
      continue;
    }
    for (const envName of def.env) {
      const value = env[envName];
      if (typeof value === "string" && value.trim().length > 0) {
        out[envSourceField] = value;
        break;
      }
    }
  }
  return out;
}
