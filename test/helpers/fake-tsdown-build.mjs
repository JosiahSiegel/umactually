#!/usr/bin/env node
// SPDX-License-Identifier: MIT
//
// Test seam for scripts/build-sea.mjs.
//
// Invoked by build-sea.mjs when the UMACTUALLY_TSDOWN_BIN env var points
// at this file (it ends in .mjs, so build-sea.mjs runs it via process.execPath).
//
// Behavior:
//   - Reads the captured argv from the command line (passed by build-sea.mjs
//     as positional args after the script path).
//   - Writes the argv + a small metadata blob to the path in
//     UMACTUALLY_BUILD_CAPTURE_PATH (so the test can inspect what build-sea
//     thought it was passing to tsdown).
//   - Writes fake "built" SEA files for every target in
//     scripts/release-targets.json (if it can read the manifest) so
//     build-sea's "verify output exists" check passes for all 6 targets.
//   - Exits 0.
//
// This is a parallel of test/helpers/fake-bun-build.mjs but for the tsdown
// SEA pipeline. Same shape, different tool.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const capturePath = process.env["UMACTUALLY_BUILD_CAPTURE_PATH"];
const fakeOutputPath = process.env["UMACTUALLY_FAKE_OUTPUT_PATH"]; // legacy single-output override
const fakeVersion = process.env["UMACTUALLY_FAKE_NODE_VERSION"] ?? "25.7.0";

// Reject mismatched Node versions to mirror the real assertNodeVersion() check.
const expectedNodeMajor = 25;
const major = parseInt(process.versions.node, 10);
if (Number.isNaN(major) || major < expectedNodeMajor) {
  console.error(
    `fake-tsdown: refusing — Node ${process.versions.node} is below required ${expectedNodeMajor}`,
  );
  process.exit(1);
}

const tsdownArgs = process.argv.slice(2);

if (capturePath !== undefined && capturePath.length > 0) {
  mkdirSync(dirname(capturePath), { recursive: true });
  const capture = {
    argv: tsdownArgs,
    env: {
      UMACTUALLY_TSDOWN_BIN: process.env["UMACTUALLY_TSDOWN_BIN"] ?? null,
      UMACTUALLY_BUILD_CAPTURE_PATH: capturePath,
      UMACTUALLY_FAKE_OUTPUT_PATH: fakeOutputPath ?? null,
      UMACTUALLY_FAKE_NODE_VERSION: fakeVersion,
    },
    nodeVersion: process.versions.node,
  };
  writeFileSync(capturePath, JSON.stringify(capture, null, 2));
}

// Produce fake "built" SEA binaries for every target in the manifest.
// build-sea.mjs (after the v0.6.0 simplification) builds all 6 targets in
// a single tsdown invocation, so the harness must write all 6 outputs.
//
// Fall back to the single-target UMACTUALLY_FAKE_OUTPUT_PATH override for
// tests that exercise the missing-output failure path.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const manifestPath = join(REPO_ROOT, "scripts", "release-targets.json");

let producedAny = false;
if (existsSync(manifestPath)) {
  const targets = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const target of targets) {
    const outPath = join(REPO_ROOT, "release", target.rawName);
    if (existsSync(outPath)) continue; // never clobber a real build
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(
      outPath,
      `#!/usr/bin/env node\n# fake SEA binary for ${target.rawName} (Node ${fakeVersion})\nconsole.log("umactually ${target.id}");\n`,
    );
    producedAny = true;
  }
}

if (!producedAny && fakeOutputPath !== undefined && fakeOutputPath.length > 0) {
  mkdirSync(dirname(fakeOutputPath), { recursive: true });
  if (!existsSync(fakeOutputPath)) {
    writeFileSync(fakeOutputPath, `#!/usr/bin/env node\n# fake SEA binary for ${fakeOutputPath}\nconsole.log("umactually ${fakeVersion}");\n`);
  }
}

process.exit(0);
