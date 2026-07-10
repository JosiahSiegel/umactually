// RED tests for native Anthropic Messages provider support.
// Reference contract: Anthropic Messages API
//   POST /v1/messages
//   Headers: x-api-key: <key>, anthropic-version: 2023-06-01, content-type: application/json
//   Body: { model, system, messages: [{role:"user", content}], max_tokens, ... }
//   Response (200): { id, model, content: [{type:"text", text:"..."}], stop_reason, usage }
//   Response (4xx/5xx): { type:"error", error: { type, message } }
import { describe, expect, it } from "vitest";

import {
  expectFutureModule,
} from "../helpers/assert-red-module.js";

type RecordedRequest = {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
};

type FetchResponseInit = {
  readonly status: number;
  readonly body: string;
  readonly contentType?: string;
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
    const method = requestInit.method ?? "GET";
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
    calls.push({ url: requestUrl, method, headers: headerRecord, body: parsedBody });

    const slot = responses[index];
    if (slot === undefined) {
      throw new Error(`fetch stub exhausted at call #${index + 1}`);
    }
    index += 1;
    return new Response(slot.body, {
      status: slot.status,
      headers: { "content-type": slot.contentType ?? "application/json" },
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

async function loadAnthropicModule(): Promise<{
  readonly runAnthropicRequest: (...args: unknown[]) => Promise<unknown>;
  readonly ProviderError: new (...args: unknown[]) => Error & {
    readonly code: string;
    readonly endpoint: string;
    readonly status: number | null;
    readonly providerErrorDetails?: unknown;
    readonly truncated?: boolean;
  };
}> {
  return expectFutureModule("../../src/provider/anthropic-messages.js") as unknown as {
    readonly runAnthropicRequest: (...args: unknown[]) => Promise<unknown>;
    readonly ProviderError: new (...args: unknown[]) => Error & {
      readonly code: string;
      readonly endpoint: string;
      readonly status: number | null;
      readonly providerErrorDetails?: unknown;
      readonly truncated?: boolean;
    };
  };
}

const BASE_CONFIG = {
  baseUrl: "https://api.anthropic.com/v1",
  apiKey: "sk-ant-synthetic-do-not-leak",
  model: "claude-sonnet-4.6",
  system: "system prompt",
  user: "user prompt",
  requestTimeoutMs: 5_000,
} as const;

const SUCCESS_BODY = JSON.stringify({
  id: "msg_synthetic_001",
  model: "claude-sonnet-4.6",
  role: "assistant",
  content: [
    {
      type: "text",
      text: JSON.stringify({
        summary: "Synthetic Anthropic review.",
        verdict: "DISCUSS",
        comments: [],
        suppressed_comments: [],
      }),
    },
  ],
  stop_reason: "end_turn",
  usage: { input_tokens: 10, output_tokens: 20 },
});

describe("anthropic-messages provider client — RED contract", () => {
  it("ANTH-RED-001 posts to /v1/messages with x-api-key + anthropic-version headers", async () => {
    const stub = makeFetchStub([{ status: 200, body: SUCCESS_BODY }]);
    const mod = await loadAnthropicModule();

    const result = await mod.runAnthropicRequest({
      ...BASE_CONFIG,
      fetchImpl: stub.fetch,
    });

    expect(result).toMatchObject({ ok: true, endpoint: "anthropic" });
    expect(stub.calls).toHaveLength(1);
    const call = stub.calls[0]!;
    expect(call.method).toBe("POST");
    expect(call.url).toBe("https://api.anthropic.com/v1/messages");
    expect(call.headers["x-api-key"]).toBe("sk-ant-synthetic-do-not-leak");
    expect(call.headers["anthropic-version"]).toBe("2023-06-01");
    expect(call.headers["authorization"]).toBeUndefined();
    const body = call.body as Record<string, unknown>;
    expect(body["model"]).toBe("claude-sonnet-4.6");
    expect(body["system"]).toBe("system prompt");
    // Anthropic uses top-level `system`, not a system message in `messages`.
    const messages = body["messages"] as readonly Record<string, unknown>[];
    expect(Array.isArray(messages)).toBe(true);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toEqual({ role: "user", content: "user prompt" });
    expect(typeof body["max_tokens"]).toBe("number");
  });

  it("ANTH-RED-002 returns a typed ProviderError with code=anthropic_4xx on HTTP 4xx", async () => {
    const stub = makeFetchStub([{ status: 401, body: JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }) }]);
    const mod = await loadAnthropicModule();

    const result = await mod.runAnthropicRequest({
      ...BASE_CONFIG,
      fetchImpl: stub.fetch,
    });

    expect(result).toMatchObject({ ok: false });
    const error = (result as { readonly error: { readonly code: string; readonly endpoint: string; readonly status: number } }).error;
    expect(error.code).toBe("anthropic_4xx");
    expect(error.endpoint).toBe("anthropic");
    expect(error.status).toBe(401);
  });

  it("ANTH-RED-003 surfaces Anthropic error envelopes as provider_error so live-review can hard-fail", async () => {
    // 200 OK but the body is {type:"error", error:{...}} — same shape OpenAI
    // also returns on router misconfiguration. detectProviderError should
    // catch this and throw provider_error rather than parse-fail.
    const stub = makeFetchStub([{
      status: 200,
      body: JSON.stringify({
        type: "error",
        error: { type: "not_found_error", message: "model: claude-sonnet-4.6-not-found" },
      }),
    }]);
    const mod = await loadAnthropicModule();

    const result = await mod.runAnthropicRequest({
      ...BASE_CONFIG,
      fetchImpl: stub.fetch,
    });

    expect(result).toMatchObject({ ok: false });
    const error = (result as { readonly error: { readonly code: string; readonly providerErrorDetails?: unknown } }).error;
    expect(error.code).toBe("provider_error");
    expect(error.providerErrorDetails).toBeDefined();
  });

  it("ANTH-RED-004 retries on parse-fail and recovers with the JSON-only reminder", async () => {
    const successBody = JSON.stringify({
      id: "msg_retry_001",
      content: [{
        type: "text",
        text: '{"summary":"Recovered.","verdict":"COMMENT","comments":[],"suppressed_comments":[]}',
      }],
      stop_reason: "end_turn",
      usage: { input_tokens: 5, output_tokens: 15 },
    });
    const stub = makeFetchStub([
      { status: 200, body: JSON.stringify({ id: "msg_bad", content: [{ type: "text", text: "Here is a review: looks fine to me. No JSON." }], stop_reason: "end_turn" }) },
      { status: 200, body: successBody },
    ]);
    const mod = await loadAnthropicModule();

    const result = await mod.runAnthropicRequest({
      ...BASE_CONFIG,
      fetchImpl: stub.fetch,
    });

    expect(result).toMatchObject({ ok: true, endpoint: "anthropic" });
    expect(stub.calls).toHaveLength(2);
    const retryBody = stub.calls[1]!.body as Record<string, unknown>;
    const retryMessages = retryBody["messages"] as readonly Record<string, unknown>[];
    expect(retryMessages).toHaveLength(1);
    const retryMsgContent = retryMessages[0]!["content"] as string;
    // The retry prepends a JSON-only reminder so the model emits JSON.
    expect(retryMsgContent.startsWith("Your previous response did not contain a valid JSON review payload.")).toBe(true);
    // Critically the original user content is APPENDED to the
    // reminder (not replaced). Replacing it would cause the model
    // to emit "no code context" prose. The "endsWith" assertion
    // pins both that the user content is present AND that nothing
    // was appended after it (a buggy implementation that appended
    // a longer trailer containing the literal "user prompt"
    // substring would still satisfy `toContain` but fails this).
    expect(retryMsgContent.endsWith("user prompt")).toBe(true);
  });

  it("ANTH-RED-005 surfaces a truncated-stream parse-fail when stop_reason=max_tokens and raw is large", async () => {
    const largeProse = "x".repeat(20_000);
    const stub = makeFetchStub([{
      status: 200,
      body: JSON.stringify({
        id: "msg_truncated",
        content: [{ type: "text", text: largeProse }],
        stop_reason: "max_tokens",
        usage: { input_tokens: 50, output_tokens: 16_000 },
      }),
    }]);
    const mod = await loadAnthropicModule();

    const result = await mod.runAnthropicRequest({
      ...BASE_CONFIG,
      maxOutputTokens: 16_000,
      fetchImpl: stub.fetch,
    });

    expect(result).toMatchObject({ ok: false });
    const error = (result as { readonly error: { readonly code: string; readonly truncated?: boolean; readonly usage?: unknown } }).error;
    expect(error.code).toBe("parse");
    expect(error.truncated).toBe(true);
  });

  it("ANTH-RED-006 retries on network errors and recovers when the network returns", async () => {
    const successBody = JSON.stringify({
      id: "msg_net_001",
      content: [{
        type: "text",
        text: '{"summary":"Network recovered.","verdict":"COMMENT","comments":[],"suppressed_comments":[]}',
      }],
      stop_reason: "end_turn",
      usage: { input_tokens: 1, output_tokens: 1 },
    });
    // Use RETRY_BACKOFF_MS = [250, 1_000]; 3rd attempt is "no more retries".
    const stub = makeFetchStub([
      { status: 500, body: "{\"type\":\"error\",\"error\":{\"type\":\"api_error\",\"message\":\"internal\"}}" },
      { status: 500, body: "{\"type\":\"error\",\"error\":{\"type\":\"api_error\",\"message\":\"internal\"}}" },
      { status: 500, body: "{\"type\":\"error\",\"error\":{\"type\":\"api_error\",\"message\":\"internal\"}}" },
    ]);
    const stubSuccessThenFail = makeFetchStub([
      { status: 500, body: "{\"type\":\"error\",\"error\":{\"type\":\"api_error\",\"message\":\"internal\"}}" },
      { status: 200, body: successBody },
    ]);
    const mod = await loadAnthropicModule();

    // Path A: 3 in a row → return final 5xx as typed ProviderError.
    const failResult = await mod.runAnthropicRequest({
      ...BASE_CONFIG,
      fetchImpl: stub.fetch,
    });
    expect(failResult).toMatchObject({ ok: false });
    const failError = (failResult as { readonly error: { readonly code: string; readonly status: number } }).error;
    expect(failError.code).toBe("anthropic_4xx");
    expect(failError.status).toBe(500);

    // Path B: transient 500 recovers on retry.
    const successResult = await mod.runAnthropicRequest({
      ...BASE_CONFIG,
      fetchImpl: stubSuccessThenFail.fetch,
    });
    expect(successResult).toMatchObject({ ok: true, endpoint: "anthropic" });
    expect(stubSuccessThenFail.calls).toHaveLength(2);
  });
});

describe("auto-model resolver — anthropic provider", () => {
  it("ANTH-AUTO-001 returns claude-sonnet-4.6 for provider=anthropic regardless of apiUrl", async () => {
    const autoMod = (await expectFutureModule("../../src/cli/auto-model.js")) as {
      readonly resolveAutoModel: (input: {
        readonly provider: "openai-compatible" | "copilot" | "anthropic";
        readonly apiUrl: string | null;
        readonly env: NodeJS.ProcessEnv;
      }) => string;
    };
    expect(autoMod.resolveAutoModel({ provider: "anthropic", apiUrl: null, env: {} })).toBe("claude-sonnet-4.6");
    expect(autoMod.resolveAutoModel({ provider: "anthropic", apiUrl: "https://example.com", env: {} })).toBe("claude-sonnet-4.6");
  });
});

describe("cli/parse-args — anthropic provider value", () => {
  it("ANTH-CLI-001 --provider anthropic is accepted by parseCliArgs", async () => {
    const parseMod = (await expectFutureModule("../../src/cli/parse-args.js")) as {
      readonly parseCliArgs: (args: readonly string[]) => { readonly provider: string };
    };
    const parsed = parseMod.parseCliArgs(["--provider", "anthropic"]);
    expect(parsed.provider).toBe("anthropic");
  });
});

describe("anthropic-messages wire-shape helpers", () => {
  it("ANTH-SHAPE-001 buildAnthropicBody emits Anthropic Messages schema (top-level system, user-only messages, mandatory max_tokens)", async () => {
    const mod = (await expectFutureModule("../../src/provider/anthropic-messages.js")) as {
      readonly buildAnthropicBody: (cfg: { model: string; system: string; user: string; maxOutputTokens?: number }) => Record<string, unknown>;
    };
    const body = mod.buildAnthropicBody({ model: "claude-sonnet-4.6", system: "SYSTEM", user: "USER" });
    expect(body).toEqual({
      model: "claude-sonnet-4.6",
      system: "SYSTEM",
      messages: [{ role: "user", content: "USER" }],
      max_tokens: 4096,
    });
  });

  it("ANTH-SHAPE-001b buildAnthropicBody forwards reasoningEffort when supplied (dual-protocol gateway passthrough)", async () => {
    // Pin the fix for the Layer 5 self-review finding: the anthropic
    // branch used to silently drop --effort because the call config
    // had no `reasoningEffort` field. We now forward the value as
    // `reasoning_effort` on the wire so dual-protocol gateways
    // (MiniMax etc.) that honor it get the operator's hint. Native
    // Anthropic.com ignores unknown fields per its API spec, so the
    // worst case is a no-op, not a wire-shape error.
    const mod = (await expectFutureModule("../../src/provider/anthropic-messages.js")) as {
      readonly buildAnthropicBody: (cfg: { model: string; system: string; user: string; maxOutputTokens?: number; reasoningEffort?: "low" | "medium" | "high" }) => Record<string, unknown>;
    };
    const bodyWithEffort = mod.buildAnthropicBody({
      model: "claude-sonnet-4.6",
      system: "SYSTEM",
      user: "USER",
      reasoningEffort: "high",
    });
    expect(bodyWithEffort).toEqual({
      model: "claude-sonnet-4.6",
      system: "SYSTEM",
      messages: [{ role: "user", content: "USER" }],
      max_tokens: 4096,
      reasoning_effort: "high",
    });
    // When --effort is not set, the field is OMITTED (not sent as
    // `reasoning_effort: null` or empty) so gateways that reject
    // unknown fields stay happy.
    const bodyWithoutEffort = mod.buildAnthropicBody({
      model: "claude-sonnet-4.6",
      system: "SYSTEM",
      user: "USER",
    });
    expect(bodyWithoutEffort).not.toHaveProperty("reasoning_effort");
  });

  it("ANTH-SHAPE-002 buildAnthropicHeaders pins x-api-key + anthropic-version, never sets Authorization", async () => {
    const mod = (await expectFutureModule("../../src/provider/anthropic-messages.js")) as {
      readonly buildAnthropicHeaders: (apiKey: string, requestId: string) => Record<string, string>;
    };
    const headers = mod.buildAnthropicHeaders("sk-ant-synthetic", "req-anth-1");
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["x-api-key"]).toBe("sk-ant-synthetic");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers["x-request-id"]).toBe("req-anth-1");
    expect(headers["authorization"]).toBeUndefined();
  });

  it("ANTH-SHAPE-003 extractAnthropicTextPayload concatenates all text blocks and skips tool_use", async () => {
    const mod = (await expectFutureModule("../../src/provider/anthropic-messages.js")) as {
      readonly extractAnthropicTextPayload: (raw: string) => string;
    };
    const payload = mod.extractAnthropicTextPayload(JSON.stringify({
      content: [
        { type: "text", text: "First " },
        { type: "tool_use", id: "call_x", name: "x", input: {} },
        { type: "text", text: "second" },
      ],
    }));
    expect(payload).toBe("First second");
  });

  it("ANTH-SHAPE-005 extractAnthropicTextPayload skips reasoning blocks (no text leak into the parse path)", async () => {
    // Anthropic returns `content: [{type:"reasoning", ...}, {type:"text", text:"JSON"}]`
    // for models that emit internal reasoning. The text payload must
    // exclude reasoning blocks so the JSON parser sees only the final
    // answer.
    const mod = (await expectFutureModule("../../src/provider/anthropic-messages.js")) as {
      readonly extractAnthropicTextPayload: (raw: string) => string;
    };
    const payload = mod.extractAnthropicTextPayload(JSON.stringify({
      content: [
        { type: "reasoning", text: "Long thinking... should not appear in payload" },
        { type: "text", text: '{"summary":"only json","verdict":"APPROVED"}' },
      ],
    }));
    expect(payload).toBe('{"summary":"only json","verdict":"APPROVED"}');
  });

  it("ANTH-SHAPE-004 extractAnthropicTextPayload returns rawText for Anthropic error envelopes (no content[] array)", async () => {
    const mod = (await expectFutureModule("../../src/provider/anthropic-messages.js")) as {
      readonly extractAnthropicTextPayload: (raw: string) => string;
    };
    const errorBody = JSON.stringify({ type: "error", error: { type: "not_found_error", message: "model not found" } });
    const payload = mod.extractAnthropicTextPayload(errorBody);
    // Falls back to the raw JSON string so the downstream
    // `detectProviderError` can recognize the error envelope.
    expect(payload).toBe(errorBody);
  });
});

describe("config/field-schema — provider enum", () => {
  it("ANTH-FIELD-001 provider field lists anthropic alongside openai-compatible and copilot", async () => {
    const fieldMod = (await expectFutureModule("../../src/config/field-schema.js")) as {
      readonly FIELDS: { readonly provider: { readonly enumValues: readonly string[] } };
    };
    expect(fieldMod.FIELDS.provider.enumValues).toContain("anthropic");
    expect(fieldMod.FIELDS.provider.enumValues).toContain("openai-compatible");
    expect(fieldMod.FIELDS.provider.enumValues).toContain("copilot");
  });
});
