// SPDX-License-Identifier: MIT
//
// Unit tests for src/util/http.ts. The module exports the header-set
// helpers (authHeaders, githubHeaders, azureHeaders), truncateBodyForLog,
// and the typed fetch-or-throw helpers (fetchTextOrThrow, fetchJsonOrThrow).
// Each public helper is exercised on its happy + error branches against
// a stub fetch so the typed-error contract is locked.

import { describe, expect, it } from "vitest";

import {
  authHeaders,
  azureHeaders,
  fetchJsonOrThrow,
  fetchTextOrThrow,
  githubHeaders,
  truncateBodyForLog,
} from "../../src/util/http.js";
import { USER_AGENT } from "../../src/util/brand.js";

class FakeHttpError extends Error {
  override readonly name = "FakeHttpError";
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function makeFetchStub(
  responses: readonly { status: number; body: string }[],
): {
  readonly fetchImpl: typeof fetch;
  readonly calls: { url: string; init: RequestInit | undefined }[];
} {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  let index = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    const slot = responses[index];
    if (!slot) throw new Error(`fetch stub exhausted at call #${index + 1}`);
    index += 1;
    return new Response(slot.body, {
      status: slot.status,
      headers: { "content-type": "application/json" },
    });
  };
  return { fetchImpl, calls };
}

