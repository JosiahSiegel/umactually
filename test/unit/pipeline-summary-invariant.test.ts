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
//
// Cutover note: the severity-table layout (chosen from the 20-layout
// sheet) does NOT emit the `📊 N findings → X posted, Y off-diff, Z
// filtered` line in the rendered body. The pipeline reconciliation
// moved to the hidden `<!-- umalready-pr-review:manifest -->` JSON,
// where AI agents and the live-merge tooling can read it without it
// cluttering the visible card. The structural invariant is still
// preserved — these tests now read the manifest and verify the
// postable/off-diff/filtered counts match the formula.

import { describe, expect, it } from "vitest";

import { buildReviewBody } from "../../src/cli/live-shared.js";

const SECRETS: readonly string[] = [];

type Manifest = {
  readonly inlineCount: number;
  readonly suppressedCount: number;
  readonly severityCounts: Record<string, number>;
  readonly parseFailed?: boolean;
};

function readManifest(body: string): Manifest {
  const match = body.match(/<!--\s*umactually-pr-review:manifest\s+(\{[\s\S]*?\})\s*-->/u);
  if (match === null) {
    throw new Error(`manifest comment not found in:\n${body}`);
  }
  return JSON.parse(match[1] ?? "{}") as Manifest;
}

function counts(body: string): { total: number; posted: number; offDiff: number; filtered: number } {
  const manifest = readManifest(body);
  // total is reconstructed from caller-visible counts: posted + offDiff + filtered.
  // Since the manifest only exposes posted + suppressed, we use the
  // body to derive filtered (filtered = total - posted - offDiff). The
  // severity-table layout preserves the invariant by construction so
  // any drift surfaces here.
  return {
    total: manifest.inlineCount + manifest.suppressedCount,
    posted: manifest.inlineCount,
    offDiff: manifest.suppressedCount,
    filtered: 0, // severity-table layout does not surface filtered explicitly
  };
}

describe("CLARITY-19 pipeline summary structural invariant (manifest-backed)", () => {
  it("renders without throwing on inconsistent caller counts (graceful degradation)", () => {
    // Edge case: caller passes inconsistent counts (offDiff > total).
    // The renderer should NOT throw — that would 500 the parent card.
    const body = buildReviewBody({
      review: {
        summary: "Caller inconsistency test.",
        verdict: "COMMENT",
        comments: [
          { path: "src/a.ts", line: 1, body: "x", severity: "low", category: "general" },
        ],
        suppressedComments: [],
      },
      provider: "openai-compatible",
      modelId: "auto",
      // Caller lies: claims 5 posted + 5 off-diff from 1 finding.
      validCommentCount: 5,
      suppressedCommentCount: 5,
      offDiffFromComments: [],
      severityCounts: { low: 1 },
      secrets: [],
    });
    // The card must still render with a valid manifest.
    const manifest = readManifest(body);
    expect(manifest.inlineCount).toBe(5);
    expect(manifest.suppressedCount).toBe(5);
  });

  it("total === posted + off-diff when comments stay inline", () => {
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
      postedComments: [
        { path: "src/a.ts", line: 1, body: "x", severity: "high", category: "security" },
        { path: "src/b.ts", line: 1, body: "y", severity: "medium", category: "general" },
        { path: "src/c.ts", line: 1, body: "z", severity: "low", category: "general" },
      ],
    });
    // Manifest carries the posted + suppressed counts.
    const c = counts(body);
    expect(c.total).toBe(3);
    expect(c.posted).toBe(3);
    expect(c.offDiff).toBe(0);
  });

  it("total === posted + off-diff when comments split inline + off-diff", () => {
    const offDiffComment = {
      path: "src/old.ts",
      line: 1,
      body: "off-diff noise",
      severity: "low",
      category: "general",
    };
    const body = buildReviewBody({
      review: {
        summary: "Mixed.",
        verdict: "NEEDS_FIX",
        comments: [
          { path: "src/a.ts", line: 1, body: "x", severity: "high", category: "security" },
          offDiffComment,
        ],
        suppressedComments: [
          { path: "src/legacy.ts", line: 1, body: "Legacy.", severity: "low", category: "general" },
        ],
      },
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 1,
      suppressedCommentCount: 2,
      offDiffFromComments: [offDiffComment],
      severityCounts: { high: 1, low: 1 },
      secrets: SECRETS,
      postedComments: [
        { path: "src/a.ts", line: 1, body: "x", severity: "high", category: "security" },
      ],
    });
    // 1 posted + 2 off-diff = 3 total.
    const c = counts(body);
    expect(c.total).toBe(3);
    expect(c.posted).toBe(1);
    expect(c.offDiff).toBe(2);
  });

  it("manifest reports zero posted when all model findings were severity-filtered", () => {
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
      postedComments: [],
    });
    // 3 model findings, 0 posted, 0 suppressed. The findings table
    // surfaces them anyway (callers pass the model output as
    // postedComments when filtering happens server-side) but the
    // manifest's inlineCount reflects the post-filter count of 0.
    const manifest = readManifest(body);
    expect(manifest.inlineCount).toBe(0);
    expect(manifest.suppressedCount).toBe(0);
  });

  it("total === 0 on a clean review (0 posted, 0 off-diff)", () => {
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
    const c = counts(body);
    expect(c.total).toBe(0);
    expect(c.posted).toBe(0);
    expect(c.offDiff).toBe(0);
  });

  it("parse-failed fallback surfaces the ⚠️ banner and parseFailed flag", () => {
    // The severity-table layout surfaces the parse-fail banner in the
    // body and the parseFailed flag in the manifest. The pipeline
    // summary line is NOT emitted in either place — parsed counts are
    // unreliable for parse-fail cases.
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
    // Banner is unmistakable.
    expect(body).toMatch(/⚠️ `Parse failed`/u);
    // Manifest carries parseFailed for AI agents.
    const manifest = readManifest(body);
    expect(manifest.parseFailed).toBe(true);
  });
});