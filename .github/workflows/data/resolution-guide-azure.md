
## For AI agents — read this first

> Platform: **Azure DevOps**. Resolution path: `az repos pr thread update --status closed` after a reply; Azure DevOps has no GitHub-style GraphQL `resolveReviewThread` — thread closure is the only resolution semantic.

### Triage every thread

| Disposition | When |
|---|---|
| `accepted defect` | Real bug; fix it + push + reply with the fix SHA. |
| `false positive` | Technically wrong; reply with the reason; do not change code. |
| `duplicate` | Overlaps an earlier thread; reply "duplicate of <link>". |
| `off-diff` | Line not in this PR's diff; reply "off-diff". |
| `stale (fixed in a later commit)` | Valid against an earlier head; **verify the fix is in the current head's source**, reply with fix SHA + line. |
| `style / rejected` | Opinion-only or violates the audit bundle's must-not list; reply "out of scope per audit bundle §L". |

**Never silently ignore a comment.** Either fix it or reply with a disposition.

### How to resolve this thread

**Reply on the thread** (`az repos pr comment add`):

```bash
THREAD_ID="<THREAD_NODE_ID>"  # the comment thread ID from the inline finding
REPLY_BODY="<disposition message>"
PR_ID="$(az repos pr show --id <PR_NUMBER> --organization <ORG> --project <PROJECT> --query id -o tsv)"
az repos pr comment add \
  --id "${PR_ID}" \
  --content "${REPLY_BODY}" \
  --thread-id "${THREAD_ID}" \
  --organization <ORG> --project <PROJECT>
```

**Resolve the thread** (`az repos pr thread update --status closed`):

```bash
az repos pr thread update \
  --id "${THREAD_ID}" \
  --status closed \
  --organization <ORG> --project <PROJECT>
```

**Verify all threads resolved** (expected count 0):

```bash
az repos pr thread list \
  --id "${PR_ID}" \
  --organization <ORG> --project <PROJECT> \
  --query "[?status=='active'] | length(@)" -o tsv
# Expected: 0
```

### Review verdict

Azure DevOps does not use the GitHub-style `CHANGES_REQUESTED` review-verdict gate; the equivalent block is the PR's **status check** + **required-reviewer policy**. The bot's most recent verdict is exposed as `postedStatusState`:

| `postedStatusState` | Meaning | Merge impact |
|---|---|---|
| `succeeded` | Bot reviewed, no NEEDS_FIX findings | No block |
| `pending` | Bot reviewed, NEEDS_FIX findings present (live CLI uses "current" policy) | May block if status-check policy is enabled |
| `failed` | Bot reviewed under the "legacy" policy and found NEEDS_FIX (S4 dry-run only) | May block if status-check policy is enabled |

```bash
# Inspect the bot's most recent dry-run artifact (location depends on --output-artifact)
cat artifacts/manual/s4-azure-mocked-run.json | jq '.postedStatusState'
# Or, for live reviews, the run logs:
gh run view <RUN_ID> --repo <owner>/<repo> --log | grep "umactually:" | tail -20
```

