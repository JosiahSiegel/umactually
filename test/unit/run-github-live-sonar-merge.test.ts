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

const SONAR_ISSUES_URL_FRAGMENT = "/api/issues/search";

function makeSonarIssuesResponse(): Response {
  return makeJsonResponse({
    total: 2,
    issues: [
      {
        component: "JosiahSiegel_umactually:src/cli/init.ts",
        rule: "typescript:S3358",
        line: 1298,
        severity: "MAJOR",
        message: "Extract this nested ternary operation into an independent statement.",
      },
      {
        component: "JosiahSiegel_umactually:src/cli/init.ts",
        rule: "typescript:S3776",
        line: 1296,
        severity: "CRITICAL",
        message: "Reduce cognitive complexity of init().",
      },
    ],
  });
}

describe("runGithubLive — SonarCloud PR issues merge", () => {
  it("merges SonarCloud issues into the review comments when --include-pr-sonar-findings is set + sonar config present", async () => {
    const capturedBodies: Array<{ comments: Array<{ path: string; line: number; body: string }>; event: string }> = [];
    const fetchImpl: FetchImpl = (url, init) => {
      const method = (init?.method ?? "GET").toUpperCase();
      const urlString = typeof url === "string" ? url : url.toString();
      if (method === "GET" && urlString.includes(SONAR_ISSUES_URL_FRAGMENT) && urlString.includes("pullRequest=42")) {
        return Promise.resolve(makeSonarIssuesResponse());
      }
      if (method === "GET" && urlString.endsWith("/pulls/42/reviews")) {
        return Promise.resolve(makeJsonResponse([]));
      }
      if (method === "POST" && urlString.endsWith("/pulls/42/reviews")) {
        const rawBody = typeof init?.body === "string" ? init.body : "";
        const body = rawBody === "" ? {} : JSON.parse(rawBody);
        capturedBodies.push(body as { comments: Array<{ path: string; line: number; body: string }>; event: string });
        return Promise.resolve(makeJsonResponse({ id: 7777 }));
      }
      throw new Error(`unexpected ${method} ${urlString}`);
    };

    const result = await runGithubLive({
      context: makeContext(),
      diffText: makeDiffText(),
      provider: makeProviderOutcome(),
      parsed: baseParsedArgs({
        includePrSonarFindings: true,
        sonarHostUrl: "https://sonarcloud.io",
        sonarToken: "test-sonar-token",
        sonarProjectKey: "JosiahSiegel_umactually",
      }),
      fetchImpl,
    });

    expect(result.posted).toBe(true);
    const postedReviewBody = capturedBodies[0];
    expect(postedReviewBody).toBeDefined();
    expect(postedReviewBody?.event).toBe("REQUEST_CHANGES");
    // The merged SonarCloud findings should appear as inline comments on the
    // bot's review. Both findings have line numbers present in the diff
    // context, so they pass position validation and reach the postable set.
    expect(postedReviewBody?.comments).toHaveLength(2);
    expect(postedReviewBody?.comments[0]?.path).toBe("src/cli/init.ts");
    expect(postedReviewBody?.comments[0]?.line).toBe(1298);
    expect(postedReviewBody?.comments[1]?.line).toBe(1296);
    expect(postedReviewBody?.comments[0]?.body).toContain("**SonarCloud MAJOR — `typescript:S3358`**");
    expect(postedReviewBody?.comments[1]?.body).toContain("**SonarCloud CRITICAL — `typescript:S3776`**");
    // CRITICAL + MAJOR postable findings escalate the verdict from SHIP to
    // NEEDS_FIX (PR #183 reconciliation) so the PR can't be merged with
    // open SonarCloud findings.
    expect(result.verdict).toBe("NEEDS_FIX");
    // Regression lock for the "0 inline findings — ship it" bug: the
    // returned inlineThreadCount must include the merged SonarCloud
    // findings, not just the model-emitted ones. Before the position-
    // validation bypass for `category: "sonar"`, this would have been 0
    // because SonarCloud line numbers don't always match the diff.
    expect(result.inlineThreadCount).toBe(2);
  });

  it("does NOT fetch SonarCloud issues when --include-pr-sonar-findings is omitted (default)", async () => {
    let sonarIssuesCallCount = 0;
    const fetchImpl: FetchImpl = (url, init) => {
      const method = (init?.method ?? "GET").toUpperCase();
      const urlString = typeof url === "string" ? url : url.toString();
      if (method === "GET" && urlString.includes(SONAR_ISSUES_URL_FRAGMENT)) {
        sonarIssuesCallCount += 1;
        return Promise.resolve(makeJsonResponse({ total: 0, issues: [] }));
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

    expect(sonarIssuesCallCount).toBe(0);
  });

  it("skips the SonarCloud fetch when --include-pr-sonar-findings is set but sonar credentials are missing", async () => {
    let sonarIssuesCallCount = 0;
    const fetchImpl: FetchImpl = (url, init) => {
      const method = (init?.method ?? "GET").toUpperCase();
      const urlString = typeof url === "string" ? url : url.toString();
      if (method === "GET" && urlString.includes(SONAR_ISSUES_URL_FRAGMENT)) {
        sonarIssuesCallCount += 1;
        return Promise.resolve(makeJsonResponse({ total: 0, issues: [] }));
      }
      if (method === "GET" && urlString.endsWith("/pulls/42/reviews")) {
        return Promise.resolve(makeJsonResponse([]));
      }
      if (method === "POST" && urlString.endsWith("/pulls/42/reviews")) {
        return Promise.resolve(makeJsonResponse({ id: 7777 }));
      }
      throw new Error(`unexpected ${method} ${urlString}`);
    };

    const result = await runGithubLive({
      context: makeContext(),
      diffText: makeDiffText(),
      provider: makeProviderOutcome(),
      parsed: baseParsedArgs({ includePrSonarFindings: true }), // no sonarHostUrl/Token/ProjectKey
      fetchImpl,
    });

    // No call should reach the SonarCloud API when the config is missing —
    // we degrade to zero findings without surfacing the missing-config
    // condition as a network error to the bot review.
    expect(sonarIssuesCallCount).toBe(0);
    expect(result.posted).toBe(true);
    expect(result.inlineThreadCount).toBe(0);
  });

  it("includes a merged SonarCloud finding even when its line is outside the diff context (position-validation bypass)", async () => {
    // Regression for the symptom-image bug: the green box said
    // "0 inline findings — ship it" while two sonar threads were
    // actually posted under the same review. The cause was that
    // `selectPostableCommentsWithPositions` dropped SonarCloud
    // findings whose reported line numbers fell outside the diff's
    // context. After the position-validation bypass for `category:
    // "sonar"`, a finding on an unchanged file line still reaches the
    // postable set — SonarCloud's line numbers are authoritative for
    // the file, not the diff.
    const capturedBodies: Array<{ comments: Array<{ path: string; line: number }> }> = [];
    const fetchImpl: FetchImpl = (url, init) => {
      const method = (init?.method ?? "GET").toUpperCase();
      const urlString = typeof url === "string" ? url : url.toString();
      if (method === "GET" && urlString.includes(SONAR_ISSUES_URL_FRAGMENT)) {
        return Promise.resolve(
          makeJsonResponse({
            total: 1,
            issues: [
              {
                // Line 5 is NOT touched by the diff (the diff's hunks are
                // around lines 1296-1301). Before the fix, this finding
                // would have been dropped by `positions.hasPosition`.
                component: "JosiahSiegel_umactually:src/cli/init.ts",
                rule: "typescript:S9999",
                line: 5,
                severity: "CRITICAL",
                message: "Critical issue on a line outside the diff context.",
              },
            ],
          }),
        );
      }
      if (method === "GET" && urlString.endsWith("/pulls/42/reviews")) {
        return Promise.resolve(makeJsonResponse([]));
      }
      if (method === "POST" && urlString.endsWith("/pulls/42/reviews")) {
        const rawBody = typeof init?.body === "string" ? init.body : "";
        const body = rawBody === "" ? {} : JSON.parse(rawBody);
        capturedBodies.push(body as { comments: Array<{ path: string; line: number }> });
        return Promise.resolve(makeJsonResponse({ id: 7777 }));
      }
      throw new Error(`unexpected ${method} ${urlString}`);
    };

    const result = await runGithubLive({
      context: makeContext(),
      diffText: makeDiffText(),
      provider: makeProviderOutcome(),
      parsed: baseParsedArgs({
        includePrSonarFindings: true,
        sonarHostUrl: "https://sonarcloud.io",
        sonarToken: "test-sonar-token",
        sonarProjectKey: "JosiahSiegel_umactually",
      }),
      fetchImpl,
    });

    expect(result.inlineThreadCount).toBe(1);
    expect(capturedBodies[0]?.comments[0]?.line).toBe(5);
  });
});