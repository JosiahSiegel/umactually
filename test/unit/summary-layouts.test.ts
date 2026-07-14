// Smoke + invariant tests for the 20 review summary layouts.
//
// Scenario contract (see ulw-notepad):
//   S1: Module exports 20 distinct layout IDs (smoke test).
//   S2: All 20 layouts render without throwing given sample data.
//   S3: All 20 layouts include the stable review marker (see src/util/marker.ts).
//   S4: All 20 layouts include the manifest JSON.
//   S5: No layout uses <details>/<summary> (Azure-incompatible).
//   S6: No layout uses raw <table> HTML (Azure-incompatible).
//
// The "current" baseline is a SEPARATE identifier (BaselineId) and is
// pinned to byte-identical parity with the existing buildReviewBody
// output for the cases it covers (see live-shared-body.test.ts).

import { describe, expect, it } from "vitest";

import {
  BASELINE,
  LAYOUTS,
  LAYOUT_LABELS,
  renderBaseline,
  renderSummary,
  type LayoutId,
  type ReviewData,
} from "../../src/render/summary-layouts.js";
import { REVIEW_MARKER, MANIFEST_SCHEMA } from "../../src/util/marker.js";

function makeData(overrides: Partial<ReviewData> = {}): ReviewData {
  return {
    review: {
      summary: "Reviewed the auth refactor. Two blockers found.",
      verdict: "NEEDS_FIX",
      comments: [],
      suppressedComments: [],
      ...(overrides.review ?? {}),
    } as ReviewData["review"],
    provider: "openai-compatible",
    modelId: "claude-opus-4-5",
    validCommentCount: 0,
    suppressedCommentCount: 0,
    severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
    offDiffFromComments: [],
    postedComments: [],
    secrets: [],
    ...overrides,
  };
}

function makeBusyData(): ReviewData {
  return makeData({
    review: {
      summary: "Reviewed the auth refactor. Two blockers found.",
      verdict: "NEEDS_FIX",
      comments: [
        {
          path: "src/auth.ts",
          line: 34,
          body: "Hardcoded secret.",
          severity: "critical",
          category: "security",
        },
        {
          path: "src/db.ts",
          line: 88,
          body: "Connection leak.",
          severity: "critical",
          category: "bug",
        },
        {
          path: "src/api.ts",
          line: 201,
          body: "Unhandled rejection.",
          severity: "high",
          category: "reliability",
        },
        {
          path: "src/util.ts",
          line: 14,
          body: "Cyclomatic complexity 18.",
          severity: "medium",
          category: "maintainability",
        },
        {
          path: "src/index.ts",
          line: 5,
          body: "Missing JSDoc.",
          severity: "low",
          category: "style",
        },
        {
          path: "README.md",
          line: 1,
          body: "Trailing whitespace.",
          severity: "low",
          category: "style",
        },
      ],
      suppressedComments: [
        {
          path: "src/legacy/sessions.ts",
          line: 142,
          body: "Outdated comment. (off-diff)",
          severity: "low",
          category: "style",
        },
      ],
    },
    validCommentCount: 6,
    suppressedCommentCount: 1,
    severityCounts: { critical: 2, high: 1, medium: 1, low: 2 },
    postedComments: [
      {
        path: "src/auth.ts",
        line: 34,
        body: "Hardcoded secret.",
        severity: "critical",
        category: "security",
      },
      {
        path: "src/db.ts",
        line: 88,
        body: "Connection leak.",
        severity: "critical",
        category: "bug",
      },
      {
        path: "src/api.ts",
        line: 201,
        body: "Unhandled rejection.",
        severity: "high",
        category: "reliability",
      },
      {
        path: "src/util.ts",
        line: 14,
        body: "Cyclomatic complexity 18.",
        severity: "medium",
        category: "maintainability",
      },
      {
        path: "src/index.ts",
        line: 5,
        body: "Missing JSDoc.",
        severity: "low",
        category: "style",
      },
      {
        path: "README.md",
        line: 1,
        body: "Trailing whitespace.",
        severity: "low",
        category: "style",
      },
    ],
  });
}

function makeCleanData(): ReviewData {
  return makeData({
    review: {
      summary: "Clean review — nothing to address.",
      verdict: "APPROVED",
      comments: [],
      suppressedComments: [],
    },
  });
}

