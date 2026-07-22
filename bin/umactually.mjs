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
//   - For Bun, require >= 1.2.0 (Bun's `process.versions.bun` is
//     populated when running under Bun; Node-only environments leave
//     it undefined, which we treat as "not running under Bun"). Bun
//     uses a 1.x version scheme, so the gate is expressed as a
//     (major, minor) pair rather than a single major version number.
//   - When both runtimes are present, prefer Bun ONLY if it meets the
//     threshold; otherwise prefer Node (so the error message surfaces
//     Node's version, which is what downstream tooling also reports).
const MIN_RUNTIME_MAJOR = 24;
const MIN_BUN_MAJOR = 1;
const MIN_BUN_MINOR = 2;
function parseMajor(versionString) {
  if (typeof versionString !== "string" || versionString.length === 0) {
    return Number.NaN;
  }
  return Number.parseInt(
    versionString.replace(/^v/u, "").split(".")[0] ?? "",
    10,
  );
}
function parseMinor(versionString) {
  if (typeof versionString !== "string" || versionString.length === 0) {
    return Number.NaN;
  }
  const parts = versionString.replace(/^v/u, "").split(".");
  return Number.parseInt(parts[1] ?? "", 10);
}
const nodeMajor = parseMajor(process.versions.node);
const bunMajor = parseMajor(process.versions.bun);
const bunMinor = parseMinor(process.versions.bun);
const bunIsLive = Number.isFinite(bunMajor);
// Bun's version scheme is 1.x.y — accept it when major >= MIN_BUN_MAJOR
// AND (major > MIN_BUN_MAJOR || minor >= MIN_BUN_MINOR). The expression
// MUST wrap the right-hand disjunction in parentheses: `&&` binds
// tighter than `||`, so without them the previous code parsed as
// `(bunIsLive && bunMajor > MIN_BUN_MAJOR) || (bunIsLive && ...)`,
// which is logically equivalent here but reads as a precedence trap.
// The explicit grouping also makes the next line (useBun) read naturally.
// Bun's version scheme is 1.x.y — accept it when major >= MIN_BUN_MAJOR
// AND (major > MIN_BUN_MAJOR || minor >= MIN_BUN_MINOR). Note: the
// right-hand disjunction MUST be inside parentheses, both because `&&`
// binds tighter than `||` and because the major-greater branch alone
// would silently accept any 2.x.0 (e.g. 2.0.0-beta with minor=0)
// once Bun ever ships a 2.0.0. The "major >= MIN_BUN_MAJOR" outer
// AND-clause is the gate that prevents a future 2.0.0 from being
// accepted without the minor-floor check; the inner disjunction then
// permits any 2.x.y (or higher) regardless of minor, while still
// requiring minor >= MIN_BUN_MINOR when major is exactly the floor.
const bunMeetsThreshold =
  bunIsLive &&
  bunMajor >= MIN_BUN_MAJOR &&
  (bunMajor > MIN_BUN_MAJOR || bunMinor >= MIN_BUN_MINOR);
// Prefer Node when it meets the Node threshold — Node is the documented
// primary runtime, and the test suite + GitHub Actions runner both run
// under it. Only fall through to Bun when Node is absent or below
// threshold. (Node-only environments leave bunIsLive false, so
// bunMeetsThreshold is false there and useBun correctly stays false.)
const nodeMeetsThreshold = Number.isFinite(nodeMajor) && nodeMajor >= MIN_RUNTIME_MAJOR;
const useBun = !nodeMeetsThreshold && bunMeetsThreshold;
const runtimeLabel = useBun
  ? `Bun ${process.versions.bun}`
  : `Node ${process.versions.node}`;
// Per-runtime gate: Node is checked against MIN_RUNTIME_MAJOR, Bun is
// checked against its own (major, minor) pair. The previous code
// compared a single `runtimeMajor` (bunMajor=1 or nodeMajor=24+) against
// MIN_RUNTIME_MAJOR=24, which silently rejected every real-world Bun
// version (Bun's major is always 1) even though the error message
// advertised "Bun >= 1.2.x". Per-runtime checks make the gate honest.
const gatePasses = useBun
  ? bunMeetsThreshold
  : nodeMeetsThreshold;
if (!gatePasses) {
  process.stderr.write(
    `umactually: requires Node >= ${MIN_RUNTIME_MAJOR}.x or Bun >= ${MIN_BUN_MAJOR}.${MIN_BUN_MINOR}.x (detected ${runtimeLabel}).\n`,
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