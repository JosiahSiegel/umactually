/**
 * Workflow noise-skip test.
 *
 * Validates that the 'Append resolution-guide to latest review body' step
 * in .github/workflows/self-review.yml correctly short-circuits when the
 * latest github-actions[bot] review on the PR has 0 inline findings.
 *
 * The PR #139 self-review iteration showed the rule needed to fire:
 * - The umactually summary card for an empty review already says
 *   "0 inline findings" and "No findings to address." — appending
 *   a ~2KB collapsed-guide footer on top of that adds visual noise
 *   with no actionable triage to perform.
 *
 * The rule went through several revisions. Earlier versions:
 *   - parsed free-form emoji text in the summary card (coupled to
 *     umactually's exact wording)
 *   - paginated /reviews via REST with `per_page=30` (limit-capped)
 *   - PUT'd without checking review state (PENDING reviews 422)
 *
 * The current implementation:
 *   - reads the latest review via GraphQL `pullRequest.reviews(last:N)`
 *     (clean pagination, single round-trip)
 *   - filters by `commit.oid == HEAD_SHA` so we never attach the guide
 *     to a review from an older commit (no more "stale bot review"
 *     ambiguity)
 *   - filters by `state: COMMENTED` so we never PUT to a PENDING review
 *     (no more 422 failures)
 *   - extracts the inline count from the umactually manifest's
 *     `<!-- umactually:manifest {"inlineCount":N, ...} -->` JSON blob
 *     (no emoji-coupling, no per-severity miscount)
 *
 * This test enforces every contract in the new shape so the rule cannot
 * regress silently in future edits. End-to-end verification (a real
 * push + workflow run returning a 0-findings review) is impractical on
 * this PR because the umactually CLI flags substantive workflow concerns
 * on every run, so we trust the structural contract instead.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const WORKFLOW_FILE = resolve(REPO_ROOT, ".github/workflows/self-review.yml");

describe("self-review workflow noise-skip rule", () => {
  const workflowText = readFileSync(WORKFLOW_FILE, "utf8");

  it("the 'Append resolution-guide to latest review body' step exists", () => {
    expect(workflowText).toMatch(
      /- name: Append resolution-guide to latest review body/u,
    );
  });

  it("the step declares GH_TOKEN env so the gh api call passes the linter", () => {
    const stepBlock = extractStepBlock(
      workflowText,
      "Append resolution-guide to latest review body",
    );
    expect(stepBlock).toContain("GH_TOKEN:");
    expect(stepBlock).toContain("github.token");
  });

  it("the step uses GraphQL (not REST /reviews) to find the latest bot review", () => {
    // The new implementation must read reviews via GraphQL so pagination,
    // commit-filtering, and state-filtering are first-class. Any future
    // edit that switches back to `gh api /pulls/{n}/reviews?per_page=...`
    // reopens the pagination + PENDING-422 + stale-review concerns.
    const stepBlock = extractStepBlock(
      workflowText,
      "Append resolution-guide to latest review body",
    );
    expect(stepBlock).toMatch(/gh api graphql/u);
    expect(stepBlock).not.toMatch(/\/pulls\/\$\{PR_NUMBER\}\/reviews\?per_page/u);
  });

  it("the step filters the review by author and commit oid", () => {
    const stepBlock = extractStepBlock(
      workflowText,
      "Append resolution-guide to latest review body",
    );
    expect(stepBlock).toMatch(/\.author\.login == "github-actions\[bot\]"/u);
    expect(stepBlock).toMatch(/\.commit\.oid == \$sha/u);
  });

  it("the GraphQL query selects `commit { oid }` so the commit-oid filter has data to match", () => {
    // The bash filter on the right side (`commit.oid == $sha`) is a no-op
    // if the GraphQL query does not request the field. A previous round
    // of this iteration had the filter but the query was missing
    // `commit { oid }`, so the filter silently matched nothing. The
    // query and the filter must move together.
    const queryFile = resolve(REPO_ROOT, ".github/workflows/data/latest-bot-review.graphql");
    const queryText = readFileSync(queryFile, "utf8");
    expect(queryText).toMatch(/commit\s*\{\s*oid\s*\}/u);
  });

  it("the step rejects PENDING reviews", () => {
    // The REST PUT to /reviews/{id} returns 422 for PENDING reviews
    // (verified across PR #139's history — every bot review lands in
    // COMMENTED/APPROVED/CHANGES_REQUESTED, none in PENDING). The step
    // short-circuits if the latest bot review is still PENDING, which is
    // the only state where the body-PUT is invalid.
    const stepBlock = extractStepBlock(
      workflowText,
      "Append resolution-guide to latest review body",
    );
    expect(stepBlock).toMatch(/REVIEW_STATE.*PENDING/u);
    expect(stepBlock).toMatch(/PENDING.*PUT|PUT.*PENDING/u);
  });

  it("the step extracts inlineCount from the umactually manifest JSON, not emoji text", () => {
    const stepBlock = extractStepBlock(
      workflowText,
      "Append resolution-guide to latest review body",
    );
    expect(stepBlock).toMatch(/<!-- umactually:manifest /u);
    expect(stepBlock).toMatch(/"inlineCount"/u);
  });

  it("the GraphQL query fetches enough reviews to span interleaved human LGTMs", () => {
    // Regression: a human empty-body LGTM posted after the bot's review
    // pushed `reviews(last: 1)` past the bot row; jq filtered it out and
    // the step exited without appending the guide. Window must be > 1.
    const queryFile = resolve(REPO_ROOT, ".github/workflows/data/latest-bot-review.graphql");
    const queryText = readFileSync(queryFile, "utf8");
    expect(queryText).toMatch(/reviews\(last:\s*[2-9]\d?\s*\)/u);
    expect(queryText).not.toMatch(/reviews\(last:\s*1\s*\)/u);
  });

  it("the step short-circuits with `exit 0` when INLINE_COUNT is 0", () => {
    const stepBlock = extractStepBlock(
      workflowText,
      "Append resolution-guide to latest review body",
    );
    const zeroBranch = stepBlock.match(
      /if \[\s*"\$\{INLINE_COUNT\}"\s*=\s*"0"\s*\]; then\n([\s\S]*?)\n {10}fi/u,
    );
    expect(zeroBranch, "the 0-finding branch exists").not.toBeNull();
    expect(zeroBranch?.[1] ?? "").toMatch(/exit 0/u);
  });

  it("the 0-finding short-circuit runs before the PUT-to-review call", () => {
    const stepBlock = extractStepBlock(
      workflowText,
      "Append resolution-guide to latest review body",
    );
    const zeroBranchIdx = stepBlock.indexOf('if [ "${INLINE_COUNT}" = "0" ]');
    const putIdx = stepBlock.indexOf("-X PUT");
    expect(zeroBranchIdx).toBeGreaterThanOrEqual(0);
    expect(putIdx).toBeGreaterThan(zeroBranchIdx);
  });
});

/**
 * Pulls the YAML literal-block run section for a given step name out of
 * the workflow file. Naive (YAML is parsed by the linter for full
 * correctness; this returns a string slice for regex inspection).
 */
function extractStepBlock(text: string, stepName: string): string {
  const startMarker = `- name: ${stepName}`;
  const start = text.indexOf(startMarker);
  if (start === -1) return "";
  const remainder = text.slice(start);
  const next = remainder.indexOf("\n      - name:");
  return next === -1 ? remainder : remainder.slice(0, next);
}
