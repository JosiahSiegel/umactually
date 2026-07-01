import { describe, expect, it } from "vitest";

import { parseCliArgs } from "../../src/cli.js";
import { runLive } from "../../src/cli/orchestrator.js";
import {
  azureDiffRoutes,
  azureReviewDiffFixture,
  azureSecretDiffFixture,
} from "./azure-diff-fixture.js";
import type { AzureDiffFixture, AzureFetchRoute } from "./azure-diff-fixture.js";

type RecordedCall = {
  readonly url: string;
  readonly method: string;
  readonly authorization: string;
  readonly body: unknown;
};

type FetchRoute = AzureFetchRoute;

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

function azureRoutes(): readonly FetchRoute[] {
  return azureRoutesWithDiff(azureReviewDiffFixture());
}

function azureRoutesWithDiff(diffFixture: AzureDiffFixture): readonly FetchRoute[] {
  return [
    ...azureDiffRoutes(makeJsonResponse, diffFixture),
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

describe("runLive Azure orchestration", () => {
  it("blocks high-confidence leaks before submitting the Azure diff to the provider", async () => {
    // Given: the Azure PR diff contains a high-confidence API key pattern.
    const recorder = makeFetchRecorder(azureRoutesWithDiff(azureSecretDiffFixture()));

    // When: the live Azure path runs with leak detection enabled.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "azure", "--no-dry-run"]),
      cwd: process.cwd(),
      env: azureEnv(),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: the provider is never called with the secret-bearing diff.
    expect(result.exitCode).toBe(1);
    expect(result.posted).toBe(false);
    expect(result.message).toContain("high-confidence secret");
    expect(recorder.calls.some((call) => call.url === "https://provider.example/v1/responses")).toBe(false);
  });

  it("posts Azure DevOps threads and status through injected fetch", async () => {
    // Given: Azure Pipelines live environment and mocked REST endpoints.
    const recorder = makeFetchRecorder(azureRoutes());

    // When: the live Azure path runs.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "azure", "--no-dry-run"]),
      cwd: process.cwd(),
      env: azureEnv(),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: it creates one thread with the marker and one PR status without shelling out.
    expect(result).toMatchObject({ exitCode: 0, posted: true, reviewId: 77 });
    const threadCall = findCall(recorder.calls, "POST", "/threads?api-version=7.1");
    const threadBody = readRecord(threadCall.body as Record<string, unknown>, "thread request");
    const comments = readArray(threadBody["comments"], "thread comments");
    const firstComment = readRecord(comments[0] as Record<string, unknown>, "first thread comment");
    expect(firstComment["content"]).toContain("<!-- umactually-pr-review -->");
    expect(firstComment["content"]).toContain("Azure inline comment.");
    expect(threadBody["threadContext"]).toEqual({
      filePath: "/src/review/example.ts",
      rightFileStart: { line: 3, offset: 1 },
      rightFileEnd: { line: 3, offset: 1 },
    });

    const statusCall = findCall(recorder.calls, "POST", "/statuses?api-version=7.1");
    const statusBody = readRecord(statusCall.body as Record<string, unknown>, "status request");
    expect(statusBody["state"]).toBe("succeeded");
    expect(statusBody["description"]).toContain("Azure live summary.");
  });

  it("skips duplicate Azure threads when an existing marker thread matches the same location", async () => {
    // Given: Azure returns an existing marker thread for the same path and line.
    const duplicateRoutes: readonly FetchRoute[] = [
      ...azureRoutes().filter((route) => !route.match("https://dev.azure.com/example-org/Example%20Project/_apis/git/repositories/repo-42/pullRequests/42/threads?api-version=7.1", "GET")),
      {
        match: (url, method) => method === "GET" && url.endsWith("/threads?api-version=7.1"),
        response: makeJsonResponse({
          count: 1,
          value: [
            {
              status: "active",
              threadContext: {
                filePath: "/src/review/example.ts",
                rightFileStart: { line: 3, offset: 1 },
              },
              comments: [{ content: "<!-- umactually-pr-review -->\nExisting." }],
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

    // Then: it posts only the status and does not stack another thread.
    expect(result.exitCode).toBe(0);
    const threadPosts = recorder.calls.filter(
      (call) => call.method === "POST" && call.url.endsWith("/threads?api-version=7.1"),
    );
    expect(threadPosts).toHaveLength(0);
    expect(findCall(recorder.calls, "POST", "/statuses?api-version=7.1")).toBeDefined();
  });
});

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
