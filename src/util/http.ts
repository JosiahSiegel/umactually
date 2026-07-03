import { USER_AGENT } from "./brand.js";

/** Bearer + JSON Accept + UA; eliminates duplicated auth header construction across platform and provider clients. */
export function authHeaders(
  token: string,
  opts?: {
    readonly mediaType?: string;
    readonly extra?: Readonly<Record<string, string>>;
    /** When true, includes `Content-Type: application/json`. Default true for write methods. */
    readonly contentType?: boolean;
  },
): Record<string, string> {
  const mediaType = opts?.mediaType ?? "application/json";
  const includeContentType = opts?.contentType ?? true;
  return {
    Authorization: `Bearer ${token}`,
    Accept: mediaType,
    "User-Agent": USER_AGENT,
    ...(includeContentType ? { "Content-Type": "application/json" } : {}),
    ...opts?.extra,
  };
}

/**
 * GitHub PR review header set; eliminates repeated vnd.github+json and
 * API-version literals. The pinned `X-GitHub-Api-Version` value is the
 * single source of truth — the live CLI imports from here rather than
 * redefining it (previously these drifted between
 * `live-github.ts:223` and `http.ts:21`).
 */
export function githubHeaders(token: string): Record<string, string> {
  return authHeaders(token, {
    mediaType: "application/vnd.github+json",
    extra: { "X-GitHub-Api-Version": "2026-03-10" },
  });
}

/** Azure DevOps header set; keeps bearer and UA headers aligned without adding the query-param api-version. */
export function azureHeaders(token: string): Record<string, string> {
  return authHeaders(token);
}

/** Truncate response bodies consistently so duplicated diagnostic logging cannot drift in length or suffix. */
export function truncateBodyForLog(text: string, maxLen = 500): string {
  return text.length > maxLen ? `${text.slice(0, maxLen)}…(truncated)` : text;
}

/**
 * Generic text-fetch helper used by `fetchGithubPrDiff` and other
 * platform clients. Returns the response body text on 2xx; throws on
 * non-2xx or empty body. The caller passes a typed error class so the
 * platform-specific code/status contract is preserved at the call site.
 *
 * Generic over `TCode extends string` so the `error` constructor's
 * `code` parameter is narrowed to the platform-specific literal
 * union (e.g. `"GITHUB_FETCH_FAILED" | "GITHUB_DIFF_EMPTY"`), not
 * widened to plain `string`. Without the generic, the typed
 * `PlatformApiError<TCode>` code union collapses at the call site.
 */
export async function fetchTextOrThrow<TCode extends string>(
  fetchImpl: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
  input: { readonly url: string; readonly headers: Readonly<Record<string, string>> },
  fail: { readonly error: new (code: TCode, status: number, message: string) => Error; readonly failCode: TCode; readonly emptyCode: TCode; readonly platform: string },
): Promise<string> {
  const response = await fetchImpl(input.url, { method: "GET", headers: input.headers });
  if (!response.ok) {
    throw new fail.error(fail.failCode, response.status, `${fail.platform} request failed with status ${response.status}.`);
  }
  const text = await response.text();
  if (text.length === 0) {
    throw new fail.error(fail.emptyCode, response.status, `${fail.platform} response body was empty.`);
  }
  return text;
}

/**
 * Generic JSON-fetch helper for POST/PUT/PATCH/DELETE calls. Returns the
 * response body parsed as `unknown` on 2xx; throws on non-2xx (with the
 * platform-specific error code/status/message) so callers don't need to
 * write the `await fetchImpl(...) + ensureHttpOk(...) + readJsonResponse(...)`
 * recipe by hand.
 *
 * Generic over `TCode extends string` so the `error` constructor's
 * `code` parameter stays narrowed to the platform's literal union
 * (e.g. `"AZURE_CREATE_THREAD_FAILED"`). The `error` constructor is
 * required to accept `(code: TCode, status: number, message: string)`;
 * the live code uses `LiveReviewError` (which is `(code, message)` — see
 * `live-shared.ts:71`) so this helper throws a plain `LiveReviewError`
 * with a status-bearing message when needed. See `fetchJsonForLive` in
 * `live-shared.ts` for the live-path-specific variant.
 */
export async function fetchJsonOrThrow<TCode extends string>(
  fetchImpl: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
  input: {
    readonly url: string;
    readonly method: "POST" | "PUT" | "PATCH" | "DELETE";
    readonly headers: Readonly<Record<string, string>>;
    readonly body?: Readonly<Record<string, unknown>> | readonly unknown[] | string;
  },
  fail: { readonly error: new (code: TCode, status: number, message: string) => Error; readonly code: TCode; readonly action: string },
): Promise<unknown> {
  const init: RequestInit = {
    method: input.method,
    headers: input.headers,
  };
  if (input.body !== undefined) {
    init.body = typeof input.body === "string" ? input.body : JSON.stringify(input.body);
  }
  const response = await fetchImpl(input.url, init);
  if (!response.ok) {
    throw new fail.error(fail.code, response.status, `${fail.action} failed with HTTP ${response.status}.`);
  }
  return parseJsonBody(response);
}

/**
 * Parsed JSON body reader. Returns `null` for empty bodies so the
 * `(await fetchJsonOrThrow(...)) ?? null` idiom works for endpoints
 * whose 2xx response is legitimately empty (e.g. Azure DELETE 204).
 * Throws SyntaxError if the body is non-empty and non-JSON.
 */
async function parseJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) {
    return null;
  }
  return JSON.parse(text);
}