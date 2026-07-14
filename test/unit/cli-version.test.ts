import { existsSync, readFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { main } from "../../src/cli.js";

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { readonly version: unknown };
const packageVersion = String(packageJson.version);
const autoContextDirectory = join(process.cwd(), ".umactually-auto-ctx");

async function captureMain(args: readonly string[]): Promise<{
  readonly result: number;
  readonly stdout: string;
  readonly stderr: string;
}> {
  let stdout = "";
  let stderr = "";
  const stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
    stdout += String(chunk);
    return true;
  });
  const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    stderr += String(chunk);
    return true;
  });

  try {
    const result = await main(args);
    return { result, stdout, stderr };
  } finally {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
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
    expect(stdout).toBe("0.1.0\n");
  });

  it("CLI-VERSION-002: -V exits 0 with version on stdout", async () => {
    const { result, stdout } = await captureMain(["-V"]);

    expect({ exitCode: result }).toEqual({ exitCode: 0 });
    expect(stdout).toBe("0.1.0\n");
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
