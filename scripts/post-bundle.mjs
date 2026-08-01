#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// ncc always names its bundle `index.js`, regardless of the source filename.
// The package ships only the CLI runtime, so rename that output to `cli.js`.
// Dynamic chunks and package.json are already emitted beside it in dist/.
//
// We then strip or overwrite the `bin`, `files`, `publishConfig`, and
// `scripts` fields from dist/package.json because ncc copied the root
// package.json verbatim and those entries are sourced from the root, not
// from inside dist/. Without the strip:
//   - npm install flattens `dist/`, `bin/`, `scripts/`, etc. as siblings,
//     so the `bin: { umactually: "bin/umactually.mjs" }` copied into
//     dist/package.json resolves at install time to
//     `<installed-pkg>/dist/bin/umactually.mjs`, which doesn't exist.
//     (The real wrapper is at `<installed-pkg>/bin/umactually.mjs`.)
//   - `files: ["dist", "bin", "..."]` re-references dist/ recursively in
//     a way that npm v10 resolves as a subtree and bails with
//     "files contains the package.json" errors during publish.
//   - `scripts` from the root reappear under dist/scripts/, which is a
//     layering violation in the tarball.
//   - `publishConfig.access` is meaningless inside dist/.
//
// The minimal correct shape for dist/package.json is:
//   { name, version, type, main, dependencies }.
// We rewrite to exactly that set so a future ncc change can't quietly
// reintroduce any of the stripped fields.

import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const distDir = join(packageRoot, "dist");
const rootPkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));

function main() {
  const indexPath = join(distDir, "index.js");
  if (!existsSync(indexPath)) {
    throw new Error("post-bundle: expected index.js inside dist/ after ncc build");
  }
  renameSync(indexPath, join(distDir, "cli.js"));

  // Rewrite dist/package.json to the minimum surface npm needs at install
  // time. See file header for the per-field rationale. We deliberately do
  // NOT carry `name` or `version` from root unchanged — they already match
  // today, but rewriting them from root keeps the invariant single-sourced.
  const distPkg = {
    name: rootPkg.name,
    version: rootPkg.version,
    type: rootPkg.type ?? "commonjs",
    main: "cli.js",
    dependencies: rootPkg.dependencies ?? {},
  };
  writeFileSync(
    join(distDir, "package.json"),
    `${JSON.stringify(distPkg, null, 2)}\n`,
    "utf8",
  );

  process.stdout.write(
    "post-bundle: dist/ contains cli.js + a stripped package.json (name/version/type/main/dependencies only)\n",
  );
}

main();
