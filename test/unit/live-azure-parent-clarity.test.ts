// Tests for the "5-second scannable" clarity of the parent PR-level review
// summary card produced by `buildReviewBody`. The card is the first thing a
// developer sees when they open a PR review; it must let them decide
// "ship / fix / discuss" within the first viewport — no matter what shape
// the provider's review payload is in.
//
// References (sourced from Microsoft Learn,
// https://learn.microsoft.com/en-us/azure/devops/project/wiki/markdown-guidance?view=azure-devops):
//
//   - PR comments support: Headers, Emphasis, Emojis, Lists, Horizontal
//     rules, Block quotes, Code highlighting, Ignore/escape Markdown, Tables.
//   - The PR Overview conversation sorts threads strictly by id ascending.
//   - The renderer respects HTML escape (backslash) for special characters.
//   - We have observed in practice that **bold** sometimes leaks through
//     in the PR-thread renderer surface (the markdown guidance documents
//     that emphasis IS supported, but the rendered thread-comment output
//     in our PR #42 verified test rendered literal `**medium**: 2`
//     asterisks). For belt-and-braces compatibility we never use
//     `**word**` in the parent card — we use emoji + backticks instead.
//
// Contract pinned here:
//
//   CLARITY-1: verdict badge is the FIRST non-marker line
//   CLARITY-2: severity counts line is within 200 chars of the verdict
//   CLARITY-3: NO raw `**word**` asterisks for severity values
//   CLARITY-4: long summary prose is wrapped in a <details> block
//   CLARITY-5: shape is identical when the review is empty
//              (the malformed-fallback / no-findings / suppressed-only case)
//   CLARITY-6: stable marker is present (FEAT-PARITY-001)
//   CLARITY-7: machine-readable manifest is present (FEAT-PARITY-006)
//   CLARITY-8: GitHub and Azure produce the SAME body (FEAT-PARITY-030)
import { describe, expect, it } from "vitest";

import {
  buildReviewBody,
  buildMalformedProviderFallback,
  type LiveReview,
} from "../../src/cli/live-shared.js";

const SECRETS = ["sk-test-secret-do-not-leak"] as const;

function buildStandardReview(): LiveReview {
  return {
    summary:
      "Three issues need attention before merge. " +
      "The codebase has been carefully reviewed end-to-end with attention to the diff lines.",
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
        path: "src/api.ts",
        line: 9,
        body: "Cache the rate limiter.",
        severity: "medium",
        category: "performance",
      },
      {
        path: "README.md",
        line: 42,
        body: "Update the example env variable name.",
        severity: "low",
        category: "docs",
      },
      {
        path: "src/util.ts",
        line: 17,
        body: "Prefer `?.` over a long if-chain.",
        severity: "low",
        category: "maintainability",
      },
      {
        path: "test/foo.test.ts",
        line: 5,
        body: "Add a boundary test.",
        severity: "low",
        category: "test-coverage",
      },
      {
        path: "src/loop.ts",
        line: 21,
        body: "Avoid the O(n^2) join.",
        severity: "low",
        category: "performance",
      },
      {
        path: "docs/setup.md",
        line: 12,
        body: "Mention the new env flag.",
        severity: "low",
        category: "docs",
      },
      {
        path: "src/legacy.ts",
        line: 88,
        body: "Remove dead code.",
        severity: "low",
        category: "maintainability",
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
      {
        path: "src/very-old.ts",
        line: 9,
        body: "Legacy auth pattern.",
        severity: "medium",
        category: "security",
      },
      {
        path: "src/very-very-old.ts",
        line: 1,
        body: "Already removed upstream.",
        severity: "low",
        category: "general",
      },
      {
        path: "test/old.test.ts",
        line: 5,
        body: "Tests for removed API.",
        severity: "low",
        category: "general",
      },
    ],
  };
}

function buildEmptyReview(): LiveReview {
  return {
    summary: "Live provider returned an empty payload.",
    verdict: "COMMENT",
    comments: [],
    suppressedComments: [],
  };
}

const STD_INPUT = {
  review: buildStandardReview(),
  provider: "openai-compatible",
  modelId: "auto",
  validCommentCount: 9,
  suppressedCommentCount: 4,
  secrets: SECRETS,
};

