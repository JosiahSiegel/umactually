// Pins the single-helper boundary for the UMACTUALLY_DEBUG_RAW env-var
// toggle. The literal "UMACTUALLY_DEBUG_RAW" used to appear at 10 sites
// across 3 files (provider/openai-compatible.ts, render/json-extract.ts,
// cli/run.ts). This test pins the contract of the consolidated helpers
// in src/util/debug-raw.ts so the read/set/restore semantics stay
// behavior-preserving across the refactor.

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DEBUG_RAW_ENV,
  isDebugRawActive,
  withDebugRawEnv,
} from "../../src/util/debug-raw.js";

describe("debug-raw env-var helper boundary", () => {
  let savedValue: string | undefined;

  beforeEach(() => {
    savedValue = process.env[DEBUG_RAW_ENV];
    delete process.env[DEBUG_RAW_ENV];
  });

  afterEach(() => {
    if (savedValue === undefined) {
      delete process.env[DEBUG_RAW_ENV];
    } else {
      process.env[DEBUG_RAW_ENV] = savedValue;
    }
  });

  it("DRY-DEBUG-001: isDebugRawActive returns true only when env is exactly \"1\"", () => {
    process.env[DEBUG_RAW_ENV] = "1";
    expect(isDebugRawActive()).toBe(true);

    delete process.env[DEBUG_RAW_ENV];
    expect(isDebugRawActive()).toBe(false);

    process.env[DEBUG_RAW_ENV] = "0";
    expect(isDebugRawActive()).toBe(false);

    process.env[DEBUG_RAW_ENV] = "";
    expect(isDebugRawActive()).toBe(false);

    process.env[DEBUG_RAW_ENV] = "true";
    expect(isDebugRawActive()).toBe(false);
  });

  it("DRY-DEBUG-002: withDebugRawEnv(true, fn) sets env to \"1\" during fn, deletes it after when prior was undefined", async () => {
    expect(process.env[DEBUG_RAW_ENV]).toBeUndefined();

    let observedDuring: string | undefined = "UNSET";
    await withDebugRawEnv(true, async () => {
      observedDuring = process.env[DEBUG_RAW_ENV];
    });

    expect(observedDuring).toBe("1");
    expect(process.env[DEBUG_RAW_ENV]).toBeUndefined();
  });

  it("DRY-DEBUG-003: withDebugRawEnv restores prior value (not delete) when env was set before the call", async () => {
    process.env[DEBUG_RAW_ENV] = "0";

    let observedDuring: string | undefined = "UNSET";
    await withDebugRawEnv(true, async () => {
      observedDuring = process.env[DEBUG_RAW_ENV];
    });

    expect(observedDuring).toBe("1");
    expect(process.env[DEBUG_RAW_ENV]).toBe("0");

    process.env[DEBUG_RAW_ENV] = "previous-non-1-value";
    await withDebugRawEnv(true, async () => {
      expect(process.env[DEBUG_RAW_ENV]).toBe("1");
    });
    expect(process.env[DEBUG_RAW_ENV]).toBe("previous-non-1-value");
  });

  it("DRY-DEBUG-004: withDebugRawEnv(false, fn) does NOT modify env (read-only pass-through)", async () => {
    expect(process.env[DEBUG_RAW_ENV]).toBeUndefined();
    let observedDuring: string | undefined = "UNSET";

    const result = await withDebugRawEnv(false, async () => {
      observedDuring = process.env[DEBUG_RAW_ENV];
      return "fn-return-value";
    });

    expect(result).toBe("fn-return-value");
    expect(observedDuring).toBeUndefined();
    expect(process.env[DEBUG_RAW_ENV]).toBeUndefined();

    process.env[DEBUG_RAW_ENV] = "0";
    await withDebugRawEnv(false, async () => {
      expect(process.env[DEBUG_RAW_ENV]).toBe("0");
    });
    expect(process.env[DEBUG_RAW_ENV]).toBe("0");
  });
});