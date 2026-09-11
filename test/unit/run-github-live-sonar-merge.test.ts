import { describe, expect, it, vi } from "vitest";

import { runGithubLive } from "../../src/cli/live-github.js";
import { parseCliArgs } from "../../src/cli/parse-args.js";
import type { GithubContext } from "../../src/platform/github/context.js";
import type { FetchImpl } from "../../src/cli/live-shared.js";
import {
  preparePostedReview,
  type LiveProviderOutcome,
  type LiveReview,
  type LiveReviewComment,
} from "../../src/cli/live-shared.js";
import type { ParsedCliArgs } from "../../src/cli/parse-args.js";
import { REVIEW_MARKER } from "../../src/util/marker.js";

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

function makeProviderOutcome(comments: readonly LiveReviewComment[] = []): LiveProviderOutcome {
  return {
    endpoint: "https://provider.example/v1/responses",
    provider: "openai-compatible",
    modelId: "review-model",
    review: {
      summary: "Looks good, ship it.",
      verdict: "SHIP",
      comments,
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
    //
    // Review 5180365033 finding C: this test now also feeds a
    // model-emitted off-diff finding alongside the sonar off-diff
    // finding so the suppressedCount assertion proves the off-diff
    // SUPPRESSED ENTRY's CATEGORY — both `category: "sonar"` and
    // `category: "bug"` paths increment the manifest, not just the
    // sonar one. A former bypass that let sonar findings skip the
    // position gate would have broken this invariant (suppressedCount
    // would have stayed at 1).
    const offDiffModelComment: LiveReviewComment = {
      path: "src/cli/init.ts",
      // Line 7 is OUTSIDE the diff hunk (hunks cover 1295-1301), so this
      // model finding is also off-diff and should be counted in the same
      // suppressedCount bucket as the sonar finding.
      line: 7,
      body: "Model finding anchored outside the diff.",
      severity: "medium",
      category: "bug",
    };
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
      provider: makeProviderOutcome([offDiffModelComment]),
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
    // Finding C: both the `category: "sonar"` finding AND the
    // `category: "bug"` model finding are off-diff, so suppressedCount
    // must reflect BOTH entries — proving the suppressed-entry category
    // attribute is honored on the way through selectPostableComments
    // (a category-based bypass that only let sonar skip the gate would
    // NOT have suppressed the model-emitted one, so this number is the
    // regression lock).
    expect(postedReview?.body).toContain("\"suppressedCount\":2");
  });

  it("preparePostedReview directly returns suppressedCommentCount covering off-diff sonar AND off-diff model findings", () => {
    // Finding 2 producer assertion: the `selectPostableCommentsWithPositions`
    // doc comment claims off-diff sonar findings are routed into the
    // suppressed count by `selectOffDiffCommentsWithPositions`. This test
    // calls the ACTUAL producer (`preparePostedReview`) with one off-diff
    // `category: "sonar"` finding and one off-diff `category: "bug"` model
    // finding, then asserts the returned `suppressedCommentCount` includes
    // both — a direct producer assertion, not only the end-to-end body check.
    const offDiffSonar: LiveReviewComment = {
      path: "src/cli/init.ts",
      // Line 5 is outside the diff hunks (1295-1301).
      line: 5,
      body: "Sonar finding outside the diff.",
      severity: "critical",
      category: "sonar",
    };
    const offDiffModel: LiveReviewComment = {
      path: "src/cli/init.ts",
      // Line 7 is also outside the diff hunks.
      line: 7,
      body: "Model bug outside the diff.",
      severity: "medium",
      category: "bug",
    };
    const review: LiveReview = {
      summary: "Looks good, ship it.",
      verdict: "SHIP",
      comments: [offDiffSonar, offDiffModel],
      suppressedComments: [],
    };

    const prepared = preparePostedReview({
      review,
      provider: "openai-compatible",
      modelId: "review-model",
      diffText: makeDiffText(),
      parsed: baseParsedArgs(),
      secrets: [],
    });

    expect(prepared.postableComments).toHaveLength(0);
    expect(prepared.offDiffFromComments).toHaveLength(2);
    expect(prepared.suppressedCommentCount).toBe(2);
    expect(prepared.body).toContain("\"suppressedCount\":2");
  });

  it("retries the review POST body-only once when GitHub rejects the comments-bearing POST with 422", async () => {
    // Defense in depth behind the uniform position gate: if ANY inline
    // anchor is still rejected (diff drift between fetch and POST,
    // GitHub-side hunk edge cases), a single bad anchor must not nuke
    // the whole review — retry once with `comments: []` so the body
    // (with the manifest + findings summary) still lands.
    const inDiffComment: LiveReviewComment = {
      path: "src/cli/init.ts",
      line: 1296,
      body: "Model finding anchored inside the diff hunk.",
      severity: "high",
      category: "bug",
    };
    const capturedPosts: Array<{ comments: Array<{ path: string; line: number }>; event: string }> = [];
    let postAttempts = 0;
    const fetchImpl: FetchImpl = (url, init) => {
      const method = (init?.method ?? "GET").toUpperCase();
      const urlString = typeof url === "string" ? url : url.toString();
      if (method === "GET" && urlString.endsWith("/pulls/42/reviews")) {
        return Promise.resolve(makeJsonResponse([]));
      }
      if (method === "POST" && urlString.endsWith("/pulls/42/reviews")) {
        postAttempts += 1;
        const rawBody = typeof init?.body === "string" ? init.body : "";
        const body = rawBody === "" ? {} : JSON.parse(rawBody);
        capturedPosts.push(body as { comments: Array<{ path: string; line: number }>; event: string });
        if (postAttempts === 1) {
          return Promise.resolve(
            new Response("Validation Failed: token github-token", { status: 422, headers: { "content-type": "text/plain" } }),
          );
        }
        return Promise.resolve(makeJsonResponse({ id: 8888 }));
      }
      throw new Error(`unexpected ${method} ${urlString}`);
    };
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    try {
      const result = await runGithubLive({
        context: makeContext(),
        diffText: makeDiffText(),
        provider: makeProviderOutcome([inDiffComment]),
        parsed: baseParsedArgs(),
        fetchImpl,
      });

      expect(result.posted).toBe(true);
      expect(result.reviewId).toBe(8888);
      expect(postAttempts).toBe(2);
      expect(capturedPosts[0]?.comments).toHaveLength(1);
      expect(capturedPosts[1]?.comments).toHaveLength(0);
      // Same body+event on the retry — only the comments array is dropped.
      expect(capturedPosts[1]?.event).toBe(capturedPosts[0]?.event);
      const warnings = stderrSpy.mock.calls
        .map((call) => String(call[0]))
        .filter((chunk) => chunk.startsWith("::warning::"));
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("1");
      // Review 5181102069 finding F2(b): the warning carries the original
      // 422 body so the operator can see which anchor/field was rejected,
      // with the token redacted by the post sanitizer.
      expect(warnings[0]).toContain("Rejected body: Validation Failed: token");
      expect(warnings[0]).not.toContain("github-token");
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it("still fails with GITHUB_CREATE_REVIEW_ANCHOR_REJECTED when the body-only retry also returns 422", async () => {
    // The 422 fallback is bounded: one retry, then the original typed
    // failure propagates so the operator sees the typed exit code.
    // Review 5180365033 finding B: the retry-also-422 path uses a distinct
    // typed code (GITHUB_CREATE_REVIEW_ANCHOR_REJECTED) so downstream
    // observers can distinguish anchor-rejection retry-exhaustion from a
    // generic create-review failure.
    const inDiffComment: LiveReviewComment = {
      path: "src/cli/init.ts",
      line: 1296,
      body: "Model finding anchored inside the diff hunk.",
      severity: "high",
      category: "bug",
    };
    let postAttempts = 0;
    const fetchImpl: FetchImpl = (url, init) => {
      const method = (init?.method ?? "GET").toUpperCase();
      const urlString = typeof url === "string" ? url : url.toString();
      if (method === "GET" && urlString.endsWith("/pulls/42/reviews")) {
        return Promise.resolve(makeJsonResponse([]));
      }
      if (method === "POST" && urlString.endsWith("/pulls/42/reviews")) {
        postAttempts += 1;
        return Promise.resolve(
          new Response("Validation Failed", { status: 422, headers: { "content-type": "text/plain" } }),
        );
      }
      throw new Error(`unexpected ${method} ${urlString}`);
    };

    await expect(
      runGithubLive({
        context: makeContext(),
        diffText: makeDiffText(),
        provider: makeProviderOutcome([inDiffComment]),
        parsed: baseParsedArgs(),
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: "GITHUB_CREATE_REVIEW_ANCHOR_REJECTED" });
    expect(postAttempts).toBe(2);
  });

  it("uses GITHUB_CREATE_REVIEW_FAILED when the body-only retry fails with a non-422 status", async () => {
    // Review 5181102069 finding F2(a): the body-only retry is only an
    // anchor rejection when the retry is ITSELF 422. A retry that fails
    // with 401 (or any non-422) is a generic create-review failure and
    // must not be labelled GITHUB_CREATE_REVIEW_ANCHOR_REJECTED.
    const inDiffComment: LiveReviewComment = {
      path: "src/cli/init.ts",
      line: 1296,
      body: "Model finding anchored inside the diff hunk.",
      severity: "high",
      category: "bug",
    };
    let postAttempts = 0;
    const fetchImpl: FetchImpl = (url, init) => {
      const method = (init?.method ?? "GET").toUpperCase();
      const urlString = typeof url === "string" ? url : url.toString();
      if (method === "GET" && urlString.endsWith("/pulls/42/reviews")) {
        return Promise.resolve(makeJsonResponse([]));
      }
      if (method === "POST" && urlString.endsWith("/pulls/42/reviews")) {
        postAttempts += 1;
        return Promise.resolve(
          postAttempts === 1
            ? new Response("Validation Failed", { status: 422, headers: { "content-type": "text/plain" } })
            : new Response("Bad credentials", { status: 401, headers: { "content-type": "text/plain" } }),
        );
      }
      throw new Error(`unexpected ${method} ${urlString}`);
    };
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    try {
      await expect(
        runGithubLive({
          context: makeContext(),
          diffText: makeDiffText(),
          provider: makeProviderOutcome([inDiffComment]),
          parsed: baseParsedArgs(),
          fetchImpl,
        }),
      ).rejects.toMatchObject({ code: "GITHUB_CREATE_REVIEW_FAILED" });
      expect(postAttempts).toBe(2);
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it("does not retry body-only when the first POST fails with a non-422 status", async () => {
    // Review 5181102069 finding F2: the fallback must only trigger on the
    // ORIGINAL comments-bearing POST returning 422. A 401 with comments
    // present throws GITHUB_CREATE_REVIEW_FAILED after exactly one attempt.
    const inDiffComment: LiveReviewComment = {
      path: "src/cli/init.ts",
      line: 1296,
      body: "Model finding anchored inside the diff hunk.",
      severity: "high",
      category: "bug",
    };
    let postAttempts = 0;
    const fetchImpl: FetchImpl = (url, init) => {
      const method = (init?.method ?? "GET").toUpperCase();
      const urlString = typeof url === "string" ? url : url.toString();
      if (method === "GET" && urlString.endsWith("/pulls/42/reviews")) {
        return Promise.resolve(makeJsonResponse([]));
      }
      if (method === "POST" && urlString.endsWith("/pulls/42/reviews")) {
        postAttempts += 1;
        return Promise.resolve(
          new Response("Bad credentials", { status: 401, headers: { "content-type": "text/plain" } }),
        );
      }
      throw new Error(`unexpected ${method} ${urlString}`);
    };

    await expect(
      runGithubLive({
        context: makeContext(),
        diffText: makeDiffText(),
        provider: makeProviderOutcome([inDiffComment]),
        parsed: baseParsedArgs(),
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: "GITHUB_CREATE_REVIEW_FAILED" });
    expect(postAttempts).toBe(1);
  });

  it("uses GITHUB_CREATE_REVIEW_FAILED on the non-retry permanent failure path (no 422-then-422 escalation)", async () => {
    // Locks the negative space of finding B: the typed code on the
    // GITHUB_CREATE_REVIEW_FAILED path stays on permanent failures (no
    // comments array to drop, plain 4xx/5xx). The distinct
    // GITHUB_CREATE_REVIEW_ANCHOR_REJECTED code is reserved for the
    // retry-also-422 escalation so observability can attribute it.
    const inDiffComment: LiveReviewComment = {
      path: "src/cli/init.ts",
      line: 1296,
      body: "Model finding anchored inside the diff hunk.",
      severity: "high",
      category: "bug",
    };
    const fetchImpl: FetchImpl = (url, init) => {
      const method = (init?.method ?? "GET").toUpperCase();
      const urlString = typeof url === "string" ? url : url.toString();
      if (method === "GET" && urlString.endsWith("/pulls/42/reviews")) {
        return Promise.resolve(makeJsonResponse([]));
      }
      if (method === "POST" && urlString.endsWith("/pulls/42/reviews")) {
        return Promise.resolve(
          new Response("Internal Server Error", { status: 500, headers: { "content-type": "text/plain" } }),
        );
      }
      throw new Error(`unexpected ${method} ${urlString}`);
    };

    await expect(
      runGithubLive({
        context: makeContext(),
        diffText: makeDiffText(),
        provider: makeProviderOutcome([inDiffComment]),
        parsed: baseParsedArgs(),
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: "GITHUB_CREATE_REVIEW_FAILED" });
  });

  it("warns and still posts the new review when deleting a submitted marker review fails with 422", async () => {
    // Lock for the PR #246 stale-review scenario: GitHub only allows
    // deleting PENDING reviews, so DELETE on a submitted (CHANGES_REQUESTED)
    // marker review returns 422. The runner warns and continues — the new
    // review on the final head must still be posted.
    const markerReview = { id: 5178288306, body: `${REVIEW_MARKER}\n\nold body`, state: "CHANGES_REQUESTED" };
    let postAttempts = 0;
    const fetchImpl: FetchImpl = (url, init) => {
      const method = (init?.method ?? "GET").toUpperCase();
      const urlString = typeof url === "string" ? url : url.toString();
      if (method === "GET" && urlString.endsWith("/pulls/42/reviews")) {
        return Promise.resolve(makeJsonResponse([markerReview]));
      }
      if (method === "DELETE" && urlString.endsWith("/pulls/42/reviews/5178288306")) {
        return Promise.resolve(
          new Response("Validation Failed", { status: 422, headers: { "content-type": "text/plain" } }),
        );
      }
      if (method === "POST" && urlString.endsWith("/pulls/42/reviews")) {
        postAttempts += 1;
        return Promise.resolve(makeJsonResponse({ id: 9999 }));
      }
      throw new Error(`unexpected ${method} ${urlString}`);
    };
    const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    try {
      const result = await runGithubLive({
        context: makeContext(),
        diffText: makeDiffText(),
        provider: makeProviderOutcome(),
        parsed: baseParsedArgs(),
        fetchImpl,
      });

      expect(result.posted).toBe(true);
      expect(result.reviewId).toBe(9999);
      expect(postAttempts).toBe(1);
      const warnings = stderrSpy.mock.calls
        .map((call) => String(call[0]))
        .filter((chunk) => chunk.startsWith("::warning::"));
      expect(warnings).toHaveLength(1);
    } finally {
      stderrSpy.mockRestore();
    }
  });
});