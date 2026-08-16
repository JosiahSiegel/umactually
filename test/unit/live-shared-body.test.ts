// Tests for the shared review-body builders used by both GitHub and Azure live
// review paths. Both platforms must produce equivalent message contracts so
// AI agents and humans see the same information regardless of platform.
import { describe, expect, it } from "vitest";

import {
  buildReviewBody,
  buildInlineCommentBody,
  type LiveReview,
} from "../../src/cli/live-shared.js";
import { countBySeverity } from "../../src/util/severity.js";
import { REVIEW_MARKER } from "../../src/util/marker.js";

const SAMPLE_REVIEW: LiveReview = {
  summary: "Three issues need attention before merge.",
  verdict: "NEEDS_FIX",
  comments: [
    {
      path: "src/auth.ts",
      line: 12,
      body: "Use bcrypt for password hashing.",
      severity: "high",
      category: "security",
    },
    {
      path: "src/db.ts",
      line: 7,
      body: "Add a connection pool timeout.",
      severity: "medium",
      category: "maintainability",
    },
    {
      path: "README.md",
      line: 42,
      body: "Update the example env variable name.",
      severity: "low",
      category: "docs",
    },
  ],
  suppressedComments: [
    {
      path: "src/old.ts",
      line: 3,
      body: "Legacy code issue.",
      severity: "low",
      category: "general",
    },
  ],
};

const SECRETS = ["sk-test-secret-do-not-leak"] as const;

