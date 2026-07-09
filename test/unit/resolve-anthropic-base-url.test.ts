// Pins the URL resolution strategy for the Anthropic Messages provider.
//
// Contract: ALONG THE OFFICIAL @anthropic-ai/sdk CONVENTION.
//
//   - Base URL = whatever the operator (or env var) supplied.
//   - Strip trailing slash.
//   - If the path ends in `/v1`, append `/messages` (idempotent).
//     Otherwise, append `/v1/messages` to the existing path.
//
// Why this matters: Anthropic-compatible gateways (NOT just anthropic.com)
// commonly mount the protocol under a path prefix. The documented
// example is `https://api.minimax.io/anthropic` (per
// https://platform.minimax.io/docs/token-plan/claude-code), which
// resolves to `https://api.minimax.io/anthropic/v1/messages` — NOT
// `https://api.minimax.io/v1/messages`. The previous "always strip the
// path" version of this helper silently 404'd MiniMax. Anthropic.com
// itself only serves `/v1/messages` at the bare host, but operators may
// also point --api-url at a self-hosted gateway under a path prefix.
//
// The math matches the official Anthropic SDK and
// anthropic-sdk-kotlin's path-preserving fix in
// https://github.com/xemantic/anthropic-sdk-kotlin/pull/145 — also
// matches the Vercel ai-sdk's documented failure mode in
// https://github.com/vercel/ai/issues/15580.
import { describe, expect, it } from "vitest";

import { resolveAnthropicMessagesUrl } from "../../src/util/url.js";

// Test alias for readability: `anthropicMessagesBase(x)` reads as
// "the URL the anthropic client will POST to given baseUrl input x."
const anthropicMessagesBase = resolveAnthropicMessagesUrl;

describe("Anthropic Messages URL: preserve operator path, append /v1/messages", () => {
  it("ANTH-URL-001: a bare host appends /v1/messages (anthropic.com default-shape input)", () => {
    // Anthropic SDK convention: a bare host means the host root mounts
    // the API at /v1/messages. Matches what Claude Code sets
    // ANTHROPIC_BASE_URL to (bare host → SDK prepends /v1/messages).
    expect(anthropicMessagesBase("https://api.anthropic.com")).toBe(
      "https://api.anthropic.com/v1/messages",
    );
  });

  it("ANTH-URL-002: a host already ending in /v1 appends /messages only (no double /v1)", () => {
    // Default URL is `https://api.anthropic.com/v1`. Operator who
    // passed --api-url=$default in env ends up here.
    expect(anthropicMessagesBase("https://api.anthropic.com/v1")).toBe(
      "https://api.anthropic.com/v1/messages",
    );
  });

  it("ANTH-URL-003: a host with /anthropic path appends /v1/messages to the existing path (MiniMax-style)", () => {
    // This is the regression case the user fixed: MiniMax's Anthropic
    // compatibility lives at https://api.minimax.io/anthropic/v1/messages
    // (per https://platform.minimax.io/docs/token-plan/claude-code).
    // The previous "always strip path" version silently 404'd MiniMax.
    expect(anthropicMessagesBase("https://api.minimax.io/anthropic")).toBe(
      "https://api.minimax.io/anthropic/v1/messages",
    );
  });

  it("ANTH-URL-004: a host already ending in /v1/messages is left alone (operator pre-appended; idempotent)", () => {
    // Operator who pre-appended /v1/messages — we leave it alone
    // rather than produce `/v1/messages/messages`. The Anthropic SDK
    // doesn't handle this either, but the wrapper can do better.
    expect(anthropicMessagesBase("https://api.anthropic.com/v1/messages")).toBe(
      "https://api.anthropic.com/v1/messages",
    );
  });

  it("ANTH-URL-005: a self-hosted gateway at a custom path keeps the prefix (e.g. /llm/anthropic)", () => {
    // Self-hosted gateway at https://gateway.example.com/llm/anthropic
    // → /llm/anthropic/v1/messages. The path is real routing, not
    // decorative noise — matches anthropic-sdk-kotlin's fix.
    expect(anthropicMessagesBase("https://gateway.example.com/llm/anthropic")).toBe(
      "https://gateway.example.com/llm/anthropic/v1/messages",
    );
  });

  it("ANTH-URL-006: preserves scheme and port", () => {
    expect(anthropicMessagesBase("http://localhost:8080")).toBe(
      "http://localhost:8080/v1/messages",
    );
  });

  it("ANTH-URL-007: trims trailing slash before appending (avoids //v1)", () => {
    expect(anthropicMessagesBase("https://api.anthropic.com/")).toBe(
      "https://api.anthropic.com/v1/messages",
    );
  });

  it("ANTH-URL-008: trims trailing slash on a path-prefixed URL (no //v1)", () => {
    expect(anthropicMessagesBase("https://api.minimax.io/anthropic/")).toBe(
      "https://api.minimax.io/anthropic/v1/messages",
    );
  });

  it("ANTH-URL-009: query string and fragment are dropped before appending the canonical route", () => {
    // Query strings and fragments don't address `/v1/messages` at any
    // known Anthropic-protocol gateway. Passing them through would
    // append the path segment into the query slot
    // (`...?token=abc/v1/messages`), an invalid URL the server would
    // route somewhere the operator didn't intend. The helper
    // intentionally drops them.
    expect(anthropicMessagesBase("https://api.anthropic.com/v1?token=abc")).toBe(
      "https://api.anthropic.com/v1/messages",
    );
    expect(anthropicMessagesBase("https://api.anthropic.com/v1?foo=bar&baz=qux#section")).toBe(
      "https://api.anthropic.com/v1/messages",
    );
  });
});
