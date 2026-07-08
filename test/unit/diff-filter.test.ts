import { describe, expect, it } from "vitest";

import {
  DEFAULT_BUILD_ARTIFACT_PATTERNS,
  filterBuildArtifacts,
  isBuildArtifactPath,
  listDiffPaths,
} from "../../src/diff/filter-build-artifacts.js";

describe("isBuildArtifactPath", () => {
  it("matches dist/ and everything under it", () => {
    expect(isBuildArtifactPath("dist/cli.js")).toBe(true);
    expect(isBuildArtifactPath("dist/index.js")).toBe(true);
    expect(isBuildArtifactPath("dist/nested/file.js")).toBe(true);
    expect(isBuildArtifactPath("src/dist/file.ts")).toBe(true);
  });

  it("matches build/ outputs", () => {
    expect(isBuildArtifactPath("build/index.js")).toBe(true);
    expect(isBuildArtifactPath("out/main.js")).toBe(true);
  });

  it("does NOT match src/lib/ (legitimate source layout)", () => {
    // `lib/` is removed from the default patterns because many
    // TypeScript / Node projects put source in `src/lib/` or
    // even root `lib/`. Pattern docs above explain the trade-off.
    expect(isBuildArtifactPath("src/lib/utils.ts")).toBe(false);
    expect(isBuildArtifactPath("lib/utils.ts")).toBe(false);
  });

  it("matches coverage outputs", () => {
    expect(isBuildArtifactPath("coverage/lcov.info")).toBe(true);
    expect(isBuildArtifactPath(".nyc_output/foo.json")).toBe(true);
  });

  it("matches node_modules and vendor", () => {
    expect(isBuildArtifactPath("node_modules/lodash/index.js")).toBe(true);
    expect(isBuildArtifactPath("vendor/autoload.php")).toBe(true);
  });

  it("matches lockfiles at any depth", () => {
    expect(isBuildArtifactPath("package-lock.json")).toBe(true);
    expect(isBuildArtifactPath("yarn.lock")).toBe(true);
    expect(isBuildArtifactPath("pnpm-lock.yaml")).toBe(true);
    expect(isBuildArtifactPath("Cargo.lock")).toBe(true);
    expect(isBuildArtifactPath("packages/api/yarn.lock")).toBe(true);
  });

  it("matches minified and bundled files", () => {
    expect(isBuildArtifactPath("public/app.min.js")).toBe(true);
    expect(isBuildArtifactPath("dist/main.bundle.js")).toBe(true);
    expect(isBuildArtifactPath("dist/chunk.123.chunk.js")).toBe(true);
  });

  it("matches source maps", () => {
    expect(isBuildArtifactPath("dist/cli.js.map")).toBe(true);
    expect(isBuildArtifactPath("app.js.map")).toBe(true);
  });

  it("matches TypeScript build info", () => {
    expect(isBuildArtifactPath("tsconfig.tsbuildinfo")).toBe(true);
    expect(isBuildArtifactPath("packages/api/.tsbuildinfo")).toBe(true);
  });

  it("does NOT match legitimate source files", () => {
    expect(isBuildArtifactPath("src/cli/run.ts")).toBe(false);
    expect(isBuildArtifactPath("src/cli/help.ts")).toBe(false);
    expect(isBuildArtifactPath("test/unit/example.test.ts")).toBe(false);
    expect(isBuildArtifactPath("README.md")).toBe(false);
    expect(isBuildArtifactPath("package.json")).toBe(false);
    expect(isBuildArtifactPath("action.yml")).toBe(false);
    expect(isBuildArtifactPath("azure-pipelines.yml")).toBe(false);
  });

  it("does NOT match partial names (no false positives)", () => {
    // "distribute.ts" should not match "dist/"
    expect(isBuildArtifactPath("src/distribute.ts")).toBe(false);
    // "build-runner.ts" should not match "build/"
    expect(isBuildArtifactPath("src/build-runner.ts")).toBe(false);
    // "node_modulestest" should not match "node_modules/"
    expect(isBuildArtifactPath("src/node_modulestest.ts")).toBe(false);
  });

  it("normalizes Windows-style backslash paths", () => {
    expect(isBuildArtifactPath("dist\\cli.js")).toBe(true);
    expect(isBuildArtifactPath("packages\\api\\dist\\index.js")).toBe(true);
  });
});

