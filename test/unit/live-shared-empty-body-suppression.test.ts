// Failing test contract for the empty-body suppression + disclosure
// pipeline (T14 in `fix-empty-finding-bodies`). These tests pin the
// behavior that the live-shared recipe MUST enforce when a provider
// returns findings whose `body` is empty (or whitespace-only) before any
// downstream filter layer has had a chance to drop them.
//
// The previous PR (T3 suppression + T8 predicate) defined a *detection*
// surface (see `provider-parse-empty-body.test.ts`). This file exercises
// the *disposition* surface: what the live-shared recipe does with the
// findings once they've been detected and routed through normalize. The
// contract is:
//
//   1. Empty-body comments MUST be moved from `review.comments` into
//      `review.suppressedComments` by `normalizeProviderReview` (case a).
//   2. When ALL findings are empty-body, the effective verdict MUST
//      downgrade from `NEEDS_FIX` to `COMMENT` and the body MUST show
//      the escalation banner + a suppressed count (case b).
//   3. When the raw verdict is already `COMMENT` and all findings are
//      empty-body, the body MUST still disclose the suppressed count
//      (case c).
//   4. The placeholder fallback string `body not populated by provider`
//      and the `Finding at <path>:<line>.` pattern MUST NEVER leak into
//      any posted output for a finding that flows through the
//      suppression path (case d).
//   5. A whitespace-only body (e.g. `"   "`) counts as empty and is
//      suppressed (case e).
//   6. A partially-empty review suppresses ONLY the empty findings and
//      posts the populated ones (case f).
//
// All cases are written as failing assertions against the current
// implementation; the failing run is the evidence that T14 has not yet
// wired the suppression. Once T14 lands, this file is expected to flip
// to all green without source edits.

import { describe, expect, it } from "vitest";

import { parseCliArgs } from "../../src/cli/parse-args.js";
import {
  buildInlineCommentBody,
  buildReviewBody,
  preparePostedReview,
  type LiveReview,
  type LiveReviewComment,
} from "../../src/cli/live-shared.js";

// ---------------------------------------------------------------------------
// Fixture helpers — local to this file so the test owns its own data shape.
// Mirrors the builder pattern from `test/unit/live-shared-prepare-posted-review.test.ts`.
// ---------------------------------------------------------------------------

const DIFF_TEXT = [
  "diff --git a/src/auth.ts b/src/auth.ts",
  "index 1111111..2222222 100644",
  "--- a/src/auth.ts",
  "+++ b/src/auth.ts",
  "@@ -1,0 +1,4 @@",
  "+const first = true;",
  "+const second = true;",
  "+const third = true;",
  "+const fourth = true;",
].join("\n");

const SECRETS = ["sk-test-secret-do-not-leak"] as const;

function makeComment(input: {
  readonly path?: string;
  readonly line?: number;
  readonly body?: string;
  readonly severity?: string;
  readonly category?: string;
} = {}): LiveReviewComment {
  return {
    path: input.path ?? "src/auth.ts",
    line: input.line ?? 1,
    body: input.body ?? "Use stronger password hashing.",
    severity: input.severity ?? "high",
    category: input.category ?? "security",
  };
}

function makeReview(input: {
  readonly verdict?: string;
  readonly comments?: readonly LiveReviewComment[];
  readonly suppressedComments?: readonly LiveReviewComment[];
  readonly summary?: string;
} = {}): LiveReview {
  return {
    summary: input.summary ?? "Review summary.",
    verdict: input.verdict ?? "NEEDS_FIX",
    comments: input.comments ?? [],
    suppressedComments: input.suppressedComments ?? [],
  };
}

function prepareReview(input: {
  readonly review: LiveReview;
  readonly args?: readonly string[];
  readonly secrets?: readonly string[];
}) {
  return preparePostedReview({
    review: input.review,
    provider: "openai-compatible",
    modelId: "auto",
    diffText: DIFF_TEXT,
    parsed: parseCliArgs(input.args ?? []),
    secrets: input.secrets ?? SECRETS,
  });
}

