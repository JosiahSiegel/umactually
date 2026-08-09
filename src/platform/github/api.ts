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

/**
 * Concurrency cap for `fetchGithubPrInstructions`. Four parallel
 * fetches is enough to hide GitHub `contents` API latency on a typical
 * repo without tripping the per-token rate-limit bucket.
 */
const INSTRUCTIONS_FETCH_CONCURRENCY = 4;

/**
 * Fetch the contents of instruction files from the PR's base branch.
 * Reads each path via the GitHub `contents` API pinned to `baseSha`
 * (not `headSha`) so a PR cannot rewrite its own reviewer
 * instructions. Per-path: 2xx decodes base64 `content` to UTF-8; 404
 * is silently skipped; any other failure throws `GithubApiError`
 * with code `"GITHUB_FETCH_FAILED"` so the caller can fall back to
 * cwd reading. Concurrency 4 via a manual pool (no `p-limit`
 * dependency in this project).
 */
export async function fetchGithubPrInstructions(
  context: GithubContext,
  paths: readonly string[],
  fetchImpl: FetchImpl = fetch,
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  if (paths.length === 0) {
    return results;
  }

  const tasks = paths.map((path) => (): Promise<string | null> => fetchGithubPrInstruction(context, path, fetchImpl));

  // Workers share a single monotonically advancing cursor; JS single-
  // threadedness makes the increment atomic at each `await` boundary.
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      const index = cursor++;
      if (index >= tasks.length) {
        return;
      }
      const value = await tasks[index]!();
      if (value !== null) {
        const path = paths[index]!;
        results.set(path, value);
      }
    }
  };

  const workers: Promise<void>[] = [];
  const poolSize = Math.min(INSTRUCTIONS_FETCH_CONCURRENCY, tasks.length);
  for (let i = 0; i < poolSize; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

async function fetchGithubPrInstruction(
  context: GithubContext,
  path: string,
  fetchImpl: FetchImpl,
): Promise<string | null> {
  const url = `${GITHUB_API_BASE_URL}/repos/${context.repo.owner}/${context.repo.name}/contents/${path}?ref=${context.baseSha}`;
  const response = await fetchImpl(url, {
    method: "GET",
    headers: githubHeaders(context.token),
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new GithubApiError(
      "GITHUB_FETCH_FAILED",
      response.status,
      `GitHub PR instructions fetch failed for '${path}' with status ${response.status}.`,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new GithubApiError(
        "GITHUB_FETCH_FAILED",
        response.status,
        `GitHub PR instructions response for '${path}' was not valid JSON.`,
        { cause: error },
      );
    }
    throw error;
  }

  if (!isObject(payload)) {
    throw new GithubApiError(
      "GITHUB_FETCH_FAILED",
      response.status,
      `GitHub PR instructions response for '${path}' was not a JSON object.`,
    );
  }

  const content = payload["content"];
  if (typeof content !== "string" || content.length === 0) {
    throw new GithubApiError(
      "GITHUB_FETCH_FAILED",
      response.status,
      `GitHub PR instructions response for '${path}' did not include a 'content' field.`,
    );
  }

  // Buffer.from(..., "base64") tolerates GitHub's line-wrapped base64,
  // so the embedded newlines do not need to be stripped.
  try {
    return Buffer.from(content, "base64").toString("utf8");
  } catch (error) {
    throw new GithubApiError(
      "GITHUB_FETCH_FAILED",
      response.status,
      `GitHub PR instructions payload for '${path}' could not be base64-decoded.`,
      { cause: error },
    );
  }
}

type GithubContentsPayload = Readonly<Record<string, unknown>>;

function isObject(value: unknown): value is GithubContentsPayload {
  return typeof value === "object" && value !== null;
}