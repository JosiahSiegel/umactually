#!/usr/bin/env node
// SPDX-License-Identifier: MIT
//
// scripts/verify-release-sizes.mjs
// =================================
// Single source of truth for the per-target raw-binary size sanity
// check. Used by:
//   - .github/workflows/release.yml's "Compute release-size report" step
//   - scripts/ci-release-pipeline-dry-run.sh's "verify stage sizes" step
//
// Both call sites previously inlined the same `node -e '...'` block,
// which meant the MIN/MAX thresholds and the size-report JSON shape
// had to be kept in sync by hand. This module owns:
//   - the per-target size iteration
//   - the release/internal/release-size-report.json write
//
// The MIN/MAX thresholds live in scripts/release-size-limits.mjs so
// other importers (notably scripts/build-sea.mjs) can pull the
// constants without triggering this file's CLI bootstrap. We
// re-export the constants here for back-compat with any code that
// already imports them from this module — the verifier's
// `verifyReleaseSizes()` itself reads them from the limits module
// (single source of truth).
//
// Rationale for the thresholds (see scripts/release-size-limits.mjs):
//   - 1 MiB floor: rejects a partial SEA blob that "exists but is
//     broken". A truncated binary self-sha256-passes (the chunk is
//     internally consistent) but crashes on launch.
//   - 200 MiB ceiling: as of v0.6.0 the largest target is
//     `darwin-x64` at ~134 MiB. 200 MiB leaves ~50% headroom for
//     legitimate growth and is far below the installer's pipe-buffer
//     concerns. Any new target that legitimately needs more room
//     must bump the constant in scripts/release-size-limits.mjs
//     AND document the reason in the PR — bumping only one call
//     site silently widens a different gate than the docs claim.

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";

import { MAX_RAW_BYTES, MIN_RAW_BYTES } from "./release-size-limits.mjs";
import { invokedDirectly } from "./lib/cli-shared.mjs";

// Re-exported for back-compat. The verifier itself reads
// MIN_RAW_BYTES / MAX_RAW_BYTES from `./release-size-limits.mjs`
// (the single source of truth), but downstream code that already
// imports them from this module keeps working unchanged.
/** @type {number} */
export { MAX_RAW_BYTES, MIN_RAW_BYTES };

/**
 * Resolve and validate a user-supplied path so the report cannot be
 * written outside `releaseDir`. Both arguments are absolute after
 * resolution; we check that `reportPath` is `releaseDir` or sits
 * underneath it. This blocks the path-traversal class where
 * `reportPath = "/etc/passwd"` would let `mkdirSync(parent)` and
 * `writeFileSync` write the JSON outside the release staging area.
 *
 * @param {string} releaseDirRaw
 * @param {string} reportPathRaw
 * @returns {{ releaseDir: string, reportPath: string }}
 */
export function resolveReportPaths(releaseDirRaw, reportPathRaw) {
  const releaseDir = resolve(releaseDirRaw);
  const reportPath = resolve(reportPathRaw);
  // `relative(releaseDir, reportPath)` returns ".." or a path starting
  // with ".." when reportPath escapes releaseDir. It returns "" when
  // the paths are equal (report IS the release dir — also reject) and
  // a relative subpath otherwise.
  const rel = relative(releaseDir, reportPath);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(
      `verify-release-sizes: report path ${reportPathRaw} must be inside release dir ${releaseDirRaw}`,
    );
  }
  return { releaseDir, reportPath };
}

/**
 * Run the size sanity check for every manifest target.
 *
 * @param {{ manifestPath: string, releaseDir: string, reportPath: string }} options
 * @returns {{ targets: Array<{ id: string, rawName: string, sizeBytes: number, missing?: boolean, tooSmall?: boolean, tooLarge?: boolean }>, failed: number }}
 */
