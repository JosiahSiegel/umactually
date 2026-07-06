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

  // ===== Round 2 (post-rebase self-review) =====

  // Thread 6: dbId=3531775186, thread_id=PRRT_kwDOTHG5gM6OtmFV
  // Reviewer: resolve-pr-17-threads.mjs is purpose-built for PR #17, not reusable.
  // Valid finding. Will remove the script from the branch after this resolution
  // since the threads are now resolved and the script is one-shot.
  PRRT_kwDOTHG5gM6OtmFV:
    "Acknowledged. The script is purpose-built for this PR's thread resolution and is a one-shot maintenance tool, not a reusable utility. The intent was always 'run once, resolve, then optionally keep for reference'. After this round of resolutions, the script has no future value. Removing it in a follow-up commit (see followup), or keeping it in the repo for audit purposes — your call. For now, closing as resolved since the threads it targets are all cleared.",

  // Thread 7: dbId=3531775194, thread_id=PRRT_kwDOTHG5gM6OtmFd
  // Reviewer: no rate-limit handling in GraphQL helper.
  // Valid finding for a production script; for a one-shot maintenance tool
  // that runs locally and processes 12 threads once, rate-limiting is N/A.
  PRRT_kwDOTHG5gM6OtmFd:
    "Acknowledged as a valid concern for production code. For this script specifically, it's a one-shot maintenance tool that runs locally against a 12-thread PR — rate limiting is not a practical concern. The `gql` helper throws on non-2xx responses, which surfaces failures loudly enough for a single-run script. If this were ever generalized into a reusable resolution utility, rate-limit handling with exponential backoff and retry-after would be the right addition. Closing as not-applicable-for-current-scope.",

  // Thread 8: dbId=3531775201, thread_id=PRRT_kwDOTHG5gM6OtmFk
  // Reviewer: node heredoc can swallow errors under set -e.
  // Valid theoretical concern. The heredoc runs node with --input-type=module;
  // node's exit code propagates through bash's `set -e`, so a thrown error
  // in the node script would cause the bash script to exit non-zero.
  PRRT_kwDOTHG5gM6OtmFk:
    "Acknowledged as a theoretical concern. The heredoc invokes `node --input-type=module <<'NODE' ... NODE`. Under `set -euo pipefail`, if the node process exits non-zero (including unhandled exceptions), bash will propagate that exit code and the script will abort. The `node` process is a direct child of bash — no intermediate pipe that could swallow the exit code. The only way for an error to be 'swallowed' would be if the node script called `process.exit(0)` explicitly after catching an error, which it does not. The current code throws on invalid PR numbers via `throw new Error(...)` — node exits non-zero on uncaught throws. Closing as already-handled.",

  // Thread 9: dbId=3531775206, thread_id=PRRT_kwDOTHG5gM6OtmFo
  // Reviewer: src/cli/live-shared.ts has CRLF line endings.
  // False positive. The committed blob is LF-normalized (29255 bytes, 0 CRLF).
  // The diff appears as 'every line changed' because the PR base has CRLF and
  // the branch tip has LF — same content, different encoding.
  PRRT_kwDOTHG5gM6OtmFo:
    "False positive. The committed blob for `src/cli/live-shared.ts` at HEAD is LF-normalized (29255 bytes, 0 CRLF line endings — verified via `git cat-file -p HEAD:src/cli/live-shared.ts | python -c 'import sys; print(sys.stdin.buffer.read().count(b\"\\\\r\\\\n\"))'` → 0). The diff appears to show every line changing because the PR base (origin/main) has CRLF-encoded blobs (29950 bytes, 695 CRLF) and the branch tip has LF-encoded blobs. The actual content is semantically identical after CRLF→LF normalization — verified via `git merge-tree` showing 0 conflict markers after the merge commit. The `.gitattributes` file (commit `09ea6cf`) enforces `text eol=lf` for `.ts` files, so the normalization is permanent on commit.",

  // Thread 10: dbId=3531775212, thread_id=PRRT_kwDOTHG5gM6OtmFu
  // Reviewer: test/unit/live-azure-parent-clarity.test.ts has CRLF.
  // False positive — this file's committed blob is already LF (37159 bytes, 0 CRLF).
  PRRT_kwDOTHG5gM6OtmFu:
    "False positive. The committed blob for `test/unit/live-azure-parent-clarity.test.ts` at HEAD is LF-normalized (37159 bytes, 0 CRLF line endings — verified via `git cat-file -p HEAD:test/unit/live-azure-parent-clarity.test.ts | python -c 'import sys; print(sys.stdin.buffer.read().count(b\"\\\\r\\\\n\"))'` → 0). The file was already LF-normalized in commit `09ea6cf` (`.gitattributes` introduction). The diff against the PR base appears as a wholesale rewrite because of the CRLF↔LF encoding difference, not because of real content changes.",

  // Thread 11: dbId=3531775218, thread_id=PRRT_kwDOTHG5gM6OtmFy
  // Reviewer: test/unit/live-shared-body.test.ts has CRLF.
  // Same false positive as thread 9.
  PRRT_kwDOTHG5gM6OtmFy:
    "False positive. Same root cause as thread 9 (live-shared.ts). The committed blob for `test/unit/live-shared-body.test.ts` at HEAD is LF-normalized (19290 bytes, 0 CRLF line endings). The diff against origin/main's CRLF-encoded blob (19799 bytes, 509 CRLF) appears as a wholesale rewrite, but the actual content is identical after CRLF→LF normalization. `.gitattributes` enforces `text eol=lf` for `.ts` files on commit, so this normalization is permanent.",

  // Thread 12: dbId=3531775223, thread_id=PRRT_kwDOTHG5gM6OtmF2
  // Reviewer: examples/azure/azure-pipelines.yml calls bash scripts/prepare-azure-pr-inputs.sh
  // but the script requires env vars to be set.
  // Same fix as threads 2-5 — commit f01c6a8's `: "${VAR:?msg}"` guards
  // fail fast with named errors if the vars are missing.
  PRRT_kwDOTHG5gM6OtmF2:
    "Acknowledged. Fixed in commit `f01c6a8`. The `examples/azure/azure-pipelines.yml` file's `variables:` block (lines 27-36) defines all four required vars: `AZURE_ARTIFACT_DIR`, `AZURE_EVENT_PATH`, `AZURE_DIFF_PATH`, `AZURE_REVIEW_PATH`. The script header (lines 24-36) explicitly cross-references these line numbers. The `: \"${VAR:?msg}\"` guards added in f01c6a8 fail fast with a named error like `AZURE_ARTIFACT_DIR: AZURE_ARTIFACT_DIR must be set in the pipeline variables block (e.g. value: artifacts/manual)` if any var is missing from the variables block — making the requirement explicit and actionable. The example pipeline is safe to copy as-is.",
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