import { USER_AGENT } from "./brand.js";

/** Bearer + JSON Accept + UA; eliminates duplicated auth header construction across platform and provider clients. */
export function authHeaders(
  token: string,
  opts?: { readonly mediaType?: string; readonly extra?: Readonly<Record<string, string>> },
): Record<string, string> {
  const mediaType = opts?.mediaType ?? "application/json";
  return {
    Authorization: `Bearer ${token}`,
    Accept: mediaType,
    "User-Agent": USER_AGENT,
    ...opts?.extra,
  };
}

/** GitHub PR review header set; eliminates repeated vnd.github+json and API-version literals. */
export function githubHeaders(token: string): Record<string, string> {
  return authHeaders(token, {
    mediaType: "application/vnd.github+json",
    extra: { "X-GitHub-Api-Version": "2022-11-28" },
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
 */
export async function fetchTextOrThrow(
  fetchImpl: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
  input: { readonly url: string; readonly headers: Readonly<Record<string, string>> },
  fail: { readonly error: new (code: string, status: number, message: string) => Error; readonly failCode: string; readonly emptyCode: string; readonly platform: string },
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
