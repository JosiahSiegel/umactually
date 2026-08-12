// SPDX-License-Identifier: MIT
//
// Tests for the small pure exports of `src/cli.ts` — argument sniffer,
// version reader, version runner, and the sanitized resolved-config
// builder. These pin the public surface used by ITER-2e dispatch tests
// and the version-flag contract.
//
// ITER-2e: these tests are NEW and additive.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildSanitizedResolvedConfig,
  isVersionFlag,
  readPackageVersion,
  runVersion,
} from "../../src/cli.js";

describe("isVersionFlag (ITER-2e)", () => {
  it("returns true for --version", () => {
    expect(isVersionFlag(["--version"])).toBe(true);
  });

  it("returns true for -V", () => {
    expect(isVersionFlag(["-V"])).toBe(true);
  });

  it("returns true when the flag appears in any position", () => {
    expect(isVersionFlag(["review", "--help", "--version"])).toBe(true);
    expect(isVersionFlag(["--api-url", "https://x", "-V"])).toBe(true);
  });

  it("returns false when no version flag is present", () => {
    expect(isVersionFlag([])).toBe(false);
    expect(isVersionFlag(["--help"])).toBe(false);
    expect(isVersionFlag(["-v"])).toBe(false);
  });
});

describe("readPackageVersion (ITER-2e)", () => {
  it("returns the package.json version from the local repo", () => {
    const v = readPackageVersion();
    const expected = (JSON.parse(readFileSync(join(import.meta.dirname, "../../package.json"), "utf8")) as { version: string }).version;
    expect(v).toBe(expected);
  });
});

describe("runVersion (ITER-2e)", () => {
  it("returns exitCode 0 and a stdout of '<version>\\n'", () => {
    const result = runVersion([]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(`${readPackageVersion()}\n`);
  });
});

describe("buildSanitizedResolvedConfig (ITER-2e)", () => {
  it("returns a SanitizedResolvedConfig with the resolved fields echoed verbatim", () => {
    const resolved = {
      platform: "github" as const,
      dryRun: false,
      provider: "openai-compatible",
      apiUrl: "https://provider.example.com/v1",
      model: "gpt-4o-mini",
      apiKey: "sk-shouldnt-appear",
      files: null,
      sonarToken: null,
      promptFile: null,
      promptFiles: null,
      additionalPromptFile: null,
      additionalPromptFiles: null,
      prompt: null,
      additionalPrompt: null,
      parsed: {} as never,
    };
    const out = buildSanitizedResolvedConfig(resolved as unknown as Parameters<typeof buildSanitizedResolvedConfig>[0]);
    expect(out.platform).toBe("github");
    expect(out.provider).toBe("openai-compatible");
    expect(out.model).toBe("gpt-4o-mini");
    expect(out.apiUrlPresent).toBe(true);
    expect(out.apiKeyPresent).toBe(true);
  });

  it("accepts an explicit reviewPolicy metadata override", () => {
    const resolved = {
      platform: "azure" as const,
      dryRun: true,
      provider: "anthropic",
      apiUrl: "https://api.anthropic.com",
      model: "claude-3-5-sonnet",
      apiKey: "",
      files: null,
      sonarToken: null,
      promptFile: null,
      promptFiles: null,
      additionalPromptFile: null,
      additionalPromptFiles: null,
      prompt: null,
      additionalPrompt: null,
      parsed: {} as never,
    };
    const out = buildSanitizedResolvedConfig(resolved as unknown as Parameters<typeof buildSanitizedResolvedConfig>[0], {
      path: ".umactually/review.json",
      hash: "abc123",
      schemaVersion: 1,
    });
    expect(out.platform).toBe("azure");
    expect(out.dryRun).toBe(true);
  });
});
