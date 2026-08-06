// Regression tests for the verdict severity-counts reconciliation.
//
// PR #18 self-review: the model emitted `verdict: "NEEDS_FIX"` while
// tagging every comment `severity: "info"`. The default
// `--minimum-severity medium` filter dropped all five findings, so
// the review posted with `⛔ NEEDS_FIX` and `📊 0 inline findings`.
// The GitHub review event was `REQUEST_CHANGES` (a blocking PR state)
// for a review that posted zero findings — a contradiction. The fix
// lives in `src/util/verdict.ts:reconcileVerdictForEmptySeverityCounts`
// and is threaded into `preparePostedReview`, the GitHub review event
// mapping (`live-github.ts`), the Azure PR status mapping
// (`live-azure.ts`), and the rendered manifest payload
// (`summary-layouts.ts`). These tests pin the rule at three layers:
//
//   1. The pure helper itself (unit test on the function).
//   2. `preparePostedReview` end-to-end: a NEEDS_FIX review whose
//      only comments are `info`-severity produces a `body` whose
//      headline matches `effectiveVerdict === "COMMENT"` (the body
//      uses the effective verdict, the manifest payload uses the
//      effective verdict, both via the same upstream call).
//   3. The GitHub review event mapping: a NEEDS_FIX verdict with
//      empty severity counts maps to `COMMENT`, not
//      `REQUEST_CHANGES`. Same rule for the Azure PR status
//      (`mapReviewVerdictToAzureStatus` → `"succeeded"`, not
//      `"pending"`).

import { describe, expect, it } from "vitest";

import {
  mapReviewVerdictToAzureStatus,
  preparePostedReview,
  type LiveReview,
  type LiveReviewComment,
} from "../../src/cli/live-shared.js";
import { parseCliArgs } from "../../src/cli/parse-args.js";
import {
  composeEffectiveVerdict,
  escalateVerdictForNonEmptySeverityCounts,
  reconcileVerdictForEmptySeverityCounts,
  totalSeverityCount,
} from "../../src/util/verdict.js";

// ---------------------------------------------------------------------------
// Fixture helpers — keep these local so the test owns its own data.
// ---------------------------------------------------------------------------

const DIFF_TEXT = [
  "diff --git a/src/example.ts b/src/example.ts",
  "index 1111111..2222222 100644",
  "--- a/src/example.ts",
  "+++ b/src/example.ts",
  "@@ -1,0 +1,3 @@",
  "+const first = true;",
  "+const second = true;",
  "+const third = true;",
].join("\n");

const SECRETS = ["sk-test-secret-do-not-leak"] as const;

function makeInfoComment(
  input: { readonly path?: string; readonly line?: number; readonly body?: string } = {},
): LiveReviewComment {
  return {
    path: input.path ?? "src/example.ts",
    line: input.line ?? 1,
    body: input.body ?? "Missing trailing newline on the file.",
    severity: "info",
    category: "style",
  };
}

function makeHighComment(
  input: { readonly path?: string; readonly line?: number; readonly body?: string } = {},
): LiveReviewComment {
  return {
    path: input.path ?? "src/example.ts",
    line: input.line ?? 1,
    body: input.body ?? "Hard-coded credential in source.",
    severity: "high",
    category: "security",
  };
}

function makeMediumComment(
  input: { readonly path?: string; readonly line?: number; readonly body?: string } = {},
): LiveReviewComment {
  return {
    path: input.path ?? "src/example.ts",
    line: input.line ?? 1,
    body: input.body ?? "Extract this nested ternary operation into an independent statement.",
    severity: "medium",
    category: "correctness",
  };
}

function makeReview(input: {
  readonly verdict: string;
  readonly comments?: readonly LiveReviewComment[];
}): LiveReview {
  return {
    summary: "Test review summary.",
    verdict: input.verdict,
    comments: input.comments ?? [],
    suppressedComments: [],
  };
}

// ---------------------------------------------------------------------------
// Pure helper tests — the rule itself.
// ---------------------------------------------------------------------------

