#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Drift guard for the version-alignment contract. Run by `scripts/ci-validate.sh`
// after `npm run bundle` and before `npm run check:dist-freshness`.
//
// Catches three classes of drift, all of which would silently mislead readers:
//
//   1. Tokens still present after the render step. The render script's
//      --check mode exits 1 when a target file's on-disk version does not
//      match what it would render from `package.json`. This is the primary
//      check; we re-invoke it here so the ci-validate pipeline has a single
//      named gate.
//
//   2. Non-canonical `{{UMACTUALLY_*}}` tokens (typos like
//      {{UMACTUALLY_VRSION}}). The render script's residual-token guard
//      exits 2 in that case. We pick it up here and translate to a single
//      ci-validate-friendly exit code (1).
//
//   3. Historical version pins leaking forward. Once tokens are rendered
//      for v0.3.0, a stray `v0.2.0` / `v0.1.2` left in a doc or example
//      means somebody forgot to re-render. Grep the docs tree for any
//      `vX.Y.Z` form whose X.Y.Z is not equal to the current version; any
//      match is drift and exits 1.
//
// `package.json` `version` is the single source of truth. Anything that
// pretends to be a version and disagrees with it is a bug.
//
// Run modes:
//   node scripts/check-version-alignment.mjs         # CI mode (exits non-zero on drift)
//   node scripts/check-version-alignment.mjs --quiet # Mute OK message (used when chaining)

