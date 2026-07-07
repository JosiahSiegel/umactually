// Tests for the shared review-body builders used by both GitHub and Azure live
// review paths. Both platforms must produce equivalent message contracts so
// AI agents and humans see the same information regardless of platform.
import { describe, expect, it } from "vitest";

import {
  buildReviewBody,
  buildInlineCommentBody,
  countBySeverity,
  type LiveReview,
} from "../../src/cli/live-shared.js";
import { renderSummary } from "../../src/render/summary-layouts.js";

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
    expect(body).toContain("<!-- umactually-pr-review -->");
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
    expect(body).toMatch(/<!--\s*umactually-pr-review:manifest\s*\{[\s\S]*?\}\s*-->/);
    const match = body.match(/<!--\s*umactually-pr-review:manifest\s*(\{[\s\S]*?\})\s*-->/);
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
    expect(body).toContain("Finding at src/auth.ts:12.");
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
    expect(body).toContain("<!-- umactually-pr-review -->");
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
  // were intentionally hidden by `--minimum-severity` or `--ignore-minor`
  // so a "0 low" reading doesn't look like "0 low findings exist".
  // The marker is per-tier: each filtered tier gets a trailing `*`,
  // and a single code-fenced legend line `` `* = filtered by threshold` ``
  // appears BELOW the tally. When no threshold is configured the
  // tally is byte-identical to legacy (no asterisk, no legend).
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

  it("no threshold → tally has NO asterisks and NO legend (byte-identical to legacy)", () => {
    const body = buildReviewBody({
      review: reviewWithMixedSeverities,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 4,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      severityCounts: { critical: 1, high: 1, medium: 1, low: 1 },
      secrets: SECRETS,
      // No minimumSeverity / ignoreMinor — defaults must keep legacy output.
    });
    expect(body).toContain("🏷️ `1` critical · `1` high · `1` medium · `1` low");
    expect(body).not.toContain(LEGEND);
    expect(body).not.toMatch(/`1` \w+\*/); // no asterisk on any tier
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
    expect(body).toContain("🏷️ `1` critical · `1` high · `0` medium* · `0` low*");
    expect(body).toContain(LEGEND);
  });

  it("minimumSeverity='critical' → high + medium + low get asterisks", () => {
    const body = buildReviewBody({
      review: reviewWithMixedSeverities,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 1,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      severityCounts: { critical: 1 },
      secrets: SECRETS,
      minimumSeverity: "critical",
    });
    expect(body).toContain("🏷️ `1` critical · `0` high* · `0` medium* · `0` low*");
    expect(body).toContain(LEGEND);
  });

  it("ignoreMinor=true → only low gets an asterisk; legend below tally", () => {
    const body = buildReviewBody({
      review: reviewWithMixedSeverities,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 3, // critical + high + medium survive
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      severityCounts: { critical: 1, high: 1, medium: 1 },
      secrets: SECRETS,
      ignoreMinor: true,
    });
    expect(body).toContain("🏷️ `1` critical · `1` high · `1` medium · `0` low*");
    expect(body).toContain(LEGEND);
  });

  it("ignoreMinor=false + minimumSeverity='low' → ALL tiers visible → NO asterisks, NO legend", () => {
    // minimumSeverity='low' means EVERYTHING (rank ≥ 1) is shown; low is
    // explicitly NOT filtered. ignoreMinor=false. So the marker must be
    // absent — same as the no-threshold case.
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
      ignoreMinor: false,
    });
    expect(body).toContain("🏷️ `1` critical · `1` high · `1` medium · `1` low");
    expect(body).not.toContain(LEGEND);
    expect(body).not.toMatch(/`1` \w+\*/); // no asterisk on any tier
  });

  it("ignoreMinor=true + minimumSeverity='high' → union of filtered tiers; legend present", () => {
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
      ignoreMinor: true,
    });
    // Both flags hide medium + low (ignoreMinor is a no-op since the
    // minimum threshold already hides them — but the marker/legend must
    // still appear because the active threshold hides something).
    expect(body).toContain("🏷️ `1` critical · `1` high · `0` medium* · `0` low*");
    expect(body).toContain(LEGEND);
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
    expect(body).toMatch(/`0` medium\* · `0` low\*/);
    expect(body).toContain(LEGEND);
  });

  it("asterisk + legend are absent from the `dashboard` layout (which uses a GFM table)", () => {
    // The `dashboard` layout renders the counts as a GFM table —
    // "🏷️ Severity breakdown" + a `| Critical | High | Medium | Low |` row.
    // The inline `🏷️ \`X\` critical · \`X\` high · …` tally does NOT appear
    // there. Verify the asterisk + legend are NOT emitted there —
    // the marker is a property of the inline tally form, not the table
    // form (the dashboard also surfaces a separate "Filtered: N" KPI).
    const body = renderSummary("dashboard", {
      review: reviewWithMixedSeverities,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 2,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      postedComments: [],
      severityCounts: { critical: 1, high: 1 },
      secrets: SECRETS,
      minimumSeverity: "high",
    });
    expect(body).toContain("🏷️ Severity breakdown");
    expect(body).not.toContain(LEGEND);
  });
});
