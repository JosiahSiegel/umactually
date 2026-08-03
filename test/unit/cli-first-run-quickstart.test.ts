import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Tests for the bare-`umactually` first-run compact quickstart
 * (added in v0.6.24).
 *
 * Contract (pinned):
 *   - Bare `umactually` on a TTY with no `~/.umactually/config.json`
 *     and no programmatic flags REPLACES the loud
 *     `cli: --api-url is required` + `pick a mode:` banner with a
 *     compact quickstart that leads with `umactually init`. Exits 0.
 *   - Bare `umactually` non-TTY (piped, CI) keeps the loud banner
 *     — no quickstart in CI (no TTY noise / no JSON-parser pollution).
 *   - Bare `umactually` when a saved config already exists keeps the
 *     loud banner (operator has set up; they want validation feedback).
 *   - Programmatic flag invocations (`--json`, `--no-color`, `--api-*`,
 *     `--model`, `--platform`) keep the loud banner — not first run.
 *
 * Back-compat regression guards (CLI-SUB-005, CLI-SYMBIOTIC-2):
 *   - `test/unit/cli-subcommands.test.ts:CLI-SUB-005` runs dispatch([])
 *     under vitest (non-TTY), so the loud banner STILL fires there.
 *   - `test/unit/cli-bare-invocation.test.ts` calls `runCli` directly
 *     (the path the loud banner lives in), unaffected by the dispatch
 *     quickstart branch.
 *
 * Industry-standard reference: matches `rustup`, `fnm`, `volta`,
 * `nvm`, `pip`, `brew install` first-run output. Single screen,
 * leads with the wizard, no `--dry-run` clutter, exit 0.
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

const ENV_KEYS_TO_CLEAR = [
  "HOME",
  "USERPROFILE",
  "UMACTUALLY_API_URL",
  "UMACTUALLY_API_KEY",
  "UMACTUALLY_MODEL",
  "GITHUB_ACTIONS",
  "TF_BUILD",
] as const;

let savedEnv: Record<string, string | undefined> = {};
let savedIsTTY: boolean | undefined;
let tempHome: string | null = null;

function clearEnv(): void {
  for (const key of ENV_KEYS_TO_CLEAR) {
    delete process.env[key];
  }
}

describe("CLI first-run compact quickstart (v0.6.24)", () => {
  beforeEach(() => {
    savedEnv = {};
    for (const key of ENV_KEYS_TO_CLEAR) {
      savedEnv[key] = process.env[key];
    }
    clearEnv();
    savedIsTTY = process.stdout.isTTY;

    // Fresh temp HOME so ~/.umactually/config.json never exists unless
    // we explicitly write it for the "config-present" test.
    tempHome = mkdtempSync(join(tmpdir(), "umactually-quickstart-"));
    process.env["HOME"] = tempHome;
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

  it("QUICK-1: bare `umactually` on TTY + no saved config + no flags → compact quickstart, exit 0", async () => {
    process.stdout.isTTY = true;
    const dispatch = await loadDispatch();

    const capture = captureStdoutStderr();
    let result: { readonly exitCode: number };
    try {
      result = await dispatch([]);
    } finally {
      capture.restore();
    }

    // Exit 0 — first run is not an error.
    expect(result.exitCode).toBe(0);
    // The quickstart leads with the wizard (most important action).
    const out = capture.stdout.text;
    expect(out).toContain("umactually init");
    // And summarizes the three review commands compactly.
    expect(out).toMatch(/umactually review/);
    expect(out).toMatch(/--files/);
    expect(out).toMatch(/umactually doctor/);
    // Points at --help for the full reference.
    expect(out).toContain("umactually --help");
    // The NOISY banner does NOT fire for first-time users.
    expect(capture.stderr.text).not.toContain("cli: --api-url is required");
    expect(capture.stderr.text).not.toContain("pick a mode:");
  });

  it("QUICK-2: bare `umactually` non-TTY (CI) keeps the loud banner — no quickstart", async () => {
    process.stdout.isTTY = false;
    const dispatch = await loadDispatch();

    const capture = captureStdoutStderr();
    try {
      await dispatch([]);
    } finally {
      capture.restore();
    }

    // No quickstart in CI.
    expect(capture.stdout.text).not.toContain("umactually init\n");
    expect(capture.stdout.text).not.toMatch(/Welcome to umactually/);
    // The loud banner DOES fire (preserves CLI-SUB-005 contract).
    expect(capture.stderr.text).toContain("cli: --api-url is required");
    expect(capture.stderr.text).toContain("pick a mode:");
  });

  it("QUICK-3: bare `umactually` when a saved config exists keeps the loud banner", async () => {
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

    // No quickstart — operator already set up.
    expect(capture.stdout.text).not.toMatch(/Welcome to umactually/);
    // The loud banner fires — operator gets validation feedback.
    expect(capture.stderr.text).toContain("cli: --api-url is required");
    expect(capture.stderr.text).toContain("pick a mode:");
  });

  it("QUICK-4: programmatic flags keep the loud banner (--json / --no-color / --api-* / --model / --platform)", async () => {
    process.stdout.isTTY = true;
    const dispatch = await loadDispatch();

    for (const flag of ["--json", "--no-color", "--api-url", "--api-key", "--model", "--platform", "github"]) {
      const capture = captureStdoutStderr();
      try {
        await dispatch([flag]);
      } finally {
        capture.restore();
      }
      expect(capture.stdout.text).not.toMatch(/Welcome to umactually/);
      // Note: --json triggers different output; we only assert no quickstart.
    }
  });

  it("QUICK-5: quickstart uses brand prefix and ends with a trailing newline", async () => {
    process.stdout.isTTY = true;
    const dispatch = await loadDispatch();

    const capture = captureStdoutStderr();
    try {
      await dispatch([]);
    } finally {
      capture.restore();
    }

    // Brand prefix on the first line.
    expect(capture.stdout.text.startsWith("umactually: ")).toBe(true);
    // Trailing newline so the shell prompt doesn't glue to the output.
    expect(capture.stdout.text.endsWith("\n")).toBe(true);
  });
});