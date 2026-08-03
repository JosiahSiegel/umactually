import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Tests for the `umactually` first-run nudge (added in v0.6.24).
 *
 * Contract (pinned):
 *   - Bare `umactually` on a TTY with no `~/.umactually/config.json`
 *     prints `umactually: first run? Get started with: \`umactually init\``
 *     to STDERR BEFORE the existing review-branch validation.
 *   - Bare `umactually` non-TTY (piped, CI) prints nothing.
 *   - Bare `umactually` when a saved config already exists prints nothing.
 *   - Programmatic flag invocations (`--json`, `--no-color`, `--api-*`)
 *     skip the nudge — they're not "first run" signals.
 *
 * The nudge is additive: the existing CLI-SUB-005 back-compat invariant
 * (exit 2 + `--api-url is required` + `pick a mode:` banner) still holds.
 */

const dispatchModule = "../../src/cli/dispatch.js";
const dispatchPath = "src/cli/dispatch.ts";

type DispatchFn = (argv: readonly string[]) => Promise<{ readonly exitCode: number }>;

interface StdoutStderrCapture {
  readonly restore: () => void;
  readonly stdout: { readonly text: string };
  readonly stderr: { readonly text: string };
}

function captureStdoutStderr(): StdoutStderrCapture {
  const originalStdout = process.stdout.write.bind(process.stdout);
  const originalStderr = process.stderr.write.bind(process.stderr);
  const stdoutState = { text: "" };
  const stderrState = { text: "" };
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    stdoutState.text += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    stderrState.text += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }) as typeof process.stderr.write;
  return {
    stdout: stdoutState,
    stderr: stderrState,
    restore: () => {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
    },
  };
}

let savedEnv: Record<string, string | undefined> = {};
let savedIsTTY: boolean | undefined;
let tempHome: string | null = null;

function clearEnv(): void {
  for (const key of [
    "HOME",
    "USERPROFILE",
    "UMACTUALLY_API_URL",
    "UMACTUALLY_API_KEY",
    "UMACTUALLY_MODEL",
    "GITHUB_ACTIONS",
    "TF_BUILD",
  ]) {
    delete process.env[key];
  }
}

describe("CLI first-run nudge (v0.6.24)", () => {
  beforeEach(async () => {
    savedEnv = {};
    for (const key of [
      "HOME",
      "USERPROFILE",
      "UMACTUALLY_API_URL",
      "UMACTUALLY_API_KEY",
      "UMACTUALLY_MODEL",
      "GITHUB_ACTIONS",
      "TF_BUILD",
    ]) {
      savedEnv[key] = process.env[key];
    }
    clearEnv();
    savedIsTTY = process.stdout.isTTY;

    // Fresh temp HOME so ~/.umactually/config.json never exists unless
    // we explicitly write it for the "config-present" test.
    tempHome = mkdtempSync(join(tmpdir(), "umactually-nudge-"));
    process.env["HOME"] = tempHome;
    // Symmetric USERPROFILE for Windows branch — keep it null so the
    // dispatcher falls through to HOME.
  });

  afterEach(() => {
    clearEnv();
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    process.stdout.isTTY = savedIsTTY ?? false;
    if (tempHome !== null) {
      try {
        rmSync(tempHome, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup; the tmp dir is throwaway.
      }
      tempHome = null;
    }
  });

  async function loadDispatch(): Promise<DispatchFn> {
    const mod = (await import(dispatchModule)) as { dispatch?: DispatchFn };
    if (typeof mod.dispatch !== "function") {
      throw new Error(`${dispatchPath} must export dispatch(argv)`);
    }
    return mod.dispatch;
  }

  it("NUDGE-1: bare `umactually` on TTY with no saved config prints the nudge to stderr", async () => {
    process.stdout.isTTY = true;
    const dispatch = await loadDispatch();

    const capture = captureStdoutStderr();
    try {
      await dispatch([]);
    } finally {
      capture.restore();
    }

    expect(capture.stderr.text).toMatch(/first run\? Get started with: `umactually init`/u);
  });

  it("NUDGE-2: bare `umactually` with no TTY prints nothing (no CI noise)", async () => {
    process.stdout.isTTY = false;
    const dispatch = await loadDispatch();

    const capture = captureStdoutStderr();
    try {
      await dispatch([]);
    } finally {
      capture.restore();
    }

    expect(capture.stderr.text).not.toMatch(/first run\? Get started with/u);
  });

  it("NUDGE-3: bare `umactually` when a saved config exists prints nothing", async () => {
    process.stdout.isTTY = true;
    // Pretend the operator already ran `umactually init` previously.
    if (tempHome !== null) {
      mkdirSync(join(tempHome, ".umactually"), { recursive: true });
      writeFileSync(
        join(tempHome, ".umactually", "config.json"),
        JSON.stringify({ schemaVersion: 1, provider: "openai-compatible" }),
      );
    }
    const dispatch = await loadDispatch();

    const capture = captureStdoutStderr();
    try {
      await dispatch([]);
    } finally {
      capture.restore();
    }

    expect(capture.stderr.text).not.toMatch(/first run\? Get started with/u);
  });

  it("NUDGE-4: programmatic flags skip the nudge (--json / --no-color / --api-*)", async () => {
    process.stdout.isTTY = true;
    const dispatch = await loadDispatch();

    for (const flag of ["--json", "--no-color", "--api-url", "--api-key", "--model"]) {
      const capture = captureStdoutStderr();
      try {
        await dispatch([flag]);
      } finally {
        capture.restore();
      }
      expect(capture.stderr.text).not.toMatch(/first run\? Get started with/u);
    }
  });

  it("NUDGE-5: nudge is additive — does NOT replace the existing back-compat UX", async () => {
    // Regression guard: adding the nudge must not break CLI-SUB-005
    // (exit 2 + `cli: --api-url is required` + `pick a mode:` banner).
    process.stdout.isTTY = true;
    const dispatch = await loadDispatch();

    const capture = captureStdoutStderr();
    let result: { readonly exitCode: number };
    try {
      result = await dispatch([]);
    } finally {
      capture.restore();
    }

    // Existing back-compat contract.
    expect(result.exitCode).toBe(2);
    expect(capture.stderr.text).toContain("cli: --api-url is required");
    expect(capture.stderr.text).toContain("pick a mode:");
    // AND the new nudge.
    expect(capture.stderr.text).toMatch(/first run\? Get started with: `umactually init`/u);
  });
});