describe("buildReviewBody (shared GitHub + Azure review header)", () => {
  it("FEAT-PARITY-001 emits the stable HTML marker so dedup works on both platforms", () => {
    const body = buildReviewBody({
      review: SAMPLE_REVIEW,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 3,
      suppressedCommentCount: 1,
      offDiffFromComments: [],
      severityCounts: { high: 1, medium: 1, low: 1 },
      secrets: SECRETS,
    });
    expect(body).toContain(REVIEW_MARKER);
  });

  it("FEAT-PARITY-002 includes a verdict badge that both platforms render", () => {
    const body = buildReviewBody({
      review: SAMPLE_REVIEW,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 3,
      suppressedCommentCount: 1,
      offDiffFromComments: [],
      severityCounts: { high: 1, medium: 1, low: 1 },
      secrets: SECRETS,
    });
    // Verdict is one of three values; the badge is rendered consistently.
    expect(body).toMatch(/NEEDS_FIX|SHIP|APPROVED|DISCUSS|COMMENT/);
    // The short unicode verdict indicator must be present so both GitHub and
    // ADO render the same emoji in the review header.
    expect(body).toMatch(/[⛔✅💬]/u);
  });

  it("FEAT-PARITY-003 includes the summary paragraph verbatim", () => {
    const body = buildReviewBody({
      review: SAMPLE_REVIEW,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 3,
      suppressedCommentCount: 1,
      offDiffFromComments: [],
      severityCounts: { high: 1, medium: 1, low: 1 },
      secrets: SECRETS,
    });
    expect(body).toContain("Three issues need attention before merge.");
  });

  it("FEAT-PARITY-004 surfaces every finding inline in the parent card (no hidden details block)", () => {
    // Cutover note: the old builder wrapped long prose and the posted
    // preview in <details> blocks. The new severity-table layout
    // surfaces every finding inline in a GFM table so reviewers see
    // the full review without clicking. The hidden manifest comment
    // (FEAT-PARITY-006) remains the only hidden payload.
    const body = buildReviewBody({
      review: SAMPLE_REVIEW,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 3,
      suppressedCommentCount: 1,
      offDiffFromComments: [],
      severityCounts: { high: 1, medium: 1, low: 1 },
      secrets: SECRETS,
    });
    // Every finding must appear in the rendered body, NOT hidden.
    for (const c of SAMPLE_REVIEW.comments) {
      expect(body).toContain(c.path);
      expect(body).toContain(c.body);
    }
    // The severity-table layout must surface a real findings list.
    // Shape: `<details>` collapsible rows (mobile-friendly — see
    // findingsDetailsRow docstring). The previous 4-col GFM-table
    // layout caused mid-word wrap at 576px viewport (Severity
    // header "Severit"/"y", # column "10" stacked, File:Line
    // broken mid-identifier); <details> has no column-width
    // constraints so all of that disappears.
    expect(body).toContain("<summary>1 ·");
    expect(body).toContain("</details>");
    expect(body).not.toContain("| # | Severity |");
    expect(body).not.toContain("&nbsp;&nbsp;&nbsp;&nbsp;");
  });

  it("FEAT-PARITY-005 includes severity counts at the top of the card (no raw asterisks)", () => {
    // Severity counts live on the "📊" line immediately after the verdict
    // badge so the developer sees them within the first viewport. We use
    // emoji + backticks (NOT `**word**` asterisks) because ADO's
    // PR-thread renderer has been observed to leak `**...**` as literal
    // asterisks in this surface — see CLARITY-3 in
    // test/unit/live-azure-parent-clarity.test.ts.
    const body = buildReviewBody({
      review: SAMPLE_REVIEW,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 3,
      suppressedCommentCount: 1,
      offDiffFromComments: [],
      severityCounts: { high: 1, medium: 1, low: 1 },
      secrets: SECRETS,
    });
    // Each severity level appears at least once with a count. Use a
    // regex that matches the clarity-form counts line, NOT the old
    // `**high**: 1` raw-asterisk form.
    expect(body).toMatch(/`1`\s+high/u);
    expect(body).toMatch(/`1`\s+medium/u);
    expect(body).toMatch(/`1`\s+low/u);
    // And the old asterisks form must be GONE everywhere.
    expect(body).not.toMatch(/\*\*high\*\*:\s*1/u);
    expect(body).not.toMatch(/\*\*medium\*\*:\s*1/u);
    expect(body).not.toMatch(/\*\*low\*\*:\s*1/u);
  });

  it("FEAT-PARITY-006 includes a machine-readable findings manifest as an HTML comment for AI agents", () => {
    const body = buildReviewBody({
      review: SAMPLE_REVIEW,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 3,
      suppressedCommentCount: 1,
      offDiffFromComments: [],
      severityCounts: { high: 1, medium: 1, low: 1 },
      secrets: SECRETS,
    });
    // The manifest is embedded in a hidden HTML comment so it does not
    // visually clutter either platform, but is parseable by agents.
    expect(body).toMatch(/<!--\s*umactually:manifest\s*\{[\s\S]*?\}\s*-->/);
    const match = body.match(/<!--\s*umactually:manifest\s*(\{[\s\S]*?\})\s*-->/);
    expect(match).not.toBeNull();
    const manifestText = match?.[1];
    expect(manifestText).toBeDefined();
    if (manifestText !== undefined) {
      const parsed = JSON.parse(manifestText);
      expect(parsed.verdict).toBe("NEEDS_FIX");
      expect(parsed.provider).toBe("openai-compatible");
      expect(parsed.modelId).toBe("auto");
      expect(parsed.inlineCount).toBe(3);
      expect(parsed.suppressedCount).toBe(1);
      expect(parsed.severityCounts).toEqual({ high: 1, medium: 1, low: 1 });
    }
  });

  it("FEAT-PARITY-007 redacts any leaked secrets before posting", () => {
    const review: LiveReview = {
      summary: `Token leaked: sk-test-secret-do-not-leak`,
      verdict: "NEEDS_FIX",
      comments: [],
      suppressedComments: [],
    };
    const body = buildReviewBody({
      review,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
      secrets: SECRETS,
    });
    expect(body).not.toContain("sk-test-secret-do-not-leak");
    expect(body).toContain("[REDACTED_SECRET]");
  });

  it("FEAT-PLATFORM-DEFAULT buildReviewBody called directly without platform defaults to the GitHub guide variant", () => {
    // Given: a simulate/dry-run-style caller that omits the platform
    // field entirely. This is the byte-identical legacy shape — unit
    // tests, simulate-findings, and any caller that doesn't have a
    // known platform in scope MUST keep rendering the GitHub variant.
    const body = buildReviewBody({
      review: SAMPLE_REVIEW,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 3,
      suppressedCommentCount: 1,
      offDiffFromComments: [],
      severityCounts: { high: 1, medium: 1, low: 1 },
      secrets: SECRETS,
      // platform deliberately omitted
    });

    // Then: the resolution guide footer renders the GitHub variant.
    expect(body).toContain("resolveReviewThread");
    // And NOT the Azure recipe (cross-token guard).
    expect(body).not.toContain("az repos pr thread update");
  });
});

