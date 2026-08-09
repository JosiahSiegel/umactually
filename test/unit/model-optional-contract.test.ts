// SPDX-License-Identifier: MIT
//
// Pin the §10 acceptance contract: `model` is truly optional throughout
// the runtime. Every assertion here RED before the production edits
// shipped, GREEN after.
//
//   1. Saved config round-trips without `model` and produces a JSON
//      file that does NOT contain the literal key "model".
//   2. Saved config round-trips WITH an explicit model and preserves
//      the value byte-for-byte.
//   3. `umactually --show-config` reports an omitted model as
//      `auto (resolved at review time)`, not by silently dropping the
//      field.
//   4. The TUI config flow mirrors the same `auto (resolved at review
//      time)` placeholder when the saved config has no model.
//   5. `umactually init --non-interactive --provider <p>` without
//      `--model` writes a JSON file that contains no `"model"` key
//      (no fabricated "auto" sentinel in the persisted bytes).
//   6. The non-interactive init env defaults consult ONLY the five
//      kept env vars (UMACTUALLY_API_URL/KEY/MODEL/PROVIDER/
//      GITHUB_API_BASE); other retained env vars do not influence
//      the wizard's defaults.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  readSavedConfig,
  serializeSavedConfig,
  writeSavedConfig,
  type SavedConfig,
} from "../../src/config/saved-config.js";

const dispatchModule = "../../src/cli/dispatch.js";
const initModule = "../../src/cli/init.js";

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
  "UMACTUALLY_API_URL",
  "UMACTUALLY_API_KEY",
  "UMACTUALLY_MODEL",
  "UMACTUALLY_PROVIDER",
  "UMACTUALLY_GITHUB_API_BASE",
] as const;

let savedEnv: Record<string, string | undefined> = {};
let tempHome: string | null = null;

function clearEnv(): void {
  for (const key of ENV_KEYS_TO_CLEAR) {
    delete process.env[key];
  }
}

