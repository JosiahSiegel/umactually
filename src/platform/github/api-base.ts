// SPDX-License-Identifier: MIT
//
// Task 13 — GitHub Enterprise Server (GHES) API-base resolution +
// normalization. Single source of truth for the review-platform API
// base; provider/Copilot base resolution is intentionally NOT in this
// module (see `src/provider/copilot.ts` and `src/provider/copilot-token.ts`
// for the Copilot side).
//
// Three responsibilities:
//
//   1. `normalizeGithubApiBase(rawUrl)` — shape + validate an
//      operator-supplied base URL into a `GithubApiBase` record.
//      Rejects: non-HTTPS, userinfo (credentials), query/fragment
//      strings, malformed input, empty/whitespace.
//
//   2. `buildGithubApiBaseFromEnv(env)` — read `GITHUB_API_URL` at
//      CALL time (NOT module-load time — that's the whole point of
//      the Task 13 refactor; the previous module-level constant
//      captured the env once at import and tests couldn't override
//      it) and return the normalized base, defaulting to
//      `https://api.github.com` when unset.
//
//   3. `buildGithubRestUrl(base, path)` / `buildGithubGraphqlUrl(base)`
//      — compose REST and GraphQL endpoints from the resolved base.
//      github.com uses bare `/graphql` and `/repos/...` paths;
//      GHES uses `/api/v3` and `/api/graphql`. The composition rules
//      are pinned by the URL matrix tests in
//      `test/unit/github-api-base.test.ts`.
//
// Separation from the provider/Copilot base:
//
//   The Copilot token-exchange path uses its own base URL (driven by
//   `--github-api-base` / `UMACTUALLY_GITHUB_API_BASE`); that base is
//   intentionally NEVER read here. This module only resolves the
//   REVIEW-PLATFORM base (REST + GraphQL endpoints for posting
//   reviews, reading PR metadata, fetching instruction files, etc.).
//   When an operator points the review platform at GHES but keeps the
//   Copilot base on github.com, both stay independent — no silent
//   token leakage either direction.
//
// Why pre-network validation matters:
//
//   A malformed `GITHUB_API_URL` would otherwise reach the network
//   layer where a typo (`http://`, missing scheme, userinfo with a
//   leaked token, query string with a token) leaks a credential to
//   the wrong host or surfaces as a confusing 4xx with the token
//   embedded in the diagnostic. Catching every shape at the
//   `normalizeGithubApiBase` boundary means the first error the
//   operator sees is a typed message identifying which input was
//   wrong, and ZERO network requests cross the wire.

import { DEFAULT_GITHUB_API_BASE } from "../../util/provider-defaults.js";
import { stripTrailingSlash } from "../../util/url.js";

/**
 * Normalized GitHub API base shape. Holds the parts we need to compose
 * REST + GraphQL endpoints consistently across github.com and GHES.
 */
export type GithubApiBase = {
  /** Origin: scheme + host + port. No path, query, or userinfo. */
  readonly origin: string;
  /**
   * Path prefix for REST endpoints. Empty for github.com;
   * `"/api/v3"` for GHES (or a custom prefix the operator configured).
   */
  readonly pathPrefix: string;
  /**
   * GraphQL endpoint path. `"/graphql"` for github.com;
   * `"/api/graphql"` for GHES (regardless of `pathPrefix`).
   */
  readonly graphqlPath: string;
  /** True for any non-github.com host. False for the canonical default. */
  readonly isEnterprise: boolean;
};

/**
 * Thrown when a `GITHUB_API_URL` value is malformed, non-HTTPS,
 * carries userinfo/credentials, has a query string or fragment, or
 * is empty. Carries the typed `code` so callers can surface a precise
 * remediation hint without a network round-trip.
 */
export class GithubApiBaseError extends Error {
  override readonly name = "GithubApiBaseError";
  constructor(
    readonly code:
      | "GITHUB_API_URL_EMPTY"
      | "GITHUB_API_URL_MALFORMED"
       | "GITHUB_API_URL_INSECURE"
       | "GITHUB_API_URL_INSECURE_HOST"
       | "GITHUB_API_URL_CREDENTIALED"
      | "GITHUB_API_URL_HAS_QUERY",
    message: string,
  ) {
    super(message);
  }
}

const GITHUB_COM_CANONICAL = "https://api.github.com";
const GITHUB_GRAPHQL_PATH_COM = "/graphql";
const GITHUB_GRAPHQL_PATH_ENTERPRISE = "/api/graphql";

