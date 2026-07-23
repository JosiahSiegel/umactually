#!/usr/bin/env node
// SPDX-License-Identifier: MIT
//
// Windows-only Node SEA standalone binary build.
//
// This script exists because `@tsdown/exe`'s tar-based Node binary
// download path is broken on Windows: tar on Windows interprets the
// colon in `https://nodejs.org/dist/.../node-v25.7.0-win-x64.zip`
// as a drive letter (`C:`) and exits with
// "Cannot connect to C: resolve failed". The error surfaces from
// @tsdown/exe dist/index.mjs:163 (`extractBinary`).
//
// To work around the broken tar path, this script:
//
//   1. Runs `tsdown` (without --exe) to bundle src/cli.ts into
//      dist/cli.mjs. This is platform-agnostic JS bundling.
//   2. Writes a sea-config.json that points `main` at the bundle
//      AND `output` at the final binary path.
//   3. Calls `node --build-sea=<config>` (a Node 25.5+ core
//      command) to generate the binary in-place. The Node binary
//      used for the injection is `process.execPath` — the Node
//      25.7.0 already installed on the windows-2025 runner. The
//      output is a Windows .exe, because the source binary is a
//      Windows .exe.
//
// This script MUST run on a Windows runner. On Linux/macOS it
// produces a non-Windows binary. The CI job `build-package-windows`
// runs on `windows-2025` for this reason.
//
// Why a separate script (not a --target flag on build-sea.mjs):
//   - The Linux path uses @tsdown/exe because it works on Linux and
//     produces all 5 binaries in one invocation. Forcing the
//     Windows path through that helper would re-introduce the
//     broken tar code.
//   - The Windows build only needs 2 binaries (x64 + arm64), so a
//     separate narrow script keeps the wiring obvious.
//
// Outputs (under release/, matching the manifest rawName):
//   umactually-windows-x64.exe
//   umactually-windows-arm64.exe
//
// Test seam: UMACTUALLY_NODE_BIN override can point at a fake node
// shim during unit tests. The build still asserts Node 25.7+ to
// keep parity with build-sea.mjs.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { MIN_RAW_BYTES } from "./release-size-limits.mjs";

const EXPECTED_NODE_MAJOR = 25;
const EXPECTED_NODE_MINOR = 6;
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const BUNDLE_DIR = join(REPO_ROOT, "dist");
const BUNDLE_PATH = join(BUNDLE_DIR, "cli.cjs");
const SEA_CONFIG_PATH = join(BUNDLE_DIR, "sea-config.json");
const OUTDIR = join(REPO_ROOT, "release");
const MANIFEST_PATH = join(REPO_ROOT, "scripts", "release-targets.json");

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
      `build-sea-windows: Node version mismatch: expected >= ${EXPECTED_NODE_MAJOR}.${EXPECTED_NODE_MINOR}.0 ` +
      `(for node --build-sea) but found ${version}.`,
    );
  }
  if (process.platform !== "win32") {
    // Don't hard-fail here: the BUNDLE step (tsdown) works fine on
    // Linux, and the SEA-injection step (node --build-sea) produces
    // a Linux binary on Linux. We allow Linux execution for local
    // dev / test-seam verification, but log a warning so the user
    // notices. CI is gated on `runs-on: windows-2025` (see
    // .github/workflows/release.yml:build-package-windows) so a
    // Linux dry-run cannot ship to a release.
    console.warn(
      `build-sea-windows: running on ${process.platform}; the produced binaries will be ${process.platform} binaries, not Windows .exe. ` +
      `For Windows .exe binaries, run this script on a Windows host.`,
    );
  }
}

function loadManifestWindowsTargets() {
  const raw = readFileSync(MANIFEST_PATH, "utf8");
  const all = JSON.parse(raw);
  return all
    .filter((t) => /^windows-/.test(t.id))
    .map((t) => ({ id: t.id, rawName: t.rawName }));
}

function resolveTsdownCommand() {
  const override = process.env["UMACTUALLY_TSDOWN_BIN"];
  if (override !== undefined && override.length > 0) {
    if (/\.(mjs|cjs|js)$/i.test(override)) {
      return { command: process.execPath, prefixArgs: [override] };
    }
    return { command: override, prefixArgs: [] };
  }
  // npm installs a platform-specific shim:
  //   - Windows:    node_modules/.bin/tsdown.cmd (or .ps1)
  //   - Linux/mac:  node_modules/.bin/tsdown
  const binDir = join(REPO_ROOT, "node_modules", ".bin");
  const candidates = process.platform === "win32"
    ? ["tsdown.cmd", "tsdown.ps1", "tsdown"]
    : ["tsdown"];
  for (const name of candidates) {
    const p = join(binDir, name);
    if (existsSync(p)) {
      if (name.endsWith(".ps1")) {
        return {
          command: "powershell",
          prefixArgs: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", p],
        };
      }
      return { command: p, prefixArgs: [] };
    }
  }
  return { command: "npx", prefixArgs: ["--no-install", "tsdown"] };
}

