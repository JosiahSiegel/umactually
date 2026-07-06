// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { parseReviewPayload, isNonEmptyReview } from "../../src/provider/provider-parse.js";

describe("apology summary detection regression", () => {
  const cases: ReadonlyArray<{
    readonly label: string;
    readonly summary: string;
  }> = [
    { label: "no-diff-provided (live evidence)", summary: "No pull request diff was provided in the request, so no review can be produced." },
    { label: "no-diff-shared", summary: "No diff was shared with me." },
    { label: "no-file-contents", summary: "No file contents were provided." },
    { label: "cannot-review-this", summary: "I cannot review this pull request without the diff." },
    { label: "please-share-diff", summary: "Please share the diff so I can review it." },
  ];

  for (const c of cases) {
    it(`detects: ${c.label}`, () => {
      const review = parseReviewPayload(JSON.stringify({
        summary: c.summary,
        verdict: "COMMENT",
        comments: [],
        suppressed_comments: [],
      }));
      // Apology summaries MUST return null so the parse-fail card path fires.
      expect(review).toBeNull();
    });
  }

  it("does NOT match a legitimate empty-diff review (clean verdict)", () => {
    // A clean APPROVED with no diff is NOT an apology — it's a real verdict.
    const review = parseReviewPayload(JSON.stringify({
      summary: "No issues found.",
      verdict: "APPROVED",
      comments: [],
      suppressed_comments: [],
    }));
    expect(review).not.toBeNull();
    expect(review!.verdict).toBe("APPROVED");
    // And it satisfies isNonEmptyReview because verdict is non-empty.
    expect(isNonEmptyReview(review)).toBe(true);
  });
});