/**
 * Single source of truth for every config field the runtime reads.
 *
 * Replaces three parallel lists that were previously hand-synced:
 *   1. `src/config/env-sources.ts` — env-var names → EnvSources field
 *   2. `src/action/read-inputs.ts` — INPUT_* names → ActionInputs field
 *   3. `src/action/append-cli-inputs.ts` + `src/cli/parse-args.ts` —
 *      CLI flag names → parsed-args field
 *
 * Each `FIELD` entry binds one runtime config value to the surface that
 * can set it (env vars + action INPUT + CLI flag) plus its type and default.
 *
 * The action-layer (`readActionInputs`) reads `input`; the loader reads
 * `env[]`; the CLI parser/builder reads `flag`. Adding a new field means
 * one entry here, not four edits.
 *
 * Fields NOT exposed via CLI flag still appear here for the loader + env
 * layers (azureOrg, githubToken, etc.) — only `flag` is optional.
 */
export type FieldType = "string" | "integer" | "boolean" | "enum";

export type FieldDef<
  TType extends FieldType,
  TFlag extends string | null = string | null,
> = {
  /** Canonical field name (matches the action-side property). */
  readonly field: string;
  /** CLI flag including leading `--` (null when the field is not flag-exposed). */
  readonly flag: TFlag;
  /** Action INPUT_* base name (without the `INPUT_` prefix). */
  readonly input: string;
  /** Env-var names. First non-empty wins. */
  readonly env: readonly string[];
  /** "string" | "integer" | "boolean" | "enum". */
  readonly type: TType;
  /** Default value used when none of the surfaces supply one. */
  readonly defaultValue: string | number | boolean | null;
  /** For type="enum", the set of accepted values (case-sensitive on the wire). */
  readonly enumValues?: readonly string[];
};

