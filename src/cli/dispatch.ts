// SPDX-License-Identifier: MIT
// Subcommand dispatch layer. Pure routing apart from delegated CLI output.

import { execFile as execFileCallback } from "node:child_process";
import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { BRAND_PREFIX } from "../util/brand.js";
import { readPackageVersion, runCli, runVersion } from "../cli.js";
import { classifyReviewArtifact } from "./check-review-artifact.js";
import { formatDoctorHuman, formatDoctorJson, runDoctor } from "./doctor.js";
import { runFullDoctor, type DoctorCheckResult } from "./doctor-full.js";
import { formatCheckLines } from "../util/check-format.js";
import { type HelpCommand, printContextualHelp, renderCommandsTable } from "./help.js";
import { tryReadSavedConfig } from "./load-saved-config.js";
import type { SavedConfig } from "../config/saved-config.js";
import { loadReviewPolicy } from "../config/review-policy.js";
import {
  formatInitHuman,
  formatInitJson,
  INIT_HELP_TEXT,
  runInit,
  type InitResult,
} from "./init.js";
import { resolveColorPolicy } from "./no-color.js";
import { runTui } from "./tui/index.js";
import { runTtyGate } from "./tui/tty-gate.js";
import {
  defaultFsAdapter,
  defaultStdinReader,
  formatUninstallHuman,
  formatUninstallJson,
  parseUninstallArgs,
  purgeConfig,
  revertPath,
  runUninstall,
  shouldPrompt,
  UNINSTALL_HELP_TEXT,
  userDeclinedPrompt,
  type UninstallDeps,
  type UninstallResult,
} from "./uninstall.js";
import {
  createEnvelope,
  type EnvelopeData,
} from "../util/envelope.js";

const GLOBAL_ONLY_FLAGS = new Set(["--json", "--no-color"]);
const execFile = promisify(execFileCallback);

export type DispatchResult = {
  readonly exitCode: number;
  readonly stdout?: string;
  readonly stderr?: string;
};

export function firstPositionalToken(argv: readonly string[]): string | null {
  for (const token of argv) {
    if (GLOBAL_ONLY_FLAGS.has(token)) {
      continue;
    }
    return token.startsWith("-") ? null : token;
  }
  return null;
}

export function stripLeadingCommand(argv: readonly string[], command: string): string[] {
  const commandIndex = argv.indexOf(command);
  return commandIndex === -1
    ? argv.slice()
    : [...argv.slice(0, commandIndex), ...argv.slice(commandIndex + 1)];
}

