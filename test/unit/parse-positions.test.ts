import { describe, expect, it } from "vitest";

import { parseDiffPositions } from "../../src/diff/parse-positions.js";

describe("parseDiffPositions", () => {
  it("returns hasPosition false for unknown paths and lines", () => {
    const diffText = [
      "diff --git a/src/example.ts b/src/example.ts",
      "--- a/src/example.ts",
      "+++ b/src/example.ts",
      "@@ -1,2 +1,3 @@",
      " export const value = 1;",
      "+export const added = true;",
      " export const trailing = 2;",
      "",
    ].join("\n");

    const positions = parseDiffPositions(diffText);

    expect(positions.hasPosition({ path: "src/example.ts", line: 1 })).toBe(true);
    expect(positions.hasPosition({ path: "src/example.ts", line: 2 })).toBe(true);
    expect(positions.hasPosition({ path: "src/example.ts", line: 3 })).toBe(true);
    expect(positions.hasPosition({ path: "src/example.ts", line: 999 })).toBe(false);
    expect(positions.hasPosition({ path: "src/other.ts", line: 1 })).toBe(false);
  });

  it("enumerates positions in diff order, deduplicated", () => {
    const diffText = [
      "diff --git a/src/example.ts b/src/example.ts",
      "--- a/src/example.ts",
      "+++ b/src/example.ts",
      "@@ -1,2 +1,3 @@",
      " export const value = 1;",
      "+export const added = true;",
      " export const trailing = 2;",
      "",
    ].join("\n");

    const positions = parseDiffPositions(diffText);
    const enumerated = positions.enumerate();

    expect(enumerated).toEqual([
      { path: "src/example.ts", line: 1 },
      { path: "src/example.ts", line: 2 },
      { path: "src/example.ts", line: 3 },
    ]);
  });

  it("enumerates positions across multiple files in order of appearance", () => {
    const diffText = [
      "diff --git a/src/alpha.ts b/src/alpha.ts",
      "--- a/src/alpha.ts",
      "+++ b/src/alpha.ts",
      "@@ -1,2 +1,3 @@",
      " export const alpha = 1;",
      "+export const alphaAdded = true;",
      " export const alphaTrailing = 2;",
      "diff --git a/src/beta.ts b/src/beta.ts",
      "--- a/src/beta.ts",
      "+++ b/src/beta.ts",
      "@@ -10,2 +10,3 @@",
      " export const beta = 1;",
      "+export const betaAdded = true;",
      " export const betaTrailing = 2;",
      "",
    ].join("\n");

    const positions = parseDiffPositions(diffText);
    const enumerated = positions.enumerate();

    expect(enumerated).toEqual([
      { path: "src/alpha.ts", line: 1 },
      { path: "src/alpha.ts", line: 2 },
      { path: "src/alpha.ts", line: 3 },
      { path: "src/beta.ts", line: 10 },
      { path: "src/beta.ts", line: 11 },
      { path: "src/beta.ts", line: 12 },
    ]);
  });

  it("returns a fresh array on each enumerate() call so callers cannot mutate internals", () => {
    const diffText = [
      "diff --git a/src/example.ts b/src/example.ts",
      "--- a/src/example.ts",
      "+++ b/src/example.ts",
      "@@ -1,2 +1,3 @@",
      " export const value = 1;",
      "+export const added = true;",
      " export const trailing = 2;",
      "",
    ].join("\n");

    const positions = parseDiffPositions(diffText);
    const first = positions.enumerate();
    const second = positions.enumerate();

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });

  it("returns an empty enumeration when the diff has no right-side positions", () => {
    const positions = parseDiffPositions("");
    expect(positions.enumerate()).toEqual([]);
    expect(positions.hasPosition({ path: "src/example.ts", line: 1 })).toBe(false);
  });
});