// allow: SIZE_OK — single provider-contract test file (9 Given/When/Then cases + one shared stub helper)
import { describe, expect, it, vi } from "vitest";

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

const CHAT_SUCCESS_BODY = JSON.stringify({
  id: "chatcmpl_synthetic_001",
  model: "review-model-synthetic",
  choices: [
    {
      message: {
        role: "assistant",
        content: '{"summary":"Synthetic chat fallback review.","verdict":"SHIP","comments":[],"suppressed_comments":[]}',
      },
      finish_reason: "stop",
    },
  ],
});

const BASE_CONFIG = {
  baseUrl: "https://provider.example/v1",
  apiKey: "sk-synthetic-secret-do-not-leak",
  model: "review-model-synthetic",
  system: "system prompt",
  user: "user prompt",
  requestTimeoutMs: 5_000,
} as const;

describe("openai-compatible provider client", () => {
  it("PROV-UNIT-001 returns ProviderCallResult.ok with parsed JSON on /responses success", async () => {
    // Given: a stubbed /responses endpoint that returns a 200 with JSON in output_text.
    const stub = makeFetchStub([{ status: 200, body: RESPONSES_SUCCESS_BODY }]);

    // When: the client posts to the provider.
    const result = await runProviderRequest({ ...BASE_CONFIG, fetchImpl: stub.fetch });

    // Then: it returns ok with the parsed JSON and called /responses exactly once.
    expect(result).toEqual({
      ok: true,
      endpoint: "responses",
      review: {
        summary: "Synthetic responses review.",
        verdict: "DISCUSS",
        comments: [],
        suppressed_comments: [],
      },
      requestId: expect.stringMatching(/^[0-9a-f-]+$/) as unknown as string,
    });
    expect(stub.calls).toHaveLength(1);
    expect(stub.calls[0]?.url).toBe("https://provider.example/v1/responses");
    expect(stub.calls[0]?.method).toBe("POST");
    expect(stub.calls[0]?.authorization).toBe("Bearer sk-synthetic-secret-do-not-leak");
  });

  it("PROV-UNIT-002 falls back to /chat/completions when /responses returns 404", async () => {
    // Given: /responses returns 404, /chat/completions returns 200.
    const stub = makeFetchStub([
      { status: 404, body: '{"error":"not_found"}' },
      { status: 200, body: CHAT_SUCCESS_BODY },
    ]);

    // When: the client tries /responses then /chat/completions.
    const result = await runProviderRequest({ ...BASE_CONFIG, fetchImpl: stub.fetch });

    // Then: it returns ok from the chat endpoint and called both in order.
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.endpoint).toBe("chat");
      expect(result.review).toEqual({
        summary: "Synthetic chat fallback review.",
        verdict: "SHIP",
        comments: [],
        suppressed_comments: [],
      });
    }
    expect(stub.calls.map((call) => call.url)).toEqual([
      "https://provider.example/v1/responses",
      "https://provider.example/v1/chat/completions",
    ]);
  });

  it("PROV-UNIT-003 falls back when /responses returns 400 with unsupported_parameter", async () => {
    // Given: /responses rejects with 400 mentioning unsupported_parameter (chat-only endpoint).
    const stub = makeFetchStub([
      { status: 400, body: '{"error":"unsupported_parameter"}' },
      { status: 200, body: CHAT_SUCCESS_BODY },
    ]);

    // When: the client encounters the unsupported marker.
    const result = await runProviderRequest({ ...BASE_CONFIG, fetchImpl: stub.fetch });

    // Then: it transparently retries on /chat/completions.
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.endpoint).toBe("chat");
    }
  });

  it("PROV-UNIT-004 parses raw JSON directly from /responses output_text", async () => {
    // Given: a /responses body whose output_text is itself the review JSON (no fence).
    const reviewText =
      '{"summary":"raw output_text path","verdict":"DISCUSS","comments":[{"path":"src/x.ts","line":3}],"suppressed_comments":[]}';
    const stub = makeFetchStub([
      { status: 200, body: JSON.stringify({ output_text: reviewText }) },
    ]);

    // When: the client parses the response.
    const result = await runProviderRequest({ ...BASE_CONFIG, fetchImpl: stub.fetch });

    // Then: it returns the parsed review with comments preserved.
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.review.summary).toBe("raw output_text path");
      expect(result.review.verdict).toBe("DISCUSS");
      expect(result.review.comments).toEqual([
        { path: "src/x.ts", line: 3, body: "", severity: "medium", category: "general" },
      ]);
    }
  });

  it("PROV-UNIT-005 parses raw JSON from /chat/completions choices[].message.content", async () => {
    // Given: /responses is unavailable, /chat/completions returns content that is itself JSON.
    const reviewText =
      '{"summary":"raw choices content","verdict":"SHIP","comments":[],"suppressed_comments":[]}';
    const stub = makeFetchStub([
      { status: 404, body: "{}" },
      {
        status: 200,
        body: JSON.stringify({
          choices: [
            { message: { role: "assistant", content: reviewText }, finish_reason: "stop" },
          ],
        }),
      },
    ]);

    // When: the client parses the chat fallback response.
    const result = await runProviderRequest({ ...BASE_CONFIG, fetchImpl: stub.fetch });

    // Then: it extracts the summary/verdict from the assistant message content.
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.endpoint).toBe("chat");
      expect(result.review.summary).toBe("raw choices content");
      expect(result.review.verdict).toBe("SHIP");
    }
  });

  it("PROV-UNIT-006 fires AbortController timeout within 1s when the provider hangs", async () => {
    // Given: a fetch stub that hangs until aborted.
    const hangingFetch: typeof fetch = (_input, init) =>
      new Promise<Response>((_, reject) => {
        const signal = init?.signal ?? null;
        if (signal === null) {
          reject(new Error("expected abort signal"));
          return;
        }
        signal.addEventListener("abort", () => {
          const abortError = new Error("aborted");
          abortError.name = "AbortError";
          reject(abortError);
        });
      });

    // When: the client is given a 50ms timeout.
    const start = Date.now();
    const result = await runProviderRequest({
      ...BASE_CONFIG,
      requestTimeoutMs: 50,
      fetchImpl: hangingFetch,
    });
    const elapsed = Date.now() - start;

    // Then: it fails fast with a timeout ProviderError within 1s.
    expect(elapsed).toBeLessThan(1_000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ProviderError);
      expect(result.error.code).toBe("timeout");
      expect(result.error.message.toLowerCase()).toContain("timed out");
    }
  });

  it("PROV-UNIT-007 sanitizes ProviderError so it never leaks the Authorization header", async () => {
    // Given: a /responses 401 whose body references the API key value indirectly via the secret.
    const bodyText =
      "Authentication failed: sk-synthetic-secret-do-not-leak is not authorized. request-id=req_abc";
    const stub = makeFetchStub([{ status: 401, body: bodyText, contentType: "text/plain" }]);

    // When: the request fails.
    const result = await runProviderRequest({ ...BASE_CONFIG, fetchImpl: stub.fetch });

    // Then: the typed ProviderError carries a sanitized message and code, never the raw body or API key.
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ProviderError);
      expect(result.error.code).toBe("responses_4xx");
      expect(result.error.message).not.toContain("sk-synthetic-secret-do-not-leak");
      expect(result.error.message).not.toContain("Bearer sk-synthetic-secret-do-not-leak");
      expect(result.error.message).not.toContain(bodyText);
    }
  });

  it("PROV-UNIT-008 emits a parse ProviderError when both endpoints return unparseable output", async () => {
    // Given: /responses returns 200 with no extractable JSON, /chat fallback likewise.
    const stub = makeFetchStub([
      { status: 200, body: JSON.stringify({ output_text: "no JSON anywhere here" }) },
      { status: 200, body: JSON.stringify({ choices: [{ message: { content: "still no JSON" } }] }) },
    ]);

    // When: the client runs out of places to find a review.
    const result = await runProviderRequest({ ...BASE_CONFIG, fetchImpl: stub.fetch });

    // Then: it surfaces a typed parse error.
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ProviderError);
      expect(result.error.code).toBe("parse");
    }
  });

  it("PROV-UNIT-009 forwards AbortSignal from caller and emits aborted ProviderError when fired", async () => {
    // Given: a caller-provided AbortController and a fetch that observes the signal.
    const controller = new AbortController();
    const fetchSpy = vi.fn<typeof fetch>(async (_input, init) => {
      const signal = init?.signal;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          const abortError = new Error("aborted");
          abortError.name = "AbortError";
          reject(abortError);
        });
      });
    });

    // When: the caller aborts the request after starting it.
    const pending = runProviderRequest({
      ...BASE_CONFIG,
      fetchImpl: fetchSpy as unknown as typeof fetch,
      signal: controller.signal,
    });
    queueMicrotask(() => controller.abort());
    const result = await pending;

    // Then: it returns an aborted ProviderError.
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ProviderError);
      expect(result.error.code).toBe("aborted");
    }
  });

  it("PROV-UNIT-010 emits max_output_tokens on /responses body when maxOutputTokens is configured", async () => {
    // Given: a /responses success stub and a caller-provided maxOutputTokens of 16_000.
    const stub = makeFetchStub([{ status: 200, body: RESPONSES_SUCCESS_BODY }]);

    // When: the client posts with the token budget set.
    const result = await runProviderRequest({
      ...BASE_CONFIG,
      maxOutputTokens: 16_000,
      fetchImpl: stub.fetch,
    });

    // Then: the /responses body carries max_output_tokens at the top level (snake_case wire shape).
    expect(result.ok).toBe(true);
    const recordedBody = stub.calls[0]?.body as Record<string, unknown> | null;
    expect(recordedBody).not.toBeNull();
    expect(recordedBody?.["max_output_tokens"]).toBe(16_000);
  });

  it("PROV-UNIT-011 emits max_tokens on /chat/completions body when maxOutputTokens is configured (fallback path)", async () => {
    // Given: /responses 404 forces fallback to /chat/completions, and maxOutputTokens is configured.
    const stub = makeFetchStub([
      { status: 404, body: "{}" },
      { status: 200, body: CHAT_SUCCESS_BODY },
    ]);

    // When: the client posts with the token budget set.
    const result = await runProviderRequest({
      ...BASE_CONFIG,
      maxOutputTokens: 16_000,
      fetchImpl: stub.fetch,
    });

    // Then: the /chat/completions body carries max_tokens at the top level (snake_case wire shape).
    expect(result.ok).toBe(true);
    expect(stub.calls).toHaveLength(2);
    const chatBody = stub.calls[1]?.body as Record<string, unknown> | null;
    expect(chatBody).not.toBeNull();
    expect(chatBody?.["max_tokens"]).toBe(16_000);
  });

  it('PROV-UNIT-012 emits reasoning: { effort: "medium" } (nested object) on /responses body when reasoningEffort is configured', async () => {
    // Given: a /responses success stub and a caller-provided reasoningEffort of "medium".
    const stub = makeFetchStub([{ status: 200, body: RESPONSES_SUCCESS_BODY }]);

    // When: the client posts with the reasoning effort set.
    const result = await runProviderRequest({
      ...BASE_CONFIG,
      reasoningEffort: "medium",
      fetchImpl: stub.fetch,
    });

    // Then: the /responses body carries reasoning as a nested object with an effort key.
    expect(result.ok).toBe(true);
    const recordedBody = stub.calls[0]?.body as Record<string, unknown> | null;
    expect(recordedBody).not.toBeNull();
    const reasoning = recordedBody?.["reasoning"];
    expect(reasoning).toEqual({ effort: "medium" });
    expect((reasoning as Record<string, unknown> | null)?.["effort"]).toBe("medium");
  });

  it('PROV-UNIT-013 emits reasoning_effort: "high" (top-level string) on /chat/completions body when reasoningEffort is configured', async () => {
    // Given: /responses 404 forces fallback to /chat/completions, and reasoningEffort is configured.
    const stub = makeFetchStub([
      { status: 404, body: "{}" },
      { status: 200, body: CHAT_SUCCESS_BODY },
    ]);

    // When: the client posts with the reasoning effort set.
    const result = await runProviderRequest({
      ...BASE_CONFIG,
      reasoningEffort: "high",
      fetchImpl: stub.fetch,
    });

    // Then: the /chat/completions body carries reasoning_effort as a top-level string.
    expect(result.ok).toBe(true);
    expect(stub.calls).toHaveLength(2);
    const chatBody = stub.calls[1]?.body as Record<string, unknown> | null;
    expect(chatBody).not.toBeNull();
    expect(chatBody?.["reasoning_effort"]).toBe("high");
  });

  it("PROV-UNIT-014 omits max_output_tokens and reasoning from /responses body when neither is configured", async () => {
    // Given: a /responses success stub and BASE_CONFIG (no token budget, no reasoning effort).
    const stub = makeFetchStub([{ status: 200, body: RESPONSES_SUCCESS_BODY }]);

    // When: the client posts with defaults only.
    const result = await runProviderRequest({ ...BASE_CONFIG, fetchImpl: stub.fetch });

    // Then: the /responses body does NOT carry max_output_tokens nor reasoning.
    expect(result.ok).toBe(true);
    const recordedBody = stub.calls[0]?.body as Record<string, unknown> | null;
    expect(recordedBody).not.toBeNull();
    expect(recordedBody).not.toHaveProperty("max_output_tokens");
    expect(recordedBody).not.toHaveProperty("reasoning");
  });

  const SSE_CHAT_BODY = [
    'data: {"id":"chatcmpl-001","object":"chat.completion.chunk","created":1,"model":"auto","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}',
    "",
    'data: {"id":"chatcmpl-002","object":"chat.completion.chunk","created":1,"model":"auto","choices":[{"index":0,"delta":{"content":"{\\"summary\\":\\"SSE review.\\","},"finish_reason":null}]}',
    "",
    'data: {"id":"chatcmpl-003","object":"chat.completion.chunk","created":1,"model":"auto","choices":[{"index":0,"delta":{"content":"\\"verdict\\":\\"DISCUSS\\",\\"comments\\":[],\\"suppressed_comments\\":[]}"},"finish_reason":null}]}',
    "",
    'data: {"id":"chatcmpl-004","object":"chat.completion.chunk","created":1,"model":"auto","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
    "",
    'data: {"id":"chatcmpl-005","object":"chat.completion.chunk","created":1,"model":"auto","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":20,"total_tokens":30}}',
    "",
    "data: [DONE]",
    "",
  ].join("\n");

  it("PROV-UNIT-015 parses SSE streaming chat response (data: lines) as concatenated content", async () => {
    // Given: /responses 404 forces fallback, /chat/completions returns SSE stream
    // (some providers like Manifest ignore stream:false and always stream).
    const stub = makeFetchStub([
      { status: 404, body: "{}" },
      { status: 200, body: SSE_CHAT_BODY, contentType: "text/event-stream" },
    ]);

    // When: the client parses the SSE-formatted chat response.
    const result = await runProviderRequest({ ...BASE_CONFIG, fetchImpl: stub.fetch });

    // Then: it concatenates delta.content from all data: chunks and parses the review JSON.
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.endpoint).toBe("chat");
      expect(result.review.summary).toBe("SSE review.");
      expect(result.review.verdict).toBe("DISCUSS");
    }
  });

  it("PROV-UNIT-016 parses SSE streaming responses response (data: lines) as concatenated content", async () => {
    // Given: /responses returns SSE stream directly (no fallback).
    const sseBody = [
      'data: {"id":"resp-001","type":"response.output_text.delta","delta":"{\\"summary\\":\\"SSE responses.\\",\\"verdict\\":\\"SHIP\\",\\"comments\\":[],\\"suppressed_comments\\":[]}"}',
      "",
      "data: [DONE]",
      "",
    ].join("\n");
    const stub = makeFetchStub([
      { status: 200, body: sseBody, contentType: "text/event-stream" },
    ]);

    // When: the client parses the SSE-formatted responses response.
    const result = await runProviderRequest({ ...BASE_CONFIG, fetchImpl: stub.fetch });

    // Then: it extracts the delta text and parses the review JSON.
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.endpoint).toBe("responses");
      expect(result.review.summary).toBe("SSE responses.");
      expect(result.review.verdict).toBe("SHIP");
    }
  });

  it("PROV-UNIT-017 still parses non-SSE JSON responses correctly after SSE support added", async () => {
    // Given: a standard JSON /responses body (regression test).
    const stub = makeFetchStub([{ status: 200, body: RESPONSES_SUCCESS_BODY }]);

    // When: the client parses the standard JSON response.
    const result = await runProviderRequest({ ...BASE_CONFIG, fetchImpl: stub.fetch });

    // Then: it returns ok with the parsed JSON (no regression).
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.endpoint).toBe("responses");
      expect(result.review.summary).toBe("Synthetic responses review.");
    }
  });
});