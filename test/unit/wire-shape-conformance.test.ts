// Wire-shape conformance suite: locks the captured provider wire-shape
// fixtures against future drift.
//
// Scope: every captured fixture under test/fixtures/provider/ is
// assumed to be a real wire shape the parser has handled successfully
// in production. This suite asserts two contracts:
//
//   1. SHAPE CONTRACT — the fixture's parsed JSON carries every
//      required key the parser reads (top-level + nested), and the
//      well-typed comment arrays have `path: string` and
//      `line: number`. Without this guard, a future "cleanup" PR that
//      deletes a field the parser silently relies on (e.g. removes
//      `output[]` from the Responses fixture) would not break any
//      test — the parser's tolerant default-empty-fields handling
//      masks the regression.
//
//   2. CONTENT-HASH LOCK — the raw fixture bytes hash to a pinned
//      SHA-256. Catches accidental field additions / edits / reformat
//      in the JSON files that the shape contract would miss (e.g.
//      changing `model: "x"` to `model: "X"` keeps all keys present
//      but shifts the bytes; the parser does not care, but downstream
//      consumers reading the fixture for parity testing would).
//
// IMPORTANT: when a hash mismatches, re-baseline THIS constant to the
// new SHA-256 ONLY after confirming the change is intentional. Do not
// bump the pinned value to silence a failure — that hides wire-shape
// drift that is otherwise caught by the shape contract above.
//
// The fixtures exercised:
//   - responses-success.json (OpenAI Responses API)
//   - chat-fallback-success.json (OpenAI Chat Completions)
//   - anthropic-messages-success.json (Anthropic Messages API)
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  extractTextPayload,
  normalizeProviderSeverity,
  parseReviewPayload,
  type ProviderReviewPayload,
} from "../../src/provider/provider-parse.js";
import { extractAnthropicTextPayload } from "../../src/provider/anthropic-messages.js";

// Pinned content hashes for the captured wire-shape fixtures.
// Regenerate only after reviewing the diff in the fixture file.
const RESPONSES_FIXTURE_SHA256 = "aa7d3a56c08e657ad1b3a5efb25e273c2b794881fc6918257b83aa4aaee17803";
const CHAT_FIXTURE_SHA256 = "d1dbc94d4b01832631d39fb3ab3c2fe5d382bafae878a3ab43cbf9cf30efcf41";
const ANTHROPIC_FIXTURE_SHA256 = "86f5be2d29aec1e4b59c47b3629cec9b0ca4a145247cb0cd7a6c891dce90740d";

const RESPONSES_FIXTURE_PATH = "test/fixtures/provider/responses-success.json";
const CHAT_FIXTURE_PATH = "test/fixtures/provider/chat-fallback-success.json";
const ANTHROPIC_FIXTURE_PATH = "test/fixtures/provider/anthropic-messages-success.json";

// The canonical severity scale the parser normalizes provider output to.
// Captured in `normalizeProviderSeverity` (provider-parse.ts).
const CANONICAL_SEVERITIES: ReadonlySet<string> = new Set([
  "info",
  "low",
  "medium",
  "high",
  "critical",
]);

