import { describe, expect, it } from "vitest";

import {
  DEFAULT_FALLBACK_MODELS,
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