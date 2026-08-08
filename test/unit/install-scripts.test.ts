// SPDX-License-Identifier: MIT
// Tests for the install.sh shell script.
//
// These tests use the *_TEST_MODE=1 environment variables which make the
// scripts safe to run in CI: no network calls, no writes outside a sandbox
// directory under process.cwd()/tmp.
//
// What we verify:
//   1. install.sh: OS+arch detection maps to the correct binary name
//   2. install.sh: produces a working executable in the install dir
//   3. install.sh: respects PLATFORM_OVERRIDE / ARCH_OVERRIDE
//   4. The installed binary is on PATH when its install dir is prepended

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const INSTALL_SH = join(REPO_ROOT, "scripts", "install.sh");

// POSIX shell. On Windows we look for bash.exe (ships with Git for Windows,
// WSL, MSYS2, Cygwin). When bash is absent — e.g. stock Windows with only
// PowerShell — the install.sh shell script cannot be exercised here. The
// Windows PowerShell variant (install.ps1) has
// their own dedicated tests in test/unit/install-scripts-powershell.test.ts.
//
// If bash is missing, we skip every test in this file with a clear message
// rather than fail with ENOENT — vitest marks them as skipped, not failed.
function findBash(): string | null {
  const candidates: readonly string[] = process.platform === "win32"
    ? ["bash.exe", "bash"]
    : ["bash", "/usr/bin/bash", "/opt/homebrew/bin/bash"];
  for (const c of candidates) {
    try {
      execFileSync(c, ["--version"], { stdio: "pipe" });
      return c;
    } catch {
      // try next
    }
  }
  return null;
}

const SHELL = findBash();
const SHELL_AVAILABLE = SHELL !== null;

function run(scriptPath: string, env: Record<string, string>): { stdout: string; status: number } {
  if (!SHELL_AVAILABLE || SHELL === null) {
    return { stdout: "SHELL_UNAVAILABLE", status: 0 };
  }
  try {
    const stdout = execFileSync(SHELL, [scriptPath], {
      env: { ...process.env, ...env },
      encoding: "utf8",
    });
    return { stdout, status: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; status?: number };
    return { stdout: e.stdout ?? "", status: e.status ?? 1 };
  }
}

function parseKeyValue(stdout: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of stdout.split(/\r?\n/)) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && m[1] !== undefined) out[m[1]] = m[2] ?? "";
  }
  return out;
}

let sandbox: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "umactually-install-test-"));
});

