import { ENV_KEYS } from "../util/env-keys.js";

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

const GITHUB_ACTIONS_KEY = ENV_KEYS.GITHUB_ACTIONS;
const AZURE_TF_BUILD_KEY = ENV_KEYS.TF_BUILD;

/**
 * GitHub precedence: GITHUB_ACTIONS is checked first, so a process that
 * somehow exposes both `GITHUB_ACTIONS=true` and `TF_BUILD=True` (rare,
 * but possible in nested CI) routes to GitHub. The order is part of the
 * contract — swapping the two arms would silently change behaviour for
 * anyone running the action in a cross-platform test harness.
 */
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
 * Azure Pipelines emits `TF_BUILD=True` (capital T) — the canonical
 * runner value. The helper also accepts `"true"` (lowercase) so local
 * mocked pipelines and `pipeline-init.sh` shell scripts that
 * `export TF_BUILD=true` continue to work, and `"TRUE"` (all uppercase)
 * so a PowerShell `Set-Item env:TF_BUILD=TRUE` mistake does not
 * silently land in `PLATFORM_UNKNOWN` for the operator. Everything else
 * (including `"1"`, `"yes"`, whitespace-padded) is intentionally
 * rejected: the goal is to recognise the three real-world casings, not
 * to be a general truthy-string helper.
 */
function isTruthy(value: string | undefined): boolean {
  return value === "true" || value === "True" || value === "TRUE";
}
