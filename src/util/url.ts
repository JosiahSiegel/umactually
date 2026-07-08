/** Join provider base URLs consistently; eliminates duplicated slash trimming across provider clients. */
export function joinUrl(baseUrl: string, path: string): string {
  const trimmedBase = stripTrailingSlash(baseUrl);
  const prefixedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${prefixedPath}`;
}

/**
 * Resolve a provider's `baseUrl` down to its origin (scheme + host + port),
 * then append a default API prefix. This makes the action robust against
 * any operator-supplied path: no matter what the user puts after the host
 * (`/v1`, `/openai`, `/anthropic`, `/api/v2`, etc.), the action always
 * targets the canonical OpenAI-style path on the host root.
 *
 * Goal: `${result}/responses` and `${result}/chat/completions` must
 * reach the provider regardless of what path the operator typed in
 * `UMACTUALLY_API_URL`. The provider is responsible for serving those
 * routes at the host root + `/v1/...`.
 *
 * Examples (defaultPrefix = `/v1`):
 *   - `https://api.example.com`           → `https://api.example.com/v1`
 *   - `https://api.example.com/`          → `https://api.example.com/v1`
 *   - `https://api.example.com/v1`        → `https://api.example.com/v1`
 *   - `https://api.example.com/openai`    → `https://api.example.com/v1`
 *   - `https://api.example.com/anthropic` → `https://api.example.com/v1`
 *   - `https://api.example.com/api/v2`    → `https://api.example.com/v1`
 *   - `https://api.example.com/v1/openai` → `https://api.example.com/v1`
 *
 * The path is **always** discarded. This is intentional: the action
 * calls OpenAI-style routes (`/responses`, `/chat/completions`),
 * and the operator's path is treated as decorative noise rather than
 * a routing hint. The fix trades a small amount of flexibility (no
 * custom namespace support) for a large amount of robustness — the
 * action works the same regardless of what path the operator typed.
 *
 * If an operator genuinely needs a custom namespace, they can use
 * the `--provider copilot` path (which uses GitHub's API directly)
 * or the `copilot` provider family which has its own routing.
 *
 * Detection uses a minimal URL parse. The fallback substring path
 * handles unencoded spaces and other URL-parse failures.
 *
 * @param baseUrl       Operator-supplied base URL.
 * @param defaultPrefix Default prefix to append to the origin.
 *                      Default `/v1`.
 */
export function resolveProviderBaseUrl(
  baseUrl: string,
  defaultPrefix: string = "/v1",
): string {
  const origin = extractOrigin(baseUrl);
  return `${origin}${defaultPrefix}`;
}

/**
 * Return the origin (scheme + host + port) of a URL, stripping any path,
 * query, and fragment. Used by `resolveProviderBaseUrl` to normalize
 * operator-supplied URLs to their canonical host root.
 *
 * Returns the input unchanged if it cannot be parsed as a URL — this
 * preserves the original string for callers that want a best-effort
 * fallback. Callers that need a strict guarantee should pass a
 * well-formed URL.
 */
export function extractOrigin(baseUrl: string): string {
  try {
    return new URL(baseUrl).origin;
  } catch {
    const schemeSep = baseUrl.indexOf("://");
    if (schemeSep === -1) {
      const firstSlash = baseUrl.indexOf("/");
      return firstSlash === -1 ? baseUrl : baseUrl.slice(0, firstSlash);
    }
    const sepLen = 3; // "://" length
    const afterScheme = baseUrl.slice(schemeSep + sepLen);
    const firstSlash = afterScheme.indexOf("/");
    const authority = firstSlash === -1 ? afterScheme : afterScheme.slice(0, firstSlash);
    return baseUrl.slice(0, schemeSep + sepLen) + authority;
  }
}

/**
 * Extract the hostname from a URL string. Returns null when the
 * input is empty, malformed, or a bare string without a scheme
 * separator. The caller is expected to fall back to a sensible
 * default when null is returned.
 *
 * Why hostname-only: substring matching on the full URL is too
 * loose. A URL like `https://example.com/minimax-router` would
 * falsely match `url.includes("minimax")` and pick a MiniMax
 * model. The hostname extract prevents that — `example.com`
 * doesn't contain `minimax`, so the model is the default.
 *
 * The returned hostname is always lowercased so callers can compare
 * directly against lowercase host keys. `URL.hostname` is already
 * lowercased per the WHATWG URL spec; the manual fallback path
 * (for scheme-less URLs) explicitly lowercases to keep the
 * case-insensitive match consistent regardless of whether the
 * URL had a parseable scheme.
 *
 * Examples:
 *   - `https://api.example.com/v1`        → `api.example.com`
 *   - `API.MINIMAX.IO`                    → `api.minimax.io`
 *   - `localhost:8080`                    → null (`new URL("localhost:8080")`
 *     parses with empty hostname because `localhost` is not a
 *     special scheme; the function returns null for empty hosts)
 *   - `` (empty string)                   → null
 */
export function extractHostname(baseUrl: string): string | null {
  const trimmed = baseUrl.trim();
  if (trimmed.length === 0) return null;
  let host: string | null;
  try {
    host = new URL(trimmed).hostname;
  } catch {
    // Fallback: scheme-less URLs (`API.MINIMAX.IO`, `localhost:8080`)
    // don't parse with `new URL()`. Strip the scheme manually, then
    // read up to the first `/` or `:`.
    const schemeSep = trimmed.indexOf("://");
    const afterScheme = schemeSep === -1 ? trimmed : trimmed.slice(schemeSep + 3);
    const firstSlash = afterScheme.indexOf("/");
    const firstColon = afterScheme.indexOf(":");
    const stop = firstSlash === -1 ? afterScheme.length : firstSlash;
    host = firstColon === -1 || firstColon > stop
      ? afterScheme.slice(0, stop)
      : afterScheme.slice(0, firstColon);
  }
  return host.length > 0 ? host.toLowerCase() : null;
}

/**
 * Return the ORDERED list of base URL candidates to try when calling
 * the openai-compatible provider. The first candidate is the
 * operator-supplied URL as-pasted (after trimming trailing slashes) —
 * we always respect what the operator typed. Subsequent candidates
 * are progressively more "normalized" forms: first the origin with
 * the default prefix prepended, then the origin alone (rare —
 * only useful if the provider serves routes at the root with no
 * prefix).
 *
 * The list is de-duplicated so the caller doesn't try the same URL
 * twice. The provider tries each candidate in order; if a candidate
 * 404s on both `/responses` and `/chat/completions`, the next
 * candidate is tried. The first candidate that returns a non-404
 * response wins.
 *
 * This is the "robust to any URL shape" contract: no matter what
 * the operator types, we find a working endpoint. The order is
 * important — the operator's URL comes first so the wire path
 * matches their intent whenever possible.
 *
 * Examples (defaultPrefix = `/v1`):
 *   - `https://api.example.com` →
 *       [`https://api.example.com`,
 *        `https://api.example.com/v1`]
 *   - `https://api.example.com/v1` →
 *       [`https://api.example.com/v1`,
 *        `https://api.example.com/v1`]  (de-duplicated)
 *   - `https://api.example.com/anthropic` →
 *       [`https://api.example.com/anthropic`,
 *        `https://api.example.com/v1`]
 *   - `https://api.example.com/api/v2` →
 *       [`https://api.example.com/api/v2`,
 *        `https://api.example.com/v1`]
 *
 * The fallback candidate (origin + default prefix) is included even
 * when the operator's URL is a bare host, so a single candidate is
 * tried twice (de-duplicated to one). This keeps the contract
 * uniform: callers always iterate a list, no special-casing.
 */
export function resolveProviderBaseUrlCandidates(
  baseUrl: string,
  defaultPrefix: string = "/v1",
): readonly string[] {
  const pasted = stripTrailingSlash(baseUrl);
  const normalized = resolveProviderBaseUrl(baseUrl, defaultPrefix);
  if (pasted === normalized) {
    return [pasted];
  }
  return [pasted, normalized];
}

/**
 * Removes trailing slashes from a URL or path segment. Useful before
 * joining paths so empty-path joins don't produce double slashes.
 */
export function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/u, "");
}

/** Convert a local filesystem path to a `file://` URL; eliminates duplicated URL-construction logic in the action and CLI entries. */
export function pathToFileUrl(value: string): string {
  return new URL(`file://${value.replace(/\\/gu, "/")}`).href;
}

/** Create request correlation IDs consistently; eliminates duplicated UUID fallback logic across providers. */
export function createRequestId(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cryptoApi = (globalThis as any).crypto as
    | { randomUUID?: () => string; getRandomValues?: (buf: Uint8Array) => Uint8Array }
    | undefined;
  if (cryptoApi?.randomUUID !== undefined) {
    return cryptoApi.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (cryptoApi?.getRandomValues !== undefined) {
    cryptoApi.getRandomValues(bytes);
  } else {
    // Last-resort fallback: non-cryptographic PRNG. Only reached when the
    // runtime has no `crypto` global AND no Node `crypto` module loaded —
    // i.e. very old Node (< 19) without `--experimental-global-webcrypto`,
    // or non-Node embedders. Request IDs are correlation handles, not
    // security tokens, so the entropy quality is acceptable here.
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  const hex: string[] = [];
  for (const byte of bytes) {
    hex.push(byte.toString(16).padStart(2, "0"));
  }
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}
