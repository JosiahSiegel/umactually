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
//   - Optionally writes a fake "built" file to UMACTUALLY_FAKE_OUTPUT_PATH
//     so build-sea's "verify output exists" check passes.
//   - Exits 0.
//
// This is a parallel of test/helpers/fake-bun-build.mjs but for the tsdown
// SEA pipeline. Same shape, different tool.

import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const capturePath = process.env["UMACTUALLY_BUILD_CAPTURE_PATH"];
const fakeOutputPath = process.env["UMACTUALLY_FAKE_OUTPUT_PATH"];
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

// Build the capture blob. process.argv[0] is `node`, [1] is this script,
// [2..] are the args passed by build-sea.mjs.
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

// Optionally produce a fake "built" SEA binary. This is what build-sea.mjs
// expects to find at release/<rawName> after the spawn completes.
if (fakeOutputPath !== undefined && fakeOutputPath.length > 0) {
  mkdirSync(dirname(fakeOutputPath), { recursive: true });
  if (!existsSync(fakeOutputPath)) {
    writeFileSync(fakeOutputPath, `#!/usr/bin/env node\n# fake SEA binary for ${fakeOutputPath}\nconsole.log("umactually ${fakeVersion}");\n`);
  }
}

process.exit(0);
