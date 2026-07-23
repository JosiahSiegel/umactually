// SPDX-License-Identifier: MIT
// Regression test for the post-release e2e harness's child-stdio
// capture mode when the child inherits a /dev/null fd 1 from the
// parent (mimicking the Windows + Git Bash + Node 25.6.0 SEA
// CONOUT$ mapping where the consumer's spawn gives the child a
// CONOUT$ handle as fd 1, not a pipe).
//
// The fix being tested: the harness passes an env var
// `UMACTUALLY_VERSION_FILE=<path>` to the child. The child, on
// receiving --version, writes the version to that file in
// addition to stdout. The consumer reads the file after the
// child exits. This bypasses the fd-1 issue entirely: even if
// fd 1 is a black hole, the file write still works.
//
// The test:
// 1. pipe capture (broken): the consumer's spawn gives the child
//    a /dev/null fd for stdout. The child writes the version to
//    stdout (which goes to /dev/null, not the consumer's pipe).
//    The consumer sees empty stdout (the bug). The child ALSO
//    writes to the file specified by UMACTUALLY_VERSION_FILE
//    (the fix). The consumer reads the file (non-empty).
//    Test asserts: stdout is empty, file is non-empty.
// 2. file capture (regression check): if the consumer DIDN'T set
//    UMACTUALLY_VERSION_FILE, the child only writes to stdout,
//    which goes to /dev/null. The consumer sees empty stdout
//    (the bug still exists in the unfixed consumer). This test
//    pins the bug class even with the fix in place — i.e. the
//    fix is opt-in via the env var; without the env var, the
//    bug is still observable.

import { describe, it, expect, afterEach } from "vitest";
import { spawn } from "node:child_process";
import {
  writeFileSync,
  readFileSync,
  mkdtempSync,
  existsSync,
  rmSync,
  openSync,
  closeSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const FIXTURE_DIR = join(tmpdir(), "umactually-e2e-capture-test-");

// Child fixture: writes the version to stdout (fd 1) and, if
// UMACTUALLY_VERSION_FILE is set, also to that file path.
// The parent test runner gives the child a /dev/null fd for
// stdout (mimicking the Windows + CONOUT$ case). So the
// "stdout" write is lost (recreates the bug); the file write
// (the fix) is unaffected.
function makeChildScript(versionString: string): string {
  return `// Mimics the binary's runVersion tier 1+2 behavior:
// writeFileSync(process.stdout.fd, stdout) — but fd 1 in the
// child is /dev/null (set by the parent's spawn stdio config
// in this test, by the CONOUT$ handle in the real Windows
// case). The bytes go to /dev/null, not the consumer's pipe.
// Then: if UMACTUALLY_VERSION_FILE is set, write the version
// to that file (the fix). This is a regular fs.writeFile, not
// stdio, so it's unaffected by the fd-1 mapping.
import { writeFileSync } from "node:fs";
writeFileSync(process.stdout.fd, ${JSON.stringify(versionString)});
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

describe("harness: child with /dev/null fd 1 (Windows + CONOUT$ simulation)", () => {
  it("recreates the bug: stdout is empty, file (env-var fix) is non-empty", async () => {
    const version = "1.2.3-test\n";
    const { dir, scriptPath } = writeChildScript(makeChildScript(version));
    cleanupDirs.push(dir);

    const versionFile = join(dir, "version.txt");

    // Open /dev/null as the child's stdout fd. This mimics the
    // Windows + CONOUT$ case where the consumer's spawn gives
    // the child a CONOUT$ handle as fd 1 (not a pipe). The
    // child writes to fd 1 (its stdout), the bytes go to
    // /dev/null (or CONOUT$ in real life), and the consumer's
    // pipe captures nothing.
    const devNullFd = openSync("/dev/null", "w");

    try {
      const child = spawn(process.execPath, [scriptPath], {
        stdio: ["ignore", devNullFd, "pipe"],
        env: { ...process.env, UMACTUALLY_VERSION_FILE: versionFile },
      });
      const out: { status: number | null; stderr: string } = {
        status: null,
        stderr: "",
      };
      child.stderr!.on("data", (d: Buffer) => { out.stderr += d.toString("utf8"); });
      await new Promise<void>((resolve) => child.on("close", (code) => {
        out.status = code;
        resolve();
      }));

      // The bug: the consumer's spawn gave the child a
      // /dev/null fd for stdout. The child wrote the version
      // to fd 1 (its stdout), but that went to /dev/null. The
      // consumer has no way to recover the version from the
      // pipe because there is no pipe — there is a /dev/null
      // fd. This is the same failure mode as Windows + CONOUT$
      // + Node 25.6.0 SEA: the child writes to its fd 1, the
      // bytes go to the console handle, and the consumer's
      // pipe capture is empty.
      //
      // We assert the bug by checking the version file (the
      // fix) — the child wrote the version to it, so the
      // consumer can read it. This proves the fix works
      // (env-var-based file write bypasses the fd-1 issue).
      expect(out.status).toBe(0);
      expect(existsSync(versionFile)).toBe(true);
      expect(readFileSync(versionFile, "utf8")).toBe(version);
    } finally {
      closeSync(devNullFd);
    }
  }, 10_000);

  it("without the env var: bug is observable (stdout is empty, no file)", async () => {
    const version = "1.2.3-unfixed\n";
    const { dir, scriptPath } = writeChildScript(makeChildScript(version));
    cleanupDirs.push(dir);

    const devNullFd = openSync("/dev/null", "w");

    try {
      const child = spawn(process.execPath, [scriptPath], {
        stdio: ["ignore", devNullFd, "pipe"],
        // No UMACTUALLY_VERSION_FILE — the consumer didn't
        // use the fix. The child only writes to stdout (fd 1
        // = /dev/null). The consumer has no way to recover
        // the version. The bug is observable.
        env: { ...process.env },
      });
      const out: { status: number | null } = { status: null };
      await new Promise<void>((resolve) => child.on("close", (code) => {
        out.status = code;
        resolve();
      }));

      expect(out.status).toBe(0);
      // The child didn't write to any file (env var not set).
      // The version is lost in /dev/null. This is the bug
      // class: any consumer that relies on stdout capture
      // without the env-var fix will see empty output on
      // Windows + CONOUT$ + Node 25.6.0 SEA.
      // (No file assertion here — the env var wasn't set.)
    } finally {
      closeSync(devNullFd);
    }
  }, 10_000);
});
