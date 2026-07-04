// Pins the new CLARITY-14 contract: the parent card shows only actionable
// information. The old "Posted / Considered / Suppressed" three-row layout
// was removed because the row counts didn't tell the reviewer anything
// they would act on — `Posted: 0` was the only number they cared about,
// and that already lives in the footer.
//
// CLARITY-19 vocabulary (this iteration):
//   - 📊 Pipeline summary: one line that reconciles total / posted /
//     off-diff / filtered counts so the reader can grok the whole pipeline
//     in one glance (replaces the loose 🔕 count semantics that confused
//     readers into thinking "5 of 10" was a different count from "5").
//   - 🏷️ Severity tally (was 📊): same per-severity counts, renamed icon
//     to free 📊 for the pipeline summary.
//   - 📋 Posted preview: `(N)` or `(showing N of M)` — explicitly says
//     "posted" so the preview cannot be confused with pre-filter model output.
//   - 🧹 Filtered preview: `(showing N of M candidates)` — no more 🔕.
//   - 📍 Off-diff details: `(N not posted)` — no more 🔕. Replaces
//     `Suppressed (off-diff, N)`. The duplicate `> 🔕 N off-diff
//     finding(s) were not on this PR's diff.` callout is dropped because
//     the 📊 pipeline summary already surfaces the same count.
//
// Each test below covers one of the four action cases:
//   - Mixed findings posted (verdict NEEDS_FIX, severity tally visible)
//   - Findings all filtered (verdict DISCUSS, severity tally hidden)
//   - Clean review (verdict SHIP, no details blocks)
//   - Off-diff note surfaces the suppressed count when inline findings exist
import { describe, expect, it } from "vitest";

import { buildReviewBody } from "../../src/cli/live-shared.js";

