#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Resolves all unresolved review threads on GitHub PR #17 with
// thread-specific acknowledgments. Run from the repo root:
//   node scripts/resolve-pr-17-threads.mjs
//
// Requires: `gh` CLI authenticated (this script shells out to
// `gh api graphql` so it inherits the user's auth state).

import { execFileSync } from "node:child_process";

const REPO_OWNER = "JosiahSiegel";
const REPO_NAME = "umactually";
const PR_NUMBER = 17;

const ACKS = {
  // Thread 1: dbId=3531481277, thread_id=PRRT_kwDOTHG5gM6OsyPN
  // Reviewer claimed shebang missing. False positive — shebang is
  // on line 1 of prepare-azure-pr-inputs.sh (verified via
  // `head -1 scripts/prepare-azure-pr-inputs.sh` → `#!/usr/bin/env bash`).
  // The reviewer's self-review text fixture was probably
  // looking at a different file or had a stale snapshot.
  PRRT_kwDOTHG5gM6OsyPN:
    "False positive. `head -1 scripts/prepare-azure-pr-inputs.sh` returns `#!/usr/bin/env bash` — the shebang is present on line 1 of the script (the script is also marked executable, mode 0755). The reviewer probably read past line 1 to the SPDX header comment. Both `bash scripts/prepare-azure-pr-inputs.sh` and `./scripts/prepare-azure-pr-inputs.sh` work; the Azure pipeline uses `bash scripts/...` form which is shebang-independent. Verified post-commit by running `head -1 scripts/prepare-azure-pr-inputs.sh` on commit f01c6a8. Closing as not-an-issue.",

  // Thread 2: dbId=3531481282, thread_id=PRRT_kwDOTHG5gM6OsyPS
  // Reviewer: $AZURE_EVENT_PATH etc. not defined upstream — falls back
  // to defaults silently.
  // Fixed in commit f01c6a8: added explicit `: "${VAR:?msg}"` guards
  // at the top of the script that fail fast with a clear error naming
  // the missing variable and pointing to the variables block. Header
  // now explicitly cross-references azure-pipelines.yml lines 20-29
  // and examples/azure/azure-pipelines.yml lines 27-36.
  PRRT_kwDOTHG5gM6OsyPS:
    "Acknowledged. Fixed in commit `f01c6a8` (fix(scripts): add explicit env-var guards in prepare-azure-pr-inputs.sh). The four required vars (`AZURE_ARTIFACT_DIR`, `AZURE_EVENT_PATH`, `AZURE_DIFF_PATH`, `AZURE_REVIEW_PATH`) now fail fast with a named error if unset:\n\n```\n$ env -i bash scripts/prepare-azure-pr-inputs.sh\nscripts/prepare-azure-pr-inputs.sh: line 41: AZURE_ARTIFACT_DIR: AZURE_ARTIFACT_DIR must be set in the pipeline variables block (e.g. value: artifacts/manual)\n```\n\nThe script header now also explicitly cross-references the `variables:` blocks in azure-pipelines.yml and examples/azure/azure-pipelines.yml that supply these vars. When all four are set, output is byte-identical to the pre-refactor inline block (verified by diff against `git show main:azure-pipelines.yml`).",

  // Thread 3: dbId=3531481286, thread_id=PRRT_kwDOTHG5gM6OsyPU
  // Same env-var concern for azure-pipelines.yml.
  PRRT_kwDOTHG5gM6OsyPU:
    "Same fix as the previous thread — commit `f01c6a8`. The `variables:` block IS defined at the top of `azure-pipelines.yml` (lines 20-29, above the visible diff window that the reviewer inspected). The cross-reference in the script header now points explicitly to those lines. The PR diff window simply didn't include them; they were never removed.",

  // Thread 4: dbId=3531481288, thread_id=PRRT_kwDOTHG5gM6OsyPV
  // Same concern for examples/azure/azure-pipelines.yml.
  PRRT_kwDOTHG5gM6OsyPV:
    "Same fix as the two previous threads — commit `f01c6a8`. The `variables:` block is also defined at the top of `examples/azure/azure-pipelines.yml` (lines 27-36). Cross-reference in the script header explicitly points there too. The four required vars are supplied identically by both pipelines; only the `umactually-secrets` variable group reference in the root file is the difference.",

  // Thread 5: dbId=3531481291, thread_id=PRRT_kwDOTHG5gM6OsyPY
  // set -u + unset AZURE_ARTIFACT_DIR → confusing error.
  PRRT_kwDOTHG5gM6OsyPY:
    "Acknowledged. Fixed in commit `f01c6a8` — same fix as the env-var-visibility threads. The four `: \"${VAR:?...}\"` guards run BEFORE `mkdir -p` and the embedded node heredoc, so an unset variable now produces a named error instead of an opaque mkdir/heredoc failure. The guard messages explicitly reference the `variables:` block where the var should be defined, so the pipeline author gets an actionable fix path instead of a stack trace.",
};

function gql(query, variables) {
  const payload = JSON.stringify({ query, variables });
  return JSON.parse(
    execFileSync("gh", ["api", "graphql", "--input", "-"], {
      encoding: "utf8",
      input: payload,
    }),
  );
}

const REPLY_MUTATION = `
  mutation($threadId:ID!, $body:String!) {
    addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $threadId, body: $body }) {
      comment { id }
    }
  }`;

const RESOLVE_MUTATION = `
  mutation($threadId:ID!) {
    resolveReviewThread(input: { threadId: $threadId }) {
      thread { id isResolved }
    }
  }`;

const LIST_QUERY = `
  query($owner:String!, $name:String!, $number:Int!) {
    repository(owner:$owner, name:$name) {
      pullRequest(number:$number) {
        reviewThreads(first:100) {
          nodes {
            id
            isResolved
          }
        }
      }
    }
  }`;

const data = gql(LIST_QUERY, { owner: REPO_OWNER, name: REPO_NAME, number: PR_NUMBER });
const threads = data.data.repository.pullRequest.reviewThreads.nodes;
const unresolved = threads.filter((t) => !t.isResolved);
console.log(`Total unresolved threads: ${unresolved.length}`);

const results = { resolved: 0, skipped: 0, failed: [] };
for (const t of unresolved) {
  const ack = ACKS[t.id];
  if (ack === undefined) {
    console.log(`  - ${t.id}: no ack found, skipping`);
    results.skipped += 1;
    continue;
  }
  try {
    const replyRes = gql(REPLY_MUTATION, { threadId: t.id, body: ack });
    if (replyRes.errors) {
      results.failed.push({ id: t.id, phase: "reply", errors: replyRes.errors });
      continue;
    }
    const resolveRes = gql(RESOLVE_MUTATION, { threadId: t.id });
    if (resolveRes.errors) {
      results.failed.push({ id: t.id, phase: "resolve", errors: resolveRes.errors });
      continue;
    }
    results.resolved += 1;
    console.log(`  ✓ ${t.id}`);
  } catch (err) {
    results.failed.push({ id: t.id, phase: "mutation", error: err.message });
  }
}

console.log(`\nResolved: ${results.resolved}, Skipped: ${results.skipped}, Failed: ${results.failed.length}`);
if (results.failed.length > 0) {
  console.log(JSON.stringify(results.failed, null, 2));
  process.exit(1);
}