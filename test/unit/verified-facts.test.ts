import { describe, expect, it } from "vitest";

import {
  collectVerifiedFacts,
  reconstructFileFromDiff,
  renderVerifiedFactsBlock,
} from "../../src/review/verified-facts.js";

/**
 * These tests pin the false-positive prevention layer that the
 * self-review bot on PR #41 surfaced:
 *   - The model claimed "dist/ is not in package.json files" even
 *     though the diff (and the working tree) show dist/ in the
 *     files array.
 *   - The model claimed "the published package will fail at runtime
 *     with Cannot find module dist/cli.js" even though the same
 *     files array includes dist.
 *
 * The verified-facts layer reconstructs the post-change state of
 * package.json / action.yml from the diff hunks (context lines +
 * added lines) so the model sees authoritative repo state BEFORE
 * the diff, and the post-filter can downgrade contradictions.
 */
describe("reconstructFileFromDiff", () => {
  it("reconstructs a file's post-change content from hunks (context + added, removed skipped)", () => {
    const diff = [
      "diff --git a/package.json b/package.json",
      "--- a/package.json",
      "+++ b/package.json",
      "@@ -1,5 +1,6 @@",
      " {",
      '   "name": "umactually",',
      '-  "version": "0.0.1",',
      '+  "version": "0.1.0",',
      '+  "description": "new",',
      '   "main": "dist/index.js"',
      " }",
    ].join("\n");
    const content = reconstructFileFromDiff(diff, "package.json");
    expect(content).not.toBeNull();
    expect(content).toContain('"version": "0.1.0"');
    expect(content).toContain('"description": "new"');
    expect(content).toContain('"name": "umactually"');
    expect(content).toContain('"main": "dist/index.js"');
    expect(content).not.toContain('"0.0.1"');
  });

  it("returns null when the file is not in the diff", () => {
    const diff = [
      "diff --git a/README.md b/README.md",
      "--- a/README.md",
      "+++ b/README.md",
      "@@ -1,1 +1,1 @@",
      "-old",
      "+new",
    ].join("\n");
    expect(reconstructFileFromDiff(diff, "package.json")).toBeNull();
  });
});