describe("filterBuildArtifacts", () => {
  const sampleDiff = [
    "diff --git a/src/cli/help.ts b/src/cli/help.ts",
    "--- a/src/cli/help.ts",
    "+++ b/src/cli/help.ts",
    "@@ -1,3 +1,4 @@",
    " export const x = 1;",
    "+export const added = true;",
    " export const y = 2;",
    "",
    "diff --git a/dist/cli.js b/dist/cli.js",
    "--- a/dist/cli.js",
    "+++ b/dist/cli.js",
    "@@ -1,3 +1,4 @@",
    " var x = 1;",
    "+var added = true;",
    " var y = 2;",
    "",
    "diff --git a/package-lock.json b/package-lock.json",
    "--- a/package-lock.json",
    "+++ b/package-lock.json",
    "@@ -1,2 +1,3 @@",
    " {",
    "+  \"added\": true,",
    " }",
    "",
  ].join("\n");

  it("strips dist/* blocks but keeps source blocks", () => {
    const filtered = filterBuildArtifacts(sampleDiff);
    expect(filtered).toContain("src/cli/help.ts");
    expect(filtered).not.toContain("dist/cli.js");
    expect(filtered).not.toContain("var x = 1;");
  });

  it("strips lockfile blocks", () => {
    const filtered = filterBuildArtifacts(sampleDiff);
    expect(filtered).not.toContain("package-lock.json");
    expect(filtered).not.toContain("\"added\": true,");
  });

  it("returns the source block unchanged", () => {
    const filtered = filterBuildArtifacts(sampleDiff);
    expect(filtered).toContain("+export const added = true;");
  });

  it("returns empty string when every block is filtered", () => {
    const onlyDist = [
      "diff --git a/dist/a.js b/dist/a.js",
      "--- a/dist/a.js",
      "+++ b/dist/a.js",
      "@@ -1,1 +1,2 @@",
      " var x;",
      "+var added;",
      "",
    ].join("\n");
    expect(filterBuildArtifacts(onlyDist)).toBe("");
  });

  it("returns input unchanged when input is empty", () => {
    expect(filterBuildArtifacts("")).toBe("");
  });

  it("returns input unchanged when no diff --git headers present", () => {
    const notADiff = "this is not a diff\n";
    expect(filterBuildArtifacts(notADiff)).toBe(notADiff);
  });

  it("preserves block ordering of non-filtered files", () => {
    const multi = [
      "diff --git a/dist/a.js b/dist/a.js",
      "--- a/dist/a.js",
      "+++ b/dist/a.js",
      "@@ -1,1 +1,2 @@",
      " var x;",
      "+var a;",
      "",
      "diff --git a/src/keep.ts b/src/keep.ts",
      "--- a/src/keep.ts",
      "+++ b/src/keep.ts",
      "@@ -1,1 +1,2 @@",
      " export const first = 1;",
      "+export const second = 2;",
      "",
      "diff --git a/dist/b.js b/dist/b.js",
      "--- a/dist/b.js",
      "+++ b/dist/b.js",
      "@@ -1,1 +1,2 @@",
      " var y;",
      "+var b;",
      "",
    ].join("\n");
    const filtered = filterBuildArtifacts(multi);
    expect(filtered).toContain("src/keep.ts");
    expect(filtered).not.toContain("dist/a.js");
    expect(filtered).not.toContain("dist/b.js");
    // The single retained block should come through intact.
    expect(filtered.indexOf("src/keep.ts")).toBeGreaterThan(-1);
  });

  it("preserves inter-block newlines when multiple source blocks remain (no glue)", () => {
    // Regression: the join used `retained.join("")` which glued
    // consecutive `diff --git` blocks together into one malformed
    // line. The fix joins with "\n" so each block starts on its own
    // line.
    const two = [
      "diff --git a/src/a.ts b/src/a.ts",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -1,1 +1,2 @@",
      " x",
      "+y",
      "",
      "diff --git a/src/b.ts b/src/b.ts",
      "--- a/src/b.ts",
      "+++ b/src/b.ts",
      "@@ -1,1 +1,2 @@",
      " p",
      "+q",
      "",
    ].join("\n");
    const filtered = filterBuildArtifacts(two);
    expect(filtered).toContain("src/a.ts");
    expect(filtered).toContain("src/b.ts");
    // The two diff blocks must be separated by a newline so the
    // resulting diff remains a valid unified diff (the second block
    // must start on its own line, not be glued to the previous
    // block's last hunk content).
    const lines = filtered.split("\n");
    const secondBlockStart = lines.findIndex((l) => l.startsWith("diff --git a/src/b.ts"));
    expect(secondBlockStart).toBeGreaterThan(0);
    expect(lines[secondBlockStart - 1]?.length === 0).toBe(true);
  });

  it("treats a / b / prefixes correctly", () => {
    const diff = [
      "diff --git a/dist/x.js b/dist/x.js",
      "--- a/dist/x.js",
      "+++ b/dist/x.js",
      "@@ -1,1 +1,2 @@",
      " x",
      "+y",
      "",
    ].join("\n");
    expect(filterBuildArtifacts(diff)).toBe("");
  });

  it("treats deleted files (--- a/dist/x.js +++ /dev/null) as filterable", () => {
    const diff = [
      "diff --git a/dist/x.js b/dist/x.js",
      "--- a/dist/x.js",
      "+++ /dev/null",
      "@@ -1,1 +0,0 @@",
      "-x",
      "",
    ].join("\n");
    expect(filterBuildArtifacts(diff)).toBe("");
  });

  it("locks the PR-#56 reproduction: dist/cli.js + dist/index.js + 6 more", () => {
    // Regression: PR #56 sync review produced 8 findings citing
    // dist/cli.js and dist/index.js. The diff was source-only but the
    // model fabricated them anyway. This test pins the dist/ content
    // out of any diff that the filter would process.
    const reproductionDiff = [
      "diff --git a/dist/cli.js b/dist/cli.js",
      "--- a/dist/cli.js",
      "+++ b/dist/cli.js",
      "@@ -1,3 +1,4 @@",
      " // generated by ncc",
      "+// some new bundled line",
      " module.exports = {};",
      "",
      "diff --git a/dist/index.js b/dist/index.js",
      "--- a/dist/index.js",
      "+++ b/dist/index.js",
      "@@ -1,3 +1,4 @@",
      " // generated by ncc",
      "+// some other bundled line",
      " module.exports = {};",
      "",
    ].join("\n");
    const filtered = filterBuildArtifacts(reproductionDiff);
    expect(filtered).not.toContain("dist/cli.js");
    expect(filtered).not.toContain("dist/index.js");
    expect(filtered).not.toContain("ncc");
  });
});

