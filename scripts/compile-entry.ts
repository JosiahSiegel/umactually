// SPDX-License-Identifier: MIT
// Dedicated entrypoint for Bun --compile standalone binary builds.
//
// This module statically imports `main` from src/cli.ts so Bun can bundle
// the entire dependency graph into a single executable. Unlike the npm
// shim (bin/umactually.mjs), this entry does NOT:
//   - dynamically import dist/cli.js at runtime
//   - enforce a Node version (the binary embeds Bun's runtime)
//   - look for dist/cli.js on the filesystem
//
// The binary IS Bun, not Node. The version guard in bin/umactually.mjs is
// intentionally omitted here because Bun ships its own JavaScriptCore.

import { main } from "../src/cli.js";

const argv = process.argv.slice(2);

try {
  const exitCode = await main(argv);
  if (typeof exitCode === "number") {
    process.exit(exitCode);
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`umactually: ${message}\n`);
  process.exit(1);
}