function makeParseFailedData(): ReviewData {
  return makeData({
    review: {
      summary:
        "Provider response did not contain a valid JSON review payload.\n\n<details>\n<summary>📨 Raw provider response (truncated)</summary>\n\n```text\n[truncated]\n```\n\n</details>",
      verdict: "COMMENT",
      comments: [],
      suppressedComments: [],
      parseFailed: true,
    },
  });
}

// -- S1: 20 distinct layouts ----------------------------------------------

describe("S1 — module exports 20 distinct layout IDs", () => {
  it("LAYOUTS has exactly 20 entries", () => {
    expect(LAYOUTS.length).toBe(20);
  });

  it("LAYOUTS entries are unique", () => {
    const unique = new Set(LAYOUTS);
    expect(unique.size).toBe(LAYOUTS.length);
  });

  it("LAYOUTS is non-empty and contains real layout IDs", () => {
    expect(LAYOUTS.length).toBeGreaterThan(0);
    for (const id of LAYOUTS) {
      expect(id.length).toBeGreaterThan(0);
    }
  });

  it("LAYOUT_LABELS covers every layout in LAYOUTS", () => {
    for (const id of LAYOUTS) {
      expect(LAYOUT_LABELS[id]).toBeDefined();
      expect(LAYOUT_LABELS[id].length).toBeGreaterThan(0);
    }
  });

  it("BASELINE identifier exists and is distinct from any LayoutId", () => {
    expect(BASELINE).toBe("current");
  });
});

// -- S2: All layouts render without throwing -------------------------------

describe("S2 — all layouts render without throwing", () => {
  for (const layout of LAYOUTS) {
    it(`${layout} renders on busy data`, () => {
      const out = renderSummary(layout, makeBusyData());
      expect(typeof out).toBe("string");
      expect(out.length).toBeGreaterThan(0);
    });

    it(`${layout} renders on clean data`, () => {
      const out = renderSummary(layout, makeCleanData());
      expect(typeof out).toBe("string");
      expect(out.length).toBeGreaterThan(0);
    });

    it(`${layout} renders on parse-failed data`, () => {
      const out = renderSummary(layout, makeParseFailedData());
      expect(typeof out).toBe("string");
      expect(out.length).toBeGreaterThan(0);
    });
  }

  it("renderSummary throws on unknown layout", () => {
    const invalidLayout: LayoutId = JSON.parse('"nope"');
    expect(() => renderSummary(invalidLayout, makeBusyData())).toThrow();
  });

  it("renderBaseline renders the 'current' baseline", () => {
    const out = renderBaseline(BASELINE, makeBusyData());
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });

  it("renderBaseline throws a descriptive error when postedComments is omitted", () => {
    // The guard mirrors renderSummary's: callers who construct
    // ReviewData manually (not via buildReviewBody) get a clear error
    // pointing at the right entry point rather than a confusing crash
    // deep inside a layout helper. Pin the contract so the next
    // refactor that breaks the guard surfaces as a test failure.
    const dataWithoutPostedComments = {
      ...makeBusyData(),
      postedComments: undefined as unknown as typeof makeBusyData extends { postedComments: infer T } ? T : never,
    };
    expect(() => renderBaseline(BASELINE, dataWithoutPostedComments)).toThrow(
      /postedComments is required/u,
    );
  });
});

// -- S3: Stable marker present in every layout -----------------------------

describe("S3 — every layout includes the stable marker", () => {
  for (const layout of LAYOUTS) {
    it(`${layout} includes the REVIEW_MARKER`, () => {
      const out = renderSummary(layout, makeBusyData());
      expect(out).toContain(REVIEW_MARKER);
    });
  }
});

// -- S4: Manifest present in every layout ----------------------------------

