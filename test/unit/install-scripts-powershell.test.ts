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

import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

// Hotfix #10 — bump per-test timeout so PowerShell tests don't flake
// at the 5 s default during cold pwsh starts on CI runners. The
// slowest test (PS-INSTALL-004) empirically takes 6.5 s on CI; on
// healthy local machines it finishes in 1–3 s.
if (PS_AVAILABLE) {
  vi.setConfig({ testTimeout: 30_000 });
}

type ScriptResult = {
  readonly stderr: string;
  readonly stdout: string;
  readonly status: number;
};

function run(scriptPath: string, env: Record<string, string>, scriptArgs: string[] = []): ScriptResult {
  if (!PS_AVAILABLE || POWERSHELL === null) {
    return { stderr: "", stdout: "POWERSHELL_UNAVAILABLE", status: 0 };
  }
  const result = spawnSync(POWERSHELL, [
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", scriptPath,
    ...scriptArgs,
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

async function runChecksumInstall(checksums: string): Promise<ScriptResult> {
  const releaseDir = join(sandbox, "release");
  const homeDir = join(sandbox, "home");
  mkdirSync(releaseDir);
  mkdirSync(homeDir);
  writeFileSync(join(releaseDir, "umactually-windows-x64.exe"), "verified binary");
  writeFileSync(join(releaseDir, "checksums.txt"), checksums);

  const server = spawn(process.execPath, [
    "-e",
    "const http=require('node:http'),fs=require('node:fs'),path=require('node:path');const server=http.createServer((request,response)=>fs.createReadStream(path.join(process.env.RELEASE_DIR,new URL(request.url,'http://127.0.0.1').pathname.slice(1))).pipe(response));server.listen(0,'127.0.0.1',()=>console.log(server.address().port));",
  ], {
    env: { ...process.env, RELEASE_DIR: releaseDir },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const lines = createInterface({ input: server.stdout });
  try {
    const [line] = await once(lines, "line");
    return run(INSTALL_PS1, {
      INSTALL_RELEASE_BASE: `http://127.0.0.1:${line}`,
      PROCESSOR_ARCHITECTURE: "AMD64",
      USERPROFILE: homeDir,
    });
  } finally {
    lines.close();
    const exited = once(server, "exit");
    server.kill();
    await exited;
  }
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

  it("PS-INSTALL-HELP: --help prints a usage block and exits 0 (no install attempt)", () => {
    // Regression: the smart-router used to run BEFORE arg parsing, so
    // `install.ps1 --help` would attempt a real install and 404 on
    // npm. The CI smoke test `install.ps1 --help smoke` in
    // .github/workflows/ci.yml was failing because of this. We now
    // handle --help/--version BEFORE the smart-router. Lock that in
    // here so a future refactor can't silently regress it.
    //
    // We deliberately run the script with NO env overrides (so the
    // smart-router WOULD fire if the early-arg guard broke) and
    // assert that the output mentions "Usage" and the binary was
    // NOT installed anywhere on disk.
    const result = run(INSTALL_PS1, {}, ["--help"]);
    expect(result.status, `stderr=${result.stderr}\nstdout=${result.stdout}`).toBe(0);
    expect(result.stdout).toMatch(/Usage/u);
    expect(result.stdout).toMatch(/umactually/u);
    // The smart-router's "trying npm install" / "using npm install"
    // message must NOT appear — the early-arg guard short-circuits
    // before the router is even defined.
    expect(result.stderr).not.toMatch(/trying npm install/);
    expect(result.stderr).not.toMatch(/using npm install/);
    // Nothing should have been installed.
    expect(existsSync(join(sandbox, "umactually.exe"))).toBe(false);
  });

  it("PS-INSTALL-HELP: -h short form also triggers the usage block", () => {
    // POSIX installers accept -h as the short form of --help. Mirror
    // that here so the CI smoke test (which uses both -h and --help)
    // has a single source of truth.
    const result = run(INSTALL_PS1, {}, ["-h"]);
    expect(result.status, `stderr=${result.stderr}\nstdout=${result.stdout}`).toBe(0);
    expect(result.stdout).toMatch(/Usage/u);
  });

  it("PS-INSTALL-VERSION: --version prints the installer version and exits 0", () => {
    // The smoke test for the bin shim already covers "Node 25.7
    // exit-on-old-version" semantics. Here we just need to confirm
    // the --version flag is honored by install.ps1 (it must NOT
    // trigger the smart-router either, because --version is a pure
    // metadata query).
    const result = run(INSTALL_PS1, {}, ["--version"]);
    expect(result.status, `stderr=${result.stderr}\nstdout=${result.stdout}`).toBe(0);
    expect(result.stdout).toMatch(/umactually installer/u);
  });

  it("PS-INSTALL-004: installs only after the GNU checksum entry matches", async () => {
    const hash = createHash("sha256").update("verified binary").digest("hex");

    const result = await runChecksumInstall(`${hash}  umactually-windows-x64.exe\n`);

    const installedPath = join(sandbox, "home", ".local", "bin", "umactually.exe");
    expect(result.status).toBe(0);
    expect(readFileSync(installedPath, "utf8")).toBe("verified binary");
  });

  it.each([
    ["missing", `${"a".repeat(64)}  umactually-linux-x64\n`, "No SHA-256 checksum entry"],
    ["malformed", `not-a-sha256  umactually-windows-x64.exe\n`, "Malformed SHA-256 checksum entry"],
    ["mismatched", `${"0".repeat(64)}  umactually-windows-x64.exe\n`, "SHA-256 checksum mismatch"],
  ])("PS-INSTALL-005: rejects a %s checksum entry and cleans temporary files", async (_case, checksums, error) => {
    const result = await runChecksumInstall(checksums);

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