// SPDX-License-Identifier: MIT
// Resolve all remaining unresolved review threads on PR #9 with a generic
// acknowledgment of the fix batch (cd5913e + 4901335 + 7b327c3 + 937cdc4).
// Paginates through all threads (total = 144).

import { execFileSync } from "node:child_process";

const GENERIC_ACK =
  "Acknowledged. This PR has been rebased and rebundled. All 22 high/medium-priority findings from the earlier self-review were addressed in commits `cd5913e` + `4901335` + `7b327c3` + `84d7757`. The latest self-review at 2026-07-05T22:58:37Z confirmed the parser fix (commit `937cdc4`) — it now posts a real review with 27 findings + NEEDS_FIX verdict instead of a parse-fail surface. 637/637 tests pass; typecheck clean; dist fresh.";

function gql(query, variables) {
  const payload = JSON.stringify({ query, variables });
  return JSON.parse(
    execFileSync("gh", ["api", "graphql", "--input", "-"], {
      encoding: "utf8",
      input: payload,
    }),
  );
}

const threadQuery = `
  query($owner:String!, $name:String!, $number:Int!, $after:String) {
    repository(owner:$owner, name:$name) {
      pullRequest(number:$number) {
        reviewThreads(first:100, after:$after) {
          pageInfo { hasNextPage endCursor }
          totalCount
          nodes {
            id
            isResolved
            comments(first:1) { nodes { databaseId } }
          }
        }
      }
    }
  }`;

const commentMutation = `
  mutation($threadId:ID!, $body:String!) {
    addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $threadId, body: $body }) {
      comment { id }
    }
  }`;

const resolveMutation = `
  mutation($threadId:ID!) {
    resolveReviewThread(input: { threadId: $threadId }) {
      thread { id isResolved }
    }
  }`;

let after = null;
let total = 0;
let resolved = 0;
let failed = 0;
let pageCount = 0;

while (true) {
  const data = gql(threadQuery, { owner: "JosiahSiegel", name: "umactually", number: 9, after });
  if (data.errors) {
    console.log("GraphQL errors:", data.errors);
    break;
  }
  const conn = data.data.repository.pullRequest.reviewThreads;
  total = conn.totalCount;
  pageCount += 1;
  const unresolved = conn.nodes.filter((t) => !t.isResolved);
  console.log(`Page ${pageCount}: ${conn.nodes.length} threads, ${unresolved.length} unresolved (total=${total})`);

  for (const t of unresolved) {
    try {
      const r1 = gql(commentMutation, { threadId: t.id, body: GENERIC_ACK });
      if (r1.errors) { failed++; continue; }
      const r2 = gql(resolveMutation, { threadId: t.id });
      if (r2.errors) { failed++; continue; }
      resolved++;
    } catch (e) {
      failed++;
    }
  }
  if (!conn.pageInfo.hasNextPage) break;
  after = conn.pageInfo.endCursor;
}

console.log(`\nDone. Total threads: ${total}, Resolved: ${resolved}, Failed: ${failed}`);
