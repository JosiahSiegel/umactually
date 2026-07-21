#!/usr/bin/env node
// SPDX-License-Identifier: MIT
//
// Cross-compile Node SEA (Single Executable Application) standalone binaries.
//
// Produces 6 binaries from src/cli.ts into ./release/:
//   umactually-linux-x64      (tar.gz)
//   umactually-linux-arm64    (tar.gz)
//   umactually-darwin-x64     (tar.gz)
//   umactually-darwin-arm64   (tar.gz)
//   umactually-windows-x64.exe (zip)
//   umactually-windows-arm64.exe (zip)
//
// Uses tsdown (Rolldown-backed) with @tsdown/exe to drive `node --build-sea`.
// The resulting binary is a self-contained executable that runs on a system
// without Node installed (it bundles Node 25.7).
//
// Usage:
//   node scripts/build-sea.mjs              # build all targets
//   node scripts/build-sea.mjs <targetId>   # build one target
//   node scripts/build-sea.mjs all          # explicit "all"
//
// Test seam: UMACTUALLY_TSDOWN_BIN points at a fake tsdown stub. When that
// path ends in .mjs / .js / .cjs the script invokes it via process.execPath
// so a Node-only harness can stand in for tsdown during unit tests.
//
// Pinned: Node 25.7.0+ in the build environment. Any other version aborts
// before any spawn.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_NODE_MAJOR = 25;
const SCRIPT_DETECT = /\.(mjs|cjs|js)$/i;
const ENTRY_RELATIVE = "src/cli.ts";
const OUTDIR_RELATIVE = "release";
const RELEASE_TARGETS_RELATIVE = "scripts/release-targets.json";
const TSDOWN_CONFIG_RELATIVE = "tsdown.config.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const ENTRY = join(REPO_ROOT, ENTRY_RELATIVE);
const OUTDIR = join(REPO_ROOT, OUTDIR_RELATIVE);
const MANIFEST_PATH = join(REPO_ROOT, RELEASE_TARGETS_RELATIVE);
const TSDOWN_CONFIG = join(REPO_ROOT, TSDOWN_CONFIG_RELATIVE);

interface RawTarget {
  readonly id: string;
  readonly bunTarget: string;
  readonly rawName: string;
  readonly archiveName: string;
  readonly archiveType: "tar.gz" | "zip";
  readonly memberName: string;
  readonly installedName: string;
}

function loadTargets(): readonly RawTarget[] {
  const raw = readFileSync(MANIFEST_PATH, "utf8");
  return JSON.parse(raw) as readonly RawTarget[];
}

function assertNodeVersion(): void {
  const major = parseInt(process.versions.node, 10);
  if (Number.isNaN(major) || major < EXPECTED_NODE_MAJOR) {
    throw new Error(
      `Node version mismatch: expected >= ${EXPECTED_NODE_MAJOR}.0.0 (for Node SEA --build-sea) but found ${process.versions.node}. ` +
      `Upgrade Node via 'nvm install ${EXPECTED_NODE_MAJOR}' or use 'fnm use' with the repo's .nvmrc.`,
    );
  }
}

function resolveTsdownCommand(): { command: string; prefixArgs: readonly string[] } {
  const override = process.env["UMACTUALLY_TSDOWN_BIN"];
  if (override !== undefined && override.length > 0) {
    if (SCRIPT_DETECT.test(override)) {
      return { command: process.execPath, prefixArgs: [override] };
    }
    return { command: override, prefixArgs: [] };
  }
  // Local install via `node_modules/.bin/tsdown` (npm puts it on PATH for
  // `npm run` but we run via `node scripts/build-sea.mjs` which doesn't).
  const localBin = join(REPO_ROOT, "node_modules", ".bin", "tsdown");
  if (existsSync(localBin)) {
    return { command: localBin, prefixArgs: [] };
  }
  return { command: "tsdown", prefixArgs: [] };
}

function runTsdown(args: readonly string[], label: string): void {
  const { command, prefixArgs } = resolveTsdownCommand();
  const fullArgs = [...prefixArgs, ...args];
  const result = spawnSync(command, fullArgs, {
    cwd: REPO_ROOT,
    env: process.env,
    encoding: "utf8",
  });
  if (result.error !== undefined && result.error !== null) {
    throw new Error(`tsdown ${label} failed to spawn: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `tsdown ${label} exited with status ${String(result.status)}\nstdout: ${result.stdout ?? ""}\nstderr: ${result.stderr ?? ""}`,
    );
  }
}

function buildArgsFor(target: RawTarget): readonly string[] {
  return [
    "--config", TSDOWN_CONFIG,
    "--exe",
    "--exe.fileName", target.rawName,
    // Restrict tsdown to this target only. We pass the SEA target via the
    // targets array on the config, then override the fileName so the output
    // lands at the expected `release/umactually-<id>` path.
    "--exe.targets", `${deriveSeaPlatform(target)},${deriveSeaArch(target)},25.7.0`,
  ];
}

function deriveSeaPlatform(target: RawTarget): "win" | "darwin" | "linux" {
  if (target.archiveType === "zip") return "win";
  if (target.id.startsWith("darwin-")) return "darwin";
  if (target.id.startsWith("linux-")) return "linux";
  throw new Error(`build-sea: cannot derive platform from id "${target.id}"`);
}

function deriveSeaArch(target: RawTarget): "x64" | "arm64" {
  if (target.id.endsWith("-x64")) return "x64";
  if (target.id.endsWith("-arm64")) return "arm64";
  throw new Error(`build-sea: cannot derive arch from id "${target.id}"`);
}

function buildOneTarget(target: RawTarget): void {
  console.log(`\nBuilding ${target.id} -> ${target.rawName}`);
  runTsdown(buildArgsFor(target), `build ${target.id}`);

  // Verify the SEA blob was produced. tsdown writes to a path derived from
  // the fileName + platform/arch suffix (e.g. `umactually-linux-x64`).
  const expectedPath = join(OUTDIR, target.rawName);
  if (!existsSync(expectedPath)) {
    throw new Error(
      `build-sea: expected output not found at ${expectedPath}. ` +
      `tsdown may have changed its output naming convention; check the release/ directory.`,
    );
  }
  const stat = statSync(expectedPath);
  if (!stat.isFile() || stat.size === 0) {
    throw new Error(`build-sea: output at ${expectedPath} is not a non-empty file`);
  }
  console.log(`  ✓ ${target.rawName} (${stat.size} bytes)`);
}

export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  assertNodeVersion();

  const targets = loadTargets();
  const filter = argv[0];
  const selected = filter !== undefined && filter.length > 0 && filter !== "all"
    ? targets.filter((t) => t.id === filter)
    : targets;
  if (selected.length === 0) {
    console.error(`Unknown target: ${filter}`);
    console.error(`Available: ${targets.map((t) => t.id).join(", ")}`);
    process.exit(1);
  }

  mkdirSync(OUTDIR, { recursive: true });

  for (const target of selected) {
    buildOneTarget(target);
  }

  if (selected.length === targets.length) {
    console.log(`\nAll ${selected.length} target(s) built successfully in ${OUTDIR}/`);
  } else {
    console.log(`\n${selected.length} target(s) built in ${OUTDIR}/`);
  }
}

const invokedDirectly = (() => {
  if (typeof process.argv[1] !== "string") return false;
  try {
    return resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
  main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\nbuild-sea: ${message}`);
    process.exit(1);
  });
}
