import { describe, expect, it } from "vitest";

import { parseCliArgs } from "../../src/cli/parse-args.js";
import {
  preparePostedReview,
  type LiveReview,
  type LiveReviewComment,
} from "../../src/cli/live-shared.js";
import { REVIEW_MARKER } from "../../src/util/marker.js";

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
  readonly comments?: readonly LiveReviewComment[];
  readonly suppressedComments?: readonly LiveReviewComment[];
  readonly summary?: string;
} = {}): LiveReview {
  return {
    summary: input.summary ?? "Review summary.",
    verdict: "NEEDS_FIX",
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

describe("preparePostedReview", () => {
  it("returns empty arrays for empty review", () => {
    // Given: a provider review with no inline or suppressed findings.
    const review = makeReview();

    // When: the shared posted-review recipe prepares the posting payload.
    const prepared = prepareReview({ review });

    // Then: every comment collection is empty and the body still has a summary contract.
    expect(prepared.postableComments).toEqual([]);
    expect(prepared.offDiffFromComments).toEqual([]);
    expect(prepared.postedComments).toEqual([]);
    expect(prepared.suppressedCommentCount).toBe(0);
    expect(prepared.severityCounts).toEqual({});
    expect(prepared.body).toContain(REVIEW_MARKER);
  });

  it("selects only in-diff postable comments", () => {
    // Given: one finding lands on the diff and one points outside the diff.
    const inDiff = makeComment({ line: 2, severity: "high" });
    const offDiff = makeComment({ line: 99, severity: "critical" });
    const review = makeReview({ comments: [inDiff, offDiff] });

    // When: the shared recipe prepares the review.
    const prepared = prepareReview({ review });

    // Then: only the in-diff finding is postable and the off-diff finding is counted separately.
    expect(prepared.postableComments).toEqual([inDiff]);
    expect(prepared.postedComments).toEqual([inDiff]);
    expect(prepared.offDiffFromComments).toEqual([offDiff]);
    expect(prepared.suppressedCommentCount).toBe(1);
  });

  it("applies severity filter", () => {
    // Given: low and info findings are mixed with an actionable high finding.
    const low = makeComment({ line: 1, severity: "low" });
    const info = makeComment({ line: 2, severity: "info" });
    const high = makeComment({ line: 3, severity: "high" });
    const review = makeReview({ comments: [low, info, high] });

    // When: the minimum posted severity is low.
    const prepared = prepareReview({
      review,
      args: ["--minimum-severity", "low"],
    });

    // Then: low (= threshold) and high (> threshold) survive; info (< threshold) is excluded.
    expect(prepared.postableComments).toEqual([low, high]);
    expect(prepared.postedComments).toEqual([low, high]);
  });

  it("respects maxComments cap", () => {
    // Given: three in-diff findings are available for posting.
    const first = makeComment({ line: 1, severity: "critical" });
    const second = makeComment({ line: 2, severity: "high" });
    const third = makeComment({ line: 3, severity: "medium" });
    const review = makeReview({ comments: [first, second, third] });

    // When: max-comments caps posting to the first two findings.
    const prepared = prepareReview({ review, args: ["--max-comments", "2"] });

    // Then: the postable and posted arrays honor the cap.
    expect(prepared.postableComments).toEqual([first, second]);
    expect(prepared.postedComments).toEqual([first, second]);
  });

  it("counts severity from postable comments", () => {
    // Given: one high finding is postable and a critical finding is off-diff.
    const high = makeComment({ line: 1, severity: "high" });
    const offDiffCritical = makeComment({ line: 99, severity: "critical" });
    const review = makeReview({ comments: [high, offDiffCritical] });

    // When: the shared recipe computes severity counts.
    const prepared = prepareReview({ review });

    // Then: counts reflect only the posted/postable set.
    expect(prepared.severityCounts).toEqual({ high: 1 });
    expect(prepared.body).toContain("`1` high");
    expect(prepared.body).not.toContain("`1` critical");
  });

  it("sanitizes secrets in body", () => {
    // Given: the provider summary and finding body contain a secret value.
    const review = makeReview({
      summary: "Token sk-test-secret-do-not-leak was exposed.",
      comments: [makeComment({ line: 1, body: "Remove sk-test-secret-do-not-leak from code." })],
    });

    // When: the shared recipe builds the review body.
    const prepared = prepareReview({ review });

    // Then: the body is safe to post and contains the redaction marker instead.
    expect(prepared.body).not.toContain("sk-test-secret-do-not-leak");
    expect(prepared.body).toContain("[REDACTED_SECRET]");
  });

  it("builds the same body for GitHub and Azure inputs", () => {
    // Given: both live platforms prepare an identical review with identical shared metadata.
    const review = makeReview({ comments: [makeComment({ line: 1 })] });

    // When: GitHub and Azure use the shared helper with the same body inputs.
    const githubPrepared = prepareReview({ review });
    const azurePrepared = prepareReview({ review });

    // Then: the parent review body invariant is byte-identical across platforms.
    expect(githubPrepared.body).toBe(azurePrepared.body);
  });

  it("includes manifest marker in body", () => {
    // Given: a postable finding that will be included in the parent body contract.
    const review = makeReview({ comments: [makeComment({ line: 1 })] });

    // When: the shared recipe builds the review body.
    const prepared = prepareReview({ review });

    // Then: the stable marker and machine-readable manifest are both present.
    expect(prepared.body).toContain(REVIEW_MARKER);
    expect(prepared.body).toMatch(/<!--\s*umactually:manifest\s*\{[\s\S]*?\}\s*-->/u);
  });
});
