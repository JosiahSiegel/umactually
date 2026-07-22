// SPDX-License-Identifier: MIT
//
// scripts/release-size-limits.mjs
// ================================
//
// Size sanity-check thresholds for the per-target raw binaries
// produced by the Node SEA build (scripts/build-sea.mjs) and
// checked by the size verifier (scripts/verify-release-sizes.mjs).
//
// This module is intentionally a constants-only file (no CLI
// top-level code, no IIFE, no `process.exit`). Both the build
// script and the verifier import the constants from here so that:
//
//   1. There is exactly one place to edit when the MIN/MAX
//      thresholds need to move. (Previously the build script
//      imported MIN_RAW_BYTES from verify-release-sizes.mjs,
//      which forced a side-effecting IIFE on every load — fine
//      for the verifier's own CLI but hostile to other importers.)
//
//   2. Importer test fixtures and CI harness code can `import`
//      these constants without ever triggering the verifier's
//      CLI bootstrap (`invokedDirectly` block, missing-arg
//      `process.exit(2)`, etc). The build script is the highest-
//      risk importer because it is also invoked under test
//      (UMACTUALLY_TSDOWN_BIN) and from CI release dry-run shells.
//
// Rationale for the thresholds (preserved from verify-release-sizes.mjs):
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

/** @type {number} */
export const MIN_RAW_BYTES = 1 * 1024 * 1024;

/** @type {number} */
export const MAX_RAW_BYTES = 200 * 1024 * 1024;
