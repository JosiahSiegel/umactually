import type { GithubContext } from "./context.js";
import { PlatformApiError } from "../../util/platform-error.js";
import type { FetchImpl } from "../../util/http.js";
import { fetchTextOrThrow, githubHeaders } from "../../util/http.js";

/**
 * API-layer error for the GitHub platform adapter. Inherits the
 * `PlatformApiError` shape from `src/util/platform-error.ts` so it shares
 * a common ancestor with `AzureApiError` and is catchable as
 * `PlatformApiError<...>` when callers don't care about the platform.
 */
export class GithubApiError extends PlatformApiError<"GITHUB_FETCH_FAILED" | "GITHUB_DIFF_EMPTY"> {
  override readonly name = "GithubApiError";

  constructor(
    code: "GITHUB_FETCH_FAILED" | "GITHUB_DIFF_EMPTY",
    status: number,
    message: string,
    options?: ErrorOptions,
  ) {
    super(code, status, message, options);
  }
}

const GITHUB_API_BASE_URL = "https://api.github.com";
const PULL_DIFF_MEDIA_TYPE = "application/vnd.github.v3.diff";

export async function fetchGithubPrDiff(context: GithubContext, fetchImpl: FetchImpl = fetch): Promise<string> {
  return fetchTextOrThrow(
    fetchImpl,
    {
      url: buildPullUrl(context),
      headers: {
        ...githubHeaders(context.token),
        Accept: PULL_DIFF_MEDIA_TYPE,
      },
    },
    {
      error: GithubApiError,
      failCode: "GITHUB_FETCH_FAILED",
      emptyCode: "GITHUB_DIFF_EMPTY",
      platform: "GitHub PR diff",
    },
  );
}

function buildPullUrl(context: GithubContext): string {
  const repositorySegment = `${context.repo.owner}/${context.repo.name}`;
  return `${GITHUB_API_BASE_URL}/repos/${repositorySegment}/pulls/${context.prNumber}`;
}