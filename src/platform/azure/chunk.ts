/**
 * Split a reconstructed unified-diff string into per-file chunks that fit
 * inside the provider's per-request byte budget.
 *
 * Why this exists:
 *   Azure DevOps reconstructs the PR diff by walking every file in the
 *   iteration and emitting a self-contained `diff --git a/PATH b/PATH ...`
 *   block per file. For very large PRs (PR #42 in DemoProject ≈5,000 files)
 *   the resulting string can exceed the model's context window and the
 *   provider emits zero review content — the parse-fail fallback path.
 *   Chunking breaks the diff into manageable per-file groups that the
 *   provider can process individually, then a merge step reconciles
 *   their outputs into one review.
 *
 * Algorithm (GREEDY PACKING):
 *   1. Split the input by `diff --git` boundaries so each chunk is a
 *      contiguous list of WHOLE file diffs. Never split a single file
 *      across chunks (CHUNK-6).
 *   2. Walk files in original order, appending each to the current
 *      chunk until either:
 *        a) Adding the next file would push the chunk beyond
 *           `maxChunkBytes`, OR
 *        b) Adding the next file would put the chunk at
 *           `maxFilesPerChunk` files.
 *      Then start a new chunk. The current chunk is finalized.
 *   3. When the input has only a handful of files OR fits inside the
 *      byte cap, return a single-element array containing the original
 *      diff verbatim (CHUNK-4).
 */

export type ChunkOptions = {
  /**
   * Soft cap on the number of characters per chunk. Default: 8000.
   * 8000 chars ≈ 2 000-4 000 tokens after prompt overhead — well under
   * the 8 192-token budget the live provider runs.
   */
  readonly maxChunkBytes?: number;
  /**
   * Maximum number of files per chunk. Default: 50.
   * Beyond ~50 files per request the model loses focus and the
   * inline-anchored findings degrade.
   */
  readonly maxFilesPerChunk?: number;
};

const DEFAULT_MAX_CHUNK_BYTES = 8_000;
const DEFAULT_MAX_FILES_PER_CHUNK = 50;
const DIFF_HEADER_PREFIX = "diff --git ";

/**
 * Count the number of distinct files in a unified diff by tallying
 * `diff --git ` headers. The `findDiffHeaderIndices` helper does the
 * strict line-start anchor matching, so this function correctly ignores
 * literal `diff --git` substrings that happen to appear inside a hunk.
 *
 * Used by the orchestrator to gate the chunked review path on
 * `review-file-limit` (default 200) — once a PR crosses that threshold
 * we stop calling the provider because per-chunk reviews of an
 * arbitrarily-large initial-import diff produce hallucinated findings
 * that look substantive but aren't grounded in the code.
 */
export function countDiffFiles(diffText: string): number {
  return findDiffHeaderIndices(diffText).length;
}

export function chunkDiffByFile(diffText: string, options?: ChunkOptions): readonly string[] {
  const maxChunkBytes = options?.maxChunkBytes ?? DEFAULT_MAX_CHUNK_BYTES;
  const maxFilesPerChunk = options?.maxFilesPerChunk ?? DEFAULT_MAX_FILES_PER_CHUNK;

  if (diffText.length === 0) {
    return [];
  }

  // Single-file-or-empty diff: nothing to chunk.
  const fileStarts = findDiffHeaderIndices(diffText);
  if (fileStarts.length <= 1 && diffText.length <= maxChunkBytes) {
    return [diffText];
  }

  // Defensive: maxChunkBytes must be at least 1 char so the loop
  // terminates (each file-diff is at minimum a `diff --git` header line).
  const safeBytes = Math.max(1, Math.floor(maxChunkBytes));
  const safeFiles = Math.max(1, Math.floor(maxFilesPerChunk));

  const chunks: string[] = [];
  let currentChunk = "";
  let currentFiles = 0;
  // Index of the start of the current chunk inside `diffText`. Used so
  // we can slice out the chunk verbatim (preserving any leading header
  // lines or zero-length preamble that precede the first `diff --git`).
  let chunkStart = 0;

  for (let index = 0; index < fileStarts.length; index += 1) {
    const fileStart = fileStarts[index]!;
    const fileEnd = index + 1 < fileStarts.length ? fileStarts[index + 1]! : diffText.length;
    const fileBlock = diffText.slice(fileStart, fileEnd);

    const wouldExceedBytes = currentChunk.length + fileBlock.length > safeBytes;
    const wouldExceedFiles = currentFiles + 1 > safeFiles;
    // Files that exceed the byte cap on their own get their own chunk
    // (we never split a file across chunks). This is rare in practice
    // — `buildUnifiedFileDiff` produces byte-light diffs even for big
    // files — but we handle it defensively so the chunker cannot loop
    // forever on a malformed input.
    const fileIsLargerThanChunkCap = fileBlock.length > safeBytes;

    const startNewChunk = currentChunk.length > 0 && (wouldExceedBytes || wouldExceedFiles);

    if (startNewChunk) {
      chunks.push(diffText.slice(chunkStart, fileStart));
      chunkStart = fileStart;
      currentChunk = fileBlock;
      currentFiles = 1;
    } else {
      currentChunk += fileBlock;
      currentFiles += 1;
    }

    // A single-file chunk that already exceeds the cap — never grow it
    // further. Push it as-is.
    if (fileIsLargerThanChunkCap) {
      chunks.push(currentChunk);
      chunkStart = fileEnd;
      currentChunk = "";
      currentFiles = 0;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(diffText.slice(chunkStart));
  }

  // If the input starts with content before the first `diff --git`
  // header (some diff tools emit a preamble), attach it to the first
  // chunk verbatim so we never lose data. We already slice from
  // `chunkStart` so this is handled above — but if there is a preamble
  // and the first file itself needs to be split as an "oversized
  // single-file" chunk, we keep the preamble accessible to the next
  // chunk.
  if (chunks.length === 0) {
    return [diffText];
  }

  return chunks;
}

/**
 * Indices in `diff` of every `diff --git ` header. Boundary detection
 * uses a strict line-start anchor so `diff --git` substrings inside a
 * hunk body (rare, but possible if a code change happens to contain
 * the literal string) are not mistaken for file boundaries.
 */
function findDiffHeaderIndices(diff: string): readonly number[] {
  const starts: number[] = [];
  let cursor = 0;
  while (cursor < diff.length) {
    const nextLineEnd = diff.indexOf("\n", cursor);
    const lineEnd = nextLineEnd === -1 ? diff.length : nextLineEnd;
    const line = diff.slice(cursor, lineEnd);
    if (line.startsWith(DIFF_HEADER_PREFIX)) {
      starts.push(cursor);
    }
    cursor = lineEnd + 1;
    if (nextLineEnd === -1) {
      break;
    }
  }
  return starts;
}
