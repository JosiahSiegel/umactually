// SPDX-License-Identifier: MIT

import { KNOWN_ENV_VAR_NAMES } from "../config/field-schema.js";

const MIN_NODE_MAJOR = 24;

export type DoctorStatus = "ok" | "warn" | "fail" | "skip";

export type EnvPresence = {
  readonly name: string;
  readonly present: boolean;
};

export type DoctorCheck = {
  readonly id: "node" | "dist-freshness" | "env" | "git";
  readonly status: DoctorStatus;
  readonly message: string;
  readonly hint?: string;
  readonly presence?: readonly EnvPresence[];
};

export type DoctorDeps = {
  readonly cwd: string;
  readonly isTTY: boolean;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly fsAdapter: {
    readonly stat: (path: string) => Promise<{ readonly mtimeMs: number }>;
  };
  readonly execFile: (
    file: string,
    args: readonly string[],
    options: { readonly cwd: string },
  ) => Promise<{ readonly stdout: string; readonly stderr: string }>;
  readonly packageRoot: string;
  readonly nodeVersion?: string;
};

export type DoctorJson = {
  readonly schemaVersion: 1;
  readonly command: "doctor";
  readonly exitCode: number;
  readonly checks: readonly DoctorCheck[];
};

export type DoctorResult = {
  readonly exitCode: number;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly checks: readonly DoctorCheck[];
  readonly json?: DoctorJson;
};

export async function runDoctor(deps: DoctorDeps): Promise<DoctorResult> {
  const checks: readonly DoctorCheck[] = [
    checkNode(deps.nodeVersion ?? process.versions.node),
    await checkDistFreshness(deps),
    checkEnv(deps.env),
    await checkGit(deps),
  ];
  const exitCode = checks.some((check) => check.status === "fail") ? 1 : 0;
  const json: DoctorJson = { schemaVersion: 1, command: "doctor", exitCode, checks };
  return deps.isTTY
    ? { exitCode, checks, json, stdout: formatDoctorHuman(checks) }
    : { exitCode, checks, json };
}

function checkNode(nodeVersion: string): DoctorCheck {
  const nodeMajor = Number.parseInt(nodeVersion.split(".", 1)[0] ?? "", 10);
  if (!Number.isFinite(nodeMajor) || nodeMajor < MIN_NODE_MAJOR) {
    return {
      id: "node",
      status: "fail",
      message: `Node ${nodeVersion} detected; ${MIN_NODE_MAJOR}.x or later required`,
      hint: "Install Node 24+ from https://nodejs.org/",
    };
  }
  return { id: "node", status: "ok", message: `Node ${nodeVersion}` };
}

async function checkDistFreshness(deps: DoctorDeps): Promise<DoctorCheck> {
  const root = deps.packageRoot.replace(/[\\/]$/u, "");
  const distPath = `${root}/dist/cli.js`;
  const srcPath = `${root}/src/cli.ts`;
  const distStat = await statOrNull(deps.fsAdapter, distPath);
  const srcStat = await statOrNull(deps.fsAdapter, srcPath);

  // Standalone binary: neither dist/ nor src/ exists on disk because the
  // entire codebase is embedded in the executable. Skip the check rather
  // than reporting a false failure.
  if (distStat === null && srcStat === null) {
    return {
      id: "dist-freshness",
      status: "skip",
      message: "standalone binary — dist/ is embedded, not on disk",
    };
  }

  if (distStat === null) {
    return {
      id: "dist-freshness",
      status: "fail",
      message: `${distPath} is missing`,
      hint: "Run `npm run bundle` to produce dist/cli.js",
    };
  }
  if (srcStat === null) {
    // dist/cli.js is present and src/cli.ts is absent. This is the
    // normal state for a published npm install (the package's
    // "files" array ships dist/, bin/, README, LICENSE, docs,
    // examples, and scripts but NOT src/). Treat the dist as the
    // source of truth and report OK; do not guess the install
    // channel in the message (a dev worktree could also reach
    // this state if src was deleted, and SEA binary builds are
    // caught by the "both absent" check above).
    return {
      id: "dist-freshness",
      status: "ok",
      message: `${distPath} present; src not shipped (using shipped dist)`,
    };
  }
  if (distStat.mtimeMs < srcStat.mtimeMs) {
    return {
      id: "dist-freshness",
      status: "fail",
      message: `${distPath} is older than ${srcPath}`,
      hint: "Run `npm run bundle` to refresh dist/cli.js",
    };
  }
  return { id: "dist-freshness", status: "ok", message: `${distPath} present and fresh` };
}

async function statOrNull(
  fsAdapter: DoctorDeps["fsAdapter"],
  path: string,
): Promise<{ readonly mtimeMs: number } | null> {
  try {
    return await fsAdapter.stat(path);
  } catch {
    // A diagnostic probe reports unavailable paths rather than propagating adapter errors.
    return null;
  }
}

function checkEnv(env: DoctorDeps["env"]): DoctorCheck {
  const presence = [...KNOWN_ENV_VAR_NAMES].map((name) => ({
    name,
    present: typeof env[name] === "string" && env[name].length > 0,
  }));
  const presentCount = presence.filter((entry) => entry.present).length;
  return {
    id: "env",
    status: "ok",
    message: `${presentCount}/${KNOWN_ENV_VAR_NAMES.size} known env vars present`,
    presence,
  };
}

async function checkGit(deps: DoctorDeps): Promise<DoctorCheck> {
  try {
    const result = await deps.execFile("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: deps.cwd,
    });
    return result.stdout.trim() === "true"
      ? { id: "git", status: "ok", message: "cwd is inside a git work tree" }
      : { id: "git", status: "warn", message: "cwd is not inside a git work tree" };
  } catch {
    return {
      id: "git",
      status: "warn",
      message: "git is not on PATH or cwd is not inside a work tree",
    };
  }
}

export function formatDoctorHuman(checks: readonly DoctorCheck[]): string {
  const lines = checks.map((check) => {
    const hint = check.hint === undefined ? "" : `\n  hint: ${check.hint}`;
    return `${check.status.toUpperCase().padEnd(4)} ${check.id}: ${check.message}${hint}`;
  });
  return `${lines.join("\n")}\n`;
}

export function formatDoctorJson(result: DoctorResult): string {
  const envelope: DoctorJson = result.json ?? {
    schemaVersion: 1,
    command: "doctor",
    exitCode: result.exitCode,
    checks: result.checks,
  };
  return `${JSON.stringify(envelope)}\n`;
}
