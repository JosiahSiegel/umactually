// Pins the URL resolution strategy for the openai-compatible provider.
//
// Contract: try the operator's URL as-pasted first (after trimming
// trailing slashes). If the operator's URL 404s on both `/responses`
// and `/chat/completions`, fall back to the origin-stripped URL with
// `/v1/` appended. This is the "robust to any URL shape" contract
// the user asked for: no matter what path the operator typed
// (`/v1`, `/openai`, `/anthropic`, `/api/v2`, or none at all), the
// action finds a working endpoint.
import { describe, expect, it } from "vitest";

import {
  extractOrigin,
  resolveProviderBaseUrl,
  resolveProviderBaseUrlCandidates,
} from "../../src/util/url.js";

describe("resolveProviderBaseUrlCandidates: try as-pasted first, fall back to origin", () => {
  it("returns [as-pasted, origin+prefix] when operator types a bare host", () => {
    // Operator typed nothing past the host. The action first tries
    // the bare host (which will 404 because no /v1 path is in place),
    // then falls back to the origin+prefix. Both candidates are
    // tried in order — the bare host first, then /v1.
    const c = resolveProviderBaseUrlCandidates("https://api.example.com");
    expect(c).toEqual([
      "https://api.example.com",
      "https://api.example.com/v1",
    ]);
  });

  it("returns [as-pasted, origin+prefix] when operator types a non-v1 path", () => {
    // Operator typed a path-prefixed `/anthropic` URL from
    // PR #28's self-review 404). First we try it as-pasted; if it
    // 404s, we fall back to `/v1`.
    const c = resolveProviderBaseUrlCandidates("https://router.example.invalid/anthropic");
    expect(c).toEqual([
      "https://router.example.invalid/anthropic",
      "https://router.example.invalid/v1",
    ]);
  });

  it("returns [as-pasted, origin+prefix] when operator types /openai", () => {
    const c = resolveProviderBaseUrlCandidates("https://api.example.com/openai");
    expect(c).toEqual([
      "https://api.example.com/openai",
      "https://api.example.com/v1",
    ]);
  });

  it("returns [as-pasted, origin+prefix] when operator types /api/v2", () => {
    const c = resolveProviderBaseUrlCandidates("https://api.example.com/api/v2");
    expect(c).toEqual([
      "https://api.example.com/api/v2",
      "https://api.example.com/v1",
    ]);
  });

  it("returns just the operator URL when it already ends in /v1", () => {
    // De-duplicated: the as-pasted form IS the origin+prefix.
    const c = resolveProviderBaseUrlCandidates("https://api.example.com/v1");
    expect(c).toEqual(["https://api.example.com/v1"]);
  });

  it("strips a trailing slash from the as-pasted form, both candidates shown", () => {
    // Bare host with trailing slash: "https://api.example.com/" →
    // "https://api.example.com" (as-pasted). Origin+prefix adds /v1.
    const c = resolveProviderBaseUrlCandidates("https://api.example.com/");
    expect(c).toEqual([
      "https://api.example.com",
      "https://api.example.com/v1",
    ]);
  });

  it("preserves the port in both candidate forms", () => {
    const c = resolveProviderBaseUrlCandidates("https://api.example.com:8443/openai");
    expect(c).toEqual([
      "https://api.example.com:8443/openai",
      "https://api.example.com:8443/v1",
    ]);
  });

  it("strips trailing slash from the as-pasted form (query string kept)", () => {
    // The as-pasted form only gets a trailing-slash trim — query
    // string and fragment pass through unchanged. The provider's
    // first attempt may 404 because of the query, in which case
    // the action falls back to the origin+prefix form (which has
    // no query string).
    const c = resolveProviderBaseUrlCandidates("https://api.example.com/openai?token=abc");
    expect(c).toEqual([
      "https://api.example.com/openai?token=abc",
      "https://api.example.com/v1",
    ]);
  });

  it("accepts a custom default prefix", () => {
    const c = resolveProviderBaseUrlCandidates("https://api.example.com/anthropic", "/api/v2");
    expect(c).toEqual([
      "https://api.example.com/anthropic",
      "https://api.example.com/api/v2",
    ]);
  });

  it("preserves http:// scheme", () => {
    const c = resolveProviderBaseUrlCandidates("http://localhost:8080/openai");
    expect(c).toEqual([
      "http://localhost:8080/openai",
      "http://localhost:8080/v1",
    ]);
  });
});

describe("extractOrigin: scheme + host + port, no path", () => {
  it("returns the origin of a URL with a path", () => {
    expect(extractOrigin("https://api.example.com/anthropic")).toBe(
      "https://api.example.com",
    );
  });

  it("returns the origin of a bare host", () => {
    expect(extractOrigin("https://api.example.com")).toBe(
      "https://api.example.com",
    );
  });

  it("preserves the port", () => {
    expect(extractOrigin("https://api.example.com:8443/path")).toBe(
      "https://api.example.com:8443",
    );
  });

  it("strips query string and fragment", () => {
    expect(extractOrigin("https://api.example.com/v1?token=abc#section")).toBe(
      "https://api.example.com",
    );
  });
});

describe("resolveProviderBaseUrl: origin + default prefix (single value)", () => {
  // This is the helper used as the FALLBACK candidate. Tests pin
  // the single-value form so the multi-candidate helper has a
  // well-defined second element.
  it("returns origin + /v1 for a URL with a custom path", () => {
    expect(resolveProviderBaseUrl("https://api.example.com/openai")).toBe(
      "https://api.example.com/v1",
    );
  });

  it("returns origin + /v1 for a bare host", () => {
    expect(resolveProviderBaseUrl("https://api.example.com")).toBe(
      "https://api.example.com/v1",
    );
  });

  it("returns origin + /v1 for a path-prefixed /anthropic URL", () => {
    expect(resolveProviderBaseUrl("https://router.example.invalid/anthropic")).toBe(
      "https://router.example.invalid/v1",
    );
  });
});
