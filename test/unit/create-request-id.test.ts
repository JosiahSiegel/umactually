// Pins createRequestId's robustness against missing globalThis.crypto.
// The previous code read globalThis.crypto unconditionally; if the
// runtime has no crypto global at all, the function threw TypeError.
// Fix: feature-detect globalThis.crypto first.

import { describe, expect, it } from "vitest";

import { createRequestId } from "../../src/util/url.js";

describe("createRequestId: handles missing globalThis.crypto", () => {
  it("returns a valid UUID when globalThis.crypto is available", () => {
    // Default Node 24 environment has globalThis.crypto.
    const id = createRequestId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(8);
  });

  it("falls back to the math.random path when globalThis.crypto is undefined", () => {
    const original = globalThis.crypto;
    // Simulate an embedded runtime without globalThis.crypto.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).crypto;
    try {
      const id = createRequestId();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(8);
      // The fallback produces a hex string with dashes — match the
      // UUID-like shape (8-4-4-4-12 hex chars).
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u);
    } finally {
      // Restore globalThis.crypto for subsequent tests.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).crypto = original;
    }
  });
});