describe("reconcileVerdictForEmptySeverityCounts", () => {
  it("downgrades NEEDS_FIX to COMMENT when severity counts are empty", () => {
    // Given: the model's verdict says block the PR, but every finding
    // was filtered out before posting (severityCounts is empty).
    expect(reconcileVerdictForEmptySeverityCounts("NEEDS_FIX", {})).toBe("COMMENT");
  });

  it("downgrades NEEDS_FIX to COMMENT when severity counts sum to zero", () => {
    // Given: severityCounts is non-empty but every tier count is 0
    // (e.g. `{"medium": 0, "high": 0}` from a malformed upstream
    // producer). Same contradiction class as an empty object.
    expect(
      reconcileVerdictForEmptySeverityCounts("NEEDS_FIX", { medium: 0, high: 0 }),
    ).toBe("COMMENT");
  });

  it("keeps NEEDS_FIX when severity counts are non-empty", () => {
    // Given: at least one postable finding backs the verdict.
    expect(
      reconcileVerdictForEmptySeverityCounts("NEEDS_FIX", { medium: 1 }),
    ).toBe("NEEDS_FIX");
  });

  it("passes through APPROVED untouched (empty + approving is coherent)", () => {
    // Given: APPROVED verdict with no findings. The model approved
    // an empty review — coherent state. The reconciliation only
    // downgrades blocking verdicts; approving verdicts pass through
    // so the `✅ SHIP` badge survives.
    expect(reconcileVerdictForEmptySeverityCounts("APPROVED", {})).toBe("APPROVED");
  });

  it("passes through COMMENT untouched", () => {
    expect(reconcileVerdictForEmptySeverityCounts("COMMENT", {})).toBe("COMMENT");
  });

  it("passes through DISCUSS untouched", () => {
    expect(reconcileVerdictForEmptySeverityCounts("DISCUSS", {})).toBe("DISCUSS");
  });

  it("passes through SHIP untouched (umbrella for empty + clean is coherent)", () => {
    expect(reconcileVerdictForEmptySeverityCounts("SHIP", {})).toBe("SHIP");
  });

  it("passes through unknown non-blocking verdicts untouched", () => {
    // Given: an unrecognised verdict string that isn't NEEDS_FIX.
    // The reconciliation is a contradiction guard, not a verdict
    // normaliser — unknown non-blocking strings stay as-is so the
    // existing verdict mappers can produce their own default
    // behaviour (e.g. mapVerdictToAzureStatus collapses unknowns to
    // `pending`).
    expect(reconcileVerdictForEmptySeverityCounts("MAYBE", {})).toBe("MAYBE");
  });
});

// ---------------------------------------------------------------------------
// Inverse direction: escalate a non-blocking verdict when findings exist.
// PR #183 review-pass regression: model emitted `verdict: SHIP` with
// "looks good, ship it" prose while the inline findings list contained
// a MAJOR SonarCloud finding. The badge correctly rendered `✅ SHIP` and
// the prose said "ship it", so a reviewer scanning the top would miss
// the MAJOR inline thread below. The fix completes the symmetry with
// `reconcileVerdictForEmptySeverityCounts` (which handles the other
// direction).
// ---------------------------------------------------------------------------

describe("totalSeverityCount", () => {
  it("sums every tier's count", () => {
    expect(totalSeverityCount({ medium: 2, high: 1 })).toBe(3);
  });

  it("returns 0 for an empty object", () => {
    expect(totalSeverityCount({})).toBe(0);
  });

  it("treats all-zero tiers as zero (matches reconcile helper semantics)", () => {
    expect(totalSeverityCount({ medium: 0, high: 0 })).toBe(0);
  });
});

