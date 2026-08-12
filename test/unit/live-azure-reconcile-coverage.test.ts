// SPDX-License-Identifier: MIT
//
// Coverage tests for `src/cli/live-azure-reconcile.ts` — exercise the
// parent-marker helpers (`findParentMarkerThread`, `deleteParentComments`,
// `parseAzureThreadRecord`, `parseThreadContext`, `readContextFields`,
// `parentCommentIds`) that the request-contract + signal suites did not
// pin. These tests are additive; existing assertions stay byte-identical.

import { describe, expect, it } from "vitest";

import { runAzureLiveWithReconcile } from "../../src/cli/live-azure-reconcile.js";
import type { AzureContext } from "../../src/platform/azure/context.js";
import type { FetchImpl } from "../../src/util/http.js";
import type { ProviderComment } from "../../src/provider/provider-parse.js";
import { computeDurableFindingIdentity } from "../../src/review/fingerprint.js";
import { REVIEW_MARKER } from "../../src/util/marker.js";

const TOKEN = "azure-coverage-token";
const ORG = "cov-org";
const PROJECT = "cov-project";
const REPO_ID = "cov-repo-id";
const PR_NUMBER = 42;
const SOURCE_COMMIT = "1111111111111111111111111111111111111111";
const TARGET_BRANCH = "main";
const BASE_COMMIT = "0000000000000000000000000000000000000000";

function makeContext(): AzureContext {
  return {
    token: TOKEN,
    org: ORG,
    project: PROJECT,
    repoId: REPO_ID,
    prNumber: PR_NUMBER,
    sourceCommit: SOURCE_COMMIT,
    targetBranch: TARGET_BRANCH,
    baseCommit: BASE_COMMIT,
  };
}

const DIFF_TEXT = [
  "diff --git a/src/x.ts b/src/x.ts",
  "--- a/src/x.ts",
  "+++ b/src/x.ts",
  "@@ -1,4 +1,7 @@",
  " existing line",
  " another existing",
  " third existing",
  "-removed line",
  "+added line",
  "+another added",
  "+trailing added",
  "",
].join("\n");

function buildDurableComment(path: string, line: number, body: string): ProviderComment {
  const firstSentence = body.split(/[.!?]/u)[0] ?? body;
  const identity = computeDurableFindingIdentity({
    path,
    anchorKind: "hunk",
    symbolName: undefined,
    symbolKind: undefined,
    hunkPreimage: undefined,
    category: "maintainability",
    ruleKey: undefined,
    bodyFirstSentence: firstSentence,
    pathRewrites: undefined,
    caseInsensitive: undefined,
  });
  return {
    path,
    line,
    body,
    severity: "medium",
    category: "maintainability",
    durableIdentity: identity,
  };
}

function buildProviderOutcomeWithComment(comment: ProviderComment) {
  return {
    review: {
      summary: "Azure coverage test.",
      verdict: "COMMENT",
      comments: [comment],
      suppressedComments: [],
      parseFailed: false,
    },
    endpoint: "test-endpoint",
    provider: "test-provider",
    modelId: "test-model",
    severityWarnings: [],
    parseWarnings: [],
    verifiedFactsFilter: { kept: [], downgraded: [], downgradeReasons: [] },
  };
}

function buildParsed() {
  return {
    provider: "openai-compatible",
    apiUrl: "https://api.example.com/v1",
    model: "test-model",
    platform: "azure" as const,
    detectLeaks: false,
    reviewTimeoutSeconds: 60,
    perRequestTimeoutSeconds: 60,
    prNumber: PR_NUMBER,
    outputArtifact: null,
    files: null,
    diffPath: null,
    simulateFindings: false,
    dryRun: false,
    reviewFileLimit: 200,
    debugRawResponse: false,
    showConfig: false,
    json: false,
    noColor: true,
    minimumSeverity: null,
    minimumSeverityInternal: null,
  } as unknown as Parameters<typeof runAzureLiveWithReconcile>[0]["parsed"];
}

type RecordedRequest = {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
};

