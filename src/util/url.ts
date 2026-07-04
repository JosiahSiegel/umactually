/** Join provider base URLs consistently; eliminates duplicated slash trimming across provider clients. */
export function joinUrl(baseUrl: string, path: string): string {
  const trimmedBase = stripTrailingSlash(baseUrl);
  const prefixedPath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmedBase}${prefixedPath}`;
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
