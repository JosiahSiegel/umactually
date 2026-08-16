// Smoke + invariant tests for the review summary layout.
//
// Scenario contract (see ulw-notepad):
//   S2: The layout renders without throwing given sample data.
//   S3: The layout includes the stable review marker (see src/util/marker.ts).
//   S4: The layout includes the manifest JSON.
//   S5: The summary section avoids <details>/<summary> (Azure-incompatible).
//   S6: The layout uses no raw <table> HTML (Azure-incompatible).

import { describe, expect, it } from "vitest";

import {
  renderSummary,
  type ReviewData,
} from "../../src/render/summary-layouts.js";
import {
  REVIEW_MARKER,
  MANIFEST_SCHEMA,
  RESOLUTION_GUIDE_MARKER,
} from "../../src/util/marker.js";

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

/**
 * Worst-case parse-failed fixture: a ~16,000-char `summary` matches the
 * `MALFORMED_PROVIDER_FALLBACK_RAW_MAX` constant in `src/cli/live-shared.ts`.
 * The existing `makeParseFailedData` is a static ~200-char stub that passes
 * the body-budget invariant trivially; this fixture actually exercises the
 * parse-fail + resolution-guide combo to confirm the 65,536-char budget
 * still holds after baking the guide (~2,100 chars) onto a near-max
 * summary. See `test/unit/parse-fail-diagnostic.test.ts` for the matching
 * CLARITY-12 budget pin.
 */
function makeWorstCaseParseFailedData(): ReviewData {
  const head =
    "event: response.created\n" +
    'data: {"type":"response.created","response":{"id":"resp_1","output":[]}}\n\n' +
    "event: response.in_progress\n" +
    'data: {"type":"response.in_progress","response":{"id":"resp_1","output":[]}}\n\n';
  const tail =
    "event: response.completed\n" +
    'data: {"type":"response.completed","response":{"id":"resp_1","status":"completed","output_text":"REVIEW_JSON_HERE"}}\n';
  const padding = "x".repeat(16_000 - head.length - tail.length);
  const longSummary = head + padding + tail;
  return makeData({
    review: {
      summary: longSummary,
      verdict: "COMMENT",
      comments: [],
      suppressedComments: [],
      parseFailed: true,
    },
  });
}

// -- S2: The layout renders without throwing -------------------------------

describe("S2 — the layout renders without throwing", () => {
  it("renders on busy data", () => {
    const out = renderSummary(makeBusyData());
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });

  it("renders on clean data", () => {
    const out = renderSummary(makeCleanData());
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });

  it("renders on parse-failed data", () => {
    const out = renderSummary(makeParseFailedData());
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
  });

  it("renderSummary throws when validCommentCount is undefined", () => {
    const data = { ...makeBusyData(), validCommentCount: undefined } as unknown as Parameters<typeof renderSummary>[0];
    expect(() => renderSummary(data)).toThrow(/validCommentCount is required/u);
  });

  it("renderSummary throws when suppressedCommentCount is undefined", () => {
    const data = { ...makeBusyData(), suppressedCommentCount: undefined } as unknown as Parameters<typeof renderSummary>[0];
    expect(() => renderSummary(data)).toThrow(/suppressedCommentCount is required/u);
  });

  it("renderSummary throws a descriptive error when postedComments is omitted", () => {
    // The guard gives callers who construct ReviewData manually (not
    // via buildReviewBody) a clear error pointing at the right entry
    // point rather than a confusing crash deep inside a layout helper.
    const dataWithoutPostedComments = {
      ...makeBusyData(),
      postedComments: undefined,
    } as unknown as Parameters<typeof renderSummary>[0];
    expect(() => renderSummary(dataWithoutPostedComments)).toThrow(
      /postedComments is required/u,
    );
  });
});

// -- S3: Stable marker present ---------------------------------------------

describe("S3 — the layout includes the stable marker", () => {
  it("includes the REVIEW_MARKER", () => {
    const out = renderSummary(makeBusyData());
    expect(out).toContain(REVIEW_MARKER);
  });
});

