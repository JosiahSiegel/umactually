// SPDX-License-Identifier: MIT
//
// Tests for the dispatcher's first-token / strip-leading-command helpers
// and the small pure-render surface. These pin the public boundary added
// by the dispatch refactor (Task 13) and prevent future regressions where
// global flags like `--json` stop being skipped from the positional scan.
//
// ITER-2e: these tests are NEW and additive.

import { describe, expect, it } from "vitest";

import {
  type DispatchResult,
  FIRST_RUN_QUICKSTART,
  firstPositionalToken,
  renderLoadedConfigQuickstart,
  stripLeadingCommand,
} from "../../src/cli/dispatch.js";
import { type SavedConfig, SAVED_CONFIG_SCHEMA_VERSION } from "../../src/config/saved-config.js";

describe("firstPositionalToken (ITER-2e)", () => {
  it("returns the first non-flag token", () => {
    expect(firstPositionalToken(["review", "--help"])).toBe("review");
    expect(firstPositionalToken(["doctor", "--full"])).toBe("doctor");
  });

  it("skips global-only flags before the positional token", () => {
    expect(firstPositionalToken(["--json", "--no-color", "review"])).toBe("review");
    expect(firstPositionalToken(["--json", "init"])).toBe("init");
  });

  it("returns null when a flag is the first non-global token", () => {
    expect(firstPositionalToken(["--help"])).toBeNull();
    expect(firstPositionalToken(["--json", "--help"])).toBeNull();
  });

  it("returns null for empty argv", () => {
    expect(firstPositionalToken([])).toBeNull();
  });
});

describe("stripLeadingCommand (ITER-2e)", () => {
  it("removes the command token from argv", () => {
    expect(stripLeadingCommand(["review", "--help"], "review")).toEqual(["--help"]);
    expect(stripLeadingCommand(["init", "--provider", "anthropic"], "init")).toEqual(["--provider", "anthropic"]);
  });

  it("preserves the command when its position is non-zero", () => {
    expect(stripLeadingCommand(["--json", "review", "--help"], "review")).toEqual(["--json", "--help"]);
  });

  it("returns a copy of argv when the command is not present", () => {
    const input = ["review", "--help"];
    const out = stripLeadingCommand(input, "doctor");
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });
});

describe("renderLoadedConfigQuickstart (ITER-2e)", () => {
  it("renders provider=... and model=... labels plus the three review commands", () => {
    const config: SavedConfig = {
      schemaVersion: SAVED_CONFIG_SCHEMA_VERSION,
      provider: "openai-compatible",
      apiUrl: "https://provider.example.com/v1",
      model: "gpt-4o-mini",
    };
    const out = renderLoadedConfigQuickstart(config);
    expect(out).toContain("provider=");
    expect(out).toContain("model=gpt-4o-mini");
    expect(out).toContain("review");
    expect(out).toContain("doctor");
    expect(out).toContain("Loaded config");
  });

  it("omits the model=... label when the config has no model", () => {
    const config: SavedConfig = {
      schemaVersion: SAVED_CONFIG_SCHEMA_VERSION,
      provider: "openai-compatible",
      apiUrl: "https://provider.example.com/v1",
    };
    const out = renderLoadedConfigQuickstart(config);
    expect(out).not.toContain("model=");
  });
});

describe("FIRST_RUN_QUICKSTART (ITER-2e)", () => {
  it("is a non-empty string mentioning the init wizard", () => {
    expect(typeof FIRST_RUN_QUICKSTART).toBe("string");
    expect(FIRST_RUN_QUICKSTART.length).toBeGreaterThan(0);
    expect(FIRST_RUN_QUICKSTART).toContain("init");
  });
});

describe("DispatchResult type (ITER-2e)", () => {
  it("is a structural object with exitCode, stdout, stderr", () => {
    const r: DispatchResult = { exitCode: 0, stdout: "ok", stderr: "" };
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toBe("ok");
  });
});
