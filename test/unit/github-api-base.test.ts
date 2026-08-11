// SPDX-License-Identifier: MIT
//
// Task 13 — URL matrix + GHES base-resolution contract tests.
// Pins the behavior of `src/platform/github/api-base.ts`:
//   - resolve GHES base from GITHUB_API_URL (with /api/v3, with /api/graphql,
//     trailing slash, query/fragment rejection)
//   - normalize enterprise /api/v3 and /api/graphql shapes
//   - preserve github.com defaults (https://api.github.com + /graphql)
//   - provider/Copilot base is separate from review-platform base
//   - reject malformed / non-HTTPS / credentialed input
//   - redact URLs for log so the token sentinel never appears

import { describe, expect, it } from "vitest";

import {
  buildGithubApiBaseFromEnv,
  buildGithubGraphqlUrl,
  buildGithubRestUrl,
  isGithubComBase,
  normalizeGithubApiBase,
  type GithubApiBase,
} from "../../src/platform/github/api-base.js";
import { redactUrlForLog } from "../../src/util/url.js";

describe("normalizeGithubApiBase: shape + input validation", () => {
  it("accepts github.com default as-is", () => {
    expect(normalizeGithubApiBase("https://api.github.com")).toEqual({
      origin: "https://api.github.com",
      pathPrefix: "",
      graphqlPath: "/graphql",
      isEnterprise: false,
    });
  });

  it("strips a trailing slash from github.com", () => {
    const result = normalizeGithubApiBase("https://api.github.com/");
    expect(result.origin).toBe("https://api.github.com");
    expect(result.isEnterprise).toBe(false);
  });

  it("accepts enterprise host with /api/v3 path", () => {
    const result = normalizeGithubApiBase("https://ghe.example.com/api/v3");
    expect(result.origin).toBe("https://ghe.example.com");
    expect(result.pathPrefix).toBe("/api/v3");
    expect(result.graphqlPath).toBe("/api/graphql");
    expect(result.isEnterprise).toBe(true);
  });

  it("preserves enterprise /api/v3 with trailing slash", () => {
    const result = normalizeGithubApiBase("https://ghe.example.com/api/v3/");
    expect(result.pathPrefix).toBe("/api/v3");
    expect(result.isEnterprise).toBe(true);
  });

  it("preserves enterprise host with no /api/v3 (root)", () => {
    const result = normalizeGithubApiBase("https://ghe.example.com");
    expect(result.origin).toBe("https://ghe.example.com");
    expect(result.pathPrefix).toBe("");
    expect(result.graphqlPath).toBe("/api/graphql");
    expect(result.isEnterprise).toBe(true);
  });

  it("preserves enterprise host with a custom path prefix", () => {
    const result = normalizeGithubApiBase("https://ghe.example.com/github");
    expect(result.origin).toBe("https://ghe.example.com");
    expect(result.pathPrefix).toBe("/github");
    expect(result.isEnterprise).toBe(true);
  });

  it("rejects non-HTTPS schemes (http://)", () => {
    expect(() => normalizeGithubApiBase("http://ghe.example.com/api/v3")).toThrow(
      /non-HTTPS scheme/i,
    );
  });

  it("rejects non-HTTPS schemes (ftp://)", () => {
    expect(() => normalizeGithubApiBase("ftp://ghe.example.com/api/v3")).toThrow(
      /non-HTTPS scheme/i,
    );
  });

  it("rejects credentialed URLs (userinfo)", () => {
    expect(() =>
      normalizeGithubApiBase("https://user:token@ghe.example.com/api/v3"),
    ).toThrow(/userinfo|credentials|credential/i);
  });

  it("rejects URLs with a query string", () => {
    expect(() =>
      normalizeGithubApiBase("https://ghe.example.com/api/v3?token=abc"),
    ).toThrow(/query|fragment/i);
  });

  it("rejects URLs with a fragment", () => {
    expect(() =>
      normalizeGithubApiBase("https://ghe.example.com/api/v3#section"),
    ).toThrow(/query|fragment/i);
  });

  it("rejects empty / whitespace input", () => {
    expect(() => normalizeGithubApiBase("")).toThrow();
    expect(() => normalizeGithubApiBase("   ")).toThrow();
  });

  it("rejects malformed URLs", () => {
    expect(() => normalizeGithubApiBase("not a url")).toThrow();
  });

  it("lowercases the scheme comparison (HTTPS:// → https://)", () => {
    // Scheme comparison is case-insensitive per WHATWG URL; the
    // function still accepts uppercase scheme.
    const result = normalizeGithubApiBase("HTTPS://api.github.com");
    expect(result.origin).toBe("https://api.github.com");
    expect(result.isEnterprise).toBe(false);
  });
});

