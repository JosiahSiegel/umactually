// SPDX-License-Identifier: MIT
// Unit tests for `tryReadSavedConfig` — the runtime-tolerant wrapper
// around the wizard's exit-on-error `readSavedConfig` (v0.6.26).
//
// Contract (pinned):
//   - No config file at either candidate path (repo or global):
//     `{config: null, path: <global path>, warning: null}`.
//   - Valid config at repo path: returned with `path` = repo path (the
//     loader walks repo-then-global and returns the FIRST hit).
//   - Valid config at global path: returned with `path` = global path.
//   - Malformed JSON / wrong schemaVersion / unknown provider: returned
//     with `config: null` AND `warning: <message>` (caller decides
//     whether to surface).
//
// S6 contract: this function never persists or transmits `apiKey`.
// The wrapper is a pure pass-through to `readSavedConfig` which already
// refuses unknown keys at the type level.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { tryReadSavedConfig } from "../../src/cli/load-saved-config.js";

let tempHome: string | null = null;
let tempCwd: string | null = null;
let savedEnv: Record<string, string | undefined> = {};

function clearEnv(): void {
  for (const key of ["HOME", "USERPROFILE"]) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
}

function restoreEnv(): void {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe("tryReadSavedConfig (v0.6.26)", () => {
  beforeEach(() => {
    clearEnv();
    tempHome = join(tmpdir(), `umactually-load-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    tempCwd = join(tmpdir(), `umactually-load-cwd-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempHome, { recursive: true });
    mkdirSync(tempCwd, { recursive: true });
    process.env["HOME"] = tempHome;
  });

  afterEach(() => {
    restoreEnv();
    if (tempHome !== null) {
      rmSync(tempHome, { recursive: true, force: true });
      tempHome = null;
    }
    if (tempCwd !== null) {
      rmSync(tempCwd, { recursive: true, force: true });
      tempCwd = null;
    }
  });

  it("LOAD-1: no config at either path → null config, null warning", () => {
    const result = tryReadSavedConfig({
      homeDir: tempHome!,
      cwd: tempCwd!,
    });
    expect(result.config).toBeNull();
    expect(result.warning).toBeNull();
    // `path` is documented as always a string; for the no-config
    // case it's the global path (the walker's final candidate).
    expect(result.path).toContain(".umactually");
  });

  it("LOAD-2: valid config at global path → returns config + path", () => {
    mkdirSync(join(tempHome!, ".umactually"), { recursive: true });
    writeFileSync(
      join(tempHome!, ".umactually", "config.json"),
      JSON.stringify({
        schemaVersion: 1,
        provider: "anthropic",
        apiUrl: "https://api.anthropic.com/v1",
        model: "claude-sonnet-4-5",
      }),
    );
    const result = tryReadSavedConfig({
      homeDir: tempHome!,
      cwd: tempCwd!,
    });
    expect(result.config).not.toBeNull();
    expect(result.config?.provider).toBe("anthropic");
    expect(result.config?.apiUrl).toBe("https://api.anthropic.com/v1");
    expect(result.config?.model).toBe("claude-sonnet-4-5");
    expect(result.path).toBe(join(tempHome!, ".umactually", "config.json"));
    expect(result.warning).toBeNull();
  });

  it("LOAD-3: valid config at repo path takes precedence over global", () => {
    // Repo-scope wins (canonical saved-config behavior).
    writeFileSync(
      join(tempCwd!, "umactually.config.json"),
      JSON.stringify({
        schemaVersion: 1,
        provider: "copilot",
      }),
    );
    // Global also has a different config — must NOT be picked.
    mkdirSync(join(tempHome!, ".umactually"), { recursive: true });
    writeFileSync(
      join(tempHome!, ".umactually", "config.json"),
      JSON.stringify({
        schemaVersion: 1,
        provider: "anthropic",
      }),
    );

    const result = tryReadSavedConfig({
      homeDir: tempHome!,
      cwd: tempCwd!,
    });
    expect(result.config?.provider).toBe("copilot");
    expect(result.path).toBe(join(tempCwd!, "umactually.config.json"));
  });

  it("LOAD-4: malformed JSON → null config + warning message (no throw)", () => {
    mkdirSync(join(tempHome!, ".umactually"), { recursive: true });
    writeFileSync(
      join(tempHome!, ".umactually", "config.json"),
      "{ this is not valid JSON",
    );

    // The runtime wrapper must NEVER throw — callers are dispatch
    // and cli.ts paths that just want `{config, warning}`.
    let result;
    expect(() => {
      result = tryReadSavedConfig({
        homeDir: tempHome!,
        cwd: tempCwd!,
      });
    }).not.toThrow();

    expect(result!.config).toBeNull();
    expect(result!.warning).not.toBeNull();
    expect(result!.warning).toMatch(/corrupt saved config/i);
  });
});
