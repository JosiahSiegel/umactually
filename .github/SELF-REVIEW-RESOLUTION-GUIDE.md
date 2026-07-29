# Agent-facing resolution guide for umactually self-review threads

> **Audience:** any AI agent (or human) reading this umactually review. The CLI posts inline review threads under the marker `<!-- umactually -->`. This guide tells you how to read the comments, determine their disposition, and actually resolve the threads on the platform so the PR's review state is clean.

## How to read this review

Every inline comment is a **discrete reviewable item** with a `path:line` anchor and a `severity / category / body`. Triage every comment into exactly one of:

| Disposition | Meaning | Action |
|---|---|---|
| `accepted defect` | Comment identifies a real bug. The fix lives at `path:line`. | Edit code, rebuild `dist/`, push. Reply on the thread pointing at the fix commit SHA. |
| `false positive` | Comment is technically wrong or describes a non-issue. | Reply on the thread with the reason. Do not change code. |
| `duplicate` | Comment overlaps an earlier thread (the marker-dedup is best-effort). | Reply "duplicate of <link>". Resolve. |
| `off-diff` | Comment points at a line that's not in this PR's diff. | Reply "off-diff". Resolve. |
| `stale (fixed in a later commit)` | Comment was valid against an earlier head but the current head has the fix. | **Verify the fix is in the current head's source** (not just the head the bot anchored to). Reply with the fix SHA + line. Resolve. |
| `style / rejected` | Comment is opinion-only or violates the audit bundle's must-not list (no feature additions, no mechanical installer DRY, no `src/cli.ts` refactor without black-box proof). | Reply "out of scope per audit bundle §L". Resolve. |

**Rule:** never silently ignore a comment. Either fix it or reply with a disposition. An unaddressed comment is a blocker.

## How to resolve a thread on GitHub

GitHub's REST API resolves threads by **replying** to the comment. The CLI does not auto-resolve (its marker-dedup is best-effort per the audit bundle §E + `live-github.ts:139-209`). To resolve manually:

```bash
# 1. List all inline review comments on the PR (returns id, path, line, commit_id, body)
gh api /repos/{owner}/{repo}/pulls/{pr}/comments --jq '.[] | {id, path, line, commit_id, body: (.body | .[0:80])}'

# 2. Reply on the thread to dismiss it (the reply must come from a user with write access)
gh pr review {pr} --repo {owner}/{repo} --reply {comment_id} --body "<disposition message>"

# 3. To mark a thread as RESOLVED, you must reply AND the original review must be a PENDING review
#    that is then submitted. If the review was already submitted (the common case for the bot's
#    auto-post), the thread can only be DISMISSED via "Resolve conversation" in the UI, or via
#    the GraphQL API:
gh api graphql -f query='
  mutation($id: ID!) {
    resolveReviewThread(input: {threadId: $id}) { thread { isResolved } }
  }
' -f id=<THREAD_NODE_ID>
```

The `THREAD_NODE_ID` comes from `gh api graphql` query against the pull request's review threads:

```bash
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
```

## How to resolve a thread on Azure DevOps

Azure DevOps has no marker-dedup at all (per the audit bundle §E + `live-azure.ts:255-277`). Every `umactually review` invocation posts fresh threads. To resolve:

```bash
# 1. List threads on the PR (ADO uses "comments" + "threads" model)
az repos pr thread list --id {pr_id} --output json | jq '.[] | {id, status, comments: [.comments[] | {id, content: (.content | .[0:80])}]}'

# 2. Reply to a thread (ADO uses thread status, not per-comment resolution)
az repos pr thread update --id {pr_id} --thread-id {thread_id} --status closed

# To re-open:
az repos pr thread update --id {pr_id} --thread-id {thread_id} --status active
```

The ADO `--status closed` is the only resolution semantic. There is no equivalent of GitHub's per-thread "Resolve conversation" — closing the thread is final.

## Verifying you actually resolved

After replying and closing, re-list the comments and verify:

```bash
# GitHub
gh api /repos/{owner}/{repo}/pulls/{pr}/comments --jq '[.[] | select(.position != null)] | length'
# Should be 0 if all threads were dismissed via GraphQL resolveReviewThread

# Azure DevOps
az repos pr thread list --id {pr_id} --output json | jq '[.[] | select(.status == "active")] | length'
# Should be 0 if all threads are closed
```

## Common pitfalls

1. **Stale threads from a prior commit.** The CLI anchors inline comments to the **commit the bot saw at review time**, not the current PR head. After you push a fix, the comment stays open and points at the OLD line — even though the NEW line is fixed. Verify the fix is in the current head's source before dismissing.

2. **`review-exit=0` ≠ clean review.** The self-review workflow deliberately exits 0 even on provider timeout/parse-failure (`.github/workflows/self-review.yml`). The only ground truth is the artifact + the inline comments.

3. **The `<details>` summary is yours to render.** When posting the resolution guide as a comment, use a `<details>` block so the bulk of the guide is collapsed. Future agents reading the conversation see the disposition immediately and can expand for the full recipe.

4. **Don't auto-resolve without a disposition reply.** Closing a thread with no body leaves the audit trail incomplete. Always reply first, then close.
