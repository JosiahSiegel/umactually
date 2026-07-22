#!/usr/bin/env node
// SPDX-License-Identifier: MIT
//
// Cross-compile Node SEA (Single Executable Application) standalone binaries.
//
// Produces 5 binaries from src/cli.ts into ./release/:
//   umactually-linux-x64      (tar.gz)
//   umactually-linux-arm64    (tar.gz)
//   umactually-darwin-arm64   (tar.gz)  (darwin-x64 dropped in v0.6.0)
//   umactually-windows-x64.exe (zip)
//   umactually-windows-arm64.exe (zip)
//
// Uses tsdown (Rolldown-backed) with @tsdown/exe to drive `node --build-sea`.
// The resulting binary is a self-contained executable that runs on a system
// without Node installed (it bundles Node 25.7).
//
// Usage:
//   node scripts/build-sea.mjs              # build all targets
//   node scripts/build-sea.mjs <targetId>   # accepted for compatibility, builds all
//
// Test seam: UMACTUALLY_TSDOWN_BIN points at a fake tsdown stub. When that
// path ends in .mjs / .js / .cjs the script invokes it via process.execPath
// so a Node-only harness can stand in for tsdown during unit tests.
//
// Pinned: Node 25.7.0+ in the build environment. Any other version aborts
// before any spawn.
//
// v0.6.0 note: tsdown's CLI only accepts `--exe` as a flag — the per-target
// `fileName` and `targets` are config-file only (tsdown.config.ts). So this
// script runs `tsdown --exe` once and lets the config drive all 5 targets.
// The optional <targetId> argument is accepted for backwards compatibility
// (and for local debugging) but is a no-op; the script always builds all 5.

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Import the size thresholds from the constants-only module so
// build-sea.mjs does NOT also load scripts/verify-release-sizes.mjs
// (which has a CLI bootstrap / `invokedDirectly` IIFE / `process.exit`
// side effects). Previously the import path forced the verifier to
// evaluate every time this script ran, which is hostile to test
// harnesses that import build-sea.mjs under a different argv
// (e.g. UMACTUALLY_TSDOWN_BIN tests).
import { MIN_RAW_BYTES } from "./release-size-limits.mjs";

const EXPECTED_NODE_MAJOR = 25;
const EXPECTED_NODE_MINOR = 7;
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

function loadTargets() {
  const raw = readFileSync(MANIFEST_PATH, "utf8");
  return JSON.parse(raw);
}

function assertNodeVersion() {
  const version = process.versions.node ?? "";
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (match === null) {
    throw new Error(
      `Node version parse failed: process.versions.node="${version}". ` +
      `Expected >= ${EXPECTED_NODE_MAJOR}.${EXPECTED_NODE_MINOR}.0.`,
    );
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (
    major < EXPECTED_NODE_MAJOR ||
    (major === EXPECTED_NODE_MAJOR && minor < EXPECTED_NODE_MINOR)
  ) {
    throw new Error(
      `Node version mismatch: expected >= ${EXPECTED_NODE_MAJOR}.${EXPECTED_NODE_MINOR}.0 ` +
      `(for Node SEA --build-sea) but found ${version}. ` +
      `Upgrade Node via 'nvm install ${EXPECTED_NODE_MAJOR}' or use 'fnm use' with the repo's .nvmrc.`,
    );
  }
}

function resolveTsdownCommand() {
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

function runTsdown(args, label) {
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
      `tsdown ${label} exited with status ${String(result.status)}\n` +
      `stdout: ${result.stdout ?? ""}\n` +
      `stderr: ${result.stderr ?? ""}`,
    );
  }
}

function buildAll() {
  console.log(`\nBuilding all targets via tsdown --exe`);
  // Single tsdown invocation. The config has all 6 targets + seaConfig;
  // tsdown iterates them in one process and emits 6 binaries into OUTDIR.
  //
  // We pass --exe to enable the executable feature in case the config
  // loader doesn't pick up the nested `exe: { ... }` object. The config
  // already declares `exe: { targets: [...], seaConfig: {...} }`, which
  // is the source of truth for per-target settings. If `--exe` is also
  // passed and tsdown's defu() merge collapses the two (object vs
  // boolean `true`), the targets list could be lost. To stay safe we
  // rely solely on the config — dropping `--exe` here.
  runTsdown([
    "--config", TSDOWN_CONFIG,
  ], "build all targets");
}

// @tsdown/exe uses the Node download URL convention for target.platform:
// "win" for Windows (e.g. `node-v25.7.0-win-x64.zip`). That yields
// filenames like `umactually-win-x64.exe`. Our manifest and install
// scripts (install.sh, install.ps1) use the `windows-` prefix instead
// (matching GitHub's release-asset convention). Normalize the Windows
// outputs after the build so downstream consumers see a single naming.
function normalizeWindowsOutputs() {
  const RENAMES = [
    ["umactually-win-x64.exe", "umactually-windows-x64.exe"],
    ["umactually-win-arm64.exe", "umactually-windows-arm64.exe"],
  ];
  for (const [from, to] of RENAMES) {
    const fromPath = join(OUTDIR, from);
    const toPath = join(OUTDIR, to);
    if (!existsSync(fromPath)) continue;
    if (existsSync(toPath)) {
      // A previous (failed or stale) build left a `*-windows-*.exe`
      // in `release/`. If we silently skip the rename (the previous
      // behavior), the stale binary ships and `verifyOutput` passes
      // against the old file even though the build produced a fresh
      // one. Drop the stale destination first so the rename below
      // promotes the just-built `*-win-*.exe` into its manifest slot.
      unlinkSync(toPath);
    }
    renameSync(fromPath, toPath);
  }
}

