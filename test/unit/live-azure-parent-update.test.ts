// Unit tests for the "always at top of conversation" behavior of the
// parent PR-level review summary on Azure DevOps.
//
// Background: the live Azure PR Overview conversation sorts threads
// strictly by thread id ascending (per
//   https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/list?view=azure-devops-rest-7.1
// — the API itself returns threads in id order). The previous
// implementation PATCHed an existing parent marker thread in place via
// the documented Pull Request Threads - Update endpoint
// (https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/update?view=azure-devops-rest-7.1)
// — that preserved the thread's original id, so once a system-activity
// event posted a thread with a higher id the parent summary sank
// below it. Users reported "where's the review summary. didn't you
// say it's supposed to stay at the top".
//
// The replacement contract (PARENT-TOP-* in
// test/unit/live-azure-parent-top.test.ts): every CLI run replaces
// the parent by deleting every comment on the existing thread (which
// leaves the thread `isDeleted: true` per the per-comment Delete doc
// https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-thread-comments/delete?view=azure-devops-rest-7.1
// — "Specify if the thread is deleted which happens when all comments
// are deleted") and POSTing a brand-new parent that gets the highest
// id on the PR.
//
// These tests now assert the REPLACEMENT behavior (no more PATCH on
// the existing parent). The PARENT-TOP-* tests cover the new edge
// cases (multiple-comment parent, empty parent); this file pins the
// body shape so future regressions are caught.
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

const EXISTING_PARENT_THREAD_ID = 79;
const EXISTING_PARENT_COMMENT_ID = 12345;
const NEW_PARENT_THREAD_ID = 9999;

/**
 * Build the route set for the "existing parent marker thread is found"
 * scenario. The /threads GET returns one parent PR-level marker thread
 * (no threadContext, one marker comment) plus no inline threads. Per
 * the PARENT-TOP-* contract the live flow must REPLACE the parent
 * (delete every comment → POST a fresh parent) so the new thread id
 * sits at the top of the conversation timeline.
 */
function existingParentRoutes(): readonly FreshableRoute[] {
  let postCount = 0;
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
              id: EXISTING_PARENT_THREAD_ID,
              status: "active",
              threadContext: null,
              comments: [
                {
                  id: EXISTING_PARENT_COMMENT_ID,
                  content:
                    "<!-- umactually-pr-review -->\n## 💬 DISCUSS\n\nProvider response did not contain a valid JSON review payload.\n",
                },
              ],
            },
          ],
        }),
    },
    {
      // Per-comment DELETE on the existing parent thread.
      match: (url, method) =>
        method === "DELETE" &&
        url.includes(`/threads/${EXISTING_PARENT_THREAD_ID}/comments/`),
      response: () => makeJsonResponse({}, 200),
    },
    {
      // /threads POST — first call returns the inline thread id (with
      // its first comment id so the per-comment PATCH that injects
      // the parent-reference can find its target), second call
      // returns the new parent thread id (no comment body needed).
      match: (url, method) => method === "POST" && url.endsWith("/threads?api-version=7.1"),
      response: () => {
        postCount += 1;
        if (postCount === 1) {
          return makeJsonResponse(
            { id: 8001, comments: [{ id: 9001, content: "<!-- umactually-pr-review -->\ninitial" }] },
            200,
          );
        }
        return makeJsonResponse({ id: NEW_PARENT_THREAD_ID }, 200);
      },
    },
    {
      // Per-comment PATCH on the inline thread.
      match: (url, method) =>
        method === "PATCH" && /\/threads\/\d+\/comments\/\d+\?api-version=7\.1$/.test(url),
      response: () => makeJsonResponse({}, 200),
    },
    {
      match: (url, method) => method === "GET" && url.endsWith("/statuses?api-version=7.1"),
      // Empty statuses list: new dedup helper looks here first.
      response: () => makeJsonResponse({ count: 0, value: [] }),
    },
    {
      match: (url, method) => method === "POST" && url.endsWith("/statuses?api-version=7.1"),
      response: () => makeJsonResponse({ id: 88 }, 200),
    },
  ];
}