/**
 * Normalize an operator-supplied base URL into a `GithubApiBase`.
 *
 * Accepts:
 *   - `https://api.github.com` (or with trailing slash)
 *   - `https://<host>/api/v3` (GHES — the canonical pattern)
 *   - `https://<host>` (GHES — bare host; REST goes to root, GraphQL
 *     at `/api/graphql`)
 *   - `https://<host>/<custom-prefix>` (operator-configured namespace)
 *
 * Rejects:
 *   - non-HTTPS schemes for external hosts (`http://`, `ftp://`, …) →
 *     `GITHUB_API_URL_INSECURE`
 *   - `http://` for non-local hosts → `GITHUB_API_URL_INSECURE_HOST`
 *   - URLs with userinfo (`https://user:pass@host/...`) →
 *     `GITHUB_API_URL_CREDENTIALED`
 *   - URLs with query strings or fragments →
 *     `GITHUB_API_URL_HAS_QUERY`
 *   - Empty/whitespace → `GITHUB_API_URL_EMPTY`
 *   - Anything that does not parse as a URL → `GITHUB_API_URL_MALFORMED`
 *
 * The rejection set is intentionally exhaustive: every failure mode
 * either leaks a credential, sends data to the wrong host, or
 * otherwise changes the security posture. A pre-network validation
 * pass keeps the operator's first error clear and typed.
 *
 * @param rawUrl Operator-supplied `GITHUB_API_URL` value.
 */
export function normalizeGithubApiBase(rawUrl: string): GithubApiBase {
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    throw new GithubApiBaseError(
      "GITHUB_API_URL_EMPTY",
      "GITHUB_API_URL is empty; provide an HTTPS URL or unset the variable to use github.com.",
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new GithubApiBaseError(
      "GITHUB_API_URL_MALFORMED",
      `GITHUB_API_URL is not a parseable URL: '${rawUrl}'.`,
    );
  }
  // WHATWG URL normalizes scheme and hostname to lowercase; `protocol`
  // ends with ":". For IPv6 literals, `hostname` keeps the brackets
  // (e.g. `[::1]`); strip them before comparison. Local HTTP is
  // allowed only for test fixtures.
  const hostname = parsed.hostname.replace(/^\[|\]$/gu, "");
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocalhost)) {
    throw new GithubApiBaseError(
      parsed.protocol === "http:" ? "GITHUB_API_URL_INSECURE_HOST" : "GITHUB_API_URL_INSECURE",
      parsed.protocol === "http:"
        ? `GITHUB_API_URL must use HTTPS for external hosts (got '${parsed.hostname}'); HTTP is allowed only for localhost, 127.0.0.1, or ::1.`
        : `GITHUB_API_URL must use HTTPS (got '${parsed.protocol}'); non-HTTPS schemes risk credential and PR-data exposure.`,
    );
  }
  // WHATWG URL parses userinfo into `username` / `password` fields.
  // We reject any URL that carried userinfo, including username-only
  // forms. The previous module-level `replace(/\/$/u, "")` regex
  // would have happily passed `https://token@host/api/v3` through
  // and the resulting fetch would have embedded the token in the
  // `Authorization` header derivation chain on the server side.
  if (parsed.username.length > 0 || parsed.password.length > 0) {
    throw new GithubApiBaseError(
      "GITHUB_API_URL_CREDENTIALED",
      "GITHUB_API_URL must NOT carry userinfo (https://user:pass@host/...); put credentials in the Authorization header, not the URL.",
    );
  }
  if (parsed.search.length > 0 || parsed.hash.length > 0) {
    throw new GithubApiBaseError(
      "GITHUB_API_URL_HAS_QUERY",
      `GITHUB_API_URL must NOT carry a query string or fragment (got '${parsed.search}${parsed.hash}'); pass query parameters as request bodies or headers.`,
    );
  }
  const origin = parsed.origin;
  const pathSegment = stripTrailingSlash(parsed.pathname);
  const isEnterprise = !isGithubComOrigin(origin);
  // REST path prefix: any non-empty path the operator typed becomes
  // the prefix. Empty path on an enterprise host means REST goes to
  // the bare origin (GHES supports root + `/api/v3` interchangeably;
  // many installs mount `/api/v3` only on the v3 subpath).
  const pathPrefix = pathSegment;
  return {
    origin,
    pathPrefix,
    graphqlPath: isEnterprise ? GITHUB_GRAPHQL_PATH_ENTERPRISE : GITHUB_GRAPHQL_PATH_COM,
    isEnterprise,
  };
}

