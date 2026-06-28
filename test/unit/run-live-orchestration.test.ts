import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { parseCliArgs } from "../../src/cli.js";
import { runLive } from "../../src/cli/orchestrator.js";

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

const PROVIDER_REVIEW = JSON.stringify({
  summary: "One valid inline finding.",
  verdict: "NEEDS_FIX",
  comments: [
    {
      path: "src/review/example.ts",
      line: 3,
      body: "Tighten this changed line.",
      severity: "high",
      category: "correctness",
    },
  ],
  suppressed_comments: [],
});

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

function readArray(value: unknown, label: string): readonly unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  throw new TypeError(`${label} must be an array`);
}

function githubRoutes(providerBody: string): readonly FetchRoute[] {
  return [
    {
      match: (url, method) => method === "GET" && url.endsWith("/pulls/42/files"),
      response: new Response(DIFF_TEXT, { status: 200 }),
    },
    {
      match: (url, method) => method === "POST" && url === "https://provider.example/v1/responses",
      response: makeJsonResponse({ output_text: providerBody }),
    },
    {
      match: (url, method) => method === "GET" && url.endsWith("/pulls/42/reviews"),
      response: makeJsonResponse([]),
    },
    {
      match: (url, method) => method === "POST" && url.endsWith("/pulls/42/reviews"),
      response: makeJsonResponse({ id: 9001, body: "Bearer github-token-secret must stay private" }, 201),
    },
  ];
}

const EXISTING_MARKER_REVIEW_BODY = `<!-- umactually-pr-review -->

old summary

auto (openai-compatible)

Findings: 0 inline, 0 suppressed.`;

type GithubExistingReviewRouteOptions = {
  readonly existingReviewId: number;
  readonly deleteResponse: Response;
  readonly postResponse: Response;
  readonly putResponse?: Response;
};

function githubRoutesWithExistingMarkerReview(
  providerBody: string,
  options: GithubExistingReviewRouteOptions,
): readonly FetchRoute[] {
  return [
    {
      match: (url, method) => method === "GET" && url.endsWith("/pulls/42/files"),
      response: new Response(DIFF_TEXT, { status: 200 }),
    },
    {
      match: (url, method) => method === "POST" && url === "https://provider.example/v1/responses",
      response: makeJsonResponse({ output_text: providerBody }),
    },
    {
      match: (url, method) => method === "GET" && url.endsWith("/pulls/42/reviews"),
      response: makeJsonResponse([
        { id: options.existingReviewId, body: EXISTING_MARKER_REVIEW_BODY },
      ]),
    },
    {
      match: (url, method) =>
        method === "PUT" &&
        url === `https://api.github.com/repos/octo-org/octo-repo/pulls/42/reviews/${options.existingReviewId}`,
      response: options.putResponse ?? new Response(null, { status: 200 }),
    },
    {
      match: (url, method) =>
        method === "DELETE" && url === `https://api.github.com/repos/octo-org/octo-repo/pulls/42/reviews/${options.existingReviewId}`,
      response: options.deleteResponse,
    },
    {
      match: (url, method) => method === "POST" && url.endsWith("/pulls/42/reviews"),
      response: options.postResponse,
    },
  ];
}

