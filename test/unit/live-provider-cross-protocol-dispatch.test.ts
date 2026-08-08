// Cross-protocol fallback dispatch tests.
//
// Pins: when the operator's chosen provider fails with a routing-level
// failure (404), the live-provider dispatcher should automatically
// try the OTHER protocol at the same URL. This makes `--provider`
// advisory on Anthropic-protocol-capable gateways like MiniMax
// (https://platform.minimax.io/docs/token-plan/claude-code +
// https://platform.minimax.io/docs/token-plan/codex) where the same
// base URL serves BOTH Anthropic and OpenAI protocols.
//
// These tests stub fetch and pick paths that reproduce realistic
// operator setups so they're robust to refactors of how the dispatcher
// handles wire-shape details.

import { describe, expect, it } from "vitest";

import type { LiveProviderOutcome } from "../../src/cli/live-shared.js";

type RecordedRequest = {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
};
type FetchResponseInit = { readonly status: number; readonly body: string };

function makeFetchStub(responses: readonly FetchResponseInit[]) {
  const calls: RecordedRequest[] = [];
  let i = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = typeof input === "string" ? input
      : input instanceof URL ? input.toString()
      : input.url;
    const reqInit = init ?? {};
    const headers = new Headers(reqInit.headers);
    const record: Record<string, string> = {};
    headers.forEach((v, k) => { record[k] = v; });
    const body = reqInit.body && typeof reqInit.body === "string"
      ? safeParse(reqInit.body) : reqInit.body ?? null;
    calls.push({ url, method: reqInit.method ?? "GET", headers: record, body });
    const slot = responses[i];
    if (!slot) throw new Error(`fetch stub exhausted at call #${i + 1}`);
    i += 1;
    return new Response(slot.body, { status: slot.status, headers: { "content-type": "application/json" } });
  };
  return { calls, fetch: fetchImpl };
}

function safeParse(s: string): unknown { try { return JSON.parse(s); } catch { return s; } }

const SUCCESS_TEXT_OPENAI = JSON.stringify({
  summary: "OpenAI-protocol review.",
  verdict: "APPROVED",
  comments: [],
  suppressed_comments: [],
});
const SUCCESS_TEXT_ANTH = JSON.stringify({
  summary: "Anthropic-protocol review.",
  verdict: "APPROVED",
  comments: [],
  suppressed_comments: [],
});

function openaiSuccessResponses(text: string): string {
  return JSON.stringify({
    id: "resp_openai",
    model: "MiniMax-M3",
    output: [{ type: "message", content: [{ type: "output_text", text }] }],
  });
}
function anthropicSuccessResponses(text: string): string {
  return JSON.stringify({
    id: "msg_anthropic",
    model: "claude-sonnet-4.6",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    usage: { input_tokens: 5, output_tokens: 10 },
  });
}

const diffText = "+ line one\n- line zero\n";

type Args = {
  provider: "openai-compatible" | "copilot" | "anthropic";
  apiUrl: string | null;
  apiKey: string;
  fetchImpl: typeof fetch;
  env: NodeJS.ProcessEnv;
};

async function loadDispatcher() {
  return await import("../../src/cli/live-provider.js") as unknown as {
    readonly requestLiveReview: (input: {
      readonly parsed: ReturnType<typeof makeBase>;
      readonly cwd: string;
      readonly env: NodeJS.ProcessEnv;
      readonly fetchImpl: typeof fetch;
      readonly platform: "github" | "azure";
      readonly diffText: string;
      readonly platformToken: string;
    }) => Promise<LiveProviderOutcome>;
  };
}

