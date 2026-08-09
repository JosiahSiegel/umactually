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
// commonly mount the protocol under a path prefix. For example,
// `https://gateway.example.invalid/anthropic` resolves to
// `https://gateway.example.invalid/anthropic/v1/messages` — NOT
// `https://gateway.example.invalid/v1/messages`. A resolver that always strips
// the path silently routes to the wrong endpoint. Anthropic.com
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

  it("ANTH-URL-003: a host with /anthropic path appends /v1/messages to the existing path", () => {
    // This regression case proves a gateway's routing prefix is preserved.
    // The previous "always strip path" version silently used the wrong route.
    expect(anthropicMessagesBase("https://gateway.example.invalid/anthropic")).toBe(
      "https://gateway.example.invalid/anthropic/v1/messages",
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
    expect(anthropicMessagesBase("https://gateway.example.invalid/anthropic/")).toBe(
      "https://gateway.example.invalid/anthropic/v1/messages",
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

  it("ANTH-URL-010: unparseable input falls back to substring extraction WITHOUT stripping the leading slash", () => {
    // Pins the catch-block contract: when WHATWG URL parsing fails,
    // we fall back to substring extraction. Critically, the leading
    // slash on `pathPart` is preserved (matches `parsed.pathname`
    // shape exactly) so the dispatcher checks below see `/v1` /
    // `/v1/messages` as expected — not the slash-stripped forms
    // `v1` / `v1/messages` which would route through the wrong
    // branch and double-`/v1/v1/messages`.
    //
    // `http://[invalid` is unparseable by WHATWG URL (the `[invalid`
    // bracket pair is rejected), so we exercise the catch branch.
    // The origin-prefix substring-extraction produces the leading-
    // slash form expected by the dispatcher checks.
    expect(anthropicMessagesBase("http://[invalid/v1")).toBe(
      "http://[invalid/v1/messages",
    );
  });

  it("ANTH-URL-011: trailing characters that look like \"/v1\" but aren't a full segment fall through to /v1/messages", () => {
    // Path-segment match (not string-suffix match): the helper
    // must distinguish a path whose LAST SEGMENT is literally
    // `v1` (e.g. `/my-v1` is NOT `/my/v1` — but `/my-v1` has
    // trailing `v1` characters that a naive `.endsWith("/v1")`
    // would falsely match) from a path whose last segment IS `v1`.
    //
    // The Anthropic SDK convention is to treat a trailing `/v1`
    // *segment* as already-appended (skip the double-prefix). A
    // path whose last segment is `my-v1` is NOT a `/v1`-prefixed
    // Anthropic gateway — it's a custom path that should get the
    // canonical `/v1/messages` suffix appended.
    expect(anthropicMessagesBase("https://gateway.example.com/my-v1")).toBe(
      "https://gateway.example.com/my-v1/v1/messages",
    );
    expect(anthropicMessagesBase("https://gateway.example.com/v1/anthropic")).toBe(
      // The last segment is `anthropic`, not `v1` — falls through
      // to /v1/messages append.
      "https://gateway.example.com/v1/anthropic/v1/messages",
    );
    expect(anthropicMessagesBase("https://gateway.example.com/v1")).toBe(
      // Last segment IS `v1` — append /messages only.
      "https://gateway.example.com/v1/messages",
    );
  });
});
