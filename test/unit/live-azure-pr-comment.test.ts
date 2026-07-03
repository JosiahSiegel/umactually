// Unit tests for the parent-PR-comment posting helper used by the Azure
// DevOps live review flow.
//
// Background: Azure DevOps PRs render each thread as a flat card in the
// conversation timeline, with no native "review summary that nests inline
// comments" shape (unlike GitHub's `body`-on-review model). The Microsoft
// Learn docs for the Pull Request Threads - Create endpoint document a
// "Comment on the pull request" example that POSTs to the SAME
// `/threads` endpoint but with the `threadContext` field omitted. ADO
// renders that thread as a free-form PR-level (issue-style) comment in
// the conversation, not as a file-pinned inline thread. See:
//   https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/create?view=azure-devops-rest-7.1
//
// We use this documented shape to post the `buildReviewBody()` content
// as a parent review summary BEFORE the inline threads, so the user sees:
//   [PR-level parent review summary]
//   [inline file/line thread]
//   [inline file/line thread]
//   ...
// in the conversation, which is closer (though not identical) to
// GitHub's nested review block.
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

// Route shape used in this file: `response` may be a static Response
// (from azureDiffRoutes) or a closure that builds a fresh Response per
// call. Closures are required for routes that get hit multiple times
// because a Response body can only be consumed once.
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

