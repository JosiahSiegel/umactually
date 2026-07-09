// Pins the URL resolution strategy for the Anthropic Messages provider.
//
// Contract: ALWAYS canonicalize to origin + /v1. The Anthropic
// /v1/messages endpoint is fixed — there's no scenario where a
// custom path is valid (unlike OpenAI where gateways may mount
// the API at /openai, /api/v2, etc.). If the operator types
// `https://api.anthropic.com/anthropic`, the action resolves
// directly to `https://api.anthropic.com/v1` instead of
// burning a 404 on `/anthropic/messages`.
//
// The single-candidate output also makes the wire path
// deterministic — no fallback loop, no logged "trying N
// candidates", no wasted request per invocation.
import { describe, expect, it } from "vitest";

import { resolveProviderBaseUrl } from "../../src/util/url.js";

describe("Anthropic base URL resolution: always canonical /v1, ignore path", () => {
  // The Anthropic provider uses `resolveProviderBaseUrl(baseUrl, "/v1")`
  // directly — NOT the candidates form — because Anthropic's
  // /v1/messages endpoint is canonical. There's no scenario where a
  // custom path is meaningful (unlike OpenAI where gateways may mount
  // /openai, /api/v2, etc.). These tests pin the resolution contract
  // so a future refactor that introduces an as-pasted-first loop for
  // Anthropic trips a RED.
  it("ANTH-URL-001: a bare host resolves to origin + /v1", () => {
    expect(resolveProviderBaseUrl("https://api.anthropic.com")).toBe(
      "https://api.anthropic.com/v1",
    );
  });

  it("ANTH-URL-002: a host with /v1 path resolves to origin + /v1 (idempotent)", () => {
    expect(resolveProviderBaseUrl("https://api.anthropic.com/v1")).toBe(
      "https://api.anthropic.com/v1",
    );
  });

  it("ANTH-URL-003: a host with /anthropic path resolves to origin + /v1, NOT /anthropic", () => {
    // This is the regression case you flagged: previously the
    // Anthropic client tried the as-pasted URL first
    // (https://api.anthropic.com/anthropic/messages) and burned a
    // 404 before falling back. Canonical resolve goes straight to
    // /v1/messages.
    expect(resolveProviderBaseUrl("https://api.anthropic.com/anthropic")).toBe(
      "https://api.anthropic.com/v1",
    );
  });

  it("ANTH-URL-004: a host with /v1/messages path resolves to origin + /v1 (strip the trailing /messages)", () => {
    // Operator who already pre-appended /messages by mistake —
    // we strip down to /v1 because Anthropic's canonical route is
    // just /v1, not /v1/messages under /v1/messages.
    expect(resolveProviderBaseUrl("https://api.anthropic.com/v1/messages")).toBe(
      "https://api.anthropic.com/v1",
    );
  });

  it("ANTH-URL-005: a self-hosted gateway at a custom path still resolves to /v1", () => {
    // Self-hosted gateway at https://gateway.example.com/llm/anthropic
    // → resolves to /v1. The /llm/anthropic path is decorative
    // noise from the operator's perspective; only the host matters.
    expect(resolveProviderBaseUrl("https://gateway.example.com/llm/anthropic")).toBe(
      "https://gateway.example.com/v1",
    );
  });

  it("ANTH-URL-006: preserves scheme and port", () => {
    expect(resolveProviderBaseUrl("http://localhost:8080/foo")).toBe(
      "http://localhost:8080/v1",
    );
  });

  it("ANTH-URL-007: strips query string and fragment", () => {
    expect(resolveProviderBaseUrl("https://api.anthropic.com/anthropic?token=abc#section")).toBe(
      "https://api.anthropic.com/v1",
    );
  });
});
