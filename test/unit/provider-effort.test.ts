import { beforeEach, expect, it } from "vitest";
import { parseCliArgs } from "../../src/cli/parse-args.js";
import { requestLiveReview } from "../../src/cli/live-provider.js";
import { runProviderRequest } from "../../src/provider/openai-compatible.js";
import { buildAnthropicBody, runAnthropicRequest } from "../../src/provider/anthropic-messages.js";
import { runCopilotRequest } from "../../src/provider/copilot.js";
import { clearCopilotTokenCache } from "../../src/provider/copilot-token.js";
import { buildChatBody, buildResponsesBody } from "../../src/provider/provider-parse.js";
import { isRoutableFailureForCrossProtocol, isRoutableFailureForUrlCandidate } from "../../src/provider/provider-error.js";

const base = { baseUrl: "https://gateway.invalid/custom", apiKey: "secret.+[]key", model: "opaque-alias", system: "system", user: "diff", requestTimeoutMs: 1000 };
const review = JSON.stringify({ summary: "Reviewed", verdict: "SHIP", comments: [], suppressed_comments: [] });
const success = JSON.stringify({ output_text: review, choices: [{ message: { content: review } }], content: [{ type: "text", text: review }] });
const session = JSON.stringify({ token: "session-secret", expires_at: 9999999999, endpoints: { api: "https://copilot.invalid" } });
function wire(replies: readonly { readonly status: number; readonly body: string }[]) {
  const bodies: unknown[] = [];
  const fetchImpl: typeof fetch = async (_url, init) => {
    const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : null;
    bodies.push(body);
    const reply = replies[Math.min(bodies.length - 1, replies.length - 1)];
    if (reply === undefined) throw new Error("Missing fixture");
    return new Response(reply.body, { status: reply.status });
  };
  return { bodies, fetchImpl };
}
const runners = [
  { name: "responses", run: runProviderRequest, field: "reasoning", expected: (effort: string) => ({ effort }) },
  { name: "anthropic", run: runAnthropicRequest, field: "output_config", expected: (effort: string) => ({ effort }) },
] as const;

beforeEach(() => clearCopilotTokenCache());

