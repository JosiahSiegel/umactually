// Unit tests for the `dispatchProviderResult` helper extracted from
// `src/cli/live-provider.ts`. The helper owns the dispatch tree:
//
//   if (ok) → handleSuccess
//   if (parse) → handleParse
//   if (provider_error) → throw LiveReviewError("PROVIDER_ERROR", ...)
//   else → throw LiveReviewError("PROVIDER_REQUEST_FAILED", ...)
//
// The 3 dispatch trees (Copilot, Anthropic, OpenAI-compatible) collapse
// to a single call site each. The 6 `throw new LiveReviewError` sites
// collapse to 2 inside the helper (one per error path).
//
// These tests pin the 4-case decision tree so a future refactor cannot
// silently drop a branch or short-circuit an error path.
import { describe, expect, it, vi } from "vitest";

import {
  dispatchProviderResult,
  type DispatchProviderResult,
} from "../../src/cli/live-provider.js";
import { LiveReviewError } from "../../src/cli/live-shared.js";
import type { ProviderReviewPayload } from "../../src/provider/openai-compatible.js";

const SAMPLE_REVIEW: ProviderReviewPayload = {
  summary: "ok",
  verdict: "APPROVED",
  comments: [],
  suppressed_comments: [],
};

function makeSuccess(endpoint: "responses" | "chat" | "anthropic" = "chat"): DispatchProviderResult {
  return {
    ok: true,
    endpoint,
    review: SAMPLE_REVIEW,
    requestId: "req-success",
  };
}

function makeFailure(input: {
  readonly code: string;
  readonly endpoint?: "responses" | "chat" | "anthropic";
  readonly message?: string;
  readonly rawText?: string | undefined;
  readonly truncated?: boolean | undefined;
  readonly providerErrorDetails?: { readonly kind: string; readonly message: string } | undefined;
}): DispatchProviderResult {
  const error: {
    readonly code: string;
    readonly endpoint: "responses" | "chat" | "anthropic";
    readonly message: string;
    readonly rawText: string | undefined;
    readonly truncated: boolean | undefined;
    readonly usage: undefined;
    readonly providerErrorDetails: { readonly kind: string; readonly message: string } | undefined;
  } = {
    code: input.code,
    endpoint: input.endpoint ?? "chat",
    message: input.message ?? "boom",
    rawText: input.rawText,
    truncated: input.truncated,
    usage: undefined,
    providerErrorDetails: input.providerErrorDetails,
  };
  return { ok: false, error };
}

function makeOutcome(provider: string = "github-copilot") {
  return {
    review: { summary: "x", verdict: "COMMENT", comments: [], suppressedComments: [] },
    endpoint: "chat",
    provider,
    modelId: "auto",
    severityWarnings: [],
    parseWarnings: [],
    verifiedFactsFilter: { kept: [], downgraded: [], downgradeReasons: [] },
    confidenceFilter: { kept: [], downgraded: [], reasons: [] },
  };
}