describe("runAzureLiveWithReconcile — parent-marker helpers coverage", () => {
  it("deletes an old parent-marker thread when prior threads include one with the marker", async () => {
    const calls: RecordedRequest[] = [];
    const fetchImpl: FetchImpl = async (input, init) => {
      const url = typeof input === "string" ? input : String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      let body: unknown = undefined;
      if (init?.body !== undefined) {
        try { body = JSON.parse(init.body as string); } catch { body = init.body; }
      }
      calls.push({ url, method, body });
      if (method === "GET" && url.includes("/threads?") && !url.includes("/threads/")) {
        return new Response(JSON.stringify({
          value: [
            {
              id: 9001,
              status: "active",
              comments: [
                {
                  id: 9002,
                  content: `${REVIEW_MARKER}\nThis is the prior parent summary.`,
                },
              ],
            },
          ],
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (method === "DELETE" && url.includes("/comments/")) {
        return new Response("{}", { status: 200 });
      }
      if (method === "POST" && url.includes("/threads?") && !url.includes("/comments")) {
        return new Response(JSON.stringify({ id: 500, comments: [{ id: 600 }] }), {
          status: 200, headers: { "content-type": "application/json" },
        });
      }
      if (method === "POST" && url.includes("/threads/") && url.includes("/comments")) {
        return new Response(JSON.stringify({ id: 700 }), {
          status: 200, headers: { "content-type": "application/json" },
        });
      }
      if (method === "POST" && url.includes("/statuses")) {
        return new Response("{}", { status: 200 });
      }
      return new Response("{}", { status: 200 });
    };

    const comment = buildDurableComment(
      "src/x.ts", 5,
      "Extract this duplicated branch into a shared helper function.",
    );
    const result = await runAzureLiveWithReconcile({
      context: makeContext(),
      diffText: DIFF_TEXT,
      provider: buildProviderOutcomeWithComment(comment),
      parsed: buildParsed(),
      fetchImpl,
    });

    expect(result.exitCode).toBe(0);
    expect(result.posted).toBe(true);
    // Old parent comment deletion should fire.
    expect(calls.some((c) => c.method === "DELETE" && c.url.includes("/comments/9002"))).toBe(true);
  });

  it("skips delete when prior threads are returned but no thread contains the marker", async () => {
    const calls: RecordedRequest[] = [];
    const fetchImpl: FetchImpl = async (input, init) => {
      const url = typeof input === "string" ? input : String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      let body: unknown = undefined;
      if (init?.body !== undefined) {
        try { body = JSON.parse(init.body as string); } catch { body = init.body; }
      }
      calls.push({ url, method, body });
      if (method === "GET" && url.includes("/threads?") && !url.includes("/threads/")) {
        return new Response(JSON.stringify({
          value: [
            {
              id: 9101,
              status: "active",
              threadContext: {
                filePath: "src/y.ts",
                rightFileStart: { line: 3 },
              },
              comments: [{ id: 9102, content: "A regular bot thread without our marker." }],
            },
          ],
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (method === "POST" && url.includes("/threads?") && !url.includes("/comments")) {
        return new Response(JSON.stringify({ id: 500, comments: [{ id: 600 }] }), {
          status: 200, headers: { "content-type": "application/json" },
        });
      }
      if (method === "POST" && url.includes("/threads/") && url.includes("/comments")) {
        return new Response(JSON.stringify({ id: 700 }), {
          status: 200, headers: { "content-type": "application/json" },
        });
      }
      if (method === "POST" && url.includes("/statuses")) {
        return new Response("{}", { status: 200 });
      }
      return new Response("{}", { status: 200 });
    };

    const comment = buildDurableComment(
      "src/x.ts", 5,
      "Document this public API with a TSDoc block.",
    );
    const result = await runAzureLiveWithReconcile({
      context: makeContext(),
      diffText: DIFF_TEXT,
      provider: buildProviderOutcomeWithComment(comment),
      parsed: buildParsed(),
      fetchImpl,
    });

    expect(result.exitCode).toBe(0);
    expect(result.posted).toBe(true);
    // No old parent marker found → no DELETE should fire.
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("treats listPriorThreads non-200 status as empty (no crash)", async () => {
    const fetchImpl: FetchImpl = async (input, init) => {
      const url = typeof input === "string" ? input : String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "GET" && url.includes("/threads?") && !url.includes("/threads/")) {
        return new Response("{}", { status: 500 });
      }
      if (method === "POST" && url.includes("/threads?") && !url.includes("/comments")) {
        return new Response(JSON.stringify({ id: 500, comments: [{ id: 600 }] }), {
          status: 200, headers: { "content-type": "application/json" },
        });
      }
      if (method === "POST" && url.includes("/threads/") && url.includes("/comments")) {
        return new Response(JSON.stringify({ id: 700 }), {
          status: 200, headers: { "content-type": "application/json" },
        });
      }
      if (method === "POST" && url.includes("/statuses")) {
        return new Response("{}", { status: 200 });
      }
      return new Response("{}", { status: 200 });
    };

    const comment = buildDurableComment(
      "src/x.ts", 5,
      "Refactor this long conditional into named helper functions.",
    );
    const result = await runAzureLiveWithReconcile({
      context: makeContext(),
      diffText: DIFF_TEXT,
      provider: buildProviderOutcomeWithComment(comment),
      parsed: buildParsed(),
      fetchImpl,
    });
    expect(result.exitCode).toBe(0);
    expect(result.posted).toBe(true);
  });

  it("treats listPriorThreads non-record JSON as empty", async () => {
    const fetchImpl: FetchImpl = async (input, init) => {
      const url = typeof input === "string" ? input : String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "GET" && url.includes("/threads?") && !url.includes("/threads/")) {
        return new Response(JSON.stringify("not-a-record"), {
          status: 200, headers: { "content-type": "application/json" },
        });
      }
      if (method === "POST" && url.includes("/threads?") && !url.includes("/comments")) {
        return new Response(JSON.stringify({ id: 500, comments: [{ id: 600 }] }), {
          status: 200, headers: { "content-type": "application/json" },
        });
      }
      if (method === "POST" && url.includes("/threads/") && url.includes("/comments")) {
        return new Response(JSON.stringify({ id: 700 }), {
          status: 200, headers: { "content-type": "application/json" },
        });
      }
      if (method === "POST" && url.includes("/statuses")) {
        return new Response("{}", { status: 200 });
      }
      return new Response("{}", { status: 200 });
    };

    const comment = buildDurableComment(
      "src/x.ts", 5,
      "Add a short comment explaining the intent of this block.",
    );
    const result = await runAzureLiveWithReconcile({
      context: makeContext(),
      diffText: DIFF_TEXT,
      provider: buildProviderOutcomeWithComment(comment),
      parsed: buildParsed(),
      fetchImpl,
    });
    expect(result.exitCode).toBe(0);
    expect(result.posted).toBe(true);
  });

  it("filters out thread records that lack a comments array (parseAzureThreadRecord)", async () => {
    const fetchImpl: FetchImpl = async (input, init) => {
      const url = typeof input === "string" ? input : String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "GET" && url.includes("/threads?") && !url.includes("/threads/")) {
        return new Response(JSON.stringify({
          value: [
            // Records without `comments` array should be dropped.
            { id: 9201, status: "active" },
            { id: 9202, status: "active", comments: "not-an-array" },
            // Valid record with marker so the parent-marker logic runs.
            {
              id: 9203, status: "active",
              comments: [{ id: 9204, content: `${REVIEW_MARKER}\nA prior parent summary.` }],
            },
          ],
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (method === "DELETE" && url.includes("/comments/")) {
        return new Response("{}", { status: 200 });
      }
      if (method === "POST" && url.includes("/threads?") && !url.includes("/comments")) {
        return new Response(JSON.stringify({ id: 500, comments: [{ id: 600 }] }), {
          status: 200, headers: { "content-type": "application/json" },
        });
      }
      if (method === "POST" && url.includes("/threads/") && url.includes("/comments")) {
        return new Response(JSON.stringify({ id: 700 }), {
          status: 200, headers: { "content-type": "application/json" },
        });
      }
      if (method === "POST" && url.includes("/statuses")) {
        return new Response("{}", { status: 200 });
      }
      return new Response("{}", { status: 200 });
    };

    const comment = buildDurableComment(
      "src/x.ts", 5,
      "Split this long function into smaller single-purpose helpers.",
    );
    const result = await runAzureLiveWithReconcile({
      context: makeContext(),
      diffText: DIFF_TEXT,
      provider: buildProviderOutcomeWithComment(comment),
      parsed: buildParsed(),
      fetchImpl,
    });
    expect(result.exitCode).toBe(0);
    expect(result.posted).toBe(true);
  });
});