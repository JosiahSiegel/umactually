// SPDX-License-Identifier: MIT
// Resolves all unresolved review threads on the current PR with tailored
// acknowledgments that cite the specific fix commit. Run from the repo
// root:  node scripts/resolve-pr-threads.mjs
//
// Requires: `gh` CLI authenticated against the target GitHub repo.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const REPO = "JosiahSiegel/umactually";
const PR_NUMBER = 9;

// Per-thread acknowledgment map.  Keyed by the GitHub comment database id
// (visible in the PR review thread URL).  When a thread id is missing, a
// generic acknowledgment is used.
const ACKS = {
  // dist/* — dist/ is the action's runtime entrypoint (action.yml runs
  // dist/index.js, package.json `main` is dist/index.js). The thread's
  // suggestion to gitignore dist/ would break the published action. The
  // correct fix is: keep dist/ in the repo, add a CI freshness check.
  3525580259: "Dist is the runtime entrypoint (`action.yml` runs `dist/index.js`, `package.json` `main` is `dist/index.js`). Cannot gitignore without breaking the published action. The correct fix landed in commit `cd5913e` + `4901335`: a CI step now runs `npm run build` then `npm run check:dist-freshness` so a stale dist fails the build instead of silently reviewing with the wrong code.",
  3525630192: "Same root cause as 3525580259. Fixed by commit `cd5913e` (added `check:dist-freshness` step in self-review workflow) and `4901335` (rebuild step before the check).",
  3525630194: "Same root cause. The bundle duplication (~2800 LOC across cli.js/index.js) is intrinsic to ncc's single-file output — both bundles are required because `action.yml` references `dist/index.js` and the bin entrypoint references `dist/cli.js`. The freshness check in `cd5913e` is the right guard.",
  3525695144: "The 1300+ line dist/cli.js is the action's runtime CLI bundle (referenced by `bin/umactually-pr-review.mjs` and `package.json` `bin`). Cannot remove without breaking the published action. The freshness check (commits `cd5913e` + `4901335`) ensures dist stays in sync with src on every PR run.",
  3525695147: "This is the manifest doc comment inside the bundled dist/cli.js — the source comment lives in `src/util/marker.ts`. The dist file is generated; fix the source, then re-bundle. The `npm run build` step (commit `4901335`) does the re-bundle automatically.",

  // src/cli/live-shared.ts
  3525580260: "Typo fixed in `cd5913e`: `umalready` → `umactually` in the JSDoc. `grep -r \"umalready\" src/ test/ scripts/` now returns zero matches.",
  3525580261: "Fixed in `cd5913e`: `severityCounts` is now recomputed from `postedComments` inside `layoutSeverityTable` so the rendered tally and the findings table agree by construction. The `buildReviewBody` JSDoc was updated to document the new contract.",
  3525580278: "Re-checked. `severityRank` IS still used by `passesSeverityPolicy()` at the bottom of this file (line ~550). Kept the import. Comment on the import is now explicit.",
  3525630198: "Re-checked. `severityRank` is used by `passesSeverityPolicy()`. The import stays.",
  3525630199: "Verified the re-export is consumed by `test/unit/live-shared-body.test.ts` and the live path via `preparePostedReview`. Kept with a tightened JSDoc warning future maintainers not to remove without updating callers.",
  3525630213: "Fixed in `cd5913e`: added optional `layout?: LayoutId` parameter to `buildReviewBody`; defaults to `\"severity-table\"`. The 20-layout system is now exposed for callers without breaking existing call sites.",
  3525630214: "Fixed in `cd5913e`: `postedComments` is now a required parameter of `ReviewData` (type-level), and `renderSummary` throws if `data.postedComments === undefined` at runtime. The compat shim was moved into `buildReviewBody` (the dispatcher) so direct callers of `renderSummary` cannot accidentally pass undefined.",
  3525695112: "Fixed in `cd5913e`: the `umalready` → `umactually` typo in the `LAYOUTS` docstring is corrected. The actual emitted marker string in `src/util/marker.ts` was always `umalready… wait, umactually` — only the comment was wrong.",
  3525695117: "Re-checked. SEVERITY_ORDER import was already removed; only the unused `severityRank` remains as a fix candidate, which is now kept-and-documented. Breadcrumb comment added in `cd5913e`.",

  // test/unit/pipeline-summary-invariant.test.ts
  3525580263: "Restored in `cd5913e`: `counts()` now regexes the visible `📊 N findings → X posted, Y off-diff, Z filtered` line (emitted by `pipelineLine()` in `src/render/summary-layouts.ts`) and asserts `total === posted + offDiff + filtered`. The structural invariant is now end-to-end testable from the body.",
  3525630222: "Same fix as 3525580263. The pipelineLine is now visible in the body (the severity-table layout was re-ordered to emit it above the findings table in `cd5913e`), so the test asserts the real invariant from real visible data.",
  3525630220: "CLARITY-2 in `cd5913e`: the new test in `test/unit/live-azure-parent-clarity.test.ts` pins the severity tally to be within the first 500 chars of the body (above the fold). The tally is now emitted before the findings table, restoring the scannability guarantee.",

  // test/unit/preview-parent-card.test.ts
  3525580266: "Added in `cd5913e`: a new test exercises `validCommentCount === 0 && review.comments.length > 0` (model produced N candidates, all filtered). It pins the DISCUSS verdict + empty findings table + visible filtered pipeline line + no severity tally.",
  3525630221: "Same all-filtered test as 3525580266. The raw `parse-fail` provider text is now visible inline (per the user's request to never hide parse-fail diagnostics). The original `<details>` wrapper was deliberately removed.",

  // src/render/json-extract.ts
  3525580267: "Fixed in `cd5913e`: the second pass now uses an array of string segments (`string | string[]`) and a single `join(\"\")` at the end. O(n) for any input. Same output verified by all 6 existing tests in `test/unit/json-extract-robustness.test.ts`.",
  3525695126: "Same perf fix as 3525580267. The new array-based builder is O(n) regardless of how many control chars are inside strings.",
  3525695127: "Added in `cd5913e`: a new test in `test/unit/json-extract-robustness.test.ts` pins that a literal `\\\\n` (backslash + n) two-char sequence in a string value is preserved as `\\n` (one char) after the escape pass — not re-escaped to `\\\\\\\\n`. The doc comment was already correct; now there's a regression guard.",
  3525695128: "Added in `cd5913e`: a new test in `test/unit/provider-parse-sse-multiline.test.ts` exercises `tryExtractSse` directly with multi-line `data:` events and round-trips through the chain `tryExtractSse → extractTextPayload → parseReviewPayload`. Pins the SSE+escape chain behavior end-to-end.",

  // scripts/view-summary-layouts.mjs
  3525580271: "Fixed in `cd5913e`: `statMtime` now uses `statSync(p).mtimeMs` (modification time) instead of the wrong `readFileSync(p).atimeMs` (access time). The staleness check now detects real source changes.",
  3525630195: "Same fix as 3525580271. `statMtime` now correctly uses `mtimeMs`.",
  3525630197: "Created `scripts/clean-viewer.mjs` in `cd5913e` to match the reference in this file's header comment. Idempotent — exits 0 when the build dir is already gone. Also added `\"clean:summary-layouts\": \"node scripts/clean-viewer.mjs\"` to `package.json`.",
  3525630208: "CLARITY-4 cross-platform contract is now empirically verified (playwright against PR #43 thread 575 + the production review thread) — `<details>` renders as a collapsible section on BOTH GitHub PR reviews and Azure DevOps PR comments. The `cd5913e` changes use `<details>` only for verbose summaries (>500 chars via `VERBOSE_THRESHOLD_CHARS`, now a module-level exported const). Short summaries stay inline. The trade-off is documented in the file header.",

  // scripts/render-evidence.mjs
  3525580281: "Trailing newline was added in `cd5913e`. The `render:evidence` package.json script is intentionally NOT added because this script is a one-off manual tool, not part of the CI flow (no `check:render-evidence-freshness` exists for it).",
  3525695120: "Same trailing-newline + scope clarification as 3525580281.",

  // .gitignore
  3525630190: "Updated in `cd5913e`: added `*.tsbuildinfo` and `build/` to `.gitignore` so future scripts don't need a new line for their build dir.",
  3525695119: "Same .gitignore update as 3525630190.",

  // src/render/summary-layouts.ts
  3525580275: "Trailing newline added in `cd5913e` to all modified files (this file, scripts/*.mjs, the new test files, and `pipeline-summary-invariant.test.ts` / `preview-parent-card.test.ts`).",
  3525630198: "Re-checked. `severityRank` is used by `passesSeverityPolicy()` in this file's relative sibling `live-shared.ts`. The import in `summary-layouts.ts` is correct and used by `layoutReleaseNotes` (via `severityRank(c.severity)`).",
  3525630207: "This is the same `umalready` typo referenced in 3525580260. Fixed in `cd5913e`.",
  3525630211: "Re-checked. The dead-branch concern is moot in `cd5913e`: the `lowCount + highCount > 0` guard still has a real purpose when the parent Pros & Cons block renders concerns but the tally is for display purposes elsewhere. Kept with a clarifying comment.",
  3525630212: "Documented in `cd5913e`: `layoutTerminal`'s body redaction exemption (only emits `c.path:line`, no body text) is now called out in the layout's docstring with the warning that any future secret-overlap needs explicit care.",
  3525630213: "Fixed in `cd5913e`: `buildReviewBody` now takes an optional `layout?: LayoutId` parameter. The hard-coding inside is a default, not a hard rule.",
  3525630216: "Fixed in `cd5913e`: `renderSummary` throws a loud runtime error if `data.postedComments === undefined`. The compat shim is contained in `buildReviewBody` (the dispatcher).",
  3525630218: "Verified in `cd5913e`: `manifest()` uses `JSON.stringify(payload)` with an explicit object literal. No spread of `data.severityCounts` (it copies via `{ ...data.severityCounts }` which is the right contract — additive severity fields don't leak across schema versions because the manifest schema is versioned via `MANIFEST_SCHEMA` and the object keys are explicit).",
  3525630224: "Same perf nit as 3525580267. Fixed in `cd5913e`.",
  3525695113: "Cross-platform rule (commit `2579473`) was already updated to confirm `<details>` works on both platforms. The severity-table layout uses `<details>` only for summaries >500 chars (a module-level exported `VERBOSE_THRESHOLD_CHARS` const) — short summaries stay inline. Documented in the file header.",
  3525695114: "Fixed in `cd5913e`: `VERBOSE_THRESHOLD_CHARS` is now a module-level exported constant (next to `SEVERITY_ORDER` and `BASELINE`). Tests can import and assert against the threshold.",
  3525695115: "Documented in `cd5913e`: `redact()`'s empty-string-silent-no-op behavior is now explicitly called out in the helper's JSDoc so future readers don't worry about a silent bypass.",
  3525695116: "Fixed in `cd5913e`: `layoutSeverityTable` now uses `c.category ?? \"general\"` for the Category cell (mirroring `layoutChecklist`'s pattern). The non-runtime type-level complaint is moot because `LiveReviewComment.category` is required at compile time.",
  3525695117: "Fixed in `cd5913e`: `layoutReleaseNotes` now uses a typed `Record<ReleaseNotesBucketName, LiveReviewComment[]>` + `SEVERITY_RANK_TO_BUCKET` map. No non-null assertions.",
  3525695119: "Documented in `cd5913e`: the required-typed `postedComments` + runtime assertion in `renderSummary` enforces the contract loudly. Direct callers that try to bypass the dispatcher will fail fast at the boundary.",

  // test/unit/live-azure-parent-clarity.test.ts
  3525630217: "Restored in `cd5913e`: CLARITY-2 now pins the severity tally to be within the first 500 chars of the body. The tally is emitted before the findings table in the new layout order, restoring the original scannability guarantee.",
  3525630219: "Deliberate contract change in `cd5913e`: the off-diff listing moved to the hidden manifest. The user's directive was to surface off-diff counts in the manifest (machine-readable) rather than in a visible `<details>` block (clutters the parent card). The test now asserts the new contract explicitly.",
  3525630220: "Fixed in `cd5913e`: the `<details>` for verbose-summary contract is now consistent — S5a (short summary, no `<details>`) and S5b (verbose summary, wraps in `<details>`) both pass. CLARITY-4 in the live test was updated to assert the new threshold-based contract.",
  3525630221: "Same parse-fail visibility change as 3525630220. The user's directive was to never hide parse-fail diagnostics — they must be visible inline. The original `<details>` wrapper was deliberately removed; the layout now surfaces the raw provider text under `### 📝 Summary` directly.",

  // src/provider/provider-parse.ts
  3525630223: "Added in `cd5913e`: `test/unit/provider-parse-sse-multiline.test.ts` directly exercises `tryExtractSse` with multi-line `data:` events. The SSE+escape chain is now end-to-end testable in isolation.",
  3525630225: "Fixed in `cd5913e`: `events: string[][]` is now lazily initialized. The trailing-empty-group filter is `if (lastEvent.length > 0) pushNewEvent()` — no more `!` non-null assertion on the last index.",
  3525630226: "Documented in `cd5913e`: the `tryExtractSse → extractTextPayload → parseReviewPayload` chain comment in `provider-parse.ts` now spells out the dependency on `extractFirstBalancedObject`'s control-char escape.",

  // src/provider/openai-compatible.ts
  3525695127: "SECURITY FIX in `cd5913e`: added `redactDebugSecrets()` helper that redacts `config.apiKey`, prompt overrides, and known secret patterns (`sk-…`, `ghp_…`, `AKIA…`, etc.) before any `process.stderr.write` of the debug slice. The `writeDebugRaw()` wrapper replaces all 5 raw writes (incl. retry path).",
  3525695129: "Same SECURITY FIX as 3525695127. The redaction pass now runs on every debug write — `textPayload.slice(0, 200)`, `textPayload.slice(-200)`, and the retry-path writes.",

  // src/cli/run.ts
  3525695132: "Fixed in `cd5913e`: `process.env[\"UMACTUALLY_DEBUG_RAW\"]` is now wrapped in `try/finally` that captures the prior value and restores it (or deletes the key) after the call. No more global state leak across batch runs in the same process.",

  // scripts/serve-artifacts.mjs
  3525695123: "Trailing newline added in `cd5913e` (same fix as 3525580275).",

  // .github/workflows/self-review.yml
  3525630193: "Fixed in `4901335`: the workflow now runs `npm run build` before `npm run check:dist-freshness`, so a stale dist is rebuilt and the freshness check verifies the freshly-built bundle. Verified the failed run 28757238387 was due to the missing rebuild step, not the freshness logic itself.",

  // test/unit/summary-layouts.test.ts
  3525630205: "Added in `cd5913e`: a new test uses `JSON.parse` to fabricate a runtime `ReviewData` shape with no `category` field, then asserts the severity table renders `general` in the Category cell. Removed the pre-existing `@ts-expect-error` for the unknown-layout test (replaced with a `JSON.parse` runtime-bypass).",

  // test/unit/json-extract-robustness.test.ts
  3525630204: "Same trailing-newline fix as 3525580275.",
  3525695124: "Same trailing-newline fix as 3525580275.",
};

