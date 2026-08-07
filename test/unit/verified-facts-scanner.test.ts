import { describe, expect, it } from "vitest";

import { collectVerifiedFacts } from "../../src/review/verified-facts.js";

/**
 * Coverage for the extractJsonFieldByScanning generic and the three
 * thin wrappers that route through it.
 *
 * Each public field-fetcher (readPackageJsonFiles, readPackageJsonBin,
 * readPackageJsonMain) has two paths:
 *   - full-parse: reconstructFileFromDiff yields content that is
 *     parseable as JSON; the fact is read from the parsed object.
 *   - scanner fallback: the content is NOT valid JSON (a partial
 *     fragment), so JSON.parse fails and the per-field scanner
 *     (now a thin wrapper around extractJsonFieldByScanning) walks
 *     the field directly.
 *
 * The scanner-fallback cases below use diffs whose reconstructed
 * package.json is a JSON fragment (no surrounding braces, or a
 * trailing comma) so JSON.parse fails and the generic scanner takes
 * over. The scanner must still find the key — this is the
 * load-bearing "doesn't require the file to be valid JSON" property
 * the task explicitly preserves.
 */
describe("readPackageJsonFiles (full-parse path)", () => {
  it("extracts the full files array when the diff reconstructs valid JSON", () => {
    // Reconstructed package.json will be:
    //   {
    //     "files": ["dist", "bin"]
    //   }
    // → valid JSON, full-parse path returns the array verbatim.
    const diff = [
      "diff --git a/package.json b/package.json",
      "--- a/package.json",
      "+++ b/package.json",
      "@@ -1,1 +1,5 @@",
      " {",
      '+  "files": ["dist", "bin"],',
      '   "name": "x",',
      " }",
    ].join("\n");
    const facts = collectVerifiedFacts(diff);
    expect(facts.packageJsonFiles).not.toBeNull();
    expect(facts.packageJsonFiles?.kind).toBe("package-json-files");
    expect(facts.packageJsonFiles?.files).toEqual(["dist", "bin"]);
  });
});

describe("readPackageJsonFiles (scanner fallback)", () => {
  it("falls back to extractJsonFieldByScanning when JSON.parse fails on the fragment", () => {
    // Reconstructed content:
    //     "files": [
    //       "dist",
    //       "bin"
    //     ],
    // No surrounding `{` / `}` → invalid JSON → scanner fallback.
    const diff = [
      "diff --git a/package.json b/package.json",
      "--- a/package.json",
      "+++ b/package.json",
      "@@ -1,1 +1,5 @@",
      '+  "files": [',
      '+    "dist",',
      '+    "bin"',
      "   ],",
    ].join("\n");
    const facts = collectVerifiedFacts(diff);
    expect(facts.packageJsonFiles).not.toBeNull();
    expect(facts.packageJsonFiles?.kind).toBe("package-json-files");
    expect(facts.packageJsonFiles?.files).toEqual(["dist", "bin"]);
  });
});

describe("readPackageJsonBin (full-parse path)", () => {
  it("extracts the map-form bin entries via full JSON parse", () => {
    const diff = [
      "diff --git a/package.json b/package.json",
      "--- a/package.json",
      "+++ b/package.json",
      "@@ -1,1 +1,5 @@",
      " {",
      '+  "bin": { "umactually": "bin/umactually.mjs" },',
      '   "name": "x",',
      " }",
    ].join("\n");
    const facts = collectVerifiedFacts(diff);
    expect(facts.packageJsonBin).not.toBeNull();
    expect(facts.packageJsonBin?.kind).toBe("package-json-bin");
    expect(facts.packageJsonBin?.binEntries).toEqual([
      "umactually -> bin/umactually.mjs",
    ]);
  });

  it("extracts the string-form bin via full JSON parse", () => {
    const diff = [
      "diff --git a/package.json b/package.json",
      "--- a/package.json",
      "+++ b/package.json",
      "@@ -1,1 +1,4 @@",
      " {",
      '+  "bin": "bin/cli.mjs",',
      '   "name": "x"',
      " }",
    ].join("\n");
    const facts = collectVerifiedFacts(diff);
    expect(facts.packageJsonBin).not.toBeNull();
    expect(facts.packageJsonBin?.binEntries).toEqual([
      "(binary) -> bin/cli.mjs",
    ]);
  });
});

describe("readPackageJsonBin (scanner fallback)", () => {
  it("falls back to extractJsonFieldByScanning for the map form when JSON.parse fails", () => {
    // Reconstructed content is a fragment (no closing brace) →
    // invalid JSON → scanner fallback path runs.
    const diff = [
      "diff --git a/package.json b/package.json",
      "--- a/package.json",
      "+++ b/package.json",
      "@@ -1,1 +1,4 @@",
      '+  "bin": {',
      '+    "umactually": "bin/umactually.mjs"',
      "   },",
    ].join("\n");
    const facts = collectVerifiedFacts(diff);
    expect(facts.packageJsonBin).not.toBeNull();
    expect(facts.packageJsonBin?.binEntries).toEqual([
      "umactually -> bin/umactually.mjs",
    ]);
  });

  it("falls back to extractJsonFieldByScanning for the string form when JSON.parse fails", () => {
    const diff = [
      "diff --git a/package.json b/package.json",
      "--- a/package.json",
      "+++ b/package.json",
      "@@ -1,1 +1,2 @@",
      '+  "bin": "bin/cli.mjs",',
    ].join("\n");
    const facts = collectVerifiedFacts(diff);
    expect(facts.packageJsonBin).not.toBeNull();
    expect(facts.packageJsonBin?.binEntries).toEqual([
      "(binary) -> bin/cli.mjs",
    ]);
  });
});

describe("readPackageJsonMain (full-parse path)", () => {
  it("extracts the main string via full JSON parse", () => {
    const diff = [
      "diff --git a/package.json b/package.json",
      "--- a/package.json",
      "+++ b/package.json",
      "@@ -1,1 +1,4 @@",
      " {",
      '+  "main": "dist/cli.js",',
      '   "name": "x"',
      " }",
    ].join("\n");
    const facts = collectVerifiedFacts(diff);
    expect(facts.packageJsonMain).not.toBeNull();
    expect(facts.packageJsonMain?.kind).toBe("package-json-main");
    expect(facts.packageJsonMain?.main).toBe("dist/cli.js");
  });
});

describe("readPackageJsonMain (scanner fallback)", () => {
  it("falls back to extractJsonFieldByScanning when JSON.parse fails on the fragment", () => {
    // Reconstructed content has only the main line — no surrounding
    // `{` / `}` → JSON.parse fails → scanner fallback.
    const diff = [
      "diff --git a/package.json b/package.json",
      "--- a/package.json",
      "+++ b/package.json",
      "@@ -1,1 +1,2 @@",
      '+  "main": "dist/cli.js",',
    ].join("\n");
    const facts = collectVerifiedFacts(diff);
    expect(facts.packageJsonMain).not.toBeNull();
    expect(facts.packageJsonMain?.main).toBe("dist/cli.js");
  });
});