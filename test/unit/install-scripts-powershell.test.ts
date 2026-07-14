// SPDX-License-Identifier: MIT
// Tests for the install.ps1 / uninstall.ps1 PowerShell scripts.
//
// Like the bash tests, these use the *_TEST_MODE=1 environment variable
// which makes the scripts safe to run in CI: no network calls, no writes
// outside a sandbox directory.
//
// Skips gracefully on platforms without PowerShell (macOS, Linux CI without
// pwsh installed). The Windows installer variants have their own dedicated
// tests in test/unit/install-scripts.test.ts.

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const INSTALL_PS1 = join(REPO_ROOT, "scripts", "install.ps1");
const UNINSTALL_PS1 = join(REPO_ROOT, "scripts", "uninstall.ps1");

// PowerShell discovery. On Windows: powershell.exe. On Mac/Linux: pwsh
// (PowerShell Core). Skip the entire suite when neither is available.
function findPowerShell(): string | null {
  const candidates = process.platform === "win32"
    ? ["powershell.exe", "pwsh.exe", "pwsh"]
    : ["pwsh", "powershell"];
  for (const c of candidates) {
    try {
      execFileSync(c, ["-NoProfile", "-Command", "$PSVersionTable.PSVersion"], { stdio: "pipe" });
      return c;
    } catch {
      // try next
    }
  }
  return null;
}

const POWERSHELL = findPowerShell();
const PS_AVAILABLE = POWERSHELL !== null;

type ScriptResult = {
  readonly stderr: string;
  readonly stdout: string;
  readonly status: number;
};

function run(scriptPath: string, env: Record<string, string>): ScriptResult {
  if (!PS_AVAILABLE || POWERSHELL === null) {
    return { stderr: "", stdout: "POWERSHELL_UNAVAILABLE", status: 0 };
  }
  const result = spawnSync(POWERSHELL, [
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", scriptPath,
  ], {
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  return {
    stderr: result.stderr,
    stdout: result.stdout,
    status: result.status ?? 1,
  };
}

function runChecksumInstall(checksums: string): ScriptResult {
  const releaseDir = join(sandbox, "release");
  const homeDir = join(sandbox, "home");
  mkdirSync(releaseDir);
  mkdirSync(homeDir);
  writeFileSync(join(releaseDir, "umactually-windows-x64.exe"), "verified binary");
  writeFileSync(join(releaseDir, "checksums.txt"), checksums);
  const releaseBase = pathToFileURL(releaseDir).href.replace(/\/$/, "");
  return run(INSTALL_PS1, {
    INSTALL_RELEASE_BASE: releaseBase,
    PROCESSOR_ARCHITECTURE: "AMD64",
    USERPROFILE: homeDir,
  });
}

let sandbox: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "umactually-install-ps-"));
});