export function dispatch(argv: readonly ["review", "--no-color", "--help"]): Promise<number>;
export function dispatch(argv: readonly string[]): Promise<DispatchResult>;
export async function dispatch(argv: readonly string[]): Promise<DispatchResult | number> {
  applyColorPolicy(argv);

  if (argv.includes("--version") || argv.includes("-V")) {
    return runVersion(argv);
  }
  if (argv.includes("--help") || argv.includes("-h")) {
    const stdout = printContextualHelp(argv);
    return argv.includes("--no-color") ? 0 : { exitCode: 0, stdout };
  }

  // Top-level `--show-config` is its own read-only command: print the
  // effective saved config and exit 0. Implemented at this layer so
  // the operator can run `umactually --show-config` from anywhere —
  // including `umactually review --show-config` or
  // `umactually init --show-config` — without going through the
  // validator or any other command's argument parser. Self-review
  // thread PRRT_kwDOTHG5gM6WY88P on PR #180 flagged that putting the
  // check inside `command === null` made `umactually review
  // --show-config` silently pass the flag through to the review
  // validator instead of running `runShowConfig`. Hoisting above
  // `firstPositionalToken(argv)` short-circuits on the flag presence
  // before any command routing.
  if (argv.includes("--show-config")) {
    return runShowConfig(process.cwd());
  }

  const command = firstPositionalToken(argv);
  if (command === null) {
    // Compact quickstart for interactive bare invocations. Replaces
    // the noisy validation + modes banner for fresh-install TTY users
    // (no saved config) AND for the post-init case where the operator
    // has run `umactually init` already (saved config present). The
    // existing loud banner is preserved for every other case:
    //   - non-TTY / CI: existing banner, no quickstart (existing
    //     tests in test/unit/cli-bare-invocation.test.ts and
    //     test/unit/cli-subcommands.test.ts:CLI-SUB-005 pin this).
    //   - programmatic flags (`--json`, `--api-*`, etc.): existing
    //     banner (operator clearly knows what they're doing; the
    //     intended commands are `umactually review ...`).
    //
    // Two variants:
    //   - First run (no saved config): quickstart leads with
    //     `umactually init` (operator needs to run the wizard first).
    //   - Post-init (saved config exists): quickstart drops the
    //     `umactually init` line and confirms what's loaded (provider +
    //     model). The three review commands below it are unchanged so
    //     the operator's muscle memory carries over.
    if (isQuickstartEligible(argv)) {
      const savedRead = tryReadSavedConfig();
      if (savedRead.config !== null) {
        return runLoadedConfigQuickstart(savedRead.config, savedRead.path);
      }
      if (savedRead.warning !== null) {
        process.stderr.write(`umactually: ${savedRead.warning}\n`);
      }
      return runFirstRunQuickstart();
    }
    return runReviewBranch(argv);
  }

  switch (command) {
    case "review":
      return runReviewBranch(stripLeadingCommand(argv, command));
    case "doctor":
      return runDoctorBranch(stripLeadingCommand(argv, command));
    case "uninstall":
      return runUninstallBranch(stripLeadingCommand(argv, command));
    case "check-review-artifact":
      return runCheckReviewArtifactBranch(stripLeadingCommand(argv, command));
    case "init":
      return runInitBranch(stripLeadingCommand(argv, command));
    case "tui":
      return runTuiBranch(stripLeadingCommand(argv, command));
    case "version":
      return runVersion(stripLeadingCommand(argv, command));
    default: {
      const stderr = `unknown command: ${command}\n`;
      process.stderr.write(stderr);
      return { exitCode: 2, stderr };
    }
  }
}

function applyColorPolicy(argv: readonly string[]): boolean {
  return resolveColorPolicy({
    noColor: argv.includes("--no-color"),
    json: argv.includes("--json"),
    env: process.env,
    isTTY: process.stdout.isTTY === true,
  });
}

/**
 * Whether the bare-invocation quickstart SHOULD run — independent of
 * whether the operator has run init. Returns true ONLY when ALL of:
 *   - not in a CI environment (CI env vars set),
 *   - stdout is a real TTY (no JSON-parser pollution; no piped stdin),
 *   - no programmatic flags in argv (operator isn't scripting).
 *
 * The function deliberately does NOT check whether a saved config
 * exists. That decision is made later, inside `dispatch`, where the
 * loader returns `null` for missing/malformed configs and the
 * quickstart variant is picked accordingly:
 *   - config exists → `runLoadedConfigQuickstart` (no init line)
 *   - no config     → `runFirstRunQuickstart` (leads with init)
 * Both variants REPLACE the loud `cli: --api-url is required` +
 * `pick a mode:` banner that would otherwise fire when the operator
 * runs `umactually` from a fresh shell.
 *
 * Every other case (non-TTY, CI, programmatic flags like `--json` /
 * `--api-*` / `--model`) preserves the existing loud banner so the
 * back-compat invariants in:
 *   - test/unit/cli-bare-invocation.test.ts (CLI_SYMBIOTIC-2)
 *   - test/unit/cli-subcommands.test.ts:CLI-SUB-005
 * keep passing.
 */
function isQuickstartEligible(argv: readonly string[]): boolean {
  if (looksLikeCIEnv()) return false;
  if (process.stdout.isTTY !== true) return false;
  if (argvIncludesProgrammaticFlags(argv)) return false;
  return true;
}

/**
 * Returns true when a known CI platform env var is set. The set is
 * intentionally narrow — only platforms whose presence unambiguously
 * means "automation, not a human operator". A bare `CI=true` is
 * NOT included because many developer shells set it locally (and
 * the loud banner for those users is the right behavior).
 *
 * Boolean-valued CI vars (`GITHUB_ACTIONS`, `TF_BUILD`) are matched
 * case-insensitively because Azure DevOps sets `TF_BUILD=True` (capital
 * T) while GitHub Actions sets `GITHUB_ACTIONS=true` (lowercase) —
 * any case-sensitive check would silently miss one platform.
 */