import { existsSync, globSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const defaultPackageRoot = resolve(here, "..");

function resolvePackageRootFromCli(argvList) {
  const idx = argvList.indexOf("--package-root");
  if (idx >= 0 && idx + 1 < argvList.length) {
    const supplied = argvList[idx + 1];
    if (typeof supplied !== "string" || supplied.length === 0) {
      throw new Error("check-version-alignment: --package-root requires a directory argument");
    }
    return resolve(supplied);
  }
  return defaultPackageRoot;
}

const argv = process.argv.slice(2);
const quiet = argv.includes("--quiet");
const packageRoot = resolvePackageRootFromCli(argv);

const TARGETS = [
  "README.md",
  "docs/**/*.md",
  "examples/**/*.yml",
  "examples/**/*.yaml",
  "examples/**/*.md",
];

const SKIP_DIRS = new Set(["node_modules", "dist", "release", ".git"]);

function readPackageVersion() {
  const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  if (typeof pkg.version !== "string" || !/^\d+\.\d+\.\d+/.test(pkg.version)) {
    throw new Error(
      `check-version-alignment: package.json "version" is missing or not a semver triple: ${JSON.stringify(pkg.version)}`,
    );
  }
  return pkg.version;
}

function isPathInSkippedDir(relPath) {
  return relPath.split(/[\\/]/).some((segment) => SKIP_DIRS.has(segment));
}

function collectTargets() {
  const found = new Set();
  for (const pattern of TARGETS) {
    const matches = globSync(pattern, { cwd: packageRoot });
    for (const match of matches) {
      // Same Windows-aware relative-path guard as scripts/render-versions.mjs.
      // Without this, `path.relative("C:\\foo", "README.md")` resolves the
      // second arg against process.cwd() and returns a wrong drive's path.
      let rel;
      if (isAbsolute(match)) {
        rel = match;
      } else {
        const candidate = relative(packageRoot, match);
        const isStillInside =
          candidate === "" ||
          (!candidate.startsWith("..") && !isAbsolute(candidate));
        rel = isStillInside
          ? (candidate === "." ? match : candidate)
          : match;
      }
      rel = rel.replace(/[\\/]/g, "/");
      if (!isPathInSkippedDir(rel)) found.add(rel);
    }
  }
  return [...found].sort();
}

// Step 1: invoke render-versions.mjs --check. Non-zero exit means drift.
function runRenderCheck() {
  try {
    execFileSync(
      process.execPath,
      [join(here, "render-versions.mjs"), "--check"],
      { cwd: packageRoot, stdio: ["ignore", "pipe", "pipe"] },
    );
    return { ok: true };
  } catch (err) {
    return { ok: false, stderr: String(err.stderr ?? "") };
  }
}

// Step 2: scan every target file for the literal `v<X>.<Y>.<Z>` form. Any
// value that does not equal v<currentVersion> is drift.
function scanForHistoricalVersions(currentVersion) {
  const tagValue = `v${currentVersion}`;
  // Match a literal `vX.Y.Z` (without a SemVer pre-release/build suffix)
  // that is a *standalone token* in the prose: preceded and followed by
  // an end-of-token boundary. Crucially the boundary excludes URL path
  // segments, so a link like `https://semver.org/spec/v2.0.0.html` does
  // NOT trip the drift detector on the `v2.0.0` substring inside the
  // URL. We deliberately do NOT flag suffixed forms (`v0.3.0-rc.1`,
  // `v0.3.0+build.7`) here either — they are intentional historical
  // context the maintainer introduced; render-versions.mjs also
  // excludes them from auto-rewrite, so a suffixed literal surviving
  // across a bump is a real "look at this" signal but is not a drift
  // detector failure.
  //
  // Boundary chars excluded from the previous-token match:
  //   - / (URL path separator)   — was the source of the v2.0.0 false positive
  //   - . (URL/filename extension) — prevents `html.v2.0.0` style matches
  //   - :// — URL scheme
  // Boundary chars excluded from the next-token match:
  //   - . followed by [a-z] — `v2.0.0.html` URL
  //   - / — path separator after
  //   - :// — scheme separator
  //   - [-+] — SemVer pre-release / build suffix
  const tagRe =
    /(?<![/.:?\w])(?:v\d+\.\d+\.\d+)(?![-+0-9A-Za-z.])(?![/.:?\w])/g;
  const drift = [];
  for (const rel of collectTargets()) {
    const abs = isAbsolute(rel) ? rel : join(packageRoot, rel);
    if (!existsSync(abs)) continue;
    const content = readFileSync(abs, "utf8");
    const found = new Set();
    for (const match of content.matchAll(tagRe)) {
      if (match[0] !== tagValue) found.add(match[0]);
    }
    if (found.size > 0) drift.push({ rel, hits: [...found].sort() });
  }
  return drift;
}

function main() {
  const currentVersion = readPackageVersion();
  if (!quiet) {
    process.stdout.write(`check-version-alignment: target = v${currentVersion}\n`);
  }

  let failures = 0;

  // 1. Token replaceability.
  const renderCheck = runRenderCheck();
  if (!renderCheck.ok) {
    failures += 1;
    process.stderr.write(
      `check-version-alignment: render-versions.mjs --check FAILED.\n${renderCheck.stderr}\n`,
    );
  } else if (!quiet) {
    process.stdout.write("check-version-alignment: render-versions.mjs --check OK\n");
  }

  // 2. Historical drift scan.
  const drift = scanForHistoricalVersions(currentVersion);
  if (drift.length > 0) {
    failures += 1;
    process.stderr.write(
      `check-version-alignment: historical version pin(s) left in shipped docs:\n`,
    );
    for (const { rel, hits } of drift) {
      process.stderr.write(`  ${rel}: ${hits.join(", ")}\n`);
    }
    process.stderr.write(
      `  Expected every vX.Y.Z form to equal v${currentVersion}. Re-run \`node scripts/render-versions.mjs\` or manually update any reference the tokens do not cover.\n`,
    );
  } else if (!quiet) {
    process.stdout.write("check-version-alignment: no historical version pins found\n");
  }

  if (failures > 0) {
    process.stderr.write(`check-version-alignment: FAILED (${failures} gate(s) failing)\n`);
    process.exit(1);
  }
  if (!quiet) process.stdout.write("check-version-alignment: OK\n");
}

main();
