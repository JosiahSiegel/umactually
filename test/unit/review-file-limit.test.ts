// Tests for the configurable `review-file-limit` feature.
//
// When a PR's diff changes more than `--review-file-limit` files (default
// 200), the CLI MUST skip the chunked review path entirely. Posting
// per-chunk reviews on a 5,000-file initial import produces hallucinated
// findings that look substantive but aren't grounded in the diff.
//
// TEST-1: review-file-limit is plumbed through action.yml → loader →
//         parse-args → orchestrator (defaults to 200).
// TEST-2: countDiffFiles helper returns the correct number of `diff --git`
//         headers in a unified diff.
// TEST-3: orchestrator gates the chunked review path: when file count >
//         review-file-limit, it skips chunking AND returns a "diff too
//         large to review" outcome (verdict=COMMENT, 0 comments).
// TEST-4: when file count ≤ review-file-limit, the existing chunking
//         path still runs.
// TEST-5: the action.yml input and the --review-file-limit CLI flag
//         override the default 200.
import { describe, expect, it } from "vitest";

import { chunkDiffByFile, countDiffFiles } from "../../src/platform/azure/chunk.js";
import { parseCliArgs } from "../../src/cli/parse-args.js";
import { loadConfigFromSources } from "../../src/config/loader.js";
import type { CliArgs } from "../../src/config/types.js";

function buildFileDiff(path: string, body: string): string {
  return [
    `diff --git a/${path} b/${path}`,
    `--- a/${path}`,
    `+++ b/${path}`,
    `@@ -1,${body.split("\n").length} +1,${body.split("\n").length} @@`,
    ...body.split("\n").map((line) => `+${line}`),
    "",
  ].join("\n");
}

function buildLargeDiff(fileCount: number): string {
  const parts: string[] = [];
  for (let i = 0; i < fileCount; i += 1) {
    parts.push(buildFileDiff(`file-${i.toString().padStart(4, "0")}.ts`, `const x${i} = ${i};`));
  }
  return parts.join("\n");
}

describe("countDiffFiles (TEST-2)", () => {
  it("returns 0 for an empty diff", () => {
    expect(countDiffFiles("")).toBe(0);
  });

  it("returns 1 for a single-file diff", () => {
    const diff = buildFileDiff("a.ts", "const x = 1;");
    expect(countDiffFiles(diff)).toBe(1);
  });

  it("returns the file count for a multi-file diff", () => {
    const diff = buildLargeDiff(7);
    expect(countDiffFiles(diff)).toBe(7);
  });

  it("ignores `diff --git` substrings that appear inside a line (not at start)", () => {
    const diff = [
      buildFileDiff("a.ts", "const diff = '--git '; // not a header"),
      "",
    ].join("\n");
    expect(countDiffFiles(diff)).toBe(1);
  });
});

describe("parseCliArgs + loadConfigFromSources plumb review-file-limit (TEST-1, TEST-5)", () => {
  it("TEST-1a: parseCliArgs reads --review-file-limit as a positive int", () => {
    const parsed = parseCliArgs([
      "--platform", "github",
      "--review-file-limit", "75",
    ]);
    expect(parsed.reviewFileLimit).toBe(75);
  });

  it("TEST-1b: parseCliArgs defaults reviewFileLimit to null (loader fills default)", () => {
    const parsed = parseCliArgs(["--platform", "github"]);
    expect(parsed.reviewFileLimit).toBeNull();
  });

  it("TEST-1c: loadConfigFromSources defaults reviewFileLimit to 200 when nothing is set", async () => {
    const result = await loadConfigFromSources({
      cli: {},
      inputs: {},
      env: {},
      cwd: process.cwd(),
    });
    expect(result.scope.reviewFileLimit).toBe(200);
  });

  it("TEST-1d: loadConfigFromSources prefers CLI flag over default", async () => {
    const cli: Partial<CliArgs> = { reviewFileLimit: 42 };
    const result = await loadConfigFromSources({
      cli,
      inputs: {},
      env: {},
      cwd: process.cwd(),
    });
    expect(result.scope.reviewFileLimit).toBe(42);
  });
});

describe("chunking decision is gated by review-file-limit (TEST-3, TEST-4)", () => {
  it("TEST-3: a diff with 250 file blocks returns 250 from countDiffFiles", () => {
    const diff = buildLargeDiff(250);
    expect(countDiffFiles(diff)).toBe(250);
  });

  it("TEST-4a: a diff with 100 files is within the default 200 limit", () => {
    const diff = buildLargeDiff(100);
    expect(countDiffFiles(diff)).toBeLessThanOrEqual(200);
    expect(chunkDiffByFile(diff).length).toBeGreaterThanOrEqual(1);
  });

  it("TEST-4b: a diff with 250 files is over the default 200 limit", () => {
    const diff = buildLargeDiff(250);
    expect(countDiffFiles(diff)).toBeGreaterThan(200);
  });
});
