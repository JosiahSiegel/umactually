// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";

import { ensureHttpOk, getLiveReviewHint, LiveReviewError } from "../../src/cli/live-shared.js";

describe("ensureHttpOk — remediation hint", () => {
  it("throws LiveReviewError carrying the hint on the exception instance", () => {
    // Given: a fake 401 response.
    const fakeResponse = new Response("unauthorized", { status: 401 });
    try {
      ensureHttpOk(
        fakeResponse,
        "SYNTHETIC_TEST_FAILURE",
        "synthetic test action",
        "Re-check the synthetic test harness.",
      );
      throw new Error("expected LiveReviewError");
    } catch (error) {
      // Then: it's the typed error.
      expect(error).toBeInstanceOf(LiveReviewError);
      if (!(error instanceof LiveReviewError)) throw error;
      expect(error.code).toBe("SYNTHETIC_TEST_FAILURE");
      expect(error.message).toMatch(/HTTP 401/u);
      // And: the hint is reachable through the typed reader.
      expect(getLiveReviewHint(error)).toBe("Re-check the synthetic test harness.");
    }
  });

  it("returns immediately on response.ok without throwing", () => {
    // Given: a 200.
    const ok = new Response("ok", { status: 200 });
    // Then: no throw.
    expect(() => ensureHttpOk(ok, "OK_TEST", "ok test")).not.toThrow();
  });

  it("accepts an omitted hint (backwards-compatible overload)", () => {
    const failing = new Response("nope", { status: 500 });
    try {
      ensureHttpOk(failing, "BACKWARDS_COMPAT_TEST", "backwards-compat");
      throw new Error("expected LiveReviewError");
    } catch (error) {
      expect(error).toBeInstanceOf(LiveReviewError);
      if (!(error instanceof LiveReviewError)) throw error;
      // Hint is undefined.
      expect(getLiveReviewHint(error)).toBeUndefined();
    }
  });
});
