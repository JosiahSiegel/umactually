/**
 * Thrown by requireLiveConfig when a required live-review config value is missing.
 * Carries the same code/message shape as LiveReviewError so callers that
 * pattern-match on `code === "LIVE_CONFIG_MISSING"` keep working without
 * importing from cli/live-shared.ts.
 */
export class RequiredConfigError extends Error {
  override readonly name = "RequiredConfigError";

  constructor(
    readonly code: "LIVE_CONFIG_MISSING",
    readonly userMessage: string,
  ) {
    super(userMessage);
  }
}

/**
 * Validate that a required config value is set; throw LIVE_CONFIG_MISSING if not.
 *
 * Both the live-provider dispatcher (cli/live-provider.ts) and the orchestrator
 * (cli/orchestrator.ts) previously hand-rolled this check with byte-identical
 * user-facing messages. This helper is the single source of truth.
 *
 * @param value The config value (CLI, env, or default).
 * @param envVarName The env-var NAME used in the user-facing error message.
 * @returns The same value for ergonomic chaining.
 * @throws RequiredConfigError when value is missing or empty.
 */
export function requireLiveConfig(value: string | undefined | null, envVarName: string): string {
  if (value === undefined || value === null || value.length === 0) {
    throw new RequiredConfigError(
      "LIVE_CONFIG_MISSING",
      `${envVarName} must be set for live review.`,
    );
  }
  return value;
}
