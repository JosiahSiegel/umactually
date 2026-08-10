/**
 * Centralized exclusion of build-artifact / generated paths from review diffs.
 *
 * Background — what this solves
 * -----------------------------
 * LLMs have strong training-data priors for paths like `dist/cli.js`,
 * `dist/index.js`, `build/`, `node_modules/`, and lockfiles. When a review
 * prompt carries these paths in the diff (or — worse — emits them in the
 * model's response), the model "recognizes" them from training and starts
 * fabricating content about what they contain, even when those paths are
 * not in the supplied diff. PR #56 surfaced this in production: an
 * `auto`-model review of a 122-line source-only diff still produced 8
 * findings citing `dist/cli.js:N` and `dist/index.js:N` line numbers.
 *
 * The production-tool survey (CodeRabbit, Sourcery, Greptile, Ellipsis)
 * converges on the same defense: strip these paths from the diff
 * upstream AND surface them as negative examples in the prompt.
 *
 * Why this lives in its own module
 * --------------------------------
 * Until now, exclusion happened in two places that could drift:
 *   1. `scripts/prepare-azure-pr-inputs.sh` — shell-side `':!dist'`
 *   2. `.github/workflows/self-review.yml` — no exclusion at all (REST diff)
 *
 * A single TypeScript filter applied uniformly:
 *   - on the GitHub REST-diff path (`src/platform/github/api.ts`)
 *   - on the Azure REST-reconstruction path (`src/platform/azure/api.ts`)
 *   - on the local `git diff` path (defense in depth, since the shell
 *     already excludes — the script's `':!dist'` and our filter should
 *     agree)
 *   - on the CLI `--diff <path>` reader (so a user-supplied diff that
 *     still contains dist/ — e.g. from a non-standard pipeline — gets
 *     filtered too)
 *
 * Patterns are minimatch-style globs (directory, wildcard, ext). They
 * match against the forward-slash normalized path so the filter is
 * OS-agnostic.
 */

/** Build-artifact / generated path globs that should never enter a review prompt. */
export const DEFAULT_BUILD_ARTIFACT_PATTERNS: readonly string[] = [
  // Output directories (match the dir and anything under it)
  "dist/",
  "build/",
  "out/",
  "target/", // Rust/Java
  "_build/", // Elixir
  ".next/",
  ".nuxt/",
  ".output/",
  // Compiled / minified / bundled (double-star so we match at any depth)
  "**/*.min.js",
  "**/*.min.css",
  "**/*.bundle.js",
  "**/*.bundle.css",
  "**/*.chunk.js",
  // Source maps (match at any depth)
  "**/*.map",
  // Test coverage
  "coverage/",
  ".nyc_output/",
  // Dependencies
  "node_modules/",
  "vendor/",
  // Lockfiles (match at any depth, including monorepo subdirs)
  "**/package-lock.json",
  "**/yarn.lock",
  "**/pnpm-lock.yaml",
  "**/bun.lockb",
  "**/Gemfile.lock",
  "**/Cargo.lock",
  "**/poetry.lock",
  "**/composer.lock",
  // TypeScript build info (at any depth)
  "**/*.tsbuildinfo",
];

/** Normalize a path to forward-slashes for matching. */
function toPosixPath(path: string): string {
  return path.replace(/\\/gu, "/");
}

/**
 * Convert a single minimatch-ish glob to a RegExp anchored at both ends.
 *
 * Supports:
 *   - directory pattern (ending in slash) — matches the dir itself or anything under it
 *   - double-star — matches any number of path segments
 *   - single-star — matches any number of non-slash characters
 *   - exact path — no wildcards, anchored match only
 *   - `*.ext`              — matches any path ending in `.ext`
 *   - `name.ext`           — exact match (no wildcards)
 *
 * Does NOT support full minimatch syntax — the goal is a small, predictable
 * filter, not a general-purpose matcher. Excluded files are an allowlist;
 * new patterns should be added to `DEFAULT_BUILD_ARTIFACT_PATTERNS` and
 * covered by tests in `test/unit/diff-filter.test.ts`.
 */
