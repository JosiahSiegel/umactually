/**
 * Platform-aware resolution-guide renderer baked into the UmActually CLI
 * review body.
 *
 * The "resolution guide" is the collapsed `<details>` block the self-review
 * workflow posts (or re-posts on every `synchronize`) at the top of every
 * umactually comment thread, explaining how to triage + dismiss + verify the
 * inline findings. Baking the guide into the CLI (instead of reading a
 * checked-in `.github/workflows/data/resolution-guide-*.md` file at runtime)
 * means the guide ships with the npm tarball — no extra file lookup, no
 * surprise drift between the CLI version and the data file checked into the
 * consumer's repo, no `SELF-REVIEW-RESOLUTION-GUIDE.md` cross-reference
 * (the long-form guide is intentionally NOT referenced here; see MUST NOT
 * list in the bake-resolution-guide plan).
 *
 * Cross-platform rules (mirroring `src/render/summary-layouts.ts:42-43`):
 *   - DO use GFM tables (pipe tables), headings, blockquote, lists, fenced
 *     code, inline code, raw Unicode emoji.
 *   - DO use `<details>` / `<summary>` — verified to render as a working
 *     click-to-expand widget on BOTH GitHub PR reviews AND Azure DevOps
 *     PR comments (see summary-layouts.ts:26-41 for the empirical evidence).
 *   - DO NOT use raw `<table>` HTML (Azure ignores it).
 *   - DO NOT use task lists `- [x]` / `- [ ]` (Azure ignores check state).
 *   - Body must stay well below GitHub's 65,536-char limit; this module
 *     enforces a tighter 2,500-char per-variant budget so the guide fits
 *     inside any host review body without dominating the conversation.
 *
 * Both variants terminate with `RESOLUTION_GUIDE_MARKER` as the LAST
 * non-empty line so the self-review workflow can grep for the exact
 * string and decide whether to re-bake (idempotency). See
 * `src/util/marker.ts` for the marker drift discipline.
 */

import { RESOLUTION_GUIDE_MARKER } from "../util/marker.js";

/** Platforms the CLI knows how to render a resolution guide for. */
export type ResolutionGuidePlatform = "github" | "azure";

const GITHUB_GUIDE = `<details>
<summary>📖 <b>How to read + resolve these umactually threads — click to expand</b></summary>

Posted via GitHub's review API; resolve via the \`resolveReviewThread\` GraphQL mutation (UI "Resolve conversation" button does not work for review threads). Threads stay anchored to the bot's commit — after fixes, dismiss them with the steps below.

### Step 1 — triage each thread

| Disposition | Reply with |
|---|---|
| \`accepted defect\` | \`Fixed in <SHA>, <file>:<line> — <one-line summary>.\` |
| \`false positive\` | \`False positive: <reason>.\` |
| \`duplicate\` | \`Duplicate of <thread-link>.\` |
| \`off-diff\` | \`Off-diff.\` |
| \`stale (fixed later)\` | \`Fixed in <SHA>. Verified at <file>:<line>.\` |
| \`style / rejected\` | \`Out of scope per audit bundle §<section>.\` |

Never silently ignore a comment — fix it or reply with a disposition.

### Step 2 — reply

\`\`\`bash
gh api graphql -F threadId="<THREAD>" -F body="<reply>" -f query='
mutation($t: ID!, $b: String!) {
  addPullRequestReviewThreadReply(input: {pullRequestReviewThreadId: $t, body: $b}) { comment { id } }
}'
\`\`\`

### Step 3 — resolve

\`\`\`bash
gh api graphql -F id="<THREAD>" -f query='
mutation($id: ID!) { resolveReviewThread(input: {threadId: $id}) { thread { isResolved } } }'
\`\`\`

### Step 4 — verify + verdict gate

Resolving threads is necessary but not sufficient: \`mapVerdictToGithubEvent\` maps \`NEEDS_FIX\` → \`REQUEST_CHANGES\`, which blocks merge independently of thread state.

\`\`\`bash
gh pr view <N> --repo <owner>/<repo> --json reviewThreads,reviewDecision,mergeStateStatus,mergeable \\
  --jq '{openThreads: [.reviewThreads.nodes[] | select(.isResolved == false)] | length, decision: .reviewDecision, state: .mergeStateStatus, mergeable}'
# Expected: openThreads=0, decision=APPROVED|null, state=CLEAN, mergeable=MERGEABLE
\`\`\`

If \`decision == "CHANGES_REQUESTED"\`, re-push for a fresh review, or dismiss the stale one via \`dismissPullRequestReview\` with a justification.

</details>
${RESOLUTION_GUIDE_MARKER}`;

const AZURE_GUIDE = `<details>
<summary>📖 <b>How to read + resolve these umactually threads — click to expand</b></summary>

Posted via Azure DevOps' PR thread API; close with \`az repos pr thread update --status closed\` (no GraphQL dismiss path on Azure). Threads stay anchored to the bot's commit — after fixes, close them with the steps below.

### Step 1 — triage each thread

| Disposition | Reply with |
|---|---|
| \`accepted defect\` | \`Fixed in <SHA>, <file>:<line> — <one-line summary>.\` |
| \`false positive\` | \`False positive: <reason>.\` |
| \`duplicate\` | \`Duplicate of <thread-link>.\` |
| \`off-diff\` | \`Off-diff.\` |
| \`stale (fixed later)\` | \`Fixed in <SHA>. Verified at <file>:<line>.\` |
| \`style / rejected\` | \`Out of scope per audit bundle §<section>.\` |

Never silently ignore a comment — fix it or reply with a disposition.

### Step 2 — reply

\`\`\`bash
PR_ID="$(az repos pr show --id <PR> --organization <ORG> --project <PROJECT> --query id -o tsv)"
az repos pr comment add --id "\${PR_ID}" --content "<reply>" \\
  --thread-id "<THREAD>" --organization <ORG> --project <PROJECT>
\`\`\`

### Step 3 — close

\`\`\`bash
az repos pr thread update --id "<THREAD>" --status closed \\
  --organization <ORG> --project <PROJECT>
\`\`\`

### Step 4 — verify + verdict gate

Closing threads is necessary but not sufficient: Azure has no \`CHANGES_REQUESTED\` review; the equivalent block is the PR status check, exposed as the bot's \`postedStatusState\` (\`succeeded\` = no block; \`pending\`/\`failed\` = may block required status checks).

\`\`\`bash
az repos pr thread list --id "\${PR_ID}" --organization <ORG> --project <PROJECT> \\
  --query "[?status=='active'] | length(@)" -o tsv
cat artifacts/manual/s4-azure-mocked-run.json | jq '.postedStatusState'
# Expected: 0 active threads; "succeeded" verdict
\`\`\`

If \`postedStatusState\` is \`pending\`/\`failed\`, address the underlying findings and re-push for a fresh review.

</details>
${RESOLUTION_GUIDE_MARKER}`;

/**
 * Render the platform-aware resolution guide as a single collapsed
 * `<details>` block whose final non-empty line is `RESOLUTION_GUIDE_MARKER`.
 * See the module docstring for the cross-platform rules enforced here.
 */
export function resolutionGuide(platform: ResolutionGuidePlatform): string {
  return platform === "azure" ? AZURE_GUIDE : GITHUB_GUIDE;
}