If the verdict is `failed`/`pending` AND there are no underlying findings you can address (e.g. the verdict was rendered against code you've since removed), re-push and let the bot re-review. On Azure DevOps, the dismissal path is **UI-only** (PR → "..." → "Reset vote" / "Re-vote") — there is no equivalent of GitHub's `dismissPullRequestReview` GraphQL mutation in the `azure-devops` CLI extension (as of 0.30+). Alternatively, wait for the bot's next review to overwrite the previous state with a new `postedStatusState`.

> 🤖 **AI-Agent note**: As of `azure-devops` extension 0.30+, `az repos pr policy` exposes evaluation results but not a programmatic "clear all blocking reviews" command. If you're a coding agent and `postedStatusState` blocks a merge you can otherwise satisfy, escalate to the human operator rather than burning turns trying CLI mutations that don't exist.

The full guide (including platform-agnostic context, GitHub-specific mutation recipe, and common pitfalls) lives at `.github/SELF-REVIEW-RESOLUTION-GUIDE.md`.

<details>
<summary>📖 <b>How to read + resolve these umactually threads — click to expand</b></summary>

The umactually CLI ran with `--platform azure` against this `pull_request` event on an Azure DevOps pipeline, so every thread below was posted via Azure DevOps' PR thread API and is resolvable only via the `az repos pr thread update --status closed` command below — **not** via GitHub's GraphQL `resolveReviewThread` (no such API exists on Azure DevOps).

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

> 🔒 **Resolve properly, don't just click "Close".** Every thread must get a reply (Step 2) **before** it is closed (Step 3). A bare close with no reply — or a reply that doesn't address the finding — leaves reviewers unable to audit your reasoning and violates the spirit of conversation-completion policies. Acceptable reply examples:
> - **Fixed** → `Fixed in <SHA>, <file>:<line> — <one-line summary of the change>.`
> - **False positive** → `False positive: <reason>. The code does X because Y.`
> - **Duplicate** → `Duplicate of <thread-link>.`
> - **Stale** → `Fixed in <SHA>. Verified at <file>:<line> on current head.`
> - **Out of scope** → `Out of scope per audit bundle §<section>.`
>
> Only **after** the reply lands should you run Step 3 (`az repos pr thread update --status closed`).

### Step 2 — reply on each thread

```bash
THREAD_ID="<THREAD_NODE_ID>"  # the comment thread ID from the inline finding
REPLY_BODY="<disposition message>"
PR_ID="$(az repos pr show --id <PR_NUMBER> --organization <ORG> --project <PROJECT> --query id -o tsv)"
az repos pr comment add \
  --id "${PR_ID}" \
  --content "${REPLY_BODY}" \
  --thread-id "${THREAD_ID}" \
  --organization <ORG> --project <PROJECT>
```

### Step 3 — resolve the thread (mark CLOSED in the UI)

```bash
az repos pr thread update \
  --id "${THREAD_ID}" \
  --status closed \
  --organization <ORG> --project <PROJECT>
```

### Step 4 — verify all threads are resolved

```bash
az repos pr thread list \
  --id "${PR_ID}" \
  --organization <ORG> --project <PROJECT> \
  --query "[?status=='active'] | length(@)" -o tsv
# Expected: 0
```

### Step 5 — check the bot's review verdict

Azure DevOps does not use the GitHub-style `CHANGES_REQUESTED` review-verdict gate; the equivalent block is the PR's **status check** + **required-reviewer policy**. The umactually bot's most recent verdict is exposed as `postedStatusState` (set when the bot runs):

| `postedStatusState` | Meaning | Merge impact |
|---|---|---|
| `succeeded` | Bot reviewed, no NEEDS_FIX findings | No block |
| `pending` | Bot reviewed, NEEDS_FIX findings present (live CLI uses "current" policy) | May block if status-check policy is enabled |
| `failed` | Bot reviewed under the "legacy" policy and found NEEDS_FIX (S4 dry-run only) | May block if status-check policy is enabled |

Pull the bot's latest review from the live artifact or the dry-run JSON; if `postedStatusState` is `failed` or `pending`, treat that as a "CHANGES_REQUESTED equivalent" and address the underlying findings.

```bash
# Inspect the bot's most recent dry-run artifact (location depends on --output-artifact)
cat artifacts/manual/s4-azure-mocked-run.json | jq '.postedStatusState'
# Or, for live reviews, the run logs:
gh run view <RUN_ID> --repo <owner>/<repo> --log | grep "umactually:" | tail -20
```

If the verdict is `failed`/`pending` AND there are no underlying findings you can address (e.g. the verdict was rendered against code you've since removed), re-push and let the bot re-review. On Azure DevOps, the dismissal path is **UI-only** (PR → "..." → "Reset vote" / "Re-vote") — there is no equivalent of GitHub's `dismissPullRequestReview` GraphQL mutation in the `azure-devops` CLI extension (as of 0.30+). Alternatively, wait for the bot's next review to overwrite the previous state with a new `postedStatusState`.

> 🤖 **AI-Agent note**: As of `azure-devops` extension 0.30+, `az repos pr policy` exposes evaluation results but not a programmatic "clear all blocking reviews" command. If you're a coding agent and `postedStatusState` blocks a merge you can otherwise satisfy, escalate to the human operator rather than burning turns trying CLI mutations that don't exist.

### Step 6 — verify the merge is actually unblocked

Both gates must clear:

```bash
# Gate 1: no unresolved threads (Step 4 expected 0)
# Gate 2: bot's postedStatusState is 'succeeded' (Step 5)
# Gate 3: all required policy evaluations pass
az repos pr policy list --id "${PR_ID}" \
  --organization <ORG> --project <PROJECT> \
  --query "[?status.name!=='approved'] | length(@)" -o tsv
# Expected: 0
```

If `policy list` returns a non-zero count, fetch the policy evaluations to see which policy is failing.

> ⚠️ **Merge gate**: If this project enforces "Require a minimum number of reviewers" with conversation-completion policies, every open thread — including umactually review threads — must be marked **Closed** (status `closed`) before the merge policy is satisfied. A single unresolved thread blocks merge completion until Step 3 is applied to it. **A `failed` or `pending` `postedStatusState` blocks required status-check policies independently** — Step 6 catches what Step 4 misses.

The full guide (including platform-agnostic context, GitHub-specific mutation recipe, and common pitfalls) lives at `.github/SELF-REVIEW-RESOLUTION-GUIDE.md`.

</details>
