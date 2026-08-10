import { describe, expect, it } from "vitest";

import { requestLiveReview } from "../../src/cli/live-provider.js";
import { LiveReviewError } from "../../src/cli/live-shared.js";
import type { ParsedCliArgs } from "../../src/cli/parse-args.js";

const API_URL = "https://provider.invalid/v1";
const API_KEY = "task-seven-api-key-do-not-leak";
const MODEL_ID = "review-model-test";
const REVIEW_BODY = JSON.stringify({
  summary: "review complete",
  verdict: "APPROVED",
  comments: [],
  suppressed_comments: [],
});

type RecordedRequest = {
  readonly url: string;
  readonly method: string;
  readonly body: unknown;
  readonly signal: AbortSignal | null;
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
      signal: init?.signal ?? null,
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

function inferenceResponse(): StubResponse {
  return {
    status: 200,
    body: {
      id: "response-task-seven",
      model: MODEL_ID,
      output: [{ type: "message", content: [{ type: "output_text", text: REVIEW_BODY }] }],
    },
  };
}

async function run(model: string | null, fetchImpl: typeof fetch, signal?: AbortSignal) {
  return requestLiveReview({
    parsed: parsed(model),
    cwd: process.cwd(),
    env: {},
    fetchImpl,
    platform: "github",
    diffText: "+const taskSeven = true;\n",
    platformToken: "platform-token",
    ...(signal === undefined ? {} : { signal }),
  });
}

async function captureFailure(catalog: StubResponse): Promise<{
  readonly error: LiveReviewError;
  readonly calls: readonly RecordedRequest[];
}> {
  const stub = makeFetchStub([catalog]);
  let captured: unknown;
  try {
    await run(null, stub.fetchImpl);
  } catch (error) {
    captured = error;
  }
  expect(captured).toBeInstanceOf(LiveReviewError);
  return { error: captured as LiveReviewError, calls: stub.calls };
}

describe("requestLiveReview model discovery", () => {
  it("uses an explicit model unchanged without listing models", async () => {
    // Given: the operator selected a concrete opaque model ID.
    const explicitModel = ` ${MODEL_ID} `;
    const stub = makeFetchStub([inferenceResponse()]);
    // When: the live request runs.
    const outcome = await run(explicitModel, stub.fetchImpl);
    // Then: only inference runs with that exact model.
    expect(stub.calls).toHaveLength(1);
    expect(stub.calls[0]?.url).toBe(`${API_URL}/responses`);
    expect(stub.calls[0]?.body).toMatchObject({ model: explicitModel });
    expect(outcome.modelId).toBe(explicitModel);
  });

  it.each([null, "", "auto"])("discovers one model before inference when configured model is %j", async (model) => {
    // Given: discovery returns exactly one opaque model ID.
    const controller = new AbortController();
    const stub = makeFetchStub([
      { status: 200, body: { data: [{ id: MODEL_ID }] } },
      inferenceResponse(),
    ]);
    // When: the omitted-compatible model value enters the live flow.
    const outcome = await run(model, stub.fetchImpl, controller.signal);
    // Then: discovery precedes inference and the same ID reaches the body/outcome.
    expect(stub.calls.map((call) => [call.method, call.url])).toEqual([
      ["GET", `${API_URL}/models`],
      ["POST", `${API_URL}/responses`],
    ]);
    expect(stub.calls[0]?.signal).toBeInstanceOf(AbortSignal);
    expect(stub.calls[1]?.body).toMatchObject({ model: MODEL_ID });
    expect(outcome.modelId).toBe(MODEL_ID);
  });

  it.each([
    { name: "zero models", response: { status: 200, body: { data: [] } } },
    { name: "two models", response: { status: 200, body: { data: [{ id: "one" }, { id: "two" }] } } },
    { name: "unauthorized catalog", response: { status: 401, body: { error: `denied ${API_KEY}` } } },
  ])("fails before inference for $name", async ({ response }) => {
    // Given: model discovery cannot select exactly one authorized model.
    // When: the live flow attempts automatic selection.
    const failure = await captureFailure(response);
    // Then: an actionable, secret-safe operator error stops before inference.
    expect(failure.calls).toHaveLength(1);
    expect(failure.calls[0]?.url).toBe(`${API_URL}/models`);
    expect(failure.error.code).toBe("PROVIDER_ERROR");
    expect(failure.error.message).toContain("--model");
    expect(failure.error.message).not.toContain(API_KEY);
  });
});
