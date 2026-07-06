// Pins the severity-table layout contract — the chosen layout from the
// 20-layout sheet (`src/render/summary-layouts.ts`).
//
// Cutover context: the legacy "Posted / Considered / Suppressed" three-row
// layout, the `<details>`-wrapped Posted preview, the off-diff callout,
// and the legacy preview/off-diff blocks are all gone. The new layout
// surfaces every posted finding inline in a GFM table, while the pipeline
// summary line keeps posted/off-diff/filtered reconciliation visible.
//
// Each test below pins ONE of the four action cases the legacy contract
// had, updated to the new layout:
//
//   - Mixed findings posted (verdict NEEDS_FIX, findings table populated)
//   - Findings all filtered (verdict DISCUSS, empty findings table)
//   - Clean review (verdict SHIP, table with `_No findings to address_`)
//   - Severity desc sort (still required for the table)

import { describe, expect, it } from "vitest";

import { buildReviewBody } from "../../src/cli/live-shared.js";

describe("severity-table layout — actionable-only parent card", () => {
  it("renders a findings table with every posted finding inline", () => {
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
    // Findings table is present and contains every posted finding inline.
    expect(body).toMatch(/\| # \| Severity \| Category \| File:Line \| Title \|/u);
    expect(body).toContain("`src/auth.ts`:12");
    expect(body).toContain("`src/db.ts`:7");
    expect(body).toContain("`README.md`:42");
    // Manifest carries the suppressed count so AI agents can reconcile.
    const manifest = body.match(/<!--\s*umactually-pr-review:manifest\s+(\{[\s\S]*?\})\s*-->/u);
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
    // No `<details>` blocks.
    expect(body).not.toContain("<details>");
  });

  it("renders an empty findings table when every finding was filtered out", () => {
    // 0 posted, 0 off-diff. The findings table shows the empty placeholder.
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
    // Findings table is present with the empty placeholder row.
    expect(body).toMatch(/\| # \| Severity \| Category \| File:Line \| Title \|/u);
    expect(body).toMatch(/No findings to address/u);
    // No legacy "Filtered preview" header.
    expect(body).not.toMatch(/🧹/u);
    expect(body).not.toMatch(/Filtered preview/u);
    expect(body).not.toMatch(/🔕/u);
    // No severity tally (nothing in the four severity buckets).
    expect(body).not.toMatch(/🏷️/u);
    // Verdict downgrades to DISCUSS.
    expect(body).toMatch(/💬\s+DISCUSS/u);
  });

  it("all-filtered model output renders a meaningful empty state", () => {
    const body = buildReviewBody({
      review: {
        summary: "The model produced candidates, but policy filtered all of them.",
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

    expect(body).toMatch(/💬\s+DISCUSS/u);
    expect(body).toMatch(/\| — \| — \| — \| — \| _No findings to address_ \|/u);
    // Headline leads with the posted count (0). The model produced
    // 1 finding but it was filtered (severity/minor policy) so 0
    // made it to the postable set. The reader sees "0 inline
    // findings" — they don't have to subtract.
    expect(body).toMatch(/📊\s+0\s+inline\s+findings/u);
    expect(body).not.toMatch(/🏷️/u);
  });

  it("every posted finding appears as a row in the table", () => {
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
    // Every row appears as its own line in the table.
    for (let i = 1; i <= 3; i += 1) {
      expect(body).toMatch(new RegExp(`\\|\\s+${i}\\s+\\|`, "u"));
    }
    // No legacy "Posted preview" or "Filtered preview" headers.
    expect(body).not.toMatch(/📋\s+Posted preview/u);
    expect(body).not.toMatch(/🧹\s+Filtered preview/u);
    expect(body).not.toMatch(/🔕/u);
  });

  it("clean review (0 posted + 0 suppressed) shows verdict + empty table + summary + footer", () => {
    const body = buildReviewBody({
      review: { summary: "All clear.", verdict: "SHIP", comments: [], suppressedComments: [] },
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
      secrets: [],
    });
    // No row labels, no tally, no legacy details blocks.
    expect(body).not.toMatch(/\*\*Posted:\*\*/u);
    expect(body).not.toMatch(/\*\*Considered:\*\*/u);
    expect(body).not.toMatch(/\*\*Suppressed:\*\*/u);
    // No severity tally when zero findings.
    expect(body).not.toMatch(/🏷️/u);
    // No 🧹 / 📋 / 📍 / 🔕 anywhere.
    expect(body).not.toMatch(/🧹/u);
    expect(body).not.toMatch(/📋\s+Posted preview/u);
    expect(body).not.toMatch(/📍/u);
    expect(body).not.toMatch(/🔕/u);
    // No <details> wrappers.
    expect(body).not.toContain("<details>");
    // Verdict + summary + footer still present.
    expect(body).toMatch(/✅\s+SHIP/u);
    expect(body).toMatch(/All clear\./u);
    expect(body).toMatch(/0\s+inline/u);
    // Empty findings table placeholder is rendered.
    expect(body).toMatch(/No findings to address/u);
  });

  it("findings table is sorted by severity desc (highest first)", () => {
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