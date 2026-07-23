import { existsSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { readonly version: unknown };
const packageVersion = String(packageJson.version);
const autoContextDirectory = join(process.cwd(), ".umactually-auto-ctx");

// Per-test stdout buffer. `runVersion` writes the version string here
// via `writeFileSync(process.stdout.fd, ...)`; the test reads it back
// to assert behaviour.
let writeFileBuffer = "";

let mainFn: typeof import("../../src/cli.js")["main"];

beforeEach(async () => {
  writeFileBuffer = "";
  // Mock the fs module for each test so the source's destructured
  // `writeFileSync` binding picks up our interceptor. vi.doMock is
  // hoisted to the top of the file by vitest's transformer, but the
  // dynamic import after vi.resetModules ensures the cli module is
  // reloaded against the mocked fs.
  vi.doMock("node:fs", async () => {
    const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
    return {
      ...actual,
      writeFileSync: ((
        fd: number | import("node:fs/promises").FileHandle,
        data: string | NodeJS.ArrayBufferView,
        ...rest: unknown[]
      ): void => {
        if (fd === process.stdout.fd) {
          writeFileBuffer += typeof data === "string" ? data : data.toString();
          return;
        }
        return actual.writeFileSync(fd as never, data as never, ...(rest as []));
      }) as typeof actual.writeFileSync,
    };
  });
  vi.resetModules();
  ({ main: mainFn } = await import("../../src/cli.js"));
});

afterEach(async () => {
  writeFileBuffer = "";
  vi.doUnmock("node:fs");
  vi.resetModules();
  await rm(autoContextDirectory, { recursive: true, force: true });
});

async function captureMain(args: readonly string[]): Promise<{
  readonly result: number;
  readonly stdout: string;
  readonly stderr: string;
}> {
  let stderr = "";
  const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    stderr += String(chunk);
    return true;
  });

  try {
    const result = await mainFn(args);
    return { result, stdout: writeFileBuffer, stderr };
  } finally {
    stderrSpy.mockRestore();
  }
}

describe("CLI version handler (M2)", () => {
  it("CLI-VERSION-001: --version exits 0 with version on stdout", async () => {
    const { result, stdout } = await captureMain(["--version"]);

    expect({ exitCode: result }).toEqual({ exitCode: 0 });
    expect(stdout).toBe(`${packageVersion}\n`);
  });

  it("CLI-VERSION-002: -V exits 0 with version on stdout", async () => {
    const { result, stdout } = await captureMain(["-V"]);

    expect({ exitCode: result }).toEqual({ exitCode: 0 });
    expect(stdout).toBe(`${packageVersion}\n`);
  });

  it("CLI-VERSION-003: stdout buffer equals package.json version exactly", async () => {
    const { stdout } = await captureMain(["--version"]);

    expect(String(stdout.trim())).toBe(String(packageJson.version));
  });

  it("writes nothing to stderr for --version", async () => {
    const { stderr } = await captureMain(["--version"]);

    expect(stderr).toBe("");
  });

  it("does not create .umactually-auto-ctx for --version", async () => {
    await rm(autoContextDirectory, { recursive: true, force: true });

    const { stdout } = await captureMain(["--version"]);

    expect(stdout).toBe(`${packageVersion}\n`);
    expect(existsSync(autoContextDirectory)).toBe(false);
  });

  it("falls back to process.stdout.write when writeFileSync AND writeSync throw EBADF (no kernel fd for stdout)", async () => {
    // v0.6.5: runVersion cascades through three tiers. We mock
    // tier 1 (writeFileSync) and tier 2 (writeSync on fd 1) to both
    // throw EBADF, so the cascade reaches tier 3 (process.stdout.write).
    // The spy on process.stdout.write captures the version bytes.
    let fallbackBuffer = "";
    const stdoutSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk) => {
        fallbackBuffer += String(chunk);
        return true;
      });
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      const ebadf = (): void => {
        const err = new Error("bad file descriptor") as NodeJS.ErrnoException;
        err.code = "EBADF";
        throw err;
      };
      return {
        ...actual,
        writeFileSync: ((
          _fd: number | import("node:fs/promises").FileHandle,
          _data: string | NodeJS.ArrayBufferView,
          ..._rest: unknown[]
        ): void => {
          ebadf();
        }) as typeof actual.writeFileSync,
        writeSync: ((
          _fd: number,
          _data: string | NodeJS.ArrayBufferView,
          ..._rest: unknown[]
        ): number => {
          ebadf();
          return 0;
        }) as typeof actual.writeSync,
      };
    });
    vi.resetModules();
    let localMain: typeof import("../../src/cli.js")["main"];
    ({ main: localMain } = await import("../../src/cli.js"));
    try {
      const result = await localMain(["--version"]);
      expect(result).toBe(0);
      expect(fallbackBuffer).toBe(`${packageVersion}\n`);
    } finally {
      stdoutSpy.mockRestore();
      vi.doUnmock("node:fs");
      vi.resetModules();
    }
  });
});