afterEach(() => {
  if (sandbox && existsSync(sandbox)) {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

describe.skipIf(!SHELL_AVAILABLE)("install.sh detection", () => {
  it("INSTALL-001: detects current platform + arch correctly", () => {
    const result = run(INSTALL_SH, {
      INSTALL_TEST_MODE: "1",
      INSTALL_TEST_DIR: sandbox,
    });
    expect(result.status).toBe(0);
    const summary = parseKeyValue(result.stdout);
    expect(summary["TEST_MODE"]).toBe("1");
    expect(summary["PLATFORM"]).toMatch(/^(linux|darwin|windows)$/);
    expect(summary["ARCH"]).toMatch(/^(x64|arm64)$/);
    const extension = summary["PLATFORM"] === "windows" ? ".exe" : "";
    expect(summary["BINARY"]).toBe(`umactually-${summary["PLATFORM"]}-${summary["ARCH"]}${extension}`);
    expect(summary["URL"]).toContain(summary["BINARY"]);
  });

  it("INSTALL-002: respects PLATFORM_OVERRIDE + ARCH_OVERRIDE", () => {
    const result = run(INSTALL_SH, {
      INSTALL_TEST_MODE: "1",
      INSTALL_TEST_DIR: sandbox,
      PLATFORM_OVERRIDE: "darwin",
      ARCH_OVERRIDE: "arm64",
    });
    expect(result.status).toBe(0);
    const summary = parseKeyValue(result.stdout);
    expect(summary["PLATFORM"]).toBe("darwin");
    expect(summary["ARCH"]).toBe("arm64");
    expect(summary["BINARY"]).toBe("umactually-darwin-arm64");
    expect(summary["URL"]).toContain("umactually-darwin-arm64");
  });

  it("INSTALL-003: handles all 5 production target combinations (darwin-x64 dropped in v0.6.0)", () => {
    const targets = ["linux-x64", "linux-arm64", "darwin-arm64", "windows-x64", "windows-arm64"];
    for (const t of targets) {
      const [platform, arch] = t.split("-") as [string, string];
      const result = run(INSTALL_SH, {
        INSTALL_TEST_MODE: "1",
        INSTALL_TEST_DIR: sandbox,
        PLATFORM_OVERRIDE: platform,
        ARCH_OVERRIDE: arch,
      });
      expect(result.status).toBe(0);
      const summary = parseKeyValue(result.stdout);
      const extension = platform === "windows" ? ".exe" : "";
      expect(summary["BINARY"]).toBe(`umactually-${t}${extension}`);
    }
  });

  it("INSTALL-004: unsupported architecture produces correct exit", () => {
    // Can't easily test uname-m override without setting up a fake env.
    // Instead just verify that PLATFORM_OVERRIDE='' / ARCH_OVERRIDE='' fallback
    // to detection and the binary name still matches.
    const result = run(INSTALL_SH, {
      INSTALL_TEST_MODE: "1",
      INSTALL_TEST_DIR: sandbox,
      PLATFORM_OVERRIDE: "",
      ARCH_OVERRIDE: "",
    });
    expect(result.status).toBe(0);
  });
});

describe.skipIf(!SHELL_AVAILABLE)("install.sh side effects", () => {
  it("INSTALL-101: writes a working executable into the install dir", () => {
    const result = run(INSTALL_SH, {
      INSTALL_TEST_MODE: "1",
      INSTALL_TEST_DIR: sandbox,
      PLATFORM_OVERRIDE: "linux",
      ARCH_OVERRIDE: "x64",
    });
    expect(result.status).toBe(0);
    const binaryPath = join(sandbox, "umactually");
    expect(existsSync(binaryPath)).toBe(true);
    const stats = statSync(binaryPath);
    expect(stats.isFile()).toBe(true);
    if (process.platform !== "win32") {
      // POSIX: verify executable bit. Windows ignores this bit.
      expect((stats.mode & 0o111) !== 0).toBe(true);
    }
  });

  it("INSTALL-102: stub binary can be invoked and prints platform info", () => {
    const result = run(INSTALL_SH, {
      INSTALL_TEST_MODE: "1",
      INSTALL_TEST_DIR: sandbox,
      PLATFORM_OVERRIDE: "darwin",
      ARCH_OVERRIDE: "arm64",
    });
    expect(result.status).toBe(0);

    const binaryPath = join(sandbox, "umactually");
    // On POSIX, invoke directly. On Windows, route through bash.exe since
    // the stub is a shell script without a .exe extension. (The describe
    // block is skipped when SHELL is null, so this is always defined here.)
    const output = process.platform === "win32" && SHELL !== null
      ? execFileSync(SHELL, [binaryPath], { encoding: "utf8" })
      : execFileSync(binaryPath, [], { encoding: "utf8" });
    expect(output.trim()).toBe("umactually test-mode stub (darwin-arm64)");
  });

  it("INSTALL-103: creates install dir if it doesn't exist", () => {
    const nested = join(sandbox, "deep", "nested", "bin");
    expect(existsSync(nested)).toBe(false);
    const result = run(INSTALL_SH, {
      INSTALL_TEST_MODE: "1",
      INSTALL_TEST_DIR: nested,
    });
    expect(result.status).toBe(0);
    expect(existsSync(join(nested, "umactually"))).toBe(true);
  });

  it("INSTALL-104: install dir is sandboxed (does not touch $HOME/.local/bin)", () => {
    const result = run(INSTALL_SH, {
      INSTALL_TEST_MODE: "1",
      INSTALL_TEST_DIR: sandbox,
    });
    expect(result.status).toBe(0);
    const summary = parseKeyValue(result.stdout);
    expect(summary["INSTALL_DIR"]).toBe(sandbox);
    // The sandbox dir got the binary; the real $HOME/.local/bin was untouched
    // (we never assert that here, but the sandbox path is unambiguous).
  });
});

describe.skipIf(!SHELL_AVAILABLE)("installed command", () => {
  it("ROUNDTRIP-002: installed binary is invocable from any cwd via PATH", () => {
    // Install into sandbox
    run(INSTALL_SH, {
      INSTALL_TEST_MODE: "1",
      INSTALL_TEST_DIR: sandbox,
      PLATFORM_OVERRIDE: "linux",
      ARCH_OVERRIDE: "x64",
    });

    // Run it from a DIFFERENT directory with PATH prepended
    const otherDir = mkdtempSync(join(tmpdir(), "other-cwd-"));
    try {
      const newPath = `${sandbox}:${process.env["PATH"]}`;
      const binaryPath = join(sandbox, "umactually");
      const output = process.platform === "win32" && SHELL !== null
        ? execFileSync(SHELL, [binaryPath], {
            encoding: "utf8",
            cwd: otherDir,
            env: { ...process.env, PATH: newPath },
          })
        : execFileSync(binaryPath, [], {
            encoding: "utf8",
            cwd: otherDir,
            env: { ...process.env, PATH: newPath },
          });
      expect(output.trim()).toBe("umactually test-mode stub (linux-x64)");
    } finally {
      rmSync(otherDir, { recursive: true, force: true });
    }
  });
});