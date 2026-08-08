/**
 * Mapping of env-var names known to `requireLiveConfig` to the canonical
 * CLI flag (without leading `--`) the operator can supply instead.
 *
 * Centralized so every call site surfaces the same remediation hint and
 * so adding a new env var only requires updating this table. When a key
 * is missing, the fallback message just names the env var (no flag hint).
 */
const ENV_VAR_CLI_FLAG: Readonly<Record<string, string>> = {
  UMACTUALLY_API_URL: "api-url",
  UMACTUALLY_API_KEY: "api-key",
  UMACTUALLY_MODEL: "model",
  UMACTUALLY_PROVIDER: "provider",
  UMACTUALLY_GITHUB_API_BASE: "github-api-base",
};

/**
 * Thrown by requireLiveConfig when a required live-review config value is missing.
 * Carries the same code/message shape as LiveReviewError so callers that
 * pattern-match on `code === "LIVE_CONFIG_MISSING"` keep working without
 * importing from cli/live-shared.ts.
 *
 * Carries a separate `hint` field with actionable remediation text the
 * CLI surfaces alongside the message so the operator knows exactly how
 * to fix the missing configuration. The hint is intentionally separate
 * from `message` so machine consumers (CI guards, JSON envelopes) can
 * ignore it without losing the message contract.
 */
export class RequiredConfigError extends Error {
  override readonly name = "RequiredConfigError";

  constructor(
    readonly code: "LIVE_CONFIG_MISSING",
    readonly userMessage: string,
    readonly hint?: string,
  ) {
    super(userMessage);
  }
}

/**
 * Build the canonical user-facing message + remediation hint for a
 * missing live-review config value.
 *
 * Message shape: `${envVarName} must be set for live review.`
 * Hint shape, when the env var has a known CLI flag:
 *   "Set it via --<flag> <value> on the command line,
 *    ${envVarName}=<value> in the environment,
 *    or a CI secret if running in GitHub Actions / Azure Pipelines."
 * Hint shape, when the env var has no known flag (e.g. GITHUB_TOKEN,
 * which the CI runner provides):
 *   "Set it via ${envVarName}=<value> in the environment
 *    (or a CI secret if running in GitHub Actions / Azure Pipelines)."
 *
 * Centralized so the canonical env-var/flag naming cannot drift
 * between the helper and any future caller that wants to surface the
 * same shape (e.g. CLI parse-time, JSON envelope).
 */
export function buildRequiredConfigMessage(
  envVarName: string,
): { readonly message: string; readonly hint: string } {
  const message = `${envVarName} must be set for live review.`;
  const flag = ENV_VAR_CLI_FLAG[envVarName];
  const isPlatformEnvVar =
    envVarName === "GITHUB_TOKEN" || envVarName === "SYSTEM_ACCESSTOKEN";
  const hint =
    flag !== undefined
      ? `Set it via \`--${flag} <value>\` on the command line, \`${envVarName}=<value>\` in the environment, or a CI secret if running in GitHub Actions / Azure Pipelines. Use \`--dry-run\` to skip the provider call entirely for smoke tests.`
      : isPlatformEnvVar
        ? `Set it via \`${envVarName}=<value>\` in the environment (the CI runner should provide this automatically). Use \`--dry-run\` to skip the provider call entirely for smoke tests.`
        : `Set \`${envVarName}=<value>\` in the environment. Use \`--dry-run\` to skip the provider call entirely for smoke tests.`;
  return { message, hint };
}

/**
 * Validate that a required config value is set; throw LIVE_CONFIG_MISSING if not.
 *
 * Both the live-provider dispatcher (cli/live-provider.ts) and the orchestrator
 * (cli/orchestrator.ts) previously hand-rolled this check with byte-identical
 * user-facing messages. This helper is the single source of truth for the
 * message AND the remediation hint.
 *
 * @param value The config value (CLI, env, or default).
 * @param envVarName The env-var NAME used in the user-facing error message.
 * @returns The same value for ergonomic chaining.
 * @throws RequiredConfigError when value is missing or empty. The thrown
 *   error's `message` is the byte-compatible legacy string so existing
 *   tests and any external consumer pattern-matching on the message
 *   keep working; the structured `hint` field carries the remediation.
 */
export function requireLiveConfig(value: string | undefined | null, envVarName: string): string {
  if (value === undefined || value === null || value.length === 0) {
    const { message, hint } = buildRequiredConfigMessage(envVarName);
    throw new RequiredConfigError(
      "LIVE_CONFIG_MISSING",
      message,
      hint,
    );
  }
  return value;
}