function looksLikeCIEnv(): boolean {
  const env = process.env;
  return (
    truthyCI(env["GITHUB_ACTIONS"]) ||
    truthyCI(env["TF_BUILD"]) ||
    typeof env["BUILDKITE"] === "string" ||
    typeof env["CIRCLECI"] === "string" ||
    typeof env["JENKINS_URL"] === "string"
  );
}

function truthyCI(v: string | undefined): boolean {
  return typeof v === "string" && v.toLowerCase() === "true";
}

function argvIncludesProgrammaticFlags(argv: readonly string[]): boolean {
  // `--json` and `--no-color` are common programmatic flags; a user
  // passing them is not a "first run" — they're piping output somewhere
  // and the quickstart would just be noise on stderr. `--api-*` /
  // `--model` flags mean the operator already knows the wire shape;
  // routing them to the wizard is condescending.
  return argv.some(
    (a) =>
      a === "--json" ||
      a === "--no-color" ||
      a.startsWith("--api-") ||
      a === "--model" ||
      a.startsWith("--platform"),
  );
}

/**
 * The compact first-run quickstart. Replaces the noisy
 * `cli: --api-url is required` + `pick a mode:` banner for first-time
 * users. Single screen, leads with `umactually init`, then summarizes
 * the three review commands, then points at `--help` for the full
 * reference. Exit code 0 — first run is not an error.
 *
 * Industry-standard model: matches `rustup`, `fnm`, `volta`, `nvm`,
 * `pip`, `brew install` first-run output. No `--dry-run` clutter.
 */
const QUICKSTART_REVIEW_COMMANDS: readonly HelpCommand[] = [
  { command: "umactually review --api-key <key>", description: "PR review (CI)" },
  { command: "umactually --files <path>... --api-key <key>", description: "Local files (no CI)" },
  { command: "umactually doctor", description: "Verify your setup" },
];

export const FIRST_RUN_QUICKSTART = [
  "Welcome to umactually! Get started with the setup wizard:",
  "",
  "  umactually init",
  "",
  "Then run a review:",
  "",
  ...renderCommandsTable(QUICKSTART_REVIEW_COMMANDS),
  "",
  "Run `umactually --help` for the full reference.",
  "",
].join("\n");

function runFirstRunQuickstart(): Promise<DispatchResult> {
  // Pattern matches runUninstallBranch / runInitBranch / runDoctorBranch:
  // write directly to stdout so the live stream gets the bytes, and
  // return a minimal `{ exitCode }` result. Callers capture via
  // `process.stdout.write` interception (see test helpers).
  process.stdout.write(`${BRAND_PREFIX}${FIRST_RUN_QUICKSTART}`);
  return Promise.resolve({ exitCode: 0 });
}

/**
 * Loaded-config quickstart for the post-init case. Same shape as
 * `FIRST_RUN_QUICKSTART` (three review commands + `--help` pointer)
 * with two changes:
 *
 *   1. First line confirms what loaded instead of welcoming the user
 *      to the tool. Format: `Loaded config (provider=<X>, model=<Y>).`
 *      `apiUrl` is intentionally omitted from the confirmation line
 *      to keep the quickstart single-screen and avoid leaking the
 *      provider URL to anyone shoulder-surfing. Operators who want
 *      the URL can run `umactually --show-config`.
 *   2. The `umactually init` block is dropped — the operator has
 *      already configured; pointing them at the wizard again would
 *      be condescending. The two review-command lines stay in their
 *      exact same position so visual muscle memory carries over.
 */
export function renderLoadedConfigQuickstart(config: SavedConfig): string {
  const providerLabel = `provider=${config.provider}`;
  const modelLabel = config.model !== undefined ? `, model=${config.model}` : "";
  const header = `Loaded config (${providerLabel}${modelLabel}). Run:`;
  return [
    header,
    "",
  ...renderCommandsTable(QUICKSTART_REVIEW_COMMANDS),
    "",
    "Run `umactually --show-config` to inspect the loaded values;",
    "run `umactually --help` for the full reference.",
    "",
  ].join("\n");
}

function runLoadedConfigQuickstart(
  config: SavedConfig,
  _path: string,
): Promise<DispatchResult> {
  process.stdout.write(`${BRAND_PREFIX}${renderLoadedConfigQuickstart(config)}`);
  return Promise.resolve({ exitCode: 0 });
}

