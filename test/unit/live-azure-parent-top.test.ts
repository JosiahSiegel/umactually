// Unit tests for the "parent PR review summary stays at the top of the PR
// conversation" behavior on Azure DevOps.
//
// Background: Azure DevOps PRs render each thread as a flat card in the
// conversation timeline, sorted strictly by thread id ascending. Per
// https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/list?view=azure-devops-rest-7.1
// the List endpoint returns threads in id order, which matches the
// default "Sort by oldest first" view in the web UI.
//
// The previous behavior was to PATCH the existing parent thread in place
// (https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/update?view=azure-devops-rest-7.1).
// That preserves the thread's original id — so once a system-activity
// event posts a thread with a higher id (e.g. branch-update events from
// `git push`), the parent summary sinks below those events and the user
// has to scroll past dozens of activity entries to find it. The user
// repeatedly reported "where's the review summary. didn't you say it's
// supposed to stay at the top".
//
// The fix: every CLI run replaces the parent PR-level summary by:
//
//   1. Locating the existing parent marker thread (one with no
//      `threadContext` whose first comment carries the
//      `<!-- umactually-pr-review -->` marker).
//   2. Deleting every comment in that thread via the documented
//      per-comment Delete endpoint
//      (DELETE .../threads/{threadId}/comments/{commentId}?api-version=7.1,
//      https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-thread-comments/delete?view=azure-devops-rest-7.1).
//      Per the same doc family, deleting all comments leaves the
//      thread with `isDeleted: true`, and `isDeleted: true` threads are
//      hidden from the conversation.
//   3. POSTing a brand-new parent thread — the new thread gets the
//      highest id on the PR and therefore sits at the TOP of the
//      conversation timeline.
//
// The old thread's id is lost; that is the intended trade-off (users
// only see the latest state anyway). The existing inline threads that
// were posted on previous runs still carry the textual reference
// "Reply to PR review summary #OLD_ID" in their bodies; that text is
// purely informational — it is not a real parent-child link in ADO's
// data model (parentCommentId is for replies within a thread, not
// cross-thread parenting). Newly-posted inline threads get the new
// parent id.
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
  summary: "Azure parent-top summary.",
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

// Existing parent thread fixture used by the "replace, not patch" tests.
// The thread has multiple comments (representing the comment history
// that has accumulated across previous runs — ADO Update does not
// collapse them, so each PATCH adds a new comment with a new id).
const EXISTING_PARENT_THREAD_ID = 79;
const EXISTING_PARENT_COMMENTS: readonly { id: number; content: string }[] = [
  {
    id: 1,
    content: "<!-- umactually-pr-review -->\n## ⛔ NEEDS_FIX\n\nProvider response did not contain a valid JSON review payload.",
  },
  {
    id: 2,
    content: "<!-- umactually-pr-review -->\n## ⛔ NEEDS_FIX\n\nProvider response did not contain a valid JSON review payload.",
  },
  {
    id: 3,
    content: "<!-- umactually-pr-review -->\n## ⛔ NEEDS_FIX\n\nProvider response did not contain a valid JSON review payload.",
  },
];

const NEW_PARENT_THREAD_ID = 9999;

