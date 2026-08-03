// SPDX-License-Identifier: MIT
// Subcommand dispatch layer. Pure routing apart from delegated CLI output.

import { execFile as execFileCallback } from "node:child_process";
import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { BRAND_PREFIX } from "../util/brand.js";
import { runCli, runVersion } from "../cli.js";
import { classifyReviewArtifact } from "./check-review-artifact.js";
import { formatDoctorHuman, formatDoctorJson, runDoctor } from "./doctor.js";
import { printContextualHelp } from "./help.js";
import {
  formatInitHuman,
  formatInitJson,
  INIT_HELP_TEXT,
  runInit,
  type InitResult,
} from "./init.js";
import { resolveColorPolicy } from "./no-color.js";
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

  const command = firstPositionalToken(argv);
  if (command === null) {
    // First-time-user compact quickstart REPLACES the noisy
    // validation + modes banner for bare invocations from a fresh
    // install (TTY + no saved config + no programmatic flags). The
    // existing loud banner is preserved for every other case:
    //   - non-TTY / CI: existing banner, no quickstart (existing tests
    //     in test/unit/cli-bare-invocation.test.ts and
    //     test/unit/cli-subcommands.test.ts:CLI-SUB-005 pin this).
    //   - saved config already exists: existing banner (operator has
    //     set up; they want validation feedback).
    //   - programmatic flags (`--json`, `--api-*`, etc.): existing
    //     banner (operator clearly knows what they're doing).
    if (isFirstRunUser(argv)) {
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
 * Detect a "first-time user" — a bare `umactually` invocation from a
 * fresh install. Returns true ONLY when ALL of:
 *   - stdout is a real TTY (no CI noise; no JSON-parser pollution),
 *   - no programmatic flags in argv (the operator isn't piping /
 *     scripting; they're at a terminal),
 *   - no saved config at `~/.umactually/config.json` (the wizard has
 *     never run for this user).
 *
 * When this returns true, `dispatch` calls `runFirstRunQuickstart`
 * instead of `runReviewBranch` — the loud `cli: --api-url is required`
 * + `pick a mode:` banner is REPLACED with a compact quickstart that
 * leads with `umactually init`. Every other case (non-TTY, programmatic
 * flags, config-already-exists) preserves the existing loud banner so
 * the back-compat invariants in:
 *   - test/unit/cli-bare-invocation.test.ts (CLI_SYMBIOTIC-2)
 *   - test/unit/cli-subcommands.test.ts:CLI-SUB-005
 * keep passing.
 *
 * No-ops on Windows when `process.env.USERPROFILE` is unset (CI
 * runners without HOME) — we don't want to misattribute an
 * operator's first run; treat the missing HOME as "not first-run"
 * and fall through to the loud banner.
 */
function isFirstRunUser(argv: readonly string[]): boolean {
  // process.stdout.isTTY alone is NOT a reliable CI detector —
  // interactive shells without a controlling TTY, test runners, and
  // SSH sessions can all have isTTY=true while still being
  // automation. The CI env vars below are the canonical signals
  // used by every CI platform umactually integrates with; if any is
  // set we fall through to the loud banner regardless of TTY state.
  if (looksLikeCIEnv()) return false;
  if (process.stdout.isTTY !== true) return false;
  if (argvIncludesProgrammaticFlags(argv)) return false;
  const configPath = resolveSavedConfigPath();
  if (configPath === null) return false;
  if (existsSync(configPath)) return false;
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

function resolveSavedConfigPath(): string | null {
  // We deliberately do NOT use `readSavedConfig` here — that path is
  // expensive (parses + validates JSON, walks both repo + global). For
  // the quickstart gate we only need a cheap existence check on the
  // global path (the canonical first-install target); the repo-scope
  // file is opt-in and would not gate the "first run" reminder.
  const home = process.env["HOME"] ?? process.env["USERPROFILE"];
  if (typeof home !== "string" || home.length === 0) return null;
  return join(home, ".umactually", "config.json");
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
const FIRST_RUN_QUICKSTART = [
  "Welcome to umactually! Get started with the setup wizard:",
  "",
  "  umactually init",
  "",
  "Then run a review:",
  "",
  "  umactually review --api-url <url> --api-key <key>     PR review (CI)",
  "  umactually --files <path>... --api-key <key>          Local files (no CI)",
  "  umactually doctor                                   Verify your setup",
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

async function runDoctorBranch(args: readonly string[]): Promise<DispatchResult> {
  const json = args.includes("--json");
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
  const result = await runDoctor({
    cwd: process.cwd(),
    isTTY: process.stdout.isTTY === true,
    env: process.env,
    fsAdapter: { stat },
    execFile: async (file, fileArgs, options) => {
      const output = await execFile(file, fileArgs, options);
      return { stdout: output.stdout, stderr: output.stderr };
    },
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
  // Honors the same env vars that shouldPrompt honors:
  //   - UMACTUALLY_UNINSTALL_YES=1
  //   - UMACTUALLY_YES=true
  // so a CI job with `UMACTUALLY_UNINSTALL_YES=1 umactually uninstall
  // --purge-config` works without also passing --yes on the command
  // line.
  const yesEnv = deps.env["UMACTUALLY_UNINSTALL_YES"] ?? deps.env["UMACTUALLY_YES"];
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
      packageVersion: process.env["UMACTUALLY_VERSION"] ?? "0.6.21",
    },
  });
  const stdout = json ? formatInitJson(result) : formatInitHuman(result);
  process.stdout.write(stdout);
  return { exitCode: result.exitCode, stdout };
}
