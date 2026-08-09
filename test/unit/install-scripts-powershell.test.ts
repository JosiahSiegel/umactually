// SPDX-License-Identifier: MIT
// Tests for the install.ps1 PowerShell script.
//
// Like the bash tests, these use the *_TEST_MODE=1 environment variable
// which makes the scripts safe to run in CI: no network calls, no writes
// outside a sandbox directory.
//
// Skips gracefully on platforms without PowerShell (macOS, Linux CI without
// pwsh installed). The Windows installer variants have their own dedicated
// tests in test/unit/install-scripts.test.ts.
//
// allow: SIZE_OK — single-purpose test file; PS-INSTALL-004/005 require an
// inline minimal ZIP builder (production archive contract: one entry, Unix
// mode 0o100755, stored compression). Extracting it to a shared helper would
// touch test/unit/install-archives-powershell.test.ts to deduplicate its
// `buildArchive` and is out of scope for this fix.

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

// Minimal ZIP archive builder (STORED method, single entry). Mirrors the
// production archive contract: one entry whose name matches the
// install.ps1 $MemberName, with Unix mode 0o100755 (S_IFREG | 0755) so
// Assert-ArchiveMemberSafe's 0x8000 type-bit check accepts it.
const ZIP_LFH_SIG = 0x04034b50;
const ZIP_CD_SIG = 0x02014b50;
const ZIP_EOCD_SIG = 0x06054b50;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ bytes[i]!) & 0xff]!;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildSingleEntryZip(memberName: string, payload: Buffer): Buffer {
  const nameBuf = Buffer.from(memberName, "binary");
  const lfh = Buffer.alloc(30);
  lfh.writeUInt32LE(ZIP_LFH_SIG, 0);
  lfh.writeUInt16LE(20, 4); // version needed
  lfh.writeUInt16LE(0x0800, 6); // general purpose: UTF-8 names
  lfh.writeUInt16LE(0, 8); // method: stored
  lfh.writeUInt16LE(0x0000, 10); // mtime: 00:00:00
  lfh.writeUInt16LE(0x0021, 12); // mdate: 1980-01-01
  const crc = crc32(payload);
  lfh.writeUInt32LE(crc, 14);
  lfh.writeUInt32LE(payload.length, 18); // compressed size
  lfh.writeUInt32LE(payload.length, 22); // uncompressed size
  lfh.writeUInt16LE(nameBuf.length, 26);
  lfh.writeUInt16LE(0, 28); // extra-field length
  const localBytes = Buffer.concat([lfh, nameBuf, payload]);

  const cd = Buffer.alloc(46);
  cd.writeUInt32LE(ZIP_CD_SIG, 0);
  cd.writeUInt16LE(0x031e, 4); // version made by: Unix, 3.0
  cd.writeUInt16LE(20, 6);
  cd.writeUInt16LE(0x0800, 8);
  cd.writeUInt16LE(0, 10);
  cd.writeUInt16LE(0x0000, 12);
  cd.writeUInt16LE(0x0021, 14);
  cd.writeUInt32LE(crc, 16);
  cd.writeUInt32LE(payload.length, 20);
  cd.writeUInt32LE(payload.length, 24);
  cd.writeUInt16LE(nameBuf.length, 28);
  cd.writeUInt16LE(0, 30);
  cd.writeUInt16LE(0, 32);
  cd.writeUInt16LE(0, 34);
  cd.writeUInt16LE(0, 36);
  // externalAttributes: Unix mode 0o100755 = S_IFREG (0o100000) | 0755
  // The high 16 bits hold the Unix mode; Assert-ArchiveMemberSafe
  // requires the top nibble to be 0x8 (regular file).
  cd.writeUInt32LE((0o100755 << 16) >>> 0, 38);
  cd.writeUInt32LE(0, 42); // local header offset
  const cdBytes = Buffer.concat([cd, nameBuf]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(ZIP_EOCD_SIG, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8); // entries on this disk
  eocd.writeUInt16LE(1, 10); // total entries
  eocd.writeUInt32LE(cdBytes.length, 12);
  eocd.writeUInt32LE(localBytes.length, 16);
  eocd.writeUInt16LE(0, 20); // comment length
  return Buffer.concat([localBytes, cdBytes, eocd]);
}

async function runChecksumInstall(checksums: string): Promise<ScriptResult> {
  const releaseDir = join(sandbox, "release");
  const homeDir = join(sandbox, "home");
  mkdirSync(releaseDir);
  mkdirSync(homeDir);

  // Build a real ZIP archive that matches the production archive contract:
  //   - single entry named $MemberName = "umactually-windows-x64.exe"
  //   - Unix mode 0o100755 (regular file)
  //   - stored compression
  // The "binary payload" is the same string the success-case test expects
  // to land at the install path. The smoke test is disabled below because
  // this stub string is not a valid PE; the install-checksum-download
  // contract under test is independent of the binary's runnability.
  const archiveBytes = buildSingleEntryZip(
    "umactually-windows-x64.exe",
    Buffer.from("verified binary", "utf8"),
  );
  writeFileSync(join(releaseDir, "umactually-windows-x64.zip"), archiveBytes);
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
      // Pair BASE with a placeholder tag so Resolve-Tag takes the TAG+BASE
      // branch (case 5) and skips the BASE-only "invalid" throw. The tag
      // is unused downstream: Resolve-ReleaseBase returns BASE directly.
      INSTALL_RELEASE_BASE: `http://127.0.0.1:${line}`,
      INSTALL_RELEASE_TAG: "v0.0.0",
      INSTALL_TEST_NO_SMOKE: "1",
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
    // We set INSTALL_TRY_NPM=1 (with no other opt-out env) so the
    // smart-router WOULD fire on this run if the early-arg guard
    // broke — and assert that it does NOT. Without INSTALL_TRY_NPM=1,
    // the smart-router is opt-in and would silently skip, so the
    // negative assertion would pass even on a regression.
    const result = run(INSTALL_PS1, { INSTALL_TRY_NPM: "1" }, ["--help"]);
    expect(result.status, `stderr=${result.stderr}\nstdout=${result.stdout}`).toBe(0);
    expect(result.stdout).toMatch(/Usage/u);
    expect(result.stdout).toMatch(/umactually/u);
    // The smart-router's "trying npm install" / "using npm install"
    // message must NOT appear — the early-arg guard short-circuits
    // before the router is even defined. With INSTALL_TRY_NPM=1 set
    // this assertion now actually exercises the early-arg guard.
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
    const archiveBytes = buildSingleEntryZip(
      "umactually-windows-x64.exe",
      Buffer.from("verified binary", "utf8"),
    );
    // SHA-256 of the actual archive bytes (the zip wrapper), NOT the
    // inner member payload. install.ps1 hashes the downloaded archive.
    const hash = createHash("sha256").update(archiveBytes).digest("hex");
    // All five $ArchiveBasenames must appear in checksums.txt per
    // Validate-ChecksumsFile. The windows-x64 entry carries the
    // correct SHA-256 of the staged archive.
    const lines = [
      `${"a".repeat(64)}  umactually-linux-x64.tar.gz`,
      `${"a".repeat(64)}  umactually-linux-arm64.tar.gz`,
      `${"a".repeat(64)}  umactually-darwin-arm64.tar.gz`,
      `${hash}  umactually-windows-x64.zip`,
      `${"a".repeat(64)}  umactually-windows-arm64.zip`,
    ].join("\n") + "\n";

    const result = await runChecksumInstall(lines);

    const installedPath = join(sandbox, "home", ".local", "bin", "umactually.exe");
    expect(result.status).toBe(0);
    expect(readFileSync(installedPath, "utf8")).toBe("verified binary");
  });

  it.each([
    [
      "missing",
      `${"a".repeat(64)}  umactually-linux-x64.tar.gz
${"a".repeat(64)}  umactually-linux-arm64.tar.gz
${"a".repeat(64)}  umactually-darwin-arm64.tar.gz
${"a".repeat(64)}  umactually-windows-arm64.zip
`,
      "No SHA-256 checksum entry",
    ],
    [
      "malformed",
      `${"a".repeat(64)}  umactually-linux-x64.tar.gz
${"a".repeat(64)}  umactually-linux-arm64.tar.gz
${"a".repeat(64)}  umactually-darwin-arm64.tar.gz
not-a-sha256  umactually-windows-x64.zip
${"a".repeat(64)}  umactually-windows-arm64.zip
`,
      "Malformed SHA-256 checksum entry",
    ],
    [
      "mismatched",
      `${"a".repeat(64)}  umactually-linux-x64.tar.gz
${"a".repeat(64)}  umactually-linux-arm64.tar.gz
${"a".repeat(64)}  umactually-darwin-arm64.tar.gz
${"0".repeat(64)}  umactually-windows-x64.zip
${"a".repeat(64)}  umactually-windows-arm64.zip
`,
      "SHA-256 checksum mismatch",
    ],
  ])("PS-INSTALL-005: rejects a %s checksum entry and cleans temporary files", async (_case, checksums, error) => {
    const result = await runChecksumInstall(checksums);

    const installDir = join(sandbox, "home", ".local", "bin");
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(error);
    expect(existsSync(join(installDir, "umactually.exe"))).toBe(false);
    expect(existsSync(installDir) ? readdirSync(installDir) : []).toEqual([]);
  });
});