// -- S4: Manifest present --------------------------------------------------

describe("S4 — the layout includes the hidden manifest", () => {
  it("embeds the umactually:manifest comment", () => {
    const out = renderSummary(makeBusyData());
    expect(out).toContain("<!-- umactually:manifest ");
    expect(out).toContain(MANIFEST_SCHEMA);
  });

  it("manifest contains the required fields", () => {
    const out = renderSummary(makeBusyData());
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

  it("summary section has no <details> tag for short summary", () => {
    const out = renderSummary(makeBusyData());
    const summary = summarySection(out);
    expect(summary).not.toContain("<details>");
    expect(summary).not.toContain("</details>");
  });

  it("summary section has no <summary> tag for short summary", () => {
    const out = renderSummary(makeBusyData());
    const summary = summarySection(out);
    expect(summary).not.toContain("<summary>");
    expect(summary).not.toContain("</summary>");
  });
});

describe("S5b — verbose summary (>500 chars) is wrapped in <details> for collapsibility", () => {
  // Helper: a review with a 1.5K-char summary mimicking the production
  // self-review on PR #9 where the model emits `Key correctness
  // concerns I spotted: ... I cannot approve without addressing: ...`
  // sections that are too long to be inline.
  function makeVerboseData(): Parameters<typeof renderSummary>[0] {
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
    const out = renderSummary(makeVerboseData());
    // Must have a <details>...</details> wrapping the summary
    expect(out).toContain("<details>");
    expect(out).toContain("</details>");
    // And a <summary> with the click-to-expand label
    expect(out).toMatch(/<summary>[\s\S]*?<\/summary>/u);
  });

  it("verbose summary's <details> contains the model output (no truncation)", () => {
    const data = makeVerboseData();
    const out = renderSummary(data);
    // The summary text MUST appear inside the details block — we
    // should NOT silently truncate just because we wrapped it.
    expect(out).toContain("Key correctness concerns I spotted:");
    expect(out).toContain("I cannot approve this without addressing:");
    expect(out).toContain("Concern 10");
  });

  it("verbose summary <details> body is correctly closed before the next section", () => {
    const out = renderSummary(makeVerboseData());
    // The </details> must appear BEFORE the horizontal rule (---)
    // that separates Summary from the Footer.
    const detailsClose = out.indexOf("</details>");
    const hr = out.indexOf("\n---\n");
    expect(detailsClose).toBeGreaterThan(0);
    expect(hr).toBeGreaterThan(detailsClose);
  });

  it("verbose summary length fits inside the body well below 65,536 chars", () => {
    const out = renderSummary(makeVerboseData());
    // Wrapping in <details> shouldn't bloat the body past GitHub's limit
    expect(out.length).toBeLessThan(65_536);
  });
});

// -- S6: No raw <table> HTML -----------------------------------------------

describe("S6 — the layout uses no raw <table> HTML (Azure-incompatible)", () => {
  it("has no <table>/<tr>/<td> tags", () => {
    const out = renderSummary(makeBusyData());
    expect(out).not.toMatch(/<table[\s>]/iu);
    expect(out).not.toContain("<tr>");
    expect(out).not.toContain("<td");
  });
});

// -- Additional cross-cutting invariants -----------------------------------

describe("severity-table details", () => {
  it("falls back to path:line snippet when a posted comment has empty body (PR #219 regression)", () => {
    // PR #219 review `PRR_kwDOTHG5gM8AAAABJa7d1g` produced a finding
    // with `body: ""`. The summary-line snippet path had no fallback,
    // so the line rendered as `1 · 🟠 Medium — ` — useless to humans
    // scanning the review summary. The inline-thread path already
    // falls back to `Finding at <path>:<line>.` (see
    // `src/cli/live-shared.ts:buildInlineCommentBody`); the summary
    // snippet now mirrors the same fallback so reviewers see a
    // locatable handle in both layouts.
    const data: ReviewData = makeData({
      postedComments: [
        {
          path: "src/empty-body.ts",
          line: 42,
          body: "",
          severity: "medium",
          category: "correctness",
        },
      ],
      validCommentCount: 1,
      severityCounts: { critical: 0, high: 0, medium: 1, low: 0 },
    });
    const out = renderSummary(data);
    // Summary line: snippet falls back to `Finding at <path>:<line>.`
    // — same fallback string as the inline-thread path in
    // `src/cli/live-shared.ts:buildInlineCommentBody`, so reviewers
    // see the same shape in both layouts.
    expect(out).toContain(
      "<summary>1 · 🟠 Medium — Finding at src/empty-body.ts:42.</summary>",
    );
    // Regression guard: the snippet portion after the em-dash must
    // NOT be just whitespace (this is the exact byte shape that
    // surfaced on PR #219).
    expect(out).not.toMatch(/<summary>1 · 🟠 Medium —\s+<\/summary>/u);
    // Expanded body mirrors the same fallback so the body is also
    // non-empty when the user expands the row.
    expect(out).toContain("> Finding at src/empty-body.ts:42.");
    // 📍 marker still uses the bare path:line shape (no "Finding at"
    // prefix) — unchanged by the fix.
    expect(out).toContain("📍 `src/empty-body.ts`:42");
  });

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

    const out = renderSummary(data);
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
      { severity: "security", glyph: "🟣" },
      { severity: "high",     glyph: "🔴" },
      { severity: "leak",     glyph: "🔴" },
      { severity: "medium",   glyph: "🟠" },
      { severity: "major",    glyph: "🟠" },
      { severity: "low",      glyph: "🟡" },
      { severity: "minor",    glyph: "🟡" },
      { severity: "info",     glyph: "🟡" },
    ];
    for (const c of cases) {
      const data = makeData({
        postedComments: [
          { path: "src/x.ts", line: 1, body: "x", severity: c.severity, category: "general" },
        ],
        validCommentCount: 1,
      });
      const out = renderSummary(data);
      expect(out).toContain(c.glyph);
    }
  });

  it("severityEmoji emits plain-⚪ fallback for unknown severities", () => {
    // Unknown severities don't match any bucket in severity-table, so use
    // a layout that renders every comment inline (verdict-banner). The
    // posted comment keeps the input above the clean-ship gate so the
    // layout actually runs.
    const data = makeData({
      postedComments: [
        { path: "src/x.ts", line: 1, body: "x", severity: "unknown", category: "general" },
      ],
      validCommentCount: 1,
    });
    const out = renderSummary(data);
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
      validCommentCount: 2,
    });
    // severity-table is the default layout. Rows are sorted by
    // severity bucket (highest rank first), so critical is row 1,
    // medium is row 2.
    const severityOut = renderSummary(data);
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
    const dashboardOut = renderSummary(data);
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

    const out = renderSummary(data);
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

    const out = renderSummary(data);
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

    const out = renderSummary(data);
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
    const out = renderSummary(data);
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
    const out = renderSummary(data);
    expect(out).toContain("📊 2 inline findings");
  });

  it("body collapses to the ship-it line when postedComments is empty, even if model produced findings", () => {
    // The caller says 0 posted (all filtered). The body must NOT
    // pretend a non-zero headline — clean-ship branch fires and the
    // body emits the one-line verdict.
    const data: ReviewData = makeData({
      review: {
        summary: "",
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
      postedComments: [],
    });
    const out = renderSummary(data);
    expect(out).toContain("## ✅ 0 inline findings — ship it");
    expect(out).not.toContain("📊 0 inline findings");
    // No off-diff callout when offDiffCount === 0.
    expect(out).not.toMatch(/not posted inline/u);
  });
});

