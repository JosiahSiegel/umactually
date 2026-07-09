// Pins the URL-redaction helper used by openai-compatible + live-provider
// notices to scrub query strings and fragments before they land in CI
// action logs (which persist on PR action runs).

import { describe, expect, it } from "vitest";

import { redactUrlForLog } from "../../src/util/url.js";

describe("redactUrlForLog: drop query/fragment for safe CI logging", () => {
  it("REDACT-001: bare host passes through unchanged", () => {
    expect(redactUrlForLog("https://api.example.com")).toBe("https://api.example.com");
  });

  it("REDACT-002: origin + path passes through unchanged when no query/fragment", () => {
    expect(redactUrlForLog("https://api.example.com/v1")).toBe("https://api.example.com/v1");
    expect(redactUrlForLog("https://api.example.com/v1/messages")).toBe("https://api.example.com/v1/messages");
  });

  it("REDACT-003: query string is dropped, origin + path kept", () => {
    // Operator who accidentally typed a query string with a token
    // should not leak that token into GitHub Actions annotations.
    expect(redactUrlForLog("https://api.example.com?token=secret-do-not-leak")).toBe("https://api.example.com");
    expect(redactUrlForLog("https://api.example.com/v1?api_key=sk-leak&other=ok")).toBe("https://api.example.com/v1");
  });

  it("REDACT-004: fragment is dropped, origin + path + query kept", () => {
    expect(redactUrlForLog("https://api.example.com/v1#anchor-section-leak")).toBe("https://api.example.com/v1");
    expect(redactUrlForLog("https://api.example.com/v1?token=x#anchor")).toBe("https://api.example.com/v1");
  });

  it("REDACT-005: empty string passes through unchanged", () => {
    expect(redactUrlForLog("")).toBe("");
  });

  it("REDACT-006: unparseable URL still has query/fragment stripped (substring fallback)", () => {
    // The WHATWG URL parser rejects some malformed inputs (control
    // chars, missing scheme on certain locales). Substring fallback
    // preserves the operator's intent (origin + path) without
    // throwing.
    expect(redactUrlForLog("https://api.example.com/v1?token=leak&b=c#section")).toBe("https://api.example.com/v1");
  });

  it("REDACT-007: path-prefixed URLs preserve the prefix in the redacted output", () => {
    expect(redactUrlForLog("https://api.minimax.io/anthropic?session=abc")).toBe("https://api.minimax.io/anthropic");
  });
});
