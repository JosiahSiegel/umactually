import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseCliArgs } from "../../src/cli.js";
import { runLive } from "../../src/cli/orchestrator.js";

// allow: SIZE_OK — test file with 3 RED cases plus self-contained recorder,
// fixtures, and route builder. Mirror the recorder style in
// run-live-orchestration.test.ts so this file stands alone.
// Production code is NOT touched by this test file.

type RecordedCall = {
  readonly url: string;
  readonly method: string;
  readonly authorization: string;
  readonly body: unknown;
};

type FetchRoute = {
  readonly match: (url: string, method: string) => boolean;
  readonly response: Response;
};

// A small diff with one changed line so PR #42 anchors cleanly. Copied from
// run-live-orchestration.test.ts to keep this file self-contained.

const DIFF_TEXT = [
  "diff --git a/src/review/example.ts b/src/review/example.ts",
  "index 1111111..2222222 100644",
  "--- a/src/review/example.ts",
  "+++ b/src/review/example.ts",
  "@@ -1,4 +1,7 @@",
  " export function renderReview(): string {",
  "-  return \"old\";",
  "+  return \"new\";",
  " }",
  "+",
  "+export const changedLine = true;",
].join("\n");

const EVENT_JSON = JSON.stringify({
  number: 42,
  repository: { full_name: "octo-org/octo-repo" },
  pull_request: {
    number: 42,
    title: "Live review",
    body: "Exercise live review path.",
    draft: false,
    base: { sha: "2222222222222222222222222222222222222222", ref: "main" },
    head: { sha: "1111111111111111111111111111111111111111", ref: "feature/live" },
  },
});

const MARKER_REVIEW_BODY = `<!-- umactually-pr-review -->\n\nold summary\n\nauto (openai-compatible)\n\nFindings: 0 inline, 0 suppressed.`;

function makeJsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeFetchRecorder(routes: readonly FetchRoute[]): {
  readonly calls: readonly RecordedCall[];
  readonly fetchImpl: typeof fetch;
} {
  /** Test fetch recorder; mutation is the purpose of this fixture. */
  const calls: RecordedCall[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    const authorization = headers.get("authorization") ?? "";
    const rawBody = init?.body;
    const body = typeof rawBody === "string" ? parseJson(rawBody) : null;
    calls.push({ url, method, authorization, body });
    for (const route of routes) {
      if (route.match(url, method)) {
        return route.response;
      }
    }
    throw new Error(`unexpected ${method} ${url}`);
  };
  return { calls, fetchImpl };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return text;
    }
    throw error;
  }
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new TypeError(`${label} must be an object`);
}

function githubEnv(eventPath: string): NodeJS.ProcessEnv {
  return {
    GITHUB_ACTIONS: "true",
    GITHUB_TOKEN: "github-token-secret",
    GITHUB_REPOSITORY: "octo-org/octo-repo",
    GITHUB_EVENT_PATH: eventPath,
    UMACTUALLY_API_URL: "https://provider.example/v1",
    UMACTUALLY_API_KEY: "provider-key-secret",
    UMACTUALLY_MODEL: "review-model-synthetic",
  } satisfies NodeJS.ProcessEnv;
}

type GithubStatefulReviewRouteOptions = {
  readonly existingReviewId: number;
  readonly existingReviewState: "PENDING" | "COMMENTED" | "APPROVED" | "CHANGES_REQUESTED" | "DISMISSED";
  readonly putResponse: Response;
  readonly deleteResponse: Response;
  readonly postResponse: Response;
};