function globToRegExp(glob: string): RegExp {
  // Build the RegExp by walking the glob character-by-character.
  // The naive `.replace` approach had a subtle bug: escaping slashes
  // and ordering `**` before `*` is easy to get wrong. The
  // character-by-character walk is more verbose but unambiguous.
  let pattern = "";
  let i = 0;
  while (i < glob.length) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        pattern += ".*";
        i += 2;
        continue;
      }
      pattern += "[^/]*";
      i += 1;
      continue;
    }
    if (ch === "?") {
      pattern += "[^/]";
      i += 1;
      continue;
    }
    if (
      ch === "." || ch === "+" || ch === "(" || ch === ")" ||
      ch === "|" || ch === "^" || ch === "$" || ch === "{" ||
      ch === "}" || ch === "[" || ch === "]" || ch === "\\"
    ) {
      pattern += `\\${ch}`;
      i += 1;
      continue;
    }
    pattern += ch;
    i += 1;
  }

  if (glob.endsWith("/")) {
    // Directory pattern (e.g. `dist/`, `node_modules/`).
    // Strip the trailing `/` for matching: `dist/` becomes `dist`,
    // then we match either the dir itself (`dist`) or the dir followed
    // by `/<anything>` (`dist/cli.js`, `dist/nested/file.js`).
    // For monorepo cases (`packages/api/dist/x.js`), we also match
    // when the dir appears as a non-leading path segment.
    const dirPattern = pattern.slice(0, -1);
    return new RegExp(
      `(?:^${dirPattern}$|^${dirPattern}/|(?:^|.*/)${dirPattern}(?:/|$))`,
      "u",
    );
  }
  // For patterns like `**/*.map`, the leading `**/` should match zero
  // or more path segments. The greedy `.*` does that for us, but
  // anchored to start we need to also allow the prefix to be empty.
  // E.g. `app.js.map` should match `**/*.map`. We replace the leading
  // `^.*?/` with `^(?:.*/)?` to make the prefix optional.
  const finalPattern = pattern.startsWith(".*/") ? `(?:.*/)?${pattern.slice(3)}` : pattern;
  return new RegExp(`^${finalPattern}$`, "u");
}

/**
 * Check whether a path matches any of the given patterns.
 *
 * The path is normalized to forward-slashes before matching, so
 * Windows-style `dist\cli.js` and POSIX `dist/cli.js` are treated
 * identically.
 */
export function isBuildArtifactPath(
  path: string,
  patterns: readonly string[] = DEFAULT_BUILD_ARTIFACT_PATTERNS,
): boolean {
  const normalized = toPosixPath(path);
  for (const pattern of patterns) {
    if (globToRegExp(pattern).test(normalized)) {
      return true;
    }
  }
  return false;
}

export function isExcludedPath(path: string): boolean {
  return isBuildArtifactPath(path);
}

/**
 * Strip every diff block for a path matching a build-artifact pattern.
 *
 * The input is expected to be a unified diff (`diff --git a/... b/...`
 * blocks separated by blank lines or file headers). Each block is dropped
 * entirely — including its `index` line, `--- a/`, `+++ b/`, hunks, and
 * any trailing context. Whitespace between blocks is preserved so the
 * remaining diff is still well-formed.
 *
 * Lines that are not part of any block (e.g. a leading comment or
 * garbage) are preserved verbatim. The function never throws on a
 * malformed input; if no `diff --git` headers are found, the input is
 * returned unchanged.
 */
