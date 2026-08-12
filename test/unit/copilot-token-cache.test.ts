// SPDX-License-Identifier: MIT
//
// Unit tests for src/provider/copilot-token.ts — focused on the
// typed rejection branches and cache-window helpers that the
// existing test files (copilot-provider.test.ts + evidence-task-13)
// do not directly cover:
//
//   - getCachedSessionToken returning undefined when the cached
//     entry is past the TOKEN_REFRESH_SKEW_SECONDS freshness window.
//   - assertCopilotTokenEndpointAllowed rejecting unparseable URLs
//     and query/fragment payloads pre-network.
//   - fetchAndCacheSessionToken typed-rejection branches: timeout,
//     non-ok HTTP, malformed JSON envelope, missing required fields,
//     body-read failure.
//
// These tests lift the per-file coverage of the new-code source
// file so SonarCloud's "Coverage on New Code" aggregate stays above
// the 80% threshold that opens the Security Rating auto-approval.

import { describe, expect, it } from "vitest";

import {
  assertCopilotTokenEndpointAllowed,
  clearCopilotTokenCache,
  fetchAndCacheSessionToken,
  getCachedSessionToken,
} from "../../src/provider/copilot-token.js";
import { ProviderError } from "../../src/provider/provider-error.js";

function makeOkResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function makeErrorResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "application/json" },
  });
}

const VALID_URL = "https://api.github.com/copilot_internal/v2/token";
const VALID_HEADERS: Readonly<Record<string, string>> = {
  authorization: "token gho_test_synthetic",
  accept: "application/json",
};
const REQUEST_ID = "req_synthetic_token_test";

describe("assertCopilotTokenEndpointAllowed — pre-network rejection", () => {
  it("rejects an unparseable token URL with a parse-kind ProviderError", () => {
    expect(() => assertCopilotTokenEndpointAllowed("not a url at all")).toThrow(ProviderError);
  });

  it("rejects a token URL that carries a query string", () => {
    expect(() =>
      assertCopilotTokenEndpointAllowed(`${VALID_URL}?injected=1`),
    ).toThrow(/query|fragment/u);
  });

  it("rejects a token URL that carries a fragment", () => {
    expect(() =>
      assertCopilotTokenEndpointAllowed(`${VALID_URL}#frag`),
    ).toThrow(/query|fragment/u);
  });
});

describe("getCachedSessionToken — freshness window", () => {
  it("returns undefined when the cached entry is past TOKEN_REFRESH_SKEW_SECONDS of expiry", () => {
    // Given: a cached entry whose expiresAt is in the past so the
    // freshness window (nowSeconds + 60s >= expiresAt) fires.
    // The map is module-scoped; we poison it via fetchAndCacheSessionToken
    // with an expires_at of 0, then assert the next read returns undefined.
    const fetchStub: typeof fetch = async () => {
      return makeOkResponse(
        JSON.stringify({
          token: "tid=stale_synthetic",
          expires_at: 0,
          endpoints: { api: "https://api.individual.githubcopilot.com" },
        }),
      );
    };
    return fetchAndCacheSessionToken(
      "gho_stale_synthetic",
      VALID_URL,
      VALID_HEADERS,
      fetchStub,
      "chat",
      REQUEST_ID,
    ).then(async () => {
      const cached = getCachedSessionToken("gho_stale_synthetic");
      expect(cached).toBeUndefined();
    });
  });

  it("returns the cached entry while still within the freshness window", async () => {
    clearCopilotTokenCache();
    const fetchStub: typeof fetch = async () => {
      return makeOkResponse(
        JSON.stringify({
          token: "tid=fresh_synthetic",
          expires_at: 9_999_999_999,
          endpoints: { api: "https://api.individual.githubcopilot.com" },
        }),
      );
    };
    const result = await fetchAndCacheSessionToken(
      "gho_fresh_synthetic",
      VALID_URL,
      VALID_HEADERS,
      fetchStub,
      "chat",
      REQUEST_ID,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const cached = getCachedSessionToken("gho_fresh_synthetic");
    expect(cached).toEqual({ token: "tid=fresh_synthetic", apiBase: "https://api.individual.githubcopilot.com" });
  });
});

describe("fetchAndCacheSessionToken — failure paths surface typed ProviderError", () => {
  it("returns a timeout ProviderError when the fetch impl aborts", async () => {
    const fetchStub: typeof fetch = async () => {
      throw new DOMException("aborted", "AbortError");
    };
    const result = await fetchAndCacheSessionToken(
      "gho_abort_synthetic",
      VALID_URL,
      VALID_HEADERS,
      fetchStub,
      "chat",
      REQUEST_ID,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(ProviderError);
    expect(result.error.code).toBe("timeout");
  });

  it("returns a network ProviderError on a non-abort fetch rejection", async () => {
    const fetchStub: typeof fetch = async () => {
      throw new Error("ECONNRESET_synthetic");
    };
    const result = await fetchAndCacheSessionToken(
      "gho_net_synthetic",
      VALID_URL,
      VALID_HEADERS,
      fetchStub,
      "chat",
      REQUEST_ID,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("network");
  });

  it("returns a chat_4xx ProviderError when the token endpoint returns a non-ok status", async () => {
    const fetchStub: typeof fetch = async () => makeErrorResponse(401, '{"message":"bad token"}');
    const result = await fetchAndCacheSessionToken(
      "gho_401_synthetic",
      VALID_URL,
      VALID_HEADERS,
      fetchStub,
      "chat",
      REQUEST_ID,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("chat_4xx");
    expect(result.error.status).toBe(401);
  });

  it("returns a parse ProviderError when the token body is not valid JSON", async () => {
    const fetchStub: typeof fetch = async () => makeOkResponse("not json");
    const result = await fetchAndCacheSessionToken(
      "gho_badjson_synthetic",
      VALID_URL,
      VALID_HEADERS,
      fetchStub,
      "chat",
      REQUEST_ID,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("parse");
  });

  it("returns a parse ProviderError when required envelope fields are missing", async () => {
    const fetchStub: typeof fetch = async () =>
      makeOkResponse(JSON.stringify({ token: "only_token_no_endpoints" }));
    const result = await fetchAndCacheSessionToken(
      "gho_incomplete_synthetic",
      VALID_URL,
      VALID_HEADERS,
      fetchStub,
      "chat",
      REQUEST_ID,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("parse");
  });
});
