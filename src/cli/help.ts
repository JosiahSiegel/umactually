/**
 * CLI help text. Flag descriptions are column-aligned so `--help` output is
 * scannable instead of drifting as flags are added. The longest
 * flag+placeholder (`--provider <openai-compatible|copilot>`) is 38 chars,
 * so descriptions begin at column 42 (2-space indent + 38-char column +
 * 2-space gutter).
 *
 * The `--github-api-base`, `--review-file-limit`, and `--minimum-severity`
 * entries previously sat at unrelated columns (25/27/34); fixing them
 * surfaces the previously-unread descriptions and makes future flag
 * additions trivial.
 */
export const CLI_HELP_TEXT = [
  "umactually-pr-review — provider-agnostic PR review CLI",
  "",
  "Flags:",
  "  --platform <auto|github|azure>",
  "  --event <path>                            GitHub event JSON or Azure pull-request JSON",
  "  --diff <path>                             PR diff text",
  "  --threads <path>                          Azure existing threads JSON (optional in dry-run)",
  "  --review <path>                           Azure provider review JSON (optional in dry-run)",
  "  --pr-number <n>                           Pull request number",
  "  --repo <owner/name>",
  "  --api-url <url>                           Provider Responses API URL (default: https://api.openai.com/v1)",
  "  --api-key <key>                           Provider API key",
  "  --model <id>                              Provider model id (default: auto)",
  "  --prompt <text>                           Inline system prompt override",
  "  --prompt-file <path>",
  "  --additional-prompt <text>",
  "  --additional-prompt-file <path>",
  "  --effort <low|medium|high>                Reasoning effort hint (default: medium)",
  "  --provider <openai-compatible|copilot>",
  "  --github-api-base <url>                   GitHub API base URL (Copilot token exchange; default: https://api.github.com)",
  "  --include-sonarqube",
  "  --sonar-host-url <url>",
  "  --sonar-token <token>",
  "  --sonar-project-key <key>",
  "  --sonar-timeout-seconds <n>",
  "  --review-timeout-seconds <n>",
  "  --stall-seconds <n>",
  "  --per-request-timeout-seconds <n>",
  "  --max-output-tokens <n>",
  "  --max-comments <n>",
  "  --review-file-limit <n>                   Cap on changed files for live review (0 = disable)",
  "  --minimum-severity <low|medium|high>      default: medium",
  "  --walkthrough | --no-walkthrough",
  "  --diagnostic | --no-diagnostic",
  "  --debug-raw-response | --no-debug-raw-response",
  "  --detect-leaks | --no-detect-leaks",
  "  --dry-run | --no-dry-run",
  "  --simulate-findings | --no-simulate-findings",
  "  --output-artifact <path>",
  "",
].join("\n");

export function printHelp(): void {
  process.stdout.write(CLI_HELP_TEXT);
}