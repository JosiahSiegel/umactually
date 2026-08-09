// SPDX-License-Identifier: MIT
// Production-path checksum verification tests for scripts/install.sh.

import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { once } from "node:events";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildArchive, buildChecksumFile, sha256, TARGETS, type Target } from "../helpers/install-archive-helpers.js";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const INSTALL_SH = join(REPO_ROOT, "scripts", "install.sh");
const TARGET: Target = {
  id: "linux-x64",
  rawName: "umactually-linux-x64",
  archiveName: "umactually-linux-x64.tar.gz",
  memberName: "umactually-linux-x64",
  installedName: "umactually",
  archiveType: "tar.gz",
};
const ASSET_NAME = TARGET.archiveName;
const ASSET_CONTENT = Buffer.from("#!/bin/sh\necho verified\n");
const ARCHIVE_CONTENT = buildArchive(TARGET, ASSET_CONTENT).bytes;
const ASSET_HASH = createHash("sha256").update(ARCHIVE_CONTENT).digest("hex");

function findBash(): string | null {
  const candidates: readonly string[] = process.platform === "win32"
    ? ["bash.exe", "bash"]
    : ["bash", "/usr/bin/bash", "/opt/homebrew/bin/bash"];
  for (const candidate of candidates) {
    const result = spawnSync(candidate, ["--version"], { encoding: "utf8" });
    if (result.status === 0) return candidate;
  }
  return null;
}

const SHELL = findBash();
const SHELL_AVAILABLE = SHELL !== null;
let sandbox: string;
let installTarget: string;
let releaseDir: string;
let server: ReturnType<typeof spawn> | null = null;
let serverPort = 0;

beforeEach(async () => {
  sandbox = mkdtempSync(join(tmpdir(), "umactually-checksum-test-"));
  installTarget = join(sandbox, ".local", "bin", "umactually");
  releaseDir = join(sandbox, "release");
  mkdirSync(join(sandbox, ".local", "bin"), { recursive: true });
  mkdirSync(releaseDir, { recursive: true });
  writeFileSync(installTarget, "existing installation\n");

  // Stand up a small Node http server that serves RELEASE_DIR/<filename>
  // for any path. The install script's `curl` (real or fake) is then
  // pointed at this server via INSTALL_RELEASE_BASE. This pattern is
  // identical to test/unit/install-scripts-powershell.test.ts and is
  // the cross-platform alternative to putting a fake `curl` on PATH
  // (which doesn't work reliably on Windows + Git Bash because
  // chmod 0o755 doesn't set the executable bit in a way bash honors).
  server = spawn(
    process.execPath,
    [
      "-e",
      "const http=require('node:http'),fs=require('node:fs'),path=require('node:path');" +
        "const server=http.createServer((request,response)=>{" +
        // Strip the leading slash from the pathname, then strip the
        // '/download/<tag>/' prefix the install.sh script appends
        // (we set INSTALL_RELEASE_BASE to .../download/v0.6.0).
        // Anything left is treated as a filename under RELEASE_DIR.
        "let p=new URL(request.url,'http://127.0.0.1').pathname.replace(/^\\/+/,'');" +
        "p=p.replace(/^download\\/[^/]+\\//,'');" +
        "p=path.join(process.env.RELEASE_DIR,p);" +
        "if(!p.startsWith(process.env.RELEASE_DIR)){response.statusCode=403;return response.end();}" +
        "fs.createReadStream(p).on('error',()=>{response.statusCode=404;response.end();}).pipe(response);" +
        "});" +
        "server.listen(0,'127.0.0.1',()=>console.log(server.address().port));",
    ],
    { env: { ...process.env, RELEASE_DIR: releaseDir }, stdio: ["ignore", "pipe", "pipe"] },
  );
  const lines = createInterface(server.stdout as never);
  const [line] = (await once(lines, "line")) as [string];
  serverPort = Number.parseInt(line, 10);
});

afterEach(async () => {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
  }
  if (sandbox && existsSync(sandbox)) rmSync(sandbox, { recursive: true, force: true });
});

function installWith(checksums: string): { readonly status: number | null; readonly stderr: string } {
  if (SHELL === null) return { status: 0, stderr: "" };
  // Refresh the served files for each test case so the test can change
  // the checksums (the "mismatched" / "malformed" / "missing" cases
  // all share the same server instance from beforeEach).
  writeFileSync(join(releaseDir, ASSET_NAME), ARCHIVE_CONTENT);
  writeFileSync(join(releaseDir, "checksums.txt"), checksums);
  const result = spawnSync(SHELL, [INSTALL_SH], {
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: sandbox,
      // INSTALL_FORCE_BINARY bypasses the smart-router (which would
      // otherwise make a real `npm install -g umactually` call against
      // the user's npm — that 404s because the package isn't
      // published yet, and would pollute stderr with npm's error
      // log on every test run). Unlike INSTALL_TEST_MODE=1, this
      // does NOT short-circuit to the stub-binary path; the script
      // continues into the real binary-download + checksum-verify
      // flow with the local Node http server providing the
      // checksums + asset. This is what the test is exercising.
      INSTALL_FORCE_BINARY: "1",
      // Point the script at the local http server. The /download/<tag>
      // suffix matches the URL shape the script constructs from
      // RESOLVED_BASE; the test's server strips it before joining
      // RELEASE_DIR.
      INSTALL_RELEASE_BASE: `http://127.0.0.1:${serverPort}/download/v0.6.0`,
      INSTALL_RELEASE_TAG: "v0.6.0",
      // Force the install destination to the test sandbox. Without
      // this, the script picks /usr/local/bin (when running as
      // root) or $HOME/.local/bin (otherwise), neither of which is
      // where the test's `installTarget` watcher is looking.
      INSTALL_DIR_OVERRIDE: join(sandbox, ".local", "bin"),
      // On Windows Git Bash, the install.sh script delegates to
      // install.ps1 (downloaded fresh from the GitHub raw URL),
      // which would then try to call the GitHub Releases API to
      // resolve the latest tag — that 403s in CI and the test
      // never reaches the checksum-verify path. Force the bash
      // script to run in its POSIX/curl path on Windows CI so the
      // test exercises the same code path that bash install.sh
      // users on Linux/macOS see.
      PLATFORM_OVERRIDE: "linux",
      ARCH_OVERRIDE: "x64",
    },
  });
  return { status: result.status, stderr: result.stderr };
}

describe.skipIf(!SHELL_AVAILABLE)("install.sh production checksum verification", () => {
  it("installs the temporary asset when its exact GNU checksum entry matches", () => {
    // Given
    const hashes = Object.fromEntries(TARGETS.map((target) => [target.archiveName, target.archiveName === ASSET_NAME ? ASSET_HASH : sha256(Buffer.from(target.id))]));
    const checksums = buildChecksumFile(hashes, "archive");

    // When
    const result = installWith(checksums);

    // Then
    expect(result.status).toBe(0);
    expect(readFileSync(installTarget)).toEqual(ASSET_CONTENT);
  });

  it.each([
    ["missing", `${ASSET_HASH}  ${ASSET_NAME}\n`],
    ["malformed", `${ASSET_HASH} ${ASSET_NAME}\n`],
    ["mismatched", buildChecksumFile(Object.fromEntries(TARGETS.map((target) => [target.archiveName, "0".repeat(64)])), "archive")],
  ])("rejects a %s checksum entry without replacing the installed binary", (_case, checksums) => {
    // Given
    const existing = readFileSync(installTarget, "utf8");

    // When
    const result = installWith(checksums);

    // Then
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("checksum");
    expect(readFileSync(installTarget, "utf8")).toBe(existing);
  });
});
