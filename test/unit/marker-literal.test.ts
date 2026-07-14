// Pins the literal values of REVIEW_MARKER and MANIFEST_SCHEMA. These
// strings are part of the public surface that downstream consumers
// (dedup loops, manifest parsers, fixture validators) rely on. If a
// maintainer ever edits src/util/marker.ts without realizing the
// migration cost, the test below fires immediately.

import { describe, expect, it } from "vitest";

import { MANIFEST_SCHEMA, REVIEW_MARKER } from "../../src/util/marker.js";

describe("frozen marker literals", () => {
  it("REVIEW_MARKER stays the literal grep target for dedup loops", () => {
    expect(REVIEW_MARKER).toBe("<!-- umactually -->");
  });

  it("MANIFEST_SCHEMA stays the brand-prefixed schema identifier", () => {
    expect(MANIFEST_SCHEMA).toBe("umactually/v1");
  });

  it("REVIEW_MARKER is the only HTML comment string consumers must match", () => {
    // The marker is prefixed by the brand so a single substring search
    // finds every UmActually review, even after the body changes. If
    // this assertion ever fails, every dedup loop, manifest parser, and
    // fixture validator must be updated in the same release.
    expect(REVIEW_MARKER.startsWith("<!-- ")).toBe(true);
    expect(REVIEW_MARKER.endsWith(" -->")).toBe(true);
    expect(REVIEW_MARKER).toContain("umactually");
  });

  it("MANIFEST_SCHEMA is grep-able and brand-prefixed", () => {
    expect(MANIFEST_SCHEMA).toMatch(/^umactually\/v\d+$/u);
  });
});
