// Pins the severity-table layout contract — the chosen layout from the
// 20-layout sheet (`src/render/summary-layouts.ts`).
//
// Cutover context: the legacy "Posted / Considered / Suppressed" three-row
// layout, the `<details>`-wrapped Posted preview, the off-diff callout,
// and the legacy preview/off-diff blocks are all gone.
//
// The findings list rendered by `buildReviewBody` is a sequence of
// `<details>` collapsible rows (mobile-friendly). The summary line on
// each row carries "N · emoji label — title" and the expanded body
// shows the full path, line number, and title. The previous GFM-table
// layout collapsed ugly at 576px viewport (Severity header wrapped to
// "Severit"/"y", # column stacked "10" vertically, File:Line broke
// mid-identifier, Title ellipsised mid-sentence); `<details>` has no
// column-width constraints so all of that disappears.
//
// Each test below pins ONE of the four action cases the legacy contract
// had, updated to the new layout:
//
//   - Mixed findings posted (verdict NEEDS_FIX, <details> rows populated)
//   - Findings all filtered (verdict DISCUSS, empty placeholder)
//   - Clean review (verdict SHIP, empty placeholder)
//   - Severity desc sort (still required for the <details> rows)

import { describe, expect, it } from "vitest";

import { buildReviewBody } from "../../src/cli/live-shared.js";
import { RESOLUTION_GUIDE_MARKER } from "../../src/util/marker.js";

