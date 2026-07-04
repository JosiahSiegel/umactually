// Pins the CLARITY-19 pipeline-summary structural invariant:
//   totalFindings === postedCount + offDiffCount + filteredCount
//
// Where:
//   totalFindings  = review.comments.length + review.suppressedComments.length
//   postedCount    = validCommentCount (caller-supplied)
//   offDiffCount   = suppressedCommentCount (caller-supplied)
//   filteredCount  = max(0, totalFindings - postedCount - offDiffCount)
//
// A future code path that routes severity-rejected comments somewhere
// other than review.suppressedComments would shift the counts and
// silently skew the rendered pipeline summary. The assertions below
// exercise every (total, posted, off-diff) shape the live path produces
// so a refactor of the formula fails loud.

import { describe, expect, it } from "vitest";

import { buildReviewBody } from "../../src/cli/live-shared.js";

const SECRETS: readonly string[] = [];

function line(body: string): string {
  // Extract the 📊 pipeline summary line for direct numeric comparison.
  const match = body.match(/📊\s+\d+\s+findings\s+→\s+\d+\s+posted,\s+\d+\s+off-diff,\s+\d+\s+filtered/u);
  if (!match) {
    throw new Error(`pipeline summary line not found in:\n${body}`);
  }
  return match[0];
}

describe("CLARITY-19 pipeline summary structural invariant", () => {
  it("total === posted + off-diff + filtered when comments stay inline", () => {
    const body = buildReviewBody({
      review: {
        summary: "Three findings posted.",
        verdict: "NEEDS_FIX",
        comments: [
          { path: "src/a.ts", line: 1, body: "x", severity: "high", category: "security" },
          { path: "src/b.ts", line: 1, body: "y", severity: "medium", category: "general" },
          { path: "src/c.ts", line: 1, body: "z", severity: "low", category: "general" },
        ],
        suppressedComments: [],
      },
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 3,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      severityCounts: { high: 1, medium: 1, low: 1 },
      secrets: SECRETS,
    });
    // 3 + 0 + 0 = 3 total. posted=3, off-diff=0, filtered=0.
    expect(line(body)).toBe("📊 3 findings → 3 posted, 0 off-diff, 0 filtered");
  });

  it("total === posted + off-diff + filtered when comments split inline + off-diff", () => {
    const body = buildReviewBody({
      review: {
        summary: "Mixed.",
        verdict: "NEEDS_FIX",
        comments: [
          { path: "src/a.ts", line: 1, body: "x", severity: "high", category: "security" },
          { path: "src/old.ts", line: 1, body: "off-diff noise", severity: "low", category: "general" },
        ],
        suppressedComments: [
          { path: "src/legacy.ts", line: 1, body: "Legacy.", severity: "low", category: "general" },
        ],
      },
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 1,
      suppressedCommentCount: 2,
      offDiffFromComments: [],
      severityCounts: { high: 1, low: 1 },
      secrets: SECRETS,
    });
    // total = 2 comments + 1 suppressed = 3. posted=1, off-diff=2, filtered=0.
    // 1 + 2 + 0 = 3 ✓
    expect(line(body)).toBe("📊 3 findings → 1 posted, 2 off-diff, 0 filtered");
  });

  it("total === posted + off-diff + filtered when model comments are severity-filtered", () => {
    // validCommentCount=0 but review.comments has 3 (severity policy dropped
    // all of them). total = 3, posted=0, off-diff=0, filtered=3.
    const body = buildReviewBody({
      review: {
        summary: "All filtered.",
        verdict: "COMMENT",
        comments: [
          { path: "dist/cli.js", line: 1, body: "Bundled", severity: "info", category: "build" },
          { path: "dist/cli.js", line: 2, body: "Bundled", severity: "info", category: "build" },
          { path: "dist/index.js", line: 1, body: "Bundled", severity: "info", category: "build" },
        ],
        suppressedComments: [],
      },
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
      secrets: SECRETS,
    });
    // total = 3 comments + 0 suppressed = 3. posted=0, off-diff=0, filtered=3.
    expect(line(body)).toBe("📊 3 findings → 0 posted, 0 off-diff, 3 filtered");
  });

  it("total === 0 on a clean review (0 posted, 0 off-diff, 0 filtered)", () => {
    const body = buildReviewBody({
      review: { summary: "All clear.", verdict: "SHIP", comments: [], suppressedComments: [] },
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
      secrets: SECRETS,
    });
    expect(line(body)).toBe("📊 0 findings → 0 posted, 0 off-diff, 0 filtered");
  });

  it("parse-failed fallback skips the pipeline summary entirely", () => {
    // The parseFailed fallback has review.comments.length === 0
    // (parse failed) but validCommentCount might still be 0 too.
    // The caller gates on input.review.parseFailed === true to skip
    // rendering the summary because parsed counts are unreliable.
    const body = buildReviewBody({
      review: {
        summary: "Provider returned non-JSON.",
        verdict: "COMMENT",
        comments: [],
        suppressedComments: [],
        parseFailed: true,
      },
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
      secrets: SECRETS,
    });
    expect(body).not.toMatch(/📊/u);
  });
});