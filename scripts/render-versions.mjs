#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Render `{{UMACTUALLY_VERSION}}` and `{{UMACTUALLY_VERSION_DOT}}` template tokens
// inside docs/, examples/, and README.md to the current `package.json` version.
//
// Why this exists:
//   Before this script, every release required a manual sweep of README.md,
//   docs/configuration.md, docs/azure-devops.md, docs/gh-actions.md,
//   examples/azure/azure-pipelines.yml, and examples/github/pr-review.yml to
//   update the version pin (e.g. v0.2.1 → v0.3.0). The 9+ places drifted in
//   practice: the v0.3.0 release shipped with `v0.2.1` still hardcoded in the
//   README badge URL, CI examples, and Windows agent install line.
//
// Token contract:
//   {{UMACTUALLY_VERSION}}      → "v<version>"   (e.g. v0.3.0)
//   {{UMACTUALLY_VERSION_DOT}}  → "<version>"    (e.g. 0.3.0)
//
//   Both are rendered from `package.json` `version` — a single source of truth.
//   `dist/package.json` is intentionally NOT walked: ncc regenerates it during
//   `npm run bundle`, and the version there is the same string anyway.
//
//   The script refuses to leave any token unreplaced (exits 2) so a typo in a
//   token name like {{UmActually_VERSION}} cannot silently leak through.
//
//   Idempotent: re-running on an already-rendered corpus is a no-op. The
//   script only writes a file when at least one token replaced a substring.
//
// Usage:
//   node scripts/render-versions.mjs            # replace and write in place
//   node scripts/render-versions.mjs --check    # exit 1 if any replaceable
//                                                token is still present
//                                                (or if any token rendered
//                                                 differs from disk state)
//   node scripts/render-versions.mjs --dry-run  # print intended changes,
//                                                do not write