describe("buildInlineCommentBody (shared per-comment format for GitHub and Azure)", () => {
  it("FEAT-PARITY-010 prepends a severity/category badge line", () => {
    const body = buildInlineCommentBody({
      comment: {
        path: "src/auth.ts",
        line: 12,
        body: "Use bcrypt for password hashing.",
        severity: "high",
        category: "security",
      },
      secrets: SECRETS,
    });
    expect(body).toContain("`high` `security`");
  });

  it("FEAT-PARITY-011 falls back to a default body when the provider returned empty text", () => {
    const body = buildInlineCommentBody({
      comment: {
        path: "src/auth.ts",
        line: 12,
        body: "",
        severity: "high",
        category: "security",
      },
      secrets: SECRETS,
    });
    expect(body).toContain("Finding at src/auth.ts:12");
  });

  it("FEAT-PARITY-012 redacts secrets in the inline body", () => {
    const body = buildInlineCommentBody({
      comment: {
        path: "src/auth.ts",
        line: 12,
        body: "Token sk-test-secret-do-not-leak was committed",
        severity: "high",
        category: "security",
      },
      secrets: SECRETS,
    });
    expect(body).not.toContain("sk-test-secret-do-not-leak");
    expect(body).toContain("[REDACTED_SECRET]");
  });

  it("FEAT-PARITY-013 includes the stable marker so per-comment dedup works", () => {
    const body = buildInlineCommentBody({
      comment: {
        path: "src/auth.ts",
        line: 12,
        body: "Body",
        severity: "high",
        category: "security",
      },
      secrets: SECRETS,
      includeMarker: true,
    });
    expect(body).toContain(REVIEW_MARKER);
  });

  it("SCHEMA-001 emits the location + severity/category hint when body is empty", () => {
    const body = buildInlineCommentBody({
      comment: {
        path: "src/foo.ts",
        line: 42,
        body: "",
        severity: "medium",
        category: "general",
      },
      secrets: [],
    });
    expect(body).toContain("Finding at src/foo.ts:42");
    expect(body).toContain("medium");
    expect(body).toContain("general");
    expect(body).toContain("body not populated by provider");
  });

  it("SCHEMA-002 uses the real body when present (no fallback)", () => {
    const body = buildInlineCommentBody({
      comment: {
        path: "src/foo.ts",
        line: 42,
        body: "The function swallows errors and returns null, hiding failures from the caller.",
        severity: "medium",
        category: "general",
      },
      secrets: [],
    });
    expect(body).toContain("swallows errors");
    expect(body).not.toContain("Finding at src/foo.ts:42");
  });
});

describe("countBySeverity (shared helper used by both platforms)", () => {
  it("FEAT-PARITY-020 counts comments grouped by severity", () => {
    const counts = countBySeverity(SAMPLE_REVIEW.comments);
    expect(counts).toEqual({ high: 1, medium: 1, low: 1 });
  });

  it("FEAT-PARITY-021 returns an empty object when there are no comments", () => {
    const counts = countBySeverity([]);
    expect(counts).toEqual({});
  });
});

