/**
 * CLI help text. Flag descriptions are column-aligned so `--help` output is
 * scannable instead of drifting as flags are added.
 *
 * The longest flag+placeholder is `--provider <openai-compatible|copilot>`
 * (38 chars). With the 2-space indent and 2-space gutter, the description
 * column starts at column 43 (1-indexed) — i.e. 26 padding spaces after
 * the placeholder of a 12-char flag, 0 padding spaces after the 38-char
 * `--provider` placeholder.
 *
 * The `--github-api-base`, `--review-file-limit`, and `--minimum-severity`
 * entries previously sat at unrelated columns (25/27/34); fixing them
 * surfaces the previously-unread descriptions and makes future flag
 * additions trivial.
 */

interface HelpFlag {
  /** Full flag token, e.g. `"--api-url <url>"`. */
  flag: string;
  /** Optional description; omit when the placeholder fully documents the value. */
  description?: string;
}

const HELP_FLAGS: readonly HelpFlag[] = [
  { flag: "--platform <auto|github|azure>" },
  { flag: "--event <path>", description: "GitHub event JSON or Azure pull-request JSON" },
  { flag: "--diff <path>", description: "PR diff text" },
  { flag: "--threads <path>", description: "Azure existing threads JSON (optional in dry-run)" },
  { flag: "--review <path>", description: "Azure provider review JSON (optional in dry-run)" },
  { flag: "--pr-number <n>", description: "Pull request number" },
  { flag: "--repo <owner/name>" },
  { flag: "--api-url <url>", description: "Provider Responses API URL (default: https://api.openai.com/v1)" },
  { flag: "--api-key <key>", description: "Provider API key" },
  { flag: "--model <id>", description: "Provider model id (default: auto)" },
  { flag: "--prompt <text>", description: "Inline system prompt override" },
  { flag: "--prompt-file <path>" },
  { flag: "--additional-prompt <text>" },
  { flag: "--additional-prompt-file <path>" },
  { flag: "--effort <low|medium|high>", description: "Reasoning effort hint (default: medium)" },
  { flag: "--provider <openai-compatible|copilot>", description: "Provider family" },
  { flag: "--github-api-base <url>", description: "GitHub API base URL (Copilot token exchange; default: https://api.github.com)" },
  { flag: "--include-sonarqube" },
  { flag: "--sonar-host-url <url>" },
  { flag: "--sonar-token <token>" },
  { flag: "--sonar-project-key <key>" },
  { flag: "--sonar-timeout-seconds <n>" },
  { flag: "--review-timeout-seconds <n>" },
  { flag: "--stall-seconds <n>" },
  { flag: "--per-request-timeout-seconds <n>" },
  { flag: "--max-output-tokens <n>" },
  { flag: "--max-comments <n>" },
  { flag: "--review-file-limit <n>", description: "Cap on changed files for live review (0 = disable)" },
  { flag: "--minimum-severity <low|medium|high>", description: "default: medium" },
  { flag: "--walkthrough | --no-walkthrough" },
  { flag: "--diagnostic | --no-diagnostic" },
  { flag: "--debug-raw-response | --no-debug-raw-response" },
  { flag: "--detect-leaks | --no-detect-leaks" },
  { flag: "--dry-run | --no-dry-run" },
  { flag: "--simulate-findings | --no-simulate-findings" },
  { flag: "--output-artifact <path>" },
];

const FLAG_COLUMN_WIDTH = HELP_FLAGS.reduce((max, { flag }) => Math.max(max, flag.length), 0);
const GUTTER_SPACES = 2;
const INDENT_SPACES = 2;

/** Render one flag with optional description, padded to the canonical description column. */
function renderFlagLine({ flag, description }: HelpFlag): string {
  const padding = " ".repeat(FLAG_COLUMN_WIDTH - flag.length + GUTTER_SPACES);
  const head = `${" ".repeat(INDENT_SPACES)}${flag}${padding}`;
  return description === undefined ? head : `${head}${description}`;
}

export const CLI_HELP_TEXT = [
  "umactually-pr-review — provider-agnostic PR review CLI",
  "",
  "Flags:",
  ...HELP_FLAGS.map(renderFlagLine),
  "",
].join("\n");

export function printHelp(): void {
  process.stdout.write(CLI_HELP_TEXT);
}