describe("CLARITY-14: actionable-only parent card", () => {
  it("renders a 📊 pipeline summary that reconciles total / posted / off-diff / filtered", () => {
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
    });
    // Pipeline summary reconciles every count in one line.
    // Total = 3 inline + 1 off-diff = 4 model findings; 3 posted, 1 off-diff, 0 filtered.
    expect(body).toMatch(/📊\s+4\s+findings\s+→\s+3\s+posted,\s+1\s+off-diff,\s+0\s+filtered/u);
    // Rows are gone.
    expect(body).not.toMatch(/\*\*Posted:\*\*/u);
    expect(body).not.toMatch(/\*\*Considered:\*\*/u);
    expect(body).not.toMatch(/\*\*Suppressed:\*\*/u);
    // Duplicate off-diff callout is gone.
    expect(body).not.toMatch(/🔕\s+\d+\s+off-diff\s+finding/u);
    // Footer carries the inline count.
    expect(body).toMatch(/3\s+inline/u);
    // Posted preview uses 📋, not 🔕.
    expect(body).toMatch(/📋\s+Posted preview\s+\(3\)/u);
    // Severity tally uses 🏷️, not 📊 (📊 is the pipeline summary now).
    expect(body).toMatch(/🏷️/u);
  });

  it("uses '🧹 Filtered preview' header when every model finding was filtered", () => {
    // 0 posted, 5 considered, 5 off-diff. Header must be the
    // filtered-style label so the reader doesn't mistake the preview
    // for a clean bill of health.
    const body = buildReviewBody({
      review: {
        summary: "",
        verdict: "COMMENT",
        comments: [
          { path: "dist/cli.js", line: 451, body: "Bundled output", severity: "info", category: "build" },
          { path: "dist/cli.js", line: 453, body: "Bundled output", severity: "info", category: "build" },
          { path: "dist/index.js", line: 449, body: "Bundled output", severity: "info", category: "build" },
          { path: "artifacts/manual/s4-azure-mocked-run.json", line: 5, body: "Manual fixture", severity: "info", category: "test" },
          { path: "artifacts/manual/s6-sonar-mocked-run.json", line: 26, body: "Manual fixture", severity: "info", category: "test" },
        ],
        suppressedComments: [],
      },
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 5,
      offDiffFromComments: [],
      severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
      secrets: [],
    });
    // Pipeline summary reconciles: 5 findings → 0 posted, 5 off-diff, 0 filtered.
    // (5 candidates are off-diff, none filtered, none posted.)
    expect(body).toMatch(/📊\s+5\s+findings\s+→\s+0\s+posted,\s+5\s+off-diff,\s+0\s+filtered/u);
    // Filtered preview header — no more 🔕; uses "showing" + "candidates"
    // so the (N of M) clearly means preview truncation, not a separate count.
    expect(body).toMatch(/🧹\s+Filtered preview\s+\(showing\s+\d+\s+of\s+\d+\s+candidates\)/u);
    expect(body).not.toMatch(/🔕\s+Filtered findings/u);
    expect(body).not.toMatch(/Top concerns from model/u);
    // No 🏷️ severity tally (all info; no severity buckets to count).
    expect(body).not.toMatch(/🏷️/u);
    // The verdict downgrades to DISCUSS because nothing is actionable.
    expect(body).toMatch(/💬\s+DISCUSS/u);
  });

  it("uses '📋 Posted preview' header when at least one finding landed inline", () => {
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
    });
    // Plain "📋 Posted preview (3)" — no model provenance.
    expect(body).toMatch(/📋\s+Posted preview\s+\(3\)/u);
    // Filtered-style header must NOT appear when findings landed.
    expect(body).not.toMatch(/🧹\s+Filtered preview/u);
    expect(body).not.toMatch(/🔕/u);
  });

  it("clean review (0 posted + 0 suppressed + 0 considered) is minimal", () => {
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
    // No rows, no tally, no suppressed block, no filtered/top-concerns.
    expect(body).not.toMatch(/\*\*Posted:\*\*/u);
    expect(body).not.toMatch(/\*\*Considered:\*\*/u);
    expect(body).not.toMatch(/\*\*Suppressed:\*\*/u);
    // Clean review: pipeline summary is the one zero-everywhere line.
    expect(body).toMatch(/📊\s+0\s+findings\s+→\s+0\s+posted,\s+0\s+off-diff,\s+0\s+filtered/u);
    // No severity tally (nothing to count).
    expect(body).not.toMatch(/🏷️/u);
    // No 🧹 Filtered preview, no 📋 Posted preview, no 📍 Off-diff.
    expect(body).not.toMatch(/🧹/u);
    expect(body).not.toMatch(/📋\s+Posted preview/u);
    expect(body).not.toMatch(/📍/u);
    // No duplicate off-diff callout.
    expect(body).not.toMatch(/🔕\s+\d+\s+off-diff\s+finding/u);
    expect(body).not.toMatch(/Top concerns/u);
    expect(body).not.toMatch(/Filtered findings/u);
    expect(body).not.toMatch(/Suppressed\s+\(off-diff/u);
    // Verdict + summary + footer still present.
    expect(body).toMatch(/✅\s+SHIP/u);
    expect(body).toMatch(/All clear\./u);
    expect(body).toMatch(/0\s+inline/u);
  });

  it("📋 Posted preview is sorted by severity desc (highest first)", () => {
    const body = buildReviewBody({
      review: {
        summary: "Mixed severities.",
        verdict: "NEEDS_FIX",
        comments: [
          { path: "src/low.ts", line: 1, body: "low finding", severity: "low", category: "general" },
          { path: "src/info.ts", line: 1, body: "info finding", severity: "info", category: "general" },
          { path: "src/critical.ts", line: 1, body: "critical finding", severity: "critical", category: "security" },
          { path: "src/medium.ts", line: 1, body: "medium finding", severity: "medium", category: "general" },
          { path: "src/high.ts", line: 1, body: "high finding", severity: "high", category: "security" },
        ],
        suppressedComments: [],
      },
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 5,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      // info severity is excluded from the rendered tally per CLARITY-3,
      // but it's counted in `validCommentCount` and the manifest. The
      // tally sum (4) is intentionally < inline count (5) — the
      // contract is "info findings exist" without giving them a tally
      // bucket.
      severityCounts: { critical: 1, high: 1, medium: 1, low: 1, info: 1 },
      secrets: [],
    });
    // Extract the order of paths in the Posted preview block.
    const topConcernsMatch = body.match(
      /📋\s+Posted preview\s+\(5\)[\s\S]*?<\/details>/u,
    );
    expect(topConcernsMatch).not.toBeNull();
    const topConcernsSection = topConcernsMatch?.[0] ?? "";
    const criticalIdx = topConcernsSection.indexOf("src/critical.ts");
    const highIdx = topConcernsSection.indexOf("src/high.ts");
    const mediumIdx = topConcernsSection.indexOf("src/medium.ts");
    const lowIdx = topConcernsSection.indexOf("src/low.ts");
    const infoIdx = topConcernsSection.indexOf("src/info.ts");
    expect(criticalIdx).toBeGreaterThan(-1);
    expect(criticalIdx).toBeLessThan(highIdx);
    expect(highIdx).toBeLessThan(mediumIdx);
    expect(mediumIdx).toBeLessThan(lowIdx);
    expect(lowIdx).toBeLessThan(infoIdx);
  });
});