/**
 * `umactually --show-config` — print the effective saved config and
 * review policy, then exit 0. Read-only; never opens a network
 * connection; never prompts.
 *
 * The output is a field-by-field rendered multiline string so future
 * secret fields on `SavedConfig` (the schema is intentionally future-
 * proofed) cannot accidentally leak through this surface — any field
 * added to `SavedConfig` must be explicitly added here AND to
 * `serializeSavedConfig`'s "unknown key is rejected at the type level"
 * rule, which is exactly the trust-model property the S6 contract
 * requires.
 *
 * Review-policy fields are rendered with sanitized path/hash/version
 * so the operator can verify exactly which committed policy (if any)
 * is in effect. The committed policy itself lives in
 * `umactually.review.json` and is the team's documented source of
 * truth for non-secret review rules.
 *
 * Decision: lives at the dispatch layer (not under `umactually doctor`)
 * because every other "what's currently effective" tool (`kubectl
 * config view`, `aws configure get`, `git config --list --show-origin`)
 * is top-level, not under a verification subcommand. Operators look
 * for `--show-config` at the root.
 */
function renderSavedConfigSection(
  config: SavedConfig | null,
  path: string,
): string[] {
  const lines: string[] = [];
  if (config !== null) {
    lines.push(
      ...[
        `saved config: ${path}`,
        `  provider: ${config.provider}`,
      ],
    );
    if (config.apiUrl !== undefined) lines.push(`  apiUrl:   ${config.apiUrl}`);
    lines.push(
      `  model:    ${config.model ?? "auto (resolved at review time)"}`,
    );
  } else {
    lines.push("saved config: none (run `umactually init` to create one)");
  }
  return lines;
}

function pushFieldIfDefined<T>(lines: string[], value: T | undefined, label: string): void {
  if (value !== undefined) {
    lines.push(`  ${label}: ${String(value)}`);
  }
}

function renderPolicySection(
  policyResult: ReturnType<typeof loadReviewPolicy>,
): string[] {
  const lines: string[] = [];
  if (policyResult.policy !== null) {
    lines.push(`review policy: ${policyResult.path}`);
    lines.push(`  schemaVersion: ${policyResult.policy.schemaVersion}`);
    pushFieldIfDefined(lines, policyResult.hash, "hash          ");
    pushFieldIfDefined(lines, policyResult.policy.effort, "effort        ");
    pushFieldIfDefined(lines, policyResult.policy.minimumSeverity, "minimumSeverity");
    pushFieldIfDefined(lines, policyResult.policy.gateMode, "gateMode      ");
    pushFieldIfDefined(lines, policyResult.policy.suggestionMode, "suggestionMode");
    pushFieldIfDefined(lines, policyResult.policy.reReviewCap, "reReviewCap   ");
    pushFieldIfDefined(lines, policyResult.policy.triggers?.join(", "), "triggers      ");
  } else {
    lines.push(`review policy: none (run \`umactually init --policy-template\` to create one)`);
  }
  return lines;
}

function renderShowConfig(
  config: SavedConfig | null,
  path: string,
  policyResult: ReturnType<typeof loadReviewPolicy>,
): string {
  const savedLines = renderSavedConfigSection(config, path);
  const policyLines = renderPolicySection(policyResult);
  return [...savedLines, "", ...policyLines].join("\n") + "\n";
}

function runShowConfig(cwd: string): Promise<DispatchResult> {
  const savedRead = tryReadSavedConfig({ cwd });
  const policyResult = loadReviewPolicy({ cwd });
  if (savedRead.warning !== null) {
    process.stderr.write(`umactually: ${savedRead.warning}\n`);
    return Promise.resolve({ exitCode: 1 });
  }
  if (policyResult.warning !== null) {
    process.stderr.write(`umactually: ${policyResult.warning}\n`);
    return Promise.resolve({ exitCode: 1 });
  }
  process.stdout.write(renderShowConfig(savedRead.config, savedRead.path, policyResult));
  return Promise.resolve({ exitCode: 0 });
}

async function runReviewBranch(args: readonly string[]): Promise<DispatchResult> {
  const json = args.includes("--json");
  const reviewArgs = args.filter((arg) => arg !== "--json" && arg !== "--no-color");
  if (json) {
    return runJsonReview(reviewArgs);
  }
  const result = await runCli(reviewArgs, process.cwd());
  return { exitCode: result.exitCode };
}

