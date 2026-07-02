// Unit tests for the in-place update of an existing parent PR-level review
// summary thread on Azure DevOps.
//
// Background: previously `postAzurePrComment` was a write-once helper — once
// a marker thread existed at the PR-conversation level (i.e. without a
// `threadContext`), every subsequent run was a silent no-op. That left stale
// content (e.g. a parse-fail fallback) stuck on the parent card forever. To
// fix it, when an existing parent marker thread is found, the live Azure
// path now PATCHes the thread in place using the documented
// Pull Request Threads - Update endpoint:
//   PATCH https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repoId}/pullRequests/{prId}/threads/{threadId}?api-version=7.1
// with `comments: [{ id, content, ... }]`. See:
//   https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/update?view=azure-devops-rest-7.1
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseCliArgs } from "../../src/cli.js";
import { runLive } from "../../src/cli/orchestrator.js";
import { azureDiffRoutes, azureReviewDiffFixture } from "./azure-diff-fixture.js";
import type { AzureFetchRoute } from "./azure-diff-fixture.js";

type RecordedCall = {
  readonly url: string;
  readonly method: string;
  readonly authorization: string;
  readonly body: unknown;
};

type FreshableRoute = {
  readonly match: (url: string, method: string) => boolean;
  readonly response: Response | (() => Response);
};

const PROVIDER_REVIEW = JSON.stringify({
  summary: "Azure parent-comment summary.",
  verdict: "APPROVED",
  comments: [
    {
      path: "src/review/example.ts",
      line: 3,
      body: "Azure inline comment.",
      severity: "medium",
      category: "maintainability",
    },
  ],
  suppressed_comments: [],
});

function makeJsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeFetchRecorder(routes: readonly FreshableRoute[]): {
  readonly calls: RecordedCall[];
  readonly fetchImpl: typeof fetch;
} {
  /** Test fetch recorder; mutation is the purpose of this fixture. */
  const calls: RecordedCall[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    const authorization = headers.get("authorization") ?? "";
    const rawBody = init?.body;
    const body = typeof rawBody === "string" ? parseJson(rawBody) : null;
    calls.push({ url, method, authorization, body });
    for (const route of routes) {
      if (route.match(url, method)) {
        return typeof route.response === "function" ? route.response() : route.response;
      }
    }
    throw new Error(`unexpected ${method} ${url}`);
  };
  return { calls, fetchImpl };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return text;
    }
    throw error;
  }
}

function azureEnv(): NodeJS.ProcessEnv {
  return {
    TF_BUILD: "True",
    SYSTEM_ACCESSTOKEN: "azure-token-secret",
    SYSTEM_COLLECTIONURI: "https://dev.azure.com/example-org/",
    SYSTEM_TEAMPROJECT: "Example Project",
    BUILD_REPOSITORY_ID: "repo-42",
    SYSTEM_PULLREQUEST_PULLREQUESTID: "42",
    SYSTEM_PULLREQUEST_SOURCECOMMITID: "1111111111111111111111111111111111111111",
    SYSTEM_PULLREQUEST_TARGETBRANCHNAME: "refs/heads/main",
    UMACTUALLY_API_URL: "https://provider.example/v1",
    UMACTUALLY_API_KEY: "provider-key-secret",
    UMACTUALLY_MODEL: "review-model-synthetic",
  } satisfies NodeJS.ProcessEnv;
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new TypeError(`${label} must be an object`);
}

function readArray(value: unknown, label: string): readonly unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  throw new TypeError(`${label} must be an array`);
}

function freshable(routes: readonly AzureFetchRoute[]): FreshableRoute[] {
  return routes.map((route) => ({
    match: route.match,
    response: () => route.response,
  }));
}

const PARENT_THREAD_ID = 79;
const PARENT_COMMENT_ID = 12345;
const EXISTING_THREADS_URL = "https://dev.azure.com/example-org/Example%20Project/_apis/git/repositories/repo-42/pullRequests/42/threads?api-version=7.1";

/**
 * Build the route set for the "existing parent marker thread is found"
 * scenario. The /threads GET returns one parent PR-level marker thread
 * (no threadContext, comment carries our marker) plus no inline threads,
 * so the live flow must PATCH the parent and not POST a new one.
 */
function existingParentRoutes(): readonly FreshableRoute[] {
  return [
    ...freshable(azureDiffRoutes(makeJsonResponse, azureReviewDiffFixture())),
    {
      match: (url, method) => method === "POST" && url === "https://provider.example/v1/responses",
      response: () => makeJsonResponse({ output_text: PROVIDER_REVIEW }),
    },
    {
      match: (url, method) => method === "GET" && url.endsWith("/threads?api-version=7.1"),
      response: () =>
        makeJsonResponse({
          count: 1,
          value: [
            {
              id: PARENT_THREAD_ID,
              status: "active",
              threadContext: null,
              comments: [
                {
                  id: PARENT_COMMENT_ID,
                  content:
                    "<!-- umactually-pr-review -->\n## 💬 DISCUSS\n\nProvider response did not contain a valid JSON review payload.\n",
                },
              ],
            },
          ],
        }),
    },
    {
      match: (url, method) => method === "POST" && url.endsWith("/threads?api-version=7.1"),
      response: () => makeJsonResponse({ id: 9999 }, 200),
    },
    {
      match: (url, method) =>
        method === "PATCH" && url.endsWith(`/threads/${PARENT_THREAD_ID}?api-version=7.1`),
      response: () =>
        makeJsonResponse(
          {
            id: PARENT_THREAD_ID,
            comments: [
              {
                id: PARENT_COMMENT_ID,
                content: "<!-- umactually-pr-review -->\n## ✅ SHIP\n\nAzure parent-comment summary.",
              },
            ],
          },
          200,
        ),
    },
    {
      match: (url, method) => method === "POST" && url.endsWith("/statuses?api-version=7.1"),
      response: () => makeJsonResponse({ id: 88 }, 200),
    },
  ];
}

