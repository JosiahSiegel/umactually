// allow: SIZE_OK — single provider-http test file (≥5 Given/When/Then cases including the Copilot caller-aborted regression for the PR-#7 behavior change).
import { describe, expect, it } from "vitest";

import { performProviderFetch, readResponseText } from "../../src/provider/http.js";
import { ProviderError } from "../../src/provider/provider-error.js";

type FetchResponseInit = {
  readonly status: number;
  readonly body: string;
};

type RecordedRequest = {
  readonly url: string;
  readonly method: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly signal: AbortSignal | undefined;
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
    const requestUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const requestInit = init ?? {};
    const method = requestInit.method ?? "GET";
    const headers = new Headers(requestInit.headers);
    const rawBody = requestInit.body;
    const body = typeof rawBody === "string" ? rawBody : "";
    const headerRecord: Record<string, string> = {};
    headers.forEach((value, key) => {
      headerRecord[key.toLowerCase()] = value;
    });
    calls.push({
      url: requestUrl,
      method,
      headers: headerRecord,
      body,
      signal: requestInit.signal ?? undefined,
    });

    const slot = responses[index];
    if (slot === undefined) {
      throw new Error(`fetch stub exhausted at call #${index + 1}`);
    }
    index += 1;

    return new Response(slot.body, {
      status: slot.status,
      headers: { "content-type": "application/json" },
    });
  };

  return { calls, responses, fetch: stubbed };
}

const REQUEST_ID = "req-http-001";
const ENDPOINT_CHAT = "chat" as const;

function buildAnthropicHeaders(): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-api-key": "sk-synthetic",
    "anthropic-version": "2023-06-01",
    "x-request-id": REQUEST_ID,
  };
}

describe("performProviderFetch", () => {
  it("returns the raw Response on a 200 + JSON body without inspecting status", async () => {
    // Given: a fetch stub returning a 200 OK with a JSON body.
    const stub = makeFetchStub([
      { status: 200, body: '{"ok":true}' },
    ]);

    // When: the helper is invoked.
    const response = await performProviderFetch({
      url: "https://provider.example/v1/messages",
      body: JSON.stringify({ ping: 1 }),
      signal: undefined,
      requestId: REQUEST_ID,
      endpoint: ENDPOINT_CHAT,
      fetchImpl: stub.fetch,
      buildHeaders: buildAnthropicHeaders,
    });

    // Then: the helper returns the raw Response — `response.ok` is the
    // caller's signal to inspect, the helper does not translate 200.
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    expect(stub.calls).toHaveLength(1);
    expect(stub.calls[0]?.method).toBe("POST");
    expect(stub.calls[0]?.headers["x-api-key"]).toBe("sk-synthetic");
    expect(stub.calls[0]?.headers["x-request-id"]).toBe(REQUEST_ID);
    expect(stub.calls[0]?.body).toBe(JSON.stringify({ ping: 1 }));
  });

  it("returns a 4xx Response unchanged so the caller can throw with its endpoint-specific code", async () => {
    // Given: a fetch stub returning HTTP 401 with an error envelope.
    const stub = makeFetchStub([
      { status: 401, body: '{"error":"unauthorized"}' },
    ]);

    // When: the helper is invoked.
    const response = await performProviderFetch({
      url: "https://provider.example/v1/messages",
      body: "{}",
      signal: undefined,
      requestId: REQUEST_ID,
      endpoint: ENDPOINT_CHAT,
      fetchImpl: stub.fetch,
      buildHeaders: buildAnthropicHeaders,
    });

    // Then: the helper passes the 4xx Response through. The
    // caller-side `chat_4xx` / `responses_4xx` / `anthropic_4xx` mapping
    // stays at the call site (false-DRY §4.9 — each endpoint family
    // owns its own 4xx code). The helper does NOT throw.
    expect(response.ok).toBe(false);
    expect(response.status).toBe(401);
  });

  it("translates a fetchImpl connection failure into ProviderError('network')", async () => {
    // Given: a fetch stub that throws a connection-reset-style error.
    const failingFetch: typeof fetch = async () => {
      throw new Error("ECONNRESET: connection reset by peer");
    };

    // When/Then: the helper rethrows as a typed ProviderError.
    await expect(
      performProviderFetch({
        url: "https://provider.example/v1/messages",
        body: "{}",
        signal: undefined,
        requestId: REQUEST_ID,
        endpoint: ENDPOINT_CHAT,
        fetchImpl: failingFetch,
        buildHeaders: buildAnthropicHeaders,
      }),
    ).rejects.toMatchObject({
      name: "ProviderError",
      code: "network",
      endpoint: ENDPOINT_CHAT,
      status: null,
      requestId: REQUEST_ID,
    });
  });

  it("translates an abort-error during fetch into ProviderError('timeout')", async () => {
    // Given: a fetch stub that throws an AbortError (mimics the
    // composed timeout signal firing during the request).
    const abortingFetch: typeof fetch = async () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      throw error;
    };

    // When/Then: the helper surfaces a typed timeout error.
    await expect(
      performProviderFetch({
        url: "https://provider.example/v1/messages",
        body: "{}",
        signal: new AbortController().signal, // not pre-aborted — abort fires during fetch
        requestId: REQUEST_ID,
        endpoint: ENDPOINT_CHAT,
        fetchImpl: abortingFetch,
        buildHeaders: buildAnthropicHeaders,
      }),
    ).rejects.toMatchObject({
      name: "ProviderError",
      code: "timeout",
      endpoint: ENDPOINT_CHAT,
      status: null,
      requestId: REQUEST_ID,
    });
  });

  it("throws ProviderError('aborted') when signal.aborted === true and never invokes fetchImpl", async () => {
    // Given: a pre-aborted AbortSignal and a fetch stub that records calls.
    const controller = new AbortController();
    controller.abort();
    const stub = makeFetchStub([]);

    // When/Then: the helper short-circuits BEFORE invoking fetchImpl.
    await expect(
      performProviderFetch({
        url: "https://provider.example/v1/messages",
        body: "{}",
        signal: controller.signal,
        requestId: REQUEST_ID,
        endpoint: ENDPOINT_CHAT,
        fetchImpl: stub.fetch,
        buildHeaders: buildAnthropicHeaders,
      }),
    ).rejects.toBeInstanceOf(ProviderError);

    await expect(
      performProviderFetch({
        url: "https://provider.example/v1/messages",
        body: "{}",
        signal: controller.signal,
        requestId: REQUEST_ID,
        endpoint: ENDPOINT_CHAT,
        fetchImpl: stub.fetch,
        buildHeaders: buildAnthropicHeaders,
      }),
    ).rejects.toMatchObject({
      name: "ProviderError",
      code: "aborted",
      endpoint: ENDPOINT_CHAT,
      status: null,
      requestId: REQUEST_ID,
    });
    expect(stub.calls).toHaveLength(0);
  });
});