describe("cross-cutting invariants", () => {
  it("stays under GitHub's 65,536-char body limit on busy data", () => {
    const out = renderSummary(makeBusyData());
    expect(out.length).toBeLessThanOrEqual(65_536);
  });

  it("redacts secrets in the body when present", () => {
    const base = makeBusyData();
    const data: ReviewData = { ...base, secrets: ["Hardcoded secret."] };
    const out = renderSummary(data);
    expect(out).not.toContain("Hardcoded secret.");
    expect(out).toContain("[REDACTED_SECRET]");
  });

  it("emits the clean-ship body for an empty review", () => {
    const out = renderSummary(makeCleanData());
    expect(out).toContain("ship it");
  });

  it("uses emoji (visually rich, not text-only)", () => {
    // Broad Unicode range covering the common emoji blocks.
    const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;
    const out = renderSummary(makeBusyData());
    expect(out).toMatch(emojiRe);
  });
});

// -- Verdict escalation banner (PR #183 review pass) -------------------------

describe("verdict escalation banner", () => {
  it("severity-table emits an escalation banner between the badge and the pipeline summary when SHIP is escalated to NEEDS_FIX", () => {
    const out = renderSummary(
      makeData({
        review: {
          summary: "Looks good, ship it.",
          verdict: "NEEDS_FIX",
          comments: [],
          suppressedComments: [],
        },
        validCommentCount: 1,
        severityCounts: { medium: 1 },
        verdictEscalatedFrom: "SHIP",
        postedComments: [{
          path: "src/x.ts",
          line: 1,
          body: "Extract this nested ternary operation.",
          severity: "medium",
          category: "correctness",
        }],
      }),
    );
    const markerIdx = out.indexOf(REVIEW_MARKER);
    const badgeIdx = out.indexOf("## ⛔ NEEDS_FIX");
    const bannerIdx = out.indexOf("Verdict escalated from `SHIP` → `NEEDS_FIX`");
    const pipelineIdx = out.indexOf("📊 1 inline finding");
    expect(markerIdx).toBeGreaterThanOrEqual(0);
    expect(badgeIdx).toBeGreaterThan(markerIdx);
    expect(bannerIdx).toBeGreaterThan(badgeIdx);
    expect(pipelineIdx).toBeGreaterThan(bannerIdx);
  });

  it("no banner is emitted when verdictEscalatedFrom is omitted (raw === effective)", () => {
    const out = renderSummary(
      makeData({
        review: {
          summary: "Reviewed.",
          verdict: "NEEDS_FIX",
          comments: [],
          suppressedComments: [],
        },
        validCommentCount: 1,
        severityCounts: { medium: 1 },
        postedComments: [{
          path: "src/x.ts",
          line: 1,
          body: "Fix this.",
          severity: "medium",
          category: "correctness",
        }],
      }),
    );
    expect(out).not.toMatch(/Verdict (escalated|downgraded)/u);
  });

  it("emits a downgrade banner (raw NEEDS_FIX → effective COMMENT) when all findings were severity-filtered", () => {
    const out = renderSummary(
      makeData({
        review: {
          summary: "Reviewed.",
          verdict: "COMMENT",
          comments: [],
          suppressedComments: [],
        },
        validCommentCount: 0,
        severityCounts: {},
        verdictEscalatedFrom: "NEEDS_FIX",
        postedComments: [],
      }),
    );
    expect(out).toMatch(/Verdict downgraded from `NEEDS_FIX` → `COMMENT`/u);
    expect(out).toMatch(/no postable findings to address/u);
  });

  it("verdict-banner layout nests the escalation banner inside the existing `> ## verdict` blockquote", () => {
    const out = renderSummary(
      makeData({
        review: {
          summary: "Looks good, ship it.",
          verdict: "NEEDS_FIX",
          comments: [],
          suppressedComments: [],
        },
        validCommentCount: 1,
        severityCounts: { medium: 1 },
        verdictEscalatedFrom: "SHIP",
        postedComments: [{
          path: "src/x.ts",
          line: 1,
          body: "Fix this.",
          severity: "medium",
          category: "correctness",
        }],
      }),
    );
    expect(out).toMatch(/^> ⚠️ Verdict escalated from `SHIP` → `NEEDS_FIX`/mu);
  });
});