afterEach(() => {
  if (sandbox && existsSync(sandbox)) {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

describe.skipIf(!PS_AVAILABLE)("install.ps1", () => {
  it("PS-INSTALL-001: writes a stub binary into the install dir", () => {
    const result = run(INSTALL_PS1, {
      INSTALL_TEST_MODE: "1",
      INSTALL_TEST_DIR: sandbox,
    });
    expect(result.status).toBe(0);
    expect(existsSync(join(sandbox, "umactually.exe"))).toBe(true);
  });

  it("PS-INSTALL-002: produces a script that prints a marker", () => {
    const result = run(INSTALL_PS1, {
      INSTALL_TEST_MODE: "1",
      INSTALL_TEST_DIR: sandbox,
    });
    expect(result.status).toBe(0);
    // The installed stub is a PowerShell script with .exe extension; verify
    // it can be re-read (we don't try to EXECUTE it since PowerShell -File
    // semantics differ on the .exe extension).
    const installedPath = join(sandbox, "umactually.exe");
    const content = require("node:fs").readFileSync(installedPath, "utf8") as string;
    expect(content).toContain("umactually");
  });

  it("PS-INSTALL-003: creates install dir if missing", () => {
    const nested = join(sandbox, "deep", "nested");
    expect(existsSync(nested)).toBe(false);
    const result = run(INSTALL_PS1, {
      INSTALL_TEST_MODE: "1",
      INSTALL_TEST_DIR: nested,
    });
    expect(result.status).toBe(0);
    expect(existsSync(join(nested, "umactually.exe"))).toBe(true);
  });

  it("PS-INSTALL-004: installs only after the GNU checksum entry matches", () => {
    const hash = createHash("sha256").update("verified binary").digest("hex");

    const result = runChecksumInstall(`${hash}  umactually-windows-x64.exe\n`);

    const installedPath = join(sandbox, "home", ".local", "bin", "umactually.exe");
    expect(result.status).toBe(0);
    expect(readFileSync(installedPath, "utf8")).toBe("verified binary");
  });

  it.each([
    ["missing", `${"a".repeat(64)}  umactually-linux-x64\n`, "No SHA-256 checksum entry"],
    ["malformed", `not-a-sha256  umactually-windows-x64.exe\n`, "Malformed SHA-256 checksum entry"],
    ["mismatched", `${"0".repeat(64)}  umactually-windows-x64.exe\n`, "SHA-256 checksum mismatch"],
  ])("PS-INSTALL-005: rejects a %s checksum entry and cleans temporary files", (_case, checksums, error) => {
    const result = runChecksumInstall(checksums);

    const installDir = join(sandbox, "home", ".local", "bin");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(error);
    expect(existsSync(join(installDir, "umactually.exe"))).toBe(false);
    expect(existsSync(installDir) ? readdirSync(installDir) : []).toEqual([]);
  });
});

describe.skipIf(!PS_AVAILABLE)("uninstall.ps1", () => {
  beforeEach(() => {
    // Seed: write a fake umactually.exe into the sandbox
    mkdirSync(sandbox, { recursive: true });
    writeFileSync(join(sandbox, "umactually.exe"), "# umactually stub\n");
    expect(existsSync(join(sandbox, "umactually.exe"))).toBe(true);
  });

  it("PS-UNINSTALL-001: removes the binary cleanly", () => {
    const result = run(UNINSTALL_PS1, {
      UNINSTALL_TEST_MODE: "1",
      UNINSTALL_TEST_DIR: sandbox,
    });
    expect(result.status).toBe(0);
    expect(existsSync(join(sandbox, "umactually.exe"))).toBe(false);
  });

  it("PS-UNINSTALL-002: idempotent — second run is a no-op", () => {
    const first = run(UNINSTALL_PS1, {
      UNINSTALL_TEST_MODE: "1",
      UNINSTALL_TEST_DIR: sandbox,
    });
    expect(first.status).toBe(0);

    const second = run(UNINSTALL_PS1, {
      UNINSTALL_TEST_MODE: "1",
      UNINSTALL_TEST_DIR: sandbox,
    });
    expect(second.status).toBe(0);
  });

  it("PS-UNINSTALL-003: handles missing binary gracefully", () => {
    const empty = mkdtempSync(join(tmpdir(), "empty-ps-"));
    try {
      const result = run(UNINSTALL_PS1, {
        UNINSTALL_TEST_MODE: "1",
        UNINSTALL_TEST_DIR: empty,
      });
      expect(result.status).toBe(0);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});

describe.skipIf(!PS_AVAILABLE)("install + uninstall round-trip (PowerShell)", () => {
  it("PS-ROUNDTRIP-001: install then uninstall leaves sandbox empty", () => {
    const install = run(INSTALL_PS1, {
      INSTALL_TEST_MODE: "1",
      INSTALL_TEST_DIR: sandbox,
    });
    expect(install.status).toBe(0);
    expect(existsSync(join(sandbox, "umactually.exe"))).toBe(true);

    const uninstall = run(UNINSTALL_PS1, {
      UNINSTALL_TEST_MODE: "1",
      UNINSTALL_TEST_DIR: sandbox,
    });
    expect(uninstall.status).toBe(0);
    expect(existsSync(join(sandbox, "umactually.exe"))).toBe(false);
  });
});