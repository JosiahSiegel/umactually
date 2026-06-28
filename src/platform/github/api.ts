import type { GithubContext } from "./context.js";

export type FetchImpl = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class GithubApiError extends Error {
  override readonly name = "GithubApiError";
  readonly code: "GITHUB_FETCH_FAILED" | "GITHUB_DIFF_EMPTY";
  readonly status: number;

  constructor(code: GithubApiError["code"], status: number, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
    this.status = status;
  }
}

const GITHUB_API_BASE_URL = "https://api.github.com";
const PULL_DIFF_MEDIA_TYPE = "application/vnd.github.v3.diff";

export async function fetchGithubPrDiff(context: GithubContext, fetchImpl: FetchImpl = fetch): Promise<string> {
  const url = buildPullUrl(context);
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${context.token}`,
      Accept: PULL_DIFF_MEDIA_TYPE,
      "User-Agent": "umactually-pr-review",
    },
  });

  if (!response.ok) {
    throw new GithubApiError(
      "GITHUB_FETCH_FAILED",
      response.status,
      `GitHub PR diff request failed with status ${response.status}.`,
    );
  }

  const diffText = await response.text();
  if (diffText.length === 0) {
    throw new GithubApiError("GITHUB_DIFF_EMPTY", response.status, "GitHub PR diff response body was empty.");
  }

  return diffText;
}

function buildPullUrl(context: GithubContext): string {
  const repositorySegment = `${context.repo.owner}/${context.repo.name}`;
  return `${GITHUB_API_BASE_URL}/repos/${repositorySegment}/pulls/${context.prNumber}`;
}