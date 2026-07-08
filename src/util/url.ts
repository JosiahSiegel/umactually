/** Join provider base URLs consistently; eliminates duplicated slash trimming across provider clients. */
export function joinUrl(baseUrl: string, path: string): string {
  const trimmedBase = stripTrailingSlash(baseUrl);
  const prefixedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${prefixedPath}`;
}

/**
 * Resolve a provider's `baseUrl` + a default API prefix so the
 * `openai-compatible` provider can call OpenAI-style routes
 * (`/responses`, `/chat/completions`) without the operator having to
 * include the `/v1` segment in `UMACTUALLY_API_URL`.
 *
 * Behavior:
 *   - If `baseUrl` is a bare host (no path component after the TLD),
 *     `defaultPrefix` is inserted: `https://api.example.com` →
 *     `https://api.example.com/v1`.
 *   - If `baseUrl` already has a path component
 *     (e.g. `https://example.com/openai` or `https://example.com/v1`),
 *     the URL is returned unchanged — the operator has chosen a
 *     routing convention and the action should not override it.
 *   - If `baseUrl` has a non-v1 path (e.g. `https://example.com/openai`),
 *     the action appends the endpoint path verbatim: `/responses` →
 *     `https://example.com/openai/responses`. This is the most
 *     flexible behavior — the operator opts into a custom namespace
 *     and the action respects it.
 *
 * The check is intentionally narrow: only insert the default prefix
 * when the URL has no path AT ALL (path = "" or path = "/"). A
 * trailing slash alone does not signal a custom namespace — most
 * OpenAI-compatible providers serve `/v1/...` behind a bare host,
 * so `https://api.example.com/` is treated as bare-host and gets
 * the default prefix.
 *
 * Hosts with `https://` or `http://` and an IPv4/IPv6 literal are
 * detected as bare-host when there's no path segment after the
 * authority. The detection uses a minimal URL parse — we only
 * inspect the `pathname` field, which is what determines whether a
 * custom prefix is in play.
 */
export function resolveProviderBaseUrl(
  baseUrl: string,
  defaultPrefix: string = "/v1",
): string {
  const trimmed = stripTrailingSlash(baseUrl);
  // Try to parse as a URL. If parsing fails (e.g. unencoded space),
  // fall back to a substring check: trim the trailing slash and
  // look for the last `/` AFTER the scheme separator.
  let pathname = "/";
  try {
    const parsed = new URL(trimmed);
    pathname = parsed.pathname;
  } catch {
    // Fallback: extract path after `://` authority.
    const schemeSep = trimmed.indexOf("://");
    if (schemeSep === -1) {
      // No scheme — treat as bare path/host string and inspect.
      const firstSlash = trimmed.indexOf("/");
      pathname = firstSlash === -1 ? "" : trimmed.slice(firstSlash);
    } else {
      const sepLen = 3; // "://" length
      const afterScheme = trimmed.slice(schemeSep + sepLen);
      const firstSlash = afterScheme.indexOf("/");
      pathname = firstSlash === -1 ? "" : afterScheme.slice(firstSlash);
    }
  }
  // Bare host: empty path or "/" only. Insert the default prefix.
  if (pathname === "" || pathname === "/") {
    return `${trimmed}${defaultPrefix}`;
  }
  // Custom namespace already present — return as-is, the action will
  // append the endpoint path verbatim.
  return trimmed;
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
