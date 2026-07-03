import { ALL_FIELDS } from "./field-schema.js";
import type { EnvSources } from "./types.js";

// Aliases: the EnvSources-side field name is not a 1:1 match with the
// FIELDS field name. The CLI/Inputs surface uses shorter names
// (`apiUrl`, `apiKey`) while the canonical config-side name is the
// longer `providerUrl` / `providerApiKey` form.
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

// Reverse index: FIELDS-side field name → EnvSources-side field name.
// Derived entirely from `ENV_SOURCE_FIELDS` so it stays in sync.
const FIELDS_TO_ENV_SOURCE: ReadonlyMap<string, keyof EnvSources> = new Map(
  (Object.entries(ENV_SOURCE_FIELDS) as ReadonlyArray<[string, string]>).map(
    ([envSourceName, fieldsName]) => [fieldsName, envSourceName as keyof EnvSources],
  ),
);

// Static allowlist of every `EnvSources` key that appears as a FIELDS
// `field` name with a non-empty env list. Derived once at module load
// from this list + `ALL_FIELDS` + `FIELDS_TO_ENV_SOURCE`.
//
// Why not derive purely from `ALL_FIELDS`? TypeScript optional fields
// (`readonly x?: string`) are not present on an empty object instance,
// so `Object.keys({} as EnvSources)` returns `[]`. We need an explicit
// list of the keys that can appear as `def.field`.
//
// Keeping this in sync: when adding a new EnvSources field to
// `src/config/types.ts` AND a new FIELDS entry that references it
// (with non-empty env vars), append the new EnvSources-side key here.
const DIRECT_ENV_SOURCE_KEYS: ReadonlyArray<keyof EnvSources> = [
  "providerUrl",
  "providerApiKey",
  "providerModel",
  "promptSystemFile",
  "promptUserFile",
  "promptByteCap",
  "walkthrough",
  "diagnostic",
  "dryRun",
  "debugRawResponse",
  "simulateFindings",
  "reviewTimeoutSeconds",
  "stallTimeoutSeconds",
  "perRequestTimeoutSeconds",
  "maxOutputTokens",
  "ignoreMinor",
  "minimumSeverity",
  "maxComments",
  "reviewFileLimit",
  "sonarEnabled",
  "sonarHost",
  "sonarToken",
  "sonarProject",
  "sonarTimeoutSeconds",
  "leakDetection",
  "redactorEnabled",
  "platform",
  "githubApiBase",
  "githubToken",
  "azureOrg",
  "azureProject",
  "azureRepo",
  "azurePullRequestId",
  "azureToken",
];
const DIRECT_ENV_SOURCE_KEYS_SET: ReadonlySet<keyof EnvSources> = new Set(DIRECT_ENV_SOURCE_KEYS);

// The set of EnvSources-side field names that have at least one env var
// configured. Derived entirely from `ALL_FIELDS` + `FIELDS_TO_ENV_SOURCE`
// + `DIRECT_ENV_SOURCE_KEYS_SET` so adding a new field with env vars
// to field-schema.ts automatically enables it here (modulo appending
// to DIRECT_ENV_SOURCE_KEYS if the EnvSources-side name is new).
const DERIVED_ENV_SOURCE_FIELDS: ReadonlySet<keyof EnvSources> = (() => {
  const out = new Set<keyof EnvSources>();
  for (const def of ALL_FIELDS) {
    if (def.env.length === 0) continue;
    // Path (b): aliased — reverse-lookup from FIELDS.field to its EnvSources key.
    const aliased = FIELDS_TO_ENV_SOURCE.get(def.field);
    if (aliased !== undefined) {
      out.add(aliased);
      continue;
    }
    // Path (a): direct — the FIELDS.field name itself is an EnvSources key.
    if (DIRECT_ENV_SOURCE_KEYS_SET.has(def.field as keyof EnvSources)) {
      out.add(def.field as keyof EnvSources);
    }
  }
  return out;
})();

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
  return DERIVED_ENV_SOURCE_FIELDS.has(field as keyof EnvSources);
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