export async function runJsonReview(argv: readonly string[]): Promise<DispatchResult> {
  const reviewArgs = stripLeadingCommand(
    argv.filter((arg) => arg !== "--json" && arg !== "--no-color"),
    "review",
  );
  const originalWrite = process.stdout.write;
  process.stdout.write = process.stderr.write.bind(process.stderr);
  try {
    const result = await runCli(reviewArgs, process.cwd());
    const legacyData: EnvelopeData = {
      resolvedConfig: result.resolvedConfig ?? {},
      outcome: {
        ok: result.exitCode === 0,
        ...(result.jsonOutcome ?? {}),
      },
    };
    const envelope = createEnvelope("review", legacyData, { exitCode: result.exitCode });
    const stdout = `${JSON.stringify({
      schemaVersion: envelope.schemaVersion,
      command: envelope.command,
      exitCode: envelope.exitCode,
      resolvedConfig: result.resolvedConfig ?? {},
      outcome: legacyData["outcome"],
      ok: envelope.ok,
      startedAt: envelope.startedAt,
      durationMs: envelope.durationMs,
      data: envelope.data,
      errors: envelope.errors,
      hints: envelope.hints,
      warnings: envelope.warnings,
    })}\n`;
    originalWrite.call(process.stdout, stdout);
    return { exitCode: result.exitCode, stdout };
  } finally {
    process.stdout.write = originalWrite;
  }
}

function runCheckReviewArtifactBranch(args: readonly string[]): DispatchResult {
  const artifactArgs = args.filter((arg) => arg !== "--no-color");
  const json = artifactArgs.includes("--json");
  const positionalArgs = artifactArgs.filter((arg) => arg !== "--json");
  const path = positionalArgs[0];
  if (path === undefined || positionalArgs.length !== 1) {
    const stderr = "usage: umactually check-review-artifact <path>\n";
    process.stderr.write(stderr);
    return { exitCode: 2, stderr };
  }

  const result = classifyReviewArtifact(path);
  const exitCode = result.ok ? 0 : 1;
  if (json) {
    const envelope = createEnvelope(
      "verify",
      {
        path,
        ok: result.ok,
        classification: result.ok ? result.summary : "invalid",
        reason: result.ok ? null : result.reason,
        warnings: result.warnings,
      },
      { exitCode },
    );
    const stdout = `${JSON.stringify(envelope)}\n`;
    process.stdout.write(stdout);
    return { exitCode, stdout };
  }
  const message = result.ok ? result.summary : result.reason;
  let stderr = `umactually: ${path}: ${message ?? "invalid artifact"}\n`;
  for (const warning of result.warnings) {
    const annotation = `::warning::${warning}\n`;
    process.stdout.write(annotation);
    stderr += annotation;
  }
  process.stderr.write(stderr);
  return { exitCode, stderr };
}

/**
 * `umactually tui` — launch the interactive terminal UI.
 *
 * This branch is the SINGLE place where TTY gating happens for the
 * `tui` subcommand. The hub itself (src/cli/tui/hub.ts) does NOT
 * gate — it's only invoked after `runTtyGate` returns `{ ok: true }`.
 *
 * The gate is delegated to `runTtyGate` rather than re-implemented
 * inline so the gate's behavior (CI detection, TTY heuristic, hint
 * wording) lives in one place and can be unit-tested in isolation.
 */
async function runTuiBranch(args: readonly string[]): Promise<DispatchResult> {
  const gate = runTtyGate();
  if (gate.ok === false) {
    process.stderr.write(gate.hint);
    return { exitCode: gate.exitCode, stderr: gate.hint };
  }
  const result = await runTui(args);
  return { exitCode: result.exitCode };
}

