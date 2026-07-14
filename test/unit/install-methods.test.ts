import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const NPM_CLI = process.env["npm_execpath"];
const WINDOWS_GLOBAL_INSTALL_UNAVAILABLE = process.platform === "win32" && process.env["CI_HAS_NPM_GLOBAL"] === undefined;

if (WINDOWS_GLOBAL_INSTALL_UNAVAILABLE) {
  console.warn("NPM-PACK-SMOKE skipped: set CI_HAS_NPM_GLOBAL=1 on Windows when isolated global npm installs are available.");
}

describe.skipIf(WINDOWS_GLOBAL_INSTALL_UNAVAILABLE)("installation method smoke tests", () => {
  it("NPM-PACK-SMOKE: smoke: package installs and reports the correct version", () => {
    // Given: an isolated pack destination and npm prefix.
    const workspace = mkdtempSync(join(tmpdir(), "umactually-npm-pack-"));
    const packDirectory = join(workspace, "pack");
    const prefix = join(workspace, "prefix");
    mkdirSync(packDirectory, { recursive: true });
    const packageJson: unknown = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"));
    if (typeof packageJson !== "object" || packageJson === null || Array.isArray(packageJson)) {
      throw new TypeError("package.json must parse as an object");
    }
    const version = Object.fromEntries(Object.entries(packageJson))["version"];
    if (typeof version !== "string") {
      throw new TypeError("package.json version must be a string");
    }

    try {
      // When: npm packs, globally installs under the temporary prefix, and invokes the installed shim.
      if (NPM_CLI === undefined) {
        throw new TypeError("npm_execpath must identify the npm CLI");
      }
      const tarballName = execFileSync(process.execPath, [NPM_CLI, "pack", "--pack-destination", packDirectory], {
        cwd: REPO_ROOT,
        encoding: "utf8",
      }).trim().split(/\r?\n/u).at(-1);
      if (tarballName === undefined) {
        throw new TypeError("npm pack must return a tarball name");
      }
      execFileSync(process.execPath, [NPM_CLI, "install", "--global", "--prefix", prefix, join(packDirectory, tarballName)], {
        cwd: REPO_ROOT,
        encoding: "utf8",
      });
      const binary = process.platform === "win32"
        ? join(prefix, "umactually.cmd")
        : join(prefix, "bin", "umactually");
      const stdout = process.platform === "win32"
        ? execFileSync(process.env["ComSpec"] ?? "cmd.exe", ["/d", "/c", binary, "--version"], { encoding: "utf8" })
        : execFileSync(binary, ["--version"], { encoding: "utf8" });

      // Then: the installed package reports the manifest version and exits zero.
      expect(stdout).toContain(version);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  }, 120_000);
});
