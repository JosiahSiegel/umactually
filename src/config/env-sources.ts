import type { EnvSources } from "./types.js";

// UMACTUALLY_* env vars are the canonical secrets surface for the GitHub Actions
// and Azure DevOps deployments. REVIEW_* keys remain as a backward-compatible
// fallback so the legacy reference tooling still resolves the same fields.
// Both are recorded into EnvSources; callers pick the first defined value.
const ENV_KEYS: ReadonlyArray<readonly [keyof EnvSources, readonly string[]]> = [
  ["providerUrl", ["UMACTUALLY_API_URL", "REVIEW_PROVIDER_URL"]],
  ["providerApiKey", ["UMACTUALLY_API_KEY", "REVIEW_PROVIDER_API_KEY"]],
  ["providerModel", ["UMACTUALLY_MODEL", "REVIEW_PROVIDER_MODEL"]],
  ["promptSystemFile", ["UMACTUALLY_PROMPT_FILE", "REVIEW_PROMPT_SYSTEM_FILE"]],
  ["promptUserFile", ["UMACTUALLY_ADDITIONAL_PROMPT_FILE", "REVIEW_PROMPT_USER_FILE"]],
  ["promptByteCap", ["REVIEW_PROMPT_BYTE_CAP"]],
  ["walkthrough", ["UMACTUALLY_WALKTHROUGH", "REVIEW_WALKTHROUGH"]],
  ["diagnostic", ["UMACTUALLY_DIAGNOSTIC", "REVIEW_DIAGNOSTIC"]],
  ["dryRun", ["UMACTUALLY_DRY_RUN", "REVIEW_DRY_RUN"]],
  ["debugRawResponse", ["REVIEW_DEBUG_RAW_RESPONSE"]],
  ["reviewTimeoutSeconds", ["UMACTUALLY_REVIEW_TIMEOUT_SECONDS", "REVIEW_TIMEOUT_SECONDS"]],
  ["stallTimeoutSeconds", ["UMACTUALLY_STALL_SECONDS", "REVIEW_STALL_SECONDS"]],
  ["perRequestTimeoutSeconds", ["REVIEW_PER_REQUEST_TIMEOUT_SECONDS"]],
  ["ignoreMinor", ["UMACTUALLY_IGNORE_MINOR", "REVIEW_IGNORE_MINOR"]],
  ["minimumSeverity", ["REVIEW_MINIMUM_SEVERITY"]],
  ["maxComments", ["REVIEW_MAX_COMMENTS"]],
  ["sonarEnabled", ["UMACTUALLY_INCLUDE_SONARQUBE", "REVIEW_SONAR_ENABLED"]],
  ["sonarHost", ["UMACTUALLY_SONAR_HOST_URL", "REVIEW_SONAR_HOST"]],
  ["sonarToken", ["UMACTUALLY_SONAR_TOKEN", "REVIEW_SONAR_TOKEN"]],
  ["sonarProject", ["UMACTUALLY_SONAR_PROJECT_KEY", "REVIEW_SONAR_PROJECT"]],
  ["sonarTimeoutSeconds", ["REVIEW_SONAR_TIMEOUT_SECONDS"]],
  ["leakDetection", ["UMACTUALLY_DETECT_LEAKS", "REVIEW_LEAK_DETECTION"]],
  ["redactorEnabled", ["REVIEW_REDACTOR_ENABLED"]],
  ["platform", ["REVIEW_PLATFORM"]],
  ["githubToken", ["GITHUB_TOKEN"]],
  ["azureOrg", ["AZURE_DEVOPS_ORG"]],
  ["azureProject", ["AZURE_DEVOPS_PROJECT"]],
  ["azureRepo", ["AZURE_DEVOPS_REPO"]],
  ["azurePullRequestId", ["AZURE_DEVOPS_PULL_REQUEST_ID"]],
  ["azureToken", ["AZURE_DEVOPS_TOKEN"]],
];

/**
 * Pure: extracts the known env-var keys from `env` into an EnvSources object.
 * UMACTUALLY_* takes precedence over REVIEW_* when both are set.
 * Never logs values. Empty/missing keys are simply omitted.
 */
export function readEnvSources(env: NodeJS.ProcessEnv = process.env): EnvSources {
  const out: {
    -readonly [K in keyof EnvSources]: EnvSources[K];
  } = {};
  for (const [field, envNames] of ENV_KEYS) {
    for (const envName of envNames) {
      const v = env[envName];
      if (typeof v === "string" && v.trim().length > 0) {
        out[field] = v;
        break;
      }
    }
  }
  return out;
}