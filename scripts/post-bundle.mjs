#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// ncc writes its bundle as `index.js` inside the chosen output directory,
// regardless of the source filename. To produce both dist/index.js (the
// action entry) and dist/cli.js (the CLI entry) from two ncc invocations,
// we run the CLI build into a temp directory and rename index.js -> cli.js.

import { copyFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const distDir = join(packageRoot, "dist");
const tmpDir = join(packageRoot, "dist-tmp");

function main() {
  const entries = readdirSync(tmpDir);
  const indexEntry = entries.find((entry) => entry === "index.js");
  if (indexEntry === undefined) {
    throw new Error("post-bundle: expected index.js inside dist-tmp/ after ncc build");
  }
  copyFileSync(join(tmpDir, indexEntry), join(distDir, "cli.js"));

  // Mirror dist/package.json from tmp into the canonical dist/.
  const pkgEntry = entries.find((entry) => entry === "package.json");
  if (pkgEntry !== undefined) {
    copyFileSync(join(tmpDir, pkgEntry), join(distDir, "package.json"));
  }

  rmSync(tmpDir, { recursive: true, force: true });
  process.stdout.write("post-bundle: dist/ contains index.js, cli.js, package.json\n");
}

main();