describe("postAzurePrComment (Azure parent PR-level replace-not-patch)", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy?.mockRestore();
    stderrSpy = undefined;
  });

  it("PARENT-UPDATE-001: detects an existing parent marker thread and replaces it (DELETE comments + POST new), not PATCH in place", async () => {
    // Given: Azure already has an active parent PR-level marker thread (id=79)
    // with one marker comment.
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

    // And: the existing parent had its marker comment DELETEd via the
    // documented per-comment Delete endpoint. No PATCH went to the
    // old parent's thread URL — the PATCH-in-place path is gone.
    const deleteCalls = recorder.calls.filter(
      (call) =>
        call.method === "DELETE" &&
        call.url.includes(`/threads/${EXISTING_PARENT_THREAD_ID}/comments/${EXISTING_PARENT_COMMENT_ID}?`),
    );
    expect(deleteCalls).toHaveLength(1);

    const patchCalls = recorder.calls.filter(
      (call) =>
        call.method === "PATCH" &&
        call.url.includes(`/threads/${EXISTING_PARENT_THREAD_ID}?`),
    );
    expect(patchCalls).toHaveLength(0);

    // And: the new parent POST went out (no threadContext), getting a
    // brand-new thread id. It is the LAST /threads POST in the call
    // log so it follows any inline thread POST — this is what gives
    // it the highest thread id on the PR and places it at the TOP of
    // the ADO PR Overview conversation.
    const parentPosts = recorder.calls.filter((call) => {
      if (call.method !== "POST" || !call.url.endsWith("/threads?api-version=7.1")) {
        return false;
      }
      const body = call.body;
      if (typeof body !== "object" || body === null) {
        return false;
      }
      return !("threadContext" in (body as Record<string, unknown>));
    });
    expect(parentPosts).toHaveLength(1);
    expect(parentPosts[0]?.url).toContain("/threads?api-version=7.1");

    // And: the parent POST happens AFTER the inline thread POST(s).
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
    const parentIndex = recorder.calls.indexOf(parentPosts[0]!);
    const lastInlineIndex = recorder.calls.indexOf(inlinePosts[inlinePosts.length - 1]!);
    expect(parentIndex).toBeGreaterThan(lastInlineIndex);
  });

  it("PARENT-UPDATE-002: new parent POST body carries the buildReviewBody content (no comment id reuse)", async () => {
    // Given: same as above.
    const recorder = makeFetchRecorder(existingParentRoutes());

    // When: the live Azure path runs.
    await runLive({
      parsed: parseCliArgs(["--platform", "azure", "--no-dry-run"]),
      cwd: process.cwd(),
      env: azureEnv(),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: the LAST /threads POST is the new parent, with the
    // documented "Comment on the pull request" shape: comments[0]
    // carries `parentCommentId: 0`, `commentType: 1`, and the new
    // buildReviewBody content. There is no `threadContext`. There
    // is no `id` field on the comment (we are CREATING a brand new
    // comment, not updating an existing one).
    const parentPost = recorder.calls.filter((call) => {
      if (call.method !== "POST" || !call.url.endsWith("/threads?api-version=7.1")) {
        return false;
      }
      const body = call.body;
      if (typeof body !== "object" || body === null) {
        return false;
      }
      return !("threadContext" in (body as Record<string, unknown>));
    }).pop();
    expect(parentPost).toBeDefined();
    if (parentPost === undefined) {
      throw new Error("expected new parent thread post");
    }
    const parentBody = readRecord(parentPost.body as Record<string, unknown>, "new parent post body");

    expect(parentBody["threadContext"]).toBeUndefined();
    const comments = readArray(parentBody["comments"], "new parent post comments");
    expect(comments).toHaveLength(1);
    const firstComment = readRecord(comments[0] as Record<string, unknown>, "new parent first comment");
    expect(firstComment["parentCommentId"]).toBe(0);
    expect(firstComment["commentType"]).toBe(1);
    // The new parent must NOT carry an existing comment id (that would
    // be the PATCH shape, not the POST shape).
    expect(firstComment["id"]).toBeUndefined();
    const content = firstComment["content"];
    expect(typeof content).toBe("string");
    if (typeof content !== "string") {
      throw new Error("new parent comment content must be a string");
    }
    expect(content).toContain("<!-- umactually-pr-review -->");
    expect(content).toContain("Azure parent-comment summary.");
    expect(content).toMatch(/SHIP|APPROVED/);
  });

  it("PARENT-UPDATE-003: each inline thread PATCHes its comment body to reference the NEW parent id, not the old one", async () => {
    // Given: Azure already has an active parent PR-level marker thread
    // (id=79). The replacement path returns a NEW parent id (9999 in
    // this fixture). The flow:
    //   1. POST every inline thread FIRST (no parent ref yet).
    //   2. POST the new parent LAST (gets highest id, top of conv).
    //   3. PATCH every inline thread's first comment to inject
    //      `Reply to PR review summary #NEW_PARENT_ID`.
    const recorder = makeFetchRecorder(existingParentRoutes());

    // When: the live Azure path runs.
    await runLive({
      parsed: parseCliArgs(["--platform", "azure", "--no-dry-run"]),
      cwd: process.cwd(),
      env: azureEnv(),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: at least one PATCH went out per inline thread, and each
    // PATCH body references the NEW parent id (so humans reading the
    // PR can correlate findings with the new summary card).
    const patchCalls = recorder.calls.filter((call) => {
      if (call.method !== "PATCH") return false;
      return /\/threads\/\d+\/comments\/\d+\?api-version=7\.1$/.test(call.url);
    });
    expect(patchCalls.length).toBeGreaterThan(0);
    for (const patchCall of patchCalls) {
      const body = readRecord(patchCall.body as Record<string, unknown>, "patch body");
      const content = body["content"];
      expect(typeof content).toBe("string");
      if (typeof content !== "string") {
        throw new Error("patched inline content must be a string");
      }
      // The PATCHed body references the NEW parent id, not the OLD one.
      expect(content).toContain(`Reply to PR review summary #${NEW_PARENT_THREAD_ID}`);
      expect(content).not.toContain(`Reply to PR review summary #${EXISTING_PARENT_THREAD_ID}`);
    }
  });
});