describe("S4 — every layout includes the hidden manifest", () => {
  for (const layout of LAYOUTS) {
    it(`${layout} embeds the umactually:manifest comment`, () => {
      const out = renderSummary(layout, makeBusyData());
      expect(out).toContain("<!-- umactually:manifest ");
      expect(out).toContain(MANIFEST_SCHEMA);
    });

    it(`${layout} manifest contains the required fields`, () => {
      const out = renderSummary(layout, makeBusyData());
      const match = /<!-- umactually:manifest (.+?) -->/u.exec(out);
      expect(match).not.toBeNull();
      const parsed = JSON.parse(match![1]!);
      expect(parsed["schema"]).toBe(MANIFEST_SCHEMA);
      expect(parsed["verdict"]).toBe("NEEDS_FIX");
      expect(parsed["provider"]).toBe("openai-compatible");
      expect(parsed["modelId"]).toBe("claude-opus-4-5");
      expect(parsed["inlineCount"]).toBe(6);
      expect(parsed["suppressedCount"]).toBe(1);
      expect(parsed["severityCounts"]).toEqual({ critical: 2, high: 1, medium: 1, low: 2 });
    });
  }
});

// -- S5: <details>/<summary> policy ----------------------------------------
// Cross-platform rule: avoid <details>/<summary> by default because
// Azure DevOps PR comments render them as raw text. EXCEPTION: when the
// summary is verbose (>500 chars), wrap it in <details> with a click-
// to-expand summary. GitHub renders the collapsible correctly; Azure
// DevOps shows the raw HTML (uglier but still readable) — a trade-off
// worth taking for long reviews that would otherwise dominate the PR
// conversation thread.
//
// Each layout MUST be tested in BOTH regimes:
//   - S5a: short summary → no <details>/<summary> tags
//   - S5b: long summary → wraps content in <details>/<summary> tags
//
// (The existing test fixture `makeBusyData()` uses a short summary,
// so the S5a tests use that fixture and the S5b tests use a new
// `makeVerboseData()` helper.)

describe("S5a — short summary section is NOT wrapped in <details>/<summary> tags (Azure-incompatible default)", () => {
  // The S5 contract is about the SUMMARY section: Azure DevOps's
  // markdown renderer leaks raw `<details>`/`<summary>` HTML instead of
  // rendering them as collapsible widgets, so the summary must stay
  // inline when short. Findings, by contrast, are a separate concern
  // (the `<details>` per finding is intentional — see findingsDetailsRow
  // docstring).
  //
  // Scope the assertion to the section between `### 📝 Summary` and
  // the next `###` heading (or the horizontal rule before the footer).
  function summarySection(out: string): string {
    const start = out.indexOf("### 📝 Summary");
    if (start < 0) return "";
    const afterStart = out.slice(start + "### 📝 Summary".length);
    // Stop at the next horizontal rule (---) or next heading (###).
    const stopCandidates = [
      afterStart.indexOf("\n---\n"),
      afterStart.indexOf("\n### "),
    ].filter((n) => n >= 0);
    const stop = stopCandidates.length > 0 ? Math.min(...stopCandidates) : afterStart.length;
    return afterStart.slice(0, stop);
  }

  for (const layout of LAYOUTS) {
    it(`${layout} summary section has no <details> tag for short summary`, () => {
      const out = renderSummary(layout, makeBusyData());
      const summary = summarySection(out);
      expect(summary).not.toContain("<details>");
      expect(summary).not.toContain("</details>");
    });

    it(`${layout} summary section has no <summary> tag for short summary`, () => {
      const out = renderSummary(layout, makeBusyData());
      const summary = summarySection(out);
      expect(summary).not.toContain("<summary>");
      expect(summary).not.toContain("</summary>");
    });
  }
});

