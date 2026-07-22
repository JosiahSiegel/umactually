#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Thin executable wrapper that delegates to the bundled CLI.
// Resolves dist/cli.js relative to this file so the wrapper works both when
// the package is installed via npm and when invoked directly from a checkout.
// This shim NEVER falls back to .ts sources — the bundle must be built first.

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Node-version guard for direct CLI consumers (npm exec umactually,
// bunx umactually, global install, Azure DevOps pipeline step, etc.).
// GitHub Actions consumers are gated by action.yml's `runs.using: node24`
// which already pins the runner to Node 24, so this guard is a backstop
// for direct CLI invocations outside the Actions runtime.
//
// Runtime policy:
//   - For Node, require >= 24.0.0 (matches package.json `engines.node`).
//   - For Bun, also require >= 24.0.0 (Bun's `process.versions.bun` is
//     populated when running under Bun; Node-only environments leave it
//     undefined, which we treat as "not running under Bun").
//   - When both runtimes are present, prefer Bun ONLY if it meets the
//     threshold; otherwise prefer Node (so the error message surfaces
//     Node's version, which is what downstream tooling also reports).
//
//   Note: Bun's version scheme is `1.x.y`, not `24.x` — the gate uses
//   the major version (i.e. `1`) and compares against MIN_RUNTIME_MAJOR.
//   As of v0.6.0 this is a known mismatch (the gate accepts Bun 1.x as
//   if it were Node 24+); a follow-up PR will tighten the bound to
//   require Bun >= 1.2 once the CLI's transitive Node-24-API usage is
//   fully audited. See PR #104 review thread #21.
const MIN_RUNTIME_MAJOR = 24;
function parseMajor(versionString) {
  if (typeof versionString !== "string" || versionString.length === 0) {
    return Number.NaN;
  }
  return Number.parseInt(
    versionString.replace(/^v/u, "").split(".")[0] ?? "",
    10,
  );
}
const nodeMajor = parseMajor(process.versions.node);
const bunMajor = parseMajor(process.versions.bun);
const bunIsLive = Number.isFinite(bunMajor);
const useBun = bunIsLive && bunMajor >= MIN_RUNTIME_MAJOR;
const runtimeMajor = useBun ? bunMajor : nodeMajor;
const runtimeLabel = useBun
  ? `Bun ${process.versions.bun}`
  : `Node ${process.versions.node}`;
if (!Number.isFinite(runtimeMajor) || runtimeMajor < MIN_RUNTIME_MAJOR) {
  process.stderr.write(
    `umactually: requires Node >= ${MIN_RUNTIME_MAJOR}.x (detected ${runtimeLabel}).\n`,
  );
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const bundledCli = join(packageRoot, "dist", "cli.js");

if (!existsSync(bundledCli)) {
  process.stderr.write(
    [
      `umactually: cannot locate dist/cli.js (looked under ${packageRoot}).`,
      `Run "npm run bundle" to build the CLI, then retry.`,
      ``,
    ].join("\n"),
  );
  process.exit(127);
}

const moduleUrl = pathToFileURL(bundledCli).href;
const mod = await import(moduleUrl);

if (typeof mod.main !== "function") {
  process.stderr.write("umactually: bundled CLI does not export main().\n");
  process.exit(1);
}

const argv = process.argv.slice(2);
try {
  const exitCode = await mod.main(argv);
  if (typeof exitCode === "number") {
    process.exit(exitCode);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`umactually: ${message}\n`);
  process.exit(1);
}