describe("internal Severity vocabulary in tally + emoji", () => {
  // SonarCloud MAJOR/CRITICAL/BLOCKER findings (merged via
  // --include-pr-sonar-findings) carry the internal Severity vocabulary
  // (major/critical/leak). Without these cases they render as ⚪.
  it("renders 🟠 Medium glyph for severity='major' and includes it in the tally", () => {
    const out = renderSummary(
      makeData({
        review: {
          summary: "SonarCloud MAJOR finding.",
          verdict: "NEEDS_FIX",
          comments: [],
          suppressedComments: [],
        },
        validCommentCount: 1,
        severityCounts: { major: 1 },
        postedComments: [{
          path: "src/cli/init.ts",
          line: 1298,
          body: "Extract this nested ternary operation.",
          severity: "major",
          category: "sonar",
        }],
      }),
    );
    expect(out).toContain("🟠 Medium");
    expect(out).toMatch(/`1` major/u);
  });

  // The `security` and `leak` tiers are CARVE-OUT findings: they
  // bypass the --minimum-severity threshold entirely (see
  // config/severity.ts:shouldKeepFinding) and are intentionally
  // hidden from the four-tier display tally. They render their
  // finding bodies with the correct glyph (🟣 Critical for security,
  // 🔴 High for leak) so reviewers can identify severity on the
  // inline thread, but the headline tally omits them — see the
  // `severity + leak carve-out` test in live-shared-body.test.ts
  // for the canonical invariant.
  it("renders security and leak inline with the correct glyph but hides them from the tally", () => {
    const out = renderSummary(
      makeData({
        review: {
          summary: "Carve-out findings.",
          verdict: "NEEDS_FIX",
          comments: [],
          suppressedComments: [],
        },
        validCommentCount: 2,
        severityCounts: { security: 1, leak: 1 },
        postedComments: [
          {
            path: "src/auth.ts",
            line: 12,
            body: "Hardcoded credential.",
            severity: "security",
            category: "security",
          },
          {
            path: "src/secret.ts",
            line: 1,
            body: "Hardcoded API key.",
            severity: "leak",
            category: "security",
          },
        ],
      }),
    );
    // The inline section renders the correct severity glyph for each
    // carve-out finding so reviewers can read the inline thread.
    expect(out).toContain("🟣 Critical");
    expect(out).toContain("🔴 High");
    // The headline tally does NOT include `security` or `leak` —
    // they bypass the threshold and aren't display tiers. When
    // all postable findings are carve-outs the tally emits a
    // `🔒 \`N\` carve-out only` marker instead (see severityTally's
    // carve-out fallback).
    expect(out).not.toMatch(/`\d+` security/u);
    expect(out).not.toMatch(/`\d+` leak/u);
    expect(out).toMatch(/🔒\s+`2`\s+carve-out only/u);
    // Manifest payload is JSON; the tally string is NOT parsed. The
    // manifest's severityCounts still carries the carve-out counts
    // verbatim so downstream consumers (CI guards, dashboards) see
    // the same picture as the inline threads.
    const manifest = JSON.parse(
      out.match(/<!--\s*umactually:manifest\s+(\{[^]*?\})\s*-->/u)?.[1] ?? "{}",
    );
    expect(manifest.severityCounts).toEqual({ security: 1, leak: 1 });
    expect(manifest.inlineCount).toBe(2);
  });
});