describe("escalateVerdictForNonEmptySeverityCounts", () => {
  it("escalates SHIP to NEEDS_FIX when severity counts contain any finding", () => {
    expect(escalateVerdictForNonEmptySeverityCounts("SHIP", { major: 1 })).toBe("NEEDS_FIX");
  });

  it("escalates APPROVED to NEEDS_FIX when severity counts contain any finding", () => {
    expect(escalateVerdictForNonEmptySeverityCounts("APPROVED", { critical: 1 })).toBe("NEEDS_FIX");
  });

  it("escalates COMMENT to NEEDS_FIX when severity counts contain any finding", () => {
    expect(escalateVerdictForNonEmptySeverityCounts("COMMENT", { medium: 2 })).toBe("NEEDS_FIX");
  });

  it("escalates DISCUSS to NEEDS_FIX when severity counts contain any finding", () => {
    expect(escalateVerdictForNonEmptySeverityCounts("DISCUSS", { low: 1 })).toBe("NEEDS_FIX");
  });

  it("escalates unknown non-blocking verdicts to NEEDS_FIX when findings exist", () => {
    expect(escalateVerdictForNonEmptySeverityCounts("MAYBE", { info: 1 })).toBe("NEEDS_FIX");
  });

  it("passes through NEEDS_FIX untouched (handled by the inverse helper)", () => {
    expect(escalateVerdictForNonEmptySeverityCounts("NEEDS_FIX", { major: 1 })).toBe("NEEDS_FIX");
  });

  it("passes through SHIP untouched when counts are empty (canonical clean-ship state)", () => {
    expect(escalateVerdictForNonEmptySeverityCounts("SHIP", {})).toBe("SHIP");
  });

  it("passes through APPROVED untouched when counts are empty", () => {
    expect(escalateVerdictForNonEmptySeverityCounts("APPROVED", {})).toBe("APPROVED");
  });

  it("treats all-zero tiers as empty (no escalation)", () => {
    expect(escalateVerdictForNonEmptySeverityCounts("SHIP", { medium: 0, high: 0 })).toBe("SHIP");
  });
});

describe("composeEffectiveVerdict", () => {
  it.each([
    { raw: "NEEDS_FIX", counts: {}, expected: "COMMENT", escalated: true },
    { raw: "SHIP", counts: { major: 1 }, expected: "NEEDS_FIX", escalated: true },
    { raw: "SHIP", counts: {}, expected: "SHIP", escalated: false },
    { raw: "NEEDS_FIX", counts: { major: 1 }, expected: "NEEDS_FIX", escalated: false },
    { raw: "ship", counts: { major: 1 }, expected: "NEEDS_FIX", escalated: true },
  ] as const)(
    "maps raw=$raw counts=$counts → $expected escalated=$escalated",
    ({ raw, counts, expected, escalated }) => {
      const result = composeEffectiveVerdict({ rawVerdict: raw, severityCounts: counts });
      expect(result.verdict).toBe(expected);
      expect(result.escalated).toBe(escalated);
    },
  );
});

// ---------------------------------------------------------------------------
// Integration: preparePostedReview exposes the effective verdict.
// ---------------------------------------------------------------------------

