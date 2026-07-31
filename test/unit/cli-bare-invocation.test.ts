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
    expect(stderrBuf).toContain("Pre-rendered diff");
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

  it("smoke: --api-url + --api-key in a non-git cwd writes a 'no diff' standalone artifact and exits 0", async () => {
    // Use a non-git cwd so the auto-context derivation has no diff to
    // find. The CLI then sees parsed.diffPath === null and writes the
    // "no diff" standalone artifact (mirrors the dry-run path) without
    // calling the provider. This is the right user experience for
    // `umactually review` invoked in a terminal: it should not crash
    // just because the cwd is not a git repo with uncommitted changes.
    //
    // (The OLD wrapper-era behavior was: always call the provider
    // even without a diff, and require --platform. The new behavior
    // is: standalone mode degrades gracefully. This test pins that
    // contract.)
    const { mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const cwd = mkdtempSync(`${tmpdir()}/umactually-bare-`);
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

    expect(result!.exitCode).toBe(0);
    const combined = stdoutBuf + stderrBuf;
    // The CLI writes a standalone artifact (the "no diff" fallback)
    // and does NOT mention wrapper-era plumbing flags.
    expect(combined).toMatch(/standalone review.*wrote/);
    expect(combined).not.toMatch(/cli: --event is required/);
    expect(combined).not.toMatch(/cli: --diff is required/);
  });
});