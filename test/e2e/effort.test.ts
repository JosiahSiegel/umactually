import { afterEach, describe, expect, it } from "vitest";
import { API_KEY, GITHUB_TOKEN, MODEL, runEffortCli, startEffortFixture, type EffortFixture } from "../helpers/effort-cli-fixture.js";

// These contracts must execute the published shim under Node 24, not skip on older runtimes.
describe("built CLI effort reaches local HTTP wire", () => {
  let fixture: EffortFixture | undefined;
  afterEach(async () => { await fixture?.close(); fixture = undefined; });

  it.each([
    { name: "flag beats env and saved", saved: "low", env: "high", flags: ["--effort", "xhigh"], expected: "xhigh" },
    { name: "env beats saved", saved: "low", env: "max", flags: [], expected: "max" },
    { name: "saved beats absent default", saved: "high", env: undefined, flags: [], expected: "high" },
    { name: "unset does not invent medium", saved: undefined, env: undefined, flags: [], expected: undefined },
    { name: "explicit none stays explicit", saved: "high", env: undefined, flags: ["--effort", "none"], expected: "none" },
    { name: "minimal stays explicit", saved: undefined, env: "minimal", flags: [], expected: "minimal" },
    { name: "medium stays explicit", saved: undefined, env: "medium", flags: [], expected: "medium" },
    { name: "low stays explicit", saved: undefined, env: "low", flags: [], expected: "low" },
  ])("Responses: $name; opaque model is unchanged", async scenario => {
    // Given: isolated home with intentionally distinct precedence tiers.
    fixture = await startEffortFixture();
    await fixture.save(scenario.saved);
    // When: a real built CLI reviews a local file.
    const result = await runEffortCli(fixture, { flags: scenario.flags,
      ...(scenario.env === undefined ? {} : { envEffort: scenario.env }) });
    // Then: exactly one inference, precise effort shape, opaque model, and no credential leak.
    expect(result.status, result.stderr).toBe(0);
    expect(fixture.calls).toHaveLength(1);
    const call = fixture.calls[0];
    expect(call?.path).toBe("/v1/responses");
    expect(call?.body["model"]).toBe(MODEL);
    expect(call?.body["reasoning"]).toEqual(scenario.expected === undefined ? undefined : { effort: scenario.expected });
    expect(call?.body).not.toHaveProperty("reasoning_effort");
    expect(call?.body).not.toHaveProperty("output_config");
    expect(result.stdout + result.stderr + await fixture.artifact() + JSON.stringify(fixture.calls)).not.toContain(API_KEY);
  });

  it.each(["xhigh", "max"])("Chat fallback preserves explicit %s without remapping", async effort => {
    // Given: a server supporting Chat but not Responses.
    fixture = await startEffortFixture("chat");
    await fixture.save();
    // When: explicit effort is sent through the built CLI.
    const result = await runEffortCli(fixture, { flags: ["--effort", effort] });
    // Then: route fallback preserves effort on both protocol-specific bodies.
    expect(result.status, result.stderr).toBe(0);
    expect(fixture.calls.map(call => call.path)).toEqual(["/v1/responses", "/v1/chat/completions"]);
    expect(fixture.calls[0]?.body["reasoning"]).toEqual({ effort });
    expect(fixture.calls[1]?.body["reasoning_effort"]).toBe(effort);
    expect(fixture.calls[1]?.body["model"]).toBe(MODEL);
    expect(fixture.calls[1]?.body).not.toHaveProperty("reasoning");
    expect(fixture.calls[1]?.body).not.toHaveProperty("output_config");
  });

  it.each([undefined, "high", "xhigh", "max"])("Anthropic maps %s only to output_config", async effort => {
    // Given: an opaque alias on a native Anthropic endpoint.
    fixture = await startEffortFixture("anthropic");
    await fixture.save(effort);
    // When: saved effort is resolved by the built CLI.
    const result = await runEffortCli(fixture);
    // Then: no OpenAI-specific field crosses the native wire.
    expect(result.status, result.stderr).toBe(0);
    expect(fixture.calls).toHaveLength(1);
    expect(fixture.calls[0]?.path).toBe("/v1/messages");
    expect(fixture.calls[0]?.body["model"]).toBe(MODEL);
    expect(fixture.calls[0]?.body["output_config"]).toEqual(effort === undefined ? undefined : { effort });
    expect(fixture.calls[0]?.body).not.toHaveProperty("reasoning");
    expect(fixture.calls[0]?.body).not.toHaveProperty("reasoning_effort");
    expect(result.stdout + result.stderr + await fixture.artifact()).not.toContain(API_KEY);
  });

  it.each(["none", "minimal"])("Anthropic rejects %s before HTTP", async effort => {
    // Given: a valid shared effort that Anthropic cannot represent.
    fixture = await startEffortFixture("anthropic");
    await fixture.save();
    // When: the operator explicitly selects it.
    const result = await runEffortCli(fixture, { flags: ["--effort", effort] });
    // Then: failure must not quietly omit or downgrade the effort.
    expect(result.status).toBeTypeOf("number");
    expect(result.status).not.toBe(0);
    expect(fixture.calls).toHaveLength(0);
    expect(result.stdout + result.stderr).toMatch(/effort/i);
    expect(result.stdout + result.stderr).not.toContain(API_KEY);
  });

  it("fails on provider effort rejection without retry or protocol downgrade", async () => {
    // Given: a provider rejects effort and echoes a synthetic credential in its error.
    fixture = await startEffortFixture("reject");
    await fixture.save();
    // When: explicit xhigh reaches the provider.
    const result = await runEffortCli(fixture, { flags: ["--effort", "xhigh"] });
    // Then: real exit status is nonzero, the exact request is preserved, errors are scrubbed.
    expect(result.status).toBeTypeOf("number");
    expect(result.status).not.toBe(0);
    expect(fixture.calls).toHaveLength(1);
    expect(fixture.calls[0]?.body["reasoning"]).toEqual({ effort: "xhigh" });
    expect(result.stdout + result.stderr).toMatch(/effort/i);
    expect(result.stdout + result.stderr).not.toContain(API_KEY);
  });

  it("Copilot preserves xhigh on the fixed chat endpoint without leaking credentials", async () => {
    // Given: a Copilot token exchange and chat API are intercepted to the local fixture.
    fixture = await startEffortFixture("copilot");
    await fixture.save("xhigh", "copilot");
    // When: a real Node 24 child runs the Copilot provider through the bin shim.
    const result = await runEffortCli(fixture, { copilot: true });
    // Then: token exchange and chat carry the expected opaque model and effort shape.
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).not.toContain("UMACTUALLY_API_KEY");
    expect(fixture.calls.map(call => call.path)).toEqual([
      "/copilot_internal/v2/token",
      "/copilot/chat/completions",
    ]);
    expect(fixture.calls[0]?.headers["authorization"]).toBe("[REDACTED]");
    expect(fixture.calls[0]?.headers["x-api-key"]).toBeUndefined();
    expect(fixture.calls[1]?.headers["authorization"]).toBe("[REDACTED]");
    expect(fixture.calls[1]?.headers["x-api-key"]).toBeUndefined();
    expect(fixture.calls[1]?.body["model"]).toBe(MODEL);
    expect(fixture.calls[1]?.body["reasoning_effort"]).toBe("xhigh");
    expect(fixture.calls[1]?.body).not.toHaveProperty("reasoning");
    const captured = JSON.stringify(fixture.calls);
    expect(captured).not.toContain(API_KEY);
    expect(captured).not.toContain(GITHUB_TOKEN);
    expect(result.stdout + result.stderr).not.toContain(API_KEY);
    expect(result.stdout + result.stderr).not.toContain(GITHUB_TOKEN);
  });

  it("Copilot rejects a missing GitHub token before contacting the provider", async () => {
    // Given: Copilot configuration with neither a generic API key nor GitHub token.
    fixture = await startEffortFixture("copilot");
    await fixture.save("xhigh", "copilot");
    // When: the real bin wrapper starts without the Copilot credential.
    const result = await runEffortCli(fixture, { copilot: true, omitGithubToken: true });
    // Then: validation fails nonzero and no provider request is attempted.
    expect(result.status).not.toBe(0);
    expect(fixture.calls).toHaveLength(0);
    expect(result.stdout + result.stderr).toMatch(/GITHUB_TOKEN|github token/i);
    expect(result.stdout + result.stderr).not.toContain(API_KEY);
  });

  it("PR resolution uses the same flag > env > saved precedence as local files", async () => {
    // Given: local mock GitHub and inference routes with conflicting precedence values.
    fixture = await startEffortFixture();
    await fixture.save("low");
    // When: CI PR context resolves the same explicit xhigh used by the local-file case.
    const result = await runEffortCli(fixture, { pr: true, envEffort: "high", flags: ["--effort", "xhigh"] });
    // Then: provider wire and live platform access prove this was not a dry run.
    expect(result.status, result.stderr).toBe(0);
    expect(fixture.calls).toHaveLength(1);
    expect(fixture.calls[0]?.body["reasoning"]).toEqual({ effort: "xhigh" });
    expect(fixture.calls[0]?.body["model"]).toBe(MODEL);
    expect(fixture.platformCalls).toContain("GET /repos/example/effort/pulls/42");
    expect(fixture.platformCalls).toContain("POST /repos/example/effort/pulls/42/reviews");
    expect(result.stdout + result.stderr).not.toContain(API_KEY);
    expect(result.stdout + result.stderr).not.toContain("fixture-platform-token");
  });
});
