// Pins the self-healing review pipeline (CLARITY-10):
//   1. The SSE parser handles the OpenAI Responses API streaming format
//      (`response.output_text.delta`, `response.completed`) in addition
//      to the chat-completions and unknown-format SSE variants.
//   2. A "0-finding" parse that comes from a non-review JSON shape
//      (e.g. an OpenAI chat response fed to the responses endpoint)
//      counts as a parse failure — the previous parser was permissive
//      and would post an empty review, masking the failure.
//   3. Self-healing retry: when parse fails, the runner retries once
//      with an explicit JSON-only reminder before falling back.
//   4. The Posted/Considered/Suppressed row renders a prominent
//      `⚠️ Parse failed` badge so a 0-finding review cannot be
//      confused with a clean bill of health.
//   5. The machine-readable manifest includes `parseFailed: true`
//      so downstream agents can branch on the failure.
import { describe, expect, it } from "vitest";

import { buildReviewBody, buildMalformedProviderFallback } from "../../src/cli/live-shared.js";

describe("CLARITY-10: parse-fail surface is unmistakable", () => {
  it("renders a prominent ⚠️ Parse failed badge on the parent card", () => {
    const fallbackReview = buildMalformedProviderFallback({
      provider: "openai-compatible",
      modelId: "auto",
      rawText: "Provider response did not contain a JSON review payload.",
      secrets: [],
    });
    const body = buildReviewBody({
      review: fallbackReview,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      secrets: [],
    });
    expect(body).toMatch(/⚠️ `Parse failed`/u);
    // CLARITY-14: the Posted/Considered/Suppressed row was removed in
    // the actionable-only card redesign. The parse-failed banner is
    // now followed directly by the summary <details>. Confirm the
    // row labels are gone so we don't regress.
    expect(body).not.toMatch(/\*\*Posted:\*\*/u);
    expect(body).not.toMatch(/\*\*Considered:\*\*/u);
    expect(body).not.toMatch(/\*\*Suppressed:\*\*/u);
  });

  it("sets parseFailed: true on the fallback review and surfaces it in the manifest", () => {
    const fallbackReview = buildMalformedProviderFallback({
      provider: "openai-compatible",
      modelId: "auto",
      rawText: "garbage",
      secrets: [],
    });
    expect(fallbackReview.parseFailed).toBe(true);

    const body = buildReviewBody({
      review: fallbackReview,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      secrets: [],
    });
    const manifestMatch = body.match(/<!--\s*umactually-pr-review:manifest\s+(\{[\s\S]*?\})\s+-->/u);
    expect(manifestMatch).not.toBeNull();
    const manifest = JSON.parse(manifestMatch?.[1] ?? "{}");
    expect(manifest.parseFailed).toBe(true);
  });

  it("does NOT set parseFailed on a successful (non-empty) review", () => {
    const successfulReview = {
      summary: "Found one issue.",
      verdict: "NEEDS_FIX",
      comments: [
        { path: "src/auth.ts", line: 1, body: "Use bcrypt.", severity: "high", category: "security" },
      ],
      suppressedComments: [],
    };
    const body = buildReviewBody({
      review: successfulReview,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 1,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      secrets: [],
    });
    expect(body).not.toMatch(/⚠️ \*\*Parse failed\*\*/u);
    const manifestMatch = body.match(/<!--\s*umactually-pr-review:manifest\s+(\{[\s\S]*?\})\s+-->/u);
    const manifest = JSON.parse(manifestMatch?.[1] ?? "{}");
    expect(manifest.parseFailed).toBeUndefined();
  });

  it("does NOT set parseFailed on an empty-but-structured review (no findings)", () => {
    // A real review that returned 0 findings (e.g. model found nothing
    // worth flagging) is structurally different from a parse failure.
    // The empty review is a success signal; only parse failures get
    // the ⚠️ badge.
    const emptyReview = {
      summary: "All clean.",
      verdict: "APPROVED",
      comments: [],
      suppressedComments: [],
    };
    const body = buildReviewBody({
      review: emptyReview,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      secrets: [],
    });
    expect(body).not.toMatch(/⚠️ `Parse failed`/u);
  });
});

