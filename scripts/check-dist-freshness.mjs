#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Guard: refuse to run when dist/ is missing or older than any src/*.ts file.
// The CLI wrapper only loads dist/cli.js (never .ts), so a stale bundle is a
// silent footgun. This script exits 1 in that case so CI catches it.

import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");

const REQUIRED_BUNDLES = ["dist/index.js", "dist/cli.js"];
const SRC_ROOT = join(packageRoot, "src");

function main() {
  for (const relativeBundle of REQUIRED_BUNDLES) {
    const bundlePath = join(packageRoot, relativeBundle);
    if (!existsSync(bundlePath)) {
      fail(`missing bundle: ${relativeBundle} (run "npm run bundle")`);
    }
    const bundleMtime = statSync(bundlePath).mtimeMs;
    const newestSrcMtime = newestMtime(SRC_ROOT);
    if (bundleMtime < newestSrcMtime) {
      fail(
        `stale bundle: ${relativeBundle} (mtime ${bundleMtime}) is older than newest src/ file (mtime ${newestSrcMtime}). Run "npm run bundle".`,
      );
    }
  }
  process.stdout.write("dist/ is fresh.\n");
}

function newestMtime(dir) {
  let newest = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) continue;
    const entries = readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".ts")) {
        const mtime = statSync(fullPath).mtimeMs;
        if (mtime > newest) newest = mtime;
      }
    }
  }
  return newest;
}

function fail(message) {
  process.stderr.write(`dist-freshness: ${message}\n`);
  process.exit(1);
}

main();