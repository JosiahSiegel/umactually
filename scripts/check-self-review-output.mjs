#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Compatibility shim for the in-tree self-review workflow.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = resolve(packageRoot, "bin", "umactually.mjs");
const configuredPaths = process.argv.slice(2);
const paths = configuredPaths.length > 0
  ? configuredPaths
  : [
      "artifacts/manual/s1-github-self-review.md",
      "artifacts/manual/s4-azure-mocked-run.json",
    ];

let checked = 0;
let exitCode = 0;
for (const path of paths) {
  const artifactPath = resolve(packageRoot, path);
  if (!existsSync(artifactPath)) {
    if (configuredPaths.length > 0) {
      process.stderr.write(`umactually: ${path}: file not found\n`);
      exitCode = 1;
    }
    continue;
  }

  checked += 1;
  const result = spawnSync(process.execPath, [cli, "check-review-artifact", artifactPath], {
    cwd: packageRoot,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    exitCode = 1;
  }
}

if (checked === 0) {
  process.stderr.write("umactually: no output artifacts found; self-review produced nothing\n");
  exitCode = 1;
}
process.exit(exitCode);
