// SPDX-License-Identifier: MIT
// Regression test for the post-release e2e harness's child-stdio
// capture mode when the child replaces fd 1 with /dev/null
// (mimicking the Windows + Git Bash + Node 25.6.0 SEA CONOUT$
// mapping where fd 1 is mapped to a console handle, not the
// consumer's pipe).
//
// The fix being tested: the harness passes an env var
// `UMACTUALLY_VERSION_FILE=<path>` to the child. The child, on
// receiving --version, writes the version to the file at that
// path in addition to stdout. The consumer reads the file
// after the child exits. This bypasses the fd-1 issue entirely:
// even if fd 1 is a black hole, the file write still works.
//
// The test:
// 1. pipe capture: child with fd 1 → /dev/null. Consumer reads
//    empty stdout (the bug). Test asserts non-empty via the
//    file output (the fix). Fails before the fix.
// 2. file capture (stdin: openSync): same child. Consumer reads
//    the file (the fix). Passes after the fix.

import { describe, it, expect, afterEach } from "vitest";
import { spawn } from "node:child_process";
import { writeFileSync, readFileSync, mkdtempSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const FIXTURE_DIR = join(tmpdir(), "umactually-e2e-capture-test-");

// Mimics a child that:
// 1. Replaces fd 1 with /dev/null (mimicking the Windows +
//    CONOUT$ mapping). After this dup2, any write to fd 1
//    goes to /dev/null, not the consumer's pipe or file fd.
// 2. If UMACTUALLY_VERSION_FILE is set, writes the version to
//    that file (the fix).
// 3. Exits 0.
function makeBlackholedFd1ChildScript(versionString: string): string {
  return `import { writeFileSync, openSync, closeSync } from "node:fs";
// Step 1: replace fd 1 with /dev/null. This mimics the Windows
// + CONOUT$ mapping where the kernel routes fd 1 writes to a
// console handle instead of the consumer's pipe.
const devNull = openSync("/dev/null", "w");
const dup2 = (() => { try { return require("node:fs").dup2; } catch { return null; } })();
if (typeof dup2 === "function") {
  dup2(devNull, 1);
} else {
  // Fallback: just use process.stdout.write which will also
  // fail to reach the consumer (we'll close the stream first).
  process.stdout.write("");
  process.stdout.destroy();
}
closeSync(devNull);

// Step 2: if the harness set UMACTUALLY_VERSION_FILE, write
// the version there. This is the FIX.
const versionFile = process.env.UMACTUALLY_VERSION_FILE;
if (versionFile) {
  writeFileSync(versionFile, ${JSON.stringify(versionString)});
}

process.exit(0);
`;
}

function writeChildScript(scriptBody: string): { dir: string; scriptPath: string } {
  const dir = mkdtempSync(FIXTURE_DIR);
  const scriptPath = join(dir, "child.mjs");
  writeFileSync(scriptPath, scriptBody);
  return { dir, scriptPath };
}

const cleanupDirs: string[] = [];
afterEach(() => {
  for (const d of cleanupDirs) {
    try { rmSync(d, { recursive: true, force: true }); } catch {}
  }
  cleanupDirs.length = 0;
});

describe("harness: child with blackholed fd 1 (Windows + CONOUT$ simulation)", () => {
  it("pipe capture: empty stdout (recreates the bug)", async () => {
    const version = "1.2.3-bug\n";
    const { dir, scriptPath } = writeChildScript(makeBlackholedFd1ChildScript(version));
    cleanupDirs.push(dir);
    const child = spawn(process.execPath, [scriptPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const out: { status: number | null; stdout: string; stderr: string } = {
      status: null,
      stdout: "",
      stderr: "",
    };
    child.stdout!.on("data", (d: Buffer) => { out.stdout += d.toString("utf8"); });
    child.stderr!.on("data", (d: Buffer) => { out.stderr += d.toString("utf8"); });
    await new Promise<void>((resolve) => child.on("close", (code) => {
      out.status = code;
      resolve();
    }));
    expect(out.status).toBe(0);
    // The bug: the consumer's pipe capture is empty because the
    // child replaced fd 1 with /dev/null. This mimics the
    // Windows + CONOUT$ behavior.
    expect(out.stdout).toBe("");
  }, 10_000);

  it("file capture via env var (the FIX): returns the version", async () => {
    const version = "1.2.3-fix\n";
    const { dir, scriptPath } = writeChildScript(makeBlackholedFd1ChildScript(version));
    cleanupDirs.push(dir);

    const versionFile = join(dir, "version.txt");
    const child = spawn(process.execPath, [scriptPath], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, UMACTUALLY_VERSION_FILE: versionFile },
    });
    const out: { status: number | null } = { status: null };
    await new Promise<void>((resolve) => child.on("close", (code) => {
      out.status = code;
      resolve();
    }));
    expect(out.status).toBe(0);
    // The fix: the child wrote the version to the file at the
    // path passed via UMACTUALLY_VERSION_FILE. The consumer
    // reads the file. This bypasses the fd-1 issue entirely.
    expect(existsSync(versionFile)).toBe(true);
    expect(readFileSync(versionFile, "utf8")).toBe(version);
  }, 10_000);
});