// Local route builder mirroring `githubRoutesWithExistingMarkerReview`
// (test/unit/run-live-orchestration.test.ts:156-191) but surfacing `state`
// on the existing review so tests can exercise the state filter.
function githubRoutesWithStatefulMarkerReview(
  providerBody: string,
  options: GithubStatefulReviewRouteOptions,
): readonly FetchRoute[] {
  return [
    {
      match: (url, method) => method === "GET" && url.endsWith("/pulls/42"),
      response: new Response(DIFF_TEXT, { status: 200 }),
    },
    {
      match: (url, method) => method === "POST" && url === "https://provider.example/v1/responses",
      response: makeJsonResponse({ output_text: providerBody }),
    },
    {
      match: (url, method) => method === "GET" && url.endsWith("/pulls/42/reviews"),
      response: makeJsonResponse([
        {
          id: options.existingReviewId,
          body: MARKER_REVIEW_BODY,
          state: options.existingReviewState,
        },
      ]),
    },
    {
      match: (url, method) =>
        method === "PUT" &&
        url === `https://api.github.com/repos/octo-org/octo-repo/pulls/42/reviews/${options.existingReviewId}`,
      response: options.putResponse,
    },
    {
      match: (url, method) =>
        method === "DELETE" &&
        url === `https://api.github.com/repos/octo-org/octo-repo/pulls/42/reviews/${options.existingReviewId}`,
      response: options.deleteResponse,
    },
    {
      match: (url, method) => method === "POST" && url.endsWith("/pulls/42/reviews"),
      response: options.postResponse,
    },
  ];
}

const EMPTY_PROVIDER_REVIEW = JSON.stringify({
  summary: "x",
  verdict: "COMMENT",
  comments: [],
  suppressed_comments: [],
});

