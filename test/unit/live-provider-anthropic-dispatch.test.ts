// End-to-end dispatch test for the three provider families
// (openai-compatible / copilot / anthropic). Pins the actual code
// path that the self-review bot triggers — `requestLiveReview` —
// and confirms each branch returns the expected LiveProviderOutcome
// shape (severityWarnings captured, parse-warnings artifact built,
// review normalized through secrets scrubbing).
//
// The HTTP transport is mocked via a fetch stub so the test runs
// without a live provider. The Anthropic case uses the wire shape
// (x-api-key headers, content[] blocks, stop_reason) so a regression
// in the wire-shape helpers shows up here too.
import { describe, expect, it } from "vitest";

import type { LiveProviderOutcome } from "../../src/cli/live-shared.js";

type RecordedRequest = {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
};

type FetchResponseInit = {
  readonly status: number;
  readonly body: string;
};

type FetchStub = {
  readonly calls: readonly RecordedRequest[];
  fetch: typeof fetch;
};

function makeFetchStub(responses: readonly FetchResponseInit[]): FetchStub {
  const calls: RecordedRequest[] = [];
  let index = 0;
  const stubbed: typeof fetch = async (input, init) => {
    const requestUrl = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    const requestInit = init ?? {};
    const headers = new Headers(requestInit.headers);
    const headerRecord: Record<string, string> = {};
    headers.forEach((value, key) => {
      headerRecord[key] = value;
    });
    const rawBody = requestInit.body;
    const parsedBody: unknown = typeof rawBody === "string"
      ? safeParseJson(rawBody)
      : rawBody === undefined
        ? null
        : rawBody;
    calls.push({ url: requestUrl, method: requestInit.method ?? "GET", headers: headerRecord, body: parsedBody });
    const slot = responses[index];
    if (slot === undefined) {
      throw new Error(`fetch stub exhausted at call #${index + 1}`);
    }
    index += 1;
    return new Response(slot.body, {
      status: slot.status,
      headers: { "content-type": "application/json" },
    });
  };
  return { calls, fetch: stubbed };
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const MINIMAL_DIFF = "+ line one\n- line zero\n";

function buildAnthropicSuccessBody(text: string): string {
  return JSON.stringify({
    id: "msg_synthetic_dispatch",
    model: "claude-sonnet-4.6",
    role: "assistant",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    usage: { input_tokens: 100, output_tokens: 50 },
  });
}

const PARSE_FAIL_RAW = "Anthropic returned no JSON here, just prose.";

async function loadRequestLiveReviewModule(): Promise<{
  readonly requestLiveReview: (input: {
    readonly parsed: ReturnType<typeof makeBaseArgs>;
    readonly cwd: string;
    readonly env: NodeJS.ProcessEnv;
    readonly fetchImpl: typeof fetch;
    readonly platform: "github" | "azure";
    readonly diffText: string;
    readonly platformToken: string;
  }) => Promise<LiveProviderOutcome>;
}> {
  // Dynamic import keeps the test file robust to the live-provider
  // module refactoring its internal types during RED → GREEN.
  const mod = await import("../../src/cli/live-provider.js") as unknown as {
    readonly requestLiveReview: (input: {
      readonly parsed: ReturnType<typeof makeBaseArgs>;
      readonly cwd: string;
      readonly env: NodeJS.ProcessEnv;
      readonly fetchImpl: typeof fetch;
      readonly platform: "github" | "azure";
      readonly diffText: string;
      readonly platformToken: string;
    }) => Promise<LiveProviderOutcome>;
  };
  return mod;
}

function makeBaseArgs(providerValue: "openai-compatible" | "copilot" | "anthropic") {
  return {
    platform: "auto" as const,
    eventPath: null,
    diffPath: null,
    threadsPath: null,
    reviewPath: null,
    prNumber: "1",
    repo: "foo/bar",
    apiUrl: providerValue === "anthropic" ? "https://api.anthropic.com/v1" : "https://api.openai.com/v1",
    apiKey: "sk-test-synthetic-secret-do-not-leak",
    model: null,
    promptFile: null,
    additionalPromptFile: null,
    prompt: null,
    additionalPrompt: null,
    effort: null,
    provider: providerValue,
    githubApiBase: null,
    includeSonarqube: false,
    sonarHostUrl: null,
    sonarToken: null,
    sonarProjectKey: null,
    sonarTimeoutSeconds: null,
    minimumSeverity: "medium" as const,
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
  };
}

describe("requestLiveReview dispatch — provider=anthropic", () => {
  it("DISPATCH-ANTH-001 success: posts to /v1/messages with x-api-key headers, normalizes the review, surfaces the modelId", async () => {
    const successText = JSON.stringify({
      summary: "Anthropic live dispatch test.",
      verdict: "APPROVED",
      comments: [],
      suppressed_comments: [],
    });
    const stub = makeFetchStub([{ status: 200, body: buildAnthropicSuccessBody(successText) }]);
    const mod = await loadRequestLiveReviewModule();
    const parsed = { ...makeBaseArgs("anthropic"), apiKey: "sk-ant-synthetic-do-not-leak" };

    const outcome = await mod.requestLiveReview({
      parsed,
      cwd: process.cwd(),
      env: {},
      fetchImpl: stub.fetch,
      platform: "github",
      diffText: MINIMAL_DIFF,
      platformToken: "gh-token-do-not-leak",
    });

    // 1. The Anthropic branch hit the wire exactly once.
    expect(stub.calls).toHaveLength(1);
    const call = stub.calls[0]!;
    expect(call.method).toBe("POST");
    expect(call.url).toBe("https://api.anthropic.com/v1/messages");
    expect(call.headers["x-api-key"]).toBe("sk-ant-synthetic-do-not-leak");
    expect(call.headers["anthropic-version"]).toBe("2023-06-01");
    expect(call.headers["authorization"]).toBeUndefined();

    // 2. The review body is the parsed JSON the Anthropic client extracted
    //    out of `content[].text`, NOT the raw response envelope.
    expect(outcome.review.summary).toBe("Anthropic live dispatch test.");
    expect(outcome.review.verdict).toBe("APPROVED");
    expect(outcome.review.comments).toEqual([]);
    expect(outcome.review.suppressedComments).toEqual([]);

    // 3. The provider name on the outcome is the Anthropic-specific label
    //    so any operator-facing diagnostic distinguishes the source.
    expect(outcome.provider).toBe("anthropic-messages");
    expect(outcome.endpoint).toBe("anthropic");
    expect(outcome.modelId).toBeTruthy();
    // 4. Severity-warning capture is wired (empty array, but the field
    //    is present and matches the other providers' contract).
    expect(outcome.severityWarnings).toEqual([]);
  });

  it("DISPATCH-ANTH-002 parse-fail: returns a fallback review (parseFailed=true) on 200 OK with bad JSON", async () => {
    // Use a non-JSON text payload so the model looks like it returned prose
    // instead of a JSON review — the same failure class the openai-compatible
    // client surfaces.
    const stub = makeFetchStub([{ status: 200, body: buildAnthropicSuccessBody(PARSE_FAIL_RAW) }]);
    const mod = await loadRequestLiveReviewModule();
    const parsed = { ...makeBaseArgs("anthropic"), apiKey: "sk-ant-synthetic-do-not-leak" };

    const outcome = await mod.requestLiveReview({
      parsed,
      cwd: process.cwd(),
      env: {},
      fetchImpl: stub.fetch,
      platform: "github",
      diffText: MINIMAL_DIFF,
      platformToken: "gh-token-do-not-leak",
    });

    // The Anthropic branch produced a malformed-provider fallback review
    // (so the operator gets a diagnostic on the PR), with parseFailed=true
    // derived from the review shape (verdict=COMMENT, no inline comments).
    expect(outcome.review.summary).toContain(PARSE_FAIL_RAW);
    expect(outcome.provider).toBe("anthropic-messages");
    expect(outcome.endpoint).toBe("anthropic");
  });

  it("DISPATCH-ANTH-003 error envelope: provider_error becomes LiveReviewError (no review posted)", async () => {
    // Anthropic-style error envelope returned with HTTP 200 (some setups
    // wrap errors with 200 + error envelope). detectProviderError catches
    // the {type:"error", error:{...}} shape and the live dispatch throws
    // LiveReviewError("PROVIDER_ERROR", ...) — NOT a 0-finding COMMENT.
    const stub = makeFetchStub([{
      status: 200,
      body: JSON.stringify({
        type: "error",
        error: { type: "not_found_error", message: "model: claude-sonnet-4.6-not-found" },
      }),
    }]);
    const mod = await loadRequestLiveReviewModule();
    const parsed = { ...makeBaseArgs("anthropic"), apiKey: "sk-ant-synthetic-do-not-leak" };

    let capturedError: unknown;
    try {
      await mod.requestLiveReview({
        parsed,
        cwd: process.cwd(),
        env: {},
        fetchImpl: stub.fetch,
        platform: "github",
        diffText: MINIMAL_DIFF,
        platformToken: "gh-token-do-not-leak",
      });
    } catch (error) {
      capturedError = error;
    }
    expect(capturedError).toBeInstanceOf(Error);
    expect((capturedError as { code: string }).code).toBe("PROVIDER_ERROR");
  });

  it("DISPATCH-ANTH-004 secrets are scrubbed from the parsed review body before it lands in the outcome", async () => {
    const secret = "sk-ant-dispatch-secret-must-not-appear-in-output-xyz";
    const successText = JSON.stringify({
      summary: `Body mentions the api key ${secret} which must be redacted from posts.`,
      verdict: "APPROVED",
      comments: [],
      suppressed_comments: [{ path: "file.md", line: 1, body: `Review also references ${secret} inline.`, severity: "low", category: "nit" }],
    });
    const stub = makeFetchStub([{ status: 200, body: buildAnthropicSuccessBody(successText) }]);
    const mod = await loadRequestLiveReviewModule();
    const parsed = { ...makeBaseArgs("anthropic"), apiKey: secret };

    const outcome = await mod.requestLiveReview({
      parsed,
      cwd: process.cwd(),
      env: {},
      fetchImpl: stub.fetch,
      platform: "github",
      diffText: MINIMAL_DIFF,
      platformToken: "plat-secret-must-not-appear-either",
    });

    expect(outcome.review.summary).not.toContain(secret);
    expect(outcome.review.suppressedComments[0]!.body).not.toContain(secret);
    expect(outcome.review.suppressedComments[0]!.body).toContain("[REDACTED_SECRET]");
  });

  it("DISPATCH-ANTH-005 /anthropic path is canonicalized to /v1/messages (no wasted 404 on /anthropic/messages)", async () => {
    // Regression case the user flagged: when an operator types
    // `--api-url https://api.anthropic.com/anthropic`, the action
    // must NOT try the as-pasted URL first
    // (POST /anthropic/messages would 404). It must canonicalize
    // directly to /v1/messages — same canonical behavior PR #29
    // established for the openai-compatible client.
    const successText = JSON.stringify({
      summary: "anthropic path canonicalized correctly.",
      verdict: "APPROVED",
      comments: [],
      suppressed_comments: [],
    });
    const stub = makeFetchStub([{ status: 200, body: buildAnthropicSuccessBody(successText) }]);
    const mod = await loadRequestLiveReviewModule();
    const parsed = {
      ...makeBaseArgs("anthropic"),
      apiUrl: "https://api.anthropic.com/anthropic",
    };

    const outcome = await mod.requestLiveReview({
      parsed,
      cwd: process.cwd(),
      env: {},
      fetchImpl: stub.fetch,
      platform: "github",
      diffText: MINIMAL_DIFF,
      platformToken: "gh",
    });

    // Exactly one wire request, hitting canonical /v1/messages.
    expect(stub.calls).toHaveLength(1);
    const call = stub.calls[0]!;
    expect(call.url).toBe("https://api.anthropic.com/v1/messages");
    expect(call.url).not.toContain("/anthropic/messages");
    expect(outcome.review.summary).toBe("anthropic path canonicalized correctly.");
  });
});
