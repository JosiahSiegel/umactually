import { describe, expect, it, vi } from "vitest";

import {
  discoverAutoModel,
  type ModelDiscoveryInput,
  type ModelDiscoveryResult,
} from "../../src/cli/auto-model.js";

const API_KEY = "test-key-do-not-leak";
const OPENAI_URL = "https://provider.invalid/v1";
const ANTHROPIC_URL = "https://api.anthropic.com/v1";

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function input(
  provider: ModelDiscoveryInput["provider"],
  fetchImpl: typeof fetch,
  apiUrl = OPENAI_URL,
): ModelDiscoveryInput {
  return { provider, apiUrl, apiKey: API_KEY, dependencies: { fetchImpl } };
}

describe("discoverAutoModel: OpenAI-compatible", () => {
  it("selects one opaque nonblank ID and authenticates GET /v1/models", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (request, init) => {
      // Given: a single-model catalog.
      expect(request).toBe("https://provider.invalid/v1/models");
      expect(init?.method).toBe("GET");
      expect(new Headers(init?.headers).get("authorization")).toBe(`Bearer ${API_KEY}`);
      // When: discovery reads the provider contract.
      return response({ data: [{ id: " opaque/id:2026 " }] });
    });
    // Then: the opaque ID is returned without parsing or ranking.
    await expect(discoverAutoModel(input("openai-compatible", fetchImpl))).resolves.toEqual({
      ok: true,
      modelId: "opaque/id:2026",
    });
  });

  it("returns empty when no valid IDs remain", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => response({ data: [{ id: " " }] }));
    await expect(discoverAutoModel(input("openai-compatible", fetchImpl))).resolves.toEqual({
      ok: false,
      error: { kind: "empty" },
    });
  });

  it("returns ambiguous instead of ranking multiple IDs", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => response({ data: [{ id: "z" }, { id: "a" }] }));
    await expect(discoverAutoModel(input("openai-compatible", fetchImpl))).resolves.toEqual({
      ok: false,
      error: { kind: "ambiguous", modelIds: ["z", "a"] },
    });
  });

  it("returns unauthorized for HTTP 401", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => response({ error: "denied" }, 401));
    await expect(discoverAutoModel(input("openai-compatible", fetchImpl))).resolves.toEqual({
      ok: false,
      error: { kind: "unauthorized", status: 401 },
    });
  });

  it("returns malformed for invalid JSON and invalid catalog shape", async () => {
    const invalidJson = vi.fn<typeof fetch>(async () => new Response("not-json"));
    const invalidShape = vi.fn<typeof fetch>(async () => response({ models: [] }));
    await expect(discoverAutoModel(input("openai-compatible", invalidJson))).resolves.toEqual({
      ok: false,
      error: { kind: "malformed", reason: "response body is not JSON" },
    });
    await expect(discoverAutoModel(input("openai-compatible", invalidShape))).resolves.toEqual({
      ok: false,
      error: { kind: "malformed", reason: "missing data array" },
    });
  });

  it("returns aborted and forwards the injected signal", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn<typeof fetch>(async (_request, init) => {
      expect(init?.signal).toBe(controller.signal);
      throw new DOMException("cancelled", "AbortError");
    });
    const result = await discoverAutoModel({
      provider: "openai-compatible",
      apiUrl: OPENAI_URL,
      apiKey: API_KEY,
      dependencies: { fetchImpl, signal: controller.signal },
    });
    expect(result).toEqual<ModelDiscoveryResult>({ ok: false, error: { kind: "aborted" } });
  });

  it("redacts query secrets from network errors", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error(`request failed at ${OPENAI_URL}?api_key=${API_KEY}`);
    });
    const result = await discoverAutoModel(input("openai-compatible", fetchImpl));
    expect(result.ok).toBe(false);
    if (!result.ok && result.error.kind === "network") {
      expect(result.error.reason).toBe(`request failed at ${OPENAI_URL}`);
      expect(result.error.reason).not.toContain(API_KEY);
    }
  });

  it("injects timeout into the request signal", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (_request, init) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return response({ data: [{ id: "one" }] });
    });
    await expect(discoverAutoModel({
      provider: "openai-compatible",
      apiUrl: OPENAI_URL,
      apiKey: API_KEY,
      dependencies: { fetchImpl, timeoutMs: 1_000 },
    })).resolves.toEqual({ ok: true, modelId: "one" });
  });

  it("classifies a request timeout as aborted", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });
    await expect(discoverAutoModel({
      provider: "openai-compatible",
      apiUrl: OPENAI_URL,
      apiKey: API_KEY,
      dependencies: { fetchImpl, timeoutMs: 1 },
    })).resolves.toEqual({ ok: false, error: { kind: "aborted" } });
  });
});

describe("discoverAutoModel: Anthropic", () => {
  it("selects one opaque ID with Anthropic authentication", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (request, init) => {
      expect(request).toBe("https://api.anthropic.com/v1/models");
      const headers = new Headers(init?.headers);
      expect(headers.get("x-api-key")).toBe(API_KEY);
      expect(headers.get("anthropic-version")).toBe("2023-06-01");
      expect(headers.get("authorization")).toBeNull();
      return response({ data: [{ id: "anthropic/opaque" }] });
    });
    await expect(discoverAutoModel(input("anthropic", fetchImpl, ANTHROPIC_URL))).resolves.toEqual({
      ok: true,
      modelId: "anthropic/opaque",
    });
  });

  it("returns typed empty, ambiguous, and unauthorized failures", async () => {
    const cases = [
      [response({ data: [] }), { kind: "empty" }],
      [response({ data: [{ id: "one" }, { id: "two" }] }), { kind: "ambiguous", modelIds: ["one", "two"] }],
      [response({}, 401), { kind: "unauthorized", status: 401 }],
    ] as const;
    for (const [catalog, error] of cases) {
      const fetchImpl = vi.fn<typeof fetch>(async () => catalog);
      await expect(discoverAutoModel(input("anthropic", fetchImpl, ANTHROPIC_URL))).resolves.toEqual({ ok: false, error });
    }
  });
});

describe("discoverAutoModel: provider boundaries", () => {
  it("returns Copilot provider-native auto without fetching", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(discoverAutoModel({ provider: "copilot", apiUrl: null, apiKey: null, dependencies: { fetchImpl } }))
      .resolves.toEqual({ ok: true, modelId: "auto" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns unsupported when HTTP discovery inputs are absent", async () => {
    await expect(discoverAutoModel({ provider: "openai-compatible", apiUrl: null, apiKey: null }))
      .resolves.toEqual({ ok: false, error: { kind: "unsupported", provider: "openai-compatible" } });
  });
});