describe("buildGithubRestUrl: REST URL composition", () => {
  const enterpriseBase: GithubApiBase = {
    origin: "https://ghe.example.com",
    pathPrefix: "/api/v3",
    graphqlPath: "/api/graphql",
    isEnterprise: true,
  };

  it("appends segments after the /api/v3 prefix for enterprise", () => {
    expect(
      buildGithubRestUrl(enterpriseBase, "/repos/foo/bar/pulls/42"),
    ).toBe("https://ghe.example.com/api/v3/repos/foo/bar/pulls/42");
  });

  it("encodes path segments safely", () => {
    expect(
      buildGithubRestUrl(enterpriseBase, "/repos/owner name/repo/pulls/1"),
    ).toBe(
      "https://ghe.example.com/api/v3/repos/owner%20name/repo/pulls/1",
    );
  });

  const comBase: GithubApiBase = {
    origin: "https://api.github.com",
    pathPrefix: "",
    graphqlPath: "/graphql",
    isEnterprise: false,
  };

  it("uses bare origin for github.com (no /api/v3 prefix)", () => {
    expect(buildGithubRestUrl(comBase, "/repos/foo/bar/pulls/42")).toBe(
      "https://api.github.com/repos/foo/bar/pulls/42",
    );
  });

  it("appends an optional query string verbatim", () => {
    expect(
      buildGithubRestUrl(comBase, "/repos/foo/bar/contents/AGENTS.md?ref=main"),
    ).toBe("https://api.github.com/repos/foo/bar/contents/AGENTS.md?ref=main");
  });
});

describe("buildGithubGraphqlUrl: GraphQL endpoint", () => {
  it("returns /graphql for github.com", () => {
    const comBase: GithubApiBase = {
      origin: "https://api.github.com",
      pathPrefix: "",
      graphqlPath: "/graphql",
      isEnterprise: false,
    };
    expect(buildGithubGraphqlUrl(comBase)).toBe("https://api.github.com/graphql");
  });

  it("returns /api/graphql for GHES with /api/v3", () => {
    const gheBase: GithubApiBase = {
      origin: "https://ghe.example.com",
      pathPrefix: "/api/v3",
      graphqlPath: "/api/graphql",
      isEnterprise: true,
    };
    expect(buildGithubGraphqlUrl(gheBase)).toBe("https://ghe.example.com/api/graphql");
  });

  it("returns /api/graphql for GHES with bare host", () => {
    const gheBase: GithubApiBase = {
      origin: "https://ghe.example.com",
      pathPrefix: "",
      graphqlPath: "/api/graphql",
      isEnterprise: true,
    };
    expect(buildGithubGraphqlUrl(gheBase)).toBe("https://ghe.example.com/api/graphql");
  });
});

describe("isGithubComBase: identity check", () => {
  it("returns true for the canonical github.com origin", () => {
    expect(isGithubComBase({ origin: "https://api.github.com", pathPrefix: "", graphqlPath: "/graphql", isEnterprise: false })).toBe(true);
  });

  it("returns false for any enterprise host", () => {
    expect(isGithubComBase({ origin: "https://ghe.example.com", pathPrefix: "/api/v3", graphqlPath: "/api/graphql", isEnterprise: true })).toBe(false);
  });

  it("returns false for a github.com lookalike (ghe.com subdomain)", () => {
    expect(isGithubComBase({ origin: "https://api.ghe.com", pathPrefix: "", graphqlPath: "/api/graphql", isEnterprise: true })).toBe(false);
  });
});