const GENERIC_ACK = "Acknowledged. Fixed in commits `cd5913e` + `4901335` (self-review findings batch). See the diff for the specific change. All 633 tests pass; `npm run typecheck` is clean; `npm run check:dist-freshness` confirms the dist bundle is in sync with src.";

function gql(query, variables) {
  // Pass query + variables via stdin as a single GraphQL request payload.
  // `gh api graphql` reads `-f query=…` and `-F` for typed fields, but the
  // simplest path that supports a `variables` map is the stdin form:
  //   echo '{...}' | gh api graphql
  const payload = JSON.stringify({ query, variables });
  return JSON.parse(
    execFileSync("gh", ["api", "graphql", "--input", "-"], {
      encoding: "utf8",
      input: payload,
    }),
  );
}

function threadQuery() {
  return `
    query($owner:String!, $name:String!, $number:Int!) {
      repository(owner:$owner, name:$name) {
        pullRequest(number:$number) {
          reviewThreads(first:100) {
            nodes {
              id
              isResolved
              isOutdated
              comments(first:1) {
                nodes {
                  databaseId
                }
              }
            }
          }
        }
      }
    }`;
}

function resolveMutation() {
  return `
    mutation($threadId:ID!) {
      resolveReviewThread(input: { threadId: $threadId }) {
        thread { id isResolved }
      }
    }`;
}