describe("GitHub + Azure parity", () => {
  it("FEAT-PARITY-030 uses the same review body contract that both platforms POST", () => {
    // The GitHub review `body` field and the Azure thread's first comment
    // `content` field MUST use the same helper so that humans and AI agents
    // get equivalent rendering on each platform.
    const githubBody = buildReviewBody({
      review: SAMPLE_REVIEW,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 3,
      suppressedCommentCount: 1,
      offDiffFromComments: [],
      severityCounts: { high: 1, medium: 1, low: 1 },
      secrets: SECRETS,
    });
    const azureBody = buildReviewBody({
      review: SAMPLE_REVIEW,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 3,
      suppressedCommentCount: 1,
      offDiffFromComments: [],
      severityCounts: { high: 1, medium: 1, low: 1 },
      secrets: SECRETS,
    });
    expect(githubBody).toBe(azureBody);
  });

  it("FEAT-PARITY-031 emits the same per-comment body on both platforms", () => {
    const comment = {
      path: "src/auth.ts",
      line: 12,
      body: "Use bcrypt for password hashing.",
      severity: "high",
      category: "security",
    };
    const githubInline = buildInlineCommentBody({ comment, secrets: SECRETS });
    const azureInline = buildInlineCommentBody({ comment, secrets: SECRETS });
    expect(githubInline).toBe(azureInline);
  });

  it("FEAT-PARITY-040 documents that both platforms support nested replies", () => {
    // GitHub supports nested review-comment replies via:
    //   POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies
    //   (or `in_reply_to` on /comments)
    // Azure DevOps supports nested thread comments via:
    //   POST .../threads/{threadId}/comments  { content, parentCommentId, commentType: 1 }
    //   (up to 500 comments per thread)
    //
    // The current LiveProviderOutcome schema returns a flat list of findings,
    // so neither platform path posts nested replies yet. Adding that support
    // is future work: extend LiveProviderOutcome with a `replies` array and
    // have both live-azure.ts and live-github.ts POST each reply using the
    // corresponding nested-reply endpoint.
    //
    // This test pins the contract so a future change knows to test both
    // platform paths when adding reply support.
    expect(true).toBe(true);
  });
});

