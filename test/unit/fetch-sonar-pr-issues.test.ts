import { describe, expect, it } from "vitest";

import { fetchSonarPrIssues } from "../../src/sonar/fetch-sonar-pr-issues.js";
import type { FetchImpl } from "../../src/cli/live-shared.js";

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeFetchRecorder(routes: ReadonlyArray<{
  readonly match: (url: string, method: string) => boolean;
  readonly response: () => Response;
}>): { readonly fetchImpl: FetchImpl; readonly calls: Array<{ url: string; method: string }> } {
  const calls: Array<{ url: string; method: string }> = [];
  const fetchImpl: FetchImpl = (url, init) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const urlString = typeof url === "string" ? url : url.toString();
    calls.push({ url: urlString, method });
    for (const route of routes) {
      if (route.match(urlString, method)) {
        return Promise.resolve(route.response());
      }
    }
    return Promise.resolve(makeJsonResponse({ message: "not found" }, 404));
  };
  return { fetchImpl, calls };
}

const CONFIG = {
  hostUrl: "https://sonarcloud.io",
  token: "test-token",
  projectKey: "JosiahSiegel_umactually",
  prNumber: 42,
} as const;

describe("fetchSonarPrIssues", () => {
  it("returns parsed findings with category: 'sonar' for a 200 with non-empty issues", async () => {
    const { fetchImpl, calls } = makeFetchRecorder([
      {
        match: (url, method) =>
          method === "GET" && url.includes("/api/issues/search") && url.includes("pullRequest=42"),
        response: () =>
          makeJsonResponse({
            total: 2,
            issues: [
              {
                component: "JosiahSiegel_umactually:src/cli/init.ts",
                rule: "typescript:S3358",
                line: 1298,
                severity: "MAJOR",
                message: "Extract this nested ternary.",
              },
              {
                component: "JosiahSiegel_umactually:src/foo.ts",
                rule: "typescript:S3776",
                line: 12,
                severity: "CRITICAL",
                message: "Reduce cognitive complexity.",
              },
            ],
          }),
      },
    ]);

    const result = await fetchSonarPrIssues({ config: CONFIG, fetchImpl });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain("/api/issues/search");
    expect(calls[0]?.url).toContain("componentKeys=JosiahSiegel_umactually");
    expect(calls[0]?.url).toContain("pullRequest=42");
    expect(calls[0]?.url).toContain("inNewCodePeriod=true");
    expect(calls[0]?.url).toContain("resolved=false");
    expect(result.total).toBe(2);
    expect(result.findings).toEqual([
      expect.objectContaining({
        path: "src/cli/init.ts",
        line: 1298,
        severity: "major",
        category: "sonar",
      }),
      expect.objectContaining({
        path: "src/foo.ts",
        line: 12,
        severity: "critical",
        category: "sonar",
      }),
    ]);
  });

  it("returns empty result for 200 with zero issues", async () => {
    const { fetchImpl } = makeFetchRecorder([
      {
        match: (url, method) => method === "GET" && url.includes("/api/issues/search"),
        response: () => makeJsonResponse({ total: 0, issues: [] }),
      },
    ]);

    const result = await fetchSonarPrIssues({ config: CONFIG, fetchImpl });
    expect(result.findings).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.truncated).toBe(false);
  });

  it("returns empty result on network failure (without throwing)", async () => {
    const fetchImpl: FetchImpl = () => Promise.reject(new Error("ECONNREFUSED"));
    const result = await fetchSonarPrIssues({ config: CONFIG, fetchImpl });
    expect(result.findings).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.truncated).toBe(false);
  });

  it("returns empty result on HTTP error (no throw)", async () => {
    const { fetchImpl } = makeFetchRecorder([
      {
        match: (url, method) => method === "GET" && url.includes("/api/issues/search"),
        response: () => makeJsonResponse({ message: "Unauthorized" }, 401),
      },
    ]);
    const result = await fetchSonarPrIssues({ config: CONFIG, fetchImpl });
    expect(result.findings).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("drops file-level issues (line = 0 / null / absent)", async () => {
    const { fetchImpl } = makeFetchRecorder([
      {
        match: (url, method) => method === "GET" && url.includes("/api/issues/search"),
        response: () =>
          makeJsonResponse({
            total: 3,
            issues: [
              {
                component: "JosiahSiegel_umactually:src/foo.ts",
                rule: "typescript:S1",
                line: 0,
                severity: "MAJOR",
                message: "line=0 — file-level",
              },
              {
                component: "JosiahSiegel_umactually:src/foo.ts",
                rule: "typescript:S2",
                line: null,
                severity: "MAJOR",
                message: "line=null — file-level",
              },
              {
                component: "JosiahSiegel_umactually:src/foo.ts",
                rule: "typescript:S3",
                severity: "MAJOR",
                message: "no line at all — file-level",
              },
            ],
          }),
      },
    ]);
    const result = await fetchSonarPrIssues({ config: CONFIG, fetchImpl });
    expect(result.findings).toEqual([]);
    expect(result.total).toBe(3);
  });

  it("strips the projectKey prefix from the component path", async () => {
    const { fetchImpl } = makeFetchRecorder([
      {
        match: (url, method) => method === "GET" && url.includes("/api/issues/search"),
        response: () =>
          makeJsonResponse({
            total: 1,
            issues: [
              {
                component: "JosiahSiegel_umactually:src/nested/file.ts",
                rule: "ts:S1",
                line: 5,
                severity: "MAJOR",
                message: "x",
              },
            ],
          }),
      },
    ]);
    const result = await fetchSonarPrIssues({ config: CONFIG, fetchImpl });
    expect(result.findings[0]?.path).toBe("src/nested/file.ts");
  });

  it("drops issues whose component lacks the projectKey prefix", async () => {
    const { fetchImpl } = makeFetchRecorder([
      {
        match: (url, method) => method === "GET" && url.includes("/api/issues/search"),
        response: () =>
          makeJsonResponse({
            total: 1,
            issues: [
              {
                component: "src/foo.ts",
                rule: "ts:S1",
                line: 1,
                severity: "MAJOR",
                message: "no projectKey prefix — drop",
              },
            ],
          }),
      },
    ]);
    const result = await fetchSonarPrIssues({ config: CONFIG, fetchImpl });
    expect(result.findings).toEqual([]);
  });

  it("maps SonarCloud severities: BLOCKER→critical, CRITICAL→critical, MAJOR→major, MINOR→minor, INFO→info, unknown→major", async () => {
    const { fetchImpl } = makeFetchRecorder([
      {
        match: (url, method) => method === "GET" && url.includes("/api/issues/search"),
        response: () =>
          makeJsonResponse({
            total: 6,
            issues: [
              { component: "JosiahSiegel_umactually:a.ts", rule: "r1", line: 1, severity: "BLOCKER", message: "x" },
              { component: "JosiahSiegel_umactually:b.ts", rule: "r2", line: 1, severity: "CRITICAL", message: "x" },
              { component: "JosiahSiegel_umactually:c.ts", rule: "r3", line: 1, severity: "MAJOR", message: "x" },
              { component: "JosiahSiegel_umactually:d.ts", rule: "r4", line: 1, severity: "MINOR", message: "x" },
              { component: "JosiahSiegel_umactually:e.ts", rule: "r5", line: 1, severity: "INFO", message: "x" },
              { component: "JosiahSiegel_umactually:f.ts", rule: "r6", line: 1, severity: "MYSTERY", message: "x" },
            ],
          }),
      },
    ]);
    const result = await fetchSonarPrIssues({ config: CONFIG, fetchImpl });
    expect(result.findings.map((f) => f.severity)).toEqual([
      "critical", "critical", "major", "minor", "info", "major",
    ]);
  });

  it("formats the body as **SonarCloud <SEV> — `<rule>`** + msg + sonar link", async () => {
    const { fetchImpl } = makeFetchRecorder([
      {
        match: (url, method) => method === "GET" && url.includes("/api/issues/search"),
        response: () =>
          makeJsonResponse({
            total: 1,
            issues: [
              {
                component: "JosiahSiegel_umactually:src/foo.ts",
                rule: "ts:S1234",
                line: 10,
                severity: "MAJOR",
                message: "Some finding text.",
              },
            ],
          }),
      },
    ]);
    const result = await fetchSonarPrIssues({ config: CONFIG, fetchImpl });
    const body = result.findings[0]?.body ?? "";
    expect(body).toContain("**SonarCloud MAJOR — `ts:S1234`**");
    expect(body).toContain("Some finding text.");
    expect(body).toContain("[Open in SonarCloud]");
  });

  it("strips a trailing slash from the host URL", async () => {
    let observedUrl = "";
    const fetchImpl: FetchImpl = (url) => {
      observedUrl = typeof url === "string" ? url : url.toString();
      return Promise.resolve(
        makeJsonResponse({ total: 0, issues: [] }),
      );
    };
    await fetchSonarPrIssues({
      config: { ...CONFIG, hostUrl: "https://sonarcloud.io/" },
      fetchImpl,
    });
    expect(observedUrl).toMatch(/^https:\/\/sonarcloud\.io\/api\/issues\/search/u);
    expect(observedUrl).not.toContain("//api");
  });

  it("attaches Authorization: Bearer header", async () => {
    let observedAuth = "";
    const fetchImpl: FetchImpl = (_url, init) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      observedAuth = headers["Authorization"] ?? "";
      return Promise.resolve(makeJsonResponse({ total: 0, issues: [] }));
    };
    await fetchSonarPrIssues({ config: CONFIG, fetchImpl });
    expect(observedAuth).toBe("Bearer test-token");
  });
});