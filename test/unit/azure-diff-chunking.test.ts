// Contract tests for src/platform/azure/chunk.ts (CHUNK-1 through CHUNK-6).
//
// `chunkDiffByFile` splits a reconstructed unified diff on `diff --git`
// boundaries into chunks that fit inside the provider's per-request token
// budget. These tests pin the contract that callers (orchestrator, merge
// helpers) depend on:
//
// CHUNK-1 splits at `diff --git` boundaries
// CHUNK-2 each chunk ≤ maxChunkBytes
// CHUNK-3 each chunk ≤ maxFilesPerChunk files
// CHUNK-4 a small diff (< maxFilesPerChunk) returns a single chunk
// CHUNK-5 a huge diff returns many chunks that together cover all files
// CHUNK-6 chunks never split a single file across chunk boundaries
import { describe, expect, it } from "vitest";

import { chunkDiffByFile } from "../../src/platform/azure/chunk.js";

/**
 * Build a synthetic per-file diff block for a single file. Matches the
 * shape `buildUnifiedFileDiff` produces so chunking has the same anchors
 * the production diff has.
 */
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

/**
 * Build a large diff with `fileCount` files each carrying `bodyLength`
 * characters of synthetic content. Mirrors the shape the Azure PR-diff
 * reconstruction produces.
 */
function buildLargeDiff(fileCount: number, bodyLength: number): string {
  const parts: string[] = [];
  for (let index = 0; index < fileCount; index += 1) {
    const path = `src/file-${index.toString().padStart(4, "0")}.ts`;
    const body = "x".repeat(bodyLength);
    parts.push(buildFileDiff(path, body));
  }
  return parts.join("");
}

describe("chunkDiffByFile", () => {
  it("CHUNK-1 splits at `diff --git` boundaries", () => {
    // Given: a diff containing two distinct file blocks.
    const diffText = [
      buildFileDiff("src/foo.ts", "line-a"),
      buildFileDiff("src/bar.ts", "line-b"),
    ].join("");

    // When: chunked with defaults.
    const chunks = chunkDiffByFile(diffText);

    // Then: every chunk starts with a `diff --git` header.
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    for (const chunk of chunks) {
      expect(chunk.startsWith("diff --git ")).toBe(true);
    }
  });

  it("CHUNK-2 each chunk has at most `maxChunkBytes` characters", () => {
    // Given: a large diff that should be split into multiple chunks
    // when the byte cap is small.
    const diffText = buildLargeDiff(20, 200);
    const maxChunkBytes = 1_500;

    // When: chunked with an aggressive byte cap.
    const chunks = chunkDiffByFile(diffText, { maxChunkBytes, maxFilesPerChunk: 100 });

    // Then: every chunk respects the cap.
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(maxChunkBytes);
    }
  });

  it("CHUNK-3 each chunk has at most `maxFilesPerChunk` files", () => {
    // Given: a large diff with many files.
    const diffText = buildLargeDiff(50, 50);
    const maxFilesPerChunk = 10;

    // When: chunked with a file cap.
    const chunks = chunkDiffByFile(diffText, { maxChunkBytes: 1_000_000, maxFilesPerChunk });

    // Then: every chunk respects the file cap (count of `diff --git`
    // headers per chunk ≤ maxFilesPerChunk).
    for (const chunk of chunks) {
      const fileCount = (chunk.match(/^diff --git /gmu) ?? []).length;
      expect(fileCount).toBeLessThanOrEqual(maxFilesPerChunk);
    }
  });

  it("CHUNK-4 a small diff returns a single chunk", () => {
    // Given: a diff with fewer files than `maxFilesPerChunk` AND under
    // `maxChunkBytes` — should NOT be split.
    const diffText = buildLargeDiff(5, 100);

    // When: chunked with generous limits.
    const chunks = chunkDiffByFile(diffText, { maxChunkBytes: 100_000, maxFilesPerChunk: 50 });

    // Then: exactly one chunk is returned, equal to the original diff.
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(diffText);
  });

  it("CHUNK-5 a huge diff returns many chunks that cover all files", () => {
    // Given: a diff with many files that should be split.
    const fileCount = 100;
    const diffText = buildLargeDiff(fileCount, 50);

    // When: chunked with default limits.
    const chunks = chunkDiffByFile(diffText);

    // Then: the union of `diff --git` paths across all chunks covers
    // every file in the original diff exactly once.
    expect(chunks.length).toBeGreaterThan(1);

    const seenPaths = new Set<string>();
    let totalHeaders = 0;
    for (const chunk of chunks) {
      const headerMatches = chunk.match(/^diff --git a\/(.+?) b\//gmu);
      if (headerMatches !== null) {
        for (const header of headerMatches) {
          const path = header.replace(/^diff --git a\//u, "").replace(/ b\/$/u, "");
          seenPaths.add(path);
          totalHeaders += 1;
        }
      }
    }

    expect(seenPaths.size).toBe(fileCount);
    // Total headers across chunks equals the file count — no duplicates.
    expect(totalHeaders).toBe(fileCount);
    // All the original file paths are present.
    for (let index = 0; index < fileCount; index += 1) {
      const path = `src/file-${index.toString().padStart(4, "0")}.ts`;
      expect(seenPaths.has(path)).toBe(true);
    }
  });

  it("CHUNK-6 chunks never split a single file across chunk boundaries", () => {
    // Given: a large diff with many files. Every chunk must contain only
    // complete file diffs (counted by `diff --git` headers).
    const diffText = buildLargeDiff(80, 75);
    const maxChunkBytes = 800;
    const maxFilesPerChunk = 5;

    // When: chunked with an aggressive byte cap.
    const chunks = chunkDiffByFile(diffText, { maxChunkBytes, maxFilesPerChunk });

    // Then: every chunk has an INTEGER number of file diffs and at
    // least one file. Concretely: every `diff --git` header must be
    // followed eventually by the NEXT `diff --git` header or the end of
    // the chunk — i.e. a chunk never ends in the middle of a file's
    // hunk lines.
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      const fileCount = (chunk.match(/^diff --git /gmu) ?? []).length;
      expect(fileCount).toBeGreaterThanOrEqual(1);
      expect(fileCount).toBeLessThanOrEqual(maxFilesPerChunk);
      expect(chunk.length).toBeLessThanOrEqual(maxChunkBytes);
    }
  });
});