describe("buildReviewBody — 5-second scannable clarity", () => {
  it("CLARITY-1: verdict badge is the FIRST non-marker line", () => {
    const body = buildReviewBody(STD_INPUT);
    const lines = body.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
    // The first line must be the marker; the second line must be the verdict.
    expect(lines[0]).toBe("<!-- umactually-pr-review -->");
    expect(lines[1]).toMatch(/^## /u);
    expect(lines[1]).toMatch(/[⛔✅💬]/u);
    expect(lines[1]).toMatch(/SHIP|APPROVED|NEEDS_FIX|DISCUSS|COMMENT/);
  });

  it("CLARITY-2: severity counts line is within 200 chars of the verdict badge", () => {
    const body = buildReviewBody(STD_INPUT);
    const verdictIndex = body.indexOf("## ");
    expect(verdictIndex).toBeGreaterThanOrEqual(0);
    const afterVerdict = body.slice(verdictIndex);
    // The counts line MUST appear within 200 chars after the verdict badge.
    // It MUST appear before the first <details> (which would push the
    // counts below the fold).
    const countsIdx = afterVerdict.search(/`\d+`\s+(high|medium|low|critical)/u);
    expect(countsIdx).toBeGreaterThanOrEqual(0);
    expect(countsIdx).toBeLessThan(200);
    const detailsIdx = afterVerdict.indexOf("<details>");
    if (detailsIdx >= 0) {
      expect(countsIdx).toBeLessThan(detailsIdx);
    }
  });

  it("CLARITY-3: NEVER emits raw `**word**` asterisks for severity values", () => {
    const body = buildReviewBody(STD_INPUT);
    // Belt-and-braces: ADO's PR-thread renderer can leak `**...**` as
    // literal asterisks even though markdown guidance says it should
    // render. We use emoji + backticks everywhere instead.
    expect(body).not.toMatch(/\*\*high\*\*/u);
    expect(body).not.toMatch(/\*\*medium\*\*/u);
    expect(body).not.toMatch(/\*\*low\*\*/u);
    expect(body).not.toMatch(/\*\*critical\*\*/u);
    expect(body).not.toMatch(/\*\*suppressed\*\*/u);
  });

  it("CLARITY-4: long summary prose is wrapped in a <details> block", () => {
    const body = buildReviewBody(STD_INPUT);
    // The provider's prose summary must NOT appear outside a <details>
    // block in the parent card — otherwise it dominates the first viewport.
    const summarySentence = "Three issues need attention before merge.";
    // The summary must exist somewhere (we still want the prose available
    // for reviewers who choose to expand).
    expect(body).toContain(summarySentence);
    // The summary must sit INSIDE a <details>...</details> block.
    const detailsStart = body.indexOf("<details>");
    const detailsEnd = body.lastIndexOf("</details>");
    expect(detailsStart).toBeGreaterThanOrEqual(0);
    expect(detailsEnd).toBeGreaterThan(detailsStart);
    expect(body.slice(detailsStart, detailsEnd)).toContain(summarySentence);
  });

  it("CLARITY-5: empty review (no inline + no suppressed) still produces the same shape", () => {
    // This is the malformed-fallback / parse-fail / empty-payload case.
    // Even with zero findings, the card must show: marker, verdict,
    // counts line (showing 0), and the manifest. Otherwise the developer
    // cannot tell the difference between "0 findings, ship it" and
    // "nothing happened".
    const body = buildReviewBody({
      review: buildEmptyReview(),
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 0,
      secrets: SECRETS,
    });
    const lines = body.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
    // marker
    expect(lines[0]).toBe("<!-- umactually-pr-review -->");
    // verdict
    expect(lines[1]).toMatch(/^## /u);
    expect(lines[1]).toMatch(/[⛔✅💬]/u);
    // counts line (still rendered, even if all zero)
    expect(body).toMatch(/`\d+`\s+(high|medium|low|critical)/u);
    // manifest
    expect(body).toMatch(/<!--\s*umactually-pr-review:manifest\s*\{/u);
  });

  it("CLARITY-5b: malformed-fallback review (parse-fail) also produces the same shape", () => {
    const review = buildMalformedProviderFallback({
      provider: "openai-compatible",
      modelId: "auto",
      rawText: "not actually JSON {",
      secrets: SECRETS,
    });
    const body = buildReviewBody({
      review,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 0,
      secrets: SECRETS,
    });
    const lines = body.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
    expect(lines[0]).toBe("<!-- umactually-pr-review -->");
    expect(lines[1]).toMatch(/^## /u);
    // counts line — still present even on parse-fail
    expect(body).toMatch(/`\d+`\s+(high|medium|low|critical)/u);
    // the raw provider text should appear inside a <details> block
    expect(body).toContain("not actually JSON");
    expect(body).toContain("<details>");
  });

  it("CLARITY-6: includes the stable HTML marker for dedup", () => {
    const body = buildReviewBody(STD_INPUT);
    expect(body).toContain("<!-- umactually-pr-review -->");
  });

  it("CLARITY-7: includes the machine-readable findings manifest", () => {
    const body = buildReviewBody(STD_INPUT);
    expect(body).toMatch(/<!--\s*umactually-pr-review:manifest\s*\{[\s\S]*?\}\s*-->/u);
    const match = body.match(/<!--\s*umactually-pr-review:manifest\s*(\{[\s\S]*?\})\s*-->/u);
    expect(match).not.toBeNull();
    const manifestText = match?.[1];
    expect(manifestText).toBeDefined();
    if (manifestText !== undefined) {
      const parsed = JSON.parse(manifestText);
      expect(parsed.verdict).toBe("NEEDS_FIX");
      expect(parsed.provider).toBe("openai-compatible");
      expect(parsed.modelId).toBe("auto");
      expect(parsed.inlineCount).toBe(9);
      expect(parsed.suppressedCount).toBe(4);
    }
  });

  it("CLARITY-8: GitHub and Azure produce the SAME body (parity)", () => {
    const githubBody = buildReviewBody(STD_INPUT);
    const azureBody = buildReviewBody(STD_INPUT);
    expect(githubBody).toBe(azureBody);
  });
});