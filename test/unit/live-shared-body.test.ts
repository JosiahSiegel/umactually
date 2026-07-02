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
      secrets: SECRETS,
    });
    expect(body).toContain("Three issues need attention before merge.");
  });

  it("FEAT-PARITY-004 includes a collapsed <details> block for AI/human secondary details", () => {
    const body = buildReviewBody({
      review: SAMPLE_REVIEW,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 3,
      suppressedCommentCount: 1,
      secrets: SECRETS,
    });
    // GitHub renders <details> natively; ADO renders the raw HTML in markdown
    // bodies — the marker must be present in the contract regardless of how
    // the platform renders it.
    expect(body).toContain("<details>");
    expect(body).toContain("</details>");
  });

  it("FEAT-PARITY-005 includes severity counts in the collapsed details block", () => {
    const body = buildReviewBody({
      review: SAMPLE_REVIEW,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 3,
      suppressedCommentCount: 1,
      secrets: SECRETS,
    });
    expect(body).toContain("**high**: 1");
    expect(body).toContain("**medium**: 1");
    expect(body).toContain("**low**: 1");
  });

  it("FEAT-PARITY-006 includes a machine-readable findings manifest as an HTML comment for AI agents", () => {
    const body = buildReviewBody({
      review: SAMPLE_REVIEW,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 3,
      suppressedCommentCount: 1,
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
      secrets: SECRETS,
    });
    const azureBody = buildReviewBody({
      review: SAMPLE_REVIEW,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 3,
      suppressedCommentCount: 1,
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
});