/**
 * Resolve the review-platform API base from `env` at CALL time. Reads
 * `process.env["GITHUB_API_URL"]` (when `env` is omitted) or the
 * supplied `env` snapshot.
 *
 * The call-time read is intentional: the previous module-level
 * `const GITHUB_API_BASE_URL = process.env[...]` captured the env
 * once at import time, so tests that mutated the env mid-test could
 * not override the base. Threading the env through `buildGithubApiBaseFromEnv(env)`
 * lets the live tests in `test/unit/evidence-task-13.test.ts`
 * exercise the GHES path by mutating the env between calls.
 *
 * Defaults to `https://api.github.com` when `GITHUB_API_URL` is
 * unset or empty (matches the prior behavior).
 */
export function buildGithubApiBaseFromEnv(env: NodeJS.ProcessEnv = process.env): GithubApiBase {
  const raw = env["GITHUB_API_URL"];
  if (raw === undefined || raw.length === 0) {
    return {
      origin: DEFAULT_GITHUB_API_BASE,
      pathPrefix: "",
      graphqlPath: GITHUB_GRAPHQL_PATH_COM,
      isEnterprise: false,
    };
  }
  return normalizeGithubApiBase(raw);
}

/**
 * Identity check: returns true when `base` points at the canonical
 * github.com origin. Used by callers that want to keep the legacy
 * github.com defaults (`/graphql`, no `/api/v3`) without depending
 * on the literal URL.
 */
export function isGithubComBase(base: GithubApiBase): boolean {
  return !base.isEnterprise && base.origin === GITHUB_COM_CANONICAL;
}

/**
 * Compose a REST URL from the resolved base. Path segments are
 * percent-encoded via `URL` to prevent operator input from slipping
 * unencoded slashes or spaces into the wire path. A leading slash is
 * always inserted between the prefix and the segments.
 *
 * Examples:
 *   - github.com base + `/repos/foo/bar/pulls/42` →
 *     `https://api.github.com/repos/foo/bar/pulls/42`
 *   - GHES `/api/v3` base + `/repos/foo/bar/pulls/42` →
 *     `https://ghe.example.com/api/v3/repos/foo/bar/pulls/42`
 *   - GHES bare-host base + `/repos/foo/bar/pulls/42` →
 *     `https://ghe.example.com/repos/foo/bar/pulls/42`
 *
 * @param base  Normalized base returned by `normalizeGithubApiBase`.
 * @param path  Path segments starting with `/`. URL-encoded per
 *              segment; trailing `/` collapsed.
 */
export function buildGithubRestUrl(base: GithubApiBase, path: string): string {
  // Re-parse through URL to apply percent-encoding consistently.
  // `URL` rejects inputs that don't have a host; using the base as
  // the base of `new URL(relative, base)` enforces absolute path
  // resolution.
  const composed = new URL(
    // Strip the leading slash so `URL` treats the path as relative
    // to the base, but preserve the path segment shape.
    path.replace(/^\/+/u, ""),
    // Compose against the origin + prefix; trailing slash on the
    // base keeps `URL` from collapsing the prefix into the hostname.
    `${base.origin}${base.pathPrefix}/`,
  );
  return composed.toString();
}

/**
 * Compose the GraphQL endpoint URL from the resolved base.
 *
 *   - github.com → `https://api.github.com/graphql`
 *   - GHES (with or without `/api/v3` prefix) →
 *     `https://<host>/api/graphql`
 *
 * The `/api/graphql` path is the GHES-canonical GraphQL endpoint
 * regardless of whether the operator mounted `/api/v3` (REST lives
 * at `/api/v3` while GraphQL lives at `/api/graphql` — these are
 * independent mounts in GHES).
 */
export function buildGithubGraphqlUrl(base: GithubApiBase): string {
  return new URL(base.graphqlPath.replace(/^\/+/u, ""), `${base.origin}/`).toString();
}

// Internal helper: test whether the origin is the canonical
// github.com API host. Case-insensitive comparison via WHATWG URL
// lowercasing (already done by `URL.origin`).
function isGithubComOrigin(origin: string): boolean {
  return origin === GITHUB_COM_CANONICAL;
}
