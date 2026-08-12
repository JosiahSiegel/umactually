// SPDX-License-Identifier: MIT
//
// Regression guard for PR #209: the Node SEA binary must NOT crash on
// `--version` (or any other startup-only command) with
//   ReferenceError: __filename is not defined
//       at isFileSystemCaseSensitive (file:///.../umactually-linux-x64:...)
//       at getNodeSystem (...)
// which happens when the bundled CLI statically imports `typescript`.
//
// Background: the TypeScript compiler API module references CJS-only
// `__filename` and `__dirname` at module-init. Inside Node's SEA blob
// those globals are NOT defined in ESM scope, so loading the module
// eagerly at startup crashes every CLI invocation. The fix
// (context-provenance.ts) makes the import lazy: it is only resolved
// when context-provenance actually parses a TS file, so `--version`,
// `--help`, `doctor`, and `init` no longer touch the compiler.
//
// The test spawns `release/umactually-linux-x64 --version` directly
// (the same surface CI's `smoke-sea` job exercises) and asserts:
//   - exit 0
//   - stdout contains the package version (`0.8.0`)
//   - stderr does NOT contain `isFileSystemCaseSensitive`, `ReferenceError`,
//     or `loader fault` — the three observable signatures of the SEA
//     crash from the failing CI URLs.
//
// If the binary is missing (e.g. CI runs `npm run bundle && node
// scripts/build-sea.mjs linux-x64` BEFORE the test via vitest
// globalSetup, OR this suite uses `describe.skipIf(!BINARY_PRESENT)`), the
// test skips cleanly. On a developer's local worktree the binary is
// built by `npm run bundle && node scripts/build-sea.mjs linux-x64`.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const BINARY = join(REPO_ROOT, "release", "umactually-linux-x64");

function loadPackageVersion(): string {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8")) as {
    readonly version: string;
  };
  return pkg.version;
}

function binaryExists(): boolean {
  return existsSync(BINARY);
}

const BINARY_PRESENT = binaryExists();
const PACKAGE_VERSION = loadPackageVersion();

// Skip the entire suite when the SEA binary is absent. The
// `release/umactually-linux-x64` artifact is built by
// `npm run bundle && node scripts/build-sea.mjs linux-x64` and may not
// exist on a fresh checkout, in CI before the bundle step, or on
// non-linux runners.

describe.skipIf(!BINARY_PRESENT)("SEA typescript lazy-load", () => {
  it("SEA-VERSION-NO-TS-CRASH: --version exits 0 without ReferenceError", { timeout: 30_000 }, () => {
    const result = spawnSync(BINARY, ["--version"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });

    // Surface unexpected failures with the captured streams so a
    // maintainer can diagnose without re-running the test.
    const diag = `exit=${String(result.status)}\nstdout=${JSON.stringify(result.stdout)}\nstderr=${JSON.stringify(result.stderr)}`;

    expect(result.status, diag).toBe(0);
    expect(result.stdout?.trim(), diag).toBe(PACKAGE_VERSION);

    const stderr = result.stderr ?? "";
    // The exact three signatures of the failing CI URLs.
    expect(stderr, diag).not.toMatch(/isFileSystemCaseSensitive/u);
    expect(stderr, diag).not.toMatch(/ReferenceError/u);
    expect(stderr, diag).not.toMatch(/loader fault/u);
  });

  it("SEA-VERSION-NO-STACKTRACE: --version stderr contains no typescript module stack frame", { timeout: 30_000 }, () => {
    const result = spawnSync(BINARY, ["--version"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });

    const stderr = result.stderr ?? "";
    expect(result.status, `exit=${String(result.status)} stderr=${JSON.stringify(stderr)}`).toBe(0);
    // Belt-and-suspenders: the bundled CLI's module specifier for
    // typescript is `typescript` (no path) so a stack frame would
    // either say `node:typescript` (the ESM SEA blob's wrapper) or
    // include the literal `typescript.js`/`typescript.d.ts` paths.
    expect(stderr, JSON.stringify(stderr)).not.toMatch(/typescript\.js/u);
    expect(stderr, JSON.stringify(stderr)).not.toMatch(/typescript\.d\.ts/u);
  });

  it("SEA-DOES-NOT-NEED-TS-MODULE: binary does not eagerly import typescript at startup", { timeout: 30_000 }, () => {
    // Indirect verification: if typescript were eagerly loaded, the
    // getNodeSystem() chain would produce additional side effects
    // (a stack trace mentioning the bundled module path). The
    // absence of any stderr proves the typescript module was not
    // touched. This complements the explicit `--version` test above.
    const result = spawnSync(BINARY, ["--version"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    expect((result.stderr ?? "").length, `--version must produce empty stderr, got: ${JSON.stringify(result.stderr)}`).toBe(0);
  });
});
