import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

type RunCli = (args: readonly string[], cwd: string) => Promise<{ readonly exitCode: number }>;

const ENV_KEYS_TO_CLEAR = [
  "UMACTUALLY_API_URL", "UMACTUALLY_API_KEY", "UMACTUALLY_MODEL",
  "UMACTUALLY_DRY_RUN", "UMACTUALLY_PROMPT_FILE", "UMACTUALLY_ADDITIONAL_PROMPT_FILE",
  "REVIEW_PROVIDER_URL", "REVIEW_PROVIDER_API_KEY", "REVIEW_PROVIDER_MODEL",
  "REVIEW_DRY_RUN", "REVIEW_PLATFORM",
  "GITHUB_ACTIONS", "TF_BUILD",
] as const;

describe("CLI bare-invocation", () => {
  let tmpdirPath = "";
  let savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv = {};
    for (const key of ENV_KEYS_TO_CLEAR) savedEnv[key] = process.env[key];
    for (const key of ENV_KEYS_TO_CLEAR) delete process.env[key];
    tmpdirPath = mkdtempSync(join(tmpdir(), "umactually-bare-"));
  });

  afterEach(() => {
    for (const key of ENV_KEYS_TO_CLEAR) delete process.env[key];
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (tmpdirPath.length > 0) rmSync(tmpdirPath, { recursive: true, force: true });
  });

  it("rejects bare invocation with the modes banner and exit code 2", async () => {
    // Capture stdout/stderr inline (no shared helper yet).
    const originalStdout = process.stdout.write.bind(process.stdout);
    const originalStderr = process.stderr.write.bind(process.stderr);
    let stdoutBuf = "";
    let stderrBuf = "";
    process.stdout.write = ((c: string | Uint8Array): boolean => {
      stdoutBuf += typeof c === "string" ? c : Buffer.from(c).toString("utf8");
      return true;
    }) as typeof process.stdout.write;
    process.stderr.write = ((c: string | Uint8Array): boolean => {
      stderrBuf += typeof c === "string" ? c : Buffer.from(c).toString("utf8");
      return true;
    }) as typeof process.stderr.write;
    let result: { readonly exitCode: number };
    try {
      const mod = await import("../../src/cli.js") as { readonly runCli?: RunCli };
      expect(typeof mod.runCli).toBe("function");
      result = await mod.runCli!([], tmpdirPath);
    } finally {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
    }

    expect(result!.exitCode).toBe(2);
    expect(stderrBuf).toContain("cli: --api-url is required");
    expect(stderrBuf).toContain("pick a mode:");
    expect(stderrBuf).toContain("Standalone mode");
    expect(stderrBuf).toContain("Live CI mode");
    expect(stderrBuf).toContain("Outside a git repo");
  });

  it("--dry-run passes validation, prints dry-run wrote, and suppresses the banner", async () => {
    const originalStdout = process.stdout.write.bind(process.stdout);
    const originalStderr = process.stderr.write.bind(process.stderr);
    let stdoutBuf = "";
    let stderrBuf = "";
    process.stdout.write = ((c: string | Uint8Array): boolean => {
      stdoutBuf += typeof c === "string" ? c : Buffer.from(c).toString("utf8");
      return true;
    }) as typeof process.stdout.write;
    process.stderr.write = ((c: string | Uint8Array): boolean => {
      stderrBuf += typeof c === "string" ? c : Buffer.from(c).toString("utf8");
      return true;
    }) as typeof process.stderr.write;
    let result: { readonly exitCode: number };
    try {
      const mod = await import("../../src/cli.js") as { readonly runCli?: RunCli };
      expect(typeof mod.runCli).toBe("function");
      result = await mod.runCli!(["--dry-run"], tmpdirPath);
    } finally {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
    }

    expect(result!.exitCode).toBe(0);
    expect(stdoutBuf).toContain("dry-run wrote");
    expect(stderrBuf).not.toContain("pick a mode:");
  });

  it("smoke: --api-url + --api-key in the real repo cwd fails with exit 1 (provider unreachable, not plumbing error)", async () => {
    // Use the real cwd: it IS a git repo, so standalone mode auto-derives diff/event.
    // localhost:1 is unreachable; standalone mode tries to call the provider
    // (that's the whole point of the standalone review — it tests the provider
    // call without any platform API). The CLI should fail with exit 1 from the
    // provider error, NOT from a wrapper-era plumbing-flag validation.
    // (Old wrapper-era behavior required --platform; that gate has been removed.)
    const cwd = process.cwd();
    const originalStdout = process.stdout.write.bind(process.stdout);
    const originalStderr = process.stderr.write.bind(process.stderr);
    let stdoutBuf = "";
    let stderrBuf = "";
    process.stdout.write = ((c: string | Uint8Array): boolean => {
      stdoutBuf += typeof c === "string" ? c : Buffer.from(c).toString("utf8");
      return true;
    }) as typeof process.stdout.write;
    process.stderr.write = ((c: string | Uint8Array): boolean => {
      stderrBuf += typeof c === "string" ? c : Buffer.from(c).toString("utf8");
      return true;
    }) as typeof process.stderr.write;
    let result: { readonly exitCode: number };
    try {
      const mod = await import("../../src/cli.js") as { readonly runCli?: RunCli };
      expect(typeof mod.runCli).toBe("function");
      result = await mod.runCli!(
        ["--api-url", "http://localhost:1", "--api-key", "test"],
        cwd,
      );
    } finally {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
    }

    expect(result!.exitCode).toBe(1);
    const combined = stdoutBuf + stderrBuf;
    // The error must be a provider fetch failure, NOT a wrapper-era
    // plumbing-flag validation error like "cli: --event is required".
    expect(combined).toMatch(/fetch failed|provider|connection/i);
    expect(combined).not.toMatch(/cli: --event is required/);
    expect(combined).not.toMatch(/cli: --diff is required/);
  });
});