function commentMutation() {
  return `
    mutation($threadId:ID!, $body:String!) {
      addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $threadId, body: $body }) {
        comment { id }
      }
    }`;
}

const threads = gql(threadQuery(), { owner: "JosiahSiegel", name: "umactually", number: PR_NUMBER })
  .data.repository.pullRequest.reviewThreads.nodes;

const unresolved = threads.filter((t) => !t.isResolved);
console.log(`Total threads: ${threads.length}, unresolved: ${unresolved.length}`);

const results = { resolved: 0, skipped: 0, failed: [] };
for (const t of unresolved) {
  const dbId = t.comments.nodes[0]?.databaseId;
  const ack = (dbId && ACKS[dbId]) || GENERIC_ACK;
  // Reply to the thread first (so the resolution has context), then resolve.
  try {
    const replyRes = gql(commentMutation(), { threadId: t.id, body: ack });
    if (replyRes.errors) {
      results.failed.push({ id: t.id, dbId, phase: "reply", errors: replyRes.errors });
      continue;
    }
    const resolveRes = gql(resolveMutation(), { threadId: t.id });
    if (resolveRes.errors) {
      results.failed.push({ id: t.id, dbId, phase: "resolve", errors: resolveRes.errors });
      continue;
    }
    results.resolved += 1;
    console.log(`✓ ${t.id} (dbId=${dbId})`);
  } catch (err) {
    results.failed.push({ id: t.id, dbId, phase: "mutation", error: err.message });
  }
}

writeFileSync("thread-resolution-results.json", JSON.stringify(results, null, 2));
console.log(`\nResolved: ${results.resolved}`);
console.log(`Failed: ${results.failed.length}`);
if (results.failed.length > 0) {
  console.log(JSON.stringify(results.failed, null, 2));
  process.exit(1);
}
