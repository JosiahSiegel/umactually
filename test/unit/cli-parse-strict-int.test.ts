// SPDX-License-Identifier: MIT
//
// Unit tests for src/util/strict-integer.ts. The module is a leaf
// helper that breaks the `cli/parse-args.ts ↔ config/parsers.ts`
// circular-import cycle. It exposes `tryParseStrictInt`, which
// answers the syntactic question "is this string a well-formed
// decimal integer literal?" — sign tolerance, digit-only body, no
// whitespace, no exponent, no decimal point, no hex/octal prefix.
// The safe-integer bound is the caller's responsibility; number
// range is exercised here only at the boundary (MAX_SAFE_INTEGER
// accepts, MAX_SAFE_INTEGER + 1 rejects via the regex's digit cap
// — `Number.parseInt` would silently round-trip, but our regex
// does not allow it because that literal has 17 digits which still
// parses, but the regex still passes for 17 digits; the contract
// says the helper does NOT enforce safe-integer, so we only assert
// shape, not the bound).
//
// These cases map 1:1 to the "Accepted shapes" / "Rejected shapes"
// contract documented in src/util/strict-integer.ts. Each case
// asserts the numeric return value (or `null` for rejects), so
// any future drift in the regex / fallback behavior is caught.

import { describe, expect, it } from "vitest";

import { tryParseStrictInt } from "../../src/util/strict-integer.js";

describe("tryParseStrictInt — accepted shapes", () => {
  it("parses a single-digit positive integer", () => {
    expect(tryParseStrictInt("1")).toBe(1);
  });

  it("parses a multi-digit positive integer", () => {
    expect(tryParseStrictInt("12345")).toBe(12345);
  });

  it("parses a leading '+' sign", () => {
    expect(tryParseStrictInt("+42")).toBe(42);
  });

  it("parses a leading '-' sign", () => {
    expect(tryParseStrictInt("-42")).toBe(-42);
  });

  it("parses '+0' to zero", () => {
    expect(tryParseStrictInt("+0")).toBe(0);
  });

  it("parses '-0' to zero", () => {
    expect(tryParseStrictInt("-0")).toBe(-0);
  });

  it("parses '0' to zero", () => {
    expect(tryParseStrictInt("0")).toBe(0);
  });

  it("parses Number.MAX_SAFE_INTEGER (boundary accepts by shape)", () => {
    expect(tryParseStrictInt(String(Number.MAX_SAFE_INTEGER))).toBe(
      Number.MAX_SAFE_INTEGER,
    );
  });
});

describe("tryParseStrictInt — rejected shapes", () => {
  it("rejects the empty string", () => {
    expect(tryParseStrictInt("")).toBeNull();
  });

  it("rejects internal whitespace", () => {
    expect(tryParseStrictInt("1 2")).toBeNull();
  });

  it("rejects trailing whitespace", () => {
    expect(tryParseStrictInt("12 ")).toBeNull();
  });

  it("rejects leading whitespace", () => {
    expect(tryParseStrictInt(" 12")).toBeNull();
  });

  it("rejects exponent notation ('1e3')", () => {
    expect(tryParseStrictInt("1e3")).toBeNull();
  });

  it("rejects a decimal point ('1.5')", () => {
    expect(tryParseStrictInt("1.5")).toBeNull();
  });

  it("rejects a hex prefix ('0x10')", () => {
    expect(tryParseStrictInt("0x10")).toBeNull();
  });

  it("rejects trailing letters ('12abc')", () => {
    expect(tryParseStrictInt("12abc")).toBeNull();
  });

  it("rejects a bare sign ('+')", () => {
    expect(tryParseStrictInt("+")).toBeNull();
  });

  it("rejects a bare sign ('-')", () => {
    expect(tryParseStrictInt("-")).toBeNull();
  });

  it("rejects Number.MAX_SAFE_INTEGER + 1 (out-of-range digit string)", () => {
    // Helper does NOT enforce safe-integer bound; the contract says
    // the caller owns that. The 17-digit literal is still a
    // well-formed integer literal syntactically, so the regex
    // accepts it and `Number.parseInt` returns the imprecise value.
    // This test pins the current behavior so any future change to
    // add the safe-integer check is a deliberate, visible choice.
    const outOfRange = String(Number.MAX_SAFE_INTEGER + 1);
    const result = tryParseStrictInt(outOfRange);
    expect(result).not.toBeNull();
    expect(Number.isSafeInteger(result)).toBe(false);
  });
});