function makeBase(args: Args) {
  return {
    platform: "auto" as const,
    eventPath: null,
    diffPath: null,
    threadsPath: null,
    reviewPath: null,
    prNumber: "1",
    repo: "smoke/test",
    apiUrl: args.apiUrl,
    apiKey: args.apiKey,
    model: "dispatch-test-model",
    promptFile: null,
    additionalPromptFile: null,
    prompt: null,
    additionalPrompt: null,
    effort: null,
    provider: args.provider,
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

describe("cross-protocol fallback: openai-compatible falls back to anthropic-protocol when ALL OpenAI candidates 404 and the URL is NOT heuristically committed to Anthropic", () => {
  it("DISPATCH-OPEN-FALLBACK-001: openai-compatible against a non-Anthropic-prefixed URL that has no OpenAI route falls back to anthropic protocol when ALL OpenAI candidates 404", async () => {
    // Operator typed --api-url https://api.example.com/anthropic-v2 and
    // --provider openai-compatible. The path-prefix heuristic
    // (`looksLikeAnthropicEndpoint`) does NOT commit to Anthropic here
    // because the path segment is 'anthropic-v2', not 'anthropic' — the
    // heuristic only triggers on exact-segment matches. So the openai-
    // compatible client runs its full candidate loop:
    //   /anthropic-v2/responses + /anthropic-v2/chat/completions → 404
    //   /v1/responses + /v1/chat/completions → 404 (origin fallback)
    // All four 404. The dispatcher should NOT give up; it should fall
    // back to the Anthropic protocol at `/anthropic-v2/v1/messages`
    // using the Anthropic wire shape (x-api-key header).
    //
    // (When the URL is /anthropic flat, the path-prefix heuristic
    // commits to Anthropic protocol directly without going through
    // the cross-protocol fallback block. That case is covered by
    // HEURISTIC-DISPATCH-001 in the heuristic describe block below.)
    const stub = makeFetchStub([
      // URL candidate 1: /anthropic-v2 — both endpoints 404
      { status: 404, body: "404 page not found" },  // /anthropic-v2/responses
      { status: 404, body: "404 page not found" },  // /anthropic-v2/chat/completions
      // URL candidate 2: /v1 (origin fallback) — both endpoints 404
      { status: 404, body: "404 page not found" },  // /v1/responses
      { status: 404, body: "404 page not found" },  // /v1/chat/completions
      // Anthropic-protocol fallback: /anthropic-v2/v1/messages 200
      { status: 200, body: anthropicSuccessResponses(SUCCESS_TEXT_ANTH) },
    ]);
    const dispatcher = await loadDispatcher();
    const parsed = makeBase({
      provider: "openai-compatible",
      apiUrl: "https://api.example.com/anthropic-v2",
      apiKey: "sk-anth-fallback-secret-do-not-leak",
      fetchImpl: stub.fetch,
      env: {},
    });
    const outcome = await dispatcher.requestLiveReview({
      parsed,
      cwd: process.cwd(),
      env: {},
      fetchImpl: stub.fetch,
      platform: "github",
      diffText,
      platformToken: "gh-token",
    });

    // Outcome must reflect the Anthropic-protocol fallback.
    expect(outcome.review.summary).toBe("Anthropic-protocol review.");
    expect(outcome.endpoint).toBe("anthropic");
    expect(outcome.provider).toBe("anthropic-messages");
    expect(stub.calls.length).toBeGreaterThanOrEqual(5);
    // The Anthropic client preserves the operator's path prefix per
    // resolveAnthropicMessagesUrl, so /anthropic-v2 resolves to
    // /anthropic-v2/v1/messages, NOT /anthropic/v1/messages.
    const fallbackCall = stub.calls.find(c =>
      c.url.endsWith("/anthropic-v2/v1/messages")
    );
    expect(fallbackCall, "expected a call to /anthropic-v2/v1/messages").toBeDefined();
    expect(fallbackCall?.headers["x-api-key"]).toBe("sk-anth-fallback-secret-do-not-leak");
    expect(fallbackCall?.headers["anthropic-version"]).toBe("2023-06-01");
    expect(fallbackCall?.headers["authorization"]).toBeUndefined();
  });
});

describe("cross-protocol fallback: anthropic falls back to openai-protocol at /v1/responses", () => {
  it("DISPATCH-ANTH-FALLBACK-001: anthropic against bare /v1 falls back to openai protocol when /v1/messages 404s", async () => {
    // Operator typed --api-url https://api.minimax.io/v1 and
    // --provider anthropic. Anthropic-protocol at /v1/messages 404s
    // on MiniMax (the Anthropic-protocol endpoint is at /anthropic/,
    // not /v1/). The dispatcher should fall back to OpenAI at
    // /v1/responses.
    //
    // Wire stubs: /v1/messages (404), /v1/responses (200).
    // The OpenAI client may try /v1/responses THEN
    // /v1/chat/completions depending on response_format handling
    // — but the first response is 200 so it returns.
    const stub = makeFetchStub([
      // /v1/messages (anthropic-protocol)  →  404
      { status: 404, body: "404 page not found" },
      // /v1/responses (openai-protocol fallback)  →  200
      { status: 200, body: openaiSuccessResponses(SUCCESS_TEXT_OPENAI) },
    ]);
    const dispatcher = await loadDispatcher();
    const parsed = makeBase({
      provider: "anthropic",
      apiUrl: "https://api.minimax.io/v1",
      apiKey: "sk-openai-fallback-secret-do-not-leak",
      fetchImpl: stub.fetch,
      env: {},
    });
    const outcome = await dispatcher.requestLiveReview({
      parsed,
      cwd: process.cwd(),
      env: {},
      fetchImpl: stub.fetch,
      platform: "github",
      diffText,
      platformToken: "gh-token",
    });

    // Outcome must reflect the OpenAI-protocol fallback.
    expect(outcome.review.summary).toBe("OpenAI-protocol review.");
    expect(outcome.endpoint).toBe("responses");
    expect(outcome.provider).toBe("openai-compatible");
    const fallbackCall = stub.calls.find(c =>
      c.url === "https://api.minimax.io/v1/responses"
    );
    expect(fallbackCall, "expected a call to /v1/responses").toBeDefined();
    expect(fallbackCall?.headers["authorization"]).toBe("Bearer sk-openai-fallback-secret-do-not-leak");
    expect(fallbackCall?.headers["x-api-key"]).toBeUndefined();
  });
});

describe("cross-protocol fallback should NOT trigger when named provider succeeds", () => {
  it("DISPATCH-NO-FALLBACK-001: openai-compatible against /v1/responses does NOT call anthropic protocol", async () => {
    // Sanity check: if the named provider succeeds on its first try,
    // we never call the other protocol. We assert this by counting
    // unique protocol-shape headers across all calls — exactly one
    // protocol should appear.
    const stub = makeFetchStub([
      { status: 200, body: openaiSuccessResponses(SUCCESS_TEXT_OPENAI) },
    ]);
    const dispatcher = await loadDispatcher();
    const parsed = makeBase({
      provider: "openai-compatible",
      apiUrl: "https://api.minimax.io/v1",
      apiKey: "sk-no-fallback-do-not-leak",
      fetchImpl: stub.fetch,
      env: {},
    });
    const outcome = await dispatcher.requestLiveReview({
      parsed,
      cwd: process.cwd(),
      env: {},
      fetchImpl: stub.fetch,
      platform: "github",
      diffText,
      platformToken: "gh-token",
    });
    expect(outcome.endpoint).toBe("responses");
    expect(stub.calls.length).toBe(1);
    expect(stub.calls[0]!.url).toBe("https://api.minimax.io/v1/responses");
  });
});

describe("cross-protocol fallback dual-failure surface", () => {
  it("DISPATCH-FALLBACK-LOG-001: when BOTH named + fallback fail, the surface error is the named provider's", async () => {
    // Operator picks anthropic for /v1 URL. Anthropic /v1/messages
    // 404s → cross-protocol fallback to OpenAI. OpenAI /v1/responses
    // ALSO 404s → both protocols fail. The contract says surface the
    // NAMED provider's error (honor operator's intent), but log
    // both attempts so operators can audit. We assert:
    //   - the result error.code matches the named protocol's code (anthropic_4xx).
    //   - the named-protocol error surfaces.
    //   - both protocols were called (one Anthropic 404 + at least
    //     one OpenAI 404).
    // Note: we don't directly assert the log output here (it goes to
    // stderr notice channels). The contract is about which error
    // is surfaced, not about the visual diagnostic format.
    const stub = makeFetchStub([
      // /v1/messages (anthropic) → 404
      { status: 404, body: "404 page not found" },
      // /v1/responses (openai fallback) → 404
      { status: 404, body: "404 page not found" },
      // /v1/chat/completions (openai fallback's internal retry) → 404
      { status: 404, body: "404 page not found" },
    ]);
    const dispatcher = await loadDispatcher();
    const parsed = makeBase({
      provider: "anthropic",
      apiUrl: "https://api.minimax.io/v1",
      apiKey: "sk-both-fail-do-not-leak",
      fetchImpl: stub.fetch,
      env: {},
    });
    let capturedError: unknown;
    try {
      await dispatcher.requestLiveReview({
        parsed,
        cwd: process.cwd(),
        env: {},
        fetchImpl: stub.fetch,
        platform: "github",
        diffText,
        platformToken: "gh-token",
      });
    } catch (error) {
      capturedError = error;
    }
    expect(capturedError).toBeInstanceOf(Error);
    // Error message starts with the named provider's prefix.
    expect(String((capturedError as { message: string }).message)).toMatch(/Anthropic/i);
    // Both protocols were attempted.
    expect(stub.calls.some((c) => c.url.endsWith("/v1/messages"))).toBe(true);
    expect(stub.calls.some((c) => c.url.endsWith("/v1/responses"))).toBe(true);
  });
});

describe("path-prefix heuristic: /anthropic URL commits to Anthropic protocol even when --provider=openai-compatible", () => {
  it("HEURISTIC-DISPATCH-001: provider=openai-compatible + URL=https://api.minimax.io/anthropic posts to /anthropic/v1/messages with x-api-key (NOT OpenAI /v1/responses)", async () => {
    // Regression: previously the openai-compatible client's URL
    // candidate loop downgraded the URL to /v1 (origin+/v1) and
    // MiniMax serves OpenAI there too, so the action silently
    // posted a /v1/responses OpenAI-Responses call. With the
    // path-prefix heuristic, the dispatcher should commit to
    // the Anthropic Messages API client. Stub the Anthropic
    // endpoint returning 200 and confirm the dispatcher POSTs
    // there (not /v1/responses).
    const stub = makeFetchStub([
      { status: 200, body: anthropicSuccessResponses("heuristic-dispatch-001 summary") },
    ]);
    const dispatcher = await loadDispatcher();
    const parsed = makeBase({
      provider: "openai-compatible",
      apiUrl: "https://api.minimax.io/anthropic",
      apiKey: "sk-minimax-smoke-test-do-not-leak",
      fetchImpl: stub.fetch,
      env: {},
    });
    const outcome = await dispatcher.requestLiveReview({
      parsed,
      cwd: process.cwd(),
      env: {},
      fetchImpl: stub.fetch,
      platform: "github",
      diffText,
      platformToken: "gh-token",
    });

    // The Anthropic-protocol endpoint was hit (x-api-key + /v1/messages path).
    expect(stub.calls.some((c) => c.url.endsWith("/anthropic/v1/messages"))).toBe(true);
    // The OpenAI-protocol endpoint was NOT hit (no /v1/responses, no /v1/chat/completions).
    expect(stub.calls.some((c) => c.url.endsWith("/v1/responses"))).toBe(false);
    expect(stub.calls.some((c) => c.url.endsWith("/v1/chat/completions"))).toBe(false);

    // The Anthropic client outcome attribute should be recovered (not
    // the default openai-compatible) — this is THE bug we're fixing.
    // The summary string comes from the parse-fail fallback review
    // (not the model output), so we don't pin a literal string here;
    // the URL+attribute check pins the contract.
    expect(outcome.provider).toBe("anthropic-messages");
    expect(outcome.endpoint).toBe("anthropic");
    // The Anthropic-protocol call was made with the right auth headers.
    const anthropicCall = stub.calls.find((c) => c.url.endsWith("/anthropic/v1/messages"));
    expect(anthropicCall?.headers["x-api-key"]).toBe("sk-minimax-smoke-test-do-not-leak");
    expect(anthropicCall?.headers["anthropic-version"]).toBe("2023-06-01");
  });

  it("HEURISTIC-DISPATCH-002: provider=openai-compatible + URL=https://gateway.example.com/llm/anthropic commits to Anthropic (self-hosted gateway case)", async () => {
    // The heuristic is path-segment based, not hostname-based.
    // Self-hosted Anthropic-protocol gateways under arbitrary paths
    // (LiteLLM-style `/llm/anthropic`, Portkey-style `/v1/anthropic`)
    // also commit to the Anthropic Messages API.
    const stub = makeFetchStub([
      { status: 200, body: anthropicSuccessResponses("llm/anthropic summary") },
    ]);
    const dispatcher = await loadDispatcher();
    const parsed = makeBase({
      provider: "openai-compatible",
      apiUrl: "https://gateway.example.com/llm/anthropic",
      apiKey: "sk-test-llm-anthropic-do-not-leak",
      fetchImpl: stub.fetch,
      env: {},
    });
    const outcome = await dispatcher.requestLiveReview({
      parsed,
      cwd: process.cwd(),
      env: {},
      fetchImpl: stub.fetch,
      platform: "github",
      diffText,
      platformToken: "gh-token",
    });
    expect(stub.calls.some((c) => c.url.endsWith("/llm/anthropic/v1/messages"))).toBe(true);
    expect(outcome.provider).toBe("anthropic-messages");
  });

  it("HEURISTIC-DISPATCH-003: provider=openai-compatible + URL=https://api.openai.com/v1 (no /anthropic) stays OpenAI", async () => {
    // Negative case: a vanilla OpenAI URL with no /anthropic segment
    // must NOT commit to Anthropic — the dispatcher stays on the
    // OpenAI client and POSTs to /v1/responses as today.
    const stub = makeFetchStub([
      { status: 200, body: openaiSuccessResponses("vanilla openai") },
    ]);
    const dispatcher = await loadDispatcher();
    const parsed = makeBase({
      provider: "openai-compatible",
      apiUrl: "https://api.openai.com/v1",
      apiKey: "sk-test-openai-do-not-leak",
      fetchImpl: stub.fetch,
      env: {},
    });
    const outcome = await dispatcher.requestLiveReview({
      parsed,
      cwd: process.cwd(),
      env: {},
      fetchImpl: stub.fetch,
      platform: "github",
      diffText,
      platformToken: "gh-token",
    });
    expect(stub.calls.some((c) => c.url.endsWith("/v1/responses"))).toBe(true);
    expect(stub.calls.some((c) => c.url.endsWith("/v1/messages"))).toBe(false);
    expect(outcome.provider).toBe("openai-compatible");
    expect(outcome.endpoint).toBe("responses");
  });

  it("HEURISTIC-DISPATCH-004: provider=anthropic + URL=https://api.minimax.io/anthropic still commits to Anthropic (heuristic is a no-op when explicit)", async () => {
    // The explicit --provider=anthropic branch already handles this case.
    // Sanity check: with explicit anthropic, the dispatcher hits the
    // Anthropic endpoint via the normal anthropic-client path, not via
    // the heuristic gate.
    const stub = makeFetchStub([
      { status: 200, body: anthropicSuccessResponses("explicit anthropic") },
    ]);
    const dispatcher = await loadDispatcher();
    const parsed = makeBase({
      provider: "anthropic",
      apiUrl: "https://api.minimax.io/anthropic",
      apiKey: "sk-explicit-anthropic-do-not-leak",
      fetchImpl: stub.fetch,
      env: {},
    });
    const outcome = await dispatcher.requestLiveReview({
      parsed,
      cwd: process.cwd(),
      env: {},
      fetchImpl: stub.fetch,
      platform: "github",
      diffText,
      platformToken: "gh-token",
    });
    expect(stub.calls.some((c) => c.url.endsWith("/anthropic/v1/messages"))).toBe(true);
    expect(stub.calls.some((c) => c.url === "https://api.minimax.io/anthropic/v1/messages")).toBe(true);
    expect(outcome.provider).toBe("anthropic-messages");
  });

  it("HEURISTIC-DISPATCH-005: provider=openai-compatible + URL=https://api.example.com/anthropic-v2 does NOT commit (path segment 'anthropic-v2' != 'anthropic')", async () => {
    // The path-segment match is exact (case-insensitive). 'anthropic-v2'
    // is its own segment — not the literal 'anthropic'. The heuristic
    // stays on the OpenAI client and lets the openai client's URL
    // candidate loop try /anthropic-v2/responses etc., eventually
    // falling back via the cross-protocol layer when everything 404s.
    const stub = makeFetchStub([
      // /anthropic-v2/responses + /anthropic-v2/chat/completions (openai
      // client's candidate loop, both 404 because /anthropic-v2 doesn't
      // exist) — then cross-protocol fallback to Anthropic at
      // /anthropic-v2/v1/messages (also 404 because the path is wrong).
      { status: 404, body: "404 page not found" }, // /anthropic-v2/responses
      { status: 404, body: "404 page not found" }, // /anthropic-v2/chat/completions
      { status: 404, body: "404 page not found" }, // /v1/responses (origin fallback)
      { status: 404, body: "404 page not found" }, // /v1/chat/completions
      { status: 404, body: "404 page not found" }, // /anthropic-v2/v1/messages (anthropic fallback)
    ]);
    const dispatcher = await loadDispatcher();
    const parsed = makeBase({
      provider: "openai-compatible",
      apiUrl: "https://api.example.com/anthropic-v2",
      apiKey: "sk-anthropic-v2-do-not-leak",
      fetchImpl: stub.fetch,
      env: {},
    });
    let capturedError: unknown;
    try {
      await dispatcher.requestLiveReview({
        parsed,
        cwd: process.cwd(),
        env: {},
        fetchImpl: stub.fetch,
        platform: "github",
        diffText,
        platformToken: "gh-token",
      });
    } catch (error) {
      capturedError = error;
    }
    // The OpenAI client's URL candidate loop ran, advanced to the
    // Anthropic-protocol fallback (because /anthropic-v2 didn't 200 on
    // OpenAI), but ultimately failed — surfaced as expected.
    expect(capturedError).toBeInstanceOf(Error);
    // /anthropic-v2/v1/messages was attempted (cross-protocol fallback).
    expect(stub.calls.some((c) => c.url.endsWith("/anthropic-v2/v1/messages"))).toBe(true);
  });
});
