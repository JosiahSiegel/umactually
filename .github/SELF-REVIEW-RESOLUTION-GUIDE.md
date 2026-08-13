# Agent-facing resolution guide for umactually self-review threads

> **Audience:** any AI agent (or human) reading an umactually review. The CLI posts inline review threads under the marker `<!-- umactually -->`. This guide tells you how to read the comments, determine their disposition, and actually resolve the threads on the platform that the CLI ran against.

> **First-pass readers: start with the AI-agent header in the workflow-appended guide.** The bot's review body always includes the platform-specific resolution guide at `.github/workflows/data/resolution-guide-{github,azure}.md`. Those files lead with an open (un-collapsed) `## For AI agents — read this first` section that contains the disposition matrix, the reply/resolve/verify commands, and the review-verdict gate — visible without expanding any `<details>` collapse. **Read that header first** before falling back to this doc for the full platform-agnostic context and common pitfalls.

## 0. Determine which platform this review targets

The CLI accepts `--platform <auto|github|azure>`. Use the same value the CLI used:

```bash
# Check the env vars that drive platform auto-detect
[ -n "$GITHUB_ACTIONS" ] && platform=github
[ -n "$TF_BUILD" ] && platform=azure
[ -z "${platform:-}" ] && platform=auto

# Check the workflow file that ran this review
#   .github/workflows/*.yml     → github
#   azure-pipelines.yml         → azure
```

If you can't tell, **default to GitHub** (most umactually review runs today are GitHub PRs; Azure DevOps is supported but the workflow harness is less mature). Then read **only the GitHub section** below.

When in doubt, the CI workflow name tells you:

| Trigger | Platform |
|---|---|
| `.github/workflows/self-review.yml` `pull_request` event | **GitHub** |
| `azure-pipelines.yml` PR pipeline | **Azure DevOps** |
| `workflow_dispatch` (no PR context) | **standalone** (CLI writes `umactually-review.json` but does NOT post threads — nothing to resolve) |

---

## How to read this review (platform-agnostic)

Every inline comment is a **discrete reviewable item** with a `path:line` anchor and a `severity / category / body`. Triage every comment into exactly one of:

| Disposition | Meaning |
|---|---|
| `accepted defect` | Comment identifies a real bug at `path:line`. Fix it, push, reply with the fix SHA. |
| `false positive` | Technically wrong or non-issue. Reply with the reason. Do not change code. |
| `duplicate` | Overlaps an earlier thread (marker-dedup is best-effort). Reply "duplicate of <link>". Resolve. |
| `off-diff` | Line is not in this PR's diff. Reply "off-diff". Resolve. |
| `stale (fixed in a later commit)` | Valid against an earlier head but the current head has the fix. **Verify the fix is in the current head's source** (not just the head the bot anchored to). Reply with the fix SHA + line. Resolve. |
| `style / rejected` | Opinion-only or violates the audit bundle's must-not list. Reply "out of scope per audit bundle §L". Resolve. |

**Rule:** never silently ignore a comment. Either fix it or reply with a disposition. An unaddressed comment is a blocker.

---

# GitHub section (read this if the platform is GitHub)

GitHub's REST API resolves threads by **replying** and (for the GraphQL route) by calling `resolveReviewThread`. The CLI does not auto-resolve (its marker-dedup is best-effort per the audit bundle §E + `live-github.ts:139-209`).

## List inline review comments

```bash
gh api /repos/{owner}/{repo}/pulls/{pr}/comments --jq '.[] | {
  id, path, line,
  commit_id: (.commit_id | .[0:7]),
  body: (.body | .[0:80])
}'
```

## Reply on a thread (dismiss with disposition)

```bash
gh pr review {pr} --repo {owner}/{repo} --reply {comment_id} --body "<disposition message>"
```

## Resolve the thread (mark as RESOLVED in the UI)

GitHub threads created by a submitted review can only be dismissed via the GraphQL API:

```bash
# Get the thread node IDs
gh api graphql -f query='
  query($pr: ID!) {
    node(id: $pr) {
      ... on PullRequest {
        reviewThreads(first: 50) {
          nodes { id isResolved comments(first: 1) { nodes { databaseId body } } }
        }
      }
    }
  }
' -f id=$(gh pr view {pr} --repo {owner}/{repo} --json id --jq .id)

# Resolve a specific thread
gh api graphql -f query='
  mutation($id: ID!) {
    resolveReviewThread(input: {threadId: $id}) { thread { isResolved } }
  }
' -f id=<THREAD_NODE_ID>
```

## Verify all threads are resolved

```bash
gh api graphql -f query='
  query($pr: ID!) {
    node(id: $pr) {
      ... on PullRequest {
        reviewThreads(first: 100) {
          nodes { id isResolved }
        }
      }
    }
  }
' -f id=$(gh pr view {pr} --repo {owner}/{repo} --json id --jq .id) \
  --jq '[.data.node.reviewThreads.nodes[] | select(.isResolved == false)] | length'
# Expected: 0
```

---

# Azure DevOps section (read this if the platform is Azure DevOps)

Azure DevOps has no marker-dedup at all (per the audit bundle §E + `live-azure.ts:255-277`). Every `umactually review` invocation posts fresh threads. To resolve: close the thread (ADO has no per-thread "Resolve" semantic — `closed` is final).

## List threads on the PR

```bash
az repos pr thread list --id {pr_id} --output json | jq '.[] | {
  id, status,
  comments: [.comments[] | {id, content: (.content | .[0:80])}]
}'
```

## Reply to a thread with a disposition

```bash
az repos pr thread update \
  --id {pr_id} \
  --thread-id {thread_id} \
  --comment "<disposition message>"
```

## Close the thread (the only resolution semantic)

```bash
az repos pr thread update \
  --id {pr_id} \
  --thread-id {thread_id} \
  --status closed

# To re-open (rare; only if you dismissed the wrong thread):
az repos pr thread update --id {pr_id} --thread-id {thread_id} --status active
```

## Verify all threads are closed

```bash
az repos pr thread list --id {pr_id} --output json \
  | jq '[.[] | select(.status == "active")] | length'
# Expected: 0
```

---

## Common pitfalls (platform-agnostic)

1. **Stale threads from a prior commit.** The CLI anchors inline comments to the **commit the bot saw at review time**, not the current PR head. After you push a fix, the comment stays open and points at the OLD line — even though the NEW line is fixed. Verify the fix is in the current head's source before dismissing.

2. **`review-exit=0` ≠ clean review.** The self-review workflow deliberately exits 0 even on provider timeout/parse-failure (`.github/workflows/self-review.yml`). The only ground truth is the artifact + the inline comments.

3. **Render this guide as a collapsed `<details>` block** when posting on a PR. Future agents reading the conversation see the disposition immediately and can expand for the full recipe.

4. **Don't auto-resolve without a disposition reply.** Closing a thread with no body leaves the audit trail incomplete. Always reply first, then close.

5. **If you're not sure which platform, default to GitHub.** The vast majority of umactually review runs today target GitHub PRs.
