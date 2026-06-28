import { describe, expect, it } from "vitest";

import { parseCliArgs } from "../../src/cli.js";
import { runLive } from "../../src/cli/orchestrator.js";

type RecordedCall = {
  readonly url: string;
  readonly method: string;
  readonly authorization: string;
  readonly body: unknown;
};

type FetchRoute = {
  readonly match: (url: string, method: string) => boolean;
  readonly response: Response;
};

const AZURE_DIFF_TEXT = [
  "diff --git a/src/review/example.ts b/src/review/example.ts",
  "index 1111111..2222222 100644",
  "--- a/src/review/example.ts",
  "+++ b/src/review/example.ts",
  "@@ -1,4 +1,7 @@",
  " export function renderReview(): string {",
  "-  return \"old\";",
  "+  return \"new\";",
  " }",
].join("\n");

const PROVIDER_REVIEW = JSON.stringify({
  summary: "Azure live summary.",
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

function makeFetchRecorder(routes: readonly FetchRoute[]): {
  readonly calls: readonly RecordedCall[];
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
        return route.response;
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

function azureRoutes(): readonly FetchRoute[] {
  return [
    {
      match: (url, method) => method === "POST" && url.endsWith("/diffs/commits?api-version=7.1"),
      response: new Response(AZURE_DIFF_TEXT, { status: 200 }),
    },
    {
      match: (url, method) => method === "POST" && url === "https://provider.example/v1/responses",
      response: makeJsonResponse({ output_text: PROVIDER_REVIEW }),
    },
    {
      match: (url, method) => method === "GET" && url.endsWith("/threads?api-version=7.1"),
      response: makeJsonResponse({ count: 0, value: [] }),
    },
    {
      match: (url, method) => method === "POST" && url.endsWith("/threads?api-version=7.1"),
      response: makeJsonResponse({ id: 77 }, 200),
    },
    {
      match: (url, method) => method === "POST" && url.endsWith("/statuses?api-version=7.1"),
      response: makeJsonResponse({ id: 88 }, 200),
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

function countThreadPosts(calls: readonly RecordedCall[]): number {
  return calls.filter(
    (call) => call.method === "POST" && call.url.endsWith("/threads?api-version=7.1"),
  ).length;
}

describe("runLive Azure dedup edge cases", () => {
  it("S7-RED-013: treats a closed marker thread as duplicate (no new POST)", async () => {
    // Given: Azure returns an existing marker thread with closed status at the same location.
    const duplicateRoutes: readonly FetchRoute[] = [
      ...azureRoutes().filter((route) => !route.match("https://dev.azure.com/example-org/Example%20Project/_apis/git/repositories/repo-42/pullRequests/42/threads?api-version=7.1", "GET")),
      {
        match: (url, method) => method === "GET" && url.endsWith("/threads?api-version=7.1"),
        response: makeJsonResponse({
          count: 1,
          value: [
            {
              status: "closed",
              filePath: "/src/review/example.ts",
              rightFileStart: { line: 3, offset: 1 },
              comments: [
                { content: "Existing closed comment <!-- umactually-pr-review -->" },
              ],
            },
          ],
        }),
      },
    ];
    const recorder = makeFetchRecorder(duplicateRoutes);

    // When: the live Azure path runs.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "azure", "--no-dry-run"]),
      cwd: process.cwd(),
      env: azureEnv(),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: it must NOT post a new thread; only the PR status should be sent.
    expect(result.exitCode).toBe(0);
    expect(countThreadPosts(recorder.calls)).toBe(0);
    expect(findCall(recorder.calls, "POST", "/statuses?api-version=7.1")).toBeDefined();
  });

  it("S7-RED-014: treats a fixed marker thread as duplicate (no new POST)", async () => {
    // Given: Azure returns an existing marker thread with fixed status at the same location.
    const duplicateRoutes: readonly FetchRoute[] = [
      ...azureRoutes().filter((route) => !route.match("https://dev.azure.com/example-org/Example%20Project/_apis/git/repositories/repo-42/pullRequests/42/threads?api-version=7.1", "GET")),
      {
        match: (url, method) => method === "GET" && url.endsWith("/threads?api-version=7.1"),
        response: makeJsonResponse({
          count: 1,
          value: [
            {
              status: "fixed",
              filePath: "/src/review/example.ts",
              rightFileStart: { line: 3, offset: 1 },
              comments: [
                { content: "Existing fixed comment <!-- umactually-pr-review -->" },
              ],
            },
          ],
        }),
      },
    ];
    const recorder = makeFetchRecorder(duplicateRoutes);

    // When: the live Azure path runs.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "azure", "--no-dry-run"]),
      cwd: process.cwd(),
      env: azureEnv(),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: it must NOT post a new thread; only the PR status should be sent.
    expect(result.exitCode).toBe(0);
    expect(countThreadPosts(recorder.calls)).toBe(0);
    expect(findCall(recorder.calls, "POST", "/statuses?api-version=7.1")).toBeDefined();
  });

  it("S7-RED-015: marker in a non-first comment still triggers dedup (no new POST)", async () => {
    // Given: Azure returns an active thread whose marker lives in the second comment, not the first.
    const duplicateRoutes: readonly FetchRoute[] = [
      ...azureRoutes().filter((route) => !route.match("https://dev.azure.com/example-org/Example%20Project/_apis/git/repositories/repo-42/pullRequests/42/threads?api-version=7.1", "GET")),
      {
        match: (url, method) => method === "GET" && url.endsWith("/threads?api-version=7.1"),
        response: makeJsonResponse({
          count: 1,
          value: [
            {
              status: "active",
              filePath: "/src/review/example.ts",
              rightFileStart: { line: 3, offset: 1 },
              comments: [
                { content: "First comment without marker." },
                { content: "<!-- umactually-pr-review --> Reply." },
              ],
            },
          ],
        }),
      },
    ];
    const recorder = makeFetchRecorder(duplicateRoutes);

    // When: the live Azure path runs.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "azure", "--no-dry-run"]),
      cwd: process.cwd(),
      env: azureEnv(),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: it must NOT post a new thread; only the PR status should be sent.
    expect(result.exitCode).toBe(0);
    expect(countThreadPosts(recorder.calls)).toBe(0);
    expect(findCall(recorder.calls, "POST", "/statuses?api-version=7.1")).toBeDefined();
  });
});