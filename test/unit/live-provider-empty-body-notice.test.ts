// Coverage tests for the empty-body suppression notice emission path in
// `handleSuccess` (src/cli/live-provider.ts:217-227) and the partition logic
// in `normalizeProviderReview` (src/cli/live-provider.ts:619-656).
//
// Drives the full `requestLiveReview` flow with a fetch stub so the
// openai-compatible provider branch runs end-to-end, exercising:
//   1. The `::notice::` stderr emission when emptyBodyDroppedCount > 0.
//   2. The conditional spread `...(emptyBodyDroppedCount > 0 ? { emptyBodyDroppedCount } : {})`.
//   3. The empty-body partition in normalizeProviderReview.
//   4. The `originalCommentsLength` field.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { requestLiveReview } from "../../src/cli/live-provider.js";
import type { LiveProviderOutcome } from "../../src/cli/live-shared.js";
import type { ParsedCliArgs } from "../../src/cli/parse-args.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_URL = "https://provider.invalid/v1";
const API_KEY = "test-api-key-do-not-leak";
const MODEL_ID = "test-model";
const PLATFORM_TOKEN = "platform-token-do-not-leak";

const DIFF_TEXT = [
  "diff --git a/src/auth.ts b/src/auth.ts",
  "index 1111111..2222222 100644",
  "--- a/src/auth.ts",
  "+++ b/src/auth.ts",
  "@@ -1,0 +1,4 @@",
  "+const first = true;",
  "+const second = true;",
  "+const third = true;",
  "+const fourth = true;",
].join("\n");

// ---------------------------------------------------------------------------
// Fetch stub (mirrors test/unit/live-provider-model-discovery.test.ts)
// ---------------------------------------------------------------------------

type RecordedRequest = {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
};

type StubResponse = {
  readonly status: number;
  readonly body: unknown;
};

function makeFetchStub(responses: readonly StubResponse[]): {
  readonly calls: readonly RecordedRequest[];
  readonly fetchImpl: typeof fetch;
} {
  const calls: RecordedRequest[] = [];
  let index = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    const rawBody = init?.body;
    calls.push({
      url,
      method: init?.method ?? "GET",
      body: typeof rawBody === "string" ? JSON.parse(rawBody) : null,
    });
    const response = responses[index];
    if (response === undefined) throw new Error(`fetch stub exhausted at call ${index + 1}`);
    index += 1;
    return new Response(JSON.stringify(response.body), {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  };
  return { calls, fetchImpl };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parsed(model: string | null): ParsedCliArgs {
  return {
    platform: "auto",
    eventPath: null,
    diffPath: null,
    files: null,
    threadsPath: null,
    reviewPath: null,
    prNumber: "1",
    repo: "example/repo",
    apiUrl: API_URL,
    apiKey: API_KEY,
    model,
    promptFile: null,
    promptFiles: null,
    additionalPromptFile: null,
    additionalPromptFiles: null,
    prompt: null,
    additionalPrompt: null,
    effort: null,
    provider: "openai-compatible",
    githubApiBase: null,
    includeSonarqube: false,
    includePrSonarFindings: false,
    sonarHostUrl: null,
    sonarToken: null,
    sonarProjectKey: null,
    sonarTimeoutSeconds: null,
    minimumSeverity: "medium",
    minimumSeverityInternal: null,
    maxComments: null,
    reviewFileLimit: null,
    detectLeaks: true,
    walkthrough: false,
    diagnostic: false,
    debugRawResponse: false,
    simulateFindings: false,
    reviewTimeoutSeconds: 60,
    stallSeconds: 50,
    perRequestTimeoutSeconds: 30,
    maxOutputTokens: 4096,
    dryRun: false,
    outputArtifact: null,
    strictSchema: true,
    verifyFindings: true,
    instructionFiles: true,
  };
}

function makeComment(overrides: {
  readonly path?: string;
  readonly line?: number;
  readonly body?: string;
  readonly severity?: string;
  readonly category?: string;
} = {}) {
  return {
    path: overrides.path ?? "src/auth.ts",
    line: overrides.line ?? 1,
    body: overrides.body ?? "Use stronger password hashing.",
    severity: overrides.severity ?? "high",
    category: overrides.category ?? "security",
  };
}

function reviewPayload(comments: readonly ReturnType<typeof makeComment>[]) {
  return {
    summary: "Review complete.",
    verdict: "NEEDS_FIX",
    comments,
    suppressed_comments: [],
  };
}

function inferenceResponse(reviewBody: unknown): StubResponse {
  return {
    status: 200,
    body: {
      id: "response-empty-body-test",
      model: MODEL_ID,
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(reviewBody) }] }],
    },
  };
}

async function run(
  fetchImpl: typeof fetch,
): Promise<LiveProviderOutcome> {
  return requestLiveReview({
    parsed: parsed(MODEL_ID),
    cwd: process.cwd(),
    env: {},
    fetchImpl,
    platform: "github",
    diffText: DIFF_TEXT,
    platformToken: PLATFORM_TOKEN,
  });
}