describe("postAzurePrComment (Azure parent PR-level in-place update)", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy?.mockRestore();
    stderrSpy = undefined;
  });

  it("PARENT-UPDATE-001: detects an existing parent marker thread and PATCHes it instead of POSTing a new one", async () => {
    // Given: Azure already has an active parent PR-level marker thread (id=79).
    const recorder = makeFetchRecorder(existingParentRoutes());

    // When: the live Azure path runs.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "azure", "--no-dry-run"]),
      cwd: process.cwd(),
      env: azureEnv(),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: exit is 0, the run posted at least one inline thread + status.
    expect(result.exitCode).toBe(0);

    // And: NO POST to /threads went to the bare /threads URL for a new parent
    // (the parent PR-level comment has NO threadContext and would otherwise
    // be POSTed before any inline). We assert that there is no POST whose
    // body has `threadContext: undefined` (the parent shape) — because the
    // parent should now be PATCHed in place, not POSTed.
    const newParentPosts = recorder.calls.filter((call) => {
      if (call.method !== "POST" || !call.url.endsWith("/threads?api-version=7.1")) {
        return false;
      }
      const body = call.body;
      if (typeof body !== "object" || body === null) {
        return false;
      }
      return !("threadContext" in (body as Record<string, unknown>));
    });
    expect(newParentPosts).toHaveLength(0);

    // And: exactly one PATCH was sent to the existing parent's thread URL,
    // using the documented PATCH endpoint shape.
    const patchCalls = recorder.calls.filter(
      (call) =>
        call.method === "PATCH" &&
        call.url === `${EXISTING_THREADS_URL.replace("/threads?api-version=7.1", "")}/threads/${PARENT_THREAD_ID}?api-version=7.1`,
    );
    expect(patchCalls).toHaveLength(1);
  });

  it("PARENT-UPDATE-002: PATCH body carries the new buildReviewBody content and preserves the existing comment id", async () => {
    // Given: same as above.
    const recorder = makeFetchRecorder(existingParentRoutes());

    // When: the live Azure path runs.
    await runLive({
      parsed: parseCliArgs(["--platform", "azure", "--no-dry-run"]),
      cwd: process.cwd(),
      env: azureEnv(),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: the PATCH body uses the documented Comment[] shape with the
    // existing comment id and the new body content from buildReviewBody.
    const patchCall = recorder.calls.find(
      (call) =>
        call.method === "PATCH" &&
        call.url.endsWith(`/threads/${PARENT_THREAD_ID}?api-version=7.1`),
    );
    expect(patchCall).toBeDefined();
    if (patchCall === undefined) {
      throw new Error("expected PATCH call to existing parent thread");
    }
    const patchBody = readRecord(patchCall.body as Record<string, unknown>, "patch body");

    // The PATCH body MUST carry `comments` as a single-element array
    // (per Microsoft Learn: "comments: Comment[] - A list of the comments.")
    const comments = readArray(patchBody["comments"], "patch comments");
    expect(comments).toHaveLength(1);

    // Each comment MUST preserve its existing id and update its content.
    const firstComment = readRecord(comments[0] as Record<string, unknown>, "patch first comment");
    expect(firstComment["id"]).toBe(PARENT_COMMENT_ID);
    const content = firstComment["content"];
    expect(typeof content).toBe("string");
    if (typeof content !== "string") {
      throw new Error("patched comment content must be a string");
    }
    // The new body must include the verdict badge + summary for the parsed review.
    expect(content).toContain("<!-- umactually-pr-review -->");
    expect(content).toContain("Azure parent-comment summary.");
    // The review was APPROVED with one inline finding → SHIP badge.
    expect(content).toMatch(/SHIP|APPROVED/);
  });

  it("PARENT-UPDATE-003: each inline thread body references the parent thread id", async () => {
    // Given: Azure already has an active parent PR-level marker thread (id=79).
    const recorder = makeFetchRecorder(existingParentRoutes());

    // When: the live Azure path runs.
    await runLive({
      parsed: parseCliArgs(["--platform", "azure", "--no-dry-run"]),
      cwd: process.cwd(),
      env: azureEnv(),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: every inline thread POST's body must reference the parent
    // thread id so humans reading the PR can correlate findings with the
    // summary card (Azure does not let us nest threads).
    const inlinePosts = recorder.calls.filter((call) => {
      if (call.method !== "POST" || !call.url.endsWith("/threads?api-version=7.1")) {
        return false;
      }
      const body = call.body;
      if (typeof body !== "object" || body === null) {
        return false;
      }
      return "threadContext" in (body as Record<string, unknown>);
    });
    expect(inlinePosts.length).toBeGreaterThan(0);
    for (const post of inlinePosts) {
      const body = readRecord(post.body as Record<string, unknown>, "inline body");
      const comments = readArray(body["comments"], "inline comments");
      expect(comments).toHaveLength(1);
      const firstComment = readRecord(comments[0] as Record<string, unknown>, "inline first comment");
      const content = firstComment["content"];
      expect(typeof content).toBe("string");
      if (typeof content !== "string") {
        throw new Error("inline content must be a string");
      }
      expect(content).toContain(`Reply to PR review summary #${PARENT_THREAD_ID}`);
    }
  });
});