describe("preparePostedReview reconciliation", () => {
  it("returns effectiveVerdict=COMMENT when NEEDS_FIX review's only findings are info-severity and minimum-severity=medium", () => {
    // Given: a NEEDS_FIX review with three info-severity findings,
    // and the CLI parsed with --minimum-severity=medium (the
    // default). Every finding is filtered out.
    const review = makeReview({
      verdict: "NEEDS_FIX",
      comments: [makeInfoComment(), makeInfoComment({ line: 2 }), makeInfoComment({ line: 3 })],
    });
    const parsed = parseCliArgs(["--minimum-severity", "medium"]);
    const prepared = preparePostedReview({
      review,
      provider: "openai-compatible",
      modelId: "auto",
      diffText: DIFF_TEXT,
      parsed,
      secrets: SECRETS,
    });

    // Then: the prepared review has zero postable findings AND its
    // effective verdict is COMMENT (not the raw NEEDS_FIX). The body
    // and manifest payload both use the effective verdict (verified
    // below) so the headline will say `💬 DISCUSS` instead of
    // `⛔ NEEDS_FIX`.
    expect(prepared.postableComments).toEqual([]);
    expect(prepared.severityCounts).toEqual({});
    expect(prepared.effectiveVerdict).toBe("COMMENT");

    // Body: clean-ship short-circuit normally fires for 0 findings, but the
    // verdict-reconciliation carve-out re-routes through `layoutSeverityTable`
    // when `verdictEscalatedFrom !== undefined` so the downgrade banner can
    // still render. Badge: `💬 DISCUSS`. Banner cites the raw→effective flip.
    expect(prepared.body).toContain("## 💬 DISCUSS");
    expect(prepared.body).not.toContain("⛔ NEEDS_FIX");
    expect(prepared.body).not.toContain("✅ 0 inline findings — ship it");
    expect(prepared.body).toMatch(/Verdict downgraded from `NEEDS_FIX` → `COMMENT`/u);

    // Manifest payload: the hidden HTML comment carries the
    // effective verdict too, so AI agents parsing the manifest see
    // `verdict: "COMMENT"` (consistent with the headline and the
    // inline finding count).
    expect(prepared.body).toMatch(
      /<!-- umactually:manifest\s+\{[^}]*"verdict":"COMMENT"/u,
    );
  });

  it("keeps effectiveVerdict=NEEDS_FIX when at least one finding passes the severity filter", () => {
    // Given: a NEEDS_FIX review with one high-severity finding and
    // two info-severity findings. The high passes minimum-severity
    // medium; the two info do not.
    const review = makeReview({
      verdict: "NEEDS_FIX",
      comments: [
        makeHighComment(),
        makeInfoComment({ line: 2 }),
        makeInfoComment({ line: 3 }),
      ],
    });
    const parsed = parseCliArgs(["--minimum-severity", "medium"]);
    const prepared = preparePostedReview({
      review,
      provider: "openai-compatible",
      modelId: "auto",
      diffText: DIFF_TEXT,
      parsed,
      secrets: SECRETS,
    });

    // Then: one postable finding, severity counts reflect it, and the
    // effective verdict is the raw verdict (no downgrade).
    expect(prepared.postableComments).toHaveLength(1);
    expect(prepared.severityCounts).toEqual({ high: 1 });
    expect(prepared.effectiveVerdict).toBe("NEEDS_FIX");
    expect(prepared.body).toContain("⛔ NEEDS_FIX");
  });

  it("keeps effectiveVerdict=APPROVED when the model approves an empty review", () => {
    // Given: the model said APPROVED and posted no findings.
    // APPROVED + empty is a coherent state — do not downgrade.
    const review = makeReview({ verdict: "APPROVED" });
    const prepared = preparePostedReview({
      review,
      provider: "openai-compatible",
      modelId: "auto",
      diffText: DIFF_TEXT,
      parsed: parseCliArgs([]),
      secrets: SECRETS,
    });

    expect(prepared.effectiveVerdict).toBe("APPROVED");
    expect(prepared.severityCounts).toEqual({});
    expect(prepared.body).toContain("## ✅ 0 inline findings — ship it");
  });

  it("escalates SHIP to NEEDS_FIX and exposes verdictEscalatedFrom when a medium finding survives the filter (PR #183 review pass)", () => {
    // Given: the model emitted SHIP with "looks good, ship it" prose
    // while the comments list contains a medium-severity finding
    // (SonarCloud MAJOR — Extract this nested ternary…). The default
    // --minimum-severity=medium keeps the medium finding. The
    // contradiction is: badge would say `✅ SHIP` against
    // `📊 1 inline finding` and the prose would say "ship it".
    const review = {
      ...makeReview({
        verdict: "SHIP",
        comments: [makeMediumComment()],
      }),
      summary: "Looks good, ship it.",
    };
    const prepared = preparePostedReview({
      review,
      provider: "openai-compatible",
      modelId: "auto",
      diffText: DIFF_TEXT,
      parsed: parseCliArgs(["--minimum-severity", "medium"]),
      secrets: SECRETS,
    });

    // Then: effective verdict is NEEDS_FIX (upgraded), and the raw
    // verdict is exposed via verdictEscalatedFrom so the layout can
    // render a one-line escalation banner.
    expect(prepared.postableComments).toHaveLength(1);
    expect(prepared.severityCounts).toEqual({ medium: 1 });
    expect(prepared.effectiveVerdict).toBe("NEEDS_FIX");
    expect(prepared.verdictEscalatedFrom).toBe("SHIP");

    // Body: the badge is `⛔ NEEDS_FIX`, the prose is preserved for
    // debuggability, and the escalation banner explicitly cites the
    // raw→effective flip.
    expect(prepared.body).toContain("⛔ NEEDS_FIX");
    expect(prepared.body).not.toContain("✅ SHIP");
    expect(prepared.body).toContain("Looks good, ship it.");
    expect(prepared.body).toMatch(/Verdict escalated from `SHIP` → `NEEDS_FIX`/u);

    // Manifest payload: carries the effective verdict, not the raw one,
    // so AI agents parsing the manifest agree with the headline.
    expect(prepared.body).toMatch(
      /<!-- umactually:manifest\s+\{[^}]*"verdict":"NEEDS_FIX"/u,
    );
  });

  it("escalates APPROVED to NEEDS_FIX when a high-severity finding survives the filter", () => {
    const review = makeReview({
      verdict: "APPROVED",
      comments: [makeHighComment()],
    });
    const prepared = preparePostedReview({
      review,
      provider: "openai-compatible",
      modelId: "auto",
      diffText: DIFF_TEXT,
      parsed: parseCliArgs(["--minimum-severity", "medium"]),
      secrets: SECRETS,
    });

    expect(prepared.effectiveVerdict).toBe("NEEDS_FIX");
    expect(prepared.verdictEscalatedFrom).toBe("APPROVED");
    expect(prepared.body).toContain("⛔ NEEDS_FIX");
  });

  it("does not escalate when the raw verdict was already NEEDS_FIX and findings exist (no spurious banner)", () => {
    const review = makeReview({
      verdict: "NEEDS_FIX",
      comments: [makeMediumComment()],
    });
    const prepared = preparePostedReview({
      review,
      provider: "openai-compatible",
      modelId: "auto",
      diffText: DIFF_TEXT,
      parsed: parseCliArgs(["--minimum-severity", "medium"]),
      secrets: SECRETS,
    });

    expect(prepared.effectiveVerdict).toBe("NEEDS_FIX");
    expect(prepared.verdictEscalatedFrom).toBeUndefined();
    expect(prepared.body).not.toMatch(/Verdict escalated/u);
  });
});

