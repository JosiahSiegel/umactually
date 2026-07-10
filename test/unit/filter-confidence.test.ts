import { describe, expect, it } from "vitest";

import { applyConfidenceFilter } from "../../src/review/filter-confidence.js";
import type { LiveReview, LiveReviewComment } from "../../src/cli/live-shared.js";

function comment(overrides: Partial<LiveReviewComment> & Pick<LiveReviewComment, "path" | "line">): LiveReviewComment {
  return {
    path: overrides.path,
    line: overrides.line,
    body: overrides.body ?? "",
    severity: overrides.severity ?? "medium",
    category: overrides.category ?? "correctness",
  };
}

function review(comments: readonly LiveReviewComment[]): LiveReview {
  return {
    summary: "test",
    verdict: "COMMENT",
    comments,
    suppressedComments: [],
  };
}

describe("applyConfidenceFilter — Layer 5 false-positive prevention", () => {
  describe("hedging-language calibration", () => {
    it("downgrades a medium/high severity finding whose body uses hedging language", () => {
      const diff = [
        "diff --git a/src/handler.ts b/src/handler.ts",
        "--- a/src/handler.ts",
        "+++ b/src/handler.ts",
        "@@ -1,3 +1,4 @@",
        " export function handler(req: Request) {",
        "+  return { ok: true };",
        " }",
      ].join("\n");
      const c = comment({
        path: "src/handler.ts",
        line: 2,
        body: "This response handler could potentially fail under high load if the upstream service is slow.",
        severity: "high",
      });
      const result = applyConfidenceFilter({ review: review([c]), diffText: diff });
      expect(result.downgraded).toHaveLength(1);
      expect(result.downgraded[0]?.severity).toBe("low"); // high - 2 = low
      expect(result.reasons[0]?.reason).toBe("hedging-language");
      expect(result.kept).toHaveLength(0);
    });

    it("calibrates 'critical' hedging down by two tiers (critical → medium)", () => {
      // SEVERITY_TIERS = [info, low, medium, high, critical] (indices 0-4).
      // Two-tier downgrade from critical (index 4) lands at index 2 = medium.
      // The filter deliberately preserves some signal: a "critical"-severity
      // hedged claim is still a finding the operator should see, just at a
      // tier that reflects the model's uncertainty.
      const diff = "diff --git a/x.ts b/x.ts\n--- a/x.ts\n+++ b/x.ts\n@@ -1 +1 @@\n-old\n+new\n";
      const c = comment({
        path: "x.ts",
        line: 1,
        body: "This could lead to a critical bug in production.",
        severity: "critical",
      });
      const result = applyConfidenceFilter({ review: review([c]), diffText: diff });
      expect(result.downgraded[0]?.severity).toBe("medium");
    });

    it("does NOT downgrade a finding at info/low severity with hedging language (already calibrated by model)", () => {
      const diff = "diff --git a/x.ts b/x.ts\n--- a/x.ts\n+++ b/x.ts\n@@ -1 +1 @@\n-old\n+new\n";
      const c = comment({
        path: "x.ts",
        line: 1,
        body: "This could potentially affect edge cases.",
        severity: "low",
      });
      const result = applyConfidenceFilter({ review: review([c]), diffText: diff });
      // low + hedging → kept at low (the filter only acts when severity is medium+)
      expect(result.kept).toHaveLength(1);
      expect(result.downgraded).toHaveLength(0);
    });

    it("does NOT downgrade findings that have no hedging language", () => {
      const diff = [
        "diff --git a/src/handler.ts b/src/handler.ts",
        "--- a/src/handler.ts",
        "+++ b/src/handler.ts",
        "@@ -1,3 +1,4 @@",
        " export function handler(req: Request) {",
        "+  return { ok: true };",
        " }",
      ].join("\n");
      const c = comment({
        path: "src/handler.ts",
        line: 2,
        body: "The handler returns { ok: true } which is missing a Content-Type header — clients will misinterpret the response.",
        severity: "high",
      });
      const result = applyConfidenceFilter({ review: review([c]), diffText: diff });
      expect(result.kept).toHaveLength(1);
      expect(result.downgraded).toHaveLength(0);
    });
  });

  describe("pattern-matched advice", () => {
    it("downgrades a finding that uses 'you should consider' phrasing without quoting diff lines", () => {
      // Diff: changes a single line, no error handling context. The body
      // says "consider adding" — a classic pattern-matched advice pattern
      // with no anchor in the diff.
      const diff = [
        "diff --git a/src/cron.ts b/src/cron.ts",
        "--- a/src/cron.ts",
        "+++ b/src/cron.ts",
        "@@ -1,3 +1,4 @@",
        " export function run() {",
        "+  return null;",
        " }",
      ].join("\n");
      const c = comment({
        path: "src/cron.ts",
        line: 2,
        body: "Consider adding try/catch error handling around this function.",
        severity: "medium",
      });
      const result = applyConfidenceFilter({ review: review([c]), diffText: diff });
      expect(result.downgraded).toHaveLength(1);
      expect(result.downgraded[0]?.severity).toBe("info");
      expect(result.reasons[0]?.reason).toBe("pattern-matched-advice");
    });

    it("does NOT downgrade when the body DOES quote a diff line as evidence (anchored pattern-matched phrasing)", () => {
      // Same diff, but the body quotes the actual line that demonstrates
      // the issue. This is a legitimate anchored finding even though it
      // uses "consider" phrasing.
      const diff = [
        "diff --git a/src/cron.ts b/src/cron.ts",
        "--- a/src/cron.ts",
        "+++ b/src/cron.ts",
        "@@ -1,3 +1,4 @@",
        " export function run() {",
        "+  return null;",
        " }",
      ].join("\n");
      const c = comment({
        path: "src/cron.ts",
        line: 2,
        // Body quotes the diff line verbatim (>= 10 chars) — anchored.
        body: "The added line 'return null;' is suspicious. Consider wrapping in try/catch — the diff shows no error handling.",
        severity: "medium",
      });
      const result = applyConfidenceFilter({ review: review([c]), diffText: diff });
      // Body quotes "return null;" (11 chars) → anchored, keep.
      expect(result.kept).toHaveLength(1);
      expect(result.downgraded).toHaveLength(0);
    });
  });

  describe("contradicted-by-quote", () => {
    it("downgrades a finding that claims missing parameterized queries when the diff shows them", () => {
      // Note: the diff intentionally uses the literal phrase
      // "parameterized query" in a comment so the contradicted-by-quote
      // check fires. The $1 / $2 SQL placeholders are no longer
      // presence markers (see the regression test below for the FP
      // that caused their removal) — only the prose phrase counts.
      const diff = [
        "diff --git a/db/query.ts b/db/query.ts",
        "--- a/db/query.ts",
        "+++ b/db/query.ts",
        "@@ -1,3 +1,4 @@",
        " export async function getUser(id: string) {",
        "+  // Use a parameterized query for safety",
        "+  const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);",
        " }",
      ].join("\n");
      const c = comment({
        path: "db/query.ts",
        line: 3,
        body: "This query is missing parameterized query support — it should use a prepared statement to prevent SQL injection.",
        severity: "high",
      });
      const result = applyConfidenceFilter({ review: review([c]), diffText: diff });
      expect(result.downgraded).toHaveLength(1);
      expect(result.downgraded[0]?.severity).toBe("info");
      expect(result.reasons[0]?.reason).toBe("contradicted-by-quote");
      expect(result.reasons[0]?.explanation).toContain("parameterized queries");
    });

    it("does NOT downgrade when the construct is genuinely missing from the diff", () => {
      // Diff with a raw concatenated query — the model's "missing
      // parameterized query" finding IS legitimate.
      const diff = [
        "diff --git a/db/query.ts b/db/query.ts",
        "--- a/db/query.ts",
        "+++ b/db/query.ts",
        "@@ -1,3 +1,4 @@",
        " export async function getUser(id: string) {",
        "+  const result = await db.query('SELECT * FROM users WHERE id = ' + id);",
        " }",
      ].join("\n");
      const c = comment({
        path: "db/query.ts",
        line: 2,
        body: "This query is missing parameterized query support — it should use a prepared statement to prevent SQL injection.",
        severity: "high",
      });
      const result = applyConfidenceFilter({ review: review([c]), diffText: diff });
      // No "parameterized" / "prepared statement" in the diff → finding
      // is legitimate, keep at high.
      expect(result.kept).toHaveLength(1);
      expect(result.downgraded).toHaveLength(0);
    });

    it("does NOT downgrade when the body mentions parameterized queries but the diff only has $1/$2 placeholders in unrelated context (PR #43 self-review finding)", () => {
      // Regression for self-review finding on PR #43 thread 3559191384:
      // the PRESENCE_CONSTRUCTS entry for "parameterized queries" used
      // to include `$1` and `$2` as presence markers. These two-character
      // tokens are extraordinarily common in diffs (regex substitutions,
      // format strings, template literals, mathematical expressions) and
      // produced false-positive contradicted-by-quote downgrades on
      // legitimate findings about unrelated code. Removed from the
      // construct set; SQL parameter syntax is not anchored to a
      // security construct the way "parameterized query" / "parameterised
      // query" phrasings are.
      const diff = [
        "diff --git a/template/render.ts b/template/render.ts",
        "--- a/template/render.ts",
        "+++ b/template/render.ts",
        "@@ -1,3 +1,4 @@",
        " export function render(template: string) {",
        "+  return template.replace(/\\$(\\d+)/g, (_, idx) => values[parseInt(idx) - 1] ?? '');",
        " }",
      ].join("\n");
      // Body mentions parameterized queries but the diff is a
      // template-literal regex substitution, NOT a SQL query. The
      // finding's claim is nonsensical here (no SQL context), so the
      // filter must NOT downgrade it as "contradicted by quote" — the
      // $1 / $2 markers in the diff are NOT parameterized-query
      // placeholders, they're regex capture-group references.
      const c = comment({
        path: "template/render.ts",
        line: 2,
        body: "This template is missing parameterized query support — it should use a prepared statement to prevent SQL injection.",
        severity: "high",
      });
      const result = applyConfidenceFilter({ review: review([c]), diffText: diff });
      // The diff has no "parameterized query" / "parameterised query"
      // / "prepared statement" — only `$1` / `$2` regex markers. Pre-fix
      // the filter would have downgraded this to `info` because the
      // presence-marker check matched `$1` and `$2`. Post-fix, the
      // finding stays at `high` (legitimate: there really is no
      // parameterized query here, the model is wrong about SQL but
      // that's a model-quality issue, not a contradicted-by-quote FP).
      expect(result.kept).toHaveLength(1);
      expect(result.downgraded).toHaveLength(0);
    });
  });

  describe("intentional-design blindness", () => {
    it("downgrades a finding that flags code documented as intentional", () => {
      const diff = [
        "diff --git a/src/retry.ts b/src/retry.ts",
        "--- a/src/retry.ts",
        "+++ b/src/retry.ts",
        "@@ -1,3 +1,4 @@",
        " export function retry() {",
        "+  // intentional: rethrow after 3 attempts; see ADR-002 for why exponential backoff is wrong here",
        "+  return throw new Error('exhausted');",
        " }",
      ].join("\n");
      const c = comment({
        path: "src/retry.ts",
        line: 3,
        body: "This looks wrong — throwing on retry exhaustion will fail loudly. This is a bug.",
        severity: "high",
      });
      const result = applyConfidenceFilter({ review: review([c]), diffText: diff });
      expect(result.downgraded).toHaveLength(1);
      expect(result.reasons[0]?.reason).toBe("intentional-design");
      expect(result.reasons[0]?.explanation).toContain("intentional");
    });

    it("does NOT downgrade when the diff has no documenting comment", () => {
      const diff = [
        "diff --git a/src/retry.ts b/src/retry.ts",
        "--- a/src/retry.ts",
        "+++ b/src/retry.ts",
        "@@ -1,3 +1,4 @@",
        " export function retry() {",
        "+  return throw new Error('exhausted');",
        " }",
      ].join("\n");
      const c = comment({
        path: "src/retry.ts",
        line: 2,
        body: "This looks wrong — throwing on retry exhaustion will fail loudly. This is a bug.",
        severity: "high",
      });
      const result = applyConfidenceFilter({ review: review([c]), diffText: diff });
      // No intentional marker in diff → finding is legitimate, keep.
      expect(result.kept).toHaveLength(1);
      expect(result.downgraded).toHaveLength(0);
    });

    it("does NOT downgrade when the body does not express disapproval (just a neutral observation)", () => {
      const diff = [
        "diff --git a/src/retry.ts b/src/retry.ts",
        "--- a/src/retry.ts",
        "+++ b/src/retry.ts",
        "@@ -1,3 +1,4 @@",
        " // intentional: rethrow on retry exhaustion",
        " export function retry() {",
        "+  return throw new Error('exhausted');",
        " }",
      ].join("\n");
      const c = comment({
        path: "src/retry.ts",
        line: 3,
        body: "Note: the function throws on retry exhaustion. The behavior may need a docstring.",
        severity: "low",
      });
      const result = applyConfidenceFilter({ review: review([c]), diffText: diff });
      // Body is informational, not a disapproval claim → keep.
      expect(result.kept).toHaveLength(1);
      expect(result.downgraded).toHaveLength(0);
    });
  });

  describe("input contract", () => {
    it("returns empty result for an empty review", () => {
      const result = applyConfidenceFilter({
        review: review([]),
        diffText: "diff --git a/x b/x\n+++ b/x\n@@ -1 +1 @@\n-old\n+new\n",
      });
      expect(result.kept).toHaveLength(0);
      expect(result.downgraded).toHaveLength(0);
      expect(result.reasons).toHaveLength(0);
    });

    it("returns empty result for an empty diff (no hunk content to anchor against)", () => {
      const c = comment({
        path: "x.ts",
        line: 1,
        body: "Consider adding try/catch.",
        severity: "medium",
      });
      const result = applyConfidenceFilter({ review: review([c]), diffText: "" });
      // Pattern-matched advice filter needs hunk content; without it
      // the filter can't verify, so the finding is kept. Hedging
      // filter and intentional-design still work without hunk content
      // but neither matches this body.
      expect(result.kept).toHaveLength(1);
      expect(result.downgraded).toHaveLength(0);
    });

    it("keeps findings with paths not present in the diff (off-diff; left for the earlier (path,line) filter to drop)", () => {
      // The confidence filter does NOT check path/line anchoring —
      // that's `verifyFindingsAgainstDiff`'s job. This test pins the
      // contract: the confidence filter only acts on body/hunk content.
      const diff = "diff --git a/real.ts b/real.ts\n+++ b/real.ts\n@@ -1 +1 @@\n-old\n+new\n";
      const c = comment({
        path: "imaginary.ts",
        line: 99,
        body: "Real finding quoted from the diff line.",
        severity: "medium",
      });
      const result = applyConfidenceFilter({ review: review([c]), diffText: diff });
      expect(result.kept).toHaveLength(1);
    });
  });

  describe("real-world FP patterns from PR #41 self-review triage", () => {
    it("downgrades a body that claims 'dist/ is missing from files' (Layer 5's pattern-matched phrasing catches the abstract pattern even when no verified fact exists)", () => {
      // The verified-facts layer covers this exact case for package.json.
      // The confidence filter is a backstop: even when verified-facts
      // is bypassed (e.g. dist is not in the diff at all), a body that
      // asserts absence with pattern-matched phrasing AND no quoted
      // diff evidence gets downgraded.
      const diff = [
        "diff --git a/README.md b/README.md",
        "--- a/README.md",
        "+++ b/README.md",
        "@@ -1,1 +1,1 @@",
        "-old docs",
        "+new docs",
      ].join("\n");
      const c = comment({
        path: "README.md",
        line: 1,
        body: "Consider adding a docs/ section to the package files — this looks missing.",
        severity: "high",
      });
      const result = applyConfidenceFilter({ review: review([c]), diffText: diff });
      // Body uses "consider adding" + "missing" — pattern-matched,
      // no quoted diff line.
      expect(result.downgraded).toHaveLength(1);
      expect(result.reasons[0]?.reason).toBe("pattern-matched-advice");
    });
  });

  describe("multi-finding independence", () => {
    it("applies the filter per-finding; keeps good findings while downgrading bad ones", () => {
      const diff = [
        "diff --git a/src/x.ts b/src/x.ts",
        "--- a/src/x.ts",
        "+++ b/src/x.ts",
        "@@ -1,3 +1,4 @@",
        " export function f() {",
        "+  return null;",
        " }",
      ].join("\n");
      const goodFinding = comment({
        path: "src/x.ts",
        line: 2,
        body: "The added line 'return null;' has no null-check downstream.",
        severity: "medium",
      });
      const badFinding = comment({
        path: "src/x.ts",
        line: 2,
        body: "Consider adding try/catch error handling around this function.",
        severity: "medium",
      });
      const result = applyConfidenceFilter({
        review: review([goodFinding, badFinding]),
        diffText: diff,
      });
      // good: quotes "return null;" → kept; bad: "consider adding" with no quote → downgraded
      expect(result.kept).toHaveLength(1);
      expect(result.kept[0]?.body).toContain("null-check");
      expect(result.downgraded).toHaveLength(1);
      expect(result.reasons[0]?.reason).toBe("pattern-matched-advice");
    });
  });
});