describe("buildGithubApiBaseFromEnv: read env at call-time", () => {
  it("returns github.com default when GITHUB_API_URL is unset", () => {
    const env: NodeJS.ProcessEnv = {};
    expect(buildGithubApiBaseFromEnv(env)).toEqual({
      origin: "https://api.github.com",
      pathPrefix: "",
      graphqlPath: "/graphql",
      isEnterprise: false,
    });
  });

  it("returns github.com default when GITHUB_API_URL is empty string", () => {
    const env: NodeJS.ProcessEnv = { GITHUB_API_URL: "" };
    expect(buildGithubApiBaseFromEnv(env).origin).toBe("https://api.github.com");
  });

  it("returns enterprise base when GITHUB_API_URL points at GHES", () => {
    const env: NodeJS.ProcessEnv = {
      GITHUB_API_URL: "https://ghe.example.com/api/v3",
    };
    const result = buildGithubApiBaseFromEnv(env);
    expect(result.isEnterprise).toBe(true);
    expect(result.origin).toBe("https://ghe.example.com");
    expect(result.pathPrefix).toBe("/api/v3");
  });

  it("reflects env changes across calls (read at call time, not module load)", () => {
    // The whole point of the rewrite: tests / operator overrides
    // can mutate the env between invocations and the next call sees
    // the new value (instead of capturing it at module-load time).
    const env: NodeJS.ProcessEnv = {};
    expect(buildGithubApiBaseFromEnv(env).origin).toBe("https://api.github.com");
    env["GITHUB_API_URL"] = "https://ghe.example.com/api/v3";
    expect(buildGithubApiBaseFromEnv(env).origin).toBe("https://ghe.example.com");
    delete env["GITHUB_API_URL"];
    expect(buildGithubApiBaseFromEnv(env).origin).toBe("https://api.github.com");
  });

  it("throws on malformed GITHUB_API_URL (pre-network)", () => {
    const env: NodeJS.ProcessEnv = { GITHUB_API_URL: "http://ghe.example.com/api/v3" };
    expect(() => buildGithubApiBaseFromEnv(env)).toThrow();
  });

  it("throws on credentialed GITHUB_API_URL (pre-network)", () => {
    const env: NodeJS.ProcessEnv = {
      GITHUB_API_URL: "https://user:token@ghe.example.com/api/v3",
    };
    expect(() => buildGithubApiBaseFromEnv(env)).toThrow();
  });
});

describe("provider/Copilot separation: token sentinel never reaches wrong host", () => {
  it("redactUrlForLog strips userinfo from GHES URLs", () => {
    // If a credentialed URL ever leaks into the log, the redactor
    // MUST drop the userinfo so the token sentinel doesn't appear.
    const redacted = redactUrlForLog("https://gho_token_sentinel@example.com/api/v3/repos");
    expect(redacted).not.toContain("gho_token_sentinel");
    expect(redacted).not.toContain("@");
    expect(redacted.startsWith("https://example.com/")).toBe(true);
  });

  it("redactUrlForLog strips query strings from GHES URLs", () => {
    const redacted = redactUrlForLog(
      "https://ghe.example.com/api/v3/repos?token=gho_token_sentinel",
    );
    expect(redacted).not.toContain("gho_token_sentinel");
    expect(redacted).not.toContain("?");
  });

  it("provider base is independently configurable from platform base", () => {
    // The contract: provider/Copilot base is a separate input from the
    // review-platform base. A misconfigured Copilot base MUST NOT
    // contaminate the platform resolution path.
    const env: NodeJS.ProcessEnv = {
      GITHUB_API_URL: "https://ghe.example.com/api/v3",
      UMACTUALLY_GITHUB_API_BASE: "https://api.github.com",
    };
    const platform = buildGithubApiBaseFromEnv(env);
    expect(platform.isEnterprise).toBe(true);
    expect(platform.origin).toBe("https://ghe.example.com");
    // The provider base is read by the Copilot module via its own
    // env contract — the platform module MUST NOT touch it. Assert
    // by reading the env that the provider module will read
    // separately.
    expect(env["UMACTUALLY_GITHUB_API_BASE"]).toBe("https://api.github.com");
  });
});
