// Pins the new headline invariant for the severity-table layout.
//
// OLD format (rejected 2026-07-05 by user feedback):
//   "📊 13 findings → 9 posted, 4 off-diff, 0 filtered"
// — The headline number was the model's gross output, not the
//   number of findings the reviewer would see inline. The reader
//   had to subtract to learn what would actually appear on the PR.
//
// NEW format (this test):
//   "📊 9 inline findings"
//   "> 🔍 4 off-diff findings not posted inline — the model
//    produced them but they target files not in this PR's diff."
// — The headline is the posted count (the reader's question is
//   "how many findings will appear on this PR?"). The off-diff
//   count is a separate callout that explains the *reason* for
//   the gap, not the math.
//
// The manifest still carries `inlineCount` and `suppressedCount`
// for downstream consumers. The math invariant
// (total === posted + off-diff + filtered) is preserved by the
// data model — the renderer just no longer jams it into the
// headline. See `CHANGELOG.md` [Unreleased] for the rationale.

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
  const match = body.match(/<!--\s*umactually:manifest\s+(\{[\s\S]*?\})\s*-->/u);
  if (match === null) {
    throw new Error(`manifest comment not found in:\n${body}`);
  }
  return JSON.parse(match[1] ?? "{}") as Manifest;
}

describe("CLARITY-19 (new) headline invariant — off-diff callout retired (CLARITY-19a)", () => {
  it("renders without throwing on inconsistent caller counts (graceful degradation)", () => {
    // Edge case: caller passes inconsistent counts. The renderer
    // should NOT throw — that would 500 the parent card.
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

  it("headline reads 'N inline findings' and the callout is absent when all comments stay inline", () => {
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
    // Headline: 3 inline findings.
    expect(body).toMatch(/📊\s+3\s+inline\s+findings/u);
    // No off-diff callout (offDiffCount === 0).
    expect(body).not.toMatch(/not posted inline/u);
    // Manifest still carries the breakdown.
    const manifest = readManifest(body);
    expect(manifest.inlineCount).toBe(3);
    expect(manifest.suppressedCount).toBe(0);
  });

  it("headline reads 'N inline findings' when comments split inline + off-diff (CLARITY-19a retired: no off-diff callout)", () => {
    // CLARITY-19a retired: the off-diff callout was removed because
    // reviewers don't action off-diff findings (they target files
    // outside this PR's diff) and the dashboard "Off-diff: N" KPI
    // tile already exposes the count without noise. The headline
    // still leads with the posted count; off-diff counts live in the
    // manifest only.
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
    // Headline: 1 inline finding (NOT 3, NOT "3 findings → 1 posted").
    expect(body).toMatch(/📊\s+1\s+inline\s+finding/u);
    // No off-diff callout (retired). The dashboard KPI tile carries
    // the count; the manifest carries the machine-readable breakdown.
    expect(body).not.toMatch(/not posted inline/u);
    expect(body).not.toMatch(/🔍/u);
    // Manifest still carries the breakdown.
    const manifest = readManifest(body);
    expect(manifest.inlineCount).toBe(1);
    expect(manifest.suppressedCount).toBe(2);
  });

  it("body collapses to the ship-it line when all model findings were filtered", () => {
    const body = buildReviewBody({
      review: {
        summary: "",
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
    expect(body).toContain("## ✅ 0 inline findings — ship it");
    expect(body).not.toMatch(/📊\s+0\s+inline\s+findings/u);
    // Manifest's inlineCount reflects the post-filter count of 0.
    const manifest = readManifest(body);
    expect(manifest.inlineCount).toBe(0);
  });

  it("body collapses to the ship-it line on a clean review (0 posted, 0 off-diff)", () => {
    const body = buildReviewBody({
      review: { summary: "", verdict: "SHIP", comments: [], suppressedComments: [] },
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
      secrets: SECRETS,
    });
    expect(body).toContain("## ✅ 0 inline findings — ship it");
    expect(body).not.toMatch(/📊\s+0\s+inline\s+findings/u);
    // No off-diff callout when offDiffCount === 0.
    expect(body).not.toMatch(/not posted inline/u);
  });

  it("parse-failed fallback surfaces the ⚠️ banner and parseFailed flag", () => {
    // The severity-table layout surfaces the parse-fail banner in the
    // body and the parseFailed flag in the manifest. The headline
    // and off-diff callout are NOT emitted in either place — parsed
    // counts are unreliable for parse-fail cases.
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
    // No headline in parse-fail branch.
    expect(body).not.toMatch(/📊/u);
    // No off-diff callout in parse-fail branch.
    expect(body).not.toMatch(/not posted inline/u);
    // Manifest carries parseFailed for AI agents.
    const manifest = readManifest(body);
    expect(manifest.parseFailed).toBe(true);
  });
});
