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
  "UMACTUALLY_EFFORT",
  "UMACTUALLY_PROVIDER",
  "UMACTUALLY_MODEL",
  "UMACTUALLY_API_URL",
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

  it.each([
    { saved: "low", env: undefined, flags: [], value: "low", provenance: "source: savedConfig" },
    {
      saved: "low",
      env: "high",
      flags: [],
      value: "high",
      provenance: "source: env (UMACTUALLY_EFFORT)",
    },
    { saved: "low", env: "high", flags: ["--effort", "max"], value: "max", provenance: "source: flag" },
    { saved: undefined, env: undefined, flags: [], value: "unset", provenance: "source: default" },
  ])("shows effective effort $value from $provenance", async ({ saved, env, flags, value, provenance }) => {
    // Given
    if (tempHome === null) throw new Error("missing fixture");
    mkdirSync(join(tempHome, ".umactually"), { recursive: true });
    writeFileSync(join(tempHome, ".umactually", "config.json"), JSON.stringify({ schemaVersion: 1, provider: "copilot", effort: saved }));
    if (env !== undefined) process.env["UMACTUALLY_EFFORT"] = env;
    const { dispatch } = await import(dispatchModule);
    const capture = captureStdoutStderr();
    // When
    try { await dispatch(["--show-config", ...flags]); } finally { capture.restore(); }
    // Then — the effective view names the precedence layer AND, for env,
    // the exact env var that supplied the value.
    expect(capture.stdout.text).toContain(`effort:   ${value} (${provenance})`);
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
    // Effective view is derived from `resolved`, so each field carries its
    // precedence layer. With no flag/env, the saved file supplies all three.
    expect(capture.stdout.text).toContain("effective config");
    expect(capture.stdout.text).toContain("provider: openai-compatible (source: savedConfig)");
    expect(capture.stdout.text).toContain("apiUrl:   https://api.example.com/v1 (source: savedConfig)");
    expect(capture.stdout.text).toContain("model:    gpt-5-mini (source: savedConfig)");
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
    expect(capture.stdout.text).toMatch(/no saved config|saved config: none/i);
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

  it("CLI-SHOW-5: env overrides saved for provider/model — the two sections stay coherent", async () => {
    // The on-disk `saved config:` section must keep showing the raw file
    // contents (so the operator can audit what init wrote), while the
    // `effective config:` section must show the precedence-resolved values
    // with env provenance — including the env var name.
    mkdirSync(join(tempHome!, ".umactually"), { recursive: true });
    const configPath = join(tempHome!, ".umactually", "config.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        schemaVersion: 1,
        provider: "copilot",
        apiUrl: "https://saved.example.com/v1",
        model: "saved-model",
      }),
    );
    process.env["UMACTUALLY_PROVIDER"] = "anthropic";
    process.env["UMACTUALLY_MODEL"] = "env-model";

    const { dispatch } = await import(dispatchModule);
    const capture = captureStdoutStderr();
    let result: Awaited<ReturnType<typeof dispatch>>;
    try {
      result = await dispatch(["--show-config"]);
    } finally {
      capture.restore();
    }

    expect(result.exitCode).toBe(0);
    const text = capture.stdout.text;
    // On-disk section: raw saved values, anchored to the file path.
    expect(text).toContain(`saved config: ${configPath}`);
    expect(text).toMatch(/saved config:[\s\S]*?provider:\s+copilot/);
    expect(text).toMatch(/saved config:[\s\S]*?model:\s+saved-model/);
    // Effective section: env wins for provider + model; apiUrl falls back
    // to the saved file. Each line names the exact provenance layer.
    expect(text).toContain("effective config");
    expect(text).toContain("provider: anthropic (source: env (UMACTUALLY_PROVIDER))");
    expect(text).toContain("model:    env-model (source: env (UMACTUALLY_MODEL))");
    expect(text).toContain("apiUrl:   https://saved.example.com/v1 (source: savedConfig)");
    // Neither section contradicts the other: saved=copilot/saved-model,
    // effective=anthropic/env-model.
    expect(text).toContain("provider: copilot");
    expect(text).toContain("provider: anthropic");
  });

  it("CLI-SHOW-6: effective field lines keep the 9-char padded label gutter (byte-exact)", async () => {
    // Pins the rendered bytes of `renderEffectiveField` so the S4624
    // refactor (compute the padded label in a separate statement instead
    // of a nested template literal) cannot drift the column alignment.
    mkdirSync(join(tempHome!, ".umactually"), { recursive: true });
    writeFileSync(
      join(tempHome!, ".umactually", "config.json"),
      JSON.stringify({
        schemaVersion: 1,
        provider: "copilot",
        apiUrl: "https://saved.example.com/v1",
        model: "saved-model",
      }),
    );

    const { dispatch } = await import(dispatchModule);
    const capture = captureStdoutStderr();
    let result: Awaited<ReturnType<typeof dispatch>>;
    try {
      result = await dispatch(["--show-config", "--effort", "xhigh"]);
    } finally {
      capture.restore();
    }

    expect(result.exitCode).toBe(0);
    const text = capture.stdout.text;
    expect(text).toContain("  provider: copilot (source: savedConfig)");
    expect(text).toContain("  apiUrl:   https://saved.example.com/v1 (source: savedConfig)");
    expect(text).toContain("  model:    saved-model (source: savedConfig)");
    expect(text).toContain("  effort:   xhigh (source: flag)");
  });
});