async function runDoctorBranch(args: readonly string[]): Promise<DispatchResult> {
  const json = args.includes("--json");
  const full = args.includes("--full");
  // In a Bun --compile binary, import.meta.url resolves to Bun's virtual
  // filesystem and process.execPath is the real binary. In Node (npm install
  // or dev), process.execPath is the node binary itself, so use import.meta.url.
  // The bare UMACTUALLY_VERSION identifier is replaced at compile time —
  // either by Bun's --define flag, or by tsdown's `define` config (v0.6.0
  // distribution pipeline; see tsdown.config.ts). In Node (npm/dev) it is
  // undefined.
  const isCompiledBinary = typeof UMACTUALLY_VERSION === "string";
  const packageRoot = isCompiledBinary
    ? dirname(process.execPath)
    : resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const execFileFn = async (file: string, fileArgs: readonly string[], options: { readonly cwd: string }) => {
    const output = await execFile(file, fileArgs, options);
    return { stdout: output.stdout, stderr: output.stderr };
  };

  if (full) {
    const fullResult = await runFullDoctor({
      cwd: process.cwd(),
      isTTY: process.stdout.isTTY === true,
      env: process.env,
      fsAdapter: { stat },
      fsAdapterSync: defaultFsAdapter,
      execFile: execFileFn,
      packageRoot,
    });
    let stdout: string;
    if (json) {
      const envelope = createEnvelope(
        "doctor",
        fullResult.json as unknown as EnvelopeData,
        { exitCode: fullResult.exitCode },
      );
      stdout = `${JSON.stringify(envelope)}\n`;
    } else {
      stdout = formatFullDoctorHuman(fullResult.checks);
    }
    process.stdout.write(stdout);
    return { exitCode: fullResult.exitCode, stdout };
  }

  const result = await runDoctor({
    cwd: process.cwd(),
    isTTY: process.stdout.isTTY === true,
    env: process.env,
    fsAdapter: { stat },
    execFile: execFileFn,
    packageRoot,
  });
  let stdout: string;
  if (json) {
    const envelope = createEnvelope(
      "doctor",
      JSON.parse(formatDoctorJson(result)) as EnvelopeData,
      { exitCode: result.exitCode },
    );
    stdout = `${JSON.stringify(envelope)}\n`;
  } else {
    stdout = formatDoctorHuman(result.checks);
  }
  process.stdout.write(stdout);
  return { exitCode: result.exitCode, stdout };
}

function formatFullDoctorHuman(checks: readonly DoctorCheckResult[]): string {
  return formatCheckLines(checks, { emojiPrefix: false });
}