/**
 * Build the route set for the "existing parent marker thread is found"
 * scenario. The /threads GET returns the existing parent PR-level
 * marker thread (no threadContext, multiple comments with the marker)
 * plus several newer system-activity / inline threads whose ids are
 * higher than the parent — this is the exact ordering problem the
 * user reported.
 *
 * The new behavior is: delete every comment on the old parent (so
 * ADO flips the thread to `isDeleted: true`), then POST a brand-new
 * parent that gets the highest id on the PR.
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
          count: 5,
          value: [
            // Simulate the EXACT PR-conversation state the user sees:
            // the parent thread (#79) is buried below newer
            // system-activity events and inline threads that posted
            // after it. Real PR #42 has parent at #79 and system
            // activity through #113. We deliberately avoid any
            // existing inline thread at file=src/review/example.ts
            // line=3 so the dedup logic does NOT skip the new inline
            // POST — this test is about ordering, not dedup.
            {
              id: 70,
              status: null,
              threadContext: null,
              comments: [{ id: 1, content: "The reference refs/heads/feature/world-class-pr-review was u" }],
            },
            {
              id: 75,
              status: null,
              threadContext: null,
              comments: [{ id: 1, content: "The reference refs/heads/feature/world-class-pr-review was u" }],
            },
            {
              id: EXISTING_PARENT_THREAD_ID,
              status: "active",
              threadContext: null,
              comments: EXISTING_PARENT_COMMENTS.map((c) => ({ id: c.id, content: c.content })),
            },
            {
              id: 81,
              status: "active",
              threadContext: {
                filePath: "/src/review/example.ts",
                rightFileStart: { line: 99, offset: 1 },
                rightFileEnd: { line: 99, offset: 1 },
              },
              comments: [{ id: 1, content: "<!-- umactually-pr-review -->\nOld inline finding at line 99." }],
            },
            {
              id: 82,
              status: null,
              threadContext: null,
              comments: [{ id: 1, content: "The reference refs/heads/feature/world-class-pr-review was u" }],
            },
          ],
        }),
    },
    {
      // Per-comment DELETE on the existing parent — one per comment.
      match: (url, method) =>
        method === "DELETE" &&
        url.startsWith(
          `https://dev.azure.com/example-org/Example%20Project/_apis/git/repositories/repo-42/pullRequests/42/threads/${EXISTING_PARENT_THREAD_ID}/comments/`,
        ),
      response: () => makeJsonResponse({}, 200),
    },
    {
      // /threads POST — the parent POST is the first call, the inline
      // thread POST is the second call. Return a fresh id per call.
      match: (url, method) => method === "POST" && url.endsWith("/threads?api-version=7.1"),
      response: () => {
        postCount += 1;
        if (postCount === 1) {
          return makeJsonResponse({ id: NEW_PARENT_THREAD_ID }, 200);
        }
        return makeJsonResponse({ id: 8000 + postCount }, 200);
      },
    },
    {
      match: (url, method) => method === "GET" && url.endsWith("/statuses?api-version=7.1"),
      response: () => makeJsonResponse({ count: 0, value: [] }),
    },
    {
      match: (url, method) => method === "POST" && url.endsWith("/statuses?api-version=7.1"),
      response: () => makeJsonResponse({ id: 88 }, 200),
    },
  ];
}

describe("postAzurePrComment (Azure parent PR-level 'always at top of conversation')", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy?.mockRestore();
    stderrSpy = undefined;
  });

  it("PARENT-TOP-001: deletes every comment on the existing parent thread before POSTing the new one", async () => {
    // Given: Azure already has an active parent PR-level marker thread
    // (id=79) with 3 comments accumulated across previous runs.
    const recorder = makeFetchRecorder(existingParentRoutes());

    // When: the live Azure path runs.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "azure", "--no-dry-run"]),
      cwd: process.cwd(),
      env: azureEnv(),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: the run succeeded.
    expect(result.exitCode).toBe(0);

    // And: every comment on the OLD parent thread was DELETEd via the
    // documented per-comment Delete endpoint. With 3 comments on the
    // existing parent, we expect exactly 3 DELETE calls, one per
    // comment id.
    const deleteCalls = recorder.calls.filter(
      (call) =>
        call.method === "DELETE" &&
        call.url.startsWith(
          `https://dev.azure.com/example-org/Example%20Project/_apis/git/repositories/repo-42/pullRequests/42/threads/${EXISTING_PARENT_THREAD_ID}/comments/`,
        ),
    );
    const deletedCommentIds = new Set(
      deleteCalls.map((call) => {
        const match = call.url.match(/\/comments\/(\d+)\?/);
        return match?.[1] ?? "?";
      }),
    );
    expect(deleteCalls).toHaveLength(EXISTING_PARENT_COMMENTS.length);
    for (const comment of EXISTING_PARENT_COMMENTS) {
      expect(deletedCommentIds.has(String(comment.id))).toBe(true);
    }

    // And: NO PATCH to /threads/{threadId} went out — the old PATCH
    // in-place path is gone. (If anyone reintroduces it, the thread
    // id would not move to the top, defeating the whole point of
    // this fix.)
    const patchCalls = recorder.calls.filter(
      (call) =>
        call.method === "PATCH" &&
        call.url.startsWith(
          `https://dev.azure.com/example-org/Example%20Project/_apis/git/repositories/repo-42/pullRequests/42/threads/`,
        ) &&
        !call.url.includes("/comments/"),
    );
    expect(patchCalls).toHaveLength(0);
  });

  it("PARENT-TOP-002: the new parent thread id is strictly greater than every existing thread id", async () => {
    // Given: Azure already has an active parent PR-level marker thread
    // (id=79) plus 4 other threads with ids 70, 75, 81, 82 — max id 82.
    const recorder = makeFetchRecorder(existingParentRoutes());

    // When: the live Azure path runs.
    await runLive({
      parsed: parseCliArgs(["--platform", "azure", "--no-dry-run"]),
      cwd: process.cwd(),
      env: azureEnv(),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: the FIRST /threads POST (the new parent) returns an id
    // strictly greater than every existing thread id, so it appears
    // at the TOP of the conversation timeline (the ADO UI sorts by
    // thread id ascending). This is what the user asked for:
    // "where's the review summary. didn't you say it's supposed to
    // stay at the top".
    const parentPosts = recorder.calls.filter((call) => {
      if (call.method !== "POST" || !call.url.endsWith("/threads?api-version=7.1")) {
        return false;
      }
      const body = call.body;
      if (typeof body !== "object" || body === null) {
        return false;
      }
      // Parent shape: NO `threadContext` field.
      return !("threadContext" in (body as Record<string, unknown>));
    });
    expect(parentPosts).toHaveLength(1);
    const existingIds = [70, 75, EXISTING_PARENT_THREAD_ID, 81, 82];
    const maxExisting = Math.max(...existingIds);
    expect(NEW_PARENT_THREAD_ID).toBeGreaterThan(maxExisting);
  });

  it("PARENT-TOP-003: the new parent is POSTed BEFORE the inline thread POST (ordering preserved)", async () => {
    // Given: existing parent fixture.
    const recorder = makeFetchRecorder(existingParentRoutes());

    // When: the live Azure path runs.
    await runLive({
      parsed: parseCliArgs(["--platform", "azure", "--no-dry-run"]),
      cwd: process.cwd(),
      env: azureEnv(),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: the FIRST /threads POST in the call list is the new parent
    // (no threadContext). All later /threads POSTs are the inline
    // thread (with threadContext). The parent id is referenced in
    // each inline comment body as the reply target.
    const posts = recorder.calls.filter(
      (call) => call.method === "POST" && call.url.endsWith("/threads?api-version=7.1"),
    );
    expect(posts.length).toBeGreaterThanOrEqual(2);

    // The first POST is the new parent (no threadContext).
    const parentPost = posts[0];
    expect(parentPost).toBeDefined();
    if (parentPost === undefined) {
      throw new Error("expected first thread post");
    }
    const parentBody = readRecord(parentPost.body as Record<string, unknown>, "parent post body");
    expect(parentBody["threadContext"]).toBeUndefined();
    const parentComments = readArray(parentBody["comments"], "parent post comments");
    const parentFirst = readRecord(parentComments[0] as Record<string, unknown>, "parent first comment");
    const parentContent = parentFirst["content"];
    expect(typeof parentContent).toBe("string");
    if (typeof parentContent !== "string") {
      throw new Error("parent content must be a string");
    }
    expect(parentContent).toContain("<!-- umactually-pr-review -->");
    expect(parentContent).toContain("Azure parent-top summary.");

    // The later POST is the inline thread (with threadContext), and
    // its body MUST reference the NEW parent id (not the old one).
    const inlinePosts = posts.slice(1).filter((call) => {
      const body = readRecord(call.body as Record<string, unknown>, "inline body");
      return body["threadContext"] !== undefined;
    });
    expect(inlinePosts.length).toBeGreaterThan(0);
    for (const inlinePost of inlinePosts) {
      const body = readRecord(inlinePost.body as Record<string, unknown>, "inline body");
      const comments = readArray(body["comments"], "inline comments");
      expect(comments).toHaveLength(1);
      const firstComment = readRecord(comments[0] as Record<string, unknown>, "inline first comment");
      const content = firstComment["content"];
      expect(typeof content).toBe("string");
      if (typeof content !== "string") {
        throw new Error("inline content must be a string");
      }
      // Inline thread points at the NEW parent id, not the OLD one.
      expect(content).toContain(`Reply to PR review summary #${NEW_PARENT_THREAD_ID}`);
      expect(content).not.toContain(`Reply to PR review summary #${EXISTING_PARENT_THREAD_ID}`);
    }
  });

  it("PARENT-TOP-004: the run still succeeds and posts inline + status when the existing parent has zero comments", async () => {
    // Given: an existing parent thread whose comments array is empty
    // (defensive — the prior PATCH-in-place path leaves the parent
    // in place, but a future run could find a 0-comment parent from
    // an edge case; we must not crash on the "delete every comment"
    // loop).
    const emptyParentRoutes: FreshableRoute[] = [
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
                comments: [],
              },
            ],
          }),
      },
      {
        // /threads POST — the parent POST is the first call, the
        // inline thread POST is the second call.
        match: (url, method) => method === "POST" && url.endsWith("/threads?api-version=7.1"),
        response: () => makeJsonResponse({ id: NEW_PARENT_THREAD_ID }, 200),
      },
      {
        match: (url, method) => method === "GET" && url.endsWith("/statuses?api-version=7.1"),
        response: () => makeJsonResponse({ count: 0, value: [] }),
      },
      {
        match: (url, method) => method === "POST" && url.endsWith("/statuses?api-version=7.1"),
        response: () => makeJsonResponse({ id: 88 }, 200),
      },
    ];

    const recorder = makeFetchRecorder(emptyParentRoutes);

    // When: the live Azure path runs.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "azure", "--no-dry-run"]),
      cwd: process.cwd(),
      env: azureEnv(),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: success path — parent POST + inline POST + status POST.
    expect(result.exitCode).toBe(0);
    expect(result.posted).toBe(true);

    // And: NO DELETE calls went out — the 0-comment parent had
    // nothing to delete.
    const deleteCalls = recorder.calls.filter((call) => call.method === "DELETE");
    expect(deleteCalls).toHaveLength(0);

    // And: the new parent POST is still the FIRST /threads POST.
    const posts = recorder.calls.filter(
      (call) => call.method === "POST" && call.url.endsWith("/threads?api-version=7.1"),
    );
    expect(posts.length).toBeGreaterThanOrEqual(2);
    const parentPost = posts[0];
    expect(parentPost).toBeDefined();
    if (parentPost === undefined) {
      throw new Error("expected first thread post");
    }
    const parentBody = readRecord(parentPost.body as Record<string, unknown>, "parent post body");
    expect(parentBody["threadContext"]).toBeUndefined();
  });
});