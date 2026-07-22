// SPDX-License-Identifier: MIT
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const INSTALL_SH = join(REPO_ROOT, "scripts", "install.sh");
const INSTALL_PS1 = join(REPO_ROOT, "scripts", "install.ps1");

function findBash(): string | null {
  const candidates = process.platform === "win32"
    ? ["bash.exe", "bash"]
    : ["bash", "/usr/bin/bash", "/opt/homebrew/bin/bash"];
  for (const c of candidates) {
    try {
      execFileSync(c, ["--version"], { stdio: "pipe" });
      return c;
    } catch { /* try next */ }
  }
  return null;
}

function findPwsh(): string | null {
  const candidates = process.platform === "win32"
    ? ["pwsh.exe", "powershell.exe"]
    : ["pwsh", "pwsh.exe"];
  for (const c of candidates) {
    try {
      execFileSync(c, ["--version"], { stdio: "pipe" });
      return c;
    } catch { /* try next */ }
  }
  return null;
}

const BASH = findBash();
const PWSH = findPwsh();
const SHELL_AVAILABLE = BASH !== null;
const PWSH_AVAILABLE = PWSH !== null;

type RunResult = { stdout: string; stderr: string; status: number };

function runShell(env: Record<string, string>): RunResult {
  if (!SHELL_AVAILABLE || BASH === null) {
    return { stdout: "SHELL_UNAVAILABLE", stderr: "", status: 0 };
  }
  // Use spawnSync so we can capture both stdout and stderr regardless of
  // exit code. execFileSync throws on non-zero exit, losing the streams.
  const result = spawnSync(BASH, [INSTALL_SH], {
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status ?? 1,
  };
}

function runPwsh(env: Record<string, string>, homeDir?: string): RunResult {
  if (!PWSH_AVAILABLE || PWSH === null) {
    return { stdout: "PWSH_UNAVAILABLE", stderr: "", status: 0 };
  }
  // Pin pwsh's user profile to the sandbox so install.ps1's
  // $env:USERPROFILE / $HOME lookups resolve to a writable location.
  // On Linux, pwsh defaults $env:USERPROFILE to "/" which makes
  // `New-Item -ItemType Directory -Path /.local/bin` fail with
  // "Access to the path '/.local' is denied."
  const baseEnv = { ...process.env, ...env };
  if (homeDir !== undefined) {
    baseEnv["USERPROFILE"] = homeDir;
    baseEnv["HOME"] = homeDir;
  }
  const result = spawnSync(PWSH, ["-NoProfile", "-NonInteractive", "-File", INSTALL_PS1], {
    env: baseEnv,
    encoding: "utf8",
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status ?? 1,
  };
}

const sandboxes: string[] = [];
function makeSandbox(): { dir: string; binDir: string; fakeNode: string } {
  const dir = mkdtempSync(join(tmpdir(), "umactually-smart-"));
  sandboxes.push(dir);
  const binDir = join(dir, "fake-bin");
  mkdirSync(binDir, { recursive: true });
  const isWin = process.platform === "win32";
  const ext = isWin ? ".cmd" : "";
  // Fake npm: prints a success message so the test can detect it was invoked.
  const fakeNpm = join(binDir, `npm${ext}`);
  writeFileSync(fakeNpm, isWin
    ? `@echo off\necho npm-stub called\nexit 0\n`
    : `#!/bin/sh\necho "npm-stub called"\nexit 0\n`);
  chmodSync(fakeNpm, 0o755);
  // Fake node: prints "v24.0.0" to simulate a recent Node.
  const fakeNode = join(binDir, `node${ext}`);
  writeFileSync(fakeNode, isWin
    ? `@echo off\necho v24.0.0\nexit 0\n`
    : `#!/bin/sh\necho "v24.0.0"\nexit 0\n`);
  chmodSync(fakeNode, 0o755);
  return { dir, binDir, fakeNode };
}

afterEach(() => {
  for (const sandbox of sandboxes.splice(0)) {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

// The positive test triggers a real `npm install -g umactually` which makes
// a network call. The test allows up to 30s to cover the npm lookup +
// 404 + fallthrough to the binary-download path. CI's default 5s timeout
// is too tight for that path on slow runners.
const SMART_ROUTER_TEST_TIMEOUT_MS = 30_000;

describe.skipIf(!SHELL_AVAILABLE)("install.sh smart-router (v0.6.0)", () => {
  it("delegates to npm when Node 24+ is on PATH and no override is set", { timeout: SMART_ROUTER_TEST_TIMEOUT_MS }, () => {
    const { binDir } = makeSandbox();
    const result = runShell({
      PATH: `${binDir}${sep}${process.env["PATH"] ?? ""}`,
      INSTALL_TEST_MODE: "",
      INSTALL_FORCE_BINARY: "",
    });
    // The smart-router runs `npm install -g umactually` against the
    // user's npm. In a sandbox without network or with the package
    // not yet published, npm will fail and the smart-router falls
    // through to the binary download. Either way, the proof that
    // the smart-router fired is the "Node vX.Y.Z detected, using
    // npm install" message in stderr. We assert that, plus the npm
    // call attempted (via the npm 404 / "not found" output or the
    // "installed via npm" success message).
    expect(result.stderr, `stderr: ${result.stderr}`).toMatch(/Node v\d+\.\d+\.\d+ detected, trying npm install/);
    // npm was definitely called (404 or success in stderr/stdout)
    const npmCalled = /npm install -g umactually/.test(result.stdout)
      || /npm install -g umactually/.test(result.stderr)
      || /npm-stub called/.test(result.stdout)
      || /npm-stub called/.test(result.stderr)
      || /not found|404|installed via npm/i.test(`${result.stdout}${result.stderr}`);
    expect(npmCalled, `npm was not called. stdout: ${result.stdout}\nstderr: ${result.stderr}`).toBe(true);
  });

  it("falls through to binary download when no node on PATH", () => {
    // Use a PATH that only contains the system dirs but excludes any
    // node installation. The test asserts the smart-router did NOT pick
    // the npm path AND that the test-mode binary stub was installed in
    // INSTALL_TEST_DIR — the second assertion guards against a script
    // that silently `exit 0`s on no-node (the previous form only checked
    // the stderr message, which was a false-negative trap).
    const testDir = mkdtempSync(join(tmpdir(), "umactually-smart-fb-"));
    sandboxes.push(testDir);
    const result = runShell({
      PATH: "/var/empty:/nonexistent:/usr/bin:/bin",
      INSTALL_TEST_MODE: "1",
      INSTALL_TEST_DIR: testDir,
      PLATFORM_OVERRIDE: "linux",
      ARCH_OVERRIDE: "x64",
    });
    expect(result.stderr).not.toMatch(/trying npm install/);
    // The test-mode stub binary must exist in the install dir, proving
    // the binary-download path was actually reached (not a silent exit).
    const installedBin = join(testDir, "umactually");
    expect(existsSync(installedBin), `expected test-mode stub at ${installedBin}; ` +
      `stdout=${result.stdout}\nstderr=${result.stderr}`).toBe(true);
  });

  it("respects INSTALL_TEST_MODE=1 (skips smart-router)", () => {
    const { binDir } = makeSandbox();
    const testDir = mkdtempSync(join(tmpdir(), "umactually-smart-tm-"));
    sandboxes.push(testDir);
    const result = runShell({
      PATH: `${binDir}${sep}${process.env["PATH"] ?? ""}`,
      INSTALL_TEST_MODE: "1",
      INSTALL_TEST_DIR: testDir,
      PLATFORM_OVERRIDE: "linux",
      ARCH_OVERRIDE: "x64",
    });
    // With INSTALL_TEST_MODE=1 the smart-router is bypassed; the test-mode
    // stub binary is installed instead. Assert the smart-router did not
    // fire (no "trying npm install" message).
    expect(result.stderr).not.toMatch(/trying npm install/);
  });

  it("respects INSTALL_FORCE_BINARY=1 (skips smart-router)", () => {
    const { binDir } = makeSandbox();
    const testDir = mkdtempSync(join(tmpdir(), "umactually-smart-fb-"));
    sandboxes.push(testDir);
    const result = runShell({
      PATH: `${binDir}${sep}${process.env["PATH"] ?? ""}`,
      INSTALL_FORCE_BINARY: "1",
      INSTALL_TEST_MODE: "1",  // test-mode stub for the binary path
      INSTALL_TEST_DIR: testDir,
      PLATFORM_OVERRIDE: "linux",
      ARCH_OVERRIDE: "x64",
    });
    expect(result.stderr).not.toMatch(/trying npm install/);
  });
});

describe.skipIf(!PWSH_AVAILABLE)("install.ps1 smart-router (v0.6.0)", () => {
  it("delegates to npm when Node 24+ is on PATH and no override is set", { timeout: SMART_ROUTER_TEST_TIMEOUT_MS }, () => {
    const { binDir, dir } = makeSandbox();
    const result = runPwsh({
      PATH: `${binDir}${sep}${process.env["PATH"] ?? ""}`,
      INSTALL_TEST_MODE: "",
      INSTALL_FORCE_BINARY: "",
    }, dir);
    // Smart-router picks npm and exits 0. The npm stub writes
    // "npm-stub called" to stdout.
    expect(result.status, `stdout=${result.stdout}\nstderr=${result.stderr}`).toBe(0);
    expect(result.stdout).toMatch(/npm-stub called/);
  });
});
