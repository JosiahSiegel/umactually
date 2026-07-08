// Pins the auto-insert /v1/ behavior on the openai-compatible provider's
// base URL resolution. Bare-host URLs (no path segment) get `/v1`
// prepended so OpenAI-style routes resolve correctly. URLs that already
// carry a path segment are returned unchanged so operators can opt into
// a custom namespace.
//
// Regression: the GH self-review on PR #28 returned HTTP 404 because the
// user-supplied `UMACTUALLY_API_URL` was a bare host (no `/v1/`); the
// action then called `${url}/responses` which 404'd, and the chat
// fallback also 404'd. This test pins the auto-resolve contract so a
// bare host gets the default prefix without operator action.
import { describe, expect, it } from "vitest";

import { resolveProviderBaseUrl } from "../../src/util/url.js";

describe("resolveProviderBaseUrl: auto-insert /v1/ on bare hosts", () => {
  it("appends /v1 to a bare HTTPS host", () => {
    expect(resolveProviderBaseUrl("https://api.example.com")).toBe(
      "https://api.example.com/v1",
    );
  });

  it("appends /v1 to a bare HTTPS host with trailing slash", () => {
    expect(resolveProviderBaseUrl("https://api.example.com/")).toBe(
      "https://api.example.com/v1",
    );
  });

  it("appends /v1 to a bare HTTP host", () => {
    expect(resolveProviderBaseUrl("http://localhost:8080")).toBe(
      "http://localhost:8080/v1",
    );
  });

  it("does NOT modify a URL that already has /v1", () => {
    expect(resolveProviderBaseUrl("https://api.example.com/v1")).toBe(
      "https://api.example.com/v1",
    );
  });

  it("does NOT modify a URL with a non-v1 namespace", () => {
    expect(resolveProviderBaseUrl("https://api.example.com/openai")).toBe(
      "https://api.example.com/openai",
    );
  });

  it("does NOT modify a URL with /v1/ and a trailing slash", () => {
    expect(resolveProviderBaseUrl("https://api.example.com/v1/")).toBe(
      "https://api.example.com/v1",
    );
  });

  it("accepts a custom default prefix", () => {
    expect(
      resolveProviderBaseUrl("https://api.example.com", "/api/v2"),
    ).toBe("https://api.example.com/api/v2");
  });

  it("handles bare hostname without port or path", () => {
    expect(resolveProviderBaseUrl("api.example.com")).toBe(
      "api.example.com/v1",
    );
  });
});