function runTsdown(args, label) {
  const { command, prefixArgs } = resolveTsdownCommand();
  const fullArgs = [...prefixArgs, ...args];
  const needsShell = process.platform === "win32" && command.toLowerCase().endsWith(".cmd");
  const result = spawnSync(command, fullArgs, {
    cwd: REPO_ROOT,
    env: process.env,
    encoding: "utf8",
    shell: needsShell,
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

function buildBundle() {
  // Run `tsdown` against `tsdown.windows.config.ts` (NOT
  // `tsdown.config.ts`). The full config has an `exe:` block that
  // triggers @tsdown/exe's postBuild step — which downloads a
  // Node binary and runs tar, both of which are broken on Windows
  // (the tar command misinterprets the colon in the URL as a drive
  // letter). The Windows config is the same shape but with the
  // `exe:` block removed, so tsdown only does the platform-agnostic
  // JS bundling. The Windows .exe is then produced by
  // `node --build-sea` in buildSeaBinary() below.
  //
  // The config emits a CJS bundle (dist/cli.cjs) — not ESM
  // (dist/cli.mjs). Node 25.7.0's SEA runtime has a real bug
  // loading .mjs files as ESM; the embedded main is loaded as
  // CJS even with the .mjs extension, producing
  // "Cannot use import statement outside a module". Reproduced
  // in /tmp/test-sea-esm.mjs on 2026-07-23. CJS bundles don't
  // have the loading issue. node:-prefixed imports still work
  // under CJS in Node 25.7.0.
  console.log(`\nBuilding dist/cli.cjs via tsdown (Windows config, CJS, no exe)`);
  runTsdown(["--config", join(REPO_ROOT, "tsdown.windows.config.ts")], "bundle");
  if (!existsSync(BUNDLE_PATH)) {
    throw new Error(
      `build-sea-windows: expected bundle at ${BUNDLE_PATH} but it was not produced. ` +
      `Check tsdown.windows.config.ts and the npm run build script.`,
    );
  }
}

function resolveNodeCommand() {
  // UMACTUALLY_NODE_BIN override: a unit-test seam that points at a
  // fake node shim. When the override ends in .mjs/.cjs/.js, run it
  // via process.execPath (same pattern as build-sea.mjs).
  const override = process.env["UMACTUALLY_NODE_BIN"];
  if (override !== undefined && override.length > 0) {
    if (/\.(mjs|cjs|js)$/i.test(override)) {
      return { command: process.execPath, prefixArgs: [override] };
    }
    return { command: override, prefixArgs: [] };
  }
  return { command: process.execPath, prefixArgs: [] };
}

function runNode(args, label) {
  const { command, prefixArgs } = resolveNodeCommand();
  const fullArgs = [...prefixArgs, ...args];
  const result = spawnSync(command, fullArgs, {
    cwd: REPO_ROOT,
    env: process.env,
    encoding: "utf8",
  });
  if (result.error !== undefined && result.error !== null) {
    throw new Error(`node ${label} failed to spawn: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `node ${label} exited with status ${String(result.status)}\n` +
      `stdout: ${result.stdout ?? ""}\n` +
      `stderr: ${result.stderr ?? ""}`,
    );
  }
}

function buildSeaBinary(target) {
  // `node --build-sea=<config>` injects the SEA blob in-place into
  // the current Node binary (process.execPath) and writes the
  // result to config.output. The injection reuses the binary's
  // pre-allocated placeholder region — the output is the same size
  // as process.execPath, NOT process.execPath + blob size.
  //
  // --build-sea requires the `=...` form (Node 25.7.0 rejects
  // `--build-sea <config>` with "--build-sea requires an argument").
  const outPath = join(OUTDIR, target.rawName);
  console.log(`\nBuilding ${outPath} via node --build-sea`);
  const config = {
    main: BUNDLE_PATH,
    output: outPath,
    useSnapshot: false,
  };
  writeFileSync(SEA_CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
  runNode([`--build-sea=${SEA_CONFIG_PATH}`], "build-sea");
  if (!existsSync(outPath)) {
    throw new Error(
      `build-sea-windows: expected binary at ${outPath} but it was not produced.`,
    );
  }
  const stat = statSync(outPath);
  if (stat.size < MIN_RAW_BYTES) {
    throw new Error(
      `build-sea-windows: binary at ${outPath} is only ${stat.size} bytes; ` +
      `expected >= ${MIN_RAW_BYTES} (suspicious — probably a build error).`,
    );
  }
  console.log(`  ✓ ${outPath} (${stat.size} bytes)`);
}

export async function main() {
  assertNodeVersion();

  // Use the manifest as the source of truth for the Windows targets
  // so adding a new windows-<arch> in scripts/release-targets.json
  // automatically picks it up here (no edit to this script needed).
  const targets = loadManifestWindowsTargets();
  if (targets.length === 0) {
    throw new Error(
      "build-sea-windows: no windows-* targets in scripts/release-targets.json",
    );
  }

  mkdirSync(BUNDLE_DIR, { recursive: true });
  mkdirSync(OUTDIR, { recursive: true });

  // Wipe any stale output from a previous build so a half-built
  // tree (e.g. a previous run that errored after building x64 but
  // before arm64) cannot ship a stale binary. Same defense as
  // build-sea.mjs.
  for (const t of targets) {
    const p = join(OUTDIR, t.rawName);
    if (existsSync(p)) unlinkSync(p);
  }

  buildBundle();

  for (const t of targets) {
    buildSeaBinary(t);
  }

  console.log(`\nAll ${targets.length} Windows target(s) built successfully in ${OUTDIR}/`);
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
    console.error(`\nbuild-sea-windows: ${message}`);
    process.exit(1);
  });
}
