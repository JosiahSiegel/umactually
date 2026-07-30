
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

> ⚠️ **Merge gate**: If this project enforces "Require a minimum number of reviewers" with conversation-completion policies, every open thread — including umactually review threads — must be marked **Closed** (status `closed`) before the merge policy is satisfied. A single unresolved thread blocks merge completion until Step 3 is applied to it.

The full guide (including platform-agnostic context, GitHub-specific mutation recipe, and common pitfalls) lives at `.github/SELF-REVIEW-RESOLUTION-GUIDE.md`.

</details>
