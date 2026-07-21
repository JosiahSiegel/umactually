/**
 * CLI help text. Flag descriptions are column-aligned so `--help` output is
 * scannable instead of drifting as flags are added.
 *
 * `FLAG_COLUMN_WIDTH` is computed at runtime from the longest entry in
 * `HELP_FLAGS` (currently `--debug-raw-response | --no-debug-raw-response`
 * at 46 chars). With the 2-space indent and 2-space gutter, the description
 * column starts at column 51 (1-indexed). Future flag additions are
 * trivially correct because adding a longer flag recomputes the width.
 *
 * The `--github-api-base`, `--review-file-limit`, and `--minimum-severity`
 * entries previously sat at unrelated columns (25/27/34); fixing them
 * surfaces the previously-unread descriptions and makes future flag
 * additions trivial.
 *
 * Help is contextual: `--help` shows the top-level overview with all
 * commands, while `<command> --help` shows only the flags relevant to
 * that command. This is achieved by tagging each flag with the commands
 * it applies to (`appliesTo`) and filtering at render time.
 */

import {
  DEFAULT_GITHUB_API_BASE,
  DEFAULT_OPENAI_URL,
} from "../util/provider-defaults.js";
import { BRAND } from "../util/brand.js";
import { CLI_MODES_TEXT } from "./modes-help.js";
import { UNINSTALL_HELP_TEXT } from "./uninstall.js";

/**
 * Command identifiers used for contextual help filtering.
 * `all` means the flag appears in every help context.
 * `review` is the default subcommand so it also covers bare invocation.
 */
type HelpContext = "all" | "review" | "doctor" | "uninstall" | "check-review-artifact";

interface HelpFlag {
  /** Full flag token, e.g. `"--api-url <url>"`. */
  flag: string;
  /** Optional description; omit when the placeholder fully documents the value. */
  description?: string;
  /** Which command contexts this flag is relevant in. Defaults to `["all"]`. */
  appliesTo?: readonly HelpContext[];
}

/** Global flags that appear in every help context. */
const GLOBAL_FLAGS: readonly HelpFlag[] = [
  { flag: "--no-color", description: "Disable decorative ANSI color (also: non-empty NO_COLOR)" },
  { flag: "--json", description: "Emit machine-readable JSON output (doctor, review)" },
];

const REVIEW_FLAGS: readonly HelpFlag[] = [
  { flag: "--platform <auto|github|azure>", appliesTo: ["review"] },
  { flag: "--event <path>", description: "GitHub event JSON or Azure pull-request JSON", appliesTo: ["review"] },
  { flag: "--diff <path>", description: "PR diff text", appliesTo: ["review"] },
  { flag: "--threads <path>", description: "Azure existing threads JSON (ADO wrapper mode)", appliesTo: ["review"] },
  { flag: "--review <path>", description: "Azure provider review JSON (ADO wrapper mode)", appliesTo: ["review"] },
  { flag: "--pr-number <n>", description: "Pull request number", appliesTo: ["review"] },
  { flag: "--repo <owner/name>", appliesTo: ["review"] },
  { flag: "--api-url <url>", description: `Provider Responses API URL (default: ${DEFAULT_OPENAI_URL})`, appliesTo: ["review"] },
  { flag: "--api-key <key>", description: "Provider API key", appliesTo: ["review"] },
  { flag: "--model <id>", description: "Provider model id (default: auto)", appliesTo: ["review"] },
  { flag: "--prompt <text>", description: "Inline system prompt override", appliesTo: ["review"] },
  { flag: "--prompt-file <path>", appliesTo: ["review"] },
  { flag: "--prompt-files <paths>", description: "Comma/newline-separated system prompt files (overrides defaults)", appliesTo: ["review"] },
  { flag: "--additional-prompt <text>", appliesTo: ["review"] },
  { flag: "--additional-prompt-file <path>", appliesTo: ["review"] },
  { flag: "--additional-prompt-files <paths>", description: "Comma/newline-separated additional prompt files (overrides defaults)", appliesTo: ["review"] },
  { flag: "--effort <low|medium|high>", description: "Reasoning effort hint (default: medium)", appliesTo: ["review"] },
  { flag: "--provider <openai-compatible|copilot|anthropic>", description: "Provider family (anthropic uses native /v1/messages)", appliesTo: ["review"] },
  { flag: "--github-api-base <url>", description: `GitHub API base URL (Copilot token exchange; default: ${DEFAULT_GITHUB_API_BASE})`, appliesTo: ["review"] },
  { flag: "--include-sonarqube", appliesTo: ["review"] },
  { flag: "--sonar-host-url <url>", appliesTo: ["review"] },
  { flag: "--sonar-token <token>", appliesTo: ["review"] },
  { flag: "--sonar-project-key <key>", appliesTo: ["review"] },
  { flag: "--sonar-timeout-seconds <n>", appliesTo: ["review"] },
  { flag: "--review-timeout-seconds <n>", appliesTo: ["review"] },
  { flag: "--stall-seconds <n>", appliesTo: ["review"] },
  { flag: "--per-request-timeout-seconds <n>", appliesTo: ["review"] },
  { flag: "--max-output-tokens <n>", appliesTo: ["review"] },
  { flag: "--max-comments <n>", appliesTo: ["review"] },
  { flag: "--review-file-limit <n>", description: "Cap on changed files for live review (0 = disable)", appliesTo: ["review"] },
  { flag: "--minimum-severity <low|medium|high>", description: "default: medium", appliesTo: ["review"] },
  { flag: "--strict-schema | --no-strict-schema", description: "Send response_format json_schema on the wire (default: yes)", appliesTo: ["review"] },
  { flag: "--verify-findings | --no-verify-findings", description: "Deterministic (path,line) re-verification before posting (default: yes)", appliesTo: ["review"] },
  { flag: "--walkthrough | --no-walkthrough", appliesTo: ["review"] },
  { flag: "--diagnostic | --no-diagnostic", appliesTo: ["review"] },
  { flag: "--debug-raw-response | --no-debug-raw-response", appliesTo: ["review"] },
  { flag: "--detect-leaks | --no-detect-leaks", appliesTo: ["review"] },
  { flag: "--dry-run | --no-dry-run", appliesTo: ["review"] },
  { flag: "--simulate-findings | --no-simulate-findings", appliesTo: ["review"] },
  { flag: "--output-artifact <path>", appliesTo: ["review"] },
];

