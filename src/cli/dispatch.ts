// SPDX-License-Identifier: MIT
// Subcommand dispatch layer. Pure routing apart from delegated CLI output.

import { execFile as execFileCallback } from "node:child_process";
import { stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { runCli, runVersion } from "../cli.js";
import { classifyReviewArtifact } from "./check-review-artifact.js";
import { formatDoctorHuman, formatDoctorJson, runDoctor } from "./doctor.js";
import { printHelp } from "./help.js";
import { resolveColorPolicy } from "./no-color.js";

const GLOBAL_ONLY_FLAGS = new Set(["--json", "--no-color"]);
const TOP_LEVEL_COMMANDS = [
  "review",
  "doctor",
  "check-review-artifact <path>",
  "version",
  "--help",
  "--version",
] as const;
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
    const stdout = printHelp(TOP_LEVEL_COMMANDS);
    return argv.includes("--no-color") ? 0 : { exitCode: 0, stdout };
  }

  const command = firstPositionalToken(argv);
  if (command === null) {
    return runReviewBranch(argv);
  }

  switch (command) {
    case "review":
      return runReviewBranch(stripLeadingCommand(argv, command));
    case "doctor":
      return runDoctorBranch(stripLeadingCommand(argv, command));
    case "check-review-artifact":
      return runCheckReviewArtifactBranch(stripLeadingCommand(argv, command));
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
    const envelope = {
      schemaVersion: 1,
      command: "review",
      exitCode: result.exitCode,
      resolvedConfig: result.resolvedConfig ?? {},
      outcome: {
        ok: result.exitCode === 0,
        ...result.jsonOutcome,
      },
    } as const;
    const stdout = `${JSON.stringify(envelope)}\n`;
    originalWrite.call(process.stdout, stdout);
    return { exitCode: result.exitCode, stdout };
  } finally {
    process.stdout.write = originalWrite;
  }
}

function runCheckReviewArtifactBranch(args: readonly string[]): DispatchResult {
  const artifactArgs = args.filter((arg) => arg !== "--no-color");
  const path = artifactArgs[0];
  if (path === undefined || artifactArgs.length !== 1) {
    const stderr = "usage: umactually check-review-artifact <path>\n";
    process.stderr.write(stderr);
    return { exitCode: 2, stderr };
  }

  const result = classifyReviewArtifact(path);
  const message = result.ok ? result.summary : result.reason;
  const stderr = `umactually: ${path}: ${message ?? "invalid artifact"}\n`;
  process.stderr.write(stderr);
  return { exitCode: result.ok ? 0 : 1, stderr };
}

async function runDoctorBranch(args: readonly string[]): Promise<DispatchResult> {
  const json = args.includes("--json");
  // In a Bun --compile binary, import.meta.url resolves to Bun's virtual
  // filesystem and process.execPath is the real binary. In Node (npm install
  // or dev), process.execPath is the node binary itself, so use import.meta.url.
  const isCompiledBinary = typeof (globalThis as Record<string, unknown>)["UMACTUALLY_VERSION"] === "string";
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
  const stdout = json ? formatDoctorJson(result) : formatDoctorHuman(result.checks);
  process.stdout.write(stdout);
  return { exitCode: result.exitCode, stdout };
}
