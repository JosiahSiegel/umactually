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
    // findings, not just the model-emitted ones. In-diff SonarCloud
    // findings pass the same uniform `positions.hasPosition` gate as
    // model findings (there is no category-based bypass — GitHub's
    // REST API rejects any inline anchor outside a diff hunk with a
    // 422 that would nuke the whole review).
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

  it("excludes a SonarCloud finding whose path+line is absent from the diff from the POSTed inline comments (off-diff goes to the manifest)", async () => {
    // GitHub's create-review REST endpoint requires every inline comment
    // path+line to sit inside a diff hunk of the given commit; an
    // off-diff anchor makes the whole POST fail atomically with 422
    // (PR #246 head 6988012: 4 of 7 SonarCloud S3776 findings anchored
    // function-declaration lines outside the hunks). Position validation
    // therefore applies to `category: "sonar"` findings uniformly — the
    // dropped finding is NOT lost: it is counted in the body's hidden
    // manifest (`suppressedCount`) via selectOffDiffCommentsWithPositions.
    const capturedBodies: Array<{ body: string; comments: Array<{ path: string; line: number }>; event: string }> = [];
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
                // around lines 1295-1301), so this finding can never be
                // posted as an inline comment on this commit.
                component: "JosiahSiegel_umactually:src/cli/init.ts",
                rule: "typescript:S3776",
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
        capturedBodies.push(body as { body: string; comments: Array<{ path: string; line: number }>; event: string });
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
    expect(result.inlineThreadCount).toBe(0);
    const postedReview = capturedBodies[0];
    expect(postedReview).toBeDefined();
    expect(postedReview?.comments).toHaveLength(0);
    // Off-diff findings don't escalate the verdict (severity counts are
    // computed from the posted set), so the review posts as a neutral
    // COMMENT and the finding is auditable via the manifest's
    // suppressedCount — machine-parseable, not prose.
    expect(postedReview?.event).toBe("COMMENT");
    expect(postedReview?.body).toContain("\"suppressedCount\":1");
  });
});
