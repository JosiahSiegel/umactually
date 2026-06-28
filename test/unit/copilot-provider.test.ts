// allow: SIZE_OK — single Copilot provider RED test file (4 Given/When/Then cases + shared stub helper)
import { beforeEach, describe, expect, it } from "vitest";

import { expectFutureExport } from "../helpers/assert-red-module.js";
import { clearCopilotTokenCache } from "../../src/provider/copilot-token.js";

type FetchResponseInit = {
  readonly status: number;
  readonly body: string;
  readonly contentType?: string;
};

type RecordedRequest = {
  readonly url: string;
  readonly method: string;
  readonly authorization: string | null;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: unknown;
};

type FetchStub = {
  readonly calls: readonly RecordedRequest[];
  fetch: typeof fetch;
};

function makeFetchStub(responses: readonly FetchResponseInit[]): FetchStub {
  const calls: RecordedRequest[] = [];
  let index = 0;

  const stubbed: typeof fetch = async (input, init) => {
    const requestUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const requestInit = init ?? {};
    const method = requestInit.method ?? "GET";
    const headers = new Headers(requestInit.headers);
    const rawBody = requestInit.body;
    const parsedBody: unknown =
      typeof rawBody === "string"
        ? safeParseJson(rawBody)
        : rawBody === undefined
          ? null
          : rawBody;
    const authorization = headers.has("authorization") ? headers.get("authorization") : null;
    const headerRecord: Record<string, string> = {};
    headers.forEach((value, key) => {
      headerRecord[key.toLowerCase()] = value;
    });
    calls.push({ url: requestUrl, method, authorization, headers: headerRecord, body: parsedBody });

    const slot = responses[index];
    if (slot === undefined) {
      throw new Error(`fetch stub exhausted at call #${index + 1}`);
    }
    index += 1;

    return makeResponse(slot);
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

function makeResponse(init: FetchResponseInit): Response {
  const contentType = init.contentType ?? "application/json";
  return new Response(init.body, {
    status: init.status,
    headers: { "content-type": contentType },
  });
}

const copilotModulePath = "../../src/provider/copilot.js";
const copilotImplementationPath = "src/provider/copilot.ts";

const FAR_FUTURE_EXPIRY = 9_999_999_999;

const TOKEN_ENVELOPE_DEFAULT = JSON.stringify({
  token: "tid=synthetic",
  expires_at: FAR_FUTURE_EXPIRY,
  endpoints: { api: "https://api.individual.githubcopilot.com" },
});

const TOKEN_ENVELOPE_GHE = JSON.stringify({
  token: "tid=ghe",
  expires_at: FAR_FUTURE_EXPIRY,
  endpoints: { api: "https://api.individual.githubcopilot.com" },
});

const CHAT_SUCCESS_BODY = JSON.stringify({
  id: "chatcmpl_copilot_001",
  model: "gpt-5",
  choices: [
    {
      message: {
        role: "assistant",
        content: '{"summary":"copilot review","verdict":"SHIP","comments":[],"suppressed_comments":[]}',
      },
      finish_reason: "stop",
    },
  ],
});

const BASE_INPUT = {
  githubToken: "gho_test",
  apiBase: undefined as string | undefined,
  system: "s",
  user: "u",
  model: "gpt-5",
  requestTimeoutMs: 5_000,
} as const;

async function loadRunCopilotRequest(): Promise<
  (input: typeof BASE_INPUT & { readonly fetchImpl: typeof fetch }) => Promise<unknown>
> {
  const runCopilot = await expectFutureExport(copilotModulePath, "runCopilotRequest");
  if (typeof runCopilot !== "function") {
    expect.fail(`RED: ${copilotImplementationPath} must export runCopilotRequest as a function`);
  }
  return runCopilot as (input: typeof BASE_INPUT & { readonly fetchImpl: typeof fetch }) => Promise<unknown>;
}

describe("Copilot provider RED contract", () => {
  beforeEach(() => {
    clearCopilotTokenCache();
  });

  it("S7-RED-016 module exports runCopilotRequest as a function", async () => {
    // Given: the future module path that does not exist yet.
    const runCopilot = await expectFutureExport(copilotModulePath, "runCopilotRequest");

    // Then: the export resolves to a function so it can be wired into the provider pipeline.
    expect(typeof runCopilot).toBe("function");
  });

  it("S7-RED-017 token endpoint uses `Authorization: token <githubToken>` (NOT Bearer) and reads endpoints.api", async () => {
    // Given: a token endpoint at the default api.github.com base returning an envelope with endpoints.api,
    // and a chat endpoint at the envelope's api host.
    const stub = makeFetchStub([
      { status: 200, body: TOKEN_ENVELOPE_DEFAULT },
      { status: 200, body: CHAT_SUCCESS_BODY },
    ]);
    const runCopilotRequest = await loadRunCopilotRequest();

    // When: the client runs a Copilot request with the synthetic GitHub token.
    await runCopilotRequest({ ...BASE_INPUT, fetchImpl: stub.fetch });

    // Then: the token call uses `token <githubToken>` (NOT Bearer), reads endpoints.api,
    // the chat call uses Bearer with the session token, and the required editor headers are present.
    expect(stub.calls).toHaveLength(2);
    const tokenCall = stub.calls[0];
    const chatCall = stub.calls[1];
    expect(tokenCall?.authorization).toBe("token gho_test");
    expect(tokenCall?.authorization?.toLowerCase().startsWith("bearer ")).toBe(false);
    expect(tokenCall?.url).toBe("https://api.github.com/copilot_internal/v2/token");
    expect(chatCall?.url).toBe("https://api.individual.githubcopilot.com/chat/completions");
    expect(chatCall?.authorization).toBe("Bearer tid=synthetic");
    const chatBody = chatCall?.body as Record<string, unknown> | null;
    expect(chatBody?.["model"]).toBe("gpt-5");
    expect(tokenCall?.headers["editor-version"]).toBe("vscode/1.96.0");
    expect(tokenCall?.headers["editor-plugin-version"]).toBe("umactually-pr-review/0.1.0");
    expect(tokenCall?.headers["copilot-integration-id"]).toBe("vscode-chat");
    expect(tokenCall?.headers["user-agent"]).toBe("umactually-pr-review/0.1.0");
  });

  it("S7-RED-018 token cache: second call within expiry window skips token endpoint", async () => {
    // Given: a token endpoint with a far-future expiry, and two chat responses queued.
    const stub = makeFetchStub([
      { status: 200, body: TOKEN_ENVELOPE_DEFAULT },
      { status: 200, body: CHAT_SUCCESS_BODY },
      { status: 200, body: CHAT_SUCCESS_BODY },
    ]);
    const runCopilotRequest = await loadRunCopilotRequest();

    // When: the same Copilot request is issued twice with the same GitHub token.
    await runCopilotRequest({ ...BASE_INPUT, fetchImpl: stub.fetch });
    await runCopilotRequest({ ...BASE_INPUT, fetchImpl: stub.fetch });

    // Then: the token endpoint is hit exactly once (cached on the second call)
    // and the chat endpoint is hit twice (once per request).
    expect(stub.calls).toHaveLength(3);
    const tokenCalls = stub.calls.filter((call) => call.url.endsWith("/copilot_internal/v2/token"));
    const chatCalls = stub.calls.filter((call) => call.url.endsWith("/chat/completions"));
    expect(tokenCalls).toHaveLength(1);
    expect(chatCalls).toHaveLength(2);
  });

  it("S7-RED-019 honors apiBase override for GitHub Enterprise Server", async () => {
    // Given: a GitHub Enterprise Server base URL and a token envelope whose endpoints.api
    // still points at the Copilot cloud host.
    const apiBase = "https://my-ghe.example.com";
    const stub = makeFetchStub([
      { status: 200, body: TOKEN_ENVELOPE_GHE },
      { status: 200, body: CHAT_SUCCESS_BODY },
    ]);
    const runCopilotRequest = await loadRunCopilotRequest();

    // When: the client runs a Copilot request with the GHE apiBase override.
    await runCopilotRequest({ ...BASE_INPUT, apiBase, fetchImpl: stub.fetch });

    // Then: the token call targets the GHE base at /api/copilot_internal/v2/token,
    // and the chat call still targets the envelope's endpoints.api host.
    expect(stub.calls).toHaveLength(2);
    const tokenCall = stub.calls[0];
    const chatCall = stub.calls[1];
    expect(tokenCall?.url).toBe("https://my-ghe.example.com/api/copilot_internal/v2/token");
    expect(tokenCall?.authorization).toBe("token gho_test");
    expect(chatCall?.url).toBe("https://api.individual.githubcopilot.com/chat/completions");
    expect(chatCall?.authorization).toBe("Bearer tid=ghe");
  });
});