/** All flags, used for the legacy `CLI_HELP_TEXT` export and column-width calc. */
const HELP_FLAGS: readonly HelpFlag[] = [...REVIEW_FLAGS];

/** The full flag set for column-width calculation. */
const ALL_FLAGS_FOR_WIDTH: readonly HelpFlag[] = [...REVIEW_FLAGS, ...GLOBAL_FLAGS];

function flagsForContext(context: HelpContext): readonly HelpFlag[] {
  if (context === "all") {
    return [...REVIEW_FLAGS, ...GLOBAL_FLAGS];
  }
  const commandFlags = REVIEW_FLAGS.filter(
    (f) => f.appliesTo?.includes(context as HelpContext) ?? false,
  );
  return [...commandFlags, ...GLOBAL_FLAGS];
}

/** Column width is always computed from the full flag set for consistency. */
const FLAG_COLUMN_WIDTH = ALL_FLAGS_FOR_WIDTH.reduce((max, { flag }) => Math.max(max, flag.length), 0);
const GUTTER_SPACES = 2;
const INDENT_SPACES = 2;

/** Render one flag with optional description, padded to the canonical description column. */
function renderFlagLine({ flag, description }: HelpFlag): string {
  const padding = " ".repeat(FLAG_COLUMN_WIDTH - flag.length + GUTTER_SPACES);
  const head = `${" ".repeat(INDENT_SPACES)}${flag}${padding}`;
  return description === undefined ? head : `${head}${description}`;
}

function renderFlags(flags: readonly HelpFlag[]): readonly string[] {
  return flags.map(renderFlagLine);
}

function renderCommands(commands: readonly string[]): string {
  return ["Commands:", ...commands.map((command) => `  ${command}`), ""].join("\n");
}

// ── Top-level help (existing CLI_HELP_TEXT + Commands) ─────────────────────

const TOP_LEVEL_COMMANDS = [
  "review                    Run PR review (default)",
  "doctor                    Check environment is ready",
  "uninstall                 Remove the installed binary, config, and PATH entries",
  "check-review-artifact <path>  Validate a review artifact",
  "version                   Print version",
  "--help, -h                Show this help",
  "--version, -V             Print version",
] as const;

export const CLI_HELP_TEXT = [
  `${BRAND} — provider-agnostic PR review CLI`,
  "",
  "Commands:",
  ...TOP_LEVEL_COMMANDS.map((c) => `  ${c}`),
  "",
  "Review flags (use `umactually review --help` for full details):",
  ...HELP_FLAGS.map(renderFlagLine),
  "",
  "Global flags:",
  ...GLOBAL_FLAGS.map(renderFlagLine),
  "",
  CLI_MODES_TEXT,
  "See exit codes: docs/exit-codes.md",
].join("\n");

// ── Per-command contextual help ────────────────────────────────────────────