export function verifyReleaseSizes({ manifestPath, releaseDir, reportPath }) {
  // Pin the report inside releaseDir before any filesystem mutation.
  // releaseDir / reportPath are user-supplied in the CLI, so reject
  // any path that escapes the release staging area.
  const { reportPath: safeReportPath } = resolveReportPaths(releaseDir, reportPath);
  const safeReleaseDir = resolve(releaseDir);

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest)) {
    throw new Error(
      `verify-release-sizes: manifest at ${manifestPath} is not an array (got ${typeof manifest})`,
    );
  }

  const generatedAt = new Date().toISOString();
  // Schema (v0.6.0): `{ targets: [{id, rawName, sizeBytes, missing?, tooSmall?, tooLarge?}], generatedAt }`.
  // This is INTENTIONALLY smaller than the v0.5.x shape that
  // verify-release-assets.mjs emitted (which carried per-target
  // archiveName, rawBytes, archiveBytes, ratio, and sha256). The
  // release-size-report.json is internal-only — uploaded to the
  // canary pre-flight, never to the public release — and the only
  // downstream consumer (.github/workflows/release.yml's
  // `build-package` step + the canary pre-publish probe) checks
  // file presence, not field shape. If a future contributor
  // re-introduces a v0.5.x field here, the unit tests in
  // test/unit/verify-release-sizes.test.ts will fail.
  const report = { targets: [], generatedAt };
  let failed = 0;

  for (const t of manifest) {
    const p = join(safeReleaseDir, t.rawName);
    if (!existsSync(p)) {
      console.error(`MISSING: ${p}`);
      report.targets.push({ id: t.id, rawName: t.rawName, sizeBytes: 0, missing: true });
      failed++;
      continue;
    }
    const stat = statSync(p);
    const size = stat.size;
    if (size < MIN_RAW_BYTES) {
      console.error(
        `TOO SMALL: ${p} (${size} bytes; expected >= ${MIN_RAW_BYTES})`,
      );
      report.targets.push({ id: t.id, rawName: t.rawName, sizeBytes: size, tooSmall: true });
      failed++;
      continue;
    }
    if (size > MAX_RAW_BYTES) {
      console.error(
        `TOO LARGE: ${p} (${size} bytes; expected <= ${MAX_RAW_BYTES})`,
      );
      report.targets.push({ id: t.id, rawName: t.rawName, sizeBytes: size, tooLarge: true });
      failed++;
      continue;
    }
    report.targets.push({ id: t.id, rawName: t.rawName, sizeBytes: size });
  }

  // Write the size-report JSON atomically: this is the file the
  // release-stage and the canary probe both read. mkdirSync with
  // { recursive: true } is idempotent so a no-op when the dir exists.
  // The report path was pinned inside safeReleaseDir by
  // resolveReportPaths() above, so the parent mkdir is also inside
  // safeReleaseDir.
  mkdirSync(dirname(safeReportPath), { recursive: true });
  writeFileSync(safeReportPath, JSON.stringify(report, null, 2));

  return { targets: report.targets, failed };
}

if (invokedDirectly(import.meta.url)) {
  // CLI shape: `node scripts/verify-release-sizes.mjs --manifest <path>
  // --release-dir <dir> [--report <path>]`. The report path defaults to
  // `<release-dir>/internal/release-size-report.json` to match the
  // previous inline block's behavior.
  const args = process.argv.slice(2);
  let manifestPath = "";
  let releaseDir = "";
  let reportPath = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--manifest") {
      manifestPath = args[++i] ?? "";
    } else if (args[i] === "--release-dir") {
      releaseDir = args[++i] ?? "";
    } else if (args[i] === "--report") {
      reportPath = args[++i] ?? "";
    }
  }
  if (!manifestPath || !releaseDir) {
    console.error(
      "usage: node scripts/verify-release-sizes.mjs --manifest <path> --release-dir <dir> [--report <path>]",
    );
    process.exit(2);
  }
  if (!reportPath) {
    reportPath = join(releaseDir, "internal", "release-size-report.json");
  }
  const { failed, targets } = verifyReleaseSizes({ manifestPath, releaseDir, reportPath });
  if (failed > 0) {
    console.error(`verify stage: ${failed} target(s) failed size sanity check`);
    process.exit(1);
  }
  console.log(`verify stage: all ${targets.length} targets present and within size bounds`);
}