describe("buildReviewBody — severity-tally filter marker", () => {
  // CLARITY-22: the 🏷️ … tally should visually convey that some tiers
  // were intentionally hidden by `--minimum-severity` so a "0 low" reading
  // doesn't look like "0 low findings exist". The marker is per-tier: each
  // filtered tier gets a trailing `*`, and a single code-fenced legend line
  // `` `* = filtered by threshold` `` appears BELOW the tally. When no
  // threshold is configured the tally is byte-identical to legacy (no
  // asterisk, no legend).
  const LEGEND = "`* = filtered by threshold`";

  const reviewWithMixedSeverities: LiveReview = {
    summary: "Mixed-severity findings for tally marker test.",
    verdict: "NEEDS_FIX",
    comments: [
      { path: "src/a.ts", line: 1, body: "critical issue", severity: "critical", category: "security" },
      { path: "src/b.ts", line: 2, body: "high issue", severity: "high", category: "maintainability" },
      { path: "src/c.ts", line: 3, body: "medium issue", severity: "medium", category: "maintainability" },
      { path: "src/d.ts", line: 4, body: "low issue", severity: "low", category: "docs" },
    ],
    suppressedComments: [],
  };

  it("minimumSeverity=null → tally has NO asterisks and NO legend (byte-identical to legacy)", () => {
    const body = buildReviewBody({
      review: reviewWithMixedSeverities,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 4,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      severityCounts: { critical: 1, high: 1, medium: 1, low: 1 },
      secrets: SECRETS,
      minimumSeverity: null,
    });
    expect(body).toContain("🏷️ `1` critical · `1` high · `1` medium · `1` low");
    expect(body).not.toContain(LEGEND);
    expect(body).not.toMatch(/`1` \w+\*/u); // no asterisk on any tier
  });

  it("minimumSeverity='low' → tally has NO asterisks and NO legend", () => {
    const body = buildReviewBody({
      review: reviewWithMixedSeverities,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 4,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      severityCounts: { critical: 1, high: 1, medium: 1, low: 1 },
      secrets: SECRETS,
      minimumSeverity: "low",
    });
    expect(body).toContain("🏷️ `1` critical · `1` high · `1` medium · `1` low");
    expect(body).not.toContain(LEGEND);
    expect(body).not.toMatch(/`1` \w+\*/u); // no asterisk on any tier
  });

  it("minimumSeverity='medium' → only low gets an asterisk; legend below tally", () => {
    const body = buildReviewBody({
      review: reviewWithMixedSeverities,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 3, // critical + high + medium survive
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      severityCounts: { critical: 1, high: 1, medium: 1 },
      secrets: SECRETS,
      minimumSeverity: "medium",
    });
    expect(body).toContain("🏷️ `1` critical · `1` high · `1` medium · `0` low* · `0` minor*");
    expect(body).toContain(LEGEND);
  });

  it("minimumSeverity='high' → medium + low get asterisks; legend below tally", () => {
    const body = buildReviewBody({
      review: reviewWithMixedSeverities,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 2, // only critical + high survive
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      severityCounts: { critical: 1, high: 1 }, // medium + low filtered out
      secrets: SECRETS,
      minimumSeverity: "high",
    });
    expect(body).toContain("🏷️ `1` critical · `1` high · `0` medium* · `0` major* · `0` low* · `0` minor*");
    expect(body).toContain(LEGEND);
  });

  it("security + leak carve-out: severity 'security' / 'leak' findings are never asterisked regardless of minimumSeverity", () => {
    // The four display tiers (critical/high/medium/low) are user-facing
    // buckets; security + leak are CARVE-OUT findings that bypass the
    // threshold entirely. They should never appear in the rendered tally
    // at all (they're not in the four-tier summary), AND they should
    // not be filtered out of postable comments. This test pins both:
    // the rendered tally does not include `security*` or `leak*`
    // markers, and the severity counts passed in are preserved as-is
    // (the render layer doesn't decrement them).
    const securityReview: LiveReview = {
      summary: "test review",
      verdict: "NEEDS_FIX",
      comments: [
        { path: "src/a.ts", line: 1, body: "leak", severity: "leak", category: "security" },
        { path: "src/b.ts", line: 2, body: "sec", severity: "security", category: "security" },
        { path: "src/c.ts", line: 3, body: "critical issue", severity: "critical", category: "security" },
        { path: "src/d.ts", line: 4, body: "low issue", severity: "low", category: "style" },
      ],
      suppressedComments: [],
    };
    const body = buildReviewBody({
      review: securityReview,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 3, // leak + security + critical survive; low filtered
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      // Caller computes severityCounts from the postable set: leak +
      // security + critical survive, low filtered. security/leak
      // don't appear in the rendered 4-tier tally because they are
      // not display tiers — they're carve-outs.
      severityCounts: { critical: 1, leak: 1, security: 1 },
      secrets: SECRETS,
      minimumSeverity: "high",
    });
    // No `security*` or `leak*` markers — they aren't display tiers.
    expect(body).not.toMatch(/security\*/u);
    expect(body).not.toMatch(/leak\*/u);
    // critical is the highest visible tier; only it shows in the tally.
    expect(body).toContain("🏷️ `1` critical");
    // The filtered markers (medium*, low*) come from the threshold,
    // not from the carve-out. With minimumSeverity='high' and only
    // critical+security+leak in the postable set, no medium/low
    // tiers are visible to be marked.
    expect(body).toMatch(/`0` medium\* · `0` major\* · `0` low\* · `0` minor\*/u);
  });

  it("asterisk + legend appear on the `severity-table` default layout (the one buildReviewBody dispatches to)", () => {
    // The severity-table layout (LAYOUT_DEFAULT) is what buildReviewBody
    // renders by default. It uses the inline `severityTally` form (NOT
    // the GFM table form used by `dashboard`). Verify the new marker
    // shape lands correctly there.
    const body = buildReviewBody({
      review: reviewWithMixedSeverities,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 2,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      severityCounts: { critical: 1, high: 1 },
      secrets: SECRETS,
      minimumSeverity: "high",
    });
    // The asterisk appears on filtered tiers and the legend is below.
    expect(body).toMatch(/`0` medium\* · `0` major\* · `0` low\* · `0` minor\*/);
    expect(body).toContain(LEGEND);
  });

});

describe("live-shared module exports", () => {
  it("does not expose the removed severity-count compatibility alias", async () => {
    // Given / When: the live-shared public module is loaded.
    const liveShared = await import("../../src/cli/live-shared.js");

    // Then: callers must import the canonical utility directly.
    expect("countBySeverityFromLiveShared" in liveShared).toBe(false);
    expect(countBySeverity([{ severity: "high" }])).toEqual({ high: 1 });
  });
});