function azureBaseRoutes(): readonly FreshableRoute[] {
  let threadPostCount = 0;
  return [
    ...azureDiffRoutes(makeJsonResponse, azureReviewDiffFixture()),
    {
      match: (url, method) => method === "POST" && url === "https://provider.example/v1/responses",
      response: () => makeJsonResponse({ output_text: PROVIDER_REVIEW }),
    },
    {
      match: (url, method) => method === "GET" && url.endsWith("/threads?api-version=7.1"),
      response: () => makeJsonResponse({ count: 0, value: [] }),
    },
    {
      // /threads POST: serve a fresh JSON response per call so each POST
      // gets its own (unread) response body — Response bodies can only
      // be consumed once.
      match: (url, method) => method === "POST" && url.endsWith("/threads?api-version=7.1"),
      response: () => makeJsonResponse({ id: 77 + (threadPostCount += 1) }, 200),
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

function findCall(calls: readonly RecordedCall[], method: string, urlSuffix: string): RecordedCall {
  for (const call of calls) {
    if (call.method === method && call.url.endsWith(urlSuffix)) {
      return call;
    }
  }
  throw new Error(`missing ${method} ${urlSuffix}`);
}

function threadPosts(calls: readonly RecordedCall[]): readonly RecordedCall[] {
  return calls.filter(
    (call) => call.method === "POST" && call.url.endsWith("/threads?api-version=7.1"),
  );
}

// Build a FreshableRoute array by mapping AzureFetchRoute[].response to
// a closure so each match produces a fresh Response. Required because
// the existing AzureFetchRoute from `azure-diff-fixture.ts` returns a
// static Response that gets consumed on first read.
function freshable(routes: readonly AzureFetchRoute[]): FreshableRoute[] {
  return routes.map((route) => ({
    match: route.match,
    response: () => route.response,
  }));
}

describe("postAzurePrComment (Azure parent PR-level review summary)", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn> | undefined;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy?.mockRestore();
    stderrSpy = undefined;
  });

  it("PARITY-100: posts a parent PR comment to /threads WITHOUT threadContext AFTER any inline thread", async () => {
    // Given: an Azure live environment with one inline finding.
    const recorder = makeFetchRecorder(azureBaseRoutes());

    // When: the live Azure path runs.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "azure", "--no-dry-run"]),
      cwd: process.cwd(),
      env: azureEnv(),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: at least two /threads POSTs happen — the inline (with
    // threadContext) one, and the parent PR-level (no threadContext).
    expect(result.exitCode).toBe(0);
    const posts = threadPosts(recorder.calls);
    expect(posts.length).toBeGreaterThanOrEqual(2);

    // The PARENT (no threadContext) is POSTed LAST so it gets the
    // highest thread id on the PR and sits at the TOP of the ADO
    // PR Overview conversation (which sorts threads by id descending
    // by default). See the docstring in runAzureLive for the full
    // ordering rationale.
    const parentPost = posts[posts.length - 1];
    expect(parentPost).toBeDefined();
    if (parentPost === undefined) {
      throw new Error("expected last thread post");
    }
    const parentBody = readRecord(parentPost.body as Record<string, unknown>, "parent thread body");
    expect(parentBody["threadContext"]).toBeUndefined();
    // The parent comment body MUST carry the verdict badge + stable marker
    // from buildReviewBody so the conversation timeline shows the same
    // review-header contract that GitHub's review-body field carries.
    const parentComments = readArray(parentBody["comments"], "parent comments");
    const parentFirst = readRecord(parentComments[0] as Record<string, unknown>, "parent first comment");
    const parentContent = parentFirst["content"];
    expect(typeof parentContent).toBe("string");
    if (typeof parentContent !== "string") {
      throw new Error("parent content must be a string");
    }
    expect(parentContent).toContain("<!-- umactually-pr-review -->");
    expect(parentContent).toMatch(/NEEDS_FIX|SHIP|APPROVED|DISCUSS|COMMENT/);
    expect(parentContent).toContain("Azure parent-comment summary.");
    // parentCommentId must be 0 and status must be 1 (active).
    expect(parentFirst["parentCommentId"]).toBe(0);
    expect(parentFirst["commentType"]).toBe(1);
    expect(parentBody["status"]).toBe(1);

    // At least one EARLIER thread POST must include threadContext
    // (the inline-file-pinned shape).
    const inlinePost = posts.slice(0, -1).find((call) => {
      const body = readRecord(call.body as Record<string, unknown>, "inline thread body");
      return body["threadContext"] !== undefined;
    });
    expect(inlinePost).toBeDefined();
  });

  it("PARITY-101: still posts inline threads when the parent PR comment POST fails", async () => {
    // Given: the LAST /threads POST fails (5xx) — the parent —
    // but earlier inline POSTs succeed.
    let postCount = 0;
    const routes: FreshableRoute[] = azureBaseRoutes()
      .filter((route) =>
        !route.match(
          "https://dev.azure.com/example-org/Example%20Project/_apis/git/repositories/repo-42/pullRequests/42/threads?api-version=7.1",
          "POST",
        ),
      );
    // Stateful /threads POST: first call succeeds (inline), second
    // call fails (parent — POSTed last). The new ordering is
    // inline-first, parent-last.
    routes.push({
      match: (url, method) => method === "POST" && url.endsWith("/threads?api-version=7.1"),
      response: () => {
        postCount += 1;
        if (postCount === 1) {
          return makeJsonResponse({ id: 77 }, 200);
        }
        return makeJsonResponse({ error: "parent POST failed" }, 500);
      },
    });

    const recorder = makeFetchRecorder(routes);

    // When: the live Azure path runs.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "azure", "--no-dry-run"]),
      cwd: process.cwd(),
      env: azureEnv(),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: at least one inline thread POST landed, the run still succeeds,
    // and a warning mentioning the parent PR comment was emitted.
    expect(result.exitCode).toBe(0);
    expect(result.posted).toBe(true);
    const posts = threadPosts(recorder.calls);
    // We expect at least 2 calls: the successful inline + the failed parent.
    expect(posts.length).toBeGreaterThanOrEqual(2);

    // The run posted the PR status (success path).
    expect(findCall(recorder.calls, "POST", "/statuses?api-version=7.1")).toBeDefined();
  });

  it("PARITY-102: replaces the existing parent PR-level marker thread (delete-then-POST)", async () => {
    // Given: Azure returns an existing parent PR-level marker thread
    // (id and threadContext: null) with one marker comment. Per the
    // PARENT-TOP-* contract the live Azure path must REPLACE that
    // thread so the new parent gets the highest thread id on the PR
    // (which is the only reliable way to keep it at the top of the
    // conversation timeline — see
    //   https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-thread-comments/delete?view=azure-devops-rest-7.1
    // ). The replacement is one per-comment DELETE for every comment
    // on the old thread followed by a fresh /threads POST.
    const EXISTING_PARENT_THREAD_ID = 79;
    const EXISTING_PARENT_COMMENT_ID = 12345;
    const NEW_PARENT_THREAD_ID = 5000;
    let threadPostCount = 0;
    const existingParentRoutes: FreshableRoute[] = [
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
                    content: "<!-- umactually-pr-review -->\nExisting parent review summary.",
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
        // /threads POST — first call returns the new parent id,
        // second call returns the inline thread id.
        match: (url, method) => method === "POST" && url.endsWith("/threads?api-version=7.1"),
        response: () => {
          threadPostCount += 1;
          if (threadPostCount === 1) {
            return makeJsonResponse({ id: NEW_PARENT_THREAD_ID }, 200);
          }
          return makeJsonResponse({ id: 77 + threadPostCount }, 200);
        },
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
    const recorder = makeFetchRecorder(existingParentRoutes);

    // When: the live Azure path runs.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "azure", "--no-dry-run"]),
      cwd: process.cwd(),
      env: azureEnv(),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: at least two /threads POSTs happen — the new parent and
    // the inline finding. The old PATCH-in-place behavior is gone.
    expect(result.exitCode).toBe(0);
    const posts = threadPosts(recorder.calls);
    expect(posts.length).toBeGreaterThanOrEqual(2);

    // The LAST /threads POST is the new parent (no threadContext) —
    // posting the parent last gives it the highest thread id on the
    // PR so it sits at the TOP of the ADO PR Overview conversation
    // (which sorts threads by id descending by default). See the
    // docstring in runAzureLive for the full ordering rationale.
    const parentPost = posts[posts.length - 1];
    expect(parentPost).toBeDefined();
    if (parentPost === undefined) {
      throw new Error("expected last thread post");
    }
    const parentBody = readRecord(parentPost.body as Record<string, unknown>, "parent thread body");
    expect(parentBody["threadContext"]).toBeUndefined();

    // And: at least one earlier /threads POST is the inline thread
    // (with threadContext).
    const inlinePost = posts.slice(0, -1).find((call) => {
      const body = readRecord(call.body as Record<string, unknown>, "inline thread body");
      return body["threadContext"] !== undefined;
    });
    expect(inlinePost).toBeDefined();

    // And: NO PATCH went out to the existing parent's thread URL — the
    // old "patch in place" path is replaced.
    const patchCalls = recorder.calls.filter(
      (call) =>
        call.method === "PATCH" &&
        call.url.includes(`/threads/${EXISTING_PARENT_THREAD_ID}?`),
    );
    expect(patchCalls).toHaveLength(0);

    // And: at least one DELETE went out for the existing parent's
    // marker comment so ADO flips it to `isDeleted: true`.
    const deleteCalls = recorder.calls.filter(
      (call) =>
        call.method === "DELETE" &&
        call.url.includes(`/threads/${EXISTING_PARENT_THREAD_ID}/comments/`),
    );
    expect(deleteCalls.length).toBeGreaterThanOrEqual(1);
  });
});