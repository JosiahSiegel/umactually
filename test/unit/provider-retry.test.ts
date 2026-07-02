// allow: SIZE_OK — single provider-retry test file (4 Given/When/Then cases + one shared stub helper)
import { describe, expect, it } from "vitest";

import { ProviderError, runProviderRequest } from "../../src/provider/openai-compatible.js";

type FetchResponseInit = {
  readonly status: number;
  readonly body: string;
  readonly contentType?: string;
};

type RecordedRequest = {
  readonly url: string;
  readonly method: string;
  readonly authorization: string | null;
  readonly body: unknown;
};

type FetchStub = {
  readonly calls: readonly RecordedRequest[];
  readonly responses: readonly FetchResponseInit[];
  fetch: typeof fetch;
};

function makeFetchStub(responses: readonly FetchResponseInit[]): FetchStub {
  const calls: RecordedRequest[] = [];
  let index = 0;

  const stubbed: typeof fetch = async (input, init) => {
    const requestUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const requestInit = init ?? {};
    const method = requestInit.method ?? "GET";
    const headers = new Headers(requestInit.headers);
    const rawBody = requestInit.body;
    const parsedBody: unknown =
      typeof rawBody === "string"
        ? safeParseJson(rawBody)
        : rawBody === undefined
          ? null
          : rawBody;
    const authorization = headers.has("authorization") ? headers.get("authorization") : null;
    calls.push({ url: requestUrl, method, authorization, body: parsedBody });

    const slot = responses[index];
    if (slot === undefined) {
      throw new Error(`fetch stub exhausted at call #${index + 1}`);
    }
    index += 1;

    return makeResponse(slot);
  };

  return { calls, responses, fetch: stubbed };
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function makeResponse(init: FetchResponseInit): Response {
  const contentType = init.contentType ?? "application/json";
  return new Response(init.body, {
    status: init.status,
    headers: { "content-type": contentType },
  });
}

const RESPONSES_SUCCESS_BODY = JSON.stringify({
  id: "resp_synthetic_001",
  model: "review-model-synthetic",
  output_text: '{"summary":"Synthetic responses review.","verdict":"DISCUSS","comments":[],"suppressed_comments":[]}',
});

const BASE_CONFIG = {
  baseUrl: "https://provider.example/v1",
  apiKey: "sk-synthetic-secret-do-not-leak",
  model: "review-model-synthetic",
  system: "system prompt",
  user: "user prompt",
  requestTimeoutMs: 5_000,
} as const;

describe("openai-compatible provider client — retry on 429/5xx", () => {
  it("S7-RED-023 retries on 429 then succeeds on the second attempt", async () => {
    // Given: /responses returns 429 once, then 200 on the retry.
    const stub = makeFetchStub([
      { status: 429, body: "rate limited" },
      { status: 200, body: RESPONSES_SUCCESS_BODY },
    ]);

    // When: the client posts to the provider.
    const result = await runProviderRequest({
      ...BASE_CONFIG,
      requestTimeoutMs: 5_000,
      fetchImpl: stub.fetch,
    });

    // Then: the retry layer recovers via the second attempt and the responses endpoint is used.
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.endpoint).toBe("responses");
      expect(result.review).toEqual({
        summary: "Synthetic responses review.",
        verdict: "DISCUSS",
        comments: [],
        suppressed_comments: [],
      });
    }
    expect(stub.calls).toHaveLength(2);
    expect(stub.calls[0]?.url).toBe("https://provider.example/v1/responses");
    expect(stub.calls[1]?.url).toBe("https://provider.example/v1/responses");
  });

  it("S7-RED-024 retries on 500 then succeeds on the second attempt", async () => {
    // Given: /responses returns 500 once, then 200 on the retry.
    const stub = makeFetchStub([
      { status: 500, body: "boom" },
      { status: 200, body: RESPONSES_SUCCESS_BODY },
    ]);

    // When: the client posts to the provider.
    const result = await runProviderRequest({
      ...BASE_CONFIG,
      requestTimeoutMs: 5_000,
      fetchImpl: stub.fetch,
    });

    // Then: the retry layer recovers via the second attempt and the responses endpoint is used.
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.endpoint).toBe("responses");
    }
    expect(stub.calls).toHaveLength(2);
    expect(stub.calls[0]?.url).toBe("https://provider.example/v1/responses");
    expect(stub.calls[1]?.url).toBe("https://provider.example/v1/responses");
  });

  it("S7-RED-025 does NOT retry on 400 and surfaces the failure immediately", async () => {
    // Given: /responses returns 400 once, /chat/completions also returns 400 on the existing fallback path.
    // Two stubs are provided so the existing 400 fallback can complete without exhausting the stub helper.
    const stub = makeFetchStub([
      { status: 400, body: "bad" },
      { status: 400, body: "bad" },
    ]);

    // When: the client posts to the provider.
    const result = await runProviderRequest({
      ...BASE_CONFIG,
      fetchImpl: stub.fetch,
    });

    // Then: the failure is surfaced as a typed ProviderError and the retry layer did NOT add extra attempts
    // for the 400 status. Exactly one call per endpoint should have been made (no retries on 400).
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ProviderError);
      expect(["responses_4xx", "chat_4xx", "responses_retries_exhausted"]).toContain(result.error.code);
      expect(result.error.status).toBe(400);
    }
    // The retry layer must NOT add extra attempts on 400: at most one call per endpoint (responses then chat fallback).
    expect(stub.calls).toHaveLength(2);
    expect(stub.calls[0]?.url).toBe("https://provider.example/v1/responses");
    expect(stub.calls[1]?.url).toBe("https://provider.example/v1/chat/completions");
    // Specifically: no retry happened on /responses for the 400 — exactly one call to /responses.
    const responsesCallCount = stub.calls.filter(
      (call) => call.url === "https://provider.example/v1/responses",
    ).length;
    expect(responsesCallCount).toBe(1);
  });

  it("S7-RED-026 retries exhausted on persistent 429 returns a typed ProviderError after max attempts", async () => {
    // Given: /responses returns 429 for all attempts (1 initial + 2 retries = 3 calls).
    const stub = makeFetchStub([
      { status: 429, body: "rate limited 1" },
      { status: 429, body: "rate limited 2" },
      { status: 429, body: "rate limited 3" },
    ]);

    // When: the client retries until attempts are exhausted.
    const result = await runProviderRequest({
      ...BASE_CONFIG,
      requestTimeoutMs: 30_000,
      fetchImpl: stub.fetch,
    });

    // Then: the client surfaces a typed ProviderError indicating retry exhaustion after exactly 3 attempts.
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ProviderError);
      expect(["responses_4xx", "responses_retries_exhausted"]).toContain(result.error.code);
      expect(result.error.status).toBe(429);
      expect(result.error.endpoint).toBe("responses");
    }
    expect(stub.calls).toHaveLength(3);
    expect(stub.calls.every((call) => call.url === "https://provider.example/v1/responses")).toBe(true);
  });
});