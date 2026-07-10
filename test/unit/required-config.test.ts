import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { RequiredConfigError, requireLiveConfig } from "../../src/util/required-config.js";

const REPO_ROOT = resolve();
const REQUIRED_CONFIG_MESSAGE_FRAGMENT = "must be set for live review";

function readSrc(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), "utf8");
}

describe("requireLiveConfig", () => {
  it("DRY-REQCFG-001 returns the configured value when present", () => {
    // Given: a required config value is present.
    // When: validating it through the shared required-config helper.
    const value = requireLiveConfig("value", "UMACTUALLY_API_URL");

    // Then: the same configured value is returned for chaining.
    expect(value).toBe("value");
  });

  it("DRY-REQCFG-002 throws LIVE_CONFIG_MISSING with byte-identical message for empty string", () => {
    // Given: a required config value is an empty string.
    // When: validating it through the shared required-config helper.
    const action = (): string => requireLiveConfig("", "UMACTUALLY_API_URL");

    // Then: the helper throws the canonical typed error and message.
    expect(action).toThrow(RequiredConfigError);
    try {
      action();
    } catch (error) {
      if (error instanceof RequiredConfigError) {
        expect(error.code).toBe("LIVE_CONFIG_MISSING");
        expect(error.userMessage).toBe("UMACTUALLY_API_URL must be set for live review.");
        expect(error.message).toBe("UMACTUALLY_API_URL must be set for live review.");
        return;
      }
      throw error;
    }
    throw new Error("expected RequiredConfigError");
  });

  it("DRY-REQCFG-003 throws LIVE_CONFIG_MISSING with byte-identical message for undefined and null", () => {
    for (const missingValue of [undefined, null]) {
      // Given: a required config value is absent.
      // When: validating it through the shared required-config helper.
      const action = (): string => requireLiveConfig(missingValue, "UMACTUALLY_API_KEY");

      // Then: the helper throws the canonical typed error and message.
      expect(action).toThrow(RequiredConfigError);
      try {
        action();
      } catch (error) {
        if (error instanceof RequiredConfigError) {
          expect(error.code).toBe("LIVE_CONFIG_MISSING");
          expect(error.userMessage).toBe("UMACTUALLY_API_KEY must be set for live review.");
          expect(error.message).toBe("UMACTUALLY_API_KEY must be set for live review.");
          continue;
        }
        throw error;
      }
      throw new Error("expected RequiredConfigError");
    }
  });

  it("DRY-REQCFG-004 keeps required-config message construction centralized", () => {
    // Given: the live provider and orchestrator source files are the previous duplicate sites.
    const liveProvider = readSrc("src/cli/live-provider.ts");
    const orchestrator = readSrc("src/cli/orchestrator.ts");

    // When/Then: neither file hand-rolls the required-config user-facing message.
    expect(liveProvider).not.toContain(REQUIRED_CONFIG_MESSAGE_FRAGMENT);
    expect(orchestrator).not.toContain(REQUIRED_CONFIG_MESSAGE_FRAGMENT);
  });
});