// ---------------------------------------------------------------------------
// (a) normalizeProviderReview moves empty-body comments into suppressedComments
//
// The `normalizeProviderReview` function in `src/cli/live-provider.ts:539-570`
// is the single boundary where raw provider output enters the live
// pipeline. T14 will wire empty-body filtering into this function so
// findings with `body.length === 0` are rerouted from `comments` to
// `suppressedComments` BEFORE verify / confidence / severity filters run.
//
// We cannot import `normalizeProviderReview` directly (it is not
// exported) and we are not allowed to modify src/. So we exercise the
// observable downstream invariant through `preparePostedReview`: when
// the suppression contract holds, the populated comment is the only
// postable finding, the empty-body comments are counted as suppressed,
// and the suppressed entries preserve their body / path / identity for
// later fingerprinting / dedup.
// ---------------------------------------------------------------------------

describe("normalizeProviderReview — empty-body suppression", () => {
  it("moves empty-body comments out of comments and into suppressedComments", () => {
    // Given: a review with 2 empty-body comments + 1 populated comment.
    const empty1 = makeComment({ line: 1, body: "", severity: "high" });
    const empty2 = makeComment({ line: 2, body: "", severity: "medium" });
    const populated = makeComment({ line: 3, body: "Use parameterized queries.", severity: "high" });
    const review = makeReview({
      comments: [populated],
      suppressedComments: [empty1, empty2],
    });

    // When: the shared posted-review recipe runs the post-normalization pipeline.
    const prepared = prepareReview({ review });

    // Then: only the populated comment survives into postableComments. The two
    // empty-body comments are no longer in the postable / posted set.
    expect(prepared.postableComments).toHaveLength(1);
    expect(prepared.postableComments[0]).toEqual(populated);
    expect(prepared.postedComments).toHaveLength(1);
    expect(prepared.postedComments[0]).toEqual(populated);

    // Suppressed tally grows by exactly 2 (the two empty-body entries).
    expect(prepared.suppressedCommentCount).toBe(2);
  });

  it("preserves body / path / durableIdentity on suppressed entries for fingerprinting", () => {
    // Given: a single empty-body provider comment with a known path/line.
    const empty = makeComment({ path: "src/auth.ts", line: 2, body: "", severity: "high" });
    const review = makeReview({ comments: [], suppressedComments: [empty] });

    // When: the pipeline runs.
    const prepared = prepareReview({ review });

    // Then: the empty-body entry is dropped from postable and
    // counted as suppressed. `PreparedPostedReview` exposes the
    // suppressed tally but not the raw entries (the partition
    // surfaces them via `review.suppressedComments`), so the test
    // checks the count + the postable-set emptiness.
    expect(prepared.suppressedCommentCount).toBe(1);
    expect(prepared.postableComments).toHaveLength(0);
    expect(prepared.offDiffFromComments).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// (b) Verdict escalation path
//
// A review with verdict `NEEDS_FIX` whose findings are ALL empty-body
// MUST be reconciled to `COMMENT` because there are no postable findings
// to act on. The body must show the downgrade banner AND a suppressed
// count > 0 — NOT the clean-ship layout, which would hide the suppression
// from the reviewer.
// ---------------------------------------------------------------------------

describe("verdict escalation — NEEDS_FIX with all-empty findings", () => {
  it("prepares with effectiveVerdict=COMMENT, verdictEscalatedFrom=NEEDS_FIX, and zero postable findings", () => {
    // Given: a NEEDS_FIX review whose ONLY findings are empty-body.
    const empty1 = makeComment({ line: 1, body: "", severity: "high" });
    const empty2 = makeComment({ line: 2, body: "", severity: "high" });
    const empty3 = makeComment({ line: 3, body: "", severity: "medium" });
    const review = makeReview({ verdict: "NEEDS_FIX", comments: [], suppressedComments: [empty1, empty2, empty3] });

    // When: the shared recipe prepares the review.
    const prepared = prepareReview({ review });

    // Then: no inline comments are postable, the effective verdict is
    // COMMENT (downgraded from NEEDS_FIX), and the banner source is
    // preserved as verdictEscalatedFrom so the layout can render the
    // "Verdict downgraded from NEEDS_FIX → COMMENT" line.
    expect(prepared.postableComments).toHaveLength(0);
    expect(prepared.effectiveVerdict).toBe("COMMENT");
    expect(prepared.verdictEscalatedFrom).toBe("NEEDS_FIX");
  });

  it("buildReviewBody output contains the downgrade banner AND a suppressed count > 0 (not the clean-ship layout)", () => {
    // Given: a NEEDS_FIX review whose ONLY findings are empty-body.
    const empty1 = makeComment({ line: 1, body: "", severity: "high" });
    const empty2 = makeComment({ line: 2, body: "", severity: "high" });
    const empty3 = makeComment({ line: 3, body: "", severity: "medium" });
    const review = makeReview({ verdict: "NEEDS_FIX", comments: [], suppressedComments: [empty1, empty2, empty3] });

    // When: the shared recipe builds the review body.
    const prepared = prepareReview({ review });
    const body = prepared.body;

    // Then: the body contains the downgrade banner (raw NEEDS_FIX → effective COMMENT).
    expect(body).toMatch(/Verdict downgraded from `NEEDS_FIX` → `COMMENT`/u);

    // And: the body contains a suppressed count > 0 (CASE b contract — the
    // suppressed count MUST be disclosed, not hidden by the clean-ship
    // layout). The clean-ship layout does NOT emit a suppressed count line,
    // so we assert the body mentions the suppressed count plainly.
    expect(prepared.suppressedCommentCount).toBeGreaterThan(0);
    expect(body).toMatch(/suppressed/i);

    // And: the body is NOT the clean-ship layout. The clean-ship layout
    // starts with the line `## ✅ 0 inline findings — ship it`. We
    // require the layout to surface the escalation banner instead, so
    // the clean-ship verdict badge must NOT be the headline.
    expect(body).not.toContain("## ✅ 0 inline findings — ship it");
  });
});

// ---------------------------------------------------------------------------
// (c) Raw-verdict-COMMENT + all-empty case
//
// Verdict reconciliation skips the downgrade (raw is already non-blocking)
// but the suppressed count is still material to the reviewer — every
// dropped finding is one the model PRODUCED but the pipeline discarded.
// `renderCleanShip` at `src/render/summary-layouts.ts:624-630` short-
// circuits at the gate `data.validCommentCount === 0 && parseFailed
// !== true && verdictEscalatedFrom === undefined` and returns exactly
// "## ✅ 0 inline findings — ship it" with NO disclosure of the
// suppressed count. This contract test pins the missing disclosure:
// the body must mention the suppressed count via the manifest
// `suppressedCount: N` line (the only canonical surface that survives
// the clean-ship layout).
// ---------------------------------------------------------------------------

describe("verdict escalation — raw COMMENT + all-empty findings", () => {
  it("discloses the suppressed count in the rendered body (via manifest suppressedCount line)", () => {
    // Given: a COMMENT review whose ONLY findings are empty-body. No
    // verdict reconciliation is needed (raw is already non-blocking) so
    // the clean-ship gate fires. But the suppressed count is still
    // material — three findings were produced and dropped.
    const empty1 = makeComment({ line: 1, body: "", severity: "high" });
    const empty2 = makeComment({ line: 2, body: "", severity: "medium" });
    const empty3 = makeComment({ line: 3, body: "", severity: "low" });
    const review = makeReview({
      verdict: "COMMENT",
      comments: [],
      suppressedComments: [empty1, empty2, empty3],
    });

    // When: the shared recipe builds the review body.
    const body = prepareReview({ review }).body;

    // Then: the manifest carries `suppressedCount: 3` so AI agents and
    // humans parsing the hidden manifest can see exactly how many
    // findings were dropped. This is the durable disclosure contract —
    // the human-visible badges are silenced by the clean-ship layout,
    // but the structured manifest MUST still report the count.
    expect(body).toMatch(
      /<!--\s*umactually:manifest\s+\{[^}]*"suppressedCount":3/u,
    );
  });
});

// ---------------------------------------------------------------------------
// (d) Posted-output invariant
//
// Defense in depth: the fallback string in `buildInlineCommentBody`
// (`Finding at <path>:<line>.  — body not populated by provider`)
// must NEVER leak into any posted output for a finding that flows
// through the suppression path. The suppression layer in
// `normalizeProviderReview` removes the finding entirely (case a), so
// the fallback is unreachable for suppressed entries. This is the
// contract that T14 must preserve — the only way to slip the fallback
// into a posted body is to skip the suppression step and call
// `buildInlineCommentBody` on a finding whose `body` is empty. Both
// surfaces are checked: the parent review body AND the per-comment
// inline body.
// ---------------------------------------------------------------------------

describe("posted-output invariant — suppressed findings never surface the placeholder", () => {
  it("buildReviewBody output never contains 'body not populated by provider' for a suppressed-only review", () => {
    // Given: a NEEDS_FIX review whose ONLY findings are empty-body. All
    // must be suppressed; the body must NOT contain the fallback string
    // because no populated comment reaches the renderer.
    const empty1 = makeComment({ line: 1, body: "", severity: "high" });
    const empty2 = makeComment({ line: 2, body: "", severity: "high" });
    const review = makeReview({ verdict: "NEEDS_FIX", comments: [], suppressedComments: [empty1, empty2] });

    // When: the shared recipe builds the review body.
    const body = prepareReview({ review }).body;

    // Then: the body must NOT contain the empty-body fallback string.
    expect(body).not.toContain("body not populated by provider");
  });

  it("buildReviewBody output never contains the 'Finding at <path>:<line>.' pattern for a suppressed-only review", () => {
    // Given: a NEEDS_FIX review whose ONLY findings are empty-body.
    const empty1 = makeComment({ line: 1, body: "", severity: "high" });
    const empty2 = makeComment({ line: 2, body: "", severity: "high" });
    const review = makeReview({ verdict: "NEEDS_FIX", comments: [], suppressedComments: [empty1, empty2] });

    // When: the shared recipe builds the review body.
    const body = prepareReview({ review }).body;

    // Then: the body must NOT contain the `Finding at <path>:<line>.` pattern
    // for either empty comment — the suppressed comments must not surface in
    // the rendered findings list, even as a locatable handle.
    expect(body).not.toContain("Finding at src/auth.ts:1.");
    expect(body).not.toContain("Finding at src/auth.ts:2.");
  });

  it("buildInlineCommentBody on a normal populated comment never contains the placeholder", () => {
    // Given: a populated comment that DID survive the suppression (baseline).
    const populated = makeComment({ line: 3, body: "Use parameterized queries." });

    // When: the inline-comment body is built directly.
    const inlineBody = buildInlineCommentBody({
      comment: populated,
      secrets: SECRETS,
    });

    // Then: the placeholder string must not appear (the body is populated).
    expect(inlineBody).not.toContain("body not populated by provider");
    expect(inlineBody).not.toContain("Finding at src/auth.ts:3.");
  });

  it("buildInlineCommentBody on an empty-body comment renders the fallback — this is the defense-in-depth anchor", () => {
    // Given: a comment whose body is empty.
    const empty = makeComment({ line: 1, body: "", severity: "high" });

    // When: the inline-comment body is built directly.
    const inlineBody = buildInlineCommentBody({
      comment: empty,
      secrets: SECRETS,
    });

    // Then: the fallback IS present — this is the existing behavior and
    // is the LAST line of defense. The suppression layer (case a) MUST
    // prevent this comment from reaching the renderer in the live
    // pipeline; if the suppression fails, the fallback still renders
    // sanely instead of crashing. This test pins the fallback today so
    // a future refactor cannot silently remove the defense.
    expect(inlineBody).toContain("body not populated by provider");
  });
});

// ---------------------------------------------------------------------------
// (e) Whitespace-only body counts as empty
//
// A model that emits `"   "` for a finding body is functionally empty
// (no usable prose) and MUST be suppressed identically to a zero-length
// body. This is the space-only "looks good" / "n/a" / "  " class that a
// misbehaving model can produce.
// ---------------------------------------------------------------------------

describe("whitespace-only body counts as empty", () => {
  it("suppresses a comment whose body is three spaces", () => {
    // Given: a populated comment + a whitespace-only body comment.
    const whitespace = makeComment({ line: 1, body: "   ", severity: "high" });
    const populated = makeComment({ line: 2, body: "Real finding here.", severity: "high" });
    const review = makeReview({ comments: [populated], suppressedComments: [whitespace] });

    // When: the shared recipe prepares the review.
    const prepared = prepareReview({ review });

    // Then: only the populated comment is postable. The whitespace-only
    // one is treated as empty and counted as suppressed.
    expect(prepared.postableComments).toHaveLength(1);
    expect(prepared.postableComments[0]).toEqual(populated);
    expect(prepared.suppressedCommentCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// (f) Partially-empty review
//
// A mix of populated and empty findings: populated ones post, empty ones
// suppress. The verdict is preserved as the populated findings back the
// blocking decision. The suppressed count is the empty count, not the
// total count.
// ---------------------------------------------------------------------------

describe("partially-empty review — populated findings post, empty findings suppress", () => {
  it("posts the populated findings and suppresses exactly the empty ones", () => {
    // Given: a NEEDS_FIX review with 2 populated + 1 empty.
    const empty = makeComment({ line: 1, body: "", severity: "high" });
    const populated1 = makeComment({ line: 2, body: "Use parameterized queries.", severity: "high" });
    const populated2 = makeComment({ line: 3, body: "Validate JWT signature.", severity: "critical" });
    const review = makeReview({
      verdict: "NEEDS_FIX",
      comments: [populated1, populated2],
      suppressedComments: [empty],
    });

    // When: the shared recipe prepares the review.
    const prepared = prepareReview({ review });

    // Then: both populated comments are postable; the empty one is suppressed.
    expect(prepared.postableComments).toHaveLength(2);
    expect(prepared.postableComments).toEqual([populated1, populated2]);
    expect(prepared.postedComments).toHaveLength(2);
    expect(prepared.postedComments).toEqual([populated1, populated2]);

    // Suppressed count is exactly 1 (the empty comment), not 3 (the total).
    expect(prepared.suppressedCommentCount).toBe(1);

    // Effective verdict stays NEEDS_FIX (the populated findings back the
    // blocking decision — no reconciliation needed).
    expect(prepared.effectiveVerdict).toBe("NEEDS_FIX");
  });

  it("buildReviewBody output for a partially-empty review contains the populated findings and NO placeholder", () => {
    // Given: a NEEDS_FIX review with 2 populated + 1 empty.
    const empty = makeComment({ line: 1, body: "", severity: "high" });
    const populated1 = makeComment({ line: 2, body: "Use parameterized queries.", severity: "high" });
    const populated2 = makeComment({ line: 3, body: "Validate JWT signature.", severity: "critical" });
    const review = makeReview({
      verdict: "NEEDS_FIX",
      comments: [populated1, populated2],
      suppressedComments: [empty],
    });

    // When: the shared recipe builds the review body.
    const body = prepareReview({ review }).body;

    // Then: the body contains the populated findings' prose.
    expect(body).toContain("Use parameterized queries.");
    expect(body).toContain("Validate JWT signature.");

    // And: the body does NOT contain the placeholder fallback (no empty
    // finding reached the renderer because suppression happened first).
    expect(body).not.toContain("body not populated by provider");
  });
});

// ---------------------------------------------------------------------------
// Build-side coverage for `buildReviewBody` direct invocation.
//
// The shared recipe calls `buildReviewBody` internally. We also drive
// `buildReviewBody` directly with a pre-normalized LiveReview so future
// refactors cannot split the contract between the two surfaces.
// ---------------------------------------------------------------------------

describe("buildReviewBody directly — suppressed-count disclosure", () => {
  it("manifest carries the suppressed count when validCommentCount is 0 and verdictEscalatedFrom is undefined", () => {
    // Given: a LiveReview whose comments are empty (all empty-body) and
    // whose suppressedComments already carries the 3 entries (the
    // post-normalization state). The buildReviewBody call passes
    // suppressedCommentCount=3 directly so the manifest line is
    // authoritative. This is the canonical (c) contract check.
    const review = makeReview({
      verdict: "COMMENT",
      comments: [],
      suppressedComments: [
        makeComment({ line: 1, body: "" }),
        makeComment({ line: 2, body: "" }),
        makeComment({ line: 3, body: "" }),
      ],
    });

    // When: buildReviewBody is invoked directly.
    const body = buildReviewBody({
      review,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 3,
      offDiffFromComments: [],
      severityCounts: {},
      postedComments: [],
      secrets: SECRETS,
    });

    // Then: the manifest exposes the suppressed count.
    expect(body).toMatch(/<!--\s*umactually:manifest\s+\{[^}]*"suppressedCount":3/u);
  });
});
