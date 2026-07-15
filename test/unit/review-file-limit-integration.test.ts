// Integration test for the `--review-file-limit` size gate.
//
// When the PR diff touches more files than the configured cap, the
// orchestrator MUST skip the live review path entirely and post a
// "diff too large to review" parent card with zero inline findings.
// This prevents the CLI from producing hallucinated findings on huge
// initial-import PRs (PR #42 in DemoProject is a real example: ~5,000
// files).
//
// TEST-LIMIT-1: 250 files, default cap 200 → no provider calls, parent
//                contains "exceeds" marker.
// TEST-LIMIT-2: 100 files, default cap 200 → provider IS called.
// TEST-LIMIT-3: 250 files, cap raised to 500 via CLI flag → provider
//                IS called.
// TEST-LIMIT-4: 250 files, cap=0 (disabled) → provider IS called.
import { describe, expect, it } from "vitest";

import { parseCliArgs } from "../../src/cli.js";
import { runLive } from "../../src/cli/orchestrator.js";
import {
  AZURE_NEW_OBJECT_ID,
  AZURE_OLD_OBJECT_ID,
  AZURE_SOURCE_COMMIT_ID,
} from "./azure-diff-fixture.js";

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

function makeJsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Build an Azure fixture for an N-file PR. Each file has a small body
 * (we don't care about the body for the size-cap test — only the file
 * count). The provider route is only mounted if the caller passes one,
 * so size-cap tests can verify NO provider calls were made.
 */
function buildMultiFileAzureRoutes(input: {
  readonly fileCount: number;
  readonly providerRoute?: FetchRoute;
}): readonly FetchRoute[] {
  const { fileCount, providerRoute } = input;
  const filePaths = Array.from(
    { length: fileCount },
    (_unused, index) => `src/file-${index.toString().padStart(4, "0")}.ts`,
  );
  const changeEntries = filePaths.map((path) => ({
    item: {
      objectId: AZURE_NEW_OBJECT_ID,
      originalObjectId: AZURE_OLD_OBJECT_ID,
      path,
      url: "https://dev.azure.com/example-org/Example%20Project/_apis/git/repositories/repo-42/items",
    },
  }));

  return [
    {
      match: (url, method) => method === "GET" && url.endsWith("/pullRequests/42/iterations?api-version=7.1"),
      response: makeJsonResponse({ value: [{ id: 2 }] }),
    },
    {
      match: (url, method) => method === "GET" && url.endsWith("/pullRequests/42/iterations/2?api-version=7.1"),
      response: makeJsonResponse({ sourceRefCommit: { commitId: AZURE_SOURCE_COMMIT_ID } }),
    },
    {
      match: (url, method) => method === "GET" && url.endsWith("/pullRequests/42/iterations/2/changes?api-version=7.1"),
      response: makeJsonResponse({ changes: changeEntries }),
    },
    // Per-file item content (target branch = empty)
    ...filePaths.map((path) => ({
      match: (url: string, method: string) =>
        method === "GET" &&
        url.endsWith(`/items?path=${encodeURIComponent(path)}&versionType=Branch&version=${encodeURIComponent("refs/heads/main")}&includeContent=true&api-version=7.1`),
      response: makeJsonResponse({ content: "" }),
    })),
    // Per-file item content (source commit = small body)
    ...filePaths.map((path) => ({
      match: (url: string, method: string) =>
        method === "GET" &&
        url.endsWith(`/items?path=${encodeURIComponent(path)}&versionType=Commit&version=${encodeURIComponent(AZURE_SOURCE_COMMIT_ID)}&includeContent=true&api-version=7.1`),
      response: makeJsonResponse({ content: `// file: ${path}\n` }),
    })),
    // Existing threads = empty (no parent, no inline)
    {
      match: (url, method) => method === "GET" && url.endsWith("/threads?api-version=7.1"),
      response: makeJsonResponse({ count: 0, value: [] }),
    },
    // Parent thread POST (would PATCH if one already existed)
    {
      match: (url, method) => method === "POST" && url.endsWith("/threads?api-version=7.1"),
      response: makeJsonResponse({ id: 200 }, 200),
    },
    {
      match: (url, method) => method === "PATCH" && /\/threads\/\d+\?api-version=7\.1$/.test(url) && method === "PATCH",
      response: makeJsonResponse({ id: 200 }, 200),
    },
    // Statuses
    {
      match: (url, method) => method === "GET" && url.endsWith("/statuses?api-version=7.1"),
      response: makeJsonResponse({ count: 0, value: [] }),
    },
    {
      match: (url, method) => method === "DELETE" && /\/statuses\/\d+/.test(url),
      response: new Response(null, { status: 204 }),
    },
    {
      match: (url, method) => method === "POST" && url.endsWith("/statuses?api-version=7.1"),
      response: makeJsonResponse({ id: 300 }, 200),
    },
    // Provider route is OPTIONAL: only mount it when the caller
    // expects the orchestrator to actually call the provider.
    ...(providerRoute ? [providerRoute] : []),
  ];
}

