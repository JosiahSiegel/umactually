#!/usr/bin/env node
// SPDX-License-Identifier: MIT
//
// scripts/run-review-eval.mjs — Task 3 hermetic review-eval gate.
//
// Boots the bundled mock LLM server, drives every registered fixture
// through the real prompt → provider transport → parser →
// verification/filter → durable-finding pipeline, aggregates the
// per-fixture results into a schema-versioned v2 report, and exits
// non-zero when any threshold is breached.
//
// Usage:
//   node scripts/run-review-eval.mjs
//   node scripts/run-review-eval.mjs --output <path>
//   node scripts/run-review-eval.mjs --summary <path>
//   node scripts/run-review-eval.mjs --validate-snapshot <snap1> [<snap2> ...]
//
// Exit codes:
//   0  all thresholds pass
//   1  gate failure (threshold breach, snapshot incompatibility, runner error)
//   2  mock server failed to start / timed out
//
// This script is the SINGLE entry point invoked by:
//   - npm run test:review-eval
//   - .github/workflows/ci.yml
//   - .github/workflows/release.yml (via npm run prepublishOnly)
//   - npm run prepublishOnly
// Each invocation runs the hermetic gate exactly once.
//
// Implementation note: the gate runner + CLI live in test/e2e/*.ts so
// the existing TypeScript toolchain (tsc + vitest) covers them. We
// execute the .ts source via Node 24's built-in `--experimental-transform-types`
// (engines.node >=24 is already pinned in package.json) plus a tiny
// `scripts/review-eval-loader.mjs` that rewrites TypeScript's canonical
// `./foo.js` imports to `./foo.ts` so the gate loads cleanly without
// a bundler and without adding new external dependencies.

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const loader = join(repoRoot, "scripts", "review-eval-loader.mjs");
const cli = join(repoRoot, "test", "e2e", "review-eval-cli.ts");

const argv = process.argv.slice(2);
let summaryPath;
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === "--summary" || argv[i] === "-s") {
    const next = argv[++i];
    if (next !== undefined) summaryPath = next;
  }
}

const child = spawn(
  process.execPath,
  [
    `--loader=${pathToFileURL(loader).href}`,
    "--experimental-transform-types",
    "--no-warnings=ExperimentalWarning",
    cli,
    ...argv,
  ],
  { stdio: ["ignore", "pipe", "inherit"] },
);

let buf = "";
child.stdout.on("data", (chunk) => {
  buf += chunk.toString("utf8");
  let idx;
  while ((idx = buf.indexOf("\n")) !== -1) {
    const line = buf.slice(0, idx + 1);
    buf = buf.slice(idx + 1);
    process.stdout.write(line);
  }
});

child.on("exit", (code) => {
  if (buf.length > 0) {
    process.stdout.write(buf);
    buf = "";
  }
  if (summaryPath !== undefined && existsSync(summaryPath)) {
    const summary = readFileSync(summaryPath, "utf8");
    process.stdout.write(summary);
  }
  process.exit(code ?? 1);
});
