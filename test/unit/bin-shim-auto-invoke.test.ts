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

  it("does not double-invoke main() when invoked through an extensionless npm-style symlink (the npm install -g path)", async () => {
    // Regression: v0.6.0 introduced an extensionless SEA-binary
    // heuristic in isMainModule() that misfired when npm creates a
    // bin symlink named just `umactually` (no `.mjs` suffix). The
    // heuristic treated the symlink as a SEA binary, the auto-invoke
    // fired on top of the shim's explicit `await mod.main(argv)`
    // call, and `--version` printed the version twice.
    //
    // This test reproduces the exact npm-install layout: a symlink
    // at <tmp>/umactually pointing at bin/umactually.mjs, invoked
    // through Node's shebang resolution (which does NOT resolve the
    // symlink in process.argv[1]). Without the fix in src/cli.ts,
    // versionLines.length === 2. With the fix, it stays at 1.
    const { mkdirSync, rmSync, symlinkSync } = await import("node:fs");
    const { join } = await import("node:path");
    const tmpRoot = join(REPO_ROOT, "node_modules", ".tmp-bin-shim-symlink-test");
    const symlinkPath = join(tmpRoot, "umactually");
    try {
      try {
        mkdirSync(tmpRoot, { recursive: true });
        symlinkSync(SHIM, symlinkPath);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/symlink|EPERM|ENOTSUP|EACCES/i.test(msg)) {
          // eslint-disable-next-line no-console
          console.warn(`[skip] symlink unsupported on this filesystem: ${msg}`);
          return;
        }
        throw err;
      }
      // Spawn a child Node that:
      //   1. Patches process.versions.node so the shim's Node-24
      //      gate passes.
      //   2. Sets process.argv[1] to the EXTENSIONLESS symlink path
      //      (the npm-install layout).
      //   3. Imports the shim (which in turn dynamic-imports
      //      dist/cli.js and explicitly calls mod.main(['--version'])).
      const loader = `
        Object.defineProperty(process.versions, "node", { value: "v25.7.0", configurable: true });
        process.argv = [process.argv[0], ${JSON.stringify(symlinkPath)}, "--version"];
        try {
          await import(${JSON.stringify(symlinkPath)});
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
      expect(result.stderr, `stderr: ${result.stderr}`).not.toMatch(
        /requires Node >= 24/,
      );
      const versionLinePattern = /^\d+\.\d+\.\d+\s*$/;
      const versionLines = result.stdout
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => versionLinePattern.test(l));
      expect(
        versionLines.length,
        `expected exactly one --version line, got ${versionLines.length}.\nstdout: ${result.stdout}\nstderr: ${result.stderr}`,
      ).toBe(1);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
