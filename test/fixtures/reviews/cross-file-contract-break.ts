/**
 * Fixture: cross-file-contract-break
 *
 * A diff that changes an exported function's signature in `src/api.ts`
 * without updating the downstream caller `src/caller.ts`. The fixture
 * stages both files in a throwaway workdir so the verifier has the
 * full cross-file surface to scan. The canned review emits one
 * high-severity finding on the caller file so the gate exercises the
 * downstream-impact assertion.
 */
import type { ReviewFixture } from "../../e2e/review-eval.js";

export const crossFileContractBreakFixture: ReviewFixture = {
  name: "cross-file-contract-break",
  description: "Upstream signature change; downstream caller still uses old contract.",
  diff: [
    "diff --git a/src/api.ts b/src/api.ts",
    "index 0000000..1111111 100644",
    "--- a/src/api.ts",
    "+++ b/src/api.ts",
    "@@ -1,1 +1,3 @@",
    "-export function fetchUser(id: number) { return { id, name: 'anon' }; }",
    "+export function fetchUser(id: string) {",
    "+  return { id, name: 'anon' };",
    "+}",
  ].join("\n"),
  fixtureFiles: {
    "src/caller.ts": [
      "import { fetchUser } from './api.js';",
      "// BUG: still passes a number — the contract is now string-typed.",
      "export const u = fetchUser(42);",
      "",
    ].join("\n"),
  },
  expected: {
    minComments: 1,
    maxComments: 4,
    minHighSeverity: 1,
    maxFabricationRate: 0.6,
    mustNotContain: ["remove this caller"],
    mustNotFabricatePath: "dist/",
    forbiddenPathPrefixes: ["dist/", "build/", "node_modules/"],
    hardInvariants: ["identity-fields-present", "surviving-fabrication-zero"],
    mockReviewOverride: {
      review: {
        summary: "Cross-file contract break: src/api.ts changed id to string but src/caller.ts still passes a number.",
        verdict: "request_changes",
        comments: [
          {
            // Comment targets the file in the diff (src/api.ts) so the
            // diff-scope verifier can anchor the (path, line). The
            // cross-file nature is captured in the body.
            path: "src/api.ts",
            line: 2,
            body: "fetchUser signature change to string is a contract break for downstream callers in src/caller.ts which still pass a number. Update the call site or revert the upstream change.",
            severity: "high",
            category: "correctness",
          },
        ],
      },
    },
  },
};
