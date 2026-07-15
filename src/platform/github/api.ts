import type { GithubContext } from "./context.js";
import { PlatformApiError } from "../../util/platform-error.js";
import type { FetchImpl } from "../../util/http.js";
import { fetchTextOrThrow, githubHeaders } from "../../util/http.js";
import { filterBuildArtifacts } from "../../diff/filter-build-artifacts.js";
import { DEFAULT_GITHUB_API_BASE } from "../../util/provider-defaults.js";

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

const GITHUB_API_BASE_URL = process.env["GITHUB_API_URL"]?.replace(/\/$/u, "") || DEFAULT_GITHUB_API_BASE;
const PULL_DIFF_MEDIA_TYPE = "application/vnd.github.v3.diff";

export async function fetchGithubPrDiff(context: GithubContext, fetchImpl: FetchImpl = fetch): Promise<string> {
  // GitHub's REST `/pulls/{n}` endpoint returns the server-side diff
  // verbatim from git, which means PRs that touch `dist/`, `node_modules/`,
  // lockfiles, etc. surface those blocks to the reviewer. Strip them
  // before they reach the LLM — see `src/diff/filter-build-artifacts.ts`
  // for the full rationale.
  const raw = await fetchTextOrThrow(
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
  const filtered = filterBuildArtifacts(raw);
  // `fetchTextOrThrow` already throws on the API's empty response,
  // but `filterBuildArtifacts` can ALSO produce an empty string when
  // every block was filtered as a build artifact. Throw the same
  // GITHUB_DIFF_EMPTY so the upstream `dispatchLivePlatform` path
  // surfaces a parse-fail card (mirrors the Azure AZURE_DIFF_EMPTY
  // behavior). Without this, the live review would attempt to
  // ask the model to review an empty diff and post 0 findings.
  if (filtered.length === 0) {
    throw new GithubApiError(
      "GITHUB_DIFF_EMPTY",
      200,
      "GitHub PR diff was empty after build-artifact filtering (every changed file was excluded).",
    );
  }
  return filtered;
}

function buildPullUrl(context: GithubContext): string {
  const repositorySegment = `${context.repo.owner}/${context.repo.name}`;
  return `${GITHUB_API_BASE_URL}/repos/${repositorySegment}/pulls/${context.prNumber}`;
}