// SPDX-License-Identifier: MIT
//
// redactSecretsForLog — pure helper for masking secret-bearing CLI
// flag values before they reach the build log.
//
// This file is intentionally dependency-free (no azure-pipelines-task-lib
// imports, no top-level side effects) so it can be unit-tested
// in isolation via tests/redact-secrets.test.ts. The full task
// entrypoint (index.ts) imports this and uses it when logging the
// spawned CLI's argv.

/**
 * Redact secret-bearing flag values from an argv array before logging.
 *
 * Replaces the value following `--api-key` or `--sonar-token` with
 * `***`. Other args are passed through unchanged. The `--api-url`
 * is NOT a secret (it's a public URL the provider publishes at)
 * so it stays unredacted; if the operator's provider sits behind a
 * non-public URL that contains a token-as-path-segment, that's
 * outside the scope of this helper.
 *
 * The argv-shape is `["--flag", "value", "--flag", "value", ...]`.
 * We only handle the exact flag names `--api-key` and `--sonar-token`
 * — the CLI does not support an `--api-key-from-env` form that
 * would also need masking.
 *
 * @param args  The argv to mask. Not mutated.
 * @returns     A new array with the secret values replaced by `***`.
 */
export function redactSecretsForLog(args: readonly string[]): string[] {
  const SECRET_FLAGS: ReadonlySet<string> = new Set(["--api-key", "--sonar-token"]);
  return args.map((arg, i) => {
    const prev = args[i - 1];
    if (prev !== undefined && SECRET_FLAGS.has(prev)) return "***";
    return arg;
  });
}
