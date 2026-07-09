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
 * Resolve the Anthropic Messages API URL from the operator-supplied base URL.
 *
 * Mirrors the OFFICIAL @anthropic-ai/sdk convention (Claude Code's
 * `ANTHROPIC_BASE_URL=https://api.anthropic.com` becomes
 * `POST https://api.anthropic.com/v1/messages`) and the documented
 * fix in https://github.com/xemantic/anthropic-sdk-kotlin/pull/145 —
 * which notes that previously "client.post('/v1/messages') replaced
 * any path on a configured baseUrl, breaking Anthropic-compatible
 * providers whose endpoints live under a path prefix."
 *
 * Anthropic-compatible gateways commonly mount the protocol under a
 * path prefix. The canonical example is MiniMax's Anthropic endpoint:
 *
 *   `--api-url https://api.minimax.io/anthropic` →
 *   `POST https://api.minimax.io/anthropic/v1/messages`
 *
 * NOT `https://api.minimax.io/v1/messages` (which 404s on MiniMax — see
 * https://platform.minimax.io/docs/token-plan/claude-code). The path
 * on the operator's URL is real routing, not decorative noise.
 *
 * Behavior:
 *
 *   - Parse the input as a URL and split out origin / path / query /
 *     fragment via the WHATWG URL parser. Query string and fragment
 *     are intentionally dropped — they don't address `/v1/messages`
 *     at any known Anthropic-protocol gateway, and passing them
 *     through would smuggle the endpoint into the query segment
 *     (`.../v1?token=abc/v1/messages`), an invalid URL that fires
 *     against a different route.
 *   - Trim trailing slashes from the resulting path.
 *   - If the path already ends in `/v1/messages`, return as-is
 *     (operator pre-appended; idempotent).
 *   - If it ends in `/v1`, append `/messages` (don't double-`/v1` —
 *     matches the SDK default of `https://api.anthropic.com/v1`).
 *   - Otherwise, append `/v1/messages` to the existing path (path
 *     prefix is preserved).
 *   - On URL-parse failure (operator supplied something that isn't a
 *     valid URL), fall back to a trailing-slash strip + naive
 *     concatenation — preserves the original string when the WHATWG
 *     parser can't decode it but still drops the function rather
 *     than throwing.
 *
 * Examples:
 *
 *   - `https://api.anthropic.com`                        → `https://api.anthropic.com/v1/messages`
 *   - `https://api.anthropic.com/v1`                     → `https://api.anthropic.com/v1/messages`
 *   - `https://api.anthropic.com/v1/`                    → `https://api.anthropic.com/v1/messages`
 *   - `https://api.minimax.io/anthropic`                 → `https://api.minimax.io/anthropic/v1/messages`
 *   - `https://api.minimax.io/anthropic/`                → `https://api.minimax.io/anthropic/v1/messages`
 *   - `https://gateway.example.com/llm/anthropic`        → `https://gateway.example.com/llm/anthropic/v1/messages`
 *   - `https://api.anthropic.com/v1/messages`            → `https://api.anthropic.com/v1/messages` (idempotent)
 *   - `https://api.anthropic.com/v1?token=abc`           → `https://api.anthropic.com/v1/messages` (query dropped)
 *   - `https://api.anthropic.com/v1#section`             → `https://api.anthropic.com/v1/messages` (fragment dropped)
 *
 * Note: this helper REPLACES `resolveProviderBaseUrl` for the
 * Anthropic provider only. The OpenAI-compatible provider still uses
 * `resolveProviderBaseUrlCandidates` because OpenAI gateways
 * (`/openai`, `/api/v2`, etc.) live at the host root + `/v1`, so the
 * try-as-pasted-then-origin-with-`/v1` fallback is the right
 * contract there. Anthropic's path-prefix gateways (MiniMax's
 * `/anthropic`) need the path preserved.
 */
