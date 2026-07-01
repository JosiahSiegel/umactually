import { describe, expect, it } from "vitest";

import { expectFutureModule } from "../helpers/assert-red-module.js";

type AzureContext = {
  readonly token: string;
  readonly org: string;
  readonly project: string;
  readonly repoId: string;
  readonly prNumber: number;
  readonly sourceCommit: string;
  readonly targetBranch: string;
};

type ReadAzureContext = (env: NodeJS.ProcessEnv) => AzureContext;
type FetchAzurePrDiff = (ctx: AzureContext, fetchImpl?: typeof fetch) => Promise<string>;

const azureContextModule = "../../src/platform/azure/context.js";
const azureApiModule = "../../src/platform/azure/api.js";
const azureContextPath = "src/platform/azure/context.ts";
const azureApiPath = "src/platform/azure/api.ts";

function isReadAzureContext(value: unknown): value is ReadAzureContext {
  return typeof value === "function";
}

function isFetchAzurePrDiff(value: unknown): value is FetchAzurePrDiff {
  return typeof value === "function";
}

async function loadReadAzureContext(): Promise<ReadAzureContext> {
  const moduleNamespace = await expectFutureModule(azureContextModule);
  const readAzureContext = moduleNamespace["readAzureContext"];
  if (!isReadAzureContext(readAzureContext)) {
    expect.fail(`RED: ${azureContextPath} must export readAzureContext(env)`);
  }
  return readAzureContext;
}

async function loadFetchAzurePrDiff(): Promise<FetchAzurePrDiff> {
  const moduleNamespace = await expectFutureModule(azureApiModule);
  const fetchAzurePrDiff = moduleNamespace["fetchAzurePrDiff"];
  if (!isFetchAzurePrDiff(fetchAzurePrDiff)) {
    expect.fail(`RED: ${azureApiPath} must export fetchAzurePrDiff(ctx, fetchImpl?)`);
  }
  return fetchAzurePrDiff;
}