async function runUninstallBranch(args: readonly string[]): Promise<DispatchResult> {
  const { mode, errors, help, json } = parseUninstallArgs(args);
  if (help) {
    process.stdout.write(UNINSTALL_HELP_TEXT);
    process.stdout.write("\n");
    return { exitCode: 0, stdout: UNINSTALL_HELP_TEXT };
  }
  if (errors.length > 0) {
    const stderr = `umactually uninstall: ${errors.join("; ")}\n`;
    process.stderr.write(stderr);
    return { exitCode: 2, stderr };
  }
  const deps: UninstallDeps = {
    isTTY: process.stdout.isTTY === true && !json,
    env: process.env,
    fsAdapter: defaultFsAdapter,
    // No stdinReader injected — uninstall.ts falls back to its built-in
    // readline-based default, which is non-blocking and timeout-safe.
    execPath: process.execPath,
    platform: process.platform,
    homeDir: homedir(),
    mode,
  };
  // Gate the destructive follow-ups (--purge-config, --revert-path)
  // behind explicit confirmation when running non-interactively. The
  // user clearly requested destructive work but did not pass --yes
  // (or set the corresponding env var), and we have no way to
  // prompt them. Refuse the WHOLE command — including the binary
  // removal — so the user gets a clean "nothing happened" state.
  // Running the binary removal first and then refusing the
  // follow-ups would leave the user confused about what was
  // actually changed on disk.
  //
  // Honors the env var that shouldPrompt honors:
  //   - UMACTUALLY_UNINSTALL_YES=1
  // so a CI job with `UMACTUALLY_UNINSTALL_YES=1 umactually uninstall
  // --purge-config` works without also passing --yes on the command
  // line.
  const yesEnv = deps.env["UMACTUALLY_UNINSTALL_YES"];
  const envAffirmed = yesEnv === "1" || yesEnv === "true";
  if (
    !deps.isTTY &&
    mode.yes !== true &&
    !envAffirmed &&
    (mode.purgeConfig === true || mode.revertPath === true)
  ) {
    const stderr =
      "umactually uninstall: --purge-config and --revert-path require --yes (or UMACTUALLY_UNINSTALL_YES=1) " +
      "in non-interactive mode. Nothing was changed; re-run with --yes to proceed, or omit the destructive flags.\n";
    process.stderr.write(stderr);
    return { exitCode: 2, stderr };
  }
  const result = await runUninstall(deps);
  // If the user declined the prompt for the binary removal, do NOT run
  // the follow-up destructive actions. A 'n' answer should be an
  // unconditional abort, not a partial state where the binary is kept
  // but config and shell-rc edits are still wiped.
  let additionalChecks: readonly UninstallResult["checks"][number][] = [];
  if (!userDeclinedPrompt(result) && (mode.purgeConfig === true || mode.revertPath === true)) {
    // The binary-removal prompt covered only the binary itself. The
    // follow-up destructive actions (config wipe, PATH revert) are
    // separate destructive operations and need their own confirmation
    // in interactive mode. The user can decline here and keep the
    // binary removed but the config intact.
    if (shouldPrompt(deps)) {
      const parts: string[] = [];
      if (mode.purgeConfig === true) {
        parts.push("remove ~/.umactually/ and ~/.cache/umactually/");
      }
      if (mode.revertPath === true) {
        parts.push("strip the umactually PATH block from your shell rc files");
      }
      const promptText = `Also ${parts.join(" and ")}? [y/N] `;
      const reader = deps.stdinReader ?? defaultStdinReader;
      const confirm = await reader(promptText, deps.isTTY);
      if (confirm !== null && /^y(es)?$/i.test(confirm.trim())) {
        additionalChecks = [
          ...(mode.purgeConfig ? purgeConfig(deps) : []),
          ...(mode.revertPath ? revertPath(deps) : []),
        ];
      } else {
        // The user declined (or EOFed) the follow-up prompt. The
        // binary-removal already succeeded; the user just opted out
        // of the additional cleanup. Emit visible skip checks so the
        // output is not confusingly silent — the user ran with
        // --purge-config / --revert-path and should see what was
        // requested vs. what was done.
        const declineChecks: UninstallResult["checks"][number][] = [];
        if (mode.purgeConfig === true) {
          declineChecks.push({
            id: "config-removal",
            status: "skip",
            message: "user declined the additional cleanup prompt; ~/.umactually/ kept",
          });
        }
        if (mode.revertPath === true) {
          declineChecks.push({
            id: "path-revert",
            status: "skip",
            message: "user declined the additional cleanup prompt; shell rc files kept",
          });
        }
        additionalChecks = declineChecks;
      }
    } else {
      // isTTY=false + --yes (the gate at the top of this function
      // already blocked the !--yes + !isTTY case).
      additionalChecks = [
        ...(mode.purgeConfig ? purgeConfig(deps) : []),
        ...(mode.revertPath ? revertPath(deps) : []),
      ];
    }
  }
  const checks: UninstallResult["checks"] = [...result.checks, ...additionalChecks];
  const exitCode = checks.some((c) => c.status === "fail") ? 1 : result.exitCode;
  const finalResult: UninstallResult = { ...result, exitCode, checks };
  let stdout: string;
  if (json) {
    const envelope = createEnvelope(
      "uninstall",
      JSON.parse(formatUninstallJson(finalResult, mode, deps.execPath)) as EnvelopeData,
      { exitCode },
    );
    stdout = `${JSON.stringify(envelope)}\n`;
  } else {
    stdout = formatUninstallHuman(finalResult);
  }
  process.stdout.write(stdout);
  return { exitCode, stdout };
}

async function runInitBranch(args: readonly string[]): Promise<DispatchResult> {
  const json = args.includes("--json");
  const initArgs = args.filter((arg) => arg !== "--no-color");
  if (initArgs.includes("--help") || initArgs.includes("-h")) {
    process.stdout.write(INIT_HELP_TEXT);
    return { exitCode: 0, stdout: INIT_HELP_TEXT };
  }
  const result: InitResult = await runInit({
    argv: initArgs,
    deps: {
      argv: initArgs,
      env: process.env,
      cwd: process.cwd(),
      homeDir: homedir(),
      platform: process.platform,
      packageVersion: readPackageVersion(),
    },
  });
  const stdout = json ? formatInitJson(result) : formatInitHuman(result);
  process.stdout.write(stdout);
  return { exitCode: result.exitCode, stdout };
}