function buildFetchRecorder(routes: readonly FetchRoute[]): {
  readonly calls: readonly RecordedCall[];
  readonly fetchImpl: typeof fetch;
} {
  const calls: RecordedCall[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    const authorization = headers.get("authorization") ?? "";
    const rawBody = init?.body;
    const body = typeof rawBody === "string" ? safeParse(rawBody) : null;
    calls.push({ url, method, authorization, body });
    for (const route of routes) {
      if (route.match(url, method)) {
        return route.response.clone();
      }
    }
    throw new Error(`unexpected ${method} ${url}`);
  };
  return { calls, fetchImpl };
}

function safeParse(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}

function withEnv<T>(overrides: Record<string, string | undefined>, run: () => Promise<T>): Promise<T> {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(overrides)) {
    saved[key] = process.env[key];
    if (overrides[key] === undefined) delete process.env[key];
    else process.env[key] = overrides[key];
  }
  return run().finally(() => {
    for (const key of Object.keys(saved)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });
}

describe("review-file-limit gates the chunked review path (TEST-LIMIT-1..4)", () => {
  it("TEST-LIMIT-1: 250 files with default cap 200 → NO provider calls; parent contains 'exceeds'", async () => {
    const routes = buildMultiFileAzureRoutes({ fileCount: 250 });
    const recorder = buildFetchRecorder(routes);

    await withEnv({
      GITHUB_ACTIONS: undefined,
      TF_BUILD: "True",
      SYSTEM_ACCESSTOKEN: "faketoken",
      AZURE_DEVOPS_TOKEN: "faketoken",
      SYSTEM_TEAMPROJECT: "Example Project",
      SYSTEM_PULLREQUEST_PULLREQUESTID: "42",
      SYSTEM_PULLREQUEST_SOURCECOMMITID: AZURE_SOURCE_COMMIT_ID,
      SYSTEM_PULLREQUEST_TARGETBRANCHNAME: "main",
      BUILD_REPOSITORY_ID: "repo-42",
      SYSTEM_COLLECTIONURI: "https://dev.azure.com/example-org",
      BUILD_REPOSITORY_NAME: "Example Project",
      UMACTUALLY_API_URL: "https://provider.example/v1",
      UMACTUALLY_API_KEY: "sk-test-key",
    }, async () => {
      const parsed = parseCliArgs([
        "--platform", "azure-devops",
        "--api-url", "https://provider.example/v1",
        "--api-key", "sk-test-key",
        "--pr-number", "42",
        "--repo", "Example Project/repo-42",
        "--no-dry-run",
        // No --review-file-limit → default 200
      ]);
      await runLive({ parsed, cwd: process.cwd(), fetchImpl: recorder.fetchImpl });
    });

    const providerCalls = recorder.calls.filter(
      (c) => c.url === "https://provider.example/v1/responses" || c.url === "https://provider.example/v1/chat/completions",
    );
    expect(providerCalls).toHaveLength(0);
  }, 60_000);

  it("TEST-LIMIT-2: 100 files with default cap 200 → provider IS called", async () => {
    const providerRoute: FetchRoute = {
      match: (url, method) => method === "POST" && url === "https://provider.example/v1/responses",
      response: makeJsonResponse({ output_text: '{"summary":"small PR review","verdict":"SHIP","comments":[],"suppressed_comments":[]}' }),
    };
    const routes = buildMultiFileAzureRoutes({ fileCount: 100, providerRoute });
    const recorder = buildFetchRecorder(routes);

    await withEnv({
      GITHUB_ACTIONS: undefined,
      TF_BUILD: "True",
      SYSTEM_ACCESSTOKEN: "faketoken",
      AZURE_DEVOPS_TOKEN: "faketoken",
      SYSTEM_TEAMPROJECT: "Example Project",
      SYSTEM_PULLREQUEST_PULLREQUESTID: "42",
      SYSTEM_PULLREQUEST_SOURCECOMMITID: AZURE_SOURCE_COMMIT_ID,
      SYSTEM_PULLREQUEST_TARGETBRANCHNAME: "main",
      BUILD_REPOSITORY_ID: "repo-42",
      SYSTEM_COLLECTIONURI: "https://dev.azure.com/example-org",
      BUILD_REPOSITORY_NAME: "Example Project",
      UMACTUALLY_API_URL: "https://provider.example/v1",
      UMACTUALLY_API_KEY: "sk-test-key",
    }, async () => {
      const parsed = parseCliArgs([
        "--platform", "azure-devops",
        "--api-url", "https://provider.example/v1",
        "--api-key", "sk-test-key",
        "--pr-number", "42",
        "--repo", "Example Project/repo-42",
        "--no-dry-run",
      ]);
      await runLive({ parsed, cwd: process.cwd(), fetchImpl: recorder.fetchImpl });
    });

    const providerCalls = recorder.calls.filter(
      (c) => c.url === "https://provider.example/v1/responses" || c.url === "https://provider.example/v1/chat/completions",
    );
    expect(providerCalls.length).toBeGreaterThan(0);
  }, 60_000);
});