describe("runLive GitHub marker-review state filter", () => {
  let workspace = "";

  afterEach(async () => {
    if (workspace.length > 0) {
      await rm(workspace, { recursive: true, force: true });
      workspace = "";
    }
  });

  it("S7-RED-008: skips a DISMISSED marker review and POSTs a fresh one (not PUT)", async () => {
    // Given: an existing marker review on PR #42 with state=DISMISSED. The live provider returns
    // an empty payload (0 inline comments), so today the code would try PUT /reviews/5555. PUT is
    // meaningless on a DISMISSED review (it never reactivates) and the marker body never gets
    // replaced. The correct behavior is to skip the dismissed entry and POST a new one.
    workspace = await mkdtemp(join(tmpdir(), "umactually-live-state-dismissed-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, EVENT_JSON, "utf8");
    const recorder = makeFetchRecorder(
      githubRoutesWithStatefulMarkerReview(EMPTY_PROVIDER_REVIEW, {
        existingReviewId: 5555,
        existingReviewState: "DISMISSED",
        putResponse: new Response(null, { status: 200 }),
        deleteResponse: new Response(null, { status: 204 }),
        postResponse: makeJsonResponse({ id: 9001, body: "" }, 201),
      }),
    );

    // When: live orchestration runs.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "github", "--no-dry-run"]),
      cwd: workspace,
      env: githubEnv(eventPath),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: NO PUT and NO DELETE to the dismissed review — it is treated as if it did not exist.
    const reviewIdSegment = "/reviews/5555";
    const putsToDismissed = recorder.calls.filter(
      (call) => call.method === "PUT" && call.url.endsWith(reviewIdSegment),
    );
    expect(putsToDismissed, "PUT must NOT be issued for a DISMISSED marker review").toHaveLength(0);
    const deletesToDismissed = recorder.calls.filter(
      (call) => call.method === "DELETE" && call.url.endsWith(reviewIdSegment),
    );
    expect(deletesToDismissed, "DELETE must NOT be issued for a DISMISSED marker review").toHaveLength(0);

    // Then: ONE POST creates a new marker review, and the result reports a freshly posted review.
    const reviewPosts = recorder.calls.filter(
      (call) => call.method === "POST" && call.url.endsWith("/pulls/42/reviews"),
    );
    expect(reviewPosts, "exactly one POST /pulls/42/reviews is expected").toHaveLength(1);
    const postBody = readRecord(reviewPosts[0]!.body as Record<string, unknown>, "review request");
    expect(postBody["body"]).toContain("<!-- umactually-pr-review -->");
    expect(result.exitCode).toBe(0);
    expect(result.posted).toBe(true);
    expect(result.reviewId).toBe(9001);
    expect(result.message).toBe("posted GitHub review");
  });

  it("S7-RED-009: PENDING marker review with 0 inline comments still triggers PUT (regression baseline)", async () => {
    // Given: an existing marker review with state=PENDING — the only state on which PUT is valid.
    // Provider returns empty so postable comments = 0.
    workspace = await mkdtemp(join(tmpdir(), "umactually-live-state-pending-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, EVENT_JSON, "utf8");
    const recorder = makeFetchRecorder(
      githubRoutesWithStatefulMarkerReview(EMPTY_PROVIDER_REVIEW, {
        existingReviewId: 6666,
        existingReviewState: "PENDING",
        putResponse: new Response(null, { status: 200 }),
        deleteResponse: new Response(null, { status: 204 }),
        postResponse: makeJsonResponse({ id: 9001, body: "" }, 201),
      }),
    );

    // When: live orchestration runs.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "github", "--no-dry-run"]),
      cwd: workspace,
      env: githubEnv(eventPath),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: ONE PUT updates the existing review — no DELETE, no new POST.
    expect(result.exitCode).toBe(0);
    expect(result.posted).toBe(true);
    expect(result.reviewId).toBe(6666);
    expect(result.message).toBe("updated existing GitHub review");
    const puts = recorder.calls.filter(
      (call) => call.method === "PUT" && call.url.endsWith("/reviews/6666"),
    );
    expect(puts, "exactly one PUT to the PENDING marker review is expected").toHaveLength(1);
    const deletes = recorder.calls.filter(
      (call) => call.method === "DELETE" && call.url.endsWith("/reviews/6666"),
    );
    expect(deletes, "DELETE must NOT be issued for a PENDING marker review").toHaveLength(0);
    const reviewPosts = recorder.calls.filter(
      (call) => call.method === "POST" && call.url.endsWith("/pulls/42/reviews"),
    );
    expect(reviewPosts, "no new POST is expected when the PENDING review was PUT-updated").toHaveLength(0);
  });

  it("S7-RED-010: COMMENTED marker review with 0 inline comments falls through to DELETE+POST (no 422-throw)", async () => {
    // Given: an existing marker review on PR #42 with state=COMMENTED (already submitted —
    // the typical state at the start of a re-run). The provider returns an empty payload.
    // PUT against a COMMENTED review is rejected by GitHub with 422 Validation Failed —
    // the stub below returns 422 to mirror that. The correct behavior is to fall through
    // to DELETE+POST.
    workspace = await mkdtemp(join(tmpdir(), "umactually-live-state-commented-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, EVENT_JSON, "utf8");
    const recorder = makeFetchRecorder(
      githubRoutesWithStatefulMarkerReview(EMPTY_PROVIDER_REVIEW, {
        existingReviewId: 7777,
        existingReviewState: "COMMENTED",
        // GitHub "Validation Failed" — body is text, not JSON, mirroring the actual API response on a submitted review PUT.
        putResponse: new Response("Validation Failed", {
          status: 422,
          headers: { "content-type": "text/plain" },
        }),
        deleteResponse: new Response(null, { status: 204 }),
        postResponse: makeJsonResponse({ id: 9002, body: "" }, 201),
      }),
    );

    // When: live orchestration runs.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "github", "--no-dry-run"]),
      cwd: workspace,
      env: githubEnv(eventPath),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: the PUT is NEVER attempted on a COMMENTED marker review — the state filter
    // short-circuits to DELETE+POST before any PUT is sent. The fix must skip PUT,
    // not just recover from its 422.
    const putsToCommented = recorder.calls.filter(
      (call) => call.method === "PUT" && call.url.endsWith("/reviews/7777"),
    );
    expect(putsToCommented, "PUT must NOT be issued for a COMMENTED marker review").toHaveLength(0);

    // Then: exactly one DELETE and one POST.
    const deletes = recorder.calls.filter(
      (call) => call.method === "DELETE" && call.url.endsWith("/reviews/7777"),
    );
    expect(deletes, "DELETE must be issued to clear the COMMENTED marker review").toHaveLength(1);
    const reviewPosts = recorder.calls.filter(
      (call) => call.method === "POST" && call.url.endsWith("/pulls/42/reviews"),
    );
    expect(reviewPosts, "exactly one POST /pulls/42/reviews is expected").toHaveLength(1);

    // Then: the result reflects a clean replacement and the new id is reported.
    expect(result.exitCode).toBe(0);
    expect(result.posted).toBe(true);
    expect(result.reviewId).toBe(9002);
    expect(result.message).toBe("replaced existing GitHub review");
  });
});