describe("runLive GitHub orchestration", () => {
  let workspace = "";

  afterEach(async () => {
    if (workspace.length > 0) {
      await rm(workspace, { recursive: true, force: true });
      workspace = "";
    }
  });

  it("returns exit 1 with a redacted error when no provider URL is set", async () => {
    // Given: a GitHub Actions live environment with an API key but no provider URL.
    workspace = await mkdtemp(join(tmpdir(), "umactually-live-missing-url-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, EVENT_JSON, "utf8");
    const env = {
      GITHUB_ACTIONS: "true",
      GITHUB_TOKEN: "github-token-secret",
      GITHUB_REPOSITORY: "octo-org/octo-repo",
      GITHUB_EVENT_PATH: eventPath,
      UMACTUALLY_API_KEY: "provider-key-secret",
    } satisfies NodeJS.ProcessEnv;

    // When: live orchestration starts.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "github", "--no-dry-run"]),
      cwd: workspace,
      env,
      fetchImpl: makeFetchRecorder([]).fetchImpl,
    });

    // Then: the live path fails safely without echoing secrets.
    expect(result.exitCode).toBe(1);
    expect(result.posted).toBe(false);
    expect(result.message).toContain("UMACTUALLY_API_URL");
    expect(result.message).not.toContain("provider-key-secret");
    expect(result.message).not.toContain("github-token-secret");
  });

  it("posts a safe fallback summary when the provider returns malformed JSON", async () => {
    // Given: provider output that cannot be parsed as the review schema.
    workspace = await mkdtemp(join(tmpdir(), "umactually-live-malformed-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, EVENT_JSON, "utf8");
    const recorder = makeFetchRecorder(githubRoutes("RAW_PROVIDER_JSON_SHOULD_NOT_POST"));

    // When: live orchestration runs against GitHub.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "github", "--no-dry-run"]),
      cwd: workspace,
      env: githubEnv(eventPath),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: it still posts one marker review, but never publishes raw provider text.
    expect(result.exitCode).toBe(0);
    expect(result.posted).toBe(true);
    const postCall = findCall(recorder.calls, "POST", "/pulls/42/reviews");
    const body = readRecord(postCall.body as Record<string, unknown>, "review request");
    expect(body["body"]).toContain("<!-- umactually-pr-review -->");
    expect(body["body"]).toContain("Provider response did not contain a valid JSON review payload.");
    expect(body["body"]).not.toContain("RAW_PROVIDER_JSON_SHOULD_NOT_POST");
    expect(readArray(body["comments"], "review comments")).toHaveLength(0);
  });

  it("posts a GitHub pull request review with marker body and valid inline comments", async () => {
    // Given: provider JSON with one finding anchored to a real diff line.
    workspace = await mkdtemp(join(tmpdir(), "umactually-live-post-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, EVENT_JSON, "utf8");
    const recorder = makeFetchRecorder(githubRoutes(PROVIDER_REVIEW));

    // When: the live GitHub path posts the review.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "github", "--no-dry-run"]),
      cwd: workspace,
      env: githubEnv(eventPath),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: the Pull Request Review API receives the marker body and inline comment.
    expect(result).toMatchObject({ exitCode: 0, posted: true, reviewId: 9001 });
    const postCall = findCall(recorder.calls, "POST", "/pulls/42/reviews");
    const body = readRecord(postCall.body as Record<string, unknown>, "review request");
    expect(body["event"]).toBe("REQUEST_CHANGES");
    expect(body["commit_id"]).toBe("1111111111111111111111111111111111111111");
    expect(body["body"]).toContain("<!-- umactually-pr-review -->");
    expect(body["body"]).toContain("One valid inline finding.");
    const comments = readArray(body["comments"], "review comments");
    expect(comments).toHaveLength(1);
    expect(comments[0]).toEqual({
      path: "src/review/example.ts",
      line: 3,
      side: "RIGHT",
      body: "**high correctness**\n\nTighten this changed line.",
    });
  });

  it("keeps response bodies and Authorization secrets out of posted review text", async () => {
    // Given: provider content tries to reflect auth-shaped secrets into summary and comments.
    workspace = await mkdtemp(join(tmpdir(), "umactually-live-sanitize-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, EVENT_JSON, "utf8");
    const poisonedReview = JSON.stringify({
      summary: "Authorization: Bearer provider-key-secret should not appear.",
      verdict: "COMMENT",
      comments: [
        {
          path: "src/review/example.ts",
          line: 3,
          body: "Do not echo Bearer github-token-secret or provider-key-secret.",
          severity: "medium",
          category: "security",
        },
      ],
      suppressed_comments: [],
    });
    const recorder = makeFetchRecorder(githubRoutes(poisonedReview));

    // When: the review is posted.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "github", "--no-dry-run"]),
      cwd: workspace,
      env: githubEnv(eventPath),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: neither posted body nor inline comments contain auth material.
    expect(result.exitCode).toBe(0);
    const postCall = findCall(recorder.calls, "POST", "/pulls/42/reviews");
    const body = readRecord(postCall.body as Record<string, unknown>, "review request");
    const postedText = JSON.stringify(body);
    expect(postedText).not.toContain("provider-key-secret");
    expect(postedText).not.toContain("github-token-secret");
    expect(postedText).not.toContain("Authorization:");
    expect(postedText).not.toContain("Bearer ");
  });

  it("replaces an empty provider result with the deterministic fixture when --simulate-findings is set", async () => {
    // Given: the provider returns a structurally empty review (no comments, no suppressed_comments).
    workspace = await mkdtemp(join(tmpdir(), "umactually-live-simulate-replace-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, EVENT_JSON, "utf8");
    const emptyReview = JSON.stringify({
      summary: "Live provider returned an empty payload.",
      verdict: "COMMENT",
      comments: [],
      suppressed_comments: [],
    });
    const recorder = makeFetchRecorder(githubRoutes(emptyReview));

    // When: --simulate-findings is set on the live path.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "github", "--no-dry-run", "--simulate-findings"]),
      cwd: workspace,
      env: githubEnv(eventPath),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: the post is successful and the body carries the marker.
    expect(result.exitCode).toBe(0);
    expect(result.posted).toBe(true);
    const postCall = findCall(recorder.calls, "POST", "/pulls/42/reviews");
    const body = readRecord(postCall.body as Record<string, unknown>, "review request");
    expect(body["body"]).toContain("<!-- umactually-pr-review -->");

    // Then: the posted comments include the deterministic fixture findings (4-6 inline threads).
    const comments = readArray(body["comments"], "review comments");
    expect(comments.length).toBeGreaterThanOrEqual(4);
    expect(comments.length).toBeLessThanOrEqual(6);

    // Then: the simulated summary replaces the live "empty" summary.
    expect(body["body"]).toContain("Simulated review for octo-org/octo-repo#42");

    // Then: the posted body MUST NOT contain raw provider JSON, the API key,
    // or a fenced details block (the marker is appended by the posting layer,
    // not by the fixture itself).
    const postedText = JSON.stringify(body);
    expect(postedText).not.toContain("provider-key-secret");
    expect(postedText).not.toContain("github-token-secret");
    expect(postedText).not.toContain("RAW_PROVIDER_JSON");
    expect(postedText).not.toMatch(/<details[\s>]/u);
  });

  it("FORCES the deterministic fixture when --simulate-findings is set, even when the live provider returned real findings", async () => {
    // Given: the live provider returns a non-empty review (real findings).
    workspace = await mkdtemp(join(tmpdir(), "umactually-live-simulate-overrides-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, EVENT_JSON, "utf8");
    const recorder = makeFetchRecorder(githubRoutes(PROVIDER_REVIEW));

    // When: --simulate-findings is set. The flag is authoritative — it must
    // drive the posted review regardless of what the live provider returned.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "github", "--no-dry-run", "--simulate-findings"]),
      cwd: workspace,
      env: githubEnv(eventPath),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: the post is successful and the body carries the marker.
    expect(result.exitCode).toBe(0);
    expect(result.posted).toBe(true);
    const postCall = findCall(recorder.calls, "POST", "/pulls/42/reviews");
    const body = readRecord(postCall.body as Record<string, unknown>, "review request");
    expect(body["body"]).toContain("<!-- umactually-pr-review -->");

    // Then: the posted body uses the simulated summary, NOT the live provider summary.
    expect(body["body"]).toContain("Simulated review for octo-org/octo-repo#42");
    expect(body["body"]).not.toContain("One valid inline finding.");

    // Then: 4-6 inline threads from the deterministic fixture are posted.
    const comments = readArray(body["comments"], "review comments");
    expect(comments.length).toBeGreaterThanOrEqual(4);
    expect(comments.length).toBeLessThanOrEqual(6);

    // Then: the provider label in the body still reads "openai-compatible"
    // (the fixture does not mint its own provider identity).
    expect(body["body"]).toContain("openai-compatible");

    // Then: the posted body MUST NOT contain raw provider JSON, the API key,
    // or a fenced details block.
    const postedText = JSON.stringify(body);
    expect(postedText).not.toContain("provider-key-secret");
    expect(postedText).not.toContain("github-token-secret");
    expect(postedText).not.toMatch(/<details[\s>]/u);
  });

  it("does NOT replace when --simulate-findings is false (default)", async () => {
    // Given: the provider returns an empty review and simulate-findings is off.
    workspace = await mkdtemp(join(tmpdir(), "umactually-live-simulate-off-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, EVENT_JSON, "utf8");
    const emptyReview = JSON.stringify({
      summary: "Live provider returned an empty payload.",
      verdict: "COMMENT",
      comments: [],
      suppressed_comments: [],
    });
    const recorder = makeFetchRecorder(githubRoutes(emptyReview));

    // When: live orchestration runs without the simulate-findings flag.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "github", "--no-dry-run"]),
      cwd: workspace,
      env: githubEnv(eventPath),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: the live empty payload is honored — no simulated findings appear.
    expect(result.exitCode).toBe(0);
    expect(result.posted).toBe(true);
    const postCall = findCall(recorder.calls, "POST", "/pulls/42/reviews");
    const body = readRecord(postCall.body as Record<string, unknown>, "review request");
    const comments = readArray(body["comments"], "review comments");
    expect(comments).toHaveLength(0);
    expect(body["body"]).not.toContain("Simulated review for");
  });

  it("updates the existing marker review in-place via PUT when the new payload has no inline comments", async () => {
    // Given: a marker review already exists on PR #42 and the provider returned an empty payload.
    workspace = await mkdtemp(join(tmpdir(), "umactually-live-existing-put-only-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, EVENT_JSON, "utf8");
    const emptyReview = JSON.stringify({
      summary: "Live provider returned an empty payload.",
      verdict: "COMMENT",
      comments: [],
      suppressed_comments: [],
    });
    const recorder = makeFetchRecorder(
      githubRoutesWithExistingMarkerReview(emptyReview, {
        existingReviewId: 4242,
        deleteResponse: new Response(null, { status: 204 }),
        postResponse: makeJsonResponse({ id: 9001, body: "" }, 201),
      }),
    );

    // When: live orchestration runs (simulate-findings is OFF so no fixture is injected).
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "github", "--no-dry-run"]),
      cwd: workspace,
      env: githubEnv(eventPath),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: it issues a single PUT to update the existing review body — no DELETE, no new POST.
    expect(result.exitCode).toBe(0);
    expect(result.posted).toBe(true);
    expect(result.reviewId).toBe(4242);
    expect(result.message).toBe("updated existing GitHub review");
    const methods = recorder.calls.map((call) => `${call.method} ${call.url}`);
    expect(methods).toContain("PUT https://api.github.com/repos/octo-org/octo-repo/pulls/42/reviews/4242");
    expect(methods.some((m) => m.startsWith("DELETE "))).toBe(false);
    expect(methods.filter((m) => m.startsWith("POST ")).filter((m) => m.endsWith("/pulls/42/reviews"))).toHaveLength(0);
  });

  it("DELETEs the existing marker review then POSTs a new review with inline comments", async () => {
    // Given: a marker review already exists and the new payload has 1+ inline comments.
    workspace = await mkdtemp(join(tmpdir(), "umactually-live-existing-replace-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, EVENT_JSON, "utf8");
    const recorder = makeFetchRecorder(
      githubRoutesWithExistingMarkerReview(PROVIDER_REVIEW, {
        existingReviewId: 4242,
        deleteResponse: new Response(null, { status: 204 }),
        postResponse: makeJsonResponse({ id: 9002, body: "" }, 201),
      }),
    );

    // When: live orchestration runs with a non-empty provider payload.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "github", "--no-dry-run"]),
      cwd: workspace,
      env: githubEnv(eventPath),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: the existing review is deleted and a new review with inline threads is posted.
    expect(result.exitCode).toBe(0);
    expect(result.posted).toBe(true);
    expect(result.reviewId).toBe(9002);
    expect(result.message).toBe("replaced existing GitHub review");
    const reviewPosts = recorder.calls.filter(
      (call) => call.method === "POST" && call.url.endsWith("/pulls/42/reviews"),
    );
    expect(reviewPosts).toHaveLength(1);
    const postBody = readRecord(reviewPosts[0]!.body as Record<string, unknown>, "review request");
    const postedComments = readArray(postBody["comments"], "review comments");
    expect(postedComments).toHaveLength(1);
    expect(postedComments[0]).toEqual({
      path: "src/review/example.ts",
      line: 3,
      side: "RIGHT",
      body: "**high correctness**\n\nTighten this changed line.",
    });
    expect(postBody["body"]).toContain("<!-- umactually-pr-review -->");
    expect(postBody["event"]).toBe("REQUEST_CHANGES");
    expect(postBody["commit_id"]).toBe("1111111111111111111111111111111111111111");

    const deletes = recorder.calls.filter(
      (call) => call.method === "DELETE" && call.url.endsWith("/reviews/4242"),
    );
    expect(deletes).toHaveLength(1);
    // PUT must NOT be used when we are replacing the review.
    expect(recorder.calls.some((call) => call.method === "PUT")).toBe(false);
  });

  it("replaces an existing marker review via DELETE+POST when --simulate-findings is set", async () => {
    // Given: a marker review already exists on PR #42 (the previous demo run
    // submitted a review and is in the COMMENTED state — PUT would 422).
    // The live provider returns an empty payload, so simulate-findings will
    // inject the deterministic fixture (which produces 4-6 inline comments).
    workspace = await mkdtemp(join(tmpdir(), "umactually-live-simulate-replace-existing-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, EVENT_JSON, "utf8");
    const emptyReview = JSON.stringify({
      summary: "Live provider returned an empty payload.",
      verdict: "COMMENT",
      comments: [],
      suppressed_comments: [],
    });
    const recorder = makeFetchRecorder(
      githubRoutesWithExistingMarkerReview(emptyReview, {
        existingReviewId: 4242,
        deleteResponse: new Response(null, { status: 204 }),
        postResponse: makeJsonResponse({ id: 9100, body: "" }, 201),
      }),
    );

    // When: live orchestration runs with --simulate-findings.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "github", "--no-dry-run", "--simulate-findings"]),
      cwd: workspace,
      env: githubEnv(eventPath),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: the existing review is DELETEd and a new fully populated review is POSTed.
    expect(result.exitCode).toBe(0);
    expect(result.posted).toBe(true);
    expect(result.reviewId).toBe(9100);
    expect(result.message).toBe("replaced existing GitHub review");

    // PUT must NOT be used under simulate-findings, even though the live
    // provider payload had 0 inline comments — PUT is silently dropped on
    // a COMMENTED review and the demo body would never replace the old one.
    const puts = recorder.calls.filter(
      (call) => call.method === "PUT" && call.url.endsWith("/reviews/4242"),
    );
    expect(puts).toHaveLength(0);

    const deletes = recorder.calls.filter(
      (call) => call.method === "DELETE" && call.url.endsWith("/reviews/4242"),
    );
    expect(deletes).toHaveLength(1);

    const reviewPosts = recorder.calls.filter(
      (call) => call.method === "POST" && call.url.endsWith("/pulls/42/reviews"),
    );
    expect(reviewPosts).toHaveLength(1);
    const postBody = readRecord(reviewPosts[0]!.body as Record<string, unknown>, "review request");

    // Then: the new POST carries the simulate-findings summary + 4-6 inline threads.
    expect(postBody["body"]).toContain("<!-- umactually-pr-review -->");
    expect(postBody["body"]).toContain("Simulated review for octo-org/octo-repo#42");
    const postedComments = readArray(postBody["comments"], "review comments");
    expect(postedComments.length).toBeGreaterThanOrEqual(4);
    expect(postedComments.length).toBeLessThanOrEqual(6);

    // Then: simulate-findings always posts a neutral COMMENT event so the
    // synthetic data never blocks the PR with REQUEST_CHANGES.
    expect(postBody["event"]).toBe("COMMENT");
  });

  it("still POSTs the new review when the DELETE of the existing marker review returns 404", async () => {
    // Given: a marker review exists, but DELETE returns 404 (review already gone / race).
    workspace = await mkdtemp(join(tmpdir(), "umactually-live-existing-delete-404-"));
    const eventPath = join(workspace, "event.json");
    await writeFile(eventPath, EVENT_JSON, "utf8");
    const recorder = makeFetchRecorder(
      githubRoutesWithExistingMarkerReview(PROVIDER_REVIEW, {
        existingReviewId: 4242,
        deleteResponse: makeJsonResponse({ message: "Not Found" }, 404),
        postResponse: makeJsonResponse({ id: 9003, body: "" }, 201),
      }),
    );

    // When: live orchestration runs.
    const result = await runLive({
      parsed: parseCliArgs(["--platform", "github", "--no-dry-run"]),
      cwd: workspace,
      env: githubEnv(eventPath),
      fetchImpl: recorder.fetchImpl,
    });

    // Then: the POST still succeeds — the 404 is treated as "already gone" and does not block.
    expect(result.exitCode).toBe(0);
    expect(result.posted).toBe(true);
    expect(result.reviewId).toBe(9003);
    expect(result.message).toBe("replaced existing GitHub review");
    const reviewPosts = recorder.calls.filter(
      (call) => call.method === "POST" && call.url.endsWith("/pulls/42/reviews"),
    );
    expect(reviewPosts).toHaveLength(1);
    const postBody = readRecord(reviewPosts[0]!.body as Record<string, unknown>, "review request");
    const postedComments = readArray(postBody["comments"], "review comments");
    expect(postedComments).toHaveLength(1);
  });
});

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

function findCall(calls: readonly RecordedCall[], method: string, urlSuffix: string): RecordedCall {
  for (const call of calls) {
    if (call.method === method && call.url.endsWith(urlSuffix)) {
      return call;
    }
  }
  throw new Error(`missing ${method} ${urlSuffix}`);
}