// ---------------------------------------------------------------------------
// stderr capture
//
// The openai-compatible provider client emits its own `::notice::` lines for
// URL candidate resolution ("Trying base URL: ..."). We filter for the
// empty-body-specific notice by matching on the distinctive message fragment.
// ---------------------------------------------------------------------------

let stderrSpy: ReturnType<typeof vi.spyOn>;
let stderrOutput: string[];

/** Filter stderr output for the empty-body suppression notice specifically. */
function emptyBodyNotices(): string[] {
  return stderrOutput.filter((line) =>
    line.includes("::notice::") && line.includes("finding(s) had no body from the provider"),
  );
}

beforeEach(() => {
  stderrOutput = [];
  stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
    stderrOutput.push(typeof chunk === "string" ? chunk : chunk.toString());
    return true;
  });
});

afterEach(() => {
  stderrSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// Case 1: 0 empty-body comments → no notice, emptyBodyDroppedCount absent
// ---------------------------------------------------------------------------

describe("requestLiveReview — empty-body notice emission", () => {
  it("0 empty-body comments → no notice emitted, emptyBodyDroppedCount absent from result", async () => {
    // Given: a review payload with all populated bodies.
    const payload = reviewPayload([
      makeComment({ line: 1, body: "Use parameterized queries." }),
      makeComment({ line: 2, body: "Validate JWT signature." }),
    ]);
    const stub = makeFetchStub([inferenceResponse(payload)]);

    // When: the live review runs.
    const outcome = await run(stub.fetchImpl);

    // Then: no empty-body ::notice:: line is written to stderr.
    expect(emptyBodyNotices()).toHaveLength(0);

    // And: emptyBodyDroppedCount is absent (not 0, not present at all).
    expect(outcome.emptyBodyDroppedCount).toBeUndefined();

    // And: all comments are kept.
    expect(outcome.review.comments).toHaveLength(2);
    expect(outcome.review.suppressedComments).toHaveLength(0);
  }, 30000);

  // -------------------------------------------------------------------------
  // Case 2: 3 empty-body comments → notice with "3 finding(s)", count === 3
  // -------------------------------------------------------------------------

  it("3 empty-body comments → notice emitted with '3 finding(s)', emptyBodyDroppedCount === 3", async () => {
    // Given: a review payload where ALL comments have empty bodies.
    const payload = reviewPayload([
      makeComment({ line: 1, body: "" }),
      makeComment({ line: 2, body: "" }),
      makeComment({ line: 3, body: "" }),
    ]);
    const stub = makeFetchStub([inferenceResponse(payload)]);

    // When: the live review runs.
    const outcome = await run(stub.fetchImpl);

    // Then: exactly one empty-body ::notice:: line is written to stderr.
    expect(emptyBodyNotices()).toHaveLength(1);

    // And: the notice mentions "3 finding(s)".
    expect(emptyBodyNotices()[0]).toContain("3 finding(s)");
    expect(emptyBodyNotices()[0]).toContain("had no body from the provider and were suppressed");

    // And: the notice is sanitized (no API key or platform token leaks).
    expect(emptyBodyNotices()[0]).not.toContain(API_KEY);
    expect(emptyBodyNotices()[0]).not.toContain(PLATFORM_TOKEN);

    // And: emptyBodyDroppedCount is 3.
    expect(outcome.emptyBodyDroppedCount).toBe(3);

    // And: all comments are moved to suppressedComments.
    expect(outcome.review.comments).toHaveLength(0);
    expect(outcome.review.suppressedComments).toHaveLength(3);
  }, 30000);

  // -------------------------------------------------------------------------
  // Case 3: mixed 2 empty + 1 populated → notice with "2 finding(s)", count === 2
  // -------------------------------------------------------------------------

  it("mixed 2 empty + 1 populated → notice with '2 finding(s)', emptyBodyDroppedCount === 2", async () => {
    // Given: a review payload with a mix of empty and populated bodies.
    const payload = reviewPayload([
      makeComment({ line: 1, body: "" }),
      makeComment({ line: 2, body: "Use parameterized queries." }),
      makeComment({ line: 3, body: "" }),
    ]);
    const stub = makeFetchStub([inferenceResponse(payload)]);

    // When: the live review runs.
    const outcome = await run(stub.fetchImpl);

    // Then: exactly one empty-body ::notice:: line is written to stderr.
    expect(emptyBodyNotices()).toHaveLength(1);

    // And: the notice mentions "2 finding(s)".
    expect(emptyBodyNotices()[0]).toContain("2 finding(s)");

    // And: emptyBodyDroppedCount is 2.
    expect(outcome.emptyBodyDroppedCount).toBe(2);

    // And: the populated comment is kept, the empty ones are suppressed.
    expect(outcome.review.comments).toHaveLength(1);
    expect(outcome.review.comments[0]?.body).toBe("Use parameterized queries.");
    expect(outcome.review.suppressedComments).toHaveLength(2);
  }, 30000);
});

// ---------------------------------------------------------------------------
// normalizeProviderReview partition — edge cases
// ---------------------------------------------------------------------------

describe("normalizeProviderReview — partition edge cases", () => {
  it("0 comments total → no notice, emptyBodyDroppedCount absent, originalCommentsLength === 0", async () => {
    // Given: a review payload with zero comments (vacuous truth guard).
    const payload = reviewPayload([]);
    const stub = makeFetchStub([inferenceResponse(payload)]);

    // When: the live review runs.
    const outcome = await run(stub.fetchImpl);

    // Then: no empty-body notice is emitted.
    expect(emptyBodyNotices()).toHaveLength(0);

    // And: emptyBodyDroppedCount is absent.
    expect(outcome.emptyBodyDroppedCount).toBeUndefined();

    // And: the review has no comments and no suppressed comments.
    expect(outcome.review.comments).toHaveLength(0);
    expect(outcome.review.suppressedComments).toHaveLength(0);
  }, 30000);

  it("all comments populated → no notice, emptyBodyDroppedCount absent, originalCommentsLength === N", async () => {
    // Given: a review payload where every comment has a populated body.
    const payload = reviewPayload([
      makeComment({ line: 1, body: "First finding." }),
      makeComment({ line: 2, body: "Second finding." }),
      makeComment({ line: 3, body: "Third finding." }),
    ]);
    const stub = makeFetchStub([inferenceResponse(payload)]);

    // When: the live review runs.
    const outcome = await run(stub.fetchImpl);

    // Then: no empty-body notice is emitted.
    expect(emptyBodyNotices()).toHaveLength(0);

    // And: emptyBodyDroppedCount is absent.
    expect(outcome.emptyBodyDroppedCount).toBeUndefined();

    // And: all comments are kept.
    expect(outcome.review.comments).toHaveLength(3);
    expect(outcome.review.suppressedComments).toHaveLength(0);
  }, 30000);

  it("whitespace-only body counts as empty → notice emitted, count === 1", async () => {
    // Given: a review payload with a whitespace-only body.
    const payload = reviewPayload([
      makeComment({ line: 1, body: "   " }),
      makeComment({ line: 2, body: "Real finding." }),
    ]);
    const stub = makeFetchStub([inferenceResponse(payload)]);

    // When: the live review runs.
    const outcome = await run(stub.fetchImpl);

    // Then: the whitespace-only comment is treated as empty.
    expect(emptyBodyNotices()).toHaveLength(1);
    expect(emptyBodyNotices()[0]).toContain("1 finding(s)");
    expect(outcome.emptyBodyDroppedCount).toBe(1);

    // And: the populated comment is kept.
    expect(outcome.review.comments).toHaveLength(1);
    expect(outcome.review.comments[0]?.body).toBe("Real finding.");
  }, 30000);
});

// ---------------------------------------------------------------------------
// Suppressed comments placement
// ---------------------------------------------------------------------------

describe("empty-body suppression — suppressed comments placement", () => {
  it("suppressed empty-body comments appear in review.suppressedComments with original path/line", async () => {
    // Given: a review payload with empty-body comments at specific paths/lines.
    const payload = reviewPayload([
      makeComment({ path: "src/auth.ts", line: 10, body: "" }),
      makeComment({ path: "src/db.ts", line: 20, body: "" }),
    ]);
    const stub = makeFetchStub([inferenceResponse(payload)]);

    // When: the live review runs.
    const outcome = await run(stub.fetchImpl);

    // Then: the suppressed comments retain their original path and line.
    expect(outcome.review.suppressedComments).toHaveLength(2);
    expect(outcome.review.suppressedComments[0]?.path).toBe("src/auth.ts");
    expect(outcome.review.suppressedComments[0]?.line).toBe(10);
    expect(outcome.review.suppressedComments[1]?.path).toBe("src/db.ts");
    expect(outcome.review.suppressedComments[1]?.line).toBe(20);

    // And: the bodies are empty (they were empty from the provider).
    expect(outcome.review.suppressedComments[0]?.body).toBe("");
    expect(outcome.review.suppressedComments[1]?.body).toBe("");
  }, 30000);

  it("pre-existing suppressed_comments from provider are preserved alongside empty-body drops", async () => {
    // Given: a review payload with both pre-existing suppressed_comments and empty-body comments.
    const payload = {
      summary: "Review complete.",
      verdict: "NEEDS_FIX",
      comments: [
        makeComment({ line: 1, body: "" }),
        makeComment({ line: 2, body: "Real finding." }),
      ],
      suppressed_comments: [
        makeComment({ path: "src/legacy.ts", line: 99, body: "Already suppressed by provider." }),
      ],
    };
    const stub = makeFetchStub([inferenceResponse(payload)]);

    // When: the live review runs.
    const outcome = await run(stub.fetchImpl);

    // Then: the pre-existing suppressed comment is preserved.
    expect(outcome.review.suppressedComments).toHaveLength(2);
    expect(outcome.review.suppressedComments[0]?.path).toBe("src/legacy.ts");
    expect(outcome.review.suppressedComments[0]?.body).toBe("Already suppressed by provider.");

    // And: the empty-body comment is appended after it.
    expect(outcome.review.suppressedComments[1]?.body).toBe("");

    // And: the count reflects only the empty-body drops.
    expect(outcome.emptyBodyDroppedCount).toBe(1);
  }, 30000);
});