describe("S5b — verbose summary (>500 chars) is wrapped in <details> for collapsibility", () => {
  // Helper: a review with a 1.5K-char summary mimicking the production
  // self-review on PR #9 where the model emits `Key correctness
  // concerns I spotted: ... I cannot approve without addressing: ...`
  // sections that are too long to be inline.
  function makeVerboseData(): Parameters<typeof renderSummary>[1] {
    const verboseSummary = [
      "Reviewed the PR. This PR refactors `buildReviewBody` to delegate to a new `severity-table` layout in `src/render/summary-layouts.ts`, adds 20 alternative layouts + viewer scripts, fixes SSE JSON extraction by escaping literal control chars, and rewrites several existing clarity tests to match the new output shape.",
      "",
      "Key correctness concerns I spotted:",
      "",
      ...Array.from({ length: 10 }, (_, i) => `${i + 1}. **Concern ${i + 1}**: This is a detailed explanation of a correctness issue found in the diff that requires the author's attention before merge.`),
      "",
      "I cannot approve this without addressing:",
      "",
      ...Array.from({ length: 3 }, (_, i) => `- The committed artifact concern number ${i + 1}.`),
    ].join("\n");
    return {
      review: {
        summary: verboseSummary,
        verdict: "NEEDS_FIX",
        comments: [
          { path: "src/test.ts", line: 1, body: "Test concern", severity: "high", category: "general" },
        ],
        suppressedComments: [],
      },
      provider: "github",
      modelId: "auto",
      validCommentCount: 1,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      postedComments: [
        { path: "src/test.ts", line: 1, body: "Test concern", severity: "high", category: "general" },
      ],
      severityCounts: { high: 1, medium: 0, low: 0 },
      secrets: [],
    };
  }

  it("severity-table wraps verbose summary in a <details> block", () => {
    const out = renderSummary("severity-table", makeVerboseData());
    // Must have a <details>...</details> wrapping the summary
    expect(out).toContain("<details>");
    expect(out).toContain("</details>");
    // And a <summary> with the click-to-expand label
    expect(out).toMatch(/<summary>[\s\S]*?<\/summary>/u);
  });

  it("verbose summary's <details> contains the model output (no truncation)", () => {
    const data = makeVerboseData();
    const out = renderSummary("severity-table", data);
    // The summary text MUST appear inside the details block — we
    // should NOT silently truncate just because we wrapped it.
    expect(out).toContain("Key correctness concerns I spotted:");
    expect(out).toContain("I cannot approve this without addressing:");
    expect(out).toContain("Concern 10");
  });

  it("verbose summary <details> body is correctly closed before the next section", () => {
    const out = renderSummary("severity-table", makeVerboseData());
    // The </details> must appear BEFORE the horizontal rule (---)
    // that separates Summary from the Footer.
    const detailsClose = out.indexOf("</details>");
    const hr = out.indexOf("\n---\n");
    expect(detailsClose).toBeGreaterThan(0);
    expect(hr).toBeGreaterThan(detailsClose);
  });

  it("verbose summary length fits inside the body well below 65,536 chars", () => {
    const out = renderSummary("severity-table", makeVerboseData());
    // Wrapping in <details> shouldn't bloat the body past GitHub's limit
    expect(out.length).toBeLessThan(65_536);
  });
});

// -- S6: No raw <table> HTML -----------------------------------------------

describe("S6 — no layout uses raw <table> HTML (Azure-incompatible)", () => {
  for (const layout of LAYOUTS) {
    it(`${layout} has no <table>/<tr>/<td> tags`, () => {
      const out = renderSummary(layout, makeBusyData());
      expect(out).not.toMatch(/<table[\s>]/iu);
      expect(out).not.toContain("<tr>");
      expect(out).not.toContain("<td");
    });
  }
});

// -- S7: Baseline byte-identical to the existing buildReviewBody ----------
//
// We don't import the existing buildReviewBody here because that would
// pull in the live-shared.ts module's full dependency graph (cli's
// parse-args, etc.) and complicate the smoke test. Instead we pin a few
// high-value invariants of the baseline that downstream consumers rely
// on: marker present, manifest present, verdict+severity tally present.

describe("S7 — baseline layout reproduces existing summary invariants", () => {
  it("baseline includes the REVIEW_MARKER", () => {
    const out = renderBaseline(BASELINE, makeBusyData());
    expect(out).toContain(REVIEW_MARKER);
  });

  it("baseline includes the manifest", () => {
    const out = renderBaseline(BASELINE, makeBusyData());
    expect(out).toContain("<!-- umactually:manifest ");
  });

  it("baseline includes the pipeline summary line", () => {
    // Headline leads with the posted count (6) — the reader's question
    // is "how many findings will appear inline on this PR?", not "how
    // many did the model produce?". The model's gross output (7) is
    // surfaced separately as the off-diff callout, not jammed into
    // the headline number. See pipelineLine() doc for the rationale.
    const out = renderBaseline(BASELINE, makeBusyData());
    expect(out).toContain("📊 6 inline findings");
  });

  it("baseline includes the severity tally", () => {
    const out = renderBaseline(BASELINE, makeBusyData());
    expect(out).toContain("🏷️ `2` critical · `1` high · `1` medium · `2` low");
  });

  it("baseline uses NEEDS_FIX verdict for the busy sample", () => {
    const out = renderBaseline(BASELINE, makeBusyData());
    expect(out).toContain("⛔ NEEDS_FIX");
  });

  it("baseline uses SHIP verdict for the clean sample", () => {
    const out = renderBaseline(BASELINE, makeCleanData());
    expect(out).toContain("✅ SHIP");
  });

  it("baseline shows the parse-failed banner when parseFailed is true", () => {
    const out = renderBaseline(BASELINE, makeParseFailedData());
    expect(out).toContain("> ⚠️ `Parse failed`");
  });
});

