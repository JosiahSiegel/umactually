#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Render version strings across shipped docs to match `package.json` `version`.
//
// This script handles TWO forms of version reference, both rewritten to the
// value of `package.json` `version`:
//
//   1. Template tokens:
//      {{UMACTUALLY_VERSION}}      → "v<version>"   (e.g. v0.4.0)
//      {{UMACTUALLY_VERSION_DOT}}  → "<version>"    (e.g. 0.4.0)
//
//   2. Already-rendered literal `vX.Y.Z` strings whose X.Y.Z is NOT equal
//      to the current version. After the very first render, every doc
//      has literal version strings (the tokens are consumed), so this
//      path keeps future releases working — bumping v0.3.0 → v0.4.0
//      rewrites every `v0.3.0` literal to `v0.4.0` automatically.
//
// Why this exists:
//   Before this script, every release required a manual sweep of README.md,
//   docs/configuration.md, docs/azure-devops.md, docs/gh-actions.md,
//   examples/azure/azure-pipelines.yml, and examples/github/pr-review.yml to
//   update the version pin (e.g. v0.2.1 → v0.3.0). The 9+ places drifted in
//   practice: the v0.3.0 release shipped with `v0.2.1` still hardcoded in the
//   README badge URL, CI examples, and Windows agent install line.
//
//   After the rewrite, version tokens are no longer present in shipped docs.
//   A subsequent 0.3.0 → 0.4.0 bump would otherwise have nothing left to
//   substitute and would require the same manual sweep we just eliminated.
//   The literal-rewrite path closes that loop.
//
// Boundary rules (shared with scripts/check-version-alignment.mjs):
//   The literal `vX.Y.Z` pattern is matched only when it appears as a
//   standalone token — preceded and followed by end-of-token boundaries
//   (whitespace, line start, or punctuation), and crucially NOT preceded/
//   followed by `/`, `.`, `:`, `?`, or other URL/filename-extension chars.
//   This avoids false-positive rewrites inside URLs like
//   `https://semver.org/spec/v2.0.0.html` and avoids touching file
//   extensions like `review.v1.2.3.html`.
//
// Invariants enforced:
//   - The only `{{UMACTUALLY_*}}` tokens allowed in shipped docs are the two
//     canonical ones; any other shape is a typo and exits 2.
//   - No historical `vX.Y.Z` literal may remain in shipped docs after a
//     successful run; `--check` enforces this.
//   - Idempotent: re-running on an already-aligned corpus is a no-op (no
//     file is rewritten when no token or literal needs substitution).
//
// Usage:
//   node scripts/render-versions.mjs            # replace and write in place
//   node scripts/render-versions.mjs --check    # exit 1 if any token/
//                                                literal-replaceable content
//                                                survives on disk; exit 2
//                                                for residual-typo tokens
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
//
// CONTRIBUTING.md is walked in addition to README.md + docs/**/*.md so a
// `vX.Y.Z` literal in the contributor guide auto-migrates with the release.
// CHANGELOG.md is INTENTIONALLY excluded — the file is the version history
// itself, every entry references the version that was current at the time,
// and rewriting those literals would corrupt the historical record.
const TARGETS = [
  "README.md",
  "CONTRIBUTING.md",
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

function renderText(text, tagValue, dotValue, warnings) {
  const before = text;
  let next = text;
  next = next.split(TOKEN_TAG).join(tagValue);
  next = next.split(TOKEN_DOT).join(dotValue);
  // Rewrite every standalone historical `vX.Y.Z` literal (without a
  // SemVer pre-release/build suffix) to the current `v<version>` value.
  // URL path segments and filename extensions are excluded by the look-around
  // boundary anchors (e.g. `https://semver.org/spec/v2.0.0.html` is left
  // alone because the `/` preceding `v2.0.0` blocks the match).
  //
  // We deliberately do NOT touch suffixed forms (`v0.3.0-rc.1`,
  // `v0.3.0+build.7`): a literal with a pre-release/build suffix is
  // intentional historical context that a maintainer introduced for a
  // specific reason and rewriting it would strip the suffix silently. If
  // such a literal exists when the version is bumped, warn loudly and
  // skip the rewrite so the maintainer decides what to do.
  const literalRegex =
    /(?<![/.:?\w])v\d+\.\d+\.\d+(?![-+0-9A-Za-z.])(?![/.:?\w])/g;
  next = next.replace(literalRegex, (match) => {
    if (match === tagValue) return match;
    if (warnings) warnings.push(match);
    return tagValue;
  });
  // Second pass: rewrite our OWN release-tag URLs to the current version.
  //
  // The bare-literal regex above correctly avoids `semver.org/spec/v2.0.0.html`
  // and `review.v1.2.3.html` (the `/` and `.` look-behinds block them), but
  // those same anchors also block `releases/tag/v0.5.0` — a string that
  // unambiguously points at THIS repo's release and is ALWAYS safe to bump.
  // This regex is intentionally narrow: it requires the literal path segment
  // `releases/tag/` to precede the version, which is the GitHub release-tag
  // URL pattern. Any future URL that uses a different host or path stays
  // untouched, so we won't accidentally rewrite a third-party link.
  //
  // We also do not strip pre-release / build suffixes here — if a pin
  // references `releases/tag/v0.3.0-rc.1` it is intentional context
  // (a release candidate) and rewriting it to `v0.5.3` would silently
  // point consumers at a stable tag from a draft. Same boundary rule as
  // the bare-literal pass.
  // Anchor the second pass to THIS repo's URL path so we don't touch
  // third-party release URLs (a different GitHub repo's tag link, a
  // CDN that mirrors the path layout, etc.). The literal `releases/tag/`
  // pattern alone is too permissive — it would rewrite any `.../releases/tag/vX.Y.Z`
  // substring. Tightening to the project URL prefix keeps the rewrite
  // strictly within the bounds of "this repo's release URLs".
  //
  // We allow a configurable prefix: by default it's the canonical
  // GitHub URL, but a `RELEASE_URL_PREFIX` env override is honored so a
  // fork or self-hosted GHE mirror can repoint without code edits.
  const releaseUrlPrefix = process.env.RELEASE_URL_PREFIX ??
    "https://github.com/JosiahSiegel/umactually/";
  const escapedPrefix = releaseUrlPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const releaseTagUrlRegex = new RegExp(
    `${escapedPrefix}releases/tag/v\\d+\\.\\d+\\.\\d+(?![-+0-9A-Za-z./])`,
    "g",
  );
  next = next.replace(releaseTagUrlRegex, (match) => {
    const stripped = match.replace(new RegExp(`^${escapedPrefix}releases/tag/`), "");
    if (stripped === tagValue) return match;
    if (warnings) warnings.push(match);
    return `${releaseUrlPrefix}releases/tag/${tagValue}`;
  });
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
  // Collect literal-version rewrites per file so we can warn when a
  // historical pin is being migrated (it usually is, but it tells the
  // operator which files were touched).
  const literalRewrites = [];

  for (const rel of files) {
    const abs = isAbsolute(rel) ? rel : join(packageRoot, rel);
    if (!existsSync(abs)) {
      // Should not happen given globSync, but be defensive.
      throw new Error(`render-versions: missing file ${rel}`);
    }
    const original = readFileSync(abs, "utf8");
    const warnings = [];
    const { result, changed } = renderText(original, tagValue, dotValue, warnings);
    if (warnings.length > 0) literalRewrites.push({ rel, from: warnings });

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

  if (literalRewrites.length > 0) {
    // Informational: tell the operator which historical pins were
    // auto-migrated to the current version. Not a failure.
    process.stdout.write(
      `render-versions: auto-migrated historical literals:\n` +
        literalRewrites
          .map(({ rel, from }) => `  ${rel}: ${from.join(", ")} -> ${tagValue}`)
          .join("\n") +
        "\n",
    );
  }

  process.stdout.write("render-versions: OK\n");
}

main();
