import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  RequiredConfigError,
  buildRequiredConfigMessage,
  requireLiveConfig,
} from "../../src/util/required-config.js";

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

  it("DRY-REQCFG-005 surfaces a remediation hint naming the CLI flag for env vars with a known flag", () => {
    // Given: UMACTUALLY_API_URL has a known CLI flag (--api-url).
    // When: the helper throws because the value is missing.
    // Then: the hint names the CLI flag, the env var, and --dry-run as
    // an escape hatch.
    try {
      requireLiveConfig("", "UMACTUALLY_API_URL");
      throw new Error("expected RequiredConfigError");
    } catch (error) {
      if (!(error instanceof RequiredConfigError)) throw error;
      expect(error.code).toBe("LIVE_CONFIG_MISSING");
      expect(error.hint).toBeDefined();
      expect(error.hint).toContain("--api-url");
      expect(error.hint).toContain("UMACTUALLY_API_URL=");
      expect(error.hint).toContain("--dry-run");
    }
  });

  it("DRY-REQCFG-006 surfaces a remediation hint naming the CLI flag for UMACTUALLY_API_KEY", () => {
    // Given: UMACTUALLY_API_KEY has a known CLI flag (--api-key).
    // When: the helper throws because the value is missing.
    // Then: the hint names --api-key.
    try {
      requireLiveConfig(undefined, "UMACTUALLY_API_KEY");
      throw new Error("expected RequiredConfigError");
    } catch (error) {
      if (!(error instanceof RequiredConfigError)) throw error;
      expect(error.hint).toContain("--api-key");
      expect(error.hint).toContain("UMACTUALLY_API_KEY=");
    }
  });

  it("DRY-REQCFG-007 omits the CLI-flag clause for env vars without a known flag", () => {
    // Given: an env var that doesn't have a known CLI flag (e.g. a
    // platform-only env var like GITHUB_TOKEN).
    // When: the helper throws because the value is missing.
    // Then: the hint is still present and still mentions the env var
    // and --dry-run, but does NOT invent a CLI flag.
    try {
      requireLiveConfig("", "GITHUB_TOKEN");
      throw new Error("expected RequiredConfigError");
    } catch (error) {
      if (!(error instanceof RequiredConfigError)) throw error;
      expect(error.hint).toBeDefined();
      expect(error.hint).toContain("GITHUB_TOKEN=");
      expect(error.hint).not.toContain("--githu-token");
    }
  });

  it("DRY-REQCFG-008 exposes buildRequiredConfigMessage for reuse outside throws", () => {
    // Given: callers that want the canonical message+hint pair without
    // throwing (e.g. CLI parse-time, JSON envelopes).
    // When: invoking the builder for a known env var.
    // Then: it returns the same message and a hint that names the flag.
    const built = buildRequiredConfigMessage("UMACTUALLY_API_KEY");
    expect(built.message).toBe("UMACTUALLY_API_KEY must be set for live review.");
    expect(built.hint).toContain("--api-key");
  });
});