export const FIELDS = {
  apiUrl: {
    field: "apiUrl",
    flag: "--api-url",
    input: "api-url",
    env: ["UMACTUALLY_API_URL", "REVIEW_PROVIDER_URL"],
    type: "string",
    defaultValue: "",
  },
  apiKey: {
    field: "apiKey",
    flag: "--api-key",
    input: "api-key",
    env: ["UMACTUALLY_API_KEY", "REVIEW_PROVIDER_API_KEY"],
    type: "string",
    defaultValue: "",
  },
  model: {
    field: "model",
    flag: "--model",
    input: "model",
    env: ["UMACTUALLY_MODEL", "REVIEW_PROVIDER_MODEL"],
    type: "string",
    defaultValue: "auto",
  },
  prompt: {
    field: "prompt",
    flag: "--prompt",
    input: "prompt",
    env: [],
    type: "string",
    defaultValue: "",
  },
  promptFile: {
    field: "promptFile",
    flag: "--prompt-file",
    input: "prompt-file",
    env: ["UMACTUALLY_PROMPT_FILE", "REVIEW_PROMPT_SYSTEM_FILE"],
    type: "string",
    defaultValue: "",
  },
  additionalPrompt: {
    field: "additionalPrompt",
    flag: "--additional-prompt",
    input: "additional-prompt",
    env: [],
    type: "string",
    defaultValue: "",
  },
  additionalPromptFile: {
    field: "additionalPromptFile",
    flag: "--additional-prompt-file",
    input: "additional-prompt-file",
    env: ["UMACTUALLY_ADDITIONAL_PROMPT_FILE", "REVIEW_PROMPT_USER_FILE"],
    type: "string",
    defaultValue: "",
  },
  walkthrough: {
    field: "walkthrough",
    flag: "--walkthrough",
    input: "walkthrough",
    env: ["UMACTUALLY_WALKTHROUGH", "REVIEW_WALKTHROUGH"],
    type: "boolean",
    defaultValue: false,
  },
  diagnostic: {
    field: "diagnostic",
    flag: "--diagnostic",
    input: "diagnostic",
    env: ["UMACTUALLY_DIAGNOSTIC", "REVIEW_DIAGNOSTIC"],
    type: "boolean",
    defaultValue: false,
  },
  dryRun: {
    field: "dryRun",
    flag: "--dry-run",
    input: "dry-run",
    env: ["UMACTUALLY_DRY_RUN", "REVIEW_DRY_RUN"],
    type: "boolean",
    defaultValue: false,
  },
  debugRawResponse: {
    field: "debugRawResponse",
    flag: "--debug-raw-response",
    input: "debug-raw-response",
    env: ["REVIEW_DEBUG_RAW_RESPONSE"],
    type: "boolean",
    defaultValue: false,
  },
  simulateFindings: {
    field: "simulateFindings",
    flag: "--simulate-findings",
    input: "simulate-findings",
    env: ["UMACTUALLY_SIMULATE_FINDINGS", "REVIEW_SIMULATE_FINDINGS"],
    type: "boolean",
    defaultValue: false,
  },
  reviewTimeoutSeconds: {
    field: "reviewTimeoutSeconds",
    flag: "--review-timeout-seconds",
    input: "review-timeout-seconds",
    env: ["UMACTUALLY_REVIEW_TIMEOUT_SECONDS", "REVIEW_TIMEOUT_SECONDS"],
    type: "integer",
    defaultValue: 300,
  },
  stallSeconds: {
    field: "stallSeconds",
    flag: "--stall-seconds",
    input: "stall-seconds",
    env: ["UMACTUALLY_STALL_SECONDS", "REVIEW_STALL_SECONDS"],
    type: "integer",
    defaultValue: 270,
  },
  perRequestTimeoutSeconds: {
    field: "perRequestTimeoutSeconds",
    flag: "--per-request-timeout-seconds",
    input: "per-request-timeout-seconds",
    env: ["REVIEW_PER_REQUEST_TIMEOUT_SECONDS"],
    type: "integer",
    defaultValue: 60,
  },
  maxOutputTokens: {
    field: "maxOutputTokens",
    flag: "--max-output-tokens",
    input: "max-output-tokens",
    env: ["UMACTUALLY_MAX_OUTPUT_TOKENS"],
    type: "integer",
    defaultValue: 16_000,
  },
  ignoreMinor: {
    field: "ignoreMinor",
    flag: "--ignore-minor",
    input: "ignore-minor",
    env: ["UMACTUALLY_IGNORE_MINOR", "REVIEW_IGNORE_MINOR"],
    type: "boolean",
    defaultValue: false,
  },
  minimumSeverity: {
    field: "minimumSeverity",
    flag: "--minimum-severity",
    input: "minimum-severity",
    env: ["REVIEW_MINIMUM_SEVERITY"],
    type: "enum",
    // BREAKING CHANGE (unreleased): default flipped from "low" to "medium"
    // so low-severity (style/hygiene) findings are filtered out of the
    // postable set by default. Users who want to keep low findings
    // inline can set `minimum-severity: low` explicitly.
    defaultValue: "medium",
    enumValues: ["low", "medium", "high"],
  },
  maxComments: {
    field: "maxComments",
    flag: "--max-comments",
    input: "max-comments",
    env: ["REVIEW_MAX_COMMENTS"],
    type: "integer",
    defaultValue: 50,
  },
  reviewFileLimit: {
    field: "reviewFileLimit",
    flag: "--review-file-limit",
    input: "review-file-limit",
    env: ["REVIEW_FILE_LIMIT"],
    type: "integer",
    defaultValue: 200,
  },
  includeSonarqube: {
    field: "includeSonarqube",
    flag: "--include-sonarqube",
    input: "include-sonarqube",
    env: ["UMACTUALLY_INCLUDE_SONARQUBE", "REVIEW_SONAR_ENABLED"],
    type: "boolean",
    defaultValue: false,
  },
  sonarHostUrl: {
    field: "sonarHostUrl",
    flag: "--sonar-host-url",
    input: "sonar-host-url",
    env: ["UMACTUALLY_SONAR_HOST_URL", "REVIEW_SONAR_HOST"],
    type: "string",
    defaultValue: "",
  },
  sonarToken: {
    field: "sonarToken",
    flag: "--sonar-token",
    input: "sonar-token",
    env: ["UMACTUALLY_SONAR_TOKEN", "REVIEW_SONAR_TOKEN"],
    type: "string",
    defaultValue: "",
  },
  sonarProjectKey: {
    field: "sonarProjectKey",
    flag: "--sonar-project-key",
    input: "sonar-project-key",
    env: ["UMACTUALLY_SONAR_PROJECT_KEY", "REVIEW_SONAR_PROJECT"],
    type: "string",
    defaultValue: "",
  },
  sonarTimeoutSeconds: {
    field: "sonarTimeoutSeconds",
    flag: "--sonar-timeout-seconds",
    input: "sonar-timeout-seconds",
    env: ["REVIEW_SONAR_TIMEOUT_SECONDS"],
    type: "integer",
    defaultValue: 300,
  },
  detectLeaks: {
    field: "detectLeaks",
    flag: "--detect-leaks",
    input: "detect-leaks",
    env: ["UMACTUALLY_DETECT_LEAKS", "REVIEW_LEAK_DETECTION"],
    type: "boolean",
    defaultValue: true,
  },
  platform: {
    field: "platform",
    flag: "--platform",
    input: "platform",
    env: ["REVIEW_PLATFORM"],
    type: "enum",
    defaultValue: "auto",
    // Canonical three variants. The CLI parser accepts the `"azure-devops"`
    // alias and normalizes to `"azure"` before this field is reached; the
    // config loader therefore only sees the canonical set.
    enumValues: ["auto", "github", "azure"],
  },
  prNumber: {
    field: "prNumber",
    flag: "--pr-number",
    input: "pr-number",
    env: [],
    type: "string",
    defaultValue: "",
  },
  repo: {
    field: "repo",
    flag: "--repo",
    input: "repo",
    env: [],
    type: "string",
    defaultValue: "",
  },
  effort: {
    field: "effort",
    flag: "--effort",
    input: "effort",
    env: [],
    type: "enum",
    defaultValue: "medium",
    enumValues: ["low", "medium", "high"],
  },
  provider: {
    field: "provider",
    flag: "--provider",
    input: "provider",
    env: [],
    type: "enum",
    defaultValue: "openai-compatible",
    enumValues: ["openai-compatible", "copilot"],
  },
  githubApiBase: {
    field: "githubApiBase",
    flag: "--github-api-base",
    input: "github-api-base",
    env: ["UMACTUALLY_GITHUB_API_BASE"],
    type: "string",
    defaultValue: "",
  },
  githubToken: {
    field: "githubToken",
    flag: null,
    input: "github_token",
    env: ["GITHUB_TOKEN"],
    type: "string",
    defaultValue: "",
  },
  promptByteCap: {
    field: "promptByteCap",
    flag: null,
    input: "prompt-byte-cap",
    env: ["REVIEW_PROMPT_BYTE_CAP"],
    type: "integer",
    defaultValue: 65_536,
  },
  redactorEnabled: {
    field: "redactorEnabled",
    flag: null,
    input: "redactor-enabled",
    env: ["REVIEW_REDACTOR_ENABLED"],
    type: "boolean",
    defaultValue: true,
  },
  azureOrg: {
    field: "azureOrg",
    flag: null,
    input: "azure-org",
    env: ["AZURE_DEVOPS_ORG"],
    type: "string",
    defaultValue: "",
  },
  azureProject: {
    field: "azureProject",
    flag: null,
    input: "azure-project",
    env: ["AZURE_DEVOPS_PROJECT"],
    type: "string",
    defaultValue: "",
  },
  azureRepo: {
    field: "azureRepo",
    flag: null,
    input: "azure-repo",
    env: ["AZURE_DEVOPS_REPO"],
    type: "string",
    defaultValue: "",
  },
  azurePullRequestId: {
    field: "azurePullRequestId",
    flag: null,
    input: "azure-pull-request-id",
    env: ["AZURE_DEVOPS_PULL_REQUEST_ID"],
    type: "integer",
    defaultValue: 0,
  },
  azureToken: {
    field: "azureToken",
    flag: null,
    input: "azure-token",
    env: ["AZURE_DEVOPS_TOKEN"],
    type: "string",
    defaultValue: "",
  },
} as const satisfies Record<string, FieldDef<FieldType>>;

export type FieldName = keyof typeof FIELDS;

/** All fields in declaration order. */
export const ALL_FIELDS: readonly FieldDef<FieldType>[] = Object.values(FIELDS);

/**
 * Set of every env-var name the runtime reads (across all fields, deduped).
 * Useful for sanity checks, smoke tests, and any future "unknown env-var"
 * diagnostics. Derived from the field-schema so adding a field's env entries
 * here keeps the set in sync without any other code changes.
 */
export const KNOWN_ENV_VAR_NAMES: ReadonlySet<string> = new Set(
  ALL_FIELDS.flatMap((def) => def.env),
);