// -- Additional cross-cutting invariants -----------------------------------

describe("severity-table details", () => {
  it("falls back to general when a runtime comment omits category", () => {
    const data: ReviewData = JSON.parse(JSON.stringify({
      review: {
        summary: "Category fallback.",
        verdict: "NEEDS_FIX",
        comments: [
          { path: "src/no-category.ts", line: 3, body: "Missing category.", severity: "medium" },
        ],
        suppressedComments: [],
      },
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 1,
      suppressedCommentCount: 0,
      severityCounts: { critical: 0, high: 0, medium: 1, low: 0 },
      offDiffFromComments: [],
      postedComments: [
        { path: "src/no-category.ts", line: 3, body: "Missing category.", severity: "medium" },
      ],
      secrets: [],
    }));

    const out = renderSummary("severity-table", data);
    // severity-table renders each finding as a <details> collapsible
    // block. The summary line carries "N · emoji label — truncated
    // title" and the expanded body carries the full path + line +
    // title. No GFM table is emitted at all (the 4-col table caused
    // mid-word wrap at 576px viewport — see findingsDetailsRow
    // docstring + history).
    expect(out).toContain(
      '<summary>1 · 🟠 Medium — Missing category.</summary>',
    );
    expect(out).toContain('📍 `src/no-category.ts`:3');
    expect(out).toContain('> Missing category.');
    // And: no GFM table header for severity findings.
    expect(out).not.toContain("| # | Severity |");
  });

  // Pin the cross-platform severity rendering. Each known severity emits
  // a distinct colored-circle Unicode emoji. GitHub renders with color;
  // Azure DevOps falls back to outline `⚪` (a known cross-platform
  // limitation — the glyph shape is still distinct, so reviewers can
  // still differentiate by shape). The plain-○ fallback for unknown
  // severities doesn't visually claim a real severity rank.
  it("severityEmoji emits a distinct Unicode glyph per known severity", () => {
    // Mirror the function under test (kept in sync — see summary-layouts.ts).
    const cases: ReadonlyArray<{ readonly severity: string; readonly glyph: string }> = [
      { severity: "critical", glyph: "🟣" },
      { severity: "high",     glyph: "🔴" },
      { severity: "medium",   glyph: "🟠" },
      { severity: "low",      glyph: "🟡" },
      { severity: "info",     glyph: "🟡" },
    ];
    for (const c of cases) {
      const data = makeData({
        postedComments: [
          { path: "src/x.ts", line: 1, body: "x", severity: c.severity, category: "general" },
        ],
      });
      const out = renderSummary("severity-table", data);
      expect(out).toContain(c.glyph);
    }
  });

  it("severityEmoji emits plain-⚪ fallback for unknown severities", () => {
    // Unknown severities don't match any bucket in severity-table, so use
    // a layout that renders every comment inline (verdict-banner).
    const data = makeData({
      postedComments: [
        { path: "src/x.ts", line: 1, body: "x", severity: "unknown", category: "general" },
      ],
    });
    const out = renderSummary("verdict-banner", data);
    expect(out).toContain("⚪");
  });

  it("findings render as <details> collapsible rows (mobile-friendly)", () => {
    // History (see findingsDetailsRow docstring for full detail):
    //   The previous GFM-table layouts (severity-table + dashboard's
    //   "🔝 Top findings") rendered as 4-col tables with Severity
    //   cells containing `🟠&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`
    //   (emoji + 10 nbsp's). At 576px viewport the table looked
    //   ugly because every column was auto-sized to fit the widest
    //   cell content:
    //     - `#` column: 38px → "10" wrapped to two lines vertically
    //     - `Severity` column: 63px → header fit but cells showed
    //       a wide blank gap (the 10 nbsp's rendered as 10 spaces)
    //     - `File:Line` column: 142px → paths wrapped mid-identifier
    //       (`src/render/summa` / `ry-` / `layouts.ts :287`)
    //     - `Title` column: 252px → ellipsised mid-sentence on every
    //       row ("the first one sta…", "+ Provi…", etc.)
    //   Six markdown tricks were tried to fix the cell content
    //   (emoji only, emoji + label, span nowrap, em-space padding,
    //    4-nbsp, 10-nbsp) — all failed because GitHub's GFM table
    //   renderer doesn't expose column-width controls and uses
    //   `word-wrap: anywhere` which character-breaks any token that
    //   overflows by even 1px.
    //
    // The fix that actually works: replace the GFM table with a
    // list of `<details>` collapsible rows. `<details>` has no
    // column-width constraint, so:
    //   - the summary line always renders on one line
    //   - the full title, path, and line render inside the expanded
    //     body with no truncation
    //   - severity emoji + label render together with no wrap
    //   - mobile users see a scannable list; desktop users click to
    //     expand
    //
    // Pinned byte contract for severity-table + dashboard (both
    // layouts use findingsDetailsRow):
    const data = makeData({
      postedComments: [
        { path: "src/x.ts", line: 1, body: "x", severity: "medium", category: "general" },
        { path: "src/y.ts", line: 2, body: "y", severity: "critical", category: "general" },
      ],
    });
    // severity-table is the default layout. Rows are sorted by
    // severity bucket (highest rank first), so critical is row 1,
    // medium is row 2.
    const severityOut = renderSummary("severity-table", data);
    expect(severityOut).toContain(
      "<summary>1 · 🟣 Critical — y</summary>",
    );
    expect(severityOut).toContain(
      "<summary>2 · 🟠 Medium — x</summary>",
    );
    expect(severityOut).toContain("📍 `src/y.ts`:2");
    expect(severityOut).toContain("📍 `src/x.ts`:1");
    // And: NO GFM table at all — the previous 4-col layout caused
    // mid-word wrap at every mobile viewport.
    expect(severityOut).not.toContain("| # | Severity |");
    expect(severityOut).not.toContain("| ---: | :--- | :--- | :--- |");
    expect(severityOut).not.toContain("&nbsp;&nbsp;&nbsp;&nbsp;");
    // dashboard also has a "🔝 Top findings" block that uses the
    // same <details> shape.
    const dashboardOut = renderSummary("dashboard", data);
    expect(dashboardOut).toContain(
      "<summary>1 · 🟣 Critical — y</summary>",
    );
    expect(dashboardOut).toContain(
      "<summary>2 · 🟠 Medium — x</summary>",
    );
    expect(dashboardOut).not.toContain("| # | Severity |");
    expect(dashboardOut).not.toContain("&nbsp;&nbsp;&nbsp;&nbsp;");
  });

  // CLARITY-19a (retired): the off-diff callout used to explain why the
  // table has fewer rows than the model's gross output. Removed —
  // reviewers don't action off-diff findings (they target files
  // outside this PR's diff) and the "Off-diff: N" KPI tile in the
  // dashboard already exposes the count without noise. The headline
  // still leads with the posted count; off-diff counts are surfaced
  // only via the manifest and the dashboard KPI tile.
  it("does NOT emit an off-diff callout when offDiffCount > 0 (CLARITY-19a retired)", () => {
    // 3 model findings: 1 in-diff (posted) + 2 off-diff. The headline
    // shows "1 inline finding" (the posted one). The off-diff count is
    // surfaced only via the dashboard KPI tile + the manifest.
    const data: ReviewData = makeData({
      review: {
        summary: "Off-diff heavy.",
        verdict: "NEEDS_FIX",
        comments: [
          { path: "src/a.ts", line: 1, body: "In-line.", severity: "high", category: "bug" },
          { path: "src/legacy/x.ts", line: 10, body: "Off-diff #1.", severity: "low", category: "style" },
        ],
        suppressedComments: [
          { path: "src/legacy/y.ts", line: 20, body: "Off-diff #2.", severity: "low", category: "style" },
        ],
      },
      validCommentCount: 1,
      suppressedCommentCount: 1,
      severityCounts: { critical: 0, high: 1, medium: 0, low: 0 },
      offDiffFromComments: [
        { path: "src/legacy/x.ts", line: 10, body: "Off-diff #1.", severity: "low", category: "style" },
      ],
      postedComments: [
        { path: "src/a.ts", line: 1, body: "In-line.", severity: "high", category: "bug" },
      ],
    });

    const out = renderSummary("severity-table", data);
    // Headline still leads with the posted count.
    expect(out).toContain("📊 1 inline finding");
    // CLARITY-19a retired: no off-diff callout in the body.
    expect(out).not.toMatch(/not posted inline/u);
    expect(out).not.toMatch(/🔍/u);
  });

  it("does NOT emit an off-diff callout when offDiffCount === 0", () => {
    // All model findings became in-line comments. The headline
    // already answers the reader's question — no callout needed.
    const data: ReviewData = makeData({
      review: {
        summary: "All in-line.",
        verdict: "NEEDS_FIX",
        comments: [
          { path: "src/a.ts", line: 1, body: "In-line.", severity: "high", category: "bug" },
        ],
        suppressedComments: [],
      },
      validCommentCount: 1,
      suppressedCommentCount: 0,
      severityCounts: { critical: 0, high: 1, medium: 0, low: 0 },
      offDiffFromComments: [],
      postedComments: [
        { path: "src/a.ts", line: 1, body: "In-line.", severity: "high", category: "bug" },
      ],
    });

    const out = renderSummary("severity-table", data);
    expect(out).toContain("📊 1 inline finding");
    expect(out).not.toContain("not posted inline");
  });

  it("does NOT emit a reconciliation line in the parse-failed branch", () => {
    // CLARITY-19 invariant: when the provider response couldn't be
    // parsed, ALL counts are unreliable. The new annotation would be
    // a lie. Verify the ⚠️ banner branch suppresses it.
    const data: ReviewData = makeData({
      review: {
        summary: "Raw provider text in summary.",
        verdict: "COMMENT",
        parseFailed: true,
        comments: [],
        suppressedComments: [],
      },
      validCommentCount: 0,
      suppressedCommentCount: 0,
      severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
      offDiffFromComments: [],
      postedComments: [],
    });

    const out = renderSummary("severity-table", data);
    // ⚠️ banner present, no 📊 headline, no off-diff callout.
    expect(out).toContain("> ⚠️ `Parse failed`");
    expect(out).not.toMatch(/📊/u);
    expect(out).not.toMatch(/not posted inline/u);
  });

  // New headline format: leads with postedComments.length (not the
  // model's gross output). The reader's question is "how many findings
  // will appear inline on this PR?" — and the answer is the posted
  // count, full stop.
  it("headline reads 'N inline findings' (singular when N === 1)", () => {
    const data: ReviewData = makeData({
      review: {
        summary: "One finding.",
        verdict: "NEEDS_FIX",
        comments: [{ path: "src/a.ts", line: 1, body: "x", severity: "high", category: "bug" }],
        suppressedComments: [],
      },
      validCommentCount: 1,
      suppressedCommentCount: 0,
      severityCounts: { critical: 0, high: 1, medium: 0, low: 0 },
      offDiffFromComments: [],
      postedComments: [{ path: "src/a.ts", line: 1, body: "x", severity: "high", category: "bug" }],
    });
    const out = renderSummary("severity-table", data);
    // Singular form (no trailing "s").
    expect(out).toContain("📊 1 inline finding");
    expect(out).not.toContain("📊 1 inline findings");
  });

  it("headline reads 'N inline findings' (plural when N > 1) and equals postedComments.length not validCommentCount", () => {
    // The model produced 4 comments but the runtime only posted 2
    // (2 were filtered by severity policy). The headline must read
    // "2 inline findings" — the posted count, not the model gross
    // output, not the caller-supplied validCommentCount which the
    // renderer does not directly consult.
    const data: ReviewData = makeData({
      review: {
        summary: "Some filtered.",
        verdict: "NEEDS_FIX",
        comments: [
          { path: "src/a.ts", line: 1, body: "x", severity: "high", category: "bug" },
          { path: "src/b.ts", line: 1, body: "y", severity: "medium", category: "bug" },
        ],
        suppressedComments: [],
      },
      validCommentCount: 2,
      suppressedCommentCount: 0,
      severityCounts: { critical: 0, high: 1, medium: 1, low: 0 },
      offDiffFromComments: [],
      postedComments: [
        { path: "src/a.ts", line: 1, body: "x", severity: "high", category: "bug" },
        { path: "src/b.ts", line: 1, body: "y", severity: "medium", category: "bug" },
      ],
    });
    const out = renderSummary("severity-table", data);
    expect(out).toContain("📊 2 inline findings");
  });

  it("headline reads '0 inline findings' when postedComments is empty, even if model produced findings", () => {
    // The caller says 0 posted (all filtered). The headline must
    // read "0 inline findings" — the user's question is "how many
    // will I see on this PR?" and the answer is 0.
    const data: ReviewData = makeData({
      review: {
        summary: "All filtered.",
        verdict: "COMMENT",
        comments: [
          { path: "dist/cli.js", line: 1, body: "Bundled", severity: "info", category: "build" },
          { path: "dist/cli.js", line: 2, body: "Bundled", severity: "info", category: "build" },
        ],
        suppressedComments: [],
      },
      validCommentCount: 0,
      suppressedCommentCount: 0,
      severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
      offDiffFromComments: [],
      // postedComments: [] — explicitly empty (not the review.comments
      // fallback) so the headline reads 0, not 2.
      postedComments: [],
    });
    const out = renderSummary("severity-table", data);
    expect(out).toContain("📊 0 inline findings");
    // No off-diff callout when offDiffCount === 0.
    expect(out).not.toMatch(/not posted inline/u);
  });
});

