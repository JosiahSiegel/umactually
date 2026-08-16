/**
 * Workflow contract test for the 'Append resolution-guide to latest
 * review body' step in .github/workflows/self-review.yml.
 *
 * Originally titled the "noise-skip rule", this test pinned the
 * short-circuit on `INLINE_COUNT=0`. That short-circuit was removed
 * after the observation that the guide is the agent-facing handbook
 * for reading AND resolving umactually reviews — it documents the
 * GraphQL close protocol, the disposition taxonomy, and how to
 * interpret every verdict including ✅ SHIP / 💬 DISCUSS. An agent
 * reading a clean 0-finding review still needs that protocol to
 * formally close the review (Step 1 disposition "ship it" / "no
 * findings"). Appending the guide unconditionally is correct; the
 * marker-based idempotency check (GUIDE_MARKER in body) prevents
 * duplicate appends on reruns.
 *
 * The PR #139 self-review iteration established several contracts that
 * still hold after the unconditional-append change:
 *   - the step reads the latest review via GraphQL `pullRequest.reviews(last:N)`
 *     (clean pagination, single round-trip)
 *   - it filters by `commit.oid == HEAD_SHA` so we never attach the guide
 *     to a review from an older commit (no more "stale bot review"
 *     ambiguity)
 *   - it filters by `state != PENDING` so we never PUT to a PENDING review
 *     (no more 422 failures; COMMENTED, APPROVED, and CHANGES_REQUESTED
 *     all qualify)
 *   - it extracts the inline count from the umactually manifest's
 *     `<!-- umactually:manifest {"inlineCount":N, ...} -->` JSON blob
 *     (no emoji-coupling, no per-severity miscount)
 *
 * The tests in this file enforce every contract in the new shape so
 * the rule cannot regress silently in future edits. End-to-end
 * verification (a real push + workflow run returning a 0-findings
 * review) is impractical on this PR because the umactually CLI flags
 * substantive workflow concerns on every run, so we trust the
 * structural contract instead.
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

  it("the step declares GITHUB_TOKEN env so the gh api call uses the correct auth var", () => {
    // `gh` reads GITHUB_TOKEN as the primary auth env var (GH_TOKEN is
    // only a fallback). The upstream 'Run UmActually self review' step
    // declares GITHUB_TOKEN; this step must match so a pull_request from
    // a fork doesn't fall back to ambient auth.
    const stepBlock = extractStepBlock(
      workflowText,
      "Append resolution-guide to latest review body",
    );
    expect(stepBlock).toContain("GITHUB_TOKEN:");
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
    // The GraphQL Review.author.login field returns the bare account
    // name "github-actions" for the bot account — NOT the
    // "github-actions[bot]" form that REST /reviews uses. Filtering on
    // "[bot]" silently matches nothing and the step exits without
    // appending the guide. Pin the GraphQL-correct form here so any
    // copy-paste from REST snippets fails this test.
    expect(stepBlock).toMatch(/\.author\.login == "github-actions"/u);
    expect(stepBlock).not.toMatch(/\.author\.login == "github-actions\[bot\]"/u);
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

  it("the step restores set -e before the destructive review-body PUT", () => {
    // The upstream 'Run UmActually self review' step runs with set +e
    // (advisory). This step's read-only GraphQL fetch must stay tolerant
    // of transient API failures, but the destructive PUT must fail
    // loudly on partial failure. Pin the explicit set -e before any
    // write so a future copy-paste regression to the upstream posture
    // doesn't silently leave the body in an unknown state.
    const stepBlock = extractStepBlock(
      workflowText,
      "Append resolution-guide to latest review body",
    );
    const fetchIdx = stepBlock.indexOf("gh api graphql");
    const restoreIdx = stepBlock.indexOf("set -e", fetchIdx);
    const putIdx = stepBlock.indexOf("-X PUT");
    expect(fetchIdx).toBeGreaterThanOrEqual(0);
    expect(restoreIdx).toBeGreaterThan(fetchIdx);
    expect(putIdx).toBeGreaterThan(restoreIdx);
  });

  it("the manifest parser uses awk+sed so nested braces + inline '-->' don't truncate early", () => {
    // The original sed regex was greedy through `{.*}` and would
    // truncate at the first inner `}` (e.g. severityCounts with nested
    // values), causing the subsequent jq parse to fail and the step to
    // silently skip the append. The fix swaps to a `tac | awk | sed`
    // pipeline: `tac` reverses line order so awk picks the LAST
    // occurrence of `<!-- umactually:manifest ` (the real manifest,
    // never a quoted copy in the bot's summary prose); awk strips the
    // prefix; sed strips the trailing `-->` anchored on end-of-line so
    // a JSON string field containing literal `-->` does not truncate
    // the manifest mid-object.
    const stepBlock = extractStepBlock(
      workflowText,
      "Append resolution-guide to latest review body",
    );
    expect(stepBlock).toMatch(/awk\s*'/u);
    expect(stepBlock).not.toMatch(/sed -n 's\|.\*<!-- umactually:manifest/u);
  });

  it("the manifest parser anchors on the LAST marker (tac | awk) so quoted occurrences in summary text don't hijack the extraction", () => {
    // Regression: a previous self-review summary quoted the marker
    // shape (`<!-- umactually:manifest ` literal) inside its own
    // prose, which the awk matched FIRST (earlier in the stream than
    // the actual manifest at the end of the body) and captured as
    // the manifest. jq then failed on the non-JSON string, INLINE_COUNT
    // defaulted to 0, and the step skipped the append with a misleading
    // 'inlineCount=0' log line. The fix pipes through `tac` first so
    // awk processes the LAST marker first (which is the real manifest).
    const stepBlock = extractStepBlock(
      workflowText,
      "Append resolution-guide to latest review body",
    );
    expect(stepBlock).toMatch(/\| tac \| awk/u);
  });

  it("the step does NOT short-circuit when INLINE_COUNT is 0 (guide appends unconditionally)", () => {
    // Contract change: the guide is the agent-facing handbook for ANY
    // umactually review, including clean 0-finding ones. The previous
    // `exit 0` short-circuit removed visual noise on empty reviews but
    // also hid the close protocol from agents who needed to formally
    // resolve a clean review. The marker-based idempotency check
    // (GUIDE_MARKER in body) below prevents duplicate appends on
    // reruns — that's the only legitimate skip path now.
    const stepBlock = extractStepBlock(
      workflowText,
      "Append resolution-guide to latest review body",
    );
    const zeroBranch = stepBlock.match(
      /if \[\s*"\$\{INLINE_COUNT\}"\s*=\s*"0"\s*\]; then\n([\s\S]*?)\n {10}fi/u,
    );
    expect(zeroBranch, "the 0-finding branch exists").not.toBeNull();
    expect(zeroBranch?.[1] ?? "").not.toMatch(/exit 0/u);
  });

  it("the 0-finding branch falls through to the marker-based idempotency check (then the PUT)", () => {
    // The 0-finding branch must NOT terminate the step. After the
    // branch ends, the marker-based skip (versionless regex
    // `grep -qE '<!-- umactually:resolution-guide-v[0-9]+ -->'`)
    // is the only early-exit gate, and it must sit BEFORE the PUT.
    const stepBlock = extractStepBlock(
      workflowText,
      "Append resolution-guide to latest review body",
    );
    const zeroBranchIdx = stepBlock.indexOf('if [ "${INLINE_COUNT}" = "0" ]');
    const zeroBranchEndIdx = stepBlock.indexOf("\n          fi", zeroBranchIdx);
    const markerCheckIdx = stepBlock.indexOf(
      "grep -qE '<!-- umactually:resolution-guide-v[0-9]+ -->'",
    );
    const putIdx = stepBlock.indexOf("-X PUT");
    expect(zeroBranchIdx).toBeGreaterThanOrEqual(0);
    expect(zeroBranchEndIdx).toBeGreaterThan(zeroBranchIdx);
    expect(markerCheckIdx).toBeGreaterThan(zeroBranchEndIdx);
    expect(putIdx).toBeGreaterThan(markerCheckIdx);
  });

  it("the workflow GUIDE_MARKER literal equals the CLI's RESOLUTION_GUIDE_MARKER (drift guard)", () => {
    // Drift discipline: the workflow's `GUIDE_MARKER="..."` literal and
    // `src/util/marker.ts`'s `RESOLUTION_GUIDE_MARKER` constant MUST match.
    // The CLI bakes the v3 marker into every posted body (Task 1); the
    // self-review workflow PUTs the same marker on append (this file).
    // A silent drift here means either (a) the CLI-baked body never
    // matches the workflow's idempotency grep and we re-append the
    // guide on every push, or (b) the workflow's PUT appends a marker
    // the CLI never emits and the dedup greper misses it on the next
    // run. Both are silent — this test fails the build instead.
    const stepBlock = extractStepBlock(
      workflowText,
      "Append resolution-guide to latest review body",
    );
    const markerModulePath = resolve(
      REPO_ROOT,
      "src/util/marker.ts",
    );
    const markerModuleText = readFileSync(markerModulePath, "utf8");
    const cliMarkerMatch = markerModuleText.match(
      /RESOLUTION_GUIDE_MARKER\s*=\s*("([^"\\]|\\.)*")/u,
    );
    expect(cliMarkerMatch, "RESOLUTION_GUIDE_MARKER constant exists in src/util/marker.ts").not.toBeNull();
    const cliMarker = cliMarkerMatch?.[1] ?? "";
    // Strip surrounding double quotes for string equality.
    const cliMarkerLiteral = cliMarker.slice(1, -1);
    expect(stepBlock).toContain(`GUIDE_MARKER="${cliMarkerLiteral}"`);
    expect(workflowText).toMatch(
      /<!-- umactually:resolution-guide-v\[0-9\]\+ -->/u,
    );
  });

  it("each platform guide warns that unresolved threads block merge when branch protection is on", () => {
    // Regression pin: guides must warn unresolved threads block merge under branch protection.
    const ghGuide = readFileSync(
      resolve(REPO_ROOT, ".github/workflows/data/resolution-guide-github.md"),
      "utf8",
    );
    const azGuide = readFileSync(
      resolve(REPO_ROOT, ".github/workflows/data/resolution-guide-azure.md"),
      "utf8",
    );
    expect(ghGuide).toMatch(/Merge gate/u);
    expect(ghGuide).toMatch(/Require conversation resolution before merging/u);
    expect(azGuide).toMatch(/Merge gate/u);
    expect(azGuide).toMatch(/conversation-completion policies/u);
  });

  it("each platform guide instructs to reply before resolving (no bare resolve)", () => {
    const ghGuide = readFileSync(
      resolve(REPO_ROOT, ".github/workflows/data/resolution-guide-github.md"),
      "utf8",
    );
    const azGuide = readFileSync(
      resolve(REPO_ROOT, ".github/workflows/data/resolution-guide-azure.md"),
      "utf8",
    );
    expect(ghGuide).toMatch(/Resolve properly/u);
    expect(ghGuide).toMatch(/reply.*before.*resolved/us);
    expect(azGuide).toMatch(/Resolve properly/u);
    expect(azGuide).toMatch(/reply.*before.*closed/us);
  });

  it("manifest extraction anchors the JSON terminator on end-of-line, not first '-->'", () => {
    const stepBlock = extractStepBlock(
      workflowText,
      "Append resolution-guide to latest review body",
    );
    expect(stepBlock).toMatch(/tac \| awk/u);
    expect(stepBlock).toMatch("sed 's/[[:space:]]*-->$//'");
    expect(stepBlock).not.toMatch("sub(/ -->.*$/");
  });

  it("the test docstring matches the workflow filter (state != PENDING, not state == COMMENTED)", () => {
    const testText = readFileSync(
      resolve(import.meta.dirname, "self-review-noise-skip.test.ts"),
      "utf8",
    );
    expect(testText).toMatch(/state\s*!=\s*PENDING/u);
    expect(testText).not.toMatch(/`state:\s*COMMENTED`/u);
  });

  it("the workflow declares UMACTUALLY_PLATFORM at workflow-level env (single source of truth)", () => {
    expect(workflowText).toMatch(/^env:\s*\n[\s\S]*?UMACTUALLY_PLATFORM:\s*github/m);
    const stepBlock = extractStepBlock(
      workflowText,
      "Append resolution-guide to latest review body",
    );
    expect(stepBlock).toMatch(/steps\.review\.outputs\.platform\s*\|\|\s*env\.UMACTUALLY_PLATFORM/u);
  });

  it("the manifest inlineCount is guarded against non-numeric jq output", () => {
    const stepBlock = extractStepBlock(
      workflowText,
      "Append resolution-guide to latest review body",
    );
    expect(stepBlock).toMatch(/case "\$\{INLINE_COUNT\}" in/u);
    expect(stepBlock).toMatch(/\*\[!0-9\]\*/);
  });

  it("the review-body PUT is wrapped so a transient API failure does not fail the advisory job", () => {
    const stepBlock = extractStepBlock(
      workflowText,
      "Append resolution-guide to latest review body",
    );
    expect(stepBlock).toMatch(/PUT_EXIT=\$?/u);
    expect(stepBlock).toMatch(/PUT-to-review failed/u);
    expect(stepBlock).toMatch(/exit 0/u);
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
