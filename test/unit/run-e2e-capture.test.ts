// SPDX-License-Identifier: MIT
// Regression test for the post-release e2e harness's child-stdio
// capture mode on Windows + Git Bash + Node 25.6.0 SEA.
//
// The bug: on Windows + Git Bash + Node 25.6.0 SEA binaries, the
// child process's fd 1 is mapped to a CONOUT$ handle. When the
// child writes via writeFileSync(process.stdout.fd, ...) (the
// SEA binary's runVersion tier 1 path), the writeFileSync
// succeeds (no throw) but the bytes go to the console buffer,
// not the consumer's pipe. The consumer's spawn with
// stdio: "pipe" sees empty stdout.
//
// The fix: give the child a real FILE fd for stdout via
// openSync(file, "w"). The child's writeFileSync(fd 1, ...) and
// writeSync(1, ...) then write to the file. The consumer reads
// the file after the child exits.
//
// We cannot reproduce the Windows + CONOUT$ mapping on Linux.
// But we can verify that the FIX (file capture) works correctly
// when the child writes via the fd-1 path. The bug case is
// that pipe capture CAN fail on Windows; the fix case is that
// file capture CANNOT fail on any platform (the file fd is a
// real file, not a console handle).
//
// The test below also covers the stream-write path
// (process.stdout.write) for both capture modes, to document
// that the stream path works with pipe capture on every
// platform (this is the path the existing run-e2e.mjs uses
// for runProviderCheck via the brand-prefixed summary).

import { describe, it, expect, afterEach } from "vitest";
import { spawn } from "node:child_process";
import { writeFileSync, openSync, closeSync, readFileSync, mkdtempSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const FIXTURE_DIR = join(tmpdir(), "umactually-e2e-capture-test-");

function makeFd1WriterChildScript(versionString: string): string {
  return `import { writeFileSync } from "node:fs";
process.stdout.write(""); // touch the stream to ensure init
writeFileSync(process.stdout.fd, ${JSON.stringify(versionString)});
process.exit(0);
`;
}

function makeStdoutStreamWriterChildScript(versionString: string): string {
  return `process.stdout.write(${JSON.stringify(versionString)});
process.exit(0);
`;
}

function writeChildScript(scriptBody: string): { dir: string; scriptPath: string } {
  const dir = mkdtempSync(FIXTURE_DIR);
  const scriptPath = join(dir, "child.mjs");
  writeFileSync(scriptPath, scriptBody);
  return { dir, scriptPath };
}

function spawnWithPipeCapture(scriptPath: string): Promise<{ status: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
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
    child.on("close", (code) => {
      out.status = code;
      resolve(out);
    });
  });
}

function spawnWithFileCapture(scriptPath: string): Promise<{ status: number | null; stdout: string; stderr: string }> {
  const dir = mkdtempSync(FIXTURE_DIR);
  const stdoutFile = join(dir, "stdout.txt");
  const stderrFile = join(dir, "stderr.txt");
  const stdoutFd = openSync(stdoutFile, "w");
  const stderrFd = openSync(stderrFile, "w");
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      stdio: ["ignore", stdoutFd, stderrFd],
    });
    let out: { status: number | null; stdout: string; stderr: string } = {
      status: null,
      stdout: "",
      stderr: "",
    };
    child.on("close", (code) => {
      closeSync(stdoutFd);
      closeSync(stderrFd);
      out = {
        status: code,
        stdout: existsSync(stdoutFile) ? readFileSync(stdoutFile, "utf8") : "",
        stderr: existsSync(stderrFile) ? readFileSync(stderrFile, "utf8") : "",
      };
      resolve(out);
    });
  });
}

const cleanupDirs: string[] = [];
afterEach(() => {
  for (const d of cleanupDirs) {
    try { rmSync(d, { recursive: true, force: true }); } catch {}
  }
  cleanupDirs.length = 0;
});

describe("harness child-stdio capture modes", () => {
  // Stream path: process.stdout.write.
  // Both capture modes work on every platform (the stream is
  // backed by the pipe fd or the file fd correctly). This
  // documents that the existing harness (pipe capture) works
  // for stream writes.
  it("pipe capture: stream path returns the bytes", async () => {
    const version = "1.2.3-stream\n";
    const { dir, scriptPath } = writeChildScript(makeStdoutStreamWriterChildScript(version));
    cleanupDirs.push(dir);
    const out = await spawnWithPipeCapture(scriptPath);
    expect(out.status).toBe(0);
    expect(out.stdout).toBe(version);
  }, 10_000);

  it("file capture: stream path returns the bytes", async () => {
    const version = "1.2.3-stream\n";
    const { dir, scriptPath } = writeChildScript(makeStdoutStreamWriterChildScript(version));
    cleanupDirs.push(dir);
    const out = await spawnWithFileCapture(scriptPath);
    expect(out.status).toBe(0);
    expect(out.stdout).toBe(version);
  }, 10_000);

  // FD-1 path: writeFileSync(process.stdout.fd, ...).
  // This is the SEA binary's runVersion tier 1 path. On
  // Windows + Git Bash + Node 25.6.0 SEA, fd 1 is mapped to
  // CONOUT$ and the bytes don't reach the consumer's pipe.
  // On every other platform, fd 1 IS the pipe and the bytes
  // reach the consumer.
  //
  // We can't reproduce the Windows + CONOUT$ mapping on Linux,
  // so the pipe-capture assertion below is "platform-dependent
  // success". The file-capture assertion is the FIX and works
  // on every platform.
  it("pipe capture: fd-1 path works on non-Windows (platform-dependent)", async () => {
    const version = "1.2.3-fd1\n";
    const { dir, scriptPath } = writeChildScript(makeFd1WriterChildScript(version));
    cleanupDirs.push(dir);
    const out = await spawnWithPipeCapture(scriptPath);
    expect(out.status).toBe(0);
    // On non-Windows platforms (where this test runs), the
    // pipe capture works for the fd-1 path. On Windows +
    // Git Bash + Node 25.6.0 SEA, the consumer reads empty
    // stdout. The test asserts the non-Windows case (where
    // the test runner is).
    expect(out.stdout).toBe(version);
  }, 10_000);

  it("file capture: fd-1 path returns the bytes (the FIX)", async () => {
    // This is the contract the fix must satisfy: the harness
    // uses file capture so that writeFileSync(fd 1, ...) (the
    // SEA binary's runVersion tier 1 path) lands the bytes in
    // a file the consumer can read. This must work on every
    // platform, including Windows + Git Bash + Node 25.6.0
    // SEA.
    const version = "1.2.3-fd1\n";
    const { dir, scriptPath } = writeChildScript(makeFd1WriterChildScript(version));
    cleanupDirs.push(dir);
    const out = await spawnWithFileCapture(scriptPath);
    expect(out.status).toBe(0);
    expect(out.stdout).toBe(version);
  }, 10_000);
});