describe("cross-cutting invariants — all layouts", () => {
  for (const layout of LAYOUTS) {
    it(`${layout} stays under GitHub's 65,536-char body limit on busy data`, () => {
      const out = renderSummary(layout, makeBusyData());
      expect(out.length).toBeLessThanOrEqual(65_536);
    });
  }

  // The terminal layout only emits path:line metadata (no body content)
  // so it is exempt from the body-content redaction invariant. Every
  // other layout embeds c.body somewhere and must therefore redact.
  const BODY_REDACTING_LAYOUTS: LayoutId[] = LAYOUTS.filter((l) => l !== "terminal");
  for (const layout of BODY_REDACTING_LAYOUTS) {
    it(`${layout} redacts secrets in the body when present`, () => {
      const base = makeBusyData();
      const data: ReviewData = { ...base, secrets: ["Hardcoded secret."] };
      const out = renderSummary(layout, data);
      expect(out).not.toContain("Hardcoded secret.");
      expect(out).toContain("[REDACTED_SECRET]");
    });
  }
});

// -- Layouts are visually distinct (smoke check via size + content shape) --

describe("layout distinctness — each layout has a recognisable signature", () => {
  it("all 20 layouts produce different strings for the busy sample", () => {
    const outputs = LAYOUTS.map((l) => renderSummary(l, makeBusyData()));
    const unique = new Set(outputs);
    expect(unique.size).toBe(LAYOUTS.length);
  });

  it("all 20 layouts produce different strings for the clean sample", () => {
    const outputs = LAYOUTS.map((l) => renderSummary(l, makeCleanData()));
    const unique = new Set(outputs);
    expect(unique.size).toBe(LAYOUTS.length);
  });

  it("every layout uses emoji (visually rich, not text-only)", () => {
    // Smoke check — each layout should have at least one emoji glyph.
    // We use a broad Unicode range to catch common emoji blocks.
    const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
    for (const layout of LAYOUTS) {
      const out = renderSummary(layout, makeBusyData());
      expect(out).toMatch(emojiRe);
    }
  });
});

// -- Type safety smoke ------------------------------------------------------

describe("type safety — LayoutId union covers LAYOUTS", () => {
  it("every LAYOUTS entry is assignable to LayoutId", () => {
    const ids: LayoutId[] = [...LAYOUTS];
    expect(ids.length).toBe(LAYOUTS.length);
  });
});