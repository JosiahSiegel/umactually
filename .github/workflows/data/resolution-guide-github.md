
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

> ⚠️ **Merge gate**: If this repo enforces "Require conversation resolution before merging" as a branch-protection rule, every open thread — including umactually review threads — must be marked **Resolved** before the merge button is enabled. A single unresolved thread blocks the merge until Step 3 is applied to it.

The full guide (including Azure DevOps-specific guidance, common pitfalls, and the matching `az repos pr thread update --status closed` recipe) lives at `.github/SELF-REVIEW-RESOLUTION-GUIDE.md`.

</details>
