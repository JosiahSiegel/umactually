
---

<details>
<summary>📖 <b>How to read + resolve these umactually threads — click to expand</b></summary>

The umactually CLI posted this review against **GitHub** (a `pull_request` event with `GITHUB_ACTIONS=true`). The marker-dedup is **best-effort** — bot inline comments stay anchored to the commit the bot saw, NOT the current head. After fixes land, threads stay open until you dismiss them.

### Step 0 — confirm the platform

```bash
[ -n "${GITHUB_ACTIONS:-}" ] && platform=github
[ -n "${TF_BUILD:-}" ] && platform=azure
[ -z "${platform:-}" ] && platform=auto   # default to GitHub if unsure
```

For Azure DevOps, see `.github/SELF-REVIEW-RESOLUTION-GUIDE.md` §Azure DevOps section.

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

GitHub threads from a submitted review can only be dismissed via GraphQL:

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

The full guide (including Azure DevOps section + common pitfalls) lives at `.github/SELF-REVIEW-RESOLUTION-GUIDE.md`.

</details>