describe("authHeaders", () => {
  it("builds bearer + Accept + UA + Content-Type by default", () => {
    const headers = authHeaders("token-abc");
    expect(headers["Authorization"]).toBe("Bearer token-abc");
    expect(headers["Accept"]).toBe("application/json");
    expect(headers["User-Agent"]).toBe(USER_AGENT);
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("honors a custom mediaType (used by githubHeaders via application/vnd.github+json)", () => {
    const headers = authHeaders("t", { mediaType: "application/vnd.github+json" });
    expect(headers["Accept"]).toBe("application/vnd.github+json");
  });

  it("omits Content-Type when contentType=false", () => {
    const headers = authHeaders("t", { contentType: false });
    expect(headers["Content-Type"]).toBeUndefined();
    expect(headers["Authorization"]).toBe("Bearer t");
  });

  it("merges extra headers last so they win on collision", () => {
    const headers = authHeaders("t", {
      extra: { Accept: "text/plain", "X-Custom": "yes" },
    });
    expect(headers["Accept"]).toBe("text/plain");
    expect(headers["X-Custom"]).toBe("yes");
  });
});

describe("githubHeaders", () => {
  it("returns bearer + vnd.github+json + pinned X-GitHub-Api-Version header", () => {
    const headers = githubHeaders("token-xyz");
    expect(headers["Authorization"]).toBe("Bearer token-xyz");
    expect(headers["Accept"]).toBe("application/vnd.github+json");
    expect(headers["X-GitHub-Api-Version"]).toBe("2026-03-10");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["User-Agent"]).toBe(USER_AGENT);
  });
});

describe("azureHeaders", () => {
  it("returns bearer + JSON Accept without a github-style version header", () => {
    const headers = azureHeaders("azure-token");
    expect(headers["Authorization"]).toBe("Bearer azure-token");
    expect(headers["Accept"]).toBe("application/json");
    expect(headers["X-GitHub-Api-Version"]).toBeUndefined();
  });
});

describe("truncateBodyForLog", () => {
  it("returns the original text when shorter than maxLen", () => {
    expect(truncateBodyForLog("short body", 100)).toBe("short body");
  });

  it("truncates at maxLen and appends the marker suffix when over the limit", () => {
    const text = "x".repeat(20);
    const truncated = truncateBodyForLog(text, 10);
    expect(truncated).toBe("xxxxxxxxxx…(truncated)");
    expect(truncated.length).toBe(10 + "…(truncated)".length);
  });

  it("defaults maxLen to 500 when no max is supplied", () => {
    const text = "y".repeat(600);
    const truncated = truncateBodyForLog(text);
    expect(truncated).toBe("y".repeat(500) + "…(truncated)");
  });

  it("returns the original text when exactly at maxLen", () => {
    const text = "z".repeat(10);
    expect(truncateBodyForLog(text, 10)).toBe(text);
  });
});

describe("fetchTextOrThrow — happy + failure paths", () => {
  it("returns the response body text on a 2xx response", async () => {
    // Given: a 200 OK with a JSON body.
    const stub = makeFetchStub([{ status: 200, body: '{"diff":"hello"}' }]);

    // When: the helper is invoked.
    const text = await fetchTextOrThrow(
      stub.fetchImpl,
      { url: "https://api.example.com/pr/1.diff", headers: { Authorization: "Bearer t" } },
      {
        error: FakeHttpError,
        failCode: "FETCH_FAILED",
        emptyCode: "EMPTY_BODY",
        platform: "example",
      },
    );

    // Then: the body text is returned and the request method/headers
    // were set per the helper's contract.
    expect(text).toBe('{"diff":"hello"}');
    expect(stub.calls).toHaveLength(1);
    expect(stub.calls[0]?.init?.method).toBe("GET");
    expect(stub.calls[0]?.url).toBe("https://api.example.com/pr/1.diff");
  });

  it("throws the platform-specific error on a non-2xx response (fail code branch)", async () => {
    // Given: a 401 response from the stub.
    const stub = makeFetchStub([{ status: 401, body: '{"error":"unauthorized"}' }]);

    // When/Then: the helper throws with the fail code and the 401 status.
    await expect(
      fetchTextOrThrow(
        stub.fetchImpl,
        { url: "https://api.example.com/x", headers: {} },
        {
          error: FakeHttpError,
          failCode: "FETCH_FAILED",
          emptyCode: "EMPTY_BODY",
          platform: "example",
        },
      ),
    ).rejects.toMatchObject({
      name: "FakeHttpError",
      code: "FETCH_FAILED",
      status: 401,
      message: "example request failed with status 401.",
    });
  });

  it("throws the empty-code variant when the 2xx body is empty", async () => {
    // Given: a 200 OK with an empty body.
    const stub = makeFetchStub([{ status: 200, body: "" }]);

    // When/Then: the helper throws the empty-code variant.
    await expect(
      fetchTextOrThrow(
        stub.fetchImpl,
        { url: "https://api.example.com/x", headers: {} },
        {
          error: FakeHttpError,
          failCode: "FETCH_FAILED",
          emptyCode: "EMPTY_BODY",
          platform: "example",
        },
      ),
    ).rejects.toMatchObject({
      name: "FakeHttpError",
      code: "EMPTY_BODY",
      status: 200,
      message: "example response body was empty.",
    });
  });
});

describe("fetchJsonOrThrow — happy + failure paths", () => {
  it("returns the parsed JSON body on a 2xx response", async () => {
    // Given: a 200 OK with a JSON object body.
    const stub = makeFetchStub([{ status: 200, body: '{"threadId":42}' }]);

    // When: the helper is invoked.
    const parsed = await fetchJsonOrThrow(
      stub.fetchImpl,
      {
        url: "https://api.example.com/threads",
        method: "POST",
        headers: { Authorization: "Bearer t" },
        body: { content: "hi" },
      },
      {
        error: FakeHttpError,
        code: "CREATE_THREAD_FAILED",
        action: "create thread",
      },
    );

    // Then: the parsed JSON shape is returned and the request body
    // was serialized via JSON.stringify (not the raw object).
    expect(parsed).toEqual({ threadId: 42 });
    expect(stub.calls).toHaveLength(1);
    const init = stub.calls[0]?.init;
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe('{"content":"hi"}');
  });

  it("passes a string body through verbatim (no re-serialization)", async () => {
    // Given: a pre-serialized JSON string body.
    const stub = makeFetchStub([{ status: 200, body: "{}" }]);

    // When: the helper is invoked.
    await fetchJsonOrThrow(
      stub.fetchImpl,
      {
        url: "https://api.example.com/x",
        method: "POST",
        headers: {},
        body: '{"already":"serialized"}',
      },
      { error: FakeHttpError, code: "POST_FAILED", action: "post" },
    );

    // Then: the body is forwarded verbatim, not re-stringified.
    expect(stub.calls[0]?.init?.body).toBe('{"already":"serialized"}');
  });

  it("omits the body field entirely when no body is supplied", async () => {
    // Given: a request shape with no body.
    const stub = makeFetchStub([{ status: 200, body: "" }]);

    // When: the helper is invoked.
    await fetchJsonOrThrow(
      stub.fetchImpl,
      {
        url: "https://api.example.com/x",
        method: "DELETE",
        headers: {},
      },
      { error: FakeHttpError, code: "DELETE_FAILED", action: "delete" },
    );

    // Then: the request init does not include `body` (POST/PUT/PATCH
    // requests without a body must not send Content-Length: 0).
    expect(stub.calls[0]?.init?.body).toBeUndefined();
  });

  it("returns null when the 2xx body is empty (legitimately-empty DELETE)", async () => {
    // Given: a 200 OK with an empty body (mirrors the DELETE-204 case
    // — the helper returns null for any 2xx with empty text so the
    // `(await fetchJsonOrThrow(...)) ?? null` idiom works).
    const stub = makeFetchStub([{ status: 200, body: "" }]);

    // When: the helper is invoked.
    const parsed = await fetchJsonOrThrow(
      stub.fetchImpl,
      {
        url: "https://api.example.com/x",
        method: "DELETE",
        headers: {},
      },
      { error: FakeHttpError, code: "DELETE_FAILED", action: "delete" },
    );

    // Then: null is returned so call sites can use the `?? null` idiom.
    expect(parsed).toBeNull();
  });

  it("throws the typed error on a non-2xx response", async () => {
    // Given: a 500 Internal Server Error.
    const stub = makeFetchStub([{ status: 500, body: "{}" }]);

    // When/Then: the helper throws with the action and HTTP status.
    await expect(
      fetchJsonOrThrow(
        stub.fetchImpl,
        {
          url: "https://api.example.com/x",
          method: "POST",
          headers: {},
          body: {},
        },
        { error: FakeHttpError, code: "POST_FAILED", action: "create resource" },
      ),
    ).rejects.toMatchObject({
      name: "FakeHttpError",
      code: "POST_FAILED",
      status: 500,
      message: "create resource failed with HTTP 500.",
    });
  });

  it("propagates SyntaxError when the 2xx body is non-empty and non-JSON", async () => {
    // Given: a 200 OK with an unparseable body.
    const stub = makeFetchStub([{ status: 200, body: "not json" }]);

    // When/Then: JSON.parse throws SyntaxError (the helper does not
    // catch parse failures — they bubble up to the caller).
    await expect(
      fetchJsonOrThrow(
        stub.fetchImpl,
        {
          url: "https://api.example.com/x",
          method: "POST",
          headers: {},
          body: {},
        },
        { error: FakeHttpError, code: "POST_FAILED", action: "post" },
      ),
    ).rejects.toBeInstanceOf(SyntaxError);
  });

  it.each([
    ["array body", ["a", "b"], '["a","b"]'],
    ["nested object body", { outer: { inner: 1 } }, '{"outer":{"inner":1}}'],
  ] as const)(
    "serializes %s via JSON.stringify",
    async (_label, body, expectedBody) => {
      const stub = makeFetchStub([{ status: 200, body: "{}" }]);

      await fetchJsonOrThrow(
        stub.fetchImpl,
        {
          url: "https://api.example.com/x",
          method: "POST",
          headers: {},
          body,
        },
        { error: FakeHttpError, code: "POST_FAILED", action: "post" },
      );

      expect(stub.calls[0]?.init?.body).toBe(expectedBody);
    },
  );
});
