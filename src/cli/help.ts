export const CLI_HELP_TEXT = [
  "umactually-pr-review — provider-agnostic PR review CLI",
  "",
  "Flags:",
  "  --platform <auto|github|azure>",
  "  --event <path>          GitHub event JSON or Azure pull-request JSON",
  "  --diff <path>           PR diff text",
  "  --threads <path>        Azure existing threads JSON (optional in dry-run)",
  "  --review <path>         Azure provider review JSON (optional in dry-run)",
  "  --pr-number <n>         Pull request number",
  "  --repo <owner/name>",
  "  --api-url <url>         Provider Responses API URL",
  "  --api-key <key>         Provider API key",
  "  --model <id>            Provider model id",
  "  --prompt-file <path>",
  "  --additional-prompt-file <path>",
  "  --include-sonarqube",
  "  --sonar-host-url <url>",
  "  --sonar-token <token>",
  "  --sonar-project-key <key>",
  "  --ignore-minor",
  "  --detect-leaks | --no-detect-leaks",
  "  --dry-run               Write artifact JSON only, no provider calls",
  "  --output-artifact <path>",
  "",
].join("\n");

export function printHelp(): void {
  process.stdout.write(CLI_HELP_TEXT);
}