export function resolveAnthropicMessagesUrl(baseUrl: string): string {
  // Parse once and split origin / path. Drop query string and fragment
  // up front — they don't address the canonical /v1/messages route at
  // any known Anthropic-protocol gateway, and passing them through
  // would append the path segment into the query (`...?token=abc/v1/
  // messages`), an invalid URL.
  let origin: string;
  let pathPart: string;
  try {
    const parsed = new URL(baseUrl);
    origin = parsed.origin;
    pathPart = parsed.pathname;
  } catch {
    // Unparseable input. Fall back to extractOrigin + raw concatenation.
    //
    // IMPORTANT: keep `pathPart` in the SAME shape `parsed.pathname`
    // would have produced — including a leading `/`. The dispatcher
    // checks below assume the leading-slash form (`/v1`,
    // `/v1/messages`); stripping the slash would route an unparseable
    // input through the wrong branch and produce a doubled
    // `/v1/v1/messages` suffix.
    origin = extractOrigin(baseUrl);
    pathPart = stripTrailingSlash(baseUrl).slice(origin.length);
  }
  // Normalize: WHATWG URL sets pathname to "/" for a bare host; we
  // want the empty string so concatenation produces `origin + /v1/messages`
  // without a doubled slash.
  const cleanedPath = stripTrailingSlash(pathPart === "/" ? "" : pathPart);
  if (cleanedPath.endsWith("/v1/messages")) {
    // Operator pre-appended the full messages endpoint; idempotent.
    return joinUrl(origin, cleanedPath);
  }
  // Match the LAST path segment being literally `v1`. The previous
  // `cleanedPath.endsWith("/v1")` was a suffix check that falsely
  // matched paths whose trailing characters happened to be `v1`
  // (e.g. `/my-v1` → wrong branch, would append `/messages`
  // instead of `/v1/messages`). Path-segment comparison is the
  // Anthropic-SDK intent: only a trailing `/v1` *segment* counts,
  // not any path that happens to end in those two characters.
  const lastSegment = cleanedPath === "" ? "" : cleanedPath.slice(cleanedPath.lastIndexOf("/") + 1);
  if (cleanedPath === "/v1" || lastSegment === "v1") {
    return joinUrl(origin, `${cleanedPath}/messages`);
  }
  return joinUrl(origin, `${cleanedPath}/v1/messages`);
}

/**
 * Removes trailing slashes from a URL or path segment. Useful before
 * joining paths so empty-path joins don't produce double slashes.
 */
export function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/u, "");
}

/**
 * Strip the query string and fragment from a URL for safe inclusion
 * in CI logs and operator-facing diagnostics. The URL may carry
 * session tokens, tenant identifiers, or other credential-bearing
 * parameters in the query slot — leaking those into the action's
 * stderr notices (which are persisted as GitHub Actions annotations)
 * is a credential-disclosure risk that we explicitly avoid.
 *
 * Behavior:
 *   - Empty input                        → empty output
 *   - Bare host                          → unchanged
 *   - With query string                  → origin + path (no `?`)
 *   - With fragment                      → origin + path (no `#`)
 *   - Unparseable input                  → substring-stripped; never throws
 *
 * Examples:
 *   - `https://api.example.com`                   → `https://api.example.com`
 *   - `https://api.example.com/v1`                → `https://api.example.com/v1`
 *   - `https://api.example.com?token=secret`      → `https://api.example.com`
 *   - `https://api.example.com/v1#anchor`         → `https://api.example.com/v1`
 */
export function redactUrlForLog(value: string): string {
  if (value.length === 0) return value;
  try {
    const parsed = new URL(value);
    // WHATWG URL normalizes pathname to start with `/`; for a bare
    // host it's just `/`, so concatenating origin + `/` would
    // produce `https://api.example.com/` for an input of
    // `https://api.example.com`. Strip the trailing slash so the
    // redacted form matches the input canonicalization the operator
    // typed.
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${parsed.origin}${path}`;
  } catch {
    // Unparseable URL — strip query and fragment manually.
    const noQuery = value.split("?")[0] ?? value;
    return noQuery.split("#")[0] ?? noQuery;
  }
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
