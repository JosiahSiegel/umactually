// test/unit/tui-config-flow.test.ts — unit tests for src/cli/tui/flows/config.ts.
//
// Verifies the View Config flow's read-only display + Back-to-menu
// sentinel without touching a real TTY, real disk, or real saved-config
// files:
//
//   - CFG-A: when saved config exists, the display contains the path,
//     provider, apiUrl, and model. (Mock `tryReadSavedConfig` to return
//     a known config.)
//   - CFG-B: when no saved config, the display contains the
//     "no saved config" hint.
//   - CFG-C: env var presence is correctly reported. Setting
//     `process.env.MY_VAR = "x"` before the call makes `MY_VAR=present`
//     appear in the rendered env table; an unset variable appears as
//     `=absent`.
//   - CFG-D: after display, the "Back to menu" `select` appears; the
//     flow returns `{ exitCode: 0 }` once it resolves.
//   - CFG-E: `isCancel()` mid-flow → the flow returns `{ exitCode: 0 }`
//     without throwing.
//
// We mock `@clack/prompts` so the test never depends on stdin/stdout
// being attached to a real terminal, and we mock `tryReadSavedConfig`
// (via the `load-saved-config.js` module path) so the saved-config
// path is deterministic. The actual saved-config reader has its own
// dedicated test suite (test/unit/load-saved-config.test.ts) — this
// file does NOT re-test that surface.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clack/prompts", () => ({
  isCancel: vi.fn(),
  note: vi.fn(),
  select: vi.fn(),
  stream: { warn: vi.fn() },
}));

vi.mock("../../src/cli/load-saved-config.js", () => ({
  tryReadSavedConfig: vi.fn(),
}));

import { isCancel, note, select, stream } from "@clack/prompts";

import { runConfigFlow } from "../../src/cli/tui/flows/config.js";
import { tryReadSavedConfig } from "../../src/cli/load-saved-config.js";

const MOCKED_SELECT = vi.mocked(select);
const MOCKED_NOTE = vi.mocked(note);
const MOCKED_IS_CANCEL = vi.mocked(isCancel);
const MOCKED_STREAM_WARN = vi.mocked(stream.warn);
const MOCKED_TRY_READ_SAVED_CONFIG = vi.mocked(tryReadSavedConfig);