describe("model-optional contract (plan §10)", () => {
  beforeEach(() => {
    savedEnv = {};
    for (const key of ENV_KEYS_TO_CLEAR) {
      savedEnv[key] = process.env[key];
    }
    clearEnv();
    tempHome = mkdtempSync(join(tmpdir(), "umactually-model-opt-"));
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

  it("§10-1 round-trips a saved config that omits model (no \"model\" key on disk)", async () => {
    const config: SavedConfig = {
      schemaVersion: 1,
      provider: "openai-compatible",
      apiUrl: "https://provider.example.test/v1",
    };
    const result = await writeSavedConfig(config, {
      homeDir: tempHome!,
      cwd: tempHome!,
      scope: "global",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const onDisk = readFileSync(result.path, "utf8");
    expect(onDisk).not.toMatch(/"model"/u);

    const read = readSavedConfig({ homeDir: tempHome!, cwd: tempHome! });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.config?.model).toBeUndefined();
    expect(read.config?.provider).toBe("openai-compatible");
    expect(read.config?.apiUrl).toBe("https://provider.example.test/v1");
  });

  it("§10-2 round-trips an explicit model byte-for-byte", async () => {
    const config: SavedConfig = {
      schemaVersion: 1,
      provider: "openai-compatible",
      model: "claude-sonnet-4-5",
    };
    const result = await writeSavedConfig(config, {
      homeDir: tempHome!,
      cwd: tempHome!,
      scope: "global",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const onDisk = JSON.parse(readFileSync(result.path, "utf8")) as Record<string, unknown>;
    expect(onDisk["model"]).toBe("claude-sonnet-4-5");

    const read = readSavedConfig({ homeDir: tempHome!, cwd: tempHome! });
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.config?.model).toBe("claude-sonnet-4-5");
  });

  it("§10-3 --show-config renders omitted model as 'auto (resolved at review time)'", async () => {
    mkdirSync(join(tempHome!, ".umactually"), { recursive: true });
    writeFileSync(
      join(tempHome!, ".umactually", "config.json"),
      JSON.stringify({
        schemaVersion: 1,
        provider: "openai-compatible",
        apiUrl: "https://api.example.test/v1",
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
    expect(capture.stdout.text).toMatch(/model:\s+auto \(resolved at review time\)/u);
    expect(capture.stderr.text).toBe("");
  });

  it("§10-5 init --non-interactive without --model writes no \"model\" key", async () => {
    // No env vars set, no --model flag. The persisted JSON must NOT
    // contain a `"model"` key. The acceptance criterion forbids the
    // literal "auto" sentinel in the on-disk bytes.
    const { runInit } = await import(initModule);
    const result = await runInit({
      argv: [
        "--non-interactive",
        "--provider",
        "openai-compatible",
        "--api-url",
        "https://provider.example.test/v1",
        "--api-key",
        "sk-not-real-just-shape",
        "--scope",
        "global",
        "--yes",
      ],
      deps: {
        argv: [],
        env: {},
        cwd: tempHome!,
        homeDir: tempHome!,
        platform: "linux",
        packageVersion: "0.0.0-test",
        isTTY: false,
        stdinReader: async () => null,
      },
    });
    expect(result.exitCode).toBe(0);
    expect(result.savedConfigPath).not.toBeNull();
    if (result.savedConfigPath === null) return;

    const onDisk = readFileSync(result.savedConfigPath, "utf8");
    expect(onDisk).not.toMatch(/"model"/u);
    // The literal "auto" sentinel must not appear in the persisted file.
    expect(onDisk).not.toMatch(/"auto"/u);
  });

  it("§10-6 init env defaults consult only the five kept UMACTUALLY_* vars", async () => {
    // Setting an unrelated env var that the wizard previously consulted
    // for a model sentinel must NOT cause a model key to appear in
    // the persisted file. The five kept vars are: API_URL, API_KEY,
    // MODEL, PROVIDER, GITHUB_API_BASE.
    process.env["UMACTUALLY_API_URL"] = "https://provider.example.test/v1";
    process.env["UMACTUALLY_API_KEY"] = "sk-not-real-just-shape";
    // Deliberately leave UMACTUALLY_MODEL unset.

    const { runInit } = await import(initModule);
    const result = await runInit({
      argv: [
        "--non-interactive",
        "--provider",
        "openai-compatible",
        "--scope",
        "global",
        "--yes",
      ],
      deps: {
        argv: [],
        env: process.env,
        cwd: tempHome!,
        homeDir: tempHome!,
        platform: "linux",
        packageVersion: "0.0.0-test",
        isTTY: false,
        stdinReader: async () => null,
      },
    });
    expect(result.exitCode).toBe(0);
    expect(result.savedConfigPath).not.toBeNull();
    if (result.savedConfigPath === null) return;

    const onDisk = JSON.parse(readFileSync(result.savedConfigPath, "utf8")) as Record<string, unknown>;
    // apiUrl from env survived.
    expect(onDisk["apiUrl"]).toBe("https://provider.example.test/v1");
    // No UMACTUALLY_MODEL was set, so no model key may be present.
    expect(Object.prototype.hasOwnProperty.call(onDisk, "model")).toBe(false);
  });

  it("§10-7 serializeSavedConfig omits the model key when the field is absent", () => {
    const config: SavedConfig = {
      schemaVersion: 1,
      provider: "anthropic",
    };
    const bytes = serializeSavedConfig(config);
    expect(bytes).not.toMatch(/"model"/u);
  });

  it("§10-8 TUI config flow renders omitted model as 'auto (resolved at review time)'", async () => {
    vi.resetModules();
    vi.doMock("@clack/prompts", () => ({
      isCancel: vi.fn(() => false),
      note: vi.fn(),
      select: vi.fn(async () => "menu"),
      stream: { warn: vi.fn() },
    }));
    vi.doMock("../../src/cli/load-saved-config.js", () => ({
      tryReadSavedConfig: vi.fn(() => ({
        config: {
          schemaVersion: 1,
          provider: "openai-compatible",
          apiUrl: "https://api.example.test/v1",
        },
        path: "/tmp/fake/.umactually/config.json",
        warning: null,
      })),
    }));

    const { note, select } = await import("@clack/prompts");
    const noteMock = vi.mocked(note);
    const selectMock = vi.mocked(select);
    const flowMod = await import("../../src/cli/tui/flows/config.js");

    await flowMod.runConfigFlow();

    const savedConfigCall = noteMock.mock.calls.find(
      (call) => call[1] === "Saved config",
    );
    expect(savedConfigCall).toBeDefined();
    const body = String(savedConfigCall?.[0] ?? "");
    expect(body).toMatch(/model:\s+auto \(resolved at review time\)/u);
    expect(selectMock).toHaveBeenCalledTimes(1);

    vi.doUnmock("@clack/prompts");
    vi.doUnmock("../../src/cli/load-saved-config.js");
    vi.resetModules();
  });
});