describe("collectVerifiedFacts", () => {
  it("extracts package.json#files post-change (multiline array, partial edit)", () => {
    // Verbatim hunk from PR #41: the `files` array opener line was
    // UNCHANGED in the diff (it's context, not +/-). The added lines
    // only contain the new entries. The extractor must reconstruct
    // the full post-change array by combining context + added lines.
    const diff = [
      "diff --git a/package.json b/package.json",
      "--- a/package.json",
      "+++ b/package.json",
      "@@ -10,8 +35,14 @@",
      '   "bin": {',
      '     "umactually-pr-review": "bin/umactually-pr-review.mjs"',
      "   },",
      '   "files": [',
      '     "dist",',
      '     "bin",',
      '     "action.yml",',
      '     "README.md",',
      '-    "LICENSE"',
      '+    "LICENSE",',
      '+    "docs",',
      '+    "examples",',
      '+    "scripts"',
      "   ],",
    ].join("\n");
    const facts = collectVerifiedFacts(diff);
    expect(facts.packageJsonFiles).not.toBeNull();
    expect(facts.packageJsonFiles?.files).toContain("dist");
    expect(facts.packageJsonFiles?.files).toContain("docs");
    expect(facts.packageJsonFiles?.files).toContain("examples");
    expect(facts.packageJsonFiles?.files).toContain("scripts");
    // All 8 entries must be present (the diff didn't drop any).
    expect(facts.packageJsonFiles?.files).toHaveLength(8);
  });

  it("returns null for packageJsonFiles when package.json is not in the diff", () => {
    const diff = [
      "diff --git a/README.md b/README.md",
      "--- a/README.md",
      "+++ b/README.md",
      "@@ -1,1 +1,1 @@",
      "-old",
      "+new",
    ].join("\n");
    const facts = collectVerifiedFacts(diff);
    expect(facts.packageJsonFiles).toBeNull();
  });

  it("extracts package.json#bin entries from the post-change file", () => {
    const diff = [
      "diff --git a/package.json b/package.json",
      "--- a/package.json",
      "+++ b/package.json",
      "@@ -1,3 +1,4 @@",
      " {",
      '   "name": "umactually",',
      '-  "bin": { "old-cli": "bin/old.mjs" },',
      '+  "bin": { "umactually-pr-review": "bin/umactually-pr-review.mjs" },',
      '   "main": "dist/index.js"',
      " }",
    ].join("\n");
    const facts = collectVerifiedFacts(diff);
    expect(facts.packageJsonBin).not.toBeNull();
    expect(facts.packageJsonBin?.binEntries).toContain(
      "umactually-pr-review -> bin/umactually-pr-review.mjs",
    );
    expect(facts.packageJsonBin?.binEntries).not.toContain(
      "old-cli -> bin/old.mjs",
    );
  });

  it("extracts package.json#main string from the post-change file", () => {
    const diff = [
      "diff --git a/package.json b/package.json",
      "--- a/package.json",
      "+++ b/package.json",
      "@@ -1,3 +1,3 @@",
      " {",
      '-  "main": "dist/index.js",',
      '+  "main": "dist/cli.js",',
      '   "name": "umactually"',
      " }",
    ].join("\n");
    const facts = collectVerifiedFacts(diff);
    expect(facts.packageJsonMain).not.toBeNull();
    expect(facts.packageJsonMain?.main).toBe("dist/cli.js");
  });

  it("returns actionOutputs with empty keys when the outputs block was removed", () => {
    // PR #41 removed the outputs block. The action.yml diff shows the
    // `outputs:` line being removed (-outputs:) and `branding:` being
    // added (+branding:). The reconstructed post-change action.yml
    // has no outputs block, so outputKeys must be empty.
    const diff = [
      "diff --git a/action.yml b/action.yml",
      "--- a/action.yml",
      "+++ b/action.yml",
      "@@ -184,20 +184,8 @@",
      "   repo:",
      "     description: Repository in owner/name form.",
      "     required: false",
      "     default: \"\"",
      "",
      "-outputs:",
      "-  marker:",
      "-    description: Review marker emitted by the entrypoint.",
      "-  marker_text:",
      "-    description: Stable HTML comment marker the runner greps for.",
      "+branding:",
      "+  icon: \"check-circle\"",
      "+  color: \"purple\"",
      "+  label: \"UmActually Review\"",
      "",
      " runs:",
      '   using: "node24"',
      '   main: "dist/index.js"',
    ].join("\n");
    const facts = collectVerifiedFacts(diff);
    expect(facts.actionOutputs).not.toBeNull();
    expect(facts.actionOutputs?.outputKeys).toEqual([]);
  });

  it("returns actionOutputs with non-empty keys when outputs were added", () => {
    const diff = [
      "diff --git a/action.yml b/action.yml",
      "--- a/action.yml",
      "+++ b/action.yml",
      "@@ -180,1 +180,5 @@",
      "+outputs:",
      "+  marker:",
      "+    description: x.",
      "+  inline_count:",
      "+    description: y.",
    ].join("\n");
    const facts = collectVerifiedFacts(diff);
    expect(facts.actionOutputs?.outputKeys).toEqual(["marker", "inline_count"]);
  });

  it("returns null for actionOutputs when action.yml is not in the diff", () => {
    const diff = [
      "diff --git a/README.md b/README.md",
      "--- a/README.md",
      "+++ b/README.md",
      "@@ -1,1 +1,1 @@",
      "-old",
      "+new",
    ].join("\n");
    const facts = collectVerifiedFacts(diff);
    expect(facts.actionOutputs).toBeNull();
  });

  it("returns the file list for filesInDiff via listDiffPaths", () => {
    const diff = [
      "diff --git a/package.json b/package.json",
      "--- a/package.json",
      "+++ b/package.json",
      "@@ -1,1 +1,1 @@",
      "-old",
      "+new",
      "diff --git a/action.yml b/action.yml",
      "--- a/action.yml",
      "+++ b/action.yml",
      "@@ -1,1 +1,1 @@",
      "-old",
      "+new",
    ].join("\n");
    const facts = collectVerifiedFacts(diff);
    expect(facts.filesInDiff).toContain("package.json");
    expect(facts.filesInDiff).toContain("action.yml");
  });
});

describe("renderVerifiedFactsBlock", () => {
  it("returns an empty string when no facts were extracted", () => {
    const block = renderVerifiedFactsBlock({
      filesInDiff: [],
      packageJsonFiles: null,
      packageJsonBin: null,
      packageJsonMain: null,
      actionOutputs: null,
    });
    expect(block).toBe("");
  });

  it("renders the PR-#41 verified-facts block with dist/ explicit", () => {
    const diff = [
      "diff --git a/package.json b/package.json",
      "--- a/package.json",
      "+++ b/package.json",
      "@@ -10,8 +35,14 @@",
      '   "bin": {',
      '     "umactually-pr-review": "bin/umactually-pr-review.mjs"',
      "   },",
      '   "files": [',
      '     "dist",',
      '     "bin",',
      '     "action.yml",',
      '     "README.md",',
      '-    "LICENSE"',
      '+    "LICENSE",',
      '+    "docs",',
      '+    "examples",',
      '+    "scripts"',
      "   ],",
    ].join("\n");
    const facts = collectVerifiedFacts(diff);
    const block = renderVerifiedFactsBlock(facts);
    expect(block).toContain("dist");
    expect(block).toContain("Verified facts");
    expect(block).toContain("do NOT contradict these");
    expect(block).toContain('"dist"');
    expect(block).toContain('"docs"');
    expect(block).toContain('"examples"');
  });
});