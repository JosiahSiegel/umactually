// SPDX-License-Identifier: MIT
// Shared helpers for `test/e2e/init-non-tty.test.ts` and any future
// spawned-CLI envelope tests. Kept separate so the test files can
// stay focused on per-row assertions.

import { spawn, type ChildProcess } from "node:child_process";
import { expect } from "vitest";

export type InitSpawnResult = {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
};

export type InitEnvelopeCheck = {
  readonly id: string;
  readonly status: "ok" | "warn" | "fail" | "skip";
  readonly message: string;
};

export type InitEnvelope = {
  readonly mode: string;
  readonly outcome: string;
  readonly exitCode: number;
  readonly savedConfigPath?: string | null;
  readonly savedConfigBytes?: number | null;
  readonly ciGenerated: readonly string[];
  readonly checks: readonly InitEnvelopeCheck[];
  readonly hints: readonly string[];
  readonly sources: Readonly<Record<string, { readonly source: string }>>;
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseInitEnvelope(stdout: string): InitEnvelope {
  const trimmed = stdout.trimEnd();
  expect(trimmed, "expected non-empty stdout").not.toBe("");
  // The init envelope is one line of JSON on stdout. Pick the LAST
  // non-empty line (defensive against future log lines accidentally
  // preceding it).
  const lines = trimmed.split(/\r?\n/u).filter((line) => line.trim().length > 0);
  const last = lines.at(-1);
  expect(last, "expected at least one line").toBeDefined();
  const parsed: unknown = JSON.parse(last as string);
  if (!isRecord(parsed)) {
    throw new TypeError("init JSON envelope must be an object");
  }
  return parsed as unknown as InitEnvelope;
}

export function assertInitEnvelopeShape(envelope: InitEnvelope): void {
  // J-3  mode is one of the four tagged values
  expect(
    ["interactive", "non-interactive", "dry-run", "show"],
    "J-3 mode shape",
  ).toContain(envelope.mode);
  // J-4  outcome is one of the four tagged values
  expect(
    ["ok", "aborted", "error", "dry-run"],
    "J-4 outcome shape",
  ).toContain(envelope.outcome);
  // J-5  exitCode is 0 | 1 | 2
  expect([0, 1, 2], "J-5 exitCode range").toContain(envelope.exitCode);
  // J-6  savedConfigPath is string | null (not undefined)
  expect(
    envelope.savedConfigPath === null || typeof envelope.savedConfigPath === "string",
    "J-6 savedConfigPath is string | null",
  ).toBe(true);
  // J-7  savedConfigBytes is number | null
  expect(
    envelope.savedConfigBytes === null || typeof envelope.savedConfigBytes === "number",
    "J-7 savedConfigBytes is number | null",
  ).toBe(true);
  // J-8  ciGenerated is an array of "github" | "azure"
  expect(Array.isArray(envelope.ciGenerated), "J-8 ciGenerated is array").toBe(true);
  for (const target of envelope.ciGenerated) {
    expect(["github", "azure"], "J-8 ciGenerated entry").toContain(target);
  }
  // J-9  checks is an array of {id,status,message}
  expect(Array.isArray(envelope.checks), "J-9 checks is array").toBe(true);
  for (const check of envelope.checks) {
    expect(typeof check.id).toBe("string");
    expect(["ok", "warn", "fail", "skip"]).toContain(check.status);
    expect(typeof check.message).toBe("string");
  }
  // J-10 hints is an array of strings
  expect(Array.isArray(envelope.hints), "J-10 hints is array").toBe(true);
  for (const hint of envelope.hints) {
    expect(typeof hint).toBe("string");
  }
  // J-11 sources is an object whose values carry a tagged `source`
  expect(typeof envelope.sources, "J-11 sources is object").toBe("object");
  for (const [, value] of Object.entries(envelope.sources)) {
    expect(["flag", "env", "savedConfig", "default"]).toContain(value.source);
  }
}

// J-12 secret-redaction invariant: no apiKey-shaped literal anywhere in
// the envelope's string fields. Mirrors the C-9 secret regex from the
// unit-test contract matrix.
export const SECRET_REGEX =
  /gh[pousr]_[A-Za-z0-9]+|glpat-[A-Za-z0-9]+|s\.r[A-Za-z0-9]+|sk-[A-Za-z0-9]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gu;

export function assertInitEnvelopeRedacted(envelope: InitEnvelope): void {
  const fields: readonly string[] = [
    envelope.savedConfigPath ?? "",
    ...envelope.checks.map((check) => check.message),
    ...envelope.hints,
  ];
  for (const field of fields) {
    expect(field.match(SECRET_REGEX), `J-12 secret leak in: ${field}`).toBeNull();
  }
}

export async function spawnInitCli(args: {
  readonly cliPath: string;
  readonly argv: readonly string[];
  readonly homeDir: string;
  readonly cwd: string;
  readonly extraEnv?: Readonly<Record<string, string>>;
}): Promise<InitSpawnResult> {
  const baseEnv: NodeJS.ProcessEnv = { ...process.env };
  baseEnv["HOME"] = args.homeDir;
  baseEnv["USERPROFILE"] = args.homeDir;
  delete baseEnv["UMACTUALLY_API_KEY"];
  delete baseEnv["UMACTUALLY_API_URL"];
  delete baseEnv["UMACTUALLY_PROVIDER"];
  delete baseEnv["UMACTUALLY_MODEL"];
  if (args.extraEnv !== undefined) {
    for (const [k, v] of Object.entries(args.extraEnv)) {
      baseEnv[k] = v;
    }
  }

  return await new Promise<InitSpawnResult>((resolveResult, reject) => {
    const child: ChildProcess = spawn(process.execPath, [args.cliPath, ...args.argv], {
      cwd: args.cwd,
      env: baseEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (c: string) => {
      stdout += c;
    });
    child.stderr?.on("data", (c: string) => {
      stderr += c;
    });
    child.once("error", reject);
    child.once("close", (status) => {
      resolveResult({ status, stdout, stderr });
    });
  });
}