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
//
// Re-bundle with `--external typescript` so the TypeScript compiler API is
// loaded at runtime instead of being inlined into dist/cli.js. NCC bundles
// the full ~10MB compiler when src/cli/context-provenance.ts statically
// imports `typescript`, and that inlined compiler references `__filename`
// from CJS scope, which is undefined inside the ESM output that
// `dist/package.json` declares (`"type": "module"`). The bin shim
// (`bin/umactually.mjs`) fails to load dist/cli.js with:
//   "__filename is not defined in ES module scope"
// until the compiler is externalized. The npm build script cannot pass
// `--external` itself, so this script re-runs ncc with the flag and
// discards the initial fully-bundled output.

import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const distDir = join(packageRoot, "dist");
const rootPkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));

function rebuildWithExternal() {
  // Remove every artifact emitted by the first ncc run so the rebuild
  // produces a clean dist/ rather than mixing two bundles' outputs.
  let priorEntries = [];
  try {
    priorEntries = readdirSync(distDir);
  } catch {
    priorEntries = [];
  }
  for (const name of priorEntries) {
    rmSync(join(distDir, name), { force: true, recursive: true });
  }
  execFileSync(
    "npx",
    [
      "--no-install",
      "ncc",
      "build",
      "src/cli.ts",
      "-o",
      distDir,
      "--external",
      "typescript",
      "--no-cache",
      "-q",
    ],
    { cwd: packageRoot, stdio: "inherit" },
  );
}

// Vendor the TypeScript compiler into dist/node_modules so that the
// bundled CLI's runtime `import * as ts from "typescript"` resolves
// without requiring the consumer's `npm install` to surface a runtime
// `typescript` dependency. The root `package.json` keeps typescript as
// a devDependency (its sole use at build time is feeding `ncc`'s
// TypeScript loader); promoting it to a runtime dependency would force
// every `npm install -g umactually` consumer to fetch ~23MB of compiler
// internals they will never touch. Vendoring keeps the install surface
// to just the bundled `cli.js` plus the dist-shadowed typescript tree,
// and lets Node's ESM resolver find it at
// `<installed-pkg>/dist/node_modules/typescript/` from
// `<installed-pkg>/dist/cli.js`.
//
// We copy the existing `node_modules/typescript` (the version `ncc` used
// at build time, and which the bundler therefore referenced). If the
// project ever changes its TypeScript version, this copy picks it up
// automatically — no separate version string to keep in sync.
function vendorTypescript() {
  const src = join(packageRoot, "node_modules", "typescript");
  if (!existsSync(src)) {
    throw new Error(
      `post-bundle: expected typescript at ${src} (devDep that ncc loaded). Run \`npm ci\` first.`,
    );
  }
  const dest = join(distDir, "node_modules", "typescript");
  cpSync(src, dest, { recursive: true });
}

// Remove ncc-emitted debug artifacts. ncc occasionally writes hashed
// `dist/<hash>.ts` files alongside the main bundle. These are referenced
// from `dist/cli.js` only as URL strings for the webpack public-path
// computation (`__webpack_require__.p + "<hash>.ts"` is fed into
// `new URL(...)` as a relative path; the actual file is never imported
// or executed). Shipping them would bloat the tarball and pollute the
// git history with hash-named files that change on every rebuild. The
// `chore(dist): untrack ncc debug .ts artifacts` commit established this
// policy; we enforce it here so the rule can never be silently regressed
// by a future ncc version.
function pruneNccDebugArtifacts() {
  let entries = [];
  try {
    entries = readdirSync(distDir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (/\.ts$/u.test(name)) {
      rmSync(join(distDir, name), { force: true });
    }
  }
}

function main() {
  rebuildWithExternal();
  pruneNccDebugArtifacts();
  vendorTypescript();

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
