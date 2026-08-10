import type { FetchImpl } from "./http.js";

/**
 * Concurrency cap for `fetchPlatformInstructionFiles`. Four parallel
 * fetches is enough to hide platform `contents` / `items` API latency on
 * a typical repo without tripping the per-token rate-limit bucket. Used
 * by both `fetchGithubPrInstructions` and `fetchAzurePrInstructions` so
 * the two providers share a single documented fan-out budget.
 */
export const PLATFORM_INSTRUCTIONS_FETCH_CONCURRENCY = 4;

/**
 * Per-path fetcher contract used by {@link fetchPlatformInstructionFiles}.
 * Implementations return the decoded UTF-8 content for the requested
 * path, or `null` when the platform reports the path does not exist
 * (HTTP 404). Any other failure throws so the orchestrator surfaces
 * the error to its caller.
 */
export type FetchPlatformInstruction = (
  path: string,
  fetchImpl: FetchImpl,
) => Promise<string | null>;

/**
 * Throwing error constructor used by
 * {@link decodeInstructionResponseBody}. Each platform provides its own
 * typed error class (e.g. `GithubApiError`, `AzureApiError`) so the
 * helper stays platform-agnostic. Both inherit from `PlatformApiError`,
 * which is why this helper accepts the union directly.
 */
export type PlatformApiErrorCtor<TCode extends string> = new (
  code: TCode,
  status: number,
  message: string,
  options?: ErrorOptions,
) => Error;

/**
 * Decode a 2xx response body for a per-path platform instruction fetch.
 * The two adapters (GitHub `contents` API + Azure DevOps `items` API)
 * share the same shape after the per-path fetch resolves:
 *
 *   - 404 → `null` (silently dropped by the orchestrator)
 *   - other non-2xx → `throw` with the platform-specific error class
 *   - 2xx → parse JSON body, hand the parsed value to the caller via
 *     `parseJson`
 *
 * Extracted into a shared helper so the GitHub + Azure per-path
 * fetchers don't carry the same 6-line "if status / if ok / JSON.parse"
 * boilerplate twice. The caller still owns the platform-specific
 * payload decoder (base64 → utf8 for GitHub, `parseItemContent` for
 * Azure) — `parseJson` is the seam.
 */
export async function decodeInstructionResponseBody<TCode extends string>(
  response: Response,
  path: string,
  platformLabel: string,
  ctor: PlatformApiErrorCtor<TCode>,
  code: TCode,
  parseJson: (response: Response) => Promise<unknown>,
): Promise<unknown> {
  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new ctor(
      code,
      response.status,
      `${platformLabel} PR instructions fetch failed for '${path}' with status ${response.status}.`,
    );
  }

  return parseJson(response);
}

/**
 * Shared JSON-body parser used by {@link decodeInstructionResponseBody}
 * for platforms whose per-path fetch resolves to a JSON body (GitHub
 * `contents` and Azure DevOps `items` both qualify). Wraps the
 * `JSON.parse` + `SyntaxError → typed-error` translation that the two
 * adapters each had to write by hand.
 */
export async function parsePlatformJsonBody<TCode extends string>(
  response: Response,
  path: string,
  platformLabel: string,
  ctor: PlatformApiErrorCtor<TCode>,
  code: TCode,
): Promise<unknown> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ctor(
        code,
        response.status,
        `${platformLabel} PR instructions response for '${path}' was not valid JSON.`,
        { cause: error },
      );
    }
    throw error;
  }
  return payload;
}

/**
 * Shared orchestrator for "fetch a batch of instruction files from the
 * PR's base ref on a platform API" — used by the GitHub and Azure
 * platform adapters. Pulls every `path` through the supplied
 * `fetchOne` callback with a bounded worker pool (so the action never
 * stampedes a per-token rate-limit bucket), silently drops 404s
 * (mapped to `null` by the callback), and surfaces everything else
 * unchanged. The callback is responsible for the platform-specific URL
 * shape + body decoding; this helper is platform-agnostic.
 *
 * Worker-pool implementation: a small shared-cursor pool is enough
 * here. The fetch work is naturally I/O-bound so each await yields to
 * the event loop and the cursor increments atomically. A `p-limit`-style
 * helper would add a dependency for no behavior change.
 */
export async function fetchPlatformInstructionFiles(
  paths: readonly string[],
  fetchImpl: FetchImpl,
  fetchOne: FetchPlatformInstruction,
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  if (paths.length === 0) {
    return results;
  }

  const tasks = paths.map((path) => (): Promise<string | null> => fetchOne(path, fetchImpl));

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
  const poolSize = Math.min(PLATFORM_INSTRUCTIONS_FETCH_CONCURRENCY, tasks.length);
  for (let i = 0; i < poolSize; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}