describe("severity-table layout — actionable-only parent card", () => {
  it("renders <details> rows with every posted finding inline", () => {
    const body = buildReviewBody({
      review: {
        summary: "Three issues need attention before merge.",
        verdict: "NEEDS_FIX",
        comments: [
          { path: "src/auth.ts", line: 12, body: "Use bcrypt.", severity: "high", category: "security" },
          { path: "src/db.ts", line: 7, body: "Add timeout.", severity: "medium", category: "maintainability" },
          { path: "README.md", line: 42, body: "Update example.", severity: "low", category: "docs" },
        ],
        suppressedComments: [
          { path: "src/old.ts", line: 3, body: "Legacy.", severity: "low", category: "general" },
        ],
      },
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 3,
      suppressedCommentCount: 1,
      offDiffFromComments: [],
      severityCounts: { high: 1, medium: 1, low: 1 },
      secrets: [],
      postedComments: [
        { path: "src/auth.ts", line: 12, body: "Use bcrypt.", severity: "high", category: "security" },
        { path: "src/db.ts", line: 7, body: "Add timeout.", severity: "medium", category: "maintainability" },
        { path: "README.md", line: 42, body: "Update example.", severity: "low", category: "docs" },
      ],
    });
    // Every posted finding has its own <details> row.
    expect(body).toContain('<summary>1 · 🔴 High — Use bcrypt.</summary>');
    expect(body).toContain('<summary>2 · 🟠 Medium — Add timeout.</summary>');
    expect(body).toContain('<summary>3 · 🟡 Low — Update example.</summary>');
    // Expanded body shows path:line.
    expect(body).toContain("📍 `src/auth.ts`:12");
    expect(body).toContain("📍 `src/db.ts`:7");
    expect(body).toContain("📍 `README.md`:42");
    // Manifest carries the suppressed count so AI agents can reconcile.
    const manifest = body.match(/<!--\s*umactually:manifest\s+(\{[\s\S]*?\})\s*-->/u);
    expect(manifest).not.toBeNull();
    const parsed = JSON.parse(manifest?.[1] ?? "{}");
    expect(parsed.inlineCount).toBe(3);
    expect(parsed.suppressedCount).toBe(1);
    // No legacy row labels.
    expect(body).not.toMatch(/\*\*Posted:\*\*/u);
    expect(body).not.toMatch(/\*\*Considered:\*\*/u);
    expect(body).not.toMatch(/\*\*Suppressed:\*\*/u);
    // No off-diff callout (moved to manifest).
    expect(body).not.toMatch(/🔕/u);
    // Footer carries the inline count.
    expect(body).toMatch(/3\s+inline/u);
    // Severity tally uses 🏷️.
    expect(body).toMatch(/🏷️/u);
    // No GFM-table severity cells (the old wrap-regression layout).
    expect(body).not.toContain("| # | Severity |");
    expect(body).not.toContain("&nbsp;&nbsp;&nbsp;&nbsp;");
  });

  it("collapses to the ship-it line when every finding was filtered out", () => {
    // 0 posted, 0 suppressed, not parse-failed — clean-ship branch.
    const body = buildReviewBody({
      review: {
        summary: "",
        verdict: "COMMENT",
        comments: [
          { path: "dist/cli.js", line: 451, body: "Bundled output", severity: "info", category: "build" },
          { path: "dist/cli.js", line: 453, body: "Bundled output", severity: "info", category: "build" },
          { path: "dist/index.js", line: 449, body: "Bundled output", severity: "info", category: "build" },
        ],
        suppressedComments: [],
      },
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
      secrets: [],
      postedComments: [],
    });
    expect(body).toContain("## ✅ 0 inline findings — ship it");
    expect(body).not.toContain("_No findings to address._");
    // Clean review path: there is NO findings-table `<details>` block.
    // The single `<details>` block in the body is the platform-aware
    // resolution guide footer (baked in by the bake-resolution-guide
    // plan between the footer and the manifest).
    expect((body.match(/<details>/gu) ?? []).length).toBe(1);
    expect(body).toContain(RESOLUTION_GUIDE_MARKER);
    expect(body).not.toMatch(/🧹/u);
    expect(body).not.toMatch(/Filtered preview/u);
    expect(body).not.toMatch(/🔕/u);
    expect(body).not.toMatch(/🏷️/u);
    expect(body).not.toMatch(/💬\s+DISCUSS/u);
  });

  it("all-filtered model output collapses to the ship-it line", () => {
    const body = buildReviewBody({
      review: {
        summary: "",
        verdict: "NEEDS_FIX",
        comments: [
          { path: "src/noisy.ts", line: 1, body: "Style-only candidate", severity: "info", category: "style" },
        ],
        suppressedComments: [],
      },
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
      secrets: [],
      postedComments: [],
    });
    expect(body).toContain("## ✅ 0 inline findings — ship it");
    expect(body).not.toMatch(/💬\s+DISCUSS/u);
    expect(body).not.toContain("_No findings to address._");
    expect(body).not.toMatch(/📊\s+0\s+inline\s+findings/u);
    expect(body).not.toMatch(/🏷️/u);
  });

  it("every posted finding appears as its own <details> row", () => {
    const body = buildReviewBody({
      review: {
        summary: "",
        verdict: "COMMENT",
        comments: [
          { path: "src/auth.ts", line: 12, body: "Use bcrypt", severity: "high", category: "security" },
          { path: "src/auth.ts", line: 14, body: "Use bcrypt", severity: "high", category: "security" },
          { path: "src/auth.ts", line: 16, body: "Use bcrypt", severity: "high", category: "security" },
        ],
        suppressedComments: [],
      },
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 3,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      severityCounts: { high: 3 },
      secrets: [],
      postedComments: [
        { path: "src/auth.ts", line: 12, body: "Use bcrypt", severity: "high", category: "security" },
        { path: "src/auth.ts", line: 14, body: "Use bcrypt", severity: "high", category: "security" },
        { path: "src/auth.ts", line: 16, body: "Use bcrypt", severity: "high", category: "security" },
      ],
    });
    // Each finding has its own summary line numbered 1, 2, 3.
    expect(body).toContain('<summary>1 · 🔴 High — Use bcrypt</summary>');
    expect(body).toContain('<summary>2 · 🔴 High — Use bcrypt</summary>');
    expect(body).toContain('<summary>3 · 🔴 High — Use bcrypt</summary>');
    // No legacy "Posted preview" or "Filtered preview" headers.
    expect(body).not.toMatch(/📋\s+Posted preview/u);
    expect(body).not.toMatch(/🧹\s+Filtered preview/u);
    expect(body).not.toMatch(/🔕/u);
  });

  it("clean review (0 posted + 0 suppressed) collapses to the ship-it line", () => {
    const body = buildReviewBody({
      review: { summary: "", verdict: "SHIP", comments: [], suppressedComments: [] },
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
      secrets: [],
    });
    expect(body).not.toMatch(/\*\*Posted:\*\*/u);
    expect(body).not.toMatch(/\*\*Considered:\*\*/u);
    expect(body).not.toMatch(/\*\*Suppressed:\*\*/u);
    expect(body).not.toMatch(/🏷️/u);
    expect(body).not.toMatch(/🧹/u);
    expect(body).not.toMatch(/📋\s+Posted preview/u);
    expect(body).not.toMatch(/📍/u);
    expect(body).not.toMatch(/🔕/u);
    // Clean review path: there is NO findings-table `<details>` block.
    // The single `<details>` block in the body is the platform-aware
    // resolution guide footer (baked in by the bake-resolution-guide
    // plan between the footer and the manifest).
    expect((body.match(/<details>/gu) ?? []).length).toBe(1);
    expect(body).toContain(RESOLUTION_GUIDE_MARKER);
    expect(body).not.toMatch(/✅\s+SHIP/u);
    expect(body).not.toMatch(/No findings to address/u);
    expect(body).toContain("## ✅ 0 inline findings — ship it");
  });

  it("findings list is sorted by severity desc (highest first)", () => {
    const body = buildReviewBody({
      review: {
        summary: "Mixed severities.",
        verdict: "NEEDS_FIX",
        comments: [
          { path: "src/low.ts", line: 1, body: "low finding", severity: "low", category: "general" },
          { path: "src/critical.ts", line: 1, body: "critical finding", severity: "critical", category: "security" },
          { path: "src/medium.ts", line: 1, body: "medium finding", severity: "medium", category: "general" },
          { path: "src/high.ts", line: 1, body: "high finding", severity: "high", category: "security" },
        ],
        suppressedComments: [],
      },
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 4,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      severityCounts: { critical: 1, high: 1, medium: 1, low: 1 },
      secrets: [],
      postedComments: [
        { path: "src/low.ts", line: 1, body: "low finding", severity: "low", category: "general" },
        { path: "src/critical.ts", line: 1, body: "critical finding", severity: "critical", category: "security" },
        { path: "src/medium.ts", line: 1, body: "medium finding", severity: "medium", category: "general" },
        { path: "src/high.ts", line: 1, body: "high finding", severity: "high", category: "security" },
      ],
    });
    // Severity-descent sort: critical before high before medium before low.
    const criticalIdx = body.indexOf("src/critical.ts");
    const highIdx = body.indexOf("src/high.ts");
    const mediumIdx = body.indexOf("src/medium.ts");
    const lowIdx = body.indexOf("src/low.ts");
    expect(criticalIdx).toBeGreaterThan(-1);
    expect(criticalIdx).toBeLessThan(highIdx);
    expect(highIdx).toBeLessThan(mediumIdx);
    expect(mediumIdx).toBeLessThan(lowIdx);
  });
});