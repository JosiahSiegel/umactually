export type AzureFetchRoute = {
  readonly match: (url: string, method: string) => boolean;
  readonly response: Response;
};

export type AzureDiffFixture = {
  readonly path: string;
  readonly oldContent: string;
  readonly newContent: string;
};

export type JsonResponseFactory = (value: unknown, status?: number) => Response;

export const AZURE_SOURCE_COMMIT_ID = "2222222222222222222222222222222222222222";
export const AZURE_OLD_OBJECT_ID = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
export const AZURE_NEW_OBJECT_ID = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
export const AZURE_REVIEW_FILE_PATH = "/src/review/example.ts";
export const AZURE_REVIEW_OLD_CONTENT = "export function renderReview(): string {\n  return \"old\";\n}\n";
export const AZURE_REVIEW_NEW_CONTENT = "export function renderReview(): string {\n  return \"new\";\n}\n";
export const AZURE_ROLLBACK_OLD_CONTENT = "export function renderReview(): string {\n  return \"old\";\n  return \"stale\";\n}\n";
export const AZURE_ROLLBACK_NEW_CONTENT = "export function renderReview(): string {\n  return \"new\";\n  return \"extra\";\n  return \"third\";\n}\n";
export const AZURE_SECRET_FILE_PATH = "/src/secret.ts";
export const AZURE_SECRET_OLD_CONTENT = "export const safe = true;\n";
export const AZURE_SECRET_NEW_CONTENT = "export const safe = true;\nexport const token = \"sk_test_azure_secret\";\n";

export function azureReviewDiffFixture(): AzureDiffFixture {
  return {
    path: AZURE_REVIEW_FILE_PATH,
    oldContent: AZURE_REVIEW_OLD_CONTENT,
    newContent: AZURE_REVIEW_NEW_CONTENT,
  };
}

export function azureRollbackDiffFixture(): AzureDiffFixture {
  return {
    path: AZURE_REVIEW_FILE_PATH,
    oldContent: AZURE_ROLLBACK_OLD_CONTENT,
    newContent: AZURE_ROLLBACK_NEW_CONTENT,
  };
}

export function azureSecretDiffFixture(): AzureDiffFixture {
  return {
    path: AZURE_SECRET_FILE_PATH,
    oldContent: AZURE_SECRET_OLD_CONTENT,
    newContent: AZURE_SECRET_NEW_CONTENT,
  };
}

export function azureDiffRoutes(makeJsonResponse: JsonResponseFactory, diffFixture: AzureDiffFixture): readonly AzureFetchRoute[] {
  return [
    {
      match: (url, method) => method === "GET" && url.endsWith("/pullRequests/42/iterations?api-version=7.1"),
      response: makeJsonResponse({ value: [{ id: 1 }, { id: 2 }] }),
    },
    {
      match: (url, method) => method === "GET" && url.endsWith("/pullRequests/42/iterations/2?api-version=7.1"),
      response: makeJsonResponse({ sourceRefCommit: { commitId: AZURE_SOURCE_COMMIT_ID } }),
    },
    {
      match: (url, method) => method === "GET" && url.endsWith("/pullRequests/42/iterations/2/changes?api-version=7.1"),
      response: makeJsonResponse({
        changes: [
          {
            item: {
              objectId: AZURE_NEW_OBJECT_ID,
              path: diffFixture.path,
              url: "https://dev.azure.com/example-org/Example%20Project/_apis/git/repositories/repo-42/items",
            },
            originalObjectId: AZURE_OLD_OBJECT_ID,
          },
        ],
      }),
    },
    {
      match: (url, method) =>
        method === "GET" && url.endsWith(buildItemSuffix(diffFixture.path, "Branch", "refs/heads/main")),
      response: makeJsonResponse({ content: diffFixture.oldContent }),
    },
    {
      match: (url, method) =>
        method === "GET" && url.endsWith(buildItemSuffix(diffFixture.path, "Commit", AZURE_SOURCE_COMMIT_ID)),
      response: makeJsonResponse({ content: diffFixture.newContent }),
    },
  ];
}

function buildItemSuffix(path: string, versionType: "Branch" | "Commit", version: string): string {
  return `/items?path=${encodeURIComponent(path)}&versionType=${versionType}&version=${encodeURIComponent(version)}&includeContent=true&api-version=7.1`;
}
