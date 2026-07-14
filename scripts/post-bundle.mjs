#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// ncc always names its bundle `index.js`, regardless of the source filename.
// The package ships only the CLI runtime, so rename that output to `cli.js`.
// Dynamic chunks and package.json are already emitted beside it in dist/.

import { existsSync, renameSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const distDir = join(packageRoot, "dist");
function main() {
  const indexPath = join(distDir, "index.js");
  if (!existsSync(indexPath)) {
    throw new Error("post-bundle: expected index.js inside dist/ after ncc build");
  }
  renameSync(indexPath, join(distDir, "cli.js"));
  process.stdout.write("post-bundle: dist/ contains cli.js, package.json, and any ncc dynamic chunks\n");
}

main();