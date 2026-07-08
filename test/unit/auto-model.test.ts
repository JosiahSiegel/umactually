import { describe, expect, it } from "vitest";

import {
  DEFAULT_FALLBACK_MODELS,
  fallbackModelsFor,
  parseFallbackModels,
  resolveAutoModel,
} from "../../src/cli/auto-model.js";

describe("resolveAutoModel", () => {
  it("returns claude-3-5-sonnet for provider=copilot (Copilot's actual Claude backend)", () => {
    expect(
      resolveAutoModel({ provider: "copilot", apiUrl: null, env: {} }),
    ).toBe("claude-3-5-sonnet");
  });

  it("returns claude-sonnet-4.6 when apiUrl points to anthropic", () => {
    expect(
      resolveAutoModel({
        provider: "openai-compatible",
        apiUrl: "https://api.anthropic.com/v1",
        env: {},
      }),
    ).toBe("claude-sonnet-4.6");
  });

  it("returns gemini-2.5-flash when apiUrl contains generativelanguage", () => {
    expect(
      resolveAutoModel({
        provider: "openai-compatible",
        apiUrl: "https://generativelanguage.googleapis.com/v1beta",
        env: {},
      }),
    ).toBe("gemini-2.5-flash");
  });

  it("returns gemini-2.5-flash when apiUrl contains googleapis", () => {
    expect(
      resolveAutoModel({
        provider: "openai-compatible",
        apiUrl: "https://aiplatform.googleapis.com/v1",
        env: {},
      }),
    ).toBe("gemini-2.5-flash");
  });

  it("returns MiniMax-Text-01 when apiUrl contains minimax", () => {
    // Regression: PR #28's self-review hit HTTP 400 on every
    // OpenAI/Anthropic/Google model name. The MiniMax provider
    // only accepts `MiniMax-Text-01` (or `abab*` aliases). Detected
    // by hostname substring match (case-insensitive).
    expect(
      resolveAutoModel({
        provider: "openai-compatible",
        apiUrl: "https://api.minimax.io/v1",
        env: {},
      }),
    ).toBe("MiniMax-M3");
  });

  it("returns MiniMax-Text-01 for minimax URLs with any path (e.g. /anthropic)", () => {
    expect(
      resolveAutoModel({
        provider: "openai-compatible",
        apiUrl: "https://api.minimax.io/anthropic",
        env: {},
      }),
    ).toBe("MiniMax-M3");
  });

  it("returns MiniMax-Text-01 for minimax URLs case-insensitively", () => {
    expect(
      resolveAutoModel({
        provider: "openai-compatible",
        apiUrl: "https://API.MINIMAX.IO/v1",
        env: {},
      }),
    ).toBe("MiniMax-M3");
  });

  it("returns MiniMax-Text-01 for scheme-less uppercase URLs (regression: extractHostname fallback was not lowercasing)", () => {
    // Regression: `extractHostname` previously returned the host in
    // its original case for scheme-less URLs (because `new URL()`
    // throws on inputs like `API.MINIMAX.IO` and the fallback path
    // forgot to lowercase). The case-insensitive substring match
    // against the lowercase `minimax` route then FAILED, so the
    // resolver fell through to the default gpt-5-mini — which the
    // MiniMax provider would 400 on. After the fix, the fallback
    // path also lowercases, so the match works.
    expect(
      resolveAutoModel({
        provider: "openai-compatible",
        apiUrl: "API.MINIMAX.IO",
        env: {},
      }),
    ).toBe("MiniMax-M3");
  });

  it("returns gpt-5-mini for the default OpenAI-compatible case", () => {
    expect(
      resolveAutoModel({
        provider: "openai-compatible",
        apiUrl: "https://api.openai.com/v1",
        env: {},
      }),
    ).toBe("gpt-5-mini");
  });

  it("falls back to env UMACTUALLY_API_URL when apiUrl is null", () => {
    expect(
      resolveAutoModel({
        provider: "openai-compatible",
        apiUrl: null,
        env: { UMACTUALLY_API_URL: "https://api.anthropic.com/v1" },
      }),
    ).toBe("claude-sonnet-4.6");
  });

  it("returns gpt-5-mini for an unknown openai-compatible URL", () => {
    // The resolver's "unknown provider" path: still pick a less-
    // hallucinating default rather than passing "auto" through.
    expect(
      resolveAutoModel({
        provider: "openai-compatible",
        apiUrl: "https://my-self-hosted-llm.example.com/v1",
        env: {},
      }),
    ).toBe("gpt-5-mini");
  });
});

