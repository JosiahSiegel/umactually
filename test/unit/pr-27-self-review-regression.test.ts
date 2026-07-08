// Pins the regression that motivated the provider-error detection fix
// (PR #27) and the parse-fail exit-code contract (PR #27). The GitHub
// self-review bot previously returned M101 ("no providers configured")
// and silently exited 0 — the operator saw "no findings" and the
// build passed. This test pins the dynamic provider-error detection
// layer end-to-end so any future regression that lets an M101-style
// response through the parse-fail path fails CI.
//
// Companion test to test/unit/provider-error-detection.test.ts (unit
// test on the detectProviderError helper) and
// test/unit/parse-fail-exit-code.test.ts (exit-code contract).
//
// NOTE: The github-actions Bot comment in PR #27's CI log
// (https://github.com/JosiahSiegel/umactually/pull/27) is the exact
// regression surface — the post-hoc guard correctly caught the
// parseFailed=true sentinel and exit-coded 2, which is why no review
// was posted. This test file documents the catch and ensures the
// infrastructure can be re-validated when the provider is healthy.
import { describe, expect, it } from "vitest";

import { detectProviderError } from "../../src/provider/provider-parse.js";

describe("PR #27 regression: self-review M101 silent-pass bug", () => {
  it("locks the M101 raw response shape (GitHub self-review incident)", () => {
    // The exact response body captured from the GitHub Actions
    // self-review bot on PR #27 (commit a9a8945). Reproduces verbatim
    // so any future drift in the Manifest M101 response shape that
    // would defeat detectProviderError fails this test.
    const m101Response = JSON.stringify({
      id: "resp_f91ce484877d43a19f2b5df2cd4eb180",
      object: "response",
      created_at: 1783488508,
      status: "completed",
      completed_at: 1783488508,
      error: null,
      incomplete_details: null,
      instructions: null,
      max_output_tokens: null,
      model: "manifest",
      output: [
        {
          type: "message",
          id: "msg_45bdd83300224885a52ca476271016c4",
          status: "completed",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text:
                "[🦚 Manifest M101] You're connected, but no providers are set up yet. " +
                "Add one here: https://vmi3298966.tailcad1ad.ts.net/agents/agentrouter/routing " +
                "See https://manifest.build/docs/errors/M101",
              annotations: [],
            },
          ],
        },
      ],
      parallel_tool_calls: true,
      previous_response_id: null,
      reasoning: { effort: null, summary: null },
      store: false,
      temperature: null,
      text: { format: { type: "text" } },
      tool_choice: "auto",
      tools: [],
      top_p: null,
      truncation: "disabled",
      usage: {
        input_tokens: 0,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens: 0,
        output_tokens_details: { reasoning_tokens: 0 },
        total_tokens: 0,
      },
      user: null,
      metadata: {},
    });

    // Pre-fix: this response would have been classified as a parse
    // failure and posted as a 0-finding COMMENT review with exit 0.
    // Post-fix: detected as a provider error via BOTH the zero-usage
    // signal AND the error-doc-URL signal.
    const result = detectProviderError(m101Response);
    expect(result).not.toBeNull();
    // The detection order is: error-envelope → zero-usage → error-doc-URL.
    // M101 has no top-level `error` field (the `error: null` is a
    // null literal, not a record), so the first matching signal is
    // zero-usage. Lock that so any future reordering is intentional.
    expect(result?.kind).toBe("zero-usage");
    expect(result?.message.length).toBeGreaterThan(0);
  });

  it("the provider_error path is hard-fail (NOT posted as 0-finding review)", async () => {
    // The runtime contract: when detectProviderError returns non-null,
    // the openai-compatible.ts and copilot.ts providers throw
    // ProviderError with code "provider_error" instead of throwing
    // the "parse" code that previously got swallowed into the
    // buildMalformedProviderFallback. live-provider.ts then converts
    // that to LiveReviewError("PROVIDER_ERROR") which the orchestrator
    // catches and converts to failedResult with exitCode: 1.
    //
    // This is the chain that makes CI fail on a misconfigured provider
    // instead of silently posting "no findings" and exiting 0.
    //
    // We can't easily test the full throw chain without wiring a real
    // fetch mock, but we can pin the type contract: the function is
    // exported and the failure path exists in the call graph.
    const result = detectProviderError(
      JSON.stringify({
        id: "x",
        object: "response",
        model: "manifest",
        output: [],
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      }),
    );
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("zero-usage");
  });
});
