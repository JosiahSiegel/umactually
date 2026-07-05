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
  countSuppressedComments,
  type LiveReview,
  type LiveReviewComment,
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
  offDiffFromComments: [],
  severityCounts: { critical: 0, high: 1, medium: 2, low: 6 },
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

  it("CLARITY-2: severity tally is present in the body (after the findings table)", () => {
    // Cutover note: the old contract required the severity tally to be
    // within 200 chars of the verdict so it stayed above the fold. The
    // severity-table layout puts the findings TABLE between verdict and
    // tally — the table IS the primary scannable element. The tally is
    // still emitted, just below the table. This test pins that contract.
    const body = buildReviewBody(STD_INPUT);
    const verdictIndex = body.indexOf("## ");
    expect(verdictIndex).toBeGreaterThanOrEqual(0);
    const afterVerdict = body.slice(verdictIndex);
    // The tally MUST appear somewhere after the verdict.
    const countsIdx = afterVerdict.search(/🏷️\s+`\d+`\s+critical/u);
    expect(countsIdx).toBeGreaterThanOrEqual(0);
    // The findings table sits between verdict and tally; tally is
    // somewhere later in the body but still before the footer.
    const footerIdx = afterVerdict.indexOf("🤖");
    expect(countsIdx).toBeLessThan(footerIdx);
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

  it("CLARITY-4: summary prose appears in the body as a Summary section (no <details> wrapper)", () => {
    // Cutover note: the old contract required long summary prose inside
    // <details> blocks. The severity-table layout surfaces the summary
    // inline under `### 📝 Summary` — reviewers see the prose without
    // having to click, and the findings table is the scannable anchor.
    const body = buildReviewBody(STD_INPUT);
    const summarySentence = "Three issues need attention before merge.";
    // The summary must still be present in the body.
    expect(body).toContain(summarySentence);
    // And it must live under a Summary heading.
    expect(body).toMatch(/###\s+📝\s+Summary/u);
    // No <details> wrappers at all in the body — the severity-table
    // layout deliberately renders everything inline.
    expect(body).not.toContain("<details>");
    expect(body).not.toContain("</details>");
  });

  it("CLARITY-5: empty review (no inline + no suppressed) still produces the same shape", () => {
    // Cutover note: the severity-table layout ALWAYS shows the findings
    // table even on clean reviews (with a single `_No findings to
    // address_` row). The pipeline summary is NOT emitted in the body
    // — that data lives in the hidden manifest. The card shape remains
    // marker + verdict + findings table + summary + footer + manifest.
    const body = buildReviewBody({
      review: buildEmptyReview(),
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 0,
      offDiffFromComments: [],

      severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
      secrets: SECRETS,
    });
    const lines = body.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
    // marker
    expect(lines[0]).toBe("<!-- umactually-pr-review -->");
    // verdict
    expect(lines[1]).toMatch(/^## /u);
    expect(lines[1]).toMatch(/[⛔✅💬]/u);
    // CLARITY-14c: zero-tally line is hidden when there are no findings.
    expect(body).not.toMatch(/🏷️/u);
    // Findings table is still present with the "no findings" placeholder row.
    expect(body).toMatch(/No findings to address/u);
    // Pipeline summary NOT in the body (it moved into the manifest).
    expect(body).not.toMatch(/📊\s+\d+\s+findings\s+→/u);
    // manifest still emitted
    expect(body).toMatch(/<!--\s*umactually-pr-review:manifest\s*\{/u);
  });

  it("CLARITY-5b: malformed-fallback review (parse-fail) also produces the same shape", () => {
    // Cutover note: the severity-table layout does not use <details>
    // for the parse-fail diagnostic block. The raw provider text from
    // the malformed fallback flows through the Summary section inline.
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
      offDiffFromComments: [],

      severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
      secrets: SECRETS,
    });
    const lines = body.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
    expect(lines[0]).toBe("<!-- umactually-pr-review -->");
    expect(lines[1]).toMatch(/^## /u);
    // CLARITY-14c: zero-tally line is hidden when there are no findings
    // (parse-fail reviews have zero findings by definition).
    expect(body).not.toMatch(/🏷️/u);
    // The raw provider text must still surface somewhere for diagnostics.
    expect(body).toContain("not actually JSON");
    // Manifest still present so AI agents know about the parse-fail.
    expect(body).toMatch(/<!--\s*umactually-pr-review:manifest[\s\S]*parseFailed/u);
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

  // CLARITY-13: The "Suppressed: N off-diff" row count and the
  // "🔕 Suppressed (off-diff, N)" details block must reconcile. Today
  // `countSuppressedComments` adds `review.suppressedComments` PLUS
  // off-diff entries from `review.comments`, but `suppressedBlock`
  // only renders `review.suppressedComments`. The row says "4 off-diff"
  // but the details block only lists 2 — confusing. This test pins the
  // fix: pass `offDiffFromComments` through `buildReviewBody` so the
  // details block lists every suppressed finding the row is counting.
  it("CLARITY-13: off-diff findings are reconciled in the manifest (not as a body block)", () => {
    // Cutover note: the severity-table layout does not render an
    // off-diff details block. The off-diff count is surfaced through
    // the hidden manifest's suppressedCount field — AI agents can
    // query it; humans don't see a separate block in the card. The
    // findings table shows ONLY the posted set.
    const onDiffComment: LiveReviewComment = {
      path: "src/changed.ts",
      line: 2,
      body: "This one is on the diff.",
      severity: "high",
      category: "security",
    };
    const offDiffCommentA: LiveReviewComment = {
      path: "src/changed.ts",
      line: 99,
      body: "This changed-file finding is off the diff.",
      severity: "medium",
      category: "maintainability",
    };
    const offDiffCommentB: LiveReviewComment = {
      path: "src/deleted.ts",
      line: 4,
      body: "This missing-file finding is off the diff.",
      severity: "low",
      category: "general",
    };
    const modelSuppressedA: LiveReviewComment = {
      path: "src/model-suppressed-a.ts",
      line: 7,
      body: "The model already marked this as suppressed.",
      severity: "low",
      category: "general",
    };
    const modelSuppressedB: LiveReviewComment = {
      path: "src/model-suppressed-b.ts",
      line: 8,
      body: "The model also marked this as suppressed.",
      severity: "medium",
      category: "security",
    };
    const review: LiveReview = {
      summary: "Suppressed findings must reconcile.",
      verdict: "NEEDS_FIX",
      comments: [onDiffComment, offDiffCommentA, offDiffCommentB],
      suppressedComments: [modelSuppressedA, modelSuppressedB],
    };
    const diffText = [
      "diff --git a/src/changed.ts b/src/changed.ts",
      "--- a/src/changed.ts",
      "+++ b/src/changed.ts",
      "@@ -1,2 +1,3 @@",
      " export const existing = 1;",
      "+export const added = 2;",
      " export const trailing = 3;",
      "",
    ].join("\n");
    const offDiffFromComments = [offDiffCommentA, offDiffCommentB] as const;
    const expectedSuppressedCount = countSuppressedComments(review, diffText);

    const body = buildReviewBody({
      review,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 1,
      suppressedCommentCount: expectedSuppressedCount,
      offDiffFromComments,
      severityCounts: { critical: 0, high: 1, medium: 0, low: 0 },
      secrets: SECRETS,
      // The new layout needs the actual posted set so it doesn't
      // render off-diff entries as if they had been posted inline.
      postedComments: [onDiffComment],
    });

    // Ground-truth: there are 4 suppressed (2 model + 2 off-diff).
    expect(expectedSuppressedCount).toBe(4);
    // Manifest captures the suppressed count so AI agents can reconcile.
    const manifestMatch = body.match(/<!--\s*umactually-pr-review:manifest\s+(\{[\s\S]*?\})\s*-->/u);
    expect(manifestMatch).not.toBeNull();
    const manifest = JSON.parse(manifestMatch?.[1] ?? "{}");
    expect(manifest.suppressedCount).toBe(4);
    expect(manifest.inlineCount).toBe(1);
    // Body does NOT show the off-diff callout (it lived in the legacy
    // off-diff details block; the new layout moves that info to the
    // manifest).
    expect(body).not.toMatch(/📍\s+Off-diff/u);
    // Body shows the posted set in the findings table.
    expect(body).toContain("`src/changed.ts`:2");
    expect(body).not.toContain("`src/changed.ts`:99");
    expect(body).not.toContain("`src/deleted.ts`:4");
    expect(body).not.toContain("`src/model-suppressed-a.ts`:7");
  });

  // CLARITY-14: Actionable-only card. The current review body is over-busy
  // with counters developers don't act on (Considered, Suppressed row,
  // zero-tally). Redesign so the card shows:
  //   - Verdict badge (always)
  //   - Inline count, when > 0 (severity tally visible only when findings > 0)
  //   - Filtered/top concerns <details> (only when there is something to show)
  //   - Off-diff inline note (only when suppressed > 0)
  //   - Suppressed details (only when suppressed > 0)
  //   - Summary <details>
  //   - Footer with inline count
  //   - Manifest for AI agents (always)
  // The "Considered: 18 from model" and "Suppressed: N off-diff" rows are
  // removed — they don't help the reviewer decide what to do. The footer
  // carries the inline count which is the only counter a developer acts on.
  it("CLARITY-14a: no Posted/Considered/Suppressed row in any case", () => {
    const body = buildReviewBody(STD_INPUT);
    expect(body).not.toMatch(/\*\*Posted:\*\*/u);
    expect(body).not.toMatch(/\*\*Considered:\*\*/u);
    expect(body).not.toMatch(/\*\*Suppressed:\*\*/u);
  });

  it("CLARITY-14b: clean review (0 posted + 0 suppressed) shows verdict + empty findings table + summary + footer", () => {
    // Cutover note: the severity-table layout always renders the findings
    // table — even on clean reviews, the table appears with a single
    // `_No findings to address_` row. Pipeline summary moved to manifest.
    const body = buildReviewBody({
      review: buildEmptyReview(),
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 0,
      offDiffFromComments: [],

      severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
      secrets: SECRETS,
    });
    // No zero-tally line.
    expect(body).not.toMatch(/🏷️/u);
    // No off-diff / posted-preview / filtered-preview blocks.
    expect(body).not.toMatch(/📍\s+Off-diff/u);
    expect(body).not.toMatch(/🧹\s+Filtered preview/u);
    expect(body).not.toMatch(/📋\s+Posted preview/u);
    // No <details> wrappers anywhere.
    expect(body).not.toContain("<details>");
    // No inline pipeline summary in the body.
    expect(body).not.toMatch(/📊\s+\d+\s+findings\s+→/u);
    // Findings table still present with the empty-row placeholder.
    expect(body).toMatch(/No findings to address/u);
    // Verdict + summary + footer are still there.
    expect(body).toContain("<!-- umactually-pr-review -->");
    expect(body).toMatch(/^## /mu);
    expect(body).toMatch(/[⛔✅💬]/u);
    expect(body).toMatch(/###\s+📝\s+Summary/u);
    expect(body).toMatch(/🤖\s+Generated by/u);
    // Footer reflects inline count.
    expect(body).toMatch(/0\s+inline/u);
  });

  it("CLARITY-14c: severity tally hidden when there are zero findings (regardless of inline count)", () => {
    // Cutover note: severity tally is hidden when no findings have
    // any severity. The off-diff details block is GONE in the
    // severity-table layout — off-diff info lives in the manifest only.
    const review: LiveReview = {
      summary: "Findings were all off-diff.",
      verdict: "NEEDS_FIX",
      comments: [],
      suppressedComments: [
        { path: "src/old.ts", line: 3, body: "Legacy.", severity: "high", category: "general" },
        { path: "src/older.ts", line: 1, body: "Older.", severity: "medium", category: "general" },
      ],
    };
    const body = buildReviewBody({
      review,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 2,
      offDiffFromComments: [],

      severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
      secrets: SECRETS,
    });
    expect(body).not.toMatch(/🏷️/u);
    // No off-diff details block in the new layout.
    expect(body).not.toMatch(/📍\s+Off-diff/u);
    // Findings table still present, showing the empty placeholder row.
    expect(body).toMatch(/No findings to address/u);
    // Manifest still carries the suppressed count for AI agents.
    const manifestMatch = body.match(/<!--\s*umactually-pr-review:manifest\s+(\{[\s\S]*?\})\s*-->/u);
    expect(manifestMatch).not.toBeNull();
    const manifest = JSON.parse(manifestMatch?.[1] ?? "{}");
    expect(manifest.suppressedCount).toBe(2);
  });

  it("CLARITY-19d: posted findings surface inline in the table; off-diff reconciled via manifest", () => {
    // Cutover note: the severity-table layout shows ONLY the posted
    // findings in the body table. Off-diff and pipeline counts live
    // in the hidden manifest. The body's severity tally is computed
    // from the posted set (same source as the manifest's tally).
    const review: LiveReview = {
      summary: "Two issues found, two off-diff noise.",
      verdict: "NEEDS_FIX",
      comments: [
        { path: "src/auth.ts", line: 12, body: "Use bcrypt.", severity: "high", category: "security" },
        { path: "src/db.ts", line: 7, body: "Add timeout.", severity: "medium", category: "maintainability" },
        { path: "src/api.ts", line: 22, body: "Add retry.", severity: "low", category: "maintainability" },
      ],
      suppressedComments: [
        { path: "src/old.ts", line: 3, body: "Legacy.", severity: "low", category: "general" },
        { path: "src/older.ts", line: 1, body: "Older.", severity: "medium", category: "general" },
      ],
    };
    const body = buildReviewBody({
      review,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 3,
      suppressedCommentCount: 2,
      offDiffFromComments: [],
      severityCounts: { high: 1, medium: 1, low: 1 },
      secrets: SECRETS,
      postedComments: review.comments,
    });
    // Severity tally still visible (3 findings survived filtering).
    expect(body).toMatch(/🏷️\s+`0`\s+critical\s+·\s+`1`\s+high\s+·\s+`1`\s+medium\s+·\s+`1`\s+low/u);
    // Body shows the posted findings inline in the table.
    expect(body).toContain("`src/auth.ts`:12");
    expect(body).toContain("`src/db.ts`:7");
    expect(body).toContain("`src/api.ts`:22");
    // Off-diff items do NOT appear in the body.
    expect(body).not.toContain("`src/old.ts`:3");
    expect(body).not.toContain("`src/older.ts`:1");
    // Manifest captures the off-diff count + per-bucket severities.
    const manifestMatch = body.match(/<!--\s*umactually-pr-review:manifest\s+(\{[\s\S]*?\})\s*-->/u);
    expect(manifestMatch).not.toBeNull();
    const manifest = JSON.parse(manifestMatch?.[1] ?? "{}");
    expect(manifest.inlineCount).toBe(3);
    expect(manifest.suppressedCount).toBe(2);
    expect(manifest.severityCounts).toEqual({ high: 1, medium: 1, low: 1 });
    // No legacy callouts anywhere.
    expect(body).not.toMatch(/🔕/u);
    expect(body).not.toMatch(/Top concerns/u);
    expect(body).not.toMatch(/Posted preview/u);
    expect(body).not.toMatch(/Filtered preview/u);
  });

  it("CLARITY-14e: footer inline count is terse and matches validCommentCount", () => {
    const body = buildReviewBody(STD_INPUT);
    // Footer is "X inline" (terse) — NOT "X inline thread(s) posted".
    expect(body).toMatch(/🤖\s+Generated by\s+`auto`\s+via\s+`openai-compatible`\s+·\s+9\s+inline/u);
    // And does NOT contain the old verbose form.
    expect(body).not.toMatch(/inline\s+thread\(s\)\s+posted/u);
  });

  it("CLARITY-14f: verdict downgrades to DISCUSS when nothing is actionable", () => {
    // When validCommentCount === 0 AND suppressedCommentCount === 0,
    // the model's NEEDS_FIX verdict is technically correct but
    // misleading — there is NOTHING for the developer to fix. The
    // card must surface this with a DISCUSS verdict rather than
    // pretending a NEEDS_FIX action is required.
    const review: LiveReview = {
      summary: "I found nothing actionable.",
      verdict: "NEEDS_FIX", // model said NEEDS_FIX
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
    expect(body).toMatch(/💬\s+DISCUSS/u);
    expect(body).not.toMatch(/⛔\s+NEEDS_FIX/u);
  });

  it("CLARITY-14g: filtered findings surface inline in the table when nothing posted (no 'Filtered preview' block)", () => {
    // Cutover note: the severity-table layout does NOT use a "Filtered
    // preview" header. When 0 findings posted but the model returned
    // candidates, the findings table still shows them inline as the
    // posted set (callers pass the post-filter set as `postedComments`).
    const review: LiveReview = {
      summary: "All findings filtered.",
      verdict: "COMMENT",
      comments: [
        { path: "src/a.ts", line: 1, body: "A.", severity: "low", category: "general" },
        { path: "src/b.ts", line: 2, body: "B.", severity: "low", category: "general" },
        { path: "src/c.ts", line: 3, body: "C.", severity: "low", category: "general" },
      ],
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
    // No "from model" or "Filtered preview" anywhere — that vocabulary
    // is gone with the cutover.
    expect(body).not.toMatch(/from model/u);
    expect(body).not.toMatch(/🧹/u);
    expect(body).not.toMatch(/Filtered preview/u);
    // No <details> wrappers.
    expect(body).not.toContain("<details>");
  });

  // CLARITY-15: The severity tally (📊 N critical · ... · N low) and the
  // footer's inline count (`N inline`) MUST reconcile. The tally counts
  // findings that survived severity/cap/off-diff filtering — i.e. the
  // SAME set the footer reports. Before CLARITY-15 the tally reflected
  // the model's full output (e.g. "1 high · 3 medium · 6 low" = 10)
  // while the footer reflected the post-filter posted set (e.g.
  // "9 inline") — off by the number of findings filtered out. A
  // reviewer looking at the card should never have to do that math.
  //
  // The fix: `severityCounts` becomes a caller-provided parameter,
  // computed from the POSTED comments (the same set that produces
  // `validCommentCount`). Both the rendered tally and the manifest
  // use the same input, so they agree by construction.
  it("CLARITY-15a: severity tally total equals inline footer count", () => {
    // 12 model comments (1 high, 3 medium, 6 low, 2 info) → after
    // filters → 9 posted (caller passes the 9). Tally must sum to 9.
    const postedComments = [
      { path: "src/a.ts", line: 1, body: "high 1", severity: "high", category: "security" },
      { path: "src/b.ts", line: 1, body: "medium 1", severity: "medium", category: "general" },
      { path: "src/c.ts", line: 1, body: "medium 2", severity: "medium", category: "general" },
      { path: "src/d.ts", line: 1, body: "medium 3", severity: "medium", category: "general" },
      { path: "src/e.ts", line: 1, body: "low 1", severity: "low", category: "general" },
      { path: "src/f.ts", line: 1, body: "low 2", severity: "low", category: "general" },
      { path: "src/g.ts", line: 1, body: "low 3", severity: "low", category: "general" },
      { path: "src/h.ts", line: 1, body: "low 4", severity: "low", category: "general" },
      { path: "src/i.ts", line: 1, body: "low 5", severity: "low", category: "general" },
    ];
    const review: LiveReview = {
      summary: "9 findings will be posted; 3 filtered out.",
      verdict: "NEEDS_FIX",
      comments: [
        // Same 9 that posted ...
        ...postedComments,
        // ... plus 3 that did NOT post (filtered by severity/cap).
        { path: "src/j.ts", line: 1, body: "low (off-diff)", severity: "low", category: "general" },
        { path: "src/k.ts", line: 1, body: "low (info severity)", severity: "info", category: "general" },
        { path: "src/l.ts", line: 1, body: "info 2", severity: "info", category: "general" },
      ],
      suppressedComments: [],
    };
    const body = buildReviewBody({
      review,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: postedComments.length,
      suppressedCommentCount: 0,
      offDiffFromComments: [],

      severityCounts: { critical: 0, high: 1, medium: 3, low: 5 },
      secrets: SECRETS,
    });
    // Tally shows the post-filter distribution.
    // CLARITY-19: severity tally icon is now 🏷️ (📊 is the pipeline summary).
    expect(body).toMatch(/🏷️\s+`0`\s+critical\s+·\s+`1`\s+high\s+·\s+`3`\s+medium\s+·\s+`5`\s+low/u);
    // Footer matches the inline count.
    expect(body).toMatch(/9\s+inline/u);
    // Manifest's severityCounts matches the tally (1 high, 3 medium, 5 low — info excluded).
    const manifestMatch = body.match(/<!--\s*umactually-pr-review:manifest\s+(\{[\s\S]*?\})\s*-->/u);
    expect(manifestMatch).not.toBeNull();
    const manifest = JSON.parse(manifestMatch?.[1] ?? "{}");
    expect(manifest.severityCounts).toEqual({ critical: 0, high: 1, medium: 3, low: 5 });
    expect(manifest.inlineCount).toBe(9);
    // Sum check: tally totals MUST equal validCommentCount.
    expect(1 + 3 + 5).toBe(9);
  });

  it("CLARITY-15b: severity tally hidden when zero posted (CLARITY-14c still wins)", () => {
    // Cutover note: pipeline summary is NOT in the body anymore; the
    // tally is hidden when all counts are zero. The verdict still
    // downgrades to DISCUSS for the "nothing actionable" case.
    const review: LiveReview = {
      summary: "Model said NEEDS_FIX but nothing actionable.",
      verdict: "NEEDS_FIX",
      comments: [
        { path: "src/old.ts", line: 1, body: "low", severity: "low", category: "general" },
      ],
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
    // Tally hidden when all counts zero.
    expect(body).not.toMatch(/🏷️/u);
    // No pipeline summary in body.
    expect(body).not.toMatch(/📊\s+\d+\s+findings\s+→/u);
    // Verdict downgrades to DISCUSS per CLARITY-14f.
    expect(body).toMatch(/💬\s+DISCUSS/u);
  });

  // CLARITY-16: Top concerns preview header must surface the denominator
  // when the preview is truncated. Before CLARITY-16 the header read
  // "Top concerns (5)" — which is INDISTINGUISHABLE from "Top concerns (5)"
  // when there are 5 findings total. After CLARITY-16 the header reads
  // "Top concerns (5 of 10 shown)" when truncated, and stays "Top
  // concerns (N)" (no denominator) when all findings fit.
  //
  // Why this matters: with the CLARITY-15 fix the tally already reconciles
  // with the inline footer, so a reader sees "📊 4 medium · 6 low" then
  // "Top concerns (5)" and reasonably asks "wait, is (5) the cap or the
  // total?". Surfacing the denominator kills that ambiguity in one glance.
  it("CLARITY-16a: every posted finding appears as a row in the table (no preview cap)", () => {
    // Cutover note: the old CLARITY-16a/16b/16c/16d suite capped the
    // preview at 5 with a `showing N of M` denominator. The severity-
    // table layout shows EVERY posted finding inline — no preview cap,
    // no truncation. The table IS the full list.
    const postedComments: LiveReviewComment[] = [
      { path: "src/a.ts", line: 1, body: "m1", severity: "medium", category: "general" },
      { path: "src/b.ts", line: 1, body: "m2", severity: "medium", category: "general" },
      { path: "src/c.ts", line: 1, body: "m3", severity: "medium", category: "general" },
      { path: "src/d.ts", line: 1, body: "m4", severity: "medium", category: "general" },
      { path: "src/e.ts", line: 1, body: "l1", severity: "low", category: "general" },
      { path: "src/f.ts", line: 1, body: "l2", severity: "low", category: "general" },
      { path: "src/g.ts", line: 1, body: "l3", severity: "low", category: "general" },
      { path: "src/h.ts", line: 1, body: "l4", severity: "low", category: "general" },
      { path: "src/i.ts", line: 1, body: "l5", severity: "low", category: "general" },
      { path: "src/j.ts", line: 1, body: "l6", severity: "low", category: "general" },
    ];
    const review: LiveReview = {
      summary: "Ten findings will be posted.",
      verdict: "NEEDS_FIX",
      comments: postedComments,
      suppressedComments: [],
    };
    const body = buildReviewBody({
      review,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 10,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      severityCounts: { medium: 4, low: 6 },
      secrets: SECRETS,
    });
    // Every posted finding is in the table.
    for (const c of postedComments) {
      expect(body).toContain(c.path);
    }
    // The numbered column reflects every row.
    expect(body).toMatch(/\| 10 \|/u);
    // Tally still sums to 10 (CLARITY-15 invariant).
    expect(body).toMatch(/10\s+inline/u);
  });

  it("CLARITY-16b: small review shows all rows in the table (no 'Posted preview' header)", () => {
    const review: LiveReview = {
      summary: "Three findings.",
      verdict: "NEEDS_FIX",
      comments: [
        { path: "src/a.ts", line: 1, body: "h", severity: "high", category: "security" },
        { path: "src/b.ts", line: 1, body: "m", severity: "medium", category: "general" },
        { path: "src/c.ts", line: 1, body: "l", severity: "low", category: "general" },
      ],
      suppressedComments: [],
    };
    const body = buildReviewBody({
      review,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 3,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      severityCounts: { high: 1, medium: 1, low: 1 },
      secrets: SECRETS,
    });
    // No "Posted preview" header — the table is the list.
    expect(body).not.toMatch(/📋\s+Posted preview/u);
    // Every row appears.
    expect(body).toContain("`src/a.ts`:1");
    expect(body).toContain("`src/b.ts`:1");
    expect(body).toContain("`src/c.ts`:1");
  });

  it("CLARITY-15c: severity tally and manifest severityCounts use the SAME source", () => {
    // Pin the invariant: the tally line and the manifest's
    // severityCounts must be derived from the same set. Both are
    // caller-provided via `severityCounts`. If they ever drift, this
    // test catches it.
    const postedComments = [
      { path: "src/x.ts", line: 5, body: "high", severity: "high", category: "security" },
      { path: "src/y.ts", line: 6, body: "medium", severity: "medium", category: "general" },
    ];
    const review: LiveReview = {
      summary: "Two findings.",
      verdict: "NEEDS_FIX",
      comments: [
        ...postedComments,
        // Pretend the model also returned some filtered-out findings.
        { path: "src/z.ts", line: 1, body: "low filtered", severity: "low", category: "general" },
      ],
      suppressedComments: [],
    };
    const body = buildReviewBody({
      review,
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 2,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      severityCounts: { critical: 0, high: 1, medium: 1, low: 0 },
      secrets: SECRETS,
    });
    // Tally totals 2 (CLARITY-19: icon is 🏷️ now, 📊 is the pipeline summary).
    expect(body).toMatch(/🏷️\s+`0`\s+critical\s+·\s+`1`\s+high\s+·\s+`1`\s+medium\s+·\s+`0`\s+low/u);
    expect(body).toMatch(/2\s+inline/u);
    const manifestMatch = body.match(/<!--\s*umactually-pr-review:manifest\s+(\{[\s\S]*?\})\s*-->/u);
    const manifest = JSON.parse(manifestMatch?.[1] ?? "{}");
    expect(manifest.severityCounts).toEqual({ critical: 0, high: 1, medium: 1, low: 0 });
    expect(manifest.inlineCount).toBe(2);
  });
});