export function filterBuildArtifacts(
  diffText: string,
  patterns: readonly string[] = DEFAULT_BUILD_ARTIFACT_PATTERNS,
): string {
  if (diffText.length === 0) {
    return diffText;
  }

  // Split into blocks on diff --git headers. We use `String.split` with
  // a multiline regex rather than `String.match` because the latter
  // pattern's `(?=^diff --git |$)` lookahead matches the end of every
  // line (the `m` flag makes `$` mean end-of-line), which truncated
  // each block at the first `--- a/...` line. Splitting on the header
  // itself and prepending it to each subsequent piece is unambiguous.
  const parts = diffText.split(/^diff --git /um);
  if (parts.length <= 1) {
    // No `diff --git ` headers — input is either empty or not a diff.
    return diffText;
  }
  const blocks = parts.slice(1).map((p) => `diff --git ${p}`);

  const retained: string[] = [];
  let retainedBytes = 0;
  let droppedBlocks = 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- count reserved for future telemetry
  droppedBlocks += 1;
  for (const block of blocks) {
    const { a, b } = extractTargetPaths(block);
    // Test the artifact filter against BOTH sides so renames across
    // the filter boundary are caught. A file moved FROM dist/ TO
    // src/ is reported by the `a` side as `dist/x.js`; a file moved
    // FROM src/ TO dist/ is reported by the `b` side as `dist/x.js`.
    // Either side matching means the block touches a build artifact.
    const matchesArtifact =
      (a !== null && isBuildArtifactPath(a, patterns)) ||
      (b !== null && isBuildArtifactPath(b, patterns));
    if (matchesArtifact) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- counter reserved for future telemetry
      droppedBlocks += 1;
      continue;
    }
    retained.push(block);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- byte-count counter reserved for future telemetry
    retainedBytes += block.length;
  }

  // Avoid returning an empty string when every block was filtered; downstream
  // callers (e.g. `parseDiffPositions`) treat empty diffs as "no review
  // surface" and produce a parse-fail. Surface that with a one-line marker
  // so the model at least sees something meaningful.
  if (retained.length === 0) {
    return "";
  }

  // Join with a single newline so consecutive `diff --git` blocks are
  // separated. The split stripped the leading `diff --git ` marker from
  // every block (we re-prepended it), but the inter-block separator
  // (the trailing newline of the previous block) was discarded by
  // String.split's separator semantics. Re-inserting `\n` here keeps
  // the output parseable as a unified diff.
  return retained.join("\n");
}

/**
 * Extract the target paths from a diff block. Returns both the
 * `a/` (old) and `b/` (new) sides so the caller can test the
 * artifact-pattern filter against BOTH paths of a rename. A file
 * moved across the filter boundary (e.g. `dist/x.js` → `src/x.js`)
 * is correctly filtered by testing the old path; a file moved INTO
 * a non-artifact path (e.g. `src/x.js` → `dist/x.js`) is correctly
 * filtered by testing the new path.
 *
 * Either side may be null (file add: only `b/`, file delete: only
 * `a/`, malformed: neither).
 */
function extractTargetPaths(block: string): { a: string | null; b: string | null } {
  const lines = block.split(/\r?\n/u);
  return {
    a: readPathLine(lines, "--- "),
    b: readPathLine(lines, "+++ "),
  };
}

function readPathLine(lines: readonly string[], prefix: string): string | null {
  for (const line of lines) {
    if (!line.startsWith(prefix)) {
      continue;
    }
    const rawPath = line.slice(prefix.length).split("\t")[0]?.trim() ?? "";
    if (rawPath === "" || rawPath === "/dev/null") {
      return null;
    }
    return rawPath.startsWith("a/") || rawPath.startsWith("b/")
      ? rawPath.slice(2)
      : rawPath;
  }
  return null;
}

/**
 * Return the list of paths that appear in a diff (both `a/` and `b/`
 * sides, deduplicated, forward-slash normalized). Used by the prompt
 * builder to enumerate the diff's file list as a path enum in the
 * JSON-schema + system-prompt path.
 *
 * Skips `/dev/null` on either side (file adds/dels). Order matches
 * the diff's first appearance.
 */
export function listDiffPaths(diffText: string): readonly string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const lines = diffText.split(/\r?\n/u);
  for (const line of lines) {
    if (!line.startsWith("+++ ") && !line.startsWith("--- ")) {
      continue;
    }
    const rawPath = line.slice(4).split("\t")[0]?.trim() ?? "";
    if (rawPath === "" || rawPath === "/dev/null") {
      continue;
    }
    const stripped = rawPath.startsWith("a/") || rawPath.startsWith("b/")
      ? rawPath.slice(2)
      : rawPath;
    const normalized = toPosixPath(stripped);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    ordered.push(normalized);
  }
  return ordered;
}
