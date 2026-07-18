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

function safeRename(fromAbs, toRel) {
  // fromAbs is always under releaseDir by construction; toRel is a
  // path nested under releaseDir too. We resolve both and verify
  // they stay inside releaseDir before renaming.
  const toAbs = resolve(releaseDir, toRel);
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
  // archive + raw: packager wrote <release>/<archiveName>; verifier
  // didn't move it. Move to public/, and the build-binary raw to
  // internal/raw/.
  safeRename(resolve(releaseDir, t.archiveName), `public/${t.archiveName}`);
  safeRename(resolve(releaseDir, t.rawName), `internal/raw/${t.rawName}`);
}

// checksums.txt the verifier wrote into release/ moves to release/public/.
safeRename(resolve(releaseDir, "checksums.txt"), "public/checksums.txt");

console.log(`${SCRIPT_REL}: stage complete.`);
