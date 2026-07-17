// SPDX-License-Identifier: MIT
import { writeFileSync } from "node:fs";

// Fake `bun` stub invoked by build-binary.mjs through PATH. Serves two
// branches:
//   - `bun --version` → prints UMACTUALLY_FAKE_BUN_VERSION
//   - `bun build ...` → records { argv, env } to UMACTUALLY_BUILD_CAPTURE_PATH
//
// The harness is spawned as the inner `bun` only; the build script itself
// runs as a direct Node child of the test runner, so `process.argv` inside
// build-binary.mjs starts at argv[0]=node, argv[1]=build-binary.mjs, and
// argv[2]=targetId — exactly what the production invocation looks like.
//
// `args` here is `process.argv.slice(2)`, which is precisely what
// spawnSync hands `bun` (the leading "bun" token lives in spawnSync's argv
// construction, not in process.argv). Capturing `args` verbatim is the
// authoritative representation of the compiled invocation contract.

const fakeVersion = process.env["UMACTUALLY_FAKE_BUN_VERSION"];
const capturePath = process.env["UMACTUALLY_BUILD_CAPTURE_PATH"];
if (fakeVersion === undefined || capturePath === undefined) {
  process.stderr.write("fake Bun test environment is incomplete\n");
  process.exit(1);
}

const args = process.argv.slice(2);

if (args[0] === "--version") {
  process.stdout.write(`${fakeVersion}\n`);
  process.exit(0);
}

writeFileSync(capturePath, JSON.stringify({ argv: args, env: process.env }), "utf8");
process.exit(0);
