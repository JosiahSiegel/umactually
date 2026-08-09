// Pins the provider-error detection layer: dynamic, provider-agnostic
// detection of HTTP-200 responses that carry no actual model output.
// These are the most dangerous failure class because the existing
// "parse failed" path treats them as genuine parse failures — posting
// a COMMENT review with zero findings and exiting 0, so CI sees green
// even though the model never ran.
//
// The regression that motivated this: a PR self-review bot posted
// "Parse failed — provider response was not a valid JSON review payload"
// because a router returned "no providers configured" as an HTTP 200
// response with zero token usage. The action posted a 0-finding COMMENT
// review and exited 0 — CI green, model never ran.
//
// Test matrix:
//   1. Generic router error-doc payload → provider_error
//   2. Zero-usage with no output → provider_error
//   3. Error envelope (RFC 7807 shape) → provider_error
//   4. Error-doc URL in plain text → provider_error
//   5. Valid review with zero usage → NOT a provider error (false positive guard)
//   6. Valid review with non-zero usage → NOT a provider error
//   7. Empty/garbage text → NOT a provider error (let parse-fail handle it)
import { describe, expect, it } from "vitest";

import { detectProviderError } from "../../src/provider/provider-parse.js";

describe("detectProviderError: dynamic provider-error detection", () => {
  it("detects a generic router error-doc payload", () => {
    const routerErrorResponse = JSON.stringify({
      id: "resp_router_error",
      object: "response",
      status: "completed",
      model: "router-model",
      output: [
        {
          type: "message",
          id: "msg_router_error",
          status: "completed",
          role: "assistant",
          content: [
            {
              type: "output_text",
              text: "No providers are configured. See https://router.example.invalid/docs/errors/R101",
              annotations: [],
            },
          ],
        },
      ],
    });
    const result = detectProviderError(routerErrorResponse);
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("error-doc-url");
    expect(result?.detail).toBe("/docs/errors/R101");
  });

  it("detects zero-usage with no output (connected but no model ran)", () => {
    const zeroUsageResponse = JSON.stringify({
      id: "resp_abc",
      object: "response",
      status: "completed",
      model: "some-router",
      output: [],
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    });
    const result = detectProviderError(zeroUsageResponse);
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("zero-usage");
    expect(result?.message).toContain("zero token usage");
  });

  it("detects error envelope (RFC 7807 / JSON:API shape)", () => {
    const errorEnvelopeResponse = JSON.stringify({
      error: {
        type: "model_not_found",
        message: "The requested model 'gpt-99' does not exist.",
        code: "model_not_found",
      },
    });
    const result = detectProviderError(errorEnvelopeResponse);
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("error-envelope");
    expect(result?.message).toContain("does not exist");
  });

  it("detects errors array (JSON:API spec shape)", () => {
    const errorsArrayResponse = JSON.stringify({
      errors: [
        {
          title: "Invalid API Key",
          detail: "The provided API key is not authorized.",
        },
      ],
    });
    const result = detectProviderError(errorsArrayResponse);
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("error-envelope");
    expect(result?.message).toContain("API key");
  });

  it("detects error-doc URL in plain text (non-JSON responses)", () => {
    const plainTextError =
      "Configuration error. See https://my-router.example.com/docs/errors/M503 for details.";
    const result = detectProviderError(plainTextError);
    expect(result).not.toBeNull();
    expect(result?.kind).toBe("error-doc-url");
    expect(result?.message).toContain("error documentation URL");
  });

  // False-positive guards: these must NOT trigger

  it("does NOT trigger on a valid review with zero usage (cached response)", () => {
    // Some routers emit zero usage on cached responses that DO contain
    // a valid review. The review-content check prevents a false positive.
    const validReviewZeroUsage = JSON.stringify({
      summary: "Code looks good.",
      verdict: "APPROVED",
      comments: [],
      suppressed_comments: [],
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    });
    const result = detectProviderError(validReviewZeroUsage);
    expect(result).toBeNull();
  });

  it("does NOT trigger on a valid review with non-zero usage", () => {
    const validReview = JSON.stringify({
      id: "resp_normal",
      object: "response",
      status: "completed",
      model: "gpt-5-mini",
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: '{"summary":"Found an issue.","verdict":"NEEDS_FIX","comments":[{"path":"src/app.ts","line":42,"body":"Bug here.","severity":"high","category":"bug"}],"suppressed_comments":[]}',
            },
          ],
        },
      ],
      usage: { input_tokens: 1500, output_tokens: 300, total_tokens: 1800 },
    });
    const result = detectProviderError(validReview);
    expect(result).toBeNull();
  });

  it("does NOT trigger on empty/garbage text (let parse-fail handle it)", () => {
    expect(detectProviderError("")).toBeNull();
    expect(detectProviderError("not json at all")).toBeNull();
    expect(detectProviderError("{}")).toBeNull();
  });

  it("does NOT trigger on SSE stream with real content", () => {
    const sseStream = [
      'event: response.output_text.delta',
      'data: {"type":"response.output_text.delta","delta":"{\\"summary\\":"}',
      '',
      'event: response.output_text.delta',
      'data: {"type":"response.output_text.delta","delta":"\\"Clean code.\\",\\"verdict\\":\\"APPROVED\\",\\"comments\\":[]}',
      '',
      'event: response.completed',
      'data: {"type":"response.completed","response":{"usage":{"input_tokens":100,"output_tokens":50}}}',
      '',
    ].join("\n");
    const result = detectProviderError(sseStream);
    // SSE stream has no top-level error/envelope/zero-usage/error-doc-URL,
    // and the raw text is not valid JSON, so detection returns null.
    expect(result).toBeNull();
  });
});
