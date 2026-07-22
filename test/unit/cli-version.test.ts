import { existsSync, readFileSync } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { main } from "../../src/cli.js";

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { readonly version: unknown };
const packageVersion = String(packageJson.version);
const autoContextDirectory = join(process.cwd(), ".umactually-auto-ctx");

// runVersion under SEA uses fs.writeFileSync(process.stdout.fd, stdout)
// as the canonical synchronous write; the catch-block fallback is
// process.stdout.write. The test must intercept BOTH write paths.
//
// We use vi.mock("node:fs") with a partial mock: passThrough() so the
// real implementations of other fs functions (readFileSync for the
// package.json read at module top, existsSync, etc.) are kept, and
// only writeFileSync is overridden. vi.mock is hoisted by vitest above
// the imports so the override takes effect when src/cli.ts evaluates
// its `import { writeFileSync }` binding.
vi.mock("node:fs", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("node:fs");
  return {
    ...actual,
    writeFileSync: (
      _fd: number | FileHandle,
      data: string | Uint8Array,
      _opts?: Parameters<typeof actual.writeFileSync>[2],
    ): void => {
      (globalThis as Record<string, unknown>)["__cliVersionTestStdout"] = String(
        ((globalThis as Record<string, unknown>)["__cliVersionTestStdout"] as string | undefined) ?? "",
      ) + String(data);
    },
  };
});

async function captureMain(args: readonly string[]): Promise<{
  readonly result: number;
  readonly stdout: string;
  readonly stderr: string;
}> {
  let stdout = "";
  let stderr = "";
  (globalThis as Record<string, unknown>)["__cliVersionTestStdout"] = "";
  vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    stdout += String(chunk);
    return true;
  });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    stderr += String(chunk);
    return true;
  });

  try {
    const result = await main(args);
    stdout = String(
      ((globalThis as Record<string, unknown>)["__cliVersionTestStdout"] as string | undefined) ?? "",
    ) + stdout;
    return { result, stdout, stderr };
  } finally {
    vi.restoreAllMocks();
  }
}

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(autoContextDirectory, { recursive: true, force: true });
});

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
});
