/** Canonical CI-platform union. "azure-devops" is the on-the-wire spelling
 *  (kept for parity with the Azure DevOps SDK and the action.yml platform
 *  input). Aliased to "azure" internally by the platform resolver. */
export type CiPlatform = "github" | "azure-devops" | "unknown";

export class PlatformDetectionError extends Error {
  override readonly name = "PlatformDetectionError";
  readonly code: "PLATFORM_UNKNOWN" = "PLATFORM_UNKNOWN";

  constructor() {
    super("Unable to detect a supported CI platform from the process environment.");
  }
}

const GITHUB_ACTIONS_KEY = "GITHUB_ACTIONS";
const AZURE_TF_BUILD_KEY = "TF_BUILD";

export function detectPlatform(env: NodeJS.ProcessEnv): CiPlatform {
  if (isTruthy(env[GITHUB_ACTIONS_KEY])) {
    return "github";
  }

  if (isTruthy(env[AZURE_TF_BUILD_KEY])) {
    return "azure-devops";
  }

  throw new PlatformDetectionError();
}

/**
 * Recognise CI-platform "marker present" values.
 *
 * Azure Pipelines emits `TF_BUILD=True` (capital T) — that is the only
 * real-world value but the canonical helper also accepts `"true"` so
 * local mocked pipelines and `pipeline-init.sh` shell scripts that
 * `export TF_BUILD=true` continue to work. Everything else (including
 * `"True "`, `"TRUE"`, `"1"`, `"yes"`) is intentionally rejected: a
 * wrong-case value would only ever come from a manual export, and we
 * want the false-negative to surface as `PLATFORM_UNKNOWN` instead of
 * silently mis-detecting.
 */
function isTruthy(value: string | undefined): boolean {
  return value === "true" || value === "True";
}