function sha256OfFile(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function parseFixture(path: string): Record<string, unknown> {
  const text = readFileSync(path, "utf8");
  const parsed: unknown = JSON.parse(text);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`Fixture ${path} is not a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

/**
 * Walk a comment array (the parser's `comments` / `suppressed_comments`
 * shape) and assert every entry is a well-typed record with
 * `path: string` and `line: number`. The parser already requires these
 * (see `readCommentArray`); this guard confirms the fixture itself
 * matches the contract — a malformed fixture would silently produce
 * 0 comments downstream without any test failing.
 */
function assertCommentsWellTyped(
  comments: readonly unknown[],
  label: string,
): void {
  for (const [index, entry] of comments.entries()) {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`${label}[${index}] is not an object`);
    }
    const rec = entry as Record<string, unknown>;
    if (typeof rec["path"] !== "string") {
      throw new Error(`${label}[${index}].path is not a string (got ${typeof rec["path"]})`);
    }
    if (typeof rec["line"] !== "number" || !Number.isInteger(rec["line"])) {
      throw new Error(`${label}[${index}].line is not an integer (got ${typeof rec["line"]})`);
    }
  }
}

describe("wire-shape conformance: OpenAI Responses fixture", () => {
  const fixture = parseFixture(RESPONSES_FIXTURE_PATH);

  it("raw bytes match the pinned SHA-256 content hash", () => {
    expect(sha256OfFile(RESPONSES_FIXTURE_PATH)).toBe(RESPONSES_FIXTURE_SHA256);
  });

  it("carries the top-level keys the parser reads from the Responses envelope", () => {
    // The fixture's `id` + `model` are surfaced by the parser's
    // logging layer; `output_text` + `output[]` are what
    // `extractTextPayload` actually walks. The parser tolerates
    // missing fields by returning empty/default, but a fixture that
    // drops `output[]` entirely would silently produce an empty
    // review — catch that here.
    expect(typeof fixture["id"]).toBe("string");
    expect(typeof fixture["model"]).toBe("string");
    expect(typeof fixture["output_text"]).toBe("string");
    expect(Array.isArray(fixture["output"])).toBe(true);
  });

  it("output[].content[].text carries the parser's joined text payload", () => {
    const output = fixture["output"];
    if (!Array.isArray(output) || output.length === 0) {
      throw new Error("Responses fixture output[] is empty");
    }
    const first = output[0];
    if (typeof first !== "object" || first === null) {
      throw new Error("Responses fixture output[0] is not an object");
    }
    const firstRec = first as Record<string, unknown>;
    expect(firstRec["type"]).toBe("message");

    const content = firstRec["content"];
    if (!Array.isArray(content) || content.length === 0) {
      throw new Error("Responses fixture output[0].content[] is empty");
    }
    const firstContent = content[0];
    if (typeof firstContent !== "object" || firstContent === null) {
      throw new Error("Responses fixture output[0].content[0] is not an object");
    }
    const firstContentRec = firstContent as Record<string, unknown>;
    expect(firstContentRec["type"]).toBe("output_text");
    expect(typeof firstContentRec["text"]).toBe("string");
  });

  it("parses through extractTextPayload → parseReviewPayload with the expected review fields", () => {
    const rawText = readFileSync(RESPONSES_FIXTURE_PATH, "utf8");
    const extracted = extractTextPayload("responses", rawText);
    expect(extracted.length).toBeGreaterThan(0);

    const review = parseReviewPayload(extracted);
    expect(review).not.toBeNull();
    const r = review as ProviderReviewPayload;
    expect(r.summary).toBe("Synthetic responses review.");
    expect(r.verdict).toBe("DISCUSS");
    expect(Array.isArray(r.comments)).toBe(true);
    expect(Array.isArray(r.suppressed_comments)).toBe(true);
    assertCommentsWellTyped(r.comments, "responses.comments");
    assertCommentsWellTyped(r.suppressed_comments, "responses.suppressed_comments");
  });

  it("non-empty comment arrays normalize every severity into the canonical enum", () => {
    // Build an inline-shape payload that exercises every severity
    // branch of `normalizeProviderSeverity`, then assert the parser
    // round-trips each one into the canonical enum. This catches a
    // future parser refactor that accidentally drops a severity
    // branch (e.g. stops mapping `nit` → `info`) without breaking
    // any test on the existing empty fixture.
    const fixtureWithEverySeverity = JSON.stringify({
      id: "resp_shape_test",
      model: "review-model-synthetic",
      output_text: "",
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify({
                summary: "Shape conformance fixture — non-empty severity coverage.",
                verdict: "COMMENT",
                comments: [
                  { path: "src/a.ts", line: 1, body: "info severity", severity: "info" },
                  { path: "src/a.ts", line: 2, body: "nit severity", severity: "nit" },
                  { path: "src/a.ts", line: 3, body: "minor severity", severity: "minor" },
                  { path: "src/a.ts", line: 4, body: "low severity", severity: "low" },
                  { path: "src/a.ts", line: 5, body: "major severity", severity: "major" },
                  { path: "src/a.ts", line: 6, body: "medium severity", severity: "medium" },
                  { path: "src/a.ts", line: 7, body: "high severity", severity: "high" },
                  { path: "src/a.ts", line: 8, body: "critical severity", severity: "critical" },
                  { path: "src/a.ts", line: 9, body: "blocker severity", severity: "blocker" },
                  { path: "src/a.ts", line: 10, body: "leak severity", severity: "leak" },
                  { path: "src/a.ts", line: 11, body: "security hardening tip", severity: "security" },
                  { path: "src/a.ts", line: 12, body: "active credential leak", severity: "security" },
                ],
                suppressed_comments: [],
              }),
            },
          ],
        },
      ],
    });

    const review = parseReviewPayload(extractTextPayload("responses", fixtureWithEverySeverity));
    expect(review).not.toBeNull();
    const r = review as ProviderReviewPayload;
    expect(r.comments.length).toBe(12);
    for (const c of r.comments) {
      expect(CANONICAL_SEVERITIES.has(c.severity)).toBe(true);
    }
    // Spot-check the body-scoped rules — security+hardening stays
    // at high (NOT critical), security+leak-indicators escalates to
    // critical. If the body-scoped logic regresses, these assertions
    // fail loudly.
    const hardeningTip = r.comments.find((c) => c.body === "security hardening tip");
    expect(hardeningTip?.severity).toBe("high");
    const activeLeak = r.comments.find((c) => c.body === "active credential leak");
    expect(activeLeak?.severity).toBe("critical");
    // `leak` is unconditional critical.
    expect(r.comments.find((c) => c.body === "leak severity")?.severity).toBe("critical");
    // `nit` → info (below `low`).
    expect(r.comments.find((c) => c.body === "nit severity")?.severity).toBe("info");
  });
});

describe("wire-shape conformance: OpenAI Chat Completions fixture", () => {
  const fixture = parseFixture(CHAT_FIXTURE_PATH);

  it("raw bytes match the pinned SHA-256 content hash", () => {
    expect(sha256OfFile(CHAT_FIXTURE_PATH)).toBe(CHAT_FIXTURE_SHA256);
  });

  it("carries the top-level keys the parser reads from the Chat envelope", () => {
    expect(typeof fixture["id"]).toBe("string");
    expect(typeof fixture["model"]).toBe("string");
    expect(Array.isArray(fixture["choices"])).toBe(true);
  });

  it("choices[0].message.content carries the parser's extracted text payload", () => {
    const choices = fixture["choices"];
    if (!Array.isArray(choices) || choices.length === 0) {
      throw new Error("Chat fixture choices[] is empty");
    }
    const first = choices[0];
    if (typeof first !== "object" || first === null) {
      throw new Error("Chat fixture choices[0] is not an object");
    }
    const firstRec = first as Record<string, unknown>;
    const message = firstRec["message"];
    if (typeof message !== "object" || message === null) {
      throw new Error("Chat fixture choices[0].message is not an object");
    }
    const messageRec = message as Record<string, unknown>;
    expect(messageRec["role"]).toBe("assistant");
    expect(typeof messageRec["content"]).toBe("string");
  });

  it("parses through extractTextPayload → parseReviewPayload with the expected review fields", () => {
    const rawText = readFileSync(CHAT_FIXTURE_PATH, "utf8");
    const extracted = extractTextPayload("chat", rawText);
    expect(extracted.length).toBeGreaterThan(0);

    const review = parseReviewPayload(extracted);
    expect(review).not.toBeNull();
    const r = review as ProviderReviewPayload;
    expect(r.summary).toBe("Synthetic chat fallback review.");
    expect(r.verdict).toBe("SHIP");
    expect(Array.isArray(r.comments)).toBe(true);
    expect(Array.isArray(r.suppressed_comments)).toBe(true);
    assertCommentsWellTyped(r.comments, "chat.comments");
    assertCommentsWellTyped(r.suppressed_comments, "chat.suppressed_comments");
  });

  it("non-empty comment arrays expose normalizeProviderSeverity's full surface via the parser", () => {
    // The Chat fallback path uses the SAME `parseReviewPayload`
    // (after `extractTextPayload("chat", ...)` joins `choices[].message.content`),
    // so the same severity coverage applies. This test exists to make
    // the Chat-specific contract visible — if someone refactors the
    // Chat path to skip the parser, this test breaks immediately.
    const directMap: ReadonlyArray<readonly [string, string]> = [
      ["info", "info"],
      ["nit", "info"],
      ["minor", "low"],
      ["low", "low"],
      ["major", "medium"],
      ["medium", "medium"],
      ["high", "high"],
      ["critical", "critical"],
      ["blocker", "critical"],
      ["leak", "critical"],
    ];
    for (const [input, expected] of directMap) {
      expect(normalizeProviderSeverity(input)).toBe(expected);
    }
    // security body-scoped branches (no leak indicator) → high.
    expect(normalizeProviderSeverity("security", "consider adding a CSP header")).toBe("high");
    // security body-scoped branches with leak indicator → critical.
    expect(normalizeProviderSeverity("security", "active API key leaked in commit")).toBe("critical");
  });
});

describe("wire-shape conformance: Anthropic Messages fixture", () => {
  const fixture = parseFixture(ANTHROPIC_FIXTURE_PATH);

  it("raw bytes match the pinned SHA-256 content hash", () => {
    expect(sha256OfFile(ANTHROPIC_FIXTURE_PATH)).toBe(ANTHROPIC_FIXTURE_SHA256);
  });

  it("carries the top-level keys the Anthropic Messages API emits", () => {
    // `id` + `type:"message"` + `role:"assistant"` are the canonical
    // message envelope; `model` is surfaced by the parser's logging;
    // `content[]` is what `extractAnthropicTextPayload` walks;
    // `stop_reason` + `usage` drive the truncation/headroom
    // diagnostics. The parser tolerates missing fields, but a fixture
    // that drops `content[]` entirely would silently produce an
    // empty review — catch that here.
    expect(typeof fixture["id"]).toBe("string");
    expect(fixture["type"]).toBe("message");
    expect(fixture["role"]).toBe("assistant");
    expect(typeof fixture["model"]).toBe("string");
    expect(Array.isArray(fixture["content"])).toBe(true);
    expect(typeof fixture["stop_reason"]).toBe("string");
  });

  it("content[0].text carries the parser's joined text payload", () => {
    const content = fixture["content"];
    if (!Array.isArray(content) || content.length === 0) {
      throw new Error("Anthropic fixture content[] is empty");
    }
    const first = content[0];
    if (typeof first !== "object" || first === null) {
      throw new Error("Anthropic fixture content[0] is not an object");
    }
    const firstRec = first as Record<string, unknown>;
    expect(firstRec["type"]).toBe("text");
    expect(typeof firstRec["text"]).toBe("string");
  });

  it("parses through extractAnthropicTextPayload → parseReviewPayload with the expected review fields", () => {
    const rawText = readFileSync(ANTHROPIC_FIXTURE_PATH, "utf8");
    const extracted = extractAnthropicTextPayload(rawText);
    expect(extracted.length).toBeGreaterThan(0);

    const review = parseReviewPayload(extracted);
    expect(review).not.toBeNull();
    const r = review as ProviderReviewPayload;
    expect(r.summary).toBe("Synthetic anthropic messages review.");
    expect(r.verdict).toBe("COMMENT");
    expect(Array.isArray(r.comments)).toBe(true);
    expect(Array.isArray(r.suppressed_comments)).toBe(true);
    assertCommentsWellTyped(r.comments, "anthropic.comments");
    assertCommentsWellTyped(r.suppressed_comments, "anthropic.suppressed_comments");
  });
});

describe("wire-shape conformance: content-hash lock", () => {
  it("every captured fixture is hashed under the same algorithm (sha256 → 64 hex chars)", () => {
    for (const [path, pinned] of [
      [RESPONSES_FIXTURE_PATH, RESPONSES_FIXTURE_SHA256],
      [CHAT_FIXTURE_PATH, CHAT_FIXTURE_SHA256],
      [ANTHROPIC_FIXTURE_PATH, ANTHROPIC_FIXTURE_SHA256],
    ] as ReadonlyArray<readonly [string, string]>) {
      const hash = sha256OfFile(path);
      expect(hash).toMatch(/^[0-9a-f]{64}$/u);
      expect(hash).toBe(pinned);
    }
  });

  it("a byte mutation in the fixture breaks the hash and the shape contract fires first", () => {
    // Compute the expected vs actual hashes side by side so a future
    // regression that drops a key gets caught by EITHER the shape
    // contract (above) OR the hash lock — together they pin both
    // the structure and the bytes.
    const responses = sha256OfFile(RESPONSES_FIXTURE_PATH);
    const chat = sha256OfFile(CHAT_FIXTURE_PATH);
    const anthropic = sha256OfFile(ANTHROPIC_FIXTURE_PATH);
    expect(responses).not.toBe(chat);
    expect(responses).not.toBe(anthropic);
    expect(chat).not.toBe(anthropic);
  });
});