describe("escalation banner — posted-count sourcing", () => {
  it("surfaces the escalation banner when verdictEscalatedFrom is set", () => {
    const out = renderSummary(
      makeData({
        review: {
          summary: "Looks good, ship it.",
          verdict: "NEEDS_FIX",
          comments: [],
          suppressedComments: [],
        },
        validCommentCount: 1,
        severityCounts: { medium: 1 },
        verdictEscalatedFrom: "SHIP",
        postedComments: [{
          path: "src/x.ts",
          line: 1,
          body: "x",
          severity: "medium",
          category: "general",
        }],
      }),
    );
    expect(out).toMatch(/Verdict escalated from `SHIP` → `NEEDS_FIX`/u);
  });

  it("escalation banner uses postedComments.length, not validCommentCount (they diverge when some findings are off-diff)", () => {
    const out = renderSummary(
      makeData({
        review: {
          summary: "Looks good, ship it.",
          verdict: "NEEDS_FIX",
          comments: [],
          suppressedComments: [],
        },
        validCommentCount: 3,
        severityCounts: { medium: 2, high: 1 },
        verdictEscalatedFrom: "SHIP",
        postedComments: [
          { path: "src/a.ts", line: 1, body: "a", severity: "high", category: "correctness" },
          { path: "src/b.ts", line: 1, body: "b", severity: "medium", category: "style" },
        ],
      }),
    );
    expect(out).toMatch(/review contains 2 postable findings/u);
  });
});

