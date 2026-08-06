import { describe, expect, it } from "vitest";

import { fetchSonarPrFindings } from "../../src/cli/fetch-sonar-pr-findings.js";
import type { GithubContext } from "../../src/platform/github/context.js";
import type { FetchImpl } from "../../src/cli/live-shared.js";

function makeContext(): GithubContext {
  return {
    token: "test-token",
    repo: { owner: "octo", name: "umactually" },
    prNumber: 42,
    headSha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    baseSha: "cafebabecafebabecafebabecafebabecafebabe",
    isDraft: false,
    title: "Test PR",
    body: "",
  };
}

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

describe("fetchSonarPrFindings", () => {
  it("fetches and parses SonarCloud inline PR comments carrying the <!-- sonarcloud --> marker", async () => {
    const { fetchImpl, calls } = makeFetchRecorder([
      {
        match: (url, method) => method === "GET" && url.includes("/pulls/42/comments"),
        response: () => makeJsonResponse([
          {
            path: "src/cli/init.ts",
            line: 1298,
            original_line: 1298,
            body: "<!-- sonarcloud -->\n**SonarCloud MAJOR — `typescript:S3358`**\n\nExtract this nested ternary operation into an independent statement.\n\n[Open in SonarCloud](https://sonarcloud.io)",
          },
        ]),
      },
    ]);

    const findings = await fetchSonarPrFindings({ context: makeContext(), fetchImpl });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toContain("/pulls/42/comments");
    expect(findings).toEqual([
      {
        path: "src/cli/init.ts",
        line: 1298,
        body: "<!-- sonarcloud -->\n**SonarCloud MAJOR — `typescript:S3358`**\n\nExtract this nested ternary operation into an independent statement.\n\n[Open in SonarCloud](https://sonarcloud.io)",
        severity: "major",
        category: "sonar",
      },
    ]);
  });

  it("maps BLOCKER/CRITICAL to internal critical severity", async () => {
    const { fetchImpl } = makeFetchRecorder([
      {
        match: (url, method) => method === "GET" && url.includes("/pulls/42/comments"),
        response: () => makeJsonResponse([
          {
            path: "src/x.ts",
            line: 1,
            original_line: 1,
            body: "<!-- sonarcloud -->\n**SonarCloud BLOCKER — `java:S6666`**\n\nCritical bug.",
          },
        ]),
      },
    ]);

    const findings = await fetchSonarPrFindings({ context: makeContext(), fetchImpl });
    expect(findings[0]?.severity).toBe("critical");
  });

  it("filters out PR comments that don't carry the sonarcloud marker", async () => {
    const { fetchImpl } = makeFetchRecorder([
      {
        match: (url, method) => method === "GET" && url.includes("/pulls/42/comments"),
        response: () => makeJsonResponse([
          {
            path: "src/x.ts",
            line: 1,
            original_line: 1,
            body: "Just a regular PR comment, not from SonarCloud.",
          },
        ]),
      },
    ]);

    const findings = await fetchSonarPrFindings({ context: makeContext(), fetchImpl });
    expect(findings).toEqual([]);
  });

  it("returns empty when both line and original_line are null (file-level anchor, no postable position)", async () => {
    const { fetchImpl } = makeFetchRecorder([
      {
        match: (url, method) => method === "GET" && url.includes("/pulls/42/comments"),
        response: () => makeJsonResponse([
          {
            path: "src/x.ts",
            line: null,
            original_line: null,
            body: "<!-- sonarcloud -->\n**SonarCloud MAJOR — `ts:S1`**\n\nFile-level finding.",
          },
        ]),
      },
    ]);

    const findings = await fetchSonarPrFindings({ context: makeContext(), fetchImpl });
    expect(findings).toEqual([]);
  });

  it("returns an empty array on a 404 (no SonarCloud comments posted yet)", async () => {
    const { fetchImpl } = makeFetchRecorder([
      {
        match: (url, method) => method === "GET" && url.includes("/pulls/42/comments"),
        response: () => makeJsonResponse({ message: "Not Found" }, 404),
      },
    ]);

    const findings = await fetchSonarPrFindings({ context: makeContext(), fetchImpl });
    expect(findings).toEqual([]);
  });

  it("filters out umactually's own re-posted SonarCloud copies (self-reingestion prevention)", async () => {
    const { fetchImpl } = makeFetchRecorder([
      {
        match: (url, method) => method === "GET" && url.includes("/pulls/42/comments"),
        response: () => makeJsonResponse([
          {
            path: "src/cli/init.ts",
            line: 10,
            original_line: 10,
            body: "`major` `sonar`\n\n<!-- sonarcloud -->\n**SonarCloud MAJOR — `typescript:S3358`**\n\nExtract this nested ternary operation.",
          },
          {
            path: "src/cli/init.ts",
            line: 20,
            original_line: 20,
            body: "`major` `sonar`\n`major` `sonar`\n\n<!-- sonarcloud -->\n**SonarCloud MAJOR — `typescript:S5976`**\n\nReplace these 3 tests.",
          },
        ]),
      },
    ]);

    const findings = await fetchSonarPrFindings({ context: makeContext(), fetchImpl });
    expect(findings).toEqual([]);
  });
});