describe("dispatchProviderResult", () => {
  it("dispatch ok=true: routes to handleSuccess with the review and providerName", () => {
    const handleSuccess = vi.fn().mockReturnValue(makeOutcome());
    const handleParse = vi.fn().mockReturnValue(makeOutcome());
    const result = makeSuccess("chat");

    const outcome = dispatchProviderResult(
      result,
      "github-copilot",
      4096,
      { handleSuccess, handleParse },
    );

    expect(handleSuccess).toHaveBeenCalledTimes(1);
    expect(handleSuccess).toHaveBeenCalledWith(result, "github-copilot");
    expect(handleParse).not.toHaveBeenCalled();
    expect(outcome.provider).toBe("github-copilot");
  });

  it("dispatch ok=false, parse: routes to handleParse with rawText and maxOutputTokens", () => {
    const handleSuccess = vi.fn().mockReturnValue(makeOutcome());
    const handleParse = vi.fn().mockReturnValue(makeOutcome("openai-compatible"));
    const result = makeFailure({
      code: "parse",
      endpoint: "chat",
      rawText: "not json",
      truncated: true,
    });

    const outcome = dispatchProviderResult(
      result,
      "openai-compatible",
      4096,
      { handleSuccess, handleParse },
    );

    expect(handleParse).toHaveBeenCalledTimes(1);
    expect(handleParse).toHaveBeenCalledWith(
      result,
      "openai-compatible",
      "not json",
      4096,
    );
    expect(handleSuccess).not.toHaveBeenCalled();
    expect(outcome.provider).toBe("openai-compatible");
  });

  it("dispatch ok=false, parse with no rawText: routes to handleParse with empty string", () => {
    const handleSuccess = vi.fn().mockReturnValue(makeOutcome());
    const handleParse = vi.fn().mockReturnValue(makeOutcome());
    const result = makeFailure({ code: "parse", endpoint: "anthropic", rawText: undefined });

    dispatchProviderResult(
      result,
      "anthropic-messages",
      null,
      { handleSuccess, handleParse },
    );

    expect(handleParse).toHaveBeenCalledWith(
      result,
      "anthropic-messages",
      "",
      null,
    );
  });

  it("dispatch ok=false, provider_error: throws LiveReviewError(PROVIDER_ERROR) with providerErrorDetails.message", () => {
    const handleSuccess = vi.fn().mockReturnValue(makeOutcome());
    const handleParse = vi.fn().mockReturnValue(makeOutcome());
    const failure: DispatchProviderResult = makeFailure({
      code: "provider_error",
      endpoint: "chat",
      message: "fallback message",
      providerErrorDetails: { kind: "error-envelope", message: "Configure routing" },
    });
    if (failure.ok) {
      throw new Error("expected failure");
    }
    const errorRef = failure.error;

    expect(() =>
      dispatchProviderResult(
        failure,
        "github-copilot",
        null,
        { handleSuccess, handleParse },
      ),
    ).toThrow(LiveReviewError);

    try {
      dispatchProviderResult(
        failure,
        "github-copilot",
        null,
        { handleSuccess, handleParse },
      );
      throw new Error("expected to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(LiveReviewError);
      const live = error as LiveReviewError;
      expect(live.code).toBe("PROVIDER_ERROR");
      expect(live.message).toBe("Configure routing");
      expect(live.cause).toBe(errorRef);
    }

    expect(handleSuccess).not.toHaveBeenCalled();
    expect(handleParse).not.toHaveBeenCalled();
  });

  it("dispatch ok=false, provider_error with no details: throws with error.message", () => {
    const handleSuccess = vi.fn().mockReturnValue(makeOutcome());
    const handleParse = vi.fn().mockReturnValue(makeOutcome());
    const failure: DispatchProviderResult = makeFailure({
      code: "provider_error",
      endpoint: "responses",
      message: "Provider refused the request",
      providerErrorDetails: undefined,
    });

    try {
      dispatchProviderResult(
        failure,
        "openai-compatible",
        null,
        { handleSuccess, handleParse },
      );
      throw new Error("expected to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(LiveReviewError);
      const live = error as LiveReviewError;
      expect(live.code).toBe("PROVIDER_ERROR");
      expect(live.message).toBe("Provider refused the request");
    }
  });

  it("dispatch ok=false, other (network): throws LiveReviewError(PROVIDER_REQUEST_FAILED) with error.message", () => {
    const handleSuccess = vi.fn().mockReturnValue(makeOutcome());
    const handleParse = vi.fn().mockReturnValue(makeOutcome());
    const failure: DispatchProviderResult = makeFailure({
      code: "network",
      endpoint: "chat",
      message: "ECONNRESET",
    });
    if (failure.ok) {
      throw new Error("expected failure");
    }
    const errorRef = failure.error;

    try {
      dispatchProviderResult(
        failure,
        "github-copilot",
        null,
        { handleSuccess, handleParse },
      );
      throw new Error("expected to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(LiveReviewError);
      const live = error as LiveReviewError;
      expect(live.code).toBe("PROVIDER_REQUEST_FAILED");
      expect(live.message).toBe("ECONNRESET");
      expect(live.cause).toBe(errorRef);
    }

    expect(handleSuccess).not.toHaveBeenCalled();
    expect(handleParse).not.toHaveBeenCalled();
  });

  it("dispatch ok=false, timeout: throws LiveReviewError(PROVIDER_REQUEST_FAILED)", () => {
    const handleSuccess = vi.fn().mockReturnValue(makeOutcome());
    const handleParse = vi.fn().mockReturnValue(makeOutcome());
    const failure: DispatchProviderResult = makeFailure({
      code: "timeout",
      endpoint: "responses",
      message: "Request timed out after 60s",
    });

    try {
      dispatchProviderResult(
        failure,
        "openai-compatible",
        null,
        { handleSuccess, handleParse },
      );
      throw new Error("expected to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(LiveReviewError);
      const live = error as LiveReviewError;
      expect(live.code).toBe("PROVIDER_REQUEST_FAILED");
      expect(live.message).toBe("Request timed out after 60s");
    }
  });

  it("dispatch ok=false, parse: providerName is preserved from caller (Anthropic vs Copilot)", () => {
    const handleSuccess = vi.fn().mockReturnValue(makeOutcome());
    const handleParse = vi.fn().mockReturnValue(makeOutcome());
    const result = makeFailure({
      code: "parse",
      endpoint: "anthropic",
      rawText: "garbled",
    });

    dispatchProviderResult(
      result,
      "anthropic-messages",
      8192,
      { handleSuccess, handleParse },
    );

    expect(handleParse).toHaveBeenCalledWith(
      result,
      "anthropic-messages",
      "garbled",
      8192,
    );
  });
});