// -- Resolution guide baked into every shipped body ------------------------
// Task 2 of the bake-resolution-guide plan: both layouts splice the
// collapsed guide between footer and manifest. The marker is the LAST
// non-empty line of the guide block (not the body — the manifest owns
// that slot). The self-review workflow greps for the v3 marker in the
// WHOLE body (see Task 1 learnings) to decide whether to re-bake.

describe("resolution guide — both layouts splice it between footer and manifest", () => {
  it("busy body contains the resolution-guide-v3 marker exactly once", () => {
    const out = renderSummary(makeBusyData());
    const matches = out.split(RESOLUTION_GUIDE_MARKER).length - 1;
    expect(matches).toBe(1);
    expect(out).toContain(RESOLUTION_GUIDE_MARKER);
  });

  it("busy body: marker is AFTER the 'Generated by' footer AND BEFORE the manifest", () => {
    const out = renderSummary(makeBusyData());
    const footerIdx = out.indexOf("Generated by");
    const markerIdx = out.indexOf(RESOLUTION_GUIDE_MARKER);
    const manifestIdx = out.indexOf("<!-- umactually:manifest ");
    expect(footerIdx).toBeGreaterThanOrEqual(0);
    expect(markerIdx).toBeGreaterThan(footerIdx);
    expect(manifestIdx).toBeGreaterThan(markerIdx);
  });

  it("clean-ship body ALSO contains the guide marker (0-finding reviews still need the close protocol)", () => {
    const out = renderSummary(makeCleanData());
    const matches = out.split(RESOLUTION_GUIDE_MARKER).length - 1;
    expect(matches).toBe(1);
    expect(out).toContain(RESOLUTION_GUIDE_MARKER);
  });

  it("manifest line is still the LAST non-empty line of the body (busy + clean)", () => {
    for (const fixture of [makeBusyData, makeCleanData]) {
      const out = renderSummary(fixture());
      const lines = out.split("\n");
      const lastNonEmpty = lines.filter((line) => line.trim().length > 0).pop();
      expect(lastNonEmpty).toMatch(/^<!--\s*umactually:manifest\s+.*-->/u);
    }
  });

  it("worst-case parse-failed body (16,000-char rawText + guide) stays under the 65,536-char limit", () => {
    const out = renderSummary(makeWorstCaseParseFailedData());
    expect(out.length).toBeLessThanOrEqual(65_536);
  });

  it("worst-case parse-failed body still has the guide marker before the manifest", () => {
    const out = renderSummary(makeWorstCaseParseFailedData());
    const markerIdx = out.indexOf(RESOLUTION_GUIDE_MARKER);
    const manifestIdx = out.indexOf("<!-- umactually:manifest ");
    expect(markerIdx).toBeGreaterThanOrEqual(0);
    expect(manifestIdx).toBeGreaterThan(markerIdx);
  });
});
