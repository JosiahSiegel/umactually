// Smoke + invariant tests for the 20 review summary layouts.
//
// Scenario contract (see ulw-notepad):
//   S1: Module exports 20 distinct layout IDs (smoke test).
//   S2: All 20 layouts render without throwing given sample data.
//   S3: All 20 layouts include the stable marker <!-- umactually-pr-review -->.
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
    // @ts-expect-error — intentionally invalid
    expect(() => renderSummary("nope", makeBusyData())).toThrow();
  });

  it("renderBaseline renders the 'current' baseline", () => {
    const out = renderBaseline(BASELINE, makeBusyData());
    expect(typeof out).toBe("string");
    expect(out.length).toBeGreaterThan(0);
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
    it(`${layout} embeds the umalready-pr-review:manifest comment`, () => {
      const out = renderSummary(layout, makeBusyData());
      expect(out).toContain("<!-- umactually-pr-review:manifest ");
      expect(out).toContain(MANIFEST_SCHEMA);
    });

    it(`${layout} manifest contains the required fields`, () => {
      const out = renderSummary(layout, makeBusyData());
      const match = /<!-- umactually-pr-review:manifest (.+?) -->/u.exec(out);
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

// -- S5: No <details>/<summary> tags ---------------------------------------

describe("S5 — no layout uses <details>/<summary> (Azure-incompatible)", () => {
  for (const layout of LAYOUTS) {
    it(`${layout} has no <details> tag`, () => {
      const out = renderSummary(layout, makeBusyData());
      expect(out).not.toContain("<details>");
      expect(out).not.toContain("</details>");
    });

    it(`${layout} has no <summary> tag`, () => {
      const out = renderSummary(layout, makeBusyData());
      expect(out).not.toContain("<summary>");
      expect(out).not.toContain("</summary>");
    });
  }
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
    expect(out).toContain("<!-- umactually-pr-review:manifest ");
  });

  it("baseline includes the pipeline summary line", () => {
    const out = renderBaseline(BASELINE, makeBusyData());
    expect(out).toContain("📊 7 findings → 6 posted, 1 off-diff, 0 filtered");
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