describe("tui config flow (runConfigFlow)", () => {
  beforeEach(() => {
    // Default: a config-present world with no warning; tests override
    // the per-test return value via `mockReturnValueOnce`.
    MOCKED_SELECT.mockReset();
    MOCKED_NOTE.mockReset();
    MOCKED_IS_CANCEL.mockReset();
    MOCKED_STREAM_WARN.mockReset();
    MOCKED_TRY_READ_SAVED_CONFIG.mockReset();

    MOCKED_SELECT.mockResolvedValue("menu");
    MOCKED_IS_CANCEL.mockReturnValue(false);
    MOCKED_STREAM_WARN.mockResolvedValue(undefined);
    MOCKED_NOTE.mockReturnValue(undefined);
  });

  afterEach(() => {
    // Wipe the test-fixture env var so it never bleeds across cases.
    delete process.env["UMACTUALLY_API_KEY"];
  });

  it("CFG-A: when saved config exists, the display contains path + provider + apiUrl + model", async () => {
    // Given: a saved config is present.
    MOCKED_TRY_READ_SAVED_CONFIG.mockReturnValueOnce({
      config: {
        schemaVersion: 1,
        provider: "openai-compatible",
        apiUrl: "https://api.example.com/v1",
        model: "gpt-4o",
      },
      path: "/home/test/.umactually/config.json",
      warning: null,
    });

    // When: the flow runs.
    const result = await runConfigFlow();

    // Then: it returns to the hub with exitCode 0.
    expect(result).toEqual({ exitCode: 0 });

    // And: the saved-config note was emitted with all four fields
    // visible (path, provider, apiUrl, model).
    expect(MOCKED_NOTE).toHaveBeenCalled();
    const savedConfigCall = MOCKED_NOTE.mock.calls.find(
      (call) => call[1] === "Saved config",
    );
    expect(savedConfigCall).toBeDefined();
    const savedConfigBody = String(savedConfigCall?.[0] ?? "");
    expect(savedConfigBody).toContain("/home/test/.umactually/config.json");
    expect(savedConfigBody).toContain("openai-compatible");
    expect(savedConfigBody).toContain("https://api.example.com/v1");
    expect(savedConfigBody).toContain("gpt-4o");

    // And: no warning was emitted (the file was clean).
    expect(MOCKED_STREAM_WARN).not.toHaveBeenCalled();

    // And: the Back-to-menu select was offered (single option).
    expect(MOCKED_SELECT).toHaveBeenCalledTimes(1);
    const selectOpts = MOCKED_SELECT.mock.calls[0]?.[0] as {
      options: ReadonlyArray<{ value: string; label: string }>;
    };
    expect(selectOpts.options).toEqual([
      { value: "menu", label: "Back to menu" },
    ]);
  });

  it("CFG-B: when no saved config, the display contains the 'no saved config' hint", async () => {
    // Given: no saved config (loader returns `config: null`).
    MOCKED_TRY_READ_SAVED_CONFIG.mockReturnValueOnce({
      config: null,
      path: "/home/test/.umactually/config.json",
      warning: null,
    });

    // When: the flow runs.
    const result = await runConfigFlow();

    // Then: it still returns { exitCode: 0 } (the hub keeps looping).
    expect(result).toEqual({ exitCode: 0 });

    // And: the saved-config note shows the no-config hint pointing at
    // the path the loader checked.
    const savedConfigCall = MOCKED_NOTE.mock.calls.find(
      (call) => call[1] === "Saved config",
    );
    expect(savedConfigCall).toBeDefined();
    const savedConfigBody = String(savedConfigCall?.[0] ?? "");
    expect(savedConfigBody).toMatch(/No saved config found/i);
    expect(savedConfigBody).toContain("/home/test/.umactually/config.json");
  });

  it("CFG-C: env var presence is correctly reported (present=true for set, present=false for unset)", async () => {
    // Given: a saved config (presence shape doesn't matter for this
    // test — the env-table rendering path always runs).
    MOCKED_TRY_READ_SAVED_CONFIG.mockReturnValueOnce({
      config: {
        schemaVersion: 1,
        provider: "anthropic",
      },
      path: "/home/test/.umactually/config.json",
      warning: null,
    });

    // And: a known runtime env var that we expect to see as `present`
    // in the rendered table. We use `UMACTUALLY_API_KEY` because it IS
    // in `KNOWN_ENV_VAR_NAMES` (the flow only renders vars the runtime
    // actually reads — an arbitrary name like `MY_VAR` would never
    // appear because the flow iterates over the schema-defined set).
    process.env["UMACTUALLY_API_KEY"] = "x";

    // When: the flow runs.
    await runConfigFlow();

    // Then: the env-presence note was emitted.
    const envCall = MOCKED_NOTE.mock.calls.find(
      (call) => call[1] === "Environment",
    );
    expect(envCall).toBeDefined();
    const envBody = String(envCall?.[0] ?? "");

    // And: the fixture env var appears as `present`.
    expect(envBody).toMatch(
      /UMACTUALLY_API_KEY=present/,
    );

    // And: at least one of the well-known unset runtime env vars
    // (e.g. `UMACTUALLY_API_URL`) appears as `absent` — the test
    // runner does not set it by default.
    expect(envBody).toMatch(
      /UMACTUALLY_API_URL=absent/,
    );
  });

  it("CFG-D: after display, the 'Back to menu' select resolves → returns { exitCode: 0 } to the hub", async () => {
    // Given: a config-present world; the mocked select will resolve to
    // "menu" (the default set in beforeEach).
    MOCKED_TRY_READ_SAVED_CONFIG.mockReturnValueOnce({
      config: {
        schemaVersion: 1,
        provider: "copilot",
        model: "gpt-5-mini",
      },
      path: "/home/test/.umactually/config.json",
      warning: null,
    });

    // When: the flow runs.
    const result = await runConfigFlow();

    // Then: it returns { exitCode: 0 } — the sentinel value the hub
    // sees is irrelevant to the return shape (both the cancel branch
    // and the "menu" branch return the same shape so the hub's
    // post-flow loop is uniform).
    expect(result).toEqual({ exitCode: 0 });

    // And: the select was called once with the single Back-to-menu option.
    expect(MOCKED_SELECT).toHaveBeenCalledTimes(1);
  });

  it("CFG-E: isCancel() mid-flow → returns { exitCode: 0 } (cancel branch)", async () => {
    // Given: a config-present world; the user hits Ctrl+C at the
    // Back-to-menu prompt.
    MOCKED_TRY_READ_SAVED_CONFIG.mockReturnValueOnce({
      config: {
        schemaVersion: 1,
        provider: "openai-compatible",
      },
      path: "/home/test/.umactually/config.json",
      warning: null,
    });
    MOCKED_SELECT.mockResolvedValueOnce("__cancelled__" as never);
    MOCKED_IS_CANCEL.mockReturnValueOnce(true);

    // When: the flow runs.
    const result = await runConfigFlow();

    // Then: it short-circuits to { exitCode: 0 } without throwing.
    expect(result).toEqual({ exitCode: 0 });
  });
});
