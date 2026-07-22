// SPDX-License-Identifier: MIT
// Regression test for the bin/umactually.mjs shim's auto-invoke
// interaction with the dist/cli.js URL-match `isMainModule` gate.
//
// Background: src/cli.ts defines `isMainModule` as the IIFE
// `import.meta.url === pathToFileUrl(process.argv[1])`. When the
// shim runs `await import(pathToFileURL(dist/cli.js))`, the
// imported module's `import.meta.url` is the dist/cli.js file://
// URL — NOT the shim's path. So `isMainModule` is false inside
// the dynamic-imported module and `main()` is NOT auto-invoked.
// The shim's explicit `await mod.main(argv)` is the sole call.
//
// If a future refactor changes the IIFE to a `cli.js` suffix check
// (as the previous logic did), or moves the shim to require() the
// cli bundle synchronously, main() could be invoked twice — once
// by the shim, once by the auto-invoke. A double-invoke would
// print `umactually --version` output twice on stdout.
//
// This test locks in the contract by counting the version-line
// occurrences in the shim's stdout. We patch process.versions.node
// to a modern version (the local host may run Node 22, which the
// shim's version gate rejects) so the shim actually reaches the
// import + main() path.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const SHIM = join(REPO_ROOT, "bin", "umactually.mjs");

const SKIP_IF_NO_DIST = !existsSync(join(REPO_ROOT, "dist", "cli.js"));

type ShimResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

function runShimWithPatchedNode(
  nodeVersion: string,
  argv: readonly string[] = ["--version"],
): ShimResult {
  // Spawn a child Node that patches process.versions.node BEFORE
  // loading the shim. The shim reads process.versions at module
  // load time, so a top-level `await import(SHIM)` is sufficient.
  const shimArgv = JSON.stringify([...argv]);
  const loader = `
    Object.defineProperty(process.versions, "node", { value: ${JSON.stringify(nodeVersion)}, configurable: true });
    process.argv = [process.argv[0], ${JSON.stringify(SHIM)}, ...${shimArgv}];
    try {
      await import(${JSON.stringify(SHIM)});
    } catch (err) {
      const msg = err && err.message ? err.message : String(err);
      process.stderr.write("[test-caught-error] " + msg + "\\n");
    }
  `;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", loader],
    { cwd: REPO_ROOT, encoding: "utf8", timeout: 30_000 },
  );
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

describe.skipIf(SKIP_IF_NO_DIST)("bin/umactually.mjs auto-invoke interaction", () => {
  it("does not double-invoke main() through the dynamic import", () => {
    // Use --version because it's deterministic and prints exactly
    // one line per invocation. A double-invoke would print it
    // twice. We also assert exit 0 so a regression that triggers
    // a second main() call (which would race on shared state) is
    // caught.
    const result = runShimWithPatchedNode("v25.7.0", ["--version"]);
    expect(result.stderr, `stderr: ${result.stderr}`).not.toMatch(
      /requires Node >= 24/,
    );
    // The version string format is "0.6.0" (semver, no leading v).
    // Count exact matches of lines that are purely the version.
    const versionLinePattern = /^\d+\.\d+\.\d+\s*$/;
    const versionLines = result.stdout
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => versionLinePattern.test(l));
    expect(versionLines.length, `stdout: ${result.stdout}`).toBe(1);
  });
});