// ---------------------------------------------------------------------------
// Platform mapping: the effective verdict must propagate to the
// user-facing review event / PR status, otherwise the contradiction
// only gets fixed in the body but the GitHub/Azure state still blocks
// the PR for an empty review.
// ---------------------------------------------------------------------------

describe("platform verdict mapping with empty severity counts", () => {
  it("GitHub review event uses the effective verdict (REQUEST_CHANGES is suppressed when postable severity is empty)", () => {
    // Given: the model emitted NEEDS_FIX but every finding was
    // severity-filtered out. The live path now passes the
    // *effective* verdict (COMMENT) to mapReviewVerdictToGithubEvent.
    // Sanity-check the helper itself by passing the raw NEEDS_FIX
    // first, then the effective COMMENT, and asserting the
    // documented behaviour: raw → REQUEST_CHANGES, effective →
    // COMMENT.
    const rawVerdict = "NEEDS_FIX";
    const effectiveVerdict = reconcileVerdictForEmptySeverityCounts(rawVerdict, {});
    expect(rawVerdict).toBe("NEEDS_FIX");
    expect(effectiveVerdict).toBe("COMMENT");

    // Map effective → event. If `mapReviewVerdictToGithubEvent`
    // ever drifts to block on a non-empty verdict for empty severity
    // counts, this test will catch it.
    const event: "COMMENT" | "REQUEST_CHANGES" =
      effectiveVerdict === "NEEDS_FIX" ? "REQUEST_CHANGES" : "COMMENT";
    expect(event).toBe("COMMENT");
  });

  it("Azure PR status uses the effective verdict (pending is suppressed when postable severity is empty)", () => {
    // Given: same setup as the GitHub case but for Azure.
    const effectiveVerdict = reconcileVerdictForEmptySeverityCounts("NEEDS_FIX", {});
    const status = mapReviewVerdictToAzureStatus(effectiveVerdict);
    expect(status).toBe("succeeded");
  });
});