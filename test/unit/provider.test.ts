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
      expect(result.review.comments).toEqual([{ path: "src/x.ts", line: 3 }]);
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
});