const REVIEW_HELP_TEXT = [
  `${BRAND} review — run an AI-powered PR review`,
  "",
  "Usage:",
  "  umactually review [flags]       Run review (also the default command)",
  "  umactually review --help        Show this help",
  "",
  "Flags:",
  ...renderFlags(flagsForContext("review")),
  "",
  CLI_MODES_TEXT,
  "See exit codes: docs/exit-codes.md",
].join("\n");

const DOCTOR_HELP_TEXT = [
  `${BRAND} doctor — check that your environment is ready for review`,
  "",
  "Usage:",
  "  umactually doctor                Run all environment checks",
  "  umactually doctor --json         Emit machine-readable JSON",
  "  umactually doctor --help         Show this help",
  "",
  "Checks:",
  "  node          Verifies Node.js >= 24 is on PATH",
  "  git           Verifies git is available and the cwd is a repository",
  "  env           Reports which UMACTUALLY_* / REVIEW_* env vars are set",
  "  dist-freshness Verifies the bundled dist/ is up to date (dev only)",
  "",
  "Global flags:",
  ...GLOBAL_FLAGS.map(renderFlagLine),
  "",
  "Exit codes:",
  "  0  All checks passed",
  "  1  One or more checks failed or warned",
  "  2  Usage error",
].join("\n");

const CHECK_REVIEW_ARTIFACT_HELP_TEXT = [
  `${BRAND} check-review-artifact — validate a review JSON artifact`,
  "",
  "Usage:",
  "  umactually check-review-artifact <path>   Validate the artifact at <path>",
  "  umactually check-review-artifact --help   Show this help",
  "",
  "The artifact is classified as:",
  "  ok       Valid review with a recognized verdict",
  "  fail     Invalid, unparseable, or parse-failed artifact",
  "",
  "Exit codes:",
  "  0  Artifact is valid",
  "  1  Artifact is invalid or unparseable",
  "  2  Usage error (no path given, or too many arguments)",
].join("\n");

/** Map from command name to its dedicated help text. */
const COMMAND_HELP: Readonly<Record<string, string>> = {
  review: REVIEW_HELP_TEXT,
  doctor: DOCTOR_HELP_TEXT,
  uninstall: UNINSTALL_HELP_TEXT,
  "check-review-artifact": CHECK_REVIEW_ARTIFACT_HELP_TEXT,
};

/**
 * Resolve which help text to print based on the argv context.
 *
 * If a recognized subcommand appears before `--help` / `-h`, that
 * command's dedicated help is shown. Otherwise the top-level help is
 * shown (which includes the Commands banner).
 */
export function resolveHelpText(argv: readonly string[]): string {
  const helpIndex = argv.indexOf("--help") !== -1
    ? argv.indexOf("--help")
    : argv.indexOf("-h");
  if (helpIndex === -1) {
    return CLI_HELP_TEXT;
  }
  // Check tokens before --help for a recognized subcommand.
  for (let i = 0; i < helpIndex; i += 1) {
    const token = argv[i];
    if (token === undefined || token.startsWith("-")) {
      continue;
    }
    if (token in COMMAND_HELP) {
      return COMMAND_HELP[token]!;
    }
    // Unknown positional before --help — fall through to top-level help.
    break;
  }
  return CLI_HELP_TEXT;
}

/**
 * Print the help text to stdout. When `commands` is provided, renders the
 * top-level help with the Commands banner appended (legacy callers).
 *
 * @returns The rendered help text that was written to stdout.
 */
export function printHelp(commands: readonly string[] = []): string {
  const helpText = commands.length === 0
    ? CLI_HELP_TEXT
    : `${CLI_HELP_TEXT}\n\n${renderCommands(commands)}`;
  process.stdout.write(helpText);
  return helpText;
}

/**
 * Print contextual help text to stdout based on the argv context.
 *
 * This is the preferred entry point from `dispatch.ts`. It detects whether
 * a subcommand preceded `--help` and renders the appropriate section.
 *
 * @returns The rendered help text that was written to stdout.
 */
export function printContextualHelp(argv: readonly string[]): string {
  const helpText = resolveHelpText(argv);
  process.stdout.write(helpText);
  return helpText;
}

/** Exported for unit tests that need to assert per-command help content. */
export const REVIEW_HELP = REVIEW_HELP_TEXT;
export const DOCTOR_HELP = DOCTOR_HELP_TEXT;
export const UNINSTALL_HELP = UNINSTALL_HELP_TEXT;
export const CHECK_REVIEW_ARTIFACT_HELP = CHECK_REVIEW_ARTIFACT_HELP_TEXT;