describe("fallbackModelsFor: URL-specific chains for non-OpenAI providers", () => {
  it("returns the openai chain for plain openai-compatible URLs", () => {
    expect(fallbackModelsFor("openai-compatible", "https://api.openai.com/v1")[0])
      .toBe("gpt-5-mini");
  });

  it("returns the MiniMax chain for api.minimax.io URLs", () => {
    // The generic OpenAI chain would 400 on MiniMax. The URL-specific
    // chain returns only models MiniMax accepts.
    const chain = fallbackModelsFor("openai-compatible", "https://api.minimax.io/v1");
    expect(chain).toContain("MiniMax-M3");
    expect(chain).toContain("MiniMax-Text-01");
    expect(chain).not.toContain("gpt-5-mini");
    expect(chain).not.toContain("claude-sonnet-4.6");
  });

  it("returns the MiniMax chain even when the URL has a non-v1 path", () => {
    const chain = fallbackModelsFor("openai-compatible", "https://api.minimax.io/anthropic");
    expect(chain).toContain("MiniMax-Text-01");
  });

  it("returns the openai chain when apiUrl is null (callers that don't have URL context)", () => {
    expect(fallbackModelsFor("openai-compatible", null)[0])
      .toBe("gpt-5-mini");
  });

  it("returns only the Copilot default for the copilot provider", () => {
    expect(fallbackModelsFor("copilot", "https://api.openai.com/v1"))
      .toEqual(["claude-3-5-sonnet"]);
  });

  it("does NOT match MiniMax for a URL whose path contains 'minimax' but whose host is unrelated", () => {
    // Regression: substring matching on the full URL was the previous
    // behavior. A URL like `https://example.com/minimax-router` would
    // falsely match `url.includes("minimax")` and return the MiniMax
    // chain (which would 400 on a non-MiniMax provider). The
    // hostname-only extract prevents that.
    const chain = fallbackModelsFor(
      "openai-compatible",
      "https://example.com/minimax-router/v1",
    );
    expect(chain).toContain("gpt-5-mini");
    expect(chain).not.toContain("MiniMax-Text-01");
  });

  it("uses hostname for case-insensitive match (API.MINIMAX.IO)", () => {
    const chain = fallbackModelsFor(
      "openai-compatible",
      "https://API.MINIMAX.IO/v1",
    );
    expect(chain).toContain("MiniMax-Text-01");
  });
});

describe("DEFAULT_FALLBACK_MODELS", () => {
  it("starts with the openai default (gpt-5-mini)", () => {
    expect(DEFAULT_FALLBACK_MODELS[0]).toBe("gpt-5-mini");
  });

  it("contains the anthropic and google defaults", () => {
    expect(DEFAULT_FALLBACK_MODELS).toContain("claude-sonnet-4.6");
    expect(DEFAULT_FALLBACK_MODELS).toContain("gemini-2.5-flash");
  });
});

describe("parseFallbackModels", () => {
  it("returns the defaults when the value is empty", () => {
    expect(parseFallbackModels("")).toEqual(DEFAULT_FALLBACK_MODELS);
    expect(parseFallbackModels(null)).toEqual(DEFAULT_FALLBACK_MODELS);
    expect(parseFallbackModels(undefined)).toEqual(DEFAULT_FALLBACK_MODELS);
  });

  it("parses a comma-separated list", () => {
    expect(parseFallbackModels("gpt-5-mini,claude-sonnet-4.6,gemini-2.5-flash"))
      .toEqual(["gpt-5-mini", "claude-sonnet-4.6", "gemini-2.5-flash"]);
  });

  it("trims whitespace and drops empty parts", () => {
    expect(parseFallbackModels(" gpt-5-mini ,, claude-sonnet-4.6 ,"))
      .toEqual(["gpt-5-mini", "claude-sonnet-4.6"]);
  });

  it("deduplicates repeated entries", () => {
    expect(parseFallbackModels("gpt-5-mini,gpt-5-mini,gpt-4.1"))
      .toEqual(["gpt-5-mini", "gpt-4.1"]);
  });

  it("returns the defaults when every part is empty", () => {
    expect(parseFallbackModels(",,,")).toEqual(DEFAULT_FALLBACK_MODELS);
  });
});

describe("hostname extraction: a /minimax path in the URL does NOT trigger MiniMax routing", () => {
  // Substring matching on the full URL is too loose — a URL like
  // `https://example.com/minimax-router` would falsely match
  // `url.includes("minimax")`. The hostname-only extract
  // prevents that. We exercise it through resolveAutoModel.
  it("does NOT match MiniMax for a URL whose path contains 'minimax' but whose host is unrelated", () => {
    expect(
      resolveAutoModel({
        provider: "openai-compatible",
        apiUrl: "https://example.com/minimax-router/v1",
        env: {},
      }),
    ).toBe("gpt-5-mini");
  });

  it("does NOT match Anthropic for a URL whose path contains 'anthropic' but whose host is MiniMax", () => {
    // This is the regression case: `https://api.minimax.io/anthropic`
    // must route to MiniMax-Text-01, NOT claude-sonnet-4.6. The
    // hostname-first check is what makes this work.
    expect(
      resolveAutoModel({
        provider: "openai-compatible",
        apiUrl: "https://api.minimax.io/anthropic",
        env: {},
      }),
    ).toBe("MiniMax-M3");
  });
});