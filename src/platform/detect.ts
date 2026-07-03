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

function isTruthy(value: string | undefined): boolean {
  return value === "true";
}