describe("Azure DevOps platform unit contract", () => {
  it("AZURE-PLATFORM-RED-001 reads pull request context from Azure Pipelines env", async () => {
    // Given: Azure Pipelines pull request environment variables.
    const readAzureContext = await loadReadAzureContext();
    const env: NodeJS.ProcessEnv = {
      SYSTEM_ACCESSTOKEN: "azure-token-123",
      SYSTEM_COLLECTIONURI: "https://dev.azure.com/example-org/",
      SYSTEM_TEAMPROJECT: "Example Project",
      BUILD_REPOSITORY_ID: "00000000-0000-0000-0000-000000000042",
      SYSTEM_PULLREQUEST_PULLREQUESTID: "42",
      SYSTEM_PULLREQUEST_SOURCECOMMITID: "1111111111111111111111111111111111111111",
      SYSTEM_PULLREQUEST_TARGETBRANCHNAME: "refs/heads/main",
    };

    // When: the Azure adapter parses the process environment boundary.
    const context = readAzureContext(env);

    // Then: the typed context carries only the needed PR fields.
    expect(context).toEqual({
      token: "azure-token-123",
      org: "example-org",
      project: "Example Project",
      repoId: "00000000-0000-0000-0000-000000000042",
      prNumber: 42,
      sourceCommit: "1111111111111111111111111111111111111111",
      targetBranch: "refs/heads/main",
    });
  });

  it("AZURE-PLATFORM-RED-002 reconstructs the PR diff from Azure iteration changes and item JSON", async () => {
    // Given: a typed Azure PR context and a fetch recorder for the working REST sequence.
    const fetchAzurePrDiff = await loadFetchAzurePrDiff();
    const sourceCommitId = "2222222222222222222222222222222222222222";
    const oldObjectId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const newObjectId = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const context: AzureContext = {
      token: "azure-token-123",
      org: "example-org",
      project: "Example Project",
      repoId: "00000000-0000-0000-0000-000000000042",
      prNumber: 42,
      sourceCommit: "1111111111111111111111111111111111111111",
      targetBranch: "refs/heads/main",
    };
    type ObservedAzureFetch = {
      readonly url: string;
      readonly method: string;
      readonly authorization: string;
      readonly accept: string;
    };
    const observedRequests: ObservedAzureFetch[] = [];
    const jsonResponse = (payload: unknown): Response =>
      new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
    const fetchImpl: typeof fetch = async (input, init) => {
      const requestUrl = new URL(String(input));
      const headers = new Headers(init?.headers);
      observedRequests.push({
        url: requestUrl.toString(),
        method: init?.method ?? "GET",
        authorization: headers.get("authorization") ?? "",
        accept: headers.get("accept") ?? "",
      });

      if (requestUrl.pathname.endsWith("/pullRequests/42/iterations")) {
        return jsonResponse({ value: [{ id: 1 }, { id: 2 }] });
      }
      if (requestUrl.pathname.endsWith("/pullRequests/42/iterations/2")) {
        return jsonResponse({ sourceRefCommit: { commitId: sourceCommitId } });
      }
      if (requestUrl.pathname.endsWith("/pullRequests/42/iterations/2/changes")) {
        return jsonResponse({
          changes: [
            {
              item: {
                objectId: newObjectId,
                path: "/src/file.ts",
                url: "https://dev.azure.com/example-org/Example%20Project/_apis/git/repositories/00000000-0000-0000-0000-000000000042/items?path=/src/file.ts",
              },
              originalObjectId: oldObjectId,
            },
          ],
        });
      }
      if (requestUrl.pathname.endsWith("/items") && requestUrl.searchParams.get("versionType") === "Branch") {
        expect(requestUrl.searchParams.get("version")).toBe("refs/heads/main");
        expect(requestUrl.searchParams.get("path")).toBe("/src/file.ts");
        return jsonResponse({ content: "old line\nshared line\n" });
      }
      if (requestUrl.pathname.endsWith("/items") && requestUrl.searchParams.get("versionType") === "Commit") {
        expect(requestUrl.searchParams.get("version")).toBe(sourceCommitId);
        expect(requestUrl.searchParams.get("path")).toBe("/src/file.ts");
        return jsonResponse({ content: "new line\nshared line\n" });
      }
      return new Response(JSON.stringify({ message: `unexpected URL ${requestUrl.toString()}` }), { status: 404 });
    };

    // When: the Azure API adapter reconstructs the diff from iteration metadata and item contents.
    const diffText = await fetchAzurePrDiff(context, fetchImpl);

    // Then: the adapter uses GET JSON endpoints with bearer auth and returns unified-diff text.
    expect(observedRequests.map((request) => request.method)).toEqual(["GET", "GET", "GET", "GET", "GET"]);
    expect(observedRequests.map((request) => request.authorization)).toEqual([
      "Bearer azure-token-123",
      "Bearer azure-token-123",
      "Bearer azure-token-123",
      "Bearer azure-token-123",
      "Bearer azure-token-123",
    ]);
    expect(observedRequests.map((request) => request.accept)).toEqual([
      "application/json",
      "application/json",
      "application/json",
      "application/json",
      "application/json",
    ]);
    expect(observedRequests[0]?.url).toBe(
      "https://dev.azure.com/example-org/Example%20Project/_apis/git/repositories/00000000-0000-0000-0000-000000000042/pullRequests/42/iterations?api-version=7.1",
    );
    expect(diffText).toContain("diff --git a/src/file.ts b/src/file.ts");
    expect(diffText).toContain("--- a/src/file.ts");
    expect(diffText).toContain("+++ b/src/file.ts");
    expect(diffText).toContain("@@ -1,2 +1,2 @@");
    expect(diffText).toContain("-old line");
    expect(diffText).toContain("+new line");
  });

  it("AZURE-PLATFORM-RED-004 prefers an explicit AZURE_DEVOPS_TOKEN over SYSTEM_ACCESSTOKEN", async () => {
    // Given: an explicit Azure DevOps PAT is provided alongside the
    // system OAuth token. The PAT is required when the project build
    // service identity is missing the "Contribute to pull requests"
    // permission, which causes HTTP 403 on the threads/statuses
    // endpoints.
    const readAzureContext = await loadReadAzureContext();
    const env: NodeJS.ProcessEnv = {
      SYSTEM_ACCESSTOKEN: "azure-system-token",
      AZURE_DEVOPS_TOKEN: "azure-pat-token",
      SYSTEM_COLLECTIONURI: "https://dev.azure.com/example-org/",
      SYSTEM_TEAMPROJECT: "Example Project",
      BUILD_REPOSITORY_ID: "00000000-0000-0000-0000-000000000042",
      SYSTEM_PULLREQUEST_PULLREQUESTID: "42",
      SYSTEM_PULLREQUEST_SOURCECOMMITID: "1111111111111111111111111111111111111111",
      SYSTEM_PULLREQUEST_TARGETBRANCHNAME: "refs/heads/main",
    };

    // When: the Azure adapter parses the process environment boundary.
    const context = readAzureContext(env);

    // Then: the typed context carries the explicit PAT, not the system token.
    expect(context.token).toBe("azure-pat-token");
  });

  it("AZURE-PLATFORM-RED-005 falls back to SYSTEM_ACCESSTOKEN when AZURE_DEVOPS_TOKEN is empty", async () => {
    // Given: AZURE_DEVOPS_TOKEN is explicitly empty; the system OAuth
    // token must still be honored so manual/dry-run callers keep working.
    const readAzureContext = await loadReadAzureContext();
    const env: NodeJS.ProcessEnv = {
      SYSTEM_ACCESSTOKEN: "azure-system-token",
      AZURE_DEVOPS_TOKEN: "",
      SYSTEM_COLLECTIONURI: "https://dev.azure.com/example-org/",
      SYSTEM_TEAMPROJECT: "Example Project",
      BUILD_REPOSITORY_ID: "00000000-0000-0000-0000-000000000042",
      SYSTEM_PULLREQUEST_PULLREQUESTID: "42",
      SYSTEM_PULLREQUEST_SOURCECOMMITID: "1111111111111111111111111111111111111111",
      SYSTEM_PULLREQUEST_TARGETBRANCHNAME: "refs/heads/main",
    };

    // When: the Azure adapter parses the process environment boundary.
    const context = readAzureContext(env);

    // Then: the typed context falls back to the system token.
    expect(context.token).toBe("azure-system-token");
  });

  it("AZURE-PLATFORM-RED-003 skips deleted-file changes that have null item.path", async () => {
    // Given: an Azure changes response containing a deleted file with item.path=null
    // (real ADO API behavior for deleted files — item.path is null, originalPath has the path).
    const fetchAzurePrDiff = await loadFetchAzurePrDiff();
    const sourceCommitId = "3333333333333333333333333333333333333333";
    const oldObjectId = "cccccccccccccccccccccccccccccccccccccccc";
    const newObjectId = "dddddddddddddddddddddddddddddddddddddddd";
    const context: AzureContext = {
      token: "azure-token-123",
      org: "example-org",
      project: "Example Project",
      repoId: "00000000-0000-0000-0000-000000000042",
      prNumber: 42,
      sourceCommit: "1111111111111111111111111111111111111111",
      targetBranch: "refs/heads/main",
    };
    const jsonResponse = (payload: unknown): Response =>
      new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } });
    const fetchImpl: typeof fetch = async (input) => {
      const requestUrl = new URL(String(input));
      if (requestUrl.pathname.endsWith("/pullRequests/42/iterations")) {
        return jsonResponse({ value: [{ id: 1 }] });
      }
      if (requestUrl.pathname.endsWith("/pullRequests/42/iterations/1")) {
        return jsonResponse({ sourceRefCommit: { commitId: sourceCommitId } });
      }
      if (requestUrl.pathname.endsWith("/pullRequests/42/iterations/1/changes")) {
        return jsonResponse({
          changes: [
            // Normal modified file — should be included in the diff
            {
              item: {
                objectId: newObjectId,
                path: "/src/modified.ts",
                url: "https://dev.azure.com/example-org/Example%20Project/_apis/git/repositories/00000000-0000-0000-0000-000000000042/items?path=/src/modified.ts",
              },
              originalObjectId: oldObjectId,
            },
            // Deleted file — ADO returns item.path=null, should be skipped
            {
              changeTrackingId: 6,
              originalPath: "/dist/old-deleted.js",
              changeId: 6,
              item: {
                originalObjectId: oldObjectId,
                path: null,
              },
              changeType: "delete",
            },
          ],
        });
      }
      if (requestUrl.pathname.endsWith("/items") && requestUrl.searchParams.get("versionType") === "Branch") {
        return jsonResponse({ content: "old line\nshared line\n" });
      }
      if (requestUrl.pathname.endsWith("/items") && requestUrl.searchParams.get("versionType") === "Commit") {
        return jsonResponse({ content: "new line\nshared line\n" });
      }
      return new Response(JSON.stringify({ message: `unexpected URL ${requestUrl.toString()}` }), { status: 404 });
    };

    // When: the Azure API adapter reconstructs the diff.
    const diffText = await fetchAzurePrDiff(context, fetchImpl);

    // Then: the adapter skips the deleted file (null path) and only returns the modified file diff.
    expect(diffText).toContain("diff --git a/src/modified.ts b/src/modified.ts");
    expect(diffText).not.toContain("old-deleted.js");
  });
});
