// Pins the heuristic that decides whether the operator's `UMACTUALLY_API_URL`
// looks like an Anthropic-protocol gateway. The dispatcher uses this to
// commit to the Anthropic-protocol client even when `--provider` defaults
// to `openai-compatible`, so operators who type
// `--api-url https://gateway.example.invalid/anthropic` get the
// Anthropic Messages API wire shape rather than the OpenAI client silently
// downgrading to origin+`/v1` and posting to /v1/responses.
//
// Contract: `looksLikeAnthropicEndpoint` returns true when the URL has a
// path segment equal to `anthropic` (case-insensitive). The segment is
// matched anywhere in the path — `/anthropic`, `/anthropic/v1`,
// `/llm/anthropic`, `/v1/anthropic` all match. A bare host (no path)
// returns false. `/v1`, `/openai`, and arbitrary paths return false.
//
// This heuristic is intentionally narrow: it only commits to Anthropic
// when the operator's URL strongly suggests that protocol. On other
// URLs the dispatcher stays with the named `--provider` (or its default
// of `openai-compatible`).
import { describe, expect, it } from "vitest";

import {
  looksLikeAnthropicEndpoint,
} from "../../src/util/url.js";

describe("looksLikeAnthropicEndpoint: path-prefix heuristic for protocol selection", () => {
  it("HEURISTIC-001: bare host returns false (no path to inspect)", () => {
    expect(looksLikeAnthropicEndpoint("https://api.example.com")).toBe(false);
    expect(looksLikeAnthropicEndpoint("https://api.anthropic.com")).toBe(false);
  });

  it("HEURISTIC-002: URL ending in /anthropic returns true", () => {
    // A path-prefixed Anthropic-protocol gateway base URL.
    expect(looksLikeAnthropicEndpoint("https://gateway.example.invalid/anthropic")).toBe(true);
    // Custom self-hosted gateway with /anthropic suffix.
    expect(looksLikeAnthropicEndpoint("https://gateway.example.com/anthropic")).toBe(true);
  });

  it("HEURISTIC-003: URL with /anthropic/<segment> path returns true", () => {
    // Anthropic-protocol prefixed gateway with a sub-path.
    expect(looksLikeAnthropicEndpoint("https://gateway.example.invalid/anthropic/v1")).toBe(true);
    expect(looksLikeAnthropicEndpoint("https://gateway.example.com/anthropic/foo/bar")).toBe(true);
  });

  it("HEURISTIC-004: URL with nested /llm/anthropic returns true", () => {
    // Self-hosted LiteLLM-style gateway with custom Anthropic prefix.
    expect(looksLikeAnthropicEndpoint("https://gateway.example.com/llm/anthropic")).toBe(true);
    expect(looksLikeAnthropicEndpoint("https://gateway.example.com/v1/anthropic")).toBe(true);
    expect(looksLikeAnthropicEndpoint("https://gateway.example.com/team-a/anthropic")).toBe(true);
  });

  it("HEURISTIC-005: URL ending in /v1, /openai, or other prefixes returns false", () => {
    // OpenAI-protocol style URLs (default branch stays the same).
    expect(looksLikeAnthropicEndpoint("https://api.openai.com/v1")).toBe(false);
    expect(looksLikeAnthropicEndpoint("https://api.example.com/v1")).toBe(false);
    expect(looksLikeAnthropicEndpoint("https://api.example.com/openai")).toBe(false);
    expect(looksLikeAnthropicEndpoint("https://api.example.com/openai/v1")).toBe(false);
    expect(looksLikeAnthropicEndpoint("https://api.example.com/api/v2")).toBe(false);
  });

  it("HEURISTIC-006: matching is case-insensitive (path segment is lowercase per RFC 3986 but provider hostnames vary)", () => {
    expect(looksLikeAnthropicEndpoint("https://api.example.com/Anthropic")).toBe(true);
    expect(looksLikeAnthropicEndpoint("https://api.example.com/ANTHROPIC")).toBe(true);
    expect(looksLikeAnthropicEndpoint("https://api.example.com/anThRoPiC/v1")).toBe(true);
  });

  it("HEURISTIC-007: query string is stripped before segment matching", () => {
    // Same URL resolution safety as `resolveAnthropicMessagesUrl` — operator
    // types a `?token=…` parameter, query is dropped, path is inspected.
    // Fragment is naturally separated by `?`/`#` in the URL parser so it
    // never reaches pathname at all (it lives in parsed.hash).
    expect(looksLikeAnthropicEndpoint("https://gateway.example.invalid/anthropic?token=secret-leak")).toBe(true);
    expect(looksLikeAnthropicEndpoint("https://gateway.example.invalid/?token=x")).toBe(false);
    expect(looksLikeAnthropicEndpoint("https://api.example.com/anthropic?token=x#fragment")).toBe(true);
  });

  it("HEURISTIC-008: unparseable input is treated as non-Anthropic (subparse fallback)", () => {
    // The WHATWG URL parser rejects some malformed inputs (control chars,
    // some scheme-less strings). The substring fallback treats them as
    // not Anthropic-protocol-shaped — better to default than to commit.
    expect(looksLikeAnthropicEndpoint("://no-scheme")).toBe(false);
    expect(looksLikeAnthropicEndpoint("")).toBe(false);
  });

  it("HEURISTIC-009: a similar-looking-but-distinct segment like 'anthropic-v2' is NOT matched", () => {
    // Path-segment match is exact (case-insensitive). 'anthropic-v2' is its own
    // segment — not the literal 'anthropic'. The heuristic should not
    // commit to Anthropic protocol for arbitrary hostnames.
    expect(looksLikeAnthropicEndpoint("https://api.example.com/anthropic-v2")).toBe(false);
    expect(looksLikeAnthropicEndpoint("https://api.example.com/my-anthropic")).toBe(false);
  });

  it("HEURISTIC-010: trailing slash is normalized before segment matching", () => {
    expect(looksLikeAnthropicEndpoint("https://gateway.example.invalid/anthropic/")).toBe(true);
    expect(looksLikeAnthropicEndpoint("https://api.example.com/")).toBe(false);
  });

  it("HEURISTIC-011: exact-segment contract — segments containing 'anthropic' as a substring do NOT match", () => {
    // The dispatcher will POST OpenAI-Responses wire shape to these
    // URLs if the heuristic falsely returns true. Tightening the contract
    // here: only the byte-for-byte match `s === "anthropic"` qualifies.
    // The 404-only cross-protocol fallback would catch a real miss,
    // but the heuristic itself must NOT over-trigger.
    expect(looksLikeAnthropicEndpoint("https://attacker.example.com/my-team/anthropic-related")).toBe(false);
    expect(looksLikeAnthropicEndpoint("https://gateway.example.com/anthropic-fork/v1")).toBe(false);
    expect(looksLikeAnthropicEndpoint("https://api.example.com/anthropic-team/foo")).toBe(false);
    expect(looksLikeAnthropicEndpoint("https://api.example.com/xanthropic")).toBe(false);
    expect(looksLikeAnthropicEndpoint("https://api.example.com/anthropicy")).toBe(false);
  });
});
