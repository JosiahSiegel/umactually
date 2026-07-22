// SPDX-License-Identifier: MIT
// Production-path checksum verification tests for scripts/install.sh.

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const INSTALL_SH = join(REPO_ROOT, "scripts", "install.sh");
const ASSET_NAME = "umactually-linux-x64";
const ASSET_CONTENT = "#!/bin/sh\necho verified\n";
const ASSET_HASH = createHash("sha256").update(ASSET_CONTENT).digest("hex");

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
let fakeBin: string;
let installTarget: string;

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "umactually-checksum-test-"));
  fakeBin = join(sandbox, "fake-bin");
  installTarget = join(sandbox, ".local", "bin", "umactually");
  mkdirSync(fakeBin, { recursive: true });
  mkdirSync(join(sandbox, ".local", "bin"), { recursive: true });
  writeFileSync(installTarget, "existing installation\n");

  const commands = {
    curl: `#!/bin/sh
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o) output="$2"; shift 2 ;;
    *) url="$1"; shift ;;
  esac
done
case "$url" in
  */checksums.txt) printf '%s' "$FAKE_CHECKSUMS" > "$output" ;;
  *) printf '%s' "$FAKE_ASSET" > "$output" ;;
esac
`,
    id: "#!/bin/sh\nprintf '1000\\n'\n",
    uname: `#!/bin/sh
case "$1" in
  -s) printf 'Linux\\n' ;;
  -m) printf 'x86_64\\n' ;;
esac
`,
  } as const;

  for (const [name, content] of Object.entries(commands)) {
    const path = join(fakeBin, name);
    writeFileSync(path, content);
    chmodSync(path, 0o755);
  }
});

afterEach(() => {
  if (sandbox && existsSync(sandbox)) rmSync(sandbox, { recursive: true, force: true });
});

function installWith(checksums: string): { readonly status: number | null; readonly stderr: string } {
  if (SHELL === null) return { status: 0, stderr: "" };
  const result = spawnSync(SHELL, [INSTALL_SH], {
    encoding: "utf8",
    env: {
      ...process.env,
      FAKE_ASSET: ASSET_CONTENT,
      FAKE_CHECKSUMS: checksums,
      HOME: sandbox,
      // INSTALL_FORCE_BINARY bypasses the smart-router (which would
      // otherwise make a real `npm install -g umactually` call against
      // the user's npm — that 404s because the package isn't
      // published yet, and would pollute stderr with npm's error
      // log on every test run). Unlike INSTALL_TEST_MODE=1, this
      // does NOT short-circuit to the stub-binary path; the script
      // continues into the real binary-download + checksum-verify
      // flow with our fake `curl` serving the test's checksums +
      // asset. This is what the test is exercising.
      INSTALL_FORCE_BINARY: "1",
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
      PATH: `${fakeBin}${delimiter}${process.env["PATH"] ?? ""}`,
    },
  });
  return { status: result.status, stderr: result.stderr };
}

describe.skipIf(!SHELL_AVAILABLE)("install.sh production checksum verification", () => {
  it("installs the temporary asset when its exact GNU checksum entry matches", () => {
    // Given
    const checksums = `${ASSET_HASH}  ${ASSET_NAME}\n`;

    // When
    const result = installWith(checksums);

    // Then
    expect(result.status).toBe(0);
    expect(readFileSync(installTarget, "utf8")).toBe(ASSET_CONTENT);
  });

  it.each([
    ["missing", `${ASSET_HASH}  umactually-darwin-x64\n`],
    ["malformed", `${ASSET_HASH} ${ASSET_NAME}\n`],
    ["mismatched", `${"0".repeat(64)}  ${ASSET_NAME}\n`],
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
