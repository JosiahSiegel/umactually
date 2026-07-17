#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Cross-compile standalone binaries using Bun --compile.
//
// Produces 6 binaries from scripts/compile-entry.ts into ./release/:
//   umactually-linux-x64      (tar.gz)
//   umactually-linux-arm64    (tar.gz)
//   umactually-darwin-x64     (tar.gz)
//   umactually-darwin-arm64   (tar.gz)
//   umactually-windows-x64.exe (zip)
//   umactually-windows-arm64.exe (zip)
//
// Usage:
//   node scripts/build-binary.mjs              # build all targets
//   node scripts/build-binary.mjs <targetId>   # build one target
//
// Test seam: UMACTUALLY_BUN_BIN points at a fake bun stub. When that path
// ends in .mjs / .js / .cjs the script invokes it via process.execPath so a
// Node-only harness can stand in for bun during unit tests.
//
// Pinned: Bun 1.3.14. Any other version aborts before any spawn.
// Env: deletes BUN_OPTIONS, BUN_CONFIG_VERBOSE_FETCH, BUN_CONFIG_MAX_HTTP_REQUESTS,
// BUN_CONFIG_NO_CLEAR_TERMINAL, BUN_CONFIG_REGISTRY, BUN_INSTALL from the spawn
// environment while preserving PATH/TMP and everything else.

import { mkdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { parseReleaseTargets } from "./release-targets.ts";

const EXPECTED_BUN_VERSION = "1.3.14";
const SCRIPT_DETECT = /\.(mjs|cjs|js)$/i;
const ENTRY_RELATIVE = "scripts/compile-entry.ts";
const OUTDIR_RELATIVE = "release";
const RELEASE_TARGETS_RELATIVE = "scripts/release-targets.json";

const CLEANED_ENV_KEYS = Object.freeze([
  "BUN_OPTIONS",
  "BUN_CONFIG_VERBOSE_FETCH",
  "BUN_CONFIG_MAX_HTTP_REQUESTS",
  "BUN_CONFIG_NO_CLEAR_TERMINAL",
  "BUN_CONFIG_REGISTRY",
  "BUN_INSTALL",
]);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, "..");
const ENTRY = join(REPO_ROOT, ENTRY_RELATIVE);
const OUTDIR = join(REPO_ROOT, OUTDIR_RELATIVE);
const MANIFEST_PATH = join(REPO_ROOT, RELEASE_TARGETS_RELATIVE);

const PACKAGE_VERSION = JSON.parse(
  readFileSync(join(REPO_ROOT, "package.json"), "utf8"),
).version;

function resolveBunCommand() {
  const override = process.env["UMACTUALLY_BUN_BIN"];
  if (override !== undefined && override.length > 0) {
    if (SCRIPT_DETECT.test(override)) {
      return { command: process.execPath, prefixArgs: [override] };
    }
    return { command: override, prefixArgs: [] };
  }
  return { command: "bun", prefixArgs: [] };
}

function runBun(args, label) {
  const { command, prefixArgs } = resolveBunCommand();
  const fullArgs = [...prefixArgs, ...args];
  const result = spawnSync(command, fullArgs, {
    cwd: REPO_ROOT,
    env: buildSpawnEnv(),
    encoding: "utf8",
  });
  if (result.error !== undefined && result.error !== null) {
    throw new Error(`bun ${label} failed to spawn: ${result.error.message}`);
  }
  if (result.status !== 0) {
    const stderr = result.stderr ?? "";
    const stdout = result.stdout ?? "";
    throw new Error(
      `bun ${label} exited with status ${String(result.status)}\nstdout: ${stdout}\nstderr: ${stderr}`,
    );
  }
  return result;
}

function assertBunVersion() {
  const { command, prefixArgs } = resolveBunCommand();
  const result = spawnSync(command, [...prefixArgs, "--version"], {
    cwd: REPO_ROOT,
    env: buildSpawnEnv(),
    encoding: "utf8",
  });
  if (result.error !== undefined && result.error !== null) {
    throw new Error(`bun --version failed to spawn: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `bun --version exited with status ${String(result.status)}\nstderr: ${result.stderr ?? ""}`,
    );
  }
  const reported = (result.stdout ?? "").trim();
  if (reported !== EXPECTED_BUN_VERSION) {
    throw new Error(
      `Bun version mismatch: expected ${EXPECTED_BUN_VERSION} but found ${reported}`,
    );
  }
}

function buildSpawnEnv() {
  const env = { ...process.env };
  for (const key of CLEANED_ENV_KEYS) {
    delete env[key];
  }
  return env;
}

function buildArgsFor(target) {
  const outfile = join(OUTDIR, target.rawName);
  return [
    "build",
    ENTRY,
    "--compile",
    "--minify",
    "--sourcemap",
    "--no-compile-autoload-dotenv",
    "--no-compile-autoload-bunfig",
    `--target=${target.bunTarget}`,
    `--outfile=${outfile}`,
    `--define=UMACTUALLY_VERSION='"${PACKAGE_VERSION}"'`,
  ];
}

function buildOneTarget(target) {
  const args = buildArgsFor(target);
  console.log(`\nBuilding ${target.id} -> ${target.rawName}`);
  runBun(args, `build ${target.id}`);
  console.log(`  ✓ ${target.rawName}`);
}

export async function main(argv = process.argv.slice(2)) {
  const targets = parseReleaseTargets({ manifestPath: MANIFEST_PATH });
  const filter = argv[0];
  const selected = filter !== undefined && filter.length > 0
    ? targets.filter((t) => t.id === filter)
    : targets;
  if (selected.length === 0) {
    console.error(`Unknown target: ${filter}`);
    console.error(`Available: ${targets.map((t) => t.id).join(", ")}`);
    process.exit(1);
  }

  assertBunVersion();
  mkdirSync(OUTDIR, { recursive: true });

  for (const target of selected) {
    buildOneTarget(target);
  }

  console.log("");
  console.log(`All ${selected.length} target(s) built successfully in ${OUTDIR}/`);
}

const isCliEntry = process.argv[1] !== undefined
  && fileURLToPath(import.meta.url) === process.argv[1];
if (isCliEntry) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  });
}