describe("listDiffPaths", () => {
  it("returns unique, forward-slash-normalized paths in order of first appearance", () => {
    const diff = [
      "diff --git a/src/a.ts b/src/a.ts",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -1,1 +1,2 @@",
      " x",
      "+y",
      "",
      "diff --git a/src/b.ts b/src/b.ts",
      "--- a/src/b.ts",
      "+++ b/src/b.ts",
      "@@ -1,1 +1,2 @@",
      " x",
      "+y",
      "",
      "diff --git a/src/c.ts b/src/c.ts",
      "--- a/src/c.ts",
      "+++ b/src/c.ts",
      "@@ -1,1 +1,2 @@",
      " x",
      "+y",
      "",
    ].join("\n");
    const paths = listDiffPaths(diff);
    expect(paths).toEqual(["src/a.ts", "src/b.ts", "src/c.ts"]);
  });

  it("deduplicates paths that appear in both a/ and b/ sides", () => {
    const diff = [
      "diff --git a/src/x.ts b/src/x.ts",
      "--- a/src/x.ts",
      "+++ b/src/x.ts",
      "@@ -1,1 +1,2 @@",
      " x",
      "+y",
      "",
    ].join("\n");
    expect(listDiffPaths(diff)).toEqual(["src/x.ts"]);
  });

  it("skips /dev/null entries on the b/ side (a deleted file's a/ path is still listed)", () => {
    const diff = [
      "diff --git a/src/old.ts b/src/old.ts",
      "--- a/src/old.ts",
      "+++ /dev/null",
      "@@ -1,1 +0,0 @@",
      "-x",
      "",
    ].join("\n");
    expect(listDiffPaths(diff)).toEqual(["src/old.ts"]);
  });

  it("skips /dev/null entries on the a/ side (an added file's b/ path is still listed)", () => {
    const diff = [
      "diff --git a/src/new.ts b/src/new.ts",
      "--- /dev/null",
      "+++ b/src/new.ts",
      "@@ -0,0 +1,1 @@",
      "+x",
      "",
    ].join("\n");
    expect(listDiffPaths(diff)).toEqual(["src/new.ts"]);
  });

  it("returns empty array for an empty diff", () => {
    expect(listDiffPaths("")).toEqual([]);
  });
});

describe("DEFAULT_BUILD_ARTIFACT_PATTERNS", () => {
  it("includes the canonical blockers the production-tool survey calls out", () => {
    const expected = [
      "dist/",
      "build/",
      "node_modules/",
      "coverage/",
      "**/package-lock.json",
      "**/yarn.lock",
      "**/*.min.js",
      "**/*.map",
    ];
    for (const pattern of expected) {
      expect(DEFAULT_BUILD_ARTIFACT_PATTERNS).toContain(pattern);
    }
  });
});