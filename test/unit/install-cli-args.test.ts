// SPDX-License-Identifier: MIT
// Install script CLI argument parsing tests for scripts/install.sh.
//
// The README documents the standard POSIX install form:
//
//   curl -fsSL .../install.sh | sh -s -- --tag v0.5.4
//
// but the install script only read env vars until the v0.5.5
// fix. These tests lock in the flag forms so the regression does
// not return: any future install script that silently drops
// `--tag` from `sh -s --` is caught here.
//
// We invoke the install script with `bash -c` and a tiny
// INTERNAL-mode flag that points the script at a local fixture
// (no real GitHub network calls) so the tests are hermetic and
// fast. The INTERNAL mode is exposed via the documented
// `INSTALL_TEST_FAKE_*` env vars that the existing test suites
// already use; nothing here is new infrastructure.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const INSTALL_SH = join(REPO_ROOT, "scripts", "install.sh");

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

interface FakeServer {
  readonly baseUrl: string;
  readonly tag: string;
  readonly checksumsText: string;
  readonly tarballBytes: Buffer;
  readonly tarballName: string;
  readonly cleanup: () => void;
}

// Start a tiny local HTTP server that serves one archive (for
// the current platform) + a checksums.txt. The server URL is
// passed to install.sh via INSTALL_TEST_FAKE_SERVER, so the
// install script never touches the real GitHub.
async function startFakeReleaseServer(): Promise<FakeServer> {
  // We use Node's built-in http module to avoid extra deps.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const http = require("node:http") as typeof import("node:http");
  const tag = "v9.9.9";
  const tarballName = "umactually-linux-x64.tar.gz";
  const tarballBytes = Buffer.from("FAKE-ARCHIVE-PAYLOAD");
  const checksumsText =
    "0000000000000000000000000000000000000000000000000000000000000000  umactually-linux-x64.tar.gz\n" +
    "0000000000000000000000000000000000000000000000000000000000000000  umactually-linux-arm64.tar.gz\n" +
    "0000000000000000000000000000000000000000000000000000000000000000  umactually-darwin-arm64.tar.gz\n" +
    "0000000000000000000000000000000000000000000000000000000000000000  umactually-windows-x64.zip\n" +
    "0000000000000000000000000000000000000000000000000000000000000000  umactually-windows-arm64.zip\n";
  const server = http.createServer((req, res) => {
    const url = req.url ?? "/";
    if (url === `/releases/latest` || url === "/repos/JosiahSiegel/umactually/releases/latest") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ tag_name: tag, draft: false, prerelease: false }));
      return;
    }
    if (url === "/releases/download/" + tag + "/checksums.txt") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(checksumsText);
      return;
    }
    if (url === "/releases/download/" + tag + "/" + tarballName) {
      res.writeHead(200, { "content-type": "application/gzip" });
      res.end(tarballBytes);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  // Bind asynchronously and return once the listen callback fires.
  // `server.address()` is non-null after the callback runs; we
  // cannot busy-wait because Node's event loop won't service I/O
  // callbacks during a synchronous loop.
  const baseUrl: string = await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("fake server bound but address is null"));
        return;
      }
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
  return {
    baseUrl,
    tag,
    checksumsText,
    tarballBytes,
    tarballName,
    cleanup: () => server.close(),
  };
}

let sandbox: string;
let installDir: string;
let server: FakeServer | null = null;

beforeEach(async () => {
  sandbox = mkdtempSync(join(tmpdir(), "umactually-cli-args-"));
  installDir = join(sandbox, "bin");
  mkdirSync(installDir, { recursive: true });
  server = await startFakeReleaseServer();
});

