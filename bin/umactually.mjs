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
// We accept the highest of {process.versions.node, process.versions.bun}
// so that `bunx umactually` works. Bun does not set process.versions.node;
// it sets process.versions.bun. Both report "vX.Y.Z" with a leading 'v';
// strip it before parsing the major version.
const MIN_NODE_MAJOR = 24;
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
const bestMajor = Math.max(
  Number.isFinite(nodeMajor) ? nodeMajor : 0,
  Number.isFinite(bunMajor) ? bunMajor : 0,
);
if (!Number.isFinite(bestMajor) || bestMajor < MIN_NODE_MAJOR) {
  const detected = Number.isFinite(nodeMajor)
    ? `Node ${process.versions.node}`
    : Number.isFinite(bunMajor)
      ? `Bun ${process.versions.bun}`
      : "unknown runtime";
  process.stderr.write(
    `umactually: requires Node >= ${MIN_NODE_MAJOR}.x (detected ${detected}).\n`,
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