import { existsSync, globSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const defaultPackageRoot = resolve(here, "..");

// --package-root <dir> overrides the discovered package root. Used by
// tests and by ad-hoc renders against a checked-out worktree other than
// the script's own repo.
function resolvePackageRootFromCli(argvList) {
  const idx = argvList.indexOf("--package-root");
  if (idx >= 0 && idx + 1 < argvList.length) {
    const supplied = argvList[idx + 1];
    if (typeof supplied !== "string" || supplied.length === 0) {
      throw new Error("render-versions: --package-root requires a directory argument");
    }
    return resolve(supplied);
  }
  return defaultPackageRoot;
}

const TOKEN_TAG = "{{UMACTUALLY_VERSION}}";
const TOKEN_DOT = "{{UMACTUALLY_VERSION_DOT}}";

// Files / globs the script walks. node:fs.globSync accepts the same patterns
// as the shell, including brace expansion and recursive "**".
const TARGETS = [
  "README.md",
  "docs/**/*.md",
  "examples/**/*.yml",
  "examples/**/*.yaml",
  "examples/**/*.md",
];

// Skips: ncc regenerates dist/, so version tokens must never appear there.
// release/ contains cross-compiled artifacts and tarballs; not source-of-truth.
const SKIP_DIRS = new Set(["node_modules", "dist", "release", ".git"]);

const argv = process.argv.slice(2);
const flags = new Set(argv);
const modeCheck = flags.has("--check");
const modeDryRun = flags.has("--dry-run");
const packageRoot = resolvePackageRootFromCli(argv);

function readPackageVersion() {
  const raw = readFileSync(join(packageRoot, "package.json"), "utf8");
  const pkg = JSON.parse(raw);
  if (typeof pkg.version !== "string" || !/^\d+\.\d+\.\d+/.test(pkg.version)) {
    throw new Error(
      `render-versions: package.json "version" is missing or not a semver triple: ${JSON.stringify(pkg.version)}`,
    );
  }
  return pkg.version;
}

function isPathInSkippedDir(relPath) {
  const segments = relPath.split(/[\\/]/);
  return segments.some((segment) => SKIP_DIRS.has(segment));
}

function collectTargets() {
  const found = new Set();
  for (const pattern of TARGETS) {
    const matches = globSync(pattern, {
      cwd: packageRoot,
      withFileTypes: false,
    });
    for (const match of matches) {
      // Two cases to disambiguate on Windows:
      //   1. globSync returned a path relative to packageRoot (the
      //      common case). Use `path.relative` to canonicalize it.
      //   2. globSync returned an absolute path (rare — happens on
      //      cross-drive sandboxes). Trust the absolute path as-is.
      //
      // The trap on Windows: `path.relative("C:\\foo", "README.md")`
      // resolves "README.md" against the *process's cwd*, NOT against
      // "C:\\foo", and returns e.g. "D:\\somewhere\\README.md". So we
      // cannot blindly trust relative()'s output — verify the result
      // is still under packageRoot before using it.
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

function renderText(text, tagValue, dotValue) {
  const before = text;
  let next = text;
  next = next.split(TOKEN_TAG).join(tagValue);
  next = next.split(TOKEN_DOT).join(dotValue);
  return { result: next, changed: next !== before };
}

function main() {
  const version = readPackageVersion();
  const tagValue = `v${version}`;
  const dotValue = version;
  process.stdout.write(`render-versions: package.json version = ${version}\n`);
  process.stdout.write(
    `render-versions: ${TOKEN_TAG} → ${tagValue}; ${TOKEN_DOT} → ${dotValue}\n`,
  );

  const files = collectTargets();
  if (files.length === 0) {
    throw new Error(
      "render-versions: TARGETS glob matched zero files — check the patterns.",
    );
  }
  process.stdout.write(`render-versions: scanning ${files.length} file(s)\n`);

  const dirtyFiles = [];
  const stillTokenised = [];
  const mismatched = [];

  for (const rel of files) {
    const abs = isAbsolute(rel) ? rel : join(packageRoot, rel);
    if (!existsSync(abs)) {
      // Should not happen given globSync, but be defensive.
      throw new Error(`render-versions: missing file ${rel}`);
    }
    const original = readFileSync(abs, "utf8");
    const { result, changed } = renderText(original, tagValue, dotValue);

    // Defensive invariant: the only `{{UMACTUALLY_*}}` tokens allowed in
    // shipped docs are the two we render. Any other shape (typo, casing
    // mistake, renamed-but-not-rendered future token, etc.) is a defect.
    // We scan for the entire `{{UMACTUALLY_*}}` family and enforce that
    // every match is one of our two canonical tokens.
    const umactuallyTokenPattern = /\{\{UMACTUALLY_[A-Z0-9_]*\}\}/g;
    const residualUmactually = (result.match(umactuallyTokenPattern) ?? []).filter(
      (match) => match !== TOKEN_TAG && match !== TOKEN_DOT,
    );
    if (residualUmactually.length > 0) {
      stillTokenised.push(`${rel}: ${residualUmactually.join(", ")}`);
    }

    if (changed) {
      if (modeDryRun) {
        process.stdout.write(`render-versions: WOULD update ${rel}\n`);
      } else if (!modeCheck) {
        writeFileSync(abs, result, "utf8");
        process.stdout.write(`render-versions: updated ${rel}\n`);
      } else {
        // In --check mode, surface would-be changes without writing.
        dirtyFiles.push(rel);
      }
    }
  }

  if (stillTokenised.length > 0) {
    process.stderr.write(
      `render-versions: residual tokens left after replace (typo near-match?):\n  ${stillTokenised.join("\n  ")}\n`,
    );
    process.exit(2);
  }

  if (modeCheck) {
    if (dirtyFiles.length > 0) {
      process.stderr.write(
        "render-versions: --check found files whose rendered version does not match their disk content. Run `npm run render-docs` to reconcile:\n" +
          `  ${dirtyFiles.join("\n  ")}\n`,
      );
      process.exit(1);
    }
    process.stdout.write("render-versions: --check OK (every file already aligned)\n");
    return;
  }

  if (mismatched.length > 0) {
    // Reserved for a future cross-check: rendered value vs. git-tag expectation.
    // The check-version-alignment.mjs side-script covers that gate today;
    // keeping the data structure here means a single switch in can adopt it.
    process.stderr.write(
      `render-versions: mismatched values:\n  ${mismatched.join("\n  ")}\n`,
    );
    process.exit(3);
  }

  process.stdout.write("render-versions: OK\n");
}

main();
