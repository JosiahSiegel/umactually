// SPDX-License-Identifier: MIT
// Regression guard for PR #209: the npm tarball must ship
// `dist/node_modules/typescript/` so the bundled CLI's
// `import * as ts from "typescript"` resolves at install time.
//
// Background: `scripts/post-bundle.mjs` vendors `node_modules/typescript`
// into `dist/node_modules/typescript` so the bundled CLI has the compiler
// runtime alongside its single `dist/cli.js`. The tarball MUST include
// that vendored tree.
//
// The earlier root cause (now fixed) was an unanchored `node_modules/`
// rule in `.gitignore` that silently ignored `dist/node_modules/`. The
// tarball was therefore built from a fresh clone that did not contain
// the vendored tree, and `bin/umactually --version` failed with
// `ERR_MODULE_NOT_FOUND` in CI.
//
// To mirror CI's behavior exactly, the test packs from a fresh worktree
// clone (created via `git clone --local --no-hardlinks`) so the source
// tree reflects exactly what CI checks out — no leftover on-disk
// `dist/node_modules/typescript/` from a prior `npm run bundle`. The
// tarball listing is then inspected with `tar -tzf` and the vendored
// runtime is asserted.

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const NPM_CLI = process.env["npm_execpath"];

if (NPM_CLI === undefined) {
  throw new TypeError("npm_execpath must identify the npm CLI");
}

interface PackResult {
  readonly tarball: string;
  readonly entries: readonly string[];
}

function packFromFreshClone(): PackResult {
  const workspace = mkdtempSync(join(tmpdir(), "umactually-tarball-shape-"));
  const cloneRoot = join(workspace, "clone");
  const packDirectory = join(workspace, "pack");
  mkdirSync(packDirectory, { recursive: true });
  try {
    const npmCli = NPM_CLI;
    if (npmCli === undefined) {
      throw new TypeError("npm_execpath must identify the npm CLI");
    }
    execFileSync("git", [
      "clone",
      "--local",
      "--no-hardlinks",
      REPO_ROOT,
      cloneRoot,
    ], { encoding: "utf8", stdio: "pipe" });

    const packOutput = execFileSync(process.execPath, [npmCli, "pack", "--pack-destination", packDirectory, "--silent"], {
      cwd: cloneRoot,
      encoding: "utf8",
    });
    const lines = packOutput.trim().split(/\r?\n/u);
    const tarballName = lines.at(-1);
    if (tarballName === undefined || !tarballName.endsWith(".tgz")) {
      throw new TypeError(`npm pack output did not end with a .tgz file: ${packOutput}`);
    }
    const tarballPath = join(packDirectory, tarballName);
    const listing = execFileSync("tar", ["-tzf", tarballPath], { encoding: "utf8" });
    const entries = listing.split(/\r?\n/u).filter((line) => line.length > 0);
    return { tarball: tarballPath, entries };
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

function listingContains(entries: readonly string[], suffix: string): boolean {
  return entries.some((entry) => entry === `package/${suffix}` || entry === suffix);
}

function describeFailure(tarball: string, missing: readonly string[]): string {
  return [
    "ERR_TS_NOT_VENDORED: dist/node_modules/typescript must ship in the npm tarball",
    "expected vendored typescript at all of:",
    ...missing.map((m) => `  - package/${m}`),
    `but tarball ${tarball} did not include them.`,
    "Likely cause: a .gitignore rule is ignoring dist/node_modules/typescript, so a fresh",
    "clone (e.g. CI's checkout) does not contain the vendored tree and `npm pack` ships",
    "without it. The bundled CLI then fails with `ERR_MODULE_NOT_FOUND: 'typescript'`",
    "the first time it is invoked.",
    "Fix: anchor /node_modules/ in .gitignore (root-anchored) and `git add -f",
    "dist/node_modules/typescript` so the vendored tree is part of the published tarball.",
  ].join("\n");
}

describe("install-methods (tarball shape)", () => {
  it("NPM-PACK-TARBALL-SHAPE: dist/node_modules/typescript ships in the npm tarball", { timeout: 60_000 }, () => {
    const { tarball, entries } = packFromFreshClone();
    const required = [
      "dist/node_modules/typescript/package.json",
      "dist/node_modules/typescript/lib/typescript.js",
    ] as const;
    const missing = required.filter((p) => !listingContains(entries, p));

    expect(listingContains(entries, "dist/cli.js"), "dist/cli.js must be in the tarball").toBe(true);
    expect(listingContains(entries, "package.json"), "package/package.json must be in the tarball").toBe(true);

    if (missing.length > 0) {
      throw new Error(describeFailure(tarball, missing));
    }
  });
});
