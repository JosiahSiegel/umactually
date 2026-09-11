import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseCliArgs } from "../../src/cli/parse-args.js";
import { resolveFromSchema } from "../../src/config/field-resolution.js";
import { collectValidationErrors } from "../../src/cli/validate.js";
import { requestLiveReview } from "../../src/cli/live-provider.js";

describe("family-aware runtime credentials", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "uma-family-credentials-"));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it.each(["GITHUB_TOKEN", "GH_TOKEN"])("uses %s for Copilot exchange and retains effort on retry", async (alias) => {
    // Given: a Copilot invocation without a generic API key.
    const parsed = parseCliArgs(["--provider", "copilot", "--model", "gpt-5", "--effort", "high"]);
    const calls: { readonly headers: Headers; readonly body: unknown }[] = [];
    const fetchImpl: typeof fetch = async (_url, init) => {
      calls.push({ headers: new Headers(init?.headers), body: typeof init?.body === "string" ? JSON.parse(init.body) : null });
      if (calls.length === 1) return Response.json({ token: "exchanged-token", expires_at: 9999999999, endpoints: { api: "https://copilot.invalid" } });
      return Response.json({ choices: [{ message: { content: calls.length === 2 ? "not json" : JSON.stringify({ summary: "Clean", verdict: "APPROVE", comments: [] }) } }] });
    };
    // When: the real runtime dispatches through exchange and malformed-response retry.
    const result = await requestLiveReview({ parsed, cwd, env: { [alias]: `provider-token-${alias}` }, fetchImpl, platform: "azure", platformToken: "posting-only-token", diffText: "+ hello\n" });
    // Then: posting credentials never enter exchange, and both chat attempts retain effort.
    expect(result.review.summary).toBe("Clean");
    expect(calls[0]?.headers.get("authorization")).toBe(`token provider-token-${alias}`);
    expect(calls.slice(1).map((call) => call.body)).toEqual([
      expect.objectContaining({ reasoning_effort: "high" }),
      expect.objectContaining({ reasoning_effort: "high" }),
    ]);
  });

  it("rejects generic and posting keys when Copilot has no GitHub token", async () => {
    // Given
    const parsed = parseCliArgs(["--provider", "copilot", "--api-key", "generic-key"]);
    // When / Then
    await expect(requestLiveReview({ parsed, cwd, env: {}, fetchImpl: async () => { throw new Error("unexpected network"); }, platform: "azure", platformToken: "posting-only", diffText: "+ hello\n" })).rejects.toMatchObject({ code: "LIVE_CONFIG_MISSING", hint: expect.stringContaining("--github-token") });
  });

  it.each(["copilot", "anthropic", "openai-compatible"])("validates the credential for %s", (provider) => {
    // Given
    const parsed = resolveFromSchema(parseCliArgs(["--provider", provider]), { GH_TOKEN: "github-only" });
    // When
    const flags = collectValidationErrors(parsed).map((error) => error.flag);
    // Then
    expect(flags.includes("--api-key")).toBe(provider !== "copilot");
    expect(flags).not.toContain("--github-token");
  });
});