// Defensive: tsdown's documented default `exe.outDir` is "build/" (see
// https://tsdown.dev/options/exe), and the @tsdown/exe type definitions
// do not declare `outDir` at all. If the `exe.outDir: "release"` pin
// in tsdown.config.ts is ever ignored, the SEA binaries land in
// `build/<name>` or `dist/<name>` (Rolldown's normal output dir). This
// pass sweeps every plausible output dir and copies any candidate
// binary into the manifest-named slot under `release/`. It is a no-op
// when tsdown already wrote to `release/` (the rename is skipped
// because the destination already exists).
function collectSeaOutputs() {
  // NOTE: do NOT include "release" in CANDIDATE_DIRS. The release/
  // dir is the destination — if it already has a stale
  // umactually-win-*.exe from a previous failed build, the rename
  // in normalizeWindowsOutputs() skips (because the *-windows-*
  // target already exists, possibly stale), and this sweep would
  // also skip (because the destination exists). The result is
  // silently stale Windows binaries in release/. Sweep only the
  // tsdown / Rolldown fallback dirs (build, dist) and let
  // normalizeWindowsOutputs() own the release/ rename.
  const CANDIDATE_DIRS = ["build", "dist"];
  for (const dir of CANDIDATE_DIRS) {
    const dirPath = join(REPO_ROOT, dir);
    if (!existsSync(dirPath)) continue;
    // Patterns to look for, in priority order. The `umactually-` prefix
    // matches what tsdown would produce with `fileName: "umactually"`.
    const PATTERNS = [
      /^umactually-linux-x64$/,
      /^umactually-linux-arm64$/,
      /^umactually-darwin-x64$/,
      /^umactually-darwin-arm64$/,
      /^umactually-win-x64\.exe$/,
      /^umactually-win-arm64\.exe$/,
    ];
    for (const pattern of PATTERNS) {
      for (const entry of readdirSync(dirPath)) {
        if (!pattern.test(entry)) continue;
        const fromPath = join(dirPath, entry);
        const stat = statSync(fromPath);
        // Reject zero-byte files (a partially-written tsdown output) and
        // anything under the MIN_RAW_BYTES floor (1 MiB — the same
        // threshold scripts/verify-release-sizes.mjs enforces for
        // already-renamed release/ outputs). Without the lower bound,
        // a corrupted / truncated tsdown run could leave a 100KB
        // "binary" in build/ that the smoke-sea CI on linux-x64 would
        // catch but darwin/windows targets (no CI smoke coverage)
        // would ship. Bail with a warning instead of promoting the
        // half-written file into release/ — verifyOutput() further
        // down will then fail with a clear "expected output not
        // found" message rather than a confusing "binary crashed on
        // launch" from a downstream consumer.
        if (!stat.isFile() || stat.size < MIN_RAW_BYTES) {
          console.warn(
            `  ⚠ skipping ${dir}/${entry} ` +
            `(${stat.size} bytes < MIN_RAW_BYTES ${MIN_RAW_BYTES})`,
          );
          continue;
        }
        const toName = entry.replace(/^umactually-win-/, "umactually-windows-");
        const toPath = join(OUTDIR, toName);
        if (existsSync(toPath)) continue; // already in place
        const fromDisplay = `${dir}/${entry}`;
        try {
          renameSync(fromPath, toPath);
          console.log(`  ↪ moved ${fromDisplay} → release/${toName}`);
        } catch {
          // Cross-device move can fail (e.g. EXDEV); fall back to
          // copy + delete so the build still succeeds.
          copyFileSync(fromPath, toPath);
          unlinkSync(fromPath);
          console.log(`  ↪ copied ${fromDisplay} → release/${toName}`);
        }
      }
    }
  }
}

function verifyOutput(target) {
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

export async function main(argv = process.argv.slice(2)) {
  assertNodeVersion();

  const targets = loadTargets();
  const filter = argv[0];
  if (filter !== undefined && filter.length > 0 && filter !== "all") {
    // <targetId> is accepted for backwards compat and local debugging.
    // The build always produces all 6 binaries (tsdown's --exe mode has
    // no per-target flag; the targets are config-driven). We log the
    // filter so users can see it took effect even though the build is
    // not actually narrowed.
    const known = targets.some((t) => t.id === filter);
    if (!known) {
      console.error(`Unknown target: ${filter}`);
      console.error(`Available: ${targets.map((t) => t.id).join(", ")}`);
      process.exit(1);
    }
    console.log(`(filter ${filter} accepted but all 6 targets are built — see tsdown.config.ts)`);
  }

  mkdirSync(OUTDIR, { recursive: true });

  // Wipe every manifest target's output at the start of a build so a
  // partial tsdown run (e.g. win-x64 succeeds, win-arm64 fails
  // partway through) cannot leave a half-stale `release/umactually-
  // windows-arm64.exe` from a previous run ship to users. Without
  // this, normalizeWindowsOutputs() only handles the case where the
  // tsdown-produced source exists; if the source is missing, the
  // stale destination is left untouched and verifyOutput() still
  // passes against it. The per-target loop here is narrower than a
  // wholesale `rm -rf release/` so we don't clobber unrelated files
  // a developer may have dropped there for debugging.
  for (const t of targets) {
    const p = join(OUTDIR, t.rawName);
    if (existsSync(p)) unlinkSync(p);
  }

  buildAll();
  normalizeWindowsOutputs();
  collectSeaOutputs();

  for (const target of targets) {
    verifyOutput(target);
  }

  console.log(`\nAll ${targets.length} target(s) built successfully in ${OUTDIR}/`);
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
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\nbuild-sea: ${message}`);
    process.exit(1);
  });
}