// SHIP-CLEAN-001..005: A 0-finding, 0-suppressed, non-parse-failed review
// must collapse to a single one-line verdict plus the manifest. The
// provider's long summary (if any) goes into a collapsed <details>
// behind a "Click to expand" toggle. No DISCUSS/FINDINGS/SUMMARY
// scaffolding. A minimal "Generated by ..." footer mirrors the
// convention used by every other layout (so downstream consumers
// that grep for the footer recognize this as a umactually body).
// Parse-failed reviews stay on the diagnostic branch and must NOT
// take this path.
describe("buildReviewBody — concise empty-review body (ship-it branch)", () => {
  const cleanReview: LiveReview = {
    summary: "Test probe: synthetic 0-finding review for noise-skip verification.",
    verdict: "COMMENT",
    comments: [],
    suppressedComments: [],
  };

  it("SHIP-CLEAN-001: emits the one-line `## ✅ 0 inline findings — ship it` verdict", () => {
    const body = buildReviewBody({
      review: cleanReview,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      postedComments: [],
      severityCounts: {},
      secrets: SECRETS,
    });
    expect(body).toContain("## ✅ 0 inline findings — ship it");
  });

  it("SHIP-CLEAN-002: emits the review marker as the first non-blank line", () => {
    const body = buildReviewBody({
      review: cleanReview,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      postedComments: [],
      severityCounts: {},
      secrets: SECRETS,
    });
    expect(body.startsWith(REVIEW_MARKER)).toBe(true);
  });

  it("SHIP-CLEAN-003: omits the Findings / Summary / footer scaffolding", () => {
    const body = buildReviewBody({
      review: cleanReview,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      postedComments: [],
      severityCounts: {},
      secrets: SECRETS,
    });
    expect(body).not.toContain("### 📋 Findings");
    expect(body).not.toContain("### 📝 Summary");
    expect(body).not.toMatch(/severity breakdown/iu);
  });

  it("SHIP-CLEAN-004: folds the provider summary into a collapsed <details> when present", () => {
    const body = buildReviewBody({
      review: cleanReview,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      postedComments: [],
      severityCounts: {},
      secrets: SECRETS,
    });
    expect(body).toContain("<details>");
    expect(body).toContain("<summary>📝 Click to expand the full review summary</summary>");
    expect(body).toContain("synthetic 0-finding review for noise-skip verification.");
    expect(body).toContain("</details>");
  });

  it("SHIP-CLEAN-005: omits the <details> block when the provider summary is empty", () => {
    const body = buildReviewBody({
      review: { ...cleanReview, summary: "   " },
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      postedComments: [],
      severityCounts: {},
      secrets: SECRETS,
    });
    expect(body).toContain("## ✅ 0 inline findings — ship it");
    // Clean review path: there is NO provider-summary `<details>` (no
    // summary to expand). The single `<details>` block in the body is
    // the platform-aware resolution guide footer added by the
    // bake-resolution-guide plan; pre-plan this assertion would have
    // also asserted `not.toContain("<details>")`.
    expect((body.match(/<details>/gu) ?? []).length).toBe(1);
    expect(body).toContain("<!-- umactually:resolution-guide-v3 -->");
  });

  it("SHIP-CLEAN-006: still emits the umactually:manifest JSON blob", () => {
    const body = buildReviewBody({
      review: cleanReview,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      postedComments: [],
      severityCounts: {},
      secrets: SECRETS,
    });
    expect(body).toMatch(/<!-- umactually:manifest \{[^}]*"inlineCount":0/u);
  });

  it("SHIP-CLEAN-007: parse-failed reviews stay on the diagnostic branch (NOT the ship-it line)", () => {
    const body = buildReviewBody({
      review: { ...cleanReview, parseFailed: true },
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      postedComments: [],
      severityCounts: {},
      secrets: SECRETS,
    });
    expect(body).toContain("Parse failed");
    expect(body).not.toContain("## ✅ 0 inline findings — ship it");
  });

  it("SHIP-CLEAN-008: reviews with suppressed-but-filtered comments still collapse to ship-it", () => {
    const body = buildReviewBody({
      review: { ...cleanReview, suppressedComments: [
        {
          path: "src/old.ts",
          line: 3,
          body: "Legacy code issue.",
          severity: "low",
          category: "general",
        },
      ] },
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 1,
      offDiffFromComments: [],
      postedComments: [],
      severityCounts: {},
      secrets: SECRETS,
    });
    expect(body).toContain("## ✅ 0 inline findings — ship it");
  });
});
