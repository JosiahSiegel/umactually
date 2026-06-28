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

  it("AZURE-PLATFORM-RED-002 fetches the PR diff with Azure URL and auth", async () => {
    // Given: a typed Azure PR context and a fake fetch implementation.
    const fetchAzurePrDiff = await loadFetchAzurePrDiff();
    const context: AzureContext = {
      token: "azure-token-123",
      org: "example-org",
      project: "Example Project",
      repoId: "00000000-0000-0000-0000-000000000042",
      prNumber: 42,
      sourceCommit: "1111111111111111111111111111111111111111",
      targetBranch: "refs/heads/main",
    };
    let observedUrl = "";
    let observedMethod = "";
    let observedAuthorization = "";
    const fetchImpl: typeof fetch = async (input, init) => {
      observedUrl = String(input);
      observedMethod = init?.method ?? "";
      const headers = new Headers(init?.headers);
      observedAuthorization = headers.get("authorization") ?? "";
      return new Response("diff --git a/src/file.ts b/src/file.ts\n", { status: 200 });
    };

    // When: the Azure API adapter requests the diff.
    const diffText = await fetchAzurePrDiff(context, fetchImpl);

    // Then: the adapter POSTs to the Azure pull request commits diff endpoint with bearer token.
    expect(observedUrl).toBe(
      "https://dev.azure.com/example-org/Example%20Project/_apis/git/repositories/00000000-0000-0000-0000-000000000042/pullRequests/42/diffs/commits?api-version=7.1",
    );
    expect(observedMethod).toBe("POST");
    expect(observedAuthorization).toBe("Bearer azure-token-123");
    expect(diffText).toBe("diff --git a/src/file.ts b/src/file.ts\n");
  });
});
