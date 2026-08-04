// SPDX-License-Identifier: MIT
// Unit tests for the top-level `umactually --show-config` (v0.6.26).
//
// Contract (pinned):
//   - `--show-config` with a saved config present: renders the config
//     field-by-field (path, provider, apiUrl?, model?) on stdout and
//     exits 0.
//   - `--show-config` with no saved config: prints a "no saved config"
//     pointer line and exits 0.
//   - `--show-config` with a malformed config file: writes the warning
//     to stderr and exits 1.
//   - `--show-config` is its own dispatch arm — it bypasses the
//     `isQuickstartEligible` gate, so it works in CI / non-TTY without
//     triggering the loud banner.
//
// S6 contract (v0.6.23): the renderer is field-by-field (not
// JSON.stringify), so any future secret field added to `SavedConfig`
// is automatically protected — it can't leak through `--show-config`
// unless a maintainer also explicitly renders it here.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dispatchModule = "../../src/cli/dispatch.js";

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
  "GITHUB_ACTIONS",
  "TF_BUILD",
  "BUILDKITE",
  "CIRCLECI",
  "JENKINS_URL",
] as const;

let savedEnv: Record<string, string | undefined> = {};
let tempHome: string | null = null;

function clearEnv(): void {
  for (const key of ENV_KEYS_TO_CLEAR) {
    delete process.env[key];
  }
}

describe("CLI --show-config (v0.6.26)", () => {
  beforeEach(() => {
    savedEnv = {};
    for (const key of ENV_KEYS_TO_CLEAR) {
      savedEnv[key] = process.env[key];
    }
    clearEnv();
    // `--show-config` is path-deterministic; HOME is what determines
    // whether we find a saved file. CWD is left at the test runner's
    // cwd (which has no `umactually.config.json` in it), so the loader
    // will walk the global path next.
    tempHome = mkdtempSync(join(tmpdir(), "umactually-show-config-"));
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
    if (tempHome !== null) {
      rmSync(tempHome, { recursive: true, force: true });
      tempHome = null;
    }
  });

  it("CLI-SHOW-1: with valid config — renders field-by-field + exits 0", async () => {
    mkdirSync(join(tempHome!, ".umactually"), { recursive: true });
    writeFileSync(
      join(tempHome!, ".umactually", "config.json"),
      JSON.stringify({
        schemaVersion: 1,
        provider: "openai-compatible",
        apiUrl: "https://api.example.com/v1",
        model: "gpt-5-mini",
      }),
    );

    const { dispatch } = await import(dispatchModule);
    const capture = captureStdoutStderr();
    let result: Awaited<ReturnType<typeof dispatch>>;
    try {
      result = await dispatch(["--show-config"]);
    } finally {
      capture.restore();
    }

    expect(result.exitCode).toBe(0);
    // Header line carries the path so the operator can audit it.
    expect(capture.stdout.text).toContain("saved config:");
    expect(capture.stdout.text).toContain(join(tempHome!, ".umactually", "config.json"));
    // Field-by-field rendering — every key from SavedConfig is shown.
    expect(capture.stdout.text).toMatch(/provider:\s+openai-compatible/);
    expect(capture.stdout.text).toMatch(/apiUrl:\s+https:\/\/api\.example\.com\/v1/);
    expect(capture.stdout.text).toMatch(/model:\s+gpt-5-mini/);
    // No warnings on stderr.
    expect(capture.stderr.text).toBe("");
  });

  it("CLI-SHOW-2: no saved config — prints pointer line + exits 0", async () => {
    // tempHome exists but has no `.umactually/config.json`.
    const { dispatch } = await import(dispatchModule);
    const capture = captureStdoutStderr();
    let result: Awaited<ReturnType<typeof dispatch>>;
    try {
      result = await dispatch(["--show-config"]);
    } finally {
      capture.restore();
    }

    expect(result.exitCode).toBe(0);
    expect(capture.stdout.text).toMatch(/no saved config/i);
    expect(capture.stdout.text).toContain("umactually init");
    expect(capture.stderr.text).toBe("");
  });

  it("CLI-SHOW-3: malformed config — warning to stderr, exit 1, no loud banner", async () => {
    mkdirSync(join(tempHome!, ".umactually"), { recursive: true });
    writeFileSync(
      join(tempHome!, ".umactually", "config.json"),
      "{ this is not valid JSON",
    );

    const { dispatch } = await import(dispatchModule);
    const capture = captureStdoutStderr();
    let result: Awaited<ReturnType<typeof dispatch>>;
    try {
      result = await dispatch(["--show-config"]);
    } finally {
      capture.restore();
    }

    expect(result.exitCode).toBe(1);
    expect(capture.stderr.text).toMatch(/corrupt saved config/i);
    // Never the loud `cli: --api-url is required` banner — the
    // `--show-config` arm is fully isolated.
    expect(capture.stderr.text).not.toContain("cli: --api-url is required");
  });

  it("CLI-SHOW-4: bypasses isQuickstartEligible gate (CI env var set → still works)", async () => {
    // The quickstart gate suppresses output when CI env vars are set.
    // `--show-config` MUST NOT be subject to that suppression — CI
    // scripts and CI debug sessions need to inspect the saved config.
    mkdirSync(join(tempHome!, ".umactually"), { recursive: true });
    writeFileSync(
      join(tempHome!, ".umactually", "config.json"),
      JSON.stringify({ schemaVersion: 1, provider: "anthropic" }),
    );
    process.env["GITHUB_ACTIONS"] = "true";

    const { dispatch } = await import(dispatchModule);
    const capture = captureStdoutStderr();
    let result: Awaited<ReturnType<typeof dispatch>>;
    try {
      result = await dispatch(["--show-config"]);
    } finally {
      capture.restore();
    }
    delete process.env["GITHUB_ACTIONS"];

    expect(result.exitCode).toBe(0);
    expect(capture.stdout.text).toContain("saved config:");
    expect(capture.stdout.text).toMatch(/provider:\s+anthropic/);
    // Loud banner suppressed (this is the show-config-specific behavior,
    // NOT the loud banner's validation feedback).
    expect(capture.stderr.text).not.toContain("cli: --api-url is required");
  });
});
