import { describe, expect, it } from "vitest";

import { runGithubLive } from "../../src/cli/live-github.js";
import { parseCliArgs } from "../../src/cli/parse-args.js";
import type { GithubContext } from "../../src/platform/github/context.js";
import type { FetchImpl } from "../../src/cli/live-shared.js";
import type { LiveProviderOutcome } from "../../src/cli/live-shared.js";
import type { ParsedCliArgs } from "../../src/cli/parse-args.js";

function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeContext(): GithubContext {
  return {
    token: "github-token",
    repo: { owner: "octo-org", name: "octo-repo" },
    prNumber: 42,
    headSha: "1111111111111111111111111111111111111111",
    baseSha: "2222222222222222222222222222222222222222",
    isDraft: false,
    title: "Test PR",
    body: "",
  };
}

function makeDiffText(): string {
  return [
    "diff --git a/src/cli/init.ts b/src/cli/init.ts",
    "index 1111111..2222222 100644",
    "--- a/src/cli/init.ts",
    "+++ b/src/cli/init.ts",
    "@@ -1295,3 +1295,7 @@",
    " export function init(): void {",
    "-  return old();",
    "+  return new();",
    " }",
    "+",
    "+export const sonarTarget = 1298;",
  ].join("\n");
}

function makeProviderOutcome(): LiveProviderOutcome {
  return {
    endpoint: "https://provider.example/v1/responses",
    provider: "openai-compatible",
    modelId: "review-model",
    review: {
      summary: "Looks good, ship it.",
      verdict: "SHIP",
      comments: [],
      suppressedComments: [],
    },
    severityWarnings: [],
    parseWarnings: [],
    verifiedFactsFilter: { kept: [], downgraded: [], downgradeReasons: [] },
    confidenceFilter: { kept: [], downgraded: [], reasons: [] },
  };
}

function baseParsedArgs(overrides: Partial<ParsedCliArgs> = {}): ParsedCliArgs {
  const base = parseCliArgs([
    "--platform", "github",
    "--pr-number", "42",
    "--repo", "octo-org/octo-repo",
    "--api-url", "https://provider.example/v1",
    "--api-key", "test-key",
    "--model", "review-model",
    "--minimum-severity", "medium",
  ]);
  return { ...base, ...overrides };
}

describe("runGithubLive — SonarCloud PR inline comment merge", () => {
  it("merges a SonarCloud MAJOR finding into the review comments when --include-pr-sonar-findings is set", async () => {
    const capturedBodies: Array<{ comments: Array<{ path: string; line: number }>; event: string }> = [];
    const fetchImpl: FetchImpl = (url, init) => {
      const method = (init?.method ?? "GET").toUpperCase();
      const urlString = typeof url === "string" ? url : url.toString();
      if (method === "GET" && urlString.includes("/pulls/42/comments")) {
        return Promise.resolve(
          makeJsonResponse([
            {
              path: "src/cli/init.ts",
              line: 1298,
              original_line: 1298,
              body: "<!-- sonarcloud -->\n**SonarCloud MAJOR — `typescript:S3358`**\n\nExtract this nested ternary operation into an independent statement.\n\n[Open in SonarCloud](https://sonarcloud.io)",
            },
          ]),
        );
      }
      if (method === "GET" && urlString.endsWith("/pulls/42/reviews")) {
        return Promise.resolve(makeJsonResponse([]));
      }
      if (method === "POST" && urlString.endsWith("/pulls/42/reviews")) {
        const rawBody = typeof init?.body === "string" ? init.body : "";
        const body = rawBody === "" ? {} : JSON.parse(rawBody);
        capturedBodies.push(body as { comments: Array<{ path: string; line: number }>; event: string });
        return Promise.resolve(makeJsonResponse({ id: 7777 }));
      }
      throw new Error(`unexpected ${method} ${urlString}`);
    };

    const result = await runGithubLive({
      context: makeContext(),
      diffText: makeDiffText(),
      provider: makeProviderOutcome(),
      parsed: baseParsedArgs({ includePrSonarFindings: true }),
      fetchImpl,
    });

    expect(result.posted).toBe(true);
    const postedReviewBody = capturedBodies[0];
    expect(postedReviewBody).toBeDefined();
    expect(postedReviewBody?.event).toBe("REQUEST_CHANGES");
    expect(postedReviewBody?.comments).toEqual([
      expect.objectContaining({
        path: "src/cli/init.ts",
        line: 1298,
      }),
    ]);
    expect(result.verdict).toBe("NEEDS_FIX");
  });

  it("does NOT fetch SonarCloud comments when --include-pr-sonar-findings is omitted (default)", async () => {
    let sonarCommentsCallCount = 0;
    const fetchImpl: FetchImpl = (url, init) => {
      const method = (init?.method ?? "GET").toUpperCase();
      const urlString = typeof url === "string" ? url : url.toString();
      if (method === "GET" && urlString.includes("/pulls/42/comments")) {
        sonarCommentsCallCount += 1;
        return Promise.resolve(makeJsonResponse([]));
      }
      if (method === "GET" && urlString.endsWith("/pulls/42/reviews")) {
        return Promise.resolve(makeJsonResponse([]));
      }
      if (method === "POST" && urlString.endsWith("/pulls/42/reviews")) {
        return Promise.resolve(makeJsonResponse({ id: 7777 }));
      }
      throw new Error(`unexpected ${method} ${urlString}`);
    };

    await runGithubLive({
      context: makeContext(),
      diffText: makeDiffText(),
      provider: makeProviderOutcome(),
      parsed: baseParsedArgs(), // includePrSonarFindings: false
      fetchImpl,
    });

    expect(sonarCommentsCallCount).toBe(0);
  });
});