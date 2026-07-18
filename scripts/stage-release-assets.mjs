#!/usr/bin/env node
// SPDX-License-Identifier: MIT
//
// scripts/stage-release-assets.mjs
// =================================
// Take the flat `release/` layout (six raw binaries + six archives +
// checksums.txt) produced by `scripts/build-binary.mjs` followed by
// `scripts/package-release-assets.mjs --release-dir release`, and
// reorganize it into the public/ + internal/raw/ split that the
// release workflow's smoke lanes expect:
//
//   release/public/umactually-<target>.tar.gz|x.zip   (6 archives)
//   release/public/checksums.txt
//   release/internal/raw/umactually-<target>          (6 binaries)
//   release/internal/release-size-report.json
//
// Idempotent: missing source files are skipped, not failed (so a
// partial rerun leaves the working tree clean). Used by
// scripts/ci-release-pipeline-dry-run.sh and by
// .github/workflows/release.yml's `build-package` step.

import { mkdirSync, readFileSync, renameSync, existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "..");
const SCRIPT_REL = "scripts/stage-release-assets.mjs";

const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 1) {
  const flag = args[i];
  if (!flag || !flag.startsWith("--")) throw new Error(`unexpected argument ${flag ?? ""}`);
  const value = args[i + 1];
  if (!value || value.startsWith("--")) throw new Error(`missing value for ${flag}`);
  options[flag.slice(2)] = value;
  i += 1;
}

const releaseDir = resolve(options["release-dir"] ?? "release");
const publicDir = resolve(releaseDir, "public");
const rawDir = resolve(releaseDir, "internal", "raw");

const targetsPath = resolve(options["manifest"] ?? "scripts/release-targets.json");
const targets = JSON.parse(readFileSync(targetsPath, "utf8"));

if (!Array.isArray(targets) || targets.length === 0) {
  throw new Error(`${SCRIPT_REL}: expected non-empty array at ${targetsPath}`);
}

mkdirSync(publicDir, { recursive: true });
mkdirSync(rawDir, { recursive: true });

function ensureParent(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function assertInside(dir, candidate, label) {
  // Defence-in-depth: even though the caller controls the
  // archiveName / rawName strings (they come from the manifest
  // validated above), a future manifest entry with a path-traversal
  // pattern (e.g. `../etc/passwd`) would otherwise let renameSync
  // move files outside `releaseDir`. Reject anything that, after
  // resolution, escapes the parent directory. The `sep`-terminated
  // parent prefix check matches Node 16+'s path.resolve semantics
  // (no trailing-separator inconsistency across platforms).
  const rel = require("node:path").relative(dir, candidate);
  if (rel === "" || (!rel.startsWith("..") && !rel.includes(".." + require("node:path").sep))) {
    return;
  }
  throw new Error(`${SCRIPT_REL}: ${label} escapes ${dir} (resolved: ${candidate})`);
}

function safeRename(fromAbs, toRel) {
  // toRel is always rooted under releaseDir by construction; resolve
  // and assert both endpoints stay within releaseDir before the
  // rename. The check is defence-in-depth for the manifest inputs —
  // if a future build-binary.mjs emit a path-traversal raw name, we
  // reject it before renameSync executes.
  const toAbs = resolve(releaseDir, toRel);
  assertInside(releaseDir, toAbs, `destination ${toRel}`);
  if (existsSync(fromAbs) && statSync(fromAbs).isFile()) {
    ensureParent(toAbs);
    renameSync(fromAbs, toAbs);
    console.log(`  ${fromAbs} -> ${toAbs}`);
  }
}

for (const t of targets) {
  if (typeof t.archiveName !== "string" || typeof t.rawName !== "string") {
    throw new Error(`${SCRIPT_REL}: target missing archiveName/rawName: ${JSON.stringify(t)}`);
  }
  // Reject any basename that, after resolution against releaseDir,
  // still contains path-traversal segments. The manifest is the
  // source of truth — but a typo in scripts/release-targets.json
  // (e.g. `../etc/foo`) should fail loudly here, not silently
  // write files outside the working tree.
  for (const [key, value] of [["archiveName", t.archiveName], ["rawName", t.rawName]]) {
    if (value.includes("/") || value.includes("\\") || value === ".." || value.startsWith("../") || value.endsWith("/..")) {
      throw new Error(`${SCRIPT_REL}: target ${key}=${JSON.stringify(value)} contains path-traversal or subpath segment`);
    }
  }
  // archive + raw: packager wrote <release>/<archiveName>; verifier
  // didn't move it. Move to public/, and the build-binary raw to
  // internal/raw/.
  safeRename(resolve(releaseDir, t.archiveName), `public/${t.archiveName}`);
  safeRename(resolve(releaseDir, t.rawName), `internal/raw/${t.rawName}`);
}

// checksums.txt the verifier wrote into release/ moves to release/public/.
safeRename(resolve(releaseDir, "checksums.txt"), "public/checksums.txt");

console.log(`${SCRIPT_REL}: stage complete.`);
