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
//   - MIN_RAW_BYTES / MAX_RAW_BYTES thresholds
//   - the per-target size iteration
//   - the release/internal/release-size-report.json write
//
// Rationale for the thresholds (preserved from the inline blocks):
//   - 1 MiB floor: rejects a partial SEA blob that "exists but is
//     broken". A truncated binary self-sha256-passes (the chunk is
//     internally consistent) but crashes on launch.
//   - 200 MiB ceiling: as of v0.6.0 the largest target is
//     `darwin-x64` at ~134 MiB. 200 MiB leaves ~50% headroom for
//     legitimate growth and is far below the installer's pipe-buffer
//     concerns. Any new target that legitimately needs more room
//     must bump this constant here AND document the reason in the
//     PR — bumping only one call site silently widens a different
//     gate than the docs claim.

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** @type {number} */
export const MIN_RAW_BYTES = 1 * 1024 * 1024;

/** @type {number} */
export const MAX_RAW_BYTES = 200 * 1024 * 1024;

/**
 * Run the size sanity check for every manifest target.
 *
 * @param {{ manifestPath: string, releaseDir: string, reportPath: string }} options
 * @returns {{ targets: Array<{ id: string, rawName: string, sizeBytes: number, missing?: boolean, tooSmall?: boolean, tooLarge?: boolean }>, failed: number }}
 */
export function verifyReleaseSizes({ manifestPath, releaseDir, reportPath }) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!Array.isArray(manifest)) {
    throw new Error(
      `verify-release-sizes: manifest at ${manifestPath} is not an array (got ${typeof manifest})`,
    );
  }

  const generatedAt = new Date().toISOString();
  const report = { targets: [], generatedAt };
  let failed = 0;

  for (const t of manifest) {
    const p = join(releaseDir, t.rawName);
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
  mkdirSync(join(reportPath, ".."), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  return { targets: report.targets, failed };
}

const invokedDirectly = (() => {
  if (typeof process.argv[1] !== "string") return false;
  try {
    return process.argv[1].endsWith("verify-release-sizes.mjs");
  } catch {
    return false;
  }
})();

if (invokedDirectly) {
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
