
<details>
<summary>📖 <b>How to read + resolve these umactually threads — click to expand</b></summary>

The umactually CLI ran with `--platform github` against this `pull_request` event on `actions/checkout@v4`, so every thread below was posted via GitHub's review API and is resolvable only via the GraphQL mutations below — **not** by replying through the GitHub UI's "Resolve conversation" button (that path is intentionally disabled for review-thread-style comments; the GraphQL mutation is the canonical dismiss path).

The marker-dedup is **best-effort** — bot inline comments stay anchored to the commit the bot saw, NOT the current head. After fixes land, threads stay open until you dismiss them.

### Step 1 — triage every thread

| Disposition | When |
|---|---|
| `accepted defect` | Real bug; fix it + push + reply with the fix SHA. |
| `false positive` | Technically wrong; reply with the reason; do not change code. |
| `duplicate` | Overlaps an earlier thread; reply "duplicate of <link>". |
| `off-diff` | Line not in this PR's diff; reply "off-diff". |
| `stale (fixed in a later commit)` | Valid against an earlier head; **verify the fix is in the current head's source**, reply with fix SHA + line. |
| `style / rejected` | Opinion-only or violates the audit bundle's must-not list; reply "out of scope per audit bundle §L". |

**Never silently ignore a comment.** Either fix it or reply with a disposition.

> 🔒 **Resolve properly, don't just click "Resolve".** Every thread must get a reply (Step 2) **before** it is resolved (Step 3). A bare resolve with no reply — or a reply that doesn't address the finding — leaves reviewers unable to audit your reasoning and violates the spirit of branch-protection rules. Acceptable reply examples:
> - **Fixed** → `Fixed in <SHA>, <file>:<line> — <one-line summary of the change>.`
> - **False positive** → `False positive: <reason>. The code does X because Y.`
> - **Duplicate** → `Duplicate of <thread-link>.`
> - **Stale** → `Fixed in <SHA>. Verified at <file>:<line> on current head.`
> - **Out of scope** → `Out of scope per audit bundle §<section>.`
>
> Only **after** the reply lands should you run Step 3 (`resolveReviewThread`).

### Step 2 — reply on each thread

```bash
GH="gh" && $GH api graphql -F threadId="<THREAD_NODE_ID>" -F body="<disposition>" \
  -f query='mutation($threadId: ID!, $body: String!) {
    addPullRequestReviewThreadReply(input: {pullRequestReviewThreadId: $threadId, body: $body}) {
      comment { id }
    }
  }'
```

### Step 3 — resolve the thread (mark RESOLVED in the UI)

```bash
GH="gh" && $GH api graphql -F id="<THREAD_NODE_ID>" \
  -f query='mutation($id: ID!) {
    resolveReviewThread(input: {threadId: $id}) { thread { isResolved } }
  }'
```

### Step 4 — verify all threads are resolved

```bash
GH="gh" && $GH api graphql -F pr="$($GH pr view <N> --repo <owner>/<repo> --json id --jq .id)" \
  -f query='query($pr: ID!) {
    node(id: $pr) {
      ... on PullRequest { reviewThreads(first: 100) { nodes { id isResolved } } }
    }
  }' --jq '[.data.node.reviewThreads.nodes[] | select(.isResolved == false)] | length'
# Expected: 0
```

### Step 5 — check the review verdict (a separate gate from threads)

Resolving every thread is **necessary but not sufficient**. A review with state `CHANGES_REQUESTED` blocks merge independently of thread state via GitHub's standard review-verdict gate (the merge button checks "no CHANGES_REQUESTED reviews" before enabling). The umactually self-review bot submits reviews with verdict derived from its findings: any inline critical or high-severity finding produces `CHANGES_REQUESTED`.

```bash
$GH pr view <N> --repo <owner>/<repo> --json reviewDecision --jq .reviewDecision
# Expected: APPROVED | null  (means mergeable)
# CHANGES_REQUESTED  (means blocked — proceed below)
```

If `reviewDecision == "CHANGES_REQUESTED"`, you have three options, in increasing order of intrusiveness:

| Option | When to use | What it does |
|---|---|---|
| **Re-push + wait for re-review** | You addressed every finding the CHANGES_REQUESTED review cited | A new commit re-triggers `self-review.yml`; the bot's new review supersedes the old one (combined with `dismiss_stale_reviews_on_push: true` in the ruleset — verify this is set; if absent, the old CHANGES_REQUESTED stays). |
| **Dismiss the stale review in the UI** | The CHANGES_REQUESTED cites code you've since removed/fixed, OR the bot mis-classified severity | Open the PR → "X changes requested" header on the bot's review → click "..." → "Dismiss review". This is a UI-only action — there's no GraphQL mutation for it. |
| **Fix the underlying finding and re-push** | The finding is real and you haven't addressed it | Treat it as an accepted-defect per Step 1's triage matrix; fix + commit + push. |

> 🤖 **AI-Agent note**: As of the GitHub GraphQL API there is no `dismissPullRequestReview` mutation. The dismissal flow is **UI-only** — an agent cannot programmatically clear a CHANGES_REQUESTED verdict. If you're a coding agent operating against this repo and you hit `reviewDecision == CHANGES_REQUESTED` with no path to a UI dismissal, escalate to the human operator rather than burning turns trying `gh api graphql` mutations that don't exist.

> 🔁 **The re-review race**: After you push a fix, the bot's self-review re-runs asynchronously (typically 30-90s after the push reaches GitHub). Re-check `reviewDecision` *after* the new self-review completes, not immediately after the push — `reviewDecision` reflects the latest review verdict, which lags the push by one bot cycle. The `gh pr checks <N>` output will show a `self-review` row that transitions `IN_PROGRESS → SUCCESS`; once it lands, re-query `reviewDecision`.

### Step 6 — verify the merge is actually unblocked

Both gates must clear:

```bash
# Gate 1: no unresolved threads (Step 4 expected 0)
# Gate 2: no CHANGES_REQUESTED review verdict (Step 5 expected APPROVED or null)
# Gate 3: required status checks passing
$GH pr view <N> --repo <owner>/<repo> --json mergeStateStatus,mergeable,reviewDecision,statusCheckRollup \
  --jq '{state: .mergeStateStatus, mergeable: .mergeable, decision: .reviewDecision, checks: [.statusCheckRollup[] | select(.state != "SUCCESS") | .name]}'
# Expected: state=CLEAN, mergeable=MERGEABLE, decision in (null, "APPROVED"), checks=[]
```

If `mergeStateStatus == "BLOCKED"` with all gates green, the block is from a *ruleset* (not visible via `--json`); fetch the ruleset to see which rule is failing.

> ⚠️ **Merge gate**: If this repo enforces "Require conversation resolution before merging" as a branch-protection rule, every open thread — including umactually review threads — must be marked **Resolved** before the merge button is enabled. A single unresolved thread blocks the merge until Step 3 is applied to it. **A `CHANGES_REQUESTED` review verdict blocks merge independently** — Step 6 catches what Step 4 misses.

The full guide (including Azure DevOps-specific guidance, common pitfalls, and the matching `az repos pr thread update --status closed` recipe) lives at `.github/SELF-REVIEW-RESOLUTION-GUIDE.md`.

</details>