for (const effort of ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const) {
  it(`serializes ${effort} natively when building OpenAI bodies`, () => {
    // Given
    const config = { ...base, reasoningEffort: effort };
    // When
    const responses = buildResponsesBody(config);
    const chat = buildChatBody(config);
    // Then
    expect(responses).toHaveProperty("reasoning", { effort });
    expect(chat).toHaveProperty("reasoning_effort", effort);
  });
}
for (const adapter of runners) {
  for (const effort of [undefined, "xhigh", "max"] as const) {
    it(`${adapter.name} preserves ${effort} when recovering a malformed review`, async () => {
      // Given
      const stub = wire([{ status: 200, body: "not JSON" }, { status: 200, body: success }]);
      // When
      const result = await adapter.run({ ...base, ...stub, ...(effort === undefined ? {} : { reasoningEffort: effort }) });
      // Then
      expect(result.ok).toBe(true);
      expect(stub.bodies).toHaveLength(2);
      for (const body of stub.bodies) {
        if (effort === undefined) expect(body).not.toHaveProperty(adapter.field);
        else expect(body).toHaveProperty(adapter.field, adapter.expected(effort));
        expect(body).not.toHaveProperty("thinking");
      }
    });
  }
  for (const status of [400, 404, 422, 200]) {
    for (const recovery of [false, true]) {
      it(`${adapter.name} surfaces sanitized effort rejection ${status} when recovery=${recovery}`, async () => {
        // Given
        const rejection = { status, body: JSON.stringify({ error: { message: `Unsupported effort max for opaque-alias; ${base.apiKey}`, param: "reasoning_effort" } }) };
        const stub = wire(recovery ? [{ status: 200, body: "not JSON" }, rejection] : [rejection]);
        // When
        const result = await adapter.run({ ...base, ...stub, reasoningEffort: "max" });
        // Then
        expect(result.ok).toBe(false);
        if (result.ok) throw new Error("Expected rejection");
        expect(result.error.message).toContain("Unsupported effort max");
        expect(result.error.message).toMatch(/choose.*supported effort.*omit/iu);
        expect(JSON.stringify(result.error)).not.toContain(base.apiKey);
        expect(result.error.message).not.toContain(base.apiKey);
        expect(isRoutableFailureForUrlCandidate(result.error)).toBe(false);
        expect(isRoutableFailureForCrossProtocol(result.error)).toBe(false);
        expect(stub.bodies).toHaveLength(recovery ? 2 : 1);
      });
    }
  }
}
for (const effort of ["none", "minimal"] as const) {
  it(`rejects Anthropic ${effort} before inference`, async () => {
    // Given
    const stub = wire([{ status: 200, body: success }]);
    // When
    const result = await runAnthropicRequest({ ...base, ...stub, reasoningEffort: effort });
    // Then
    expect(result.ok).toBe(false);
    expect(stub.bodies).toHaveLength(0);
    expect(() => buildAnthropicBody({ ...base, reasoningEffort: effort })).toThrow(/supported effort.*omit/iu);
  });
}
for (const effort of [undefined, "xhigh", "max"] as const) {
  it(`preserves ${effort} through Responses to Chat 404 fallback and recovery`, async () => {
    // Given
    const stub = wire([{ status: 404, body: "route missing" }, { status: 200, body: "not JSON" }, { status: 200, body: success }]);
    // When
    const result = await runProviderRequest({ ...base, ...stub, ...(effort === undefined ? {} : { reasoningEffort: effort }) });
    // Then
    expect(result.ok).toBe(true);
    expect(stub.bodies).toHaveLength(3);
    for (const body of stub.bodies.slice(1)) {
      if (effort === undefined) expect(body).not.toHaveProperty("reasoning_effort");
      else expect(body).toHaveProperty("reasoning_effort", effort);
    }
  });
  it(`sends Copilot ${effort} unchanged when recovering`, async () => {
    // Given
    const stub = wire([{ status: 200, body: session }, { status: 200, body: "not JSON" }, { status: 200, body: success }]);
    // When
    const result = await runCopilotRequest({ ...base, ...stub, githubToken: "github-secret", apiBase: undefined, ...(effort === undefined ? {} : { reasoningEffort: effort }) });
    // Then
    expect(result.ok).toBe(true);
    expect(stub.bodies).toHaveLength(3);
    for (const body of stub.bodies.slice(1)) {
      if (effort === undefined) expect(body).not.toHaveProperty("reasoning_effort");
      else expect(body).toHaveProperty("reasoning_effort", effort);
    }
  });
}
for (const provider of ["anthropic", "openai-compatible"] as const) {
  for (const effort of [undefined, "xhigh", "max"] as const) {
    it(`preserves ${effort} when dispatching away from ${provider} on genuine 404`, async () => {
      // Given
      const bodies: unknown[] = [];
      const fetchImpl: typeof fetch = async (url, init) => {
        const body: unknown = typeof init?.body === "string" ? JSON.parse(init.body) : null;
        bodies.push(body);
        const anthropic = String(url).endsWith("/messages");
        const fallback = provider === "anthropic" ? !anthropic : anthropic;
        return new Response(fallback ? success : "route missing", { status: fallback ? 200 : 404 });
      };
      const parsed = parseCliArgs(["--provider", provider, "--api-url", base.baseUrl,
        "--api-key", base.apiKey, "--model", base.model, ...(effort === undefined ? [] : ["--effort", effort])]);
      // When
      await requestLiveReview({ parsed, cwd: process.cwd(), env: {}, fetchImpl, platform: "github", diffText: "+safe line", platformToken: "platform-secret" });
      // Then
      expect(bodies.length).toBeGreaterThan(1);
      const final = bodies.at(-1);
      const field = provider === "anthropic" ? "reasoning" : "output_config";
      if (effort === undefined) expect(final).not.toHaveProperty(field);
      else expect(final).toHaveProperty(field, { effort });
    }, 30_000);
  }
}

for (const recovery of [false, true]) {
  it(`sanitizes both Copilot tokens when effort is rejected on recovery=${recovery}`, async () => {
    // Given
    const rejection = { status: 400, body: JSON.stringify({ error: { message: "reasoning_effort max unsupported github-secret session-secret" } }) };
    const stub = wire([{ status: 200, body: session }, ...(recovery ? [{ status: 200, body: "not JSON" }] : []), rejection]);
    // When
    const result = await runCopilotRequest({ ...base, ...stub, githubToken: "github-secret", apiBase: undefined, reasoningEffort: "max" });
    // Then
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected rejection");
    expect(result.error.message).toMatch(/supported effort.*omit/iu);
    expect(`${result.error.message}${JSON.stringify(result.error)}`).not.toMatch(/github-secret|session-secret/u);
    expect(stub.bodies).toHaveLength(recovery ? 3 : 2);
  });
}