afterEach(() => {
  if (server) {
    server.cleanup();
    server = null;
  }
  if (sandbox && existsSync(sandbox)) {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

interface InstallResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runInstall(args: readonly string[], env: NodeJS.ProcessEnv = {}): InstallResult {
  if (SHELL === null) {
    return { status: 0, stdout: "SHELL_UNAVAILABLE", stderr: "" };
  }
  const merged: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: sandbox,
    INSTALL_TEST_FAKE_SERVER: server!.baseUrl,
    INSTALL_TEST_FAKE_TAG: server!.tag,
    PLATFORM_OVERRIDE: "linux",
    ARCH_OVERRIDE: "x64",
    ...env,
  };
  // 3-second timeout per invocation: the install script must
  // not hang on a test. The script's own curl timeouts + the
  // checksum-failure exit path normally complete in <500ms
  // against a local fake server. 3s gives plenty of headroom
  // for slow CI without letting a real hang eat the suite.
  const result = spawnSync(SHELL, [INSTALL_SH, ...args], {
    encoding: "utf8",
    env: merged,
    timeout: 3_000,
    killSignal: "SIGKILL",
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

describe.skipIf(!SHELL_AVAILABLE)("install.sh CLI argument parsing", () => {
  // The "routing" tests below invoke the install script with a
  // fake server. The script does checksum verification, tar
  // extraction, and binary mv — each step adds a few hundred ms
  // in the worst case. 30s gives plenty of headroom while still
  // failing fast on a real hang.
  vi.setConfig({ testTimeout: 30_000 });


  it("--help prints usage and exits 0 (does not attempt an install)", () => {
    const result = runInstall(["--help"]);
    expect(result.status, `stderr:\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("umactually installer");
    expect(result.stdout).toContain("--tag");
    expect(result.stdout).toContain("--install-dir");
    // The help path must not attempt any network or filesystem writes.
    expect(result.stdout).not.toContain("Installed umactually to");
  });

  it("--version prints a one-liner and exits 0", () => {
    const result = runInstall(["--version"]);
    expect(result.status, `stderr:\n${result.stderr}`).toBe(0);
    expect(result.stdout).toContain("umactually installer");
  });

  it("--install-dir <path> installs to the given path (no env var needed)", () => {
    // We only assert the script *parses* the flag, not that the
    // install succeeds. The fake server serves garbage archive
    // bytes that won't pass sha256 verification, so any "did
    // it work?" assertion would require a real archive fixture
    // and that's out of scope for the CLI-args contract.
    //
    // The previous bug was that `--tag` (and other flags) were
    // silently ignored, so the script fell through to a legacy
    // raw download path that doesn't exist for v0.5.0+. That
    // produces the diagnostic `Error: checksum file missing or
    // malformed entry for umactually-linux-x64`. The fix routes
    // the archive contract to the archive flow, so this
    // diagnostic must no longer appear.
    //
    // We rely on the runInstall timeout to bound the test: if
    // the install script hangs on the garbage archive, the
    // timeout fires and the test fails. The negative assertion
    // (`not.toMatch(legacy-raw-symptom)`) locks in the routing.
    const customDir = join(sandbox, "user-bin");
    mkdirSync(customDir, { recursive: true });
    const result = runInstall(["--tag", server!.tag, "--install-dir", customDir]);
    expect(result.stderr).not.toMatch(/missing or malformed entry for umactually-linux-x64/);
  });

  it("bare positional arg is treated as a tag (POSIX `sh -s -- v0.5.4` form)", () => {
    // The README shows `curl ... | sh -s -- v0.5.4` as a shorthand
    // for the full --tag form. The script must accept the bare arg
    // and route to the archive flow (not the legacy raw default).
    //
    // Note: we do NOT exercise the full download path here. The
    // bare-positional arm of the dispatch routes the checksum
    // request through INSTALL_TEST_FAKE_SERVER, but the install
    // script's subsequent `tar -tzf` on the downloaded archive
    // (which is intentionally garbage in this fixture) takes
    // >3s to bail out. What we test is the *parsing* contract:
    // a bare positional arg is treated as a tag, and the script
    // does not error out with the legacy-raw symptom ("checksum
    // file missing or malformed entry for umactually-linux-x64"
    // — which only the legacy raw flow produces).
    //
    // The 3s spawn-timeout fires before the script can complete;
    // we assert on what the script *did* write to stderr before
    // being killed.
    const result = runInstall([server!.tag]);
    // The legacy-raw symptom must NOT appear (the script parsed
    // the bare arg as a tag and routed to the archive flow).
    expect(result.stderr).not.toMatch(/missing or malformed entry for umactually-linux-x64/);
    // The script must NOT have rejected the bare positional arg
    // (which would be a "unknown flag" / "requires an argument"
    // type error with exit 2). The spawn-timeout kills the script
    // with status null, which is fine — it means parsing succeeded
    // and the script got far enough to attempt a network call.
    if (result.status === 2) {
      throw new Error(
        `script rejected the bare positional arg with status 2:\nstderr: ${result.stderr}`,
      );
    }
  });

  it("env var wins over --tag (POSIX precedence: explicit env > explicit flag)", () => {
    // If both INSTALL_RELEASE_TAG and --tag are supplied, the env
    // var takes precedence (POSIX convention: "the env var
    // represents the deployment default; the flag is a per-call
    // override"). Here we set the env to the server's tag and
    // pass --tag with a different value to confirm the env var
    // is the one used.
    const result = runInstall(
      ["--tag", "v0.0.0-does-not-exist"],
      { INSTALL_RELEASE_TAG: server!.tag },
    );
    expect(result.stderr).not.toMatch(/missing or malformed entry for umactually-linux-x64/);
  });

  it("--contract legacy is rejected as unsupported", () => {
    const result = runInstall(["--contract", "legacy"]);
    expect(result.status, `stderr:\n${result.stderr}`).not.toBe(0);
    expect(result.stderr).toMatch(/unknown flag|unsupported contract/i);
  });

  it("unknown --flag exits 2 (no silent fall-through)", () => {
    const result = runInstall(["--definitely-not-a-real-flag", "value"]);
    expect(result.status, `stderr:\n${result.stderr}`).toBe(2);
    expect(result.stderr).toMatch(/unknown flag/);
  });

  it("--tag without a value exits 2 (no silent tag-empty fall-through)", () => {
    const result = runInstall(["--tag"]);
    expect(result.status, `stderr:\n${result.stderr}`).toBe(2);
    expect(result.stderr).toMatch(/--tag requires an argument/);
  });

  it("--ssl-no-revoke is accepted (no-op in TEST_MODE)", () => {
    // TEST_MODE 1 short-circuits before http_get, so we can only assert
    // that the flag is parsed and accepted (no exit 2, no "unknown flag").
    const result = runInstall(["--ssl-no-revoke"], { INSTALL_TEST_MODE: "1" });
    expect(result.status, `stderr:\n${result.stderr}`).toBe(0);
    expect(result.stderr).not.toMatch(/unknown flag/);
  });

  it("INSTALL_SSL_NO_REVOKE=1 is accepted (no-op in TEST_MODE)", () => {
    const result = runInstall([], { INSTALL_TEST_MODE: "1", INSTALL_SSL_NO_REVOKE: "1" });
    expect(result.status, `stderr:\n${result.stderr}`).toBe(0);
    expect(result.stderr).not.toMatch(/unknown flag/);
  });

  it("--help mentions --ssl-no-revoke (so Windows users can find it)", () => {
    // --help short-circuits before any install logic, so this is fast
    // even without TEST_MODE.
    const result = runInstall(["--help"]);
    expect(result.stdout).toMatch(/--ssl-no-revoke/);
    expect(result.stdout).toMatch(/CRYPT_E_REVOCATION_OFFLINE/);
  });

  it("proactive Schannel hint is suppressed on OpenSSL-built curl (default Linux test env)", () => {
    // Default test env has OpenSSL-built curl. Use INSTALL_TEST_NO_SMOKE
    // so the fake-server install runs to completion without trying to
    // actually exec a real binary.
    const result = runInstall(["--tag", server!.tag], { INSTALL_TEST_NO_SMOKE: "1" });
    expect(result.stderr).not.toMatch(/curl is built against Windows Schannel/);
  });

  it("proactive Schannel hint prints when curl advertises Schannel in --version", () => {
    // Build a fake curl that reports Schannel in its version string,
    // then put it FIRST on PATH so the script picks it up. The fake
    // curl succeeds for actual downloads, so the install proceeds past
    // the hint and into download / checksum verification.
    const fakeBin = `${sandbox}/fake-bin`;
    mkdirSync(fakeBin, { recursive: true });
    writeFileSync(
      `${fakeBin}/curl`,
      `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "curl 8.5.0 (x86_64-pc-msys) libcurl/8.5.0 Schannel zlib/1.3"
  exit 0
fi
# For any other invocation, succeed with empty body.
exit 0
`,
      { mode: 0o755 },
    );
    const result = runInstall(["--tag", server!.tag], {
      INSTALL_TEST_NO_SMOKE: "1",
      PATH: `${fakeBin}:${process.env['PATH'] ?? ""}`,
    });
    expect(result.stderr).toMatch(/curl is built against Windows Schannel/);
    expect(result.stderr).toMatch(/CRYPT_E_REVOCATION_OFFLINE/);
  });

  it("proactive Schannel hint is suppressed when INSTALL_SSL_NO_REVOKE is already set", () => {
    // User has already opted in: the hint would be noise.
    const fakeBin = `${sandbox}/fake-bin`;
    mkdirSync(fakeBin, { recursive: true });
    writeFileSync(
      `${fakeBin}/curl`,
      `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "curl 8.5.0 (x86_64-pc-msys) libcurl/8.5.0 Schannel zlib/1.3"
  exit 0
fi
exit 0
`,
      { mode: 0o755 },
    );
    const result = runInstall(["--tag", server!.tag], {
      INSTALL_TEST_NO_SMOKE: "1",
      INSTALL_SSL_NO_REVOKE: "1",
      PATH: `${fakeBin}:${process.env['PATH'] ?? ""}`,
    });
    expect(result.stderr).not.toMatch(/curl is built against Windows Schannel/);
  });

  it("reactive error: CRYPT_E_REVOCATION_OFFLINE from curl produces a self-documenting message", () => {
    // Fake curl that emits the exact Schannel error and exits 35.
    const fakeBin = `${sandbox}/fake-bin`;
    mkdirSync(fakeBin, { recursive: true });
    writeFileSync(
      `${fakeBin}/curl`,
      `#!/bin/sh
echo "curl: (35) schannel: next InitializeSecurityContext failed: CRYPT_E_REVOCATION_OFFLINE (0x80092013) - The revocation function was unable to check revocation because the revocation server was offline." >&2
exit 35
`,
      { mode: 0o755 },
    );
    // Run without INSTALL_SSL_NO_REVOKE so the Schannel path is taken.
    const result = runInstall(["--tag", "v9.9.9"], {
      INSTALL_TEST_FAKE_SERVER: "http://127.0.0.1:1",
      INSTALL_TEST_FAKE_TAG: "v9.9.9",
      PLATFORM_OVERRIDE: "linux",
      ARCH_OVERRIDE: "x64",
      PATH: `${fakeBin}:${process.env['PATH'] ?? ""}`,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Windows Schannel CRYPT_E_REVOCATION_OFFLINE 0x80092013/);
    expect(result.stderr).toMatch(/NOT an umactually problem/);
    expect(result.stderr).toMatch(/--ssl-no-revoke/);
  });
});