describe("readResponseText", () => {
  it("reads the response body when response.text() resolves", async () => {
    // Given: a 200 OK with a JSON body.
    const response = new Response('{"summary":"hi","verdict":"SHIP"}', {
      status: 200,
      headers: { "content-type": "application/json" },
    });

    // When: the helper reads the body.
    const text = await readResponseText(response, ENDPOINT_CHAT, REQUEST_ID);

    // Then: it returns the raw text exactly as response.text() would.
    expect(text).toBe('{"summary":"hi","verdict":"SHIP"}');
  });

  it("translates a response.text() failure into ProviderError('parse')", async () => {
    // Given: a Response whose .text() throws (simulated by overriding
    // the prototype's text method).
    const response = new Response("body", { status: 200 });
    Object.defineProperty(response, "text", {
      value: () => Promise.reject(new Error("stream closed unexpectedly")),
      configurable: true,
    });

    // When/Then: the helper rethrows as a typed parse error carrying
    // the original response status.
    await expect(
      readResponseText(response, ENDPOINT_CHAT, REQUEST_ID),
    ).rejects.toMatchObject({
      name: "ProviderError",
      code: "parse",
      endpoint: ENDPOINT_CHAT,
      status: 200,
      requestId: REQUEST_ID,
    });
  });
});

describe("Copilot caller-aborted regression (PR-#7 behavior change)", () => {
  it("performProviderFetch throws ProviderError('aborted') with a pre-aborted signal and never invokes fetchImpl", async () => {
    // Given: the new helper routed through by the Copilot call site,
    // an already-aborted signal, and a fetchImpl that MUST NOT be called.
    const controller = new AbortController();
    controller.abort();
    let fetchCalls = 0;
    const recordingFetch: typeof fetch = async () => {
      fetchCalls += 1;
      return new Response("{}", { status: 200 });
    };

    // When: the helper is invoked with the pre-aborted signal — this
    // is the byte-identical call shape Copilot's runChatCall uses
    // (just with the new buildHeaders/performProviderFetch shape).
    let caught: unknown = null;
    try {
      await performProviderFetch({
        url: "https://api.individual.githubcopilot.com/chat/completions",
        body: JSON.stringify({ ping: 1 }),
        signal: controller.signal,
        requestId: REQUEST_ID,
        endpoint: ENDPOINT_CHAT,
        fetchImpl: recordingFetch,
        buildHeaders: () => ({ "content-type": "application/json" }),
      });
    } catch (error) {
      caught = error;
    }

    // Then: the result is the equivalent of `{ ok: false, error: { code: "aborted" } }` —
    // a ProviderError("aborted") with the chat endpoint, no status, and
    // the requestId threaded through.
    expect(caught).toBeInstanceOf(ProviderError);
    expect(caught).toMatchObject({
      name: "ProviderError",
      code: "aborted",
      endpoint: ENDPOINT_CHAT,
      status: null,
      requestId: REQUEST_ID,
    });
    expect(fetchCalls).toBe(0);
  });
});