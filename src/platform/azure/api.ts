import type { AzureContext } from "./context.js";

export type FetchImpl = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class AzureApiError extends Error {
  override readonly name = "AzureApiError";
  readonly code: "AZURE_FETCH_FAILED" | "AZURE_DIFF_EMPTY";
  readonly status: number;

  constructor(code: AzureApiError["code"], status: number, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
    this.status = status;
  }
}

const AZURE_DEVOPS_BASE_URL = "https://dev.azure.com";
const AZURE_DIFFS_API_VERSION = "7.1";

export async function fetchAzurePrDiff(context: AzureContext, fetchImpl: FetchImpl = fetch): Promise<string> {
  const url = buildPullRequestDiffUrl(context);
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${context.token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "umactually-pr-review",
    },
    body: JSON.stringify({}), // no-diff-request = full diff per Azure DevOps defaults
  });

  if (!response.ok) {
    throw new AzureApiError(
      "AZURE_FETCH_FAILED",
      response.status,
      `Azure DevOps PR diff request failed with status ${response.status}.`,
    );
  }

  const diffText = await response.text();
  if (diffText.length === 0) {
    throw new AzureApiError("AZURE_DIFF_EMPTY", response.status, "Azure DevOps PR diff response body was empty.");
  }

  return diffText;
}

function buildPullRequestDiffUrl(context: AzureContext): string {
  const projectSegment = encodeURIComponent(context.project);
  return `${AZURE_DEVOPS_BASE_URL}/${context.org}/${projectSegment}/_apis/git/repositories/${context.repoId}/pullRequests/${context.prNumber}/diffs/commits?api-version=${AZURE_DIFFS_API_VERSION}`;
}