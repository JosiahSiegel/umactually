// SPDX-License-Identifier: MIT

/**
 * Regression gate: a model comment at (path, line) must survive
 * `verifyFindingsAgainstDiff` against the exact synthesized diff
 * produced by `runLocalFilesReview`. The synthesized diff MUST be in
 * the shape `parseDiffPositions` accepts — diff --git / --- / +++
 * headers plus indexed `+` rows. The shipped `diffBlock` in
 * src/cli/local-files-run.ts emits that shape; if a future refactor
 * drops any of the three header lines, the comment is dropped and
 * this test turns RED.
 */
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseCliArgs } from "../../src/cli/parse-args.js";
import { runLocalFilesReview } from "../../src/cli/local-files-run.js";
import { verifyFindingsAgainstDiff } from "../../src/cli/verify-findings.js";
import type { LiveReviewComment, LiveReview } from "../../src/cli/live-shared.js";
import {
  collectLocalFilesCommaErrors,
  collectLocalFilesExclusionErrors,
  collectValidationErrors,
} from "../../src/cli/validate.js";
import { BRAND_PREFIX } from "../../src/util/brand.js";

// Same env-clear shape as `test/unit/cli-bare-invocation.test.ts`.
const ENV_KEYS_TO_CLEAR = [
  "UMACTUALLY_API_URL", "UMACTUALLY_API_KEY", "UMACTUALLY_MODEL",
  "UMACTUALLY_DRY_RUN", "UMACTUALLY_PROMPT_FILE", "UMACTUALLY_ADDITIONAL_PROMPT_FILE",
  "REVIEW_PROVIDER_URL", "REVIEW_PROVIDER_API_KEY", "REVIEW_PROVIDER_MODEL",
  "REVIEW_DRY_RUN", "REVIEW_PLATFORM",
  "GITHUB_ACTIONS", "TF_BUILD",
] as const;

/** Build a parsed CLI args object suitable for runLocalFilesReview. */
function buildParsedFor(files: string): ReturnType<typeof parseCliArgs> {
  const base = parseCliArgs(["--files", files]);
  // Provide minimal fake credentials so validation-style code paths
  // don't reject the object — `runLocalFilesReview` will call the
  // provider, which we stub out via globalThis.fetch below. These
  // values are never read by the stub.
  return {
    ...base,
    apiUrl: "http://test",
    apiKey: "test",
    dryRun: false,
  };
}

/**
 * Stub `globalThis.fetch` with a fetch impl that returns a successful
 * OpenAI-shaped chat completion response whose JSON payload contains
 * one comment at (src/foo.ts, line 1). This lets `runLocalFilesReview`
 * run end-to-end (writes the synthesized diff to disk, calls the
 * provider, writes the review artifact) without any real network.
 *
 * Returns a restore function the caller MUST invoke in `afterEach`
 * to put the original fetch back.
 */
function stubProviderFetch(): () => void {
  const originalFetch = globalThis.fetch;
  const reviewPayload = {
    summary: "test",
    verdict: "COMMENT",
    comments: [
      {
        path: "src/foo.ts",
        line: 1,
        body: "hello world",
        severity: "medium",
        category: "test",
      },
    ],
    suppressed_comments: [],
  };
  const fakeResponseBody = JSON.stringify({
    id: "chatcmpl-stub",
    object: "chat.completion",
    created: 0,
    model: "stub-model",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: JSON.stringify(reviewPayload),
        },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  });
  // Stub for any provider wire shape the dispatcher routes to.
  // Returns 200 with the review JSON regardless of URL/method.
  globalThis.fetch = (async (): Promise<Response> => {
    return new Response(fakeResponseBody, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

describe("CLI local-files review (Constraint C-1 gate)", () => {
  let tmpdirPath = "";
  let savedEnv: Record<string, string | undefined> = {};
  let restoreFetch: (() => void) | null = null;

  beforeEach(() => {
    savedEnv = {};
    for (const key of ENV_KEYS_TO_CLEAR) savedEnv[key] = process.env[key];
    for (const key of ENV_KEYS_TO_CLEAR) delete process.env[key];
    tmpdirPath = mkdtempSync(join(tmpdir(), "umactually-lf-"));
    mkdirSync(join(tmpdirPath, "src"), { recursive: true });
    restoreFetch = stubProviderFetch();
  });

  afterEach(() => {
    if (restoreFetch !== null) {
      restoreFetch();
      restoreFetch = null;
    }
    for (const key of ENV_KEYS_TO_CLEAR) delete process.env[key];
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (tmpdirPath.length > 0) rmSync(tmpdirPath, { recursive: true, force: true });
  });

  // CONSTRAINT C-1 GATE: synthesized-diff hunks MUST survive
  // verifyFindingsAgainstDiff. A model comment with (path, line) that
  // anchors to the synthesized diff's +line positions MUST be kept,
  // not dropped. The shipped `diffBlock` in src/cli/local-files-run.ts
  // emits the four-line header (`diff --git` / `--- a/<path>` /
  // `+++ b/<path>` / `@@ -0,0 +1,<N> @@`) and indexed `+<line>` rows;
  // if any of those lines is dropped, the test turns RED.
  // ─────────────────────────────────────────────────────────────────
  it("Constraint C-1: a model comment at path='src/foo.ts', line=1 survives verifyFindingsAgainstDiff against the EXACT diff produced by runLocalFilesReview", async () => {
    const srcPath = join(tmpdirPath, "src/foo.ts");
    writeFileSync(srcPath, "export function hello() { return 1; }\n");

    // Run end-to-end. With dryRun: false, runLocalFilesReview writes
    // the synthesized diff to `.umactually-auto-ctx/local-files-*.diff`
    // BEFORE calling the provider (line 159 of local-files-run.ts).
    // The provider call is stubbed by stubProviderFetch() above so
    // no network is needed.
    const parsed = buildParsedFor(srcPath);
    const result = await runLocalFilesReview({ parsed, cwd: tmpdirPath, env: {} });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    // Locate the synthesized diff written by runLocalFilesReview.
    // The exact filename embeds pid + Date.now() so we glob for the
    // `local-files-*.diff` pattern under `.umactually-auto-ctx/`.
    const autoCtxDir = join(tmpdirPath, ".umactually-auto-ctx");
    expect(existsSync(autoCtxDir)).toBe(true);
    const diffFiles = readdirSync(autoCtxDir).filter(
      (name) => /^local-files-(?:dry-run|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.diff$/u.test(name),
    );
    expect(diffFiles).toHaveLength(1);
    const diffPath = join(autoCtxDir, diffFiles[0] as string);
    const synthesizedDiff = readFileSync(diffPath, "utf8");

    // A model comment at (src/foo.ts, line 1) — the synthesized
    // diff's +line positions should anchor to it.
    const mockComment: LiveReviewComment = {
      path: "src/foo.ts",
      line: 1,
      body: "hello world",
      severity: "medium",
      category: "test",
    };
    const mockReview: LiveReview = {
      summary: "test",
      verdict: "COMMENT",
      comments: [mockComment],
      suppressedComments: [],
    };

    // The gate: the EXACT diff produced by runLocalFilesReview MUST
    // accept this comment. With the current shipped `diffBlock`
    // (which omits `+++ b/<path>`), parseDiffPositions cannot bind
    // a currentPath, so linesByPath stays empty and the comment is
    // dropped. Once diffBlock is fixed to include `+++ b/<path>`,
    // the comment is kept.
    const verification = verifyFindingsAgainstDiff({ review: mockReview, diffText: synthesizedDiff });
    expect(verification.verified).toHaveLength(1);
    expect(verification.verified[0]).toEqual(mockComment);
    expect(verification.dropped).toHaveLength(0);
  });

  // ─────────────────────────────────────────────────────────────────
  // Failure scenarios & happy-path variants for `--files` mode.
  // Each new `it()` exercises a distinct branch of
  // `runLocalFilesReview` / `collectValidationErrors` so regressions
  // in the file-discovery, binary-skip, dry-run, de-duplication,
  // exclude-list, and mutual-exclusion paths get pinned independently
  // of the C-1 diff-shape gate above.
  // ─────────────────────────────────────────────────────────────────

  it("--files nonexistent path returns kind: ok-no-files with 'no files matched' note (no provider call)", async () => {
    // The beforeEach stubbed fetch is unnecessary for this test
    // (runLocalFilesReview short-circuits before the provider call when
    // zero files match), so restore it to keep the test surface honest.
    if (restoreFetch !== null) {
      restoreFetch();
      restoreFetch = null;
    }

    const srcPath = join(tmpdirPath, "src/foo.ts");
    // Sanity: the file the test claims is "nonexistent" really isn't on disk.
    expect(existsSync(srcPath)).toBe(false);

    const parsed = buildParsedFor(srcPath);
    const result = await runLocalFilesReview({ parsed, cwd: tmpdirPath, env: {} });
    expect(result.kind).toBe("ok-no-files");
    if (result.kind !== "ok-no-files") return;
    expect(result.note).toContain("no files matched");
  });

  it("--files with --dry-run returns kind: ok and does NOT write the .umactually-auto-ctx diff file", async () => {
    const srcPath = join(tmpdirPath, "src/foo.ts");
    writeFileSync(srcPath, "export function hello() { return 1; }\n");

    // Parse with --dry-run so the parsed.dryRun flag actually carries.
    const base = parseCliArgs(["--files", srcPath, "--dry-run"]);
    const parsed = {
      ...base,
      apiUrl: "http://test",
      apiKey: "test",
    };
    expect(parsed.dryRun).toBe(true);

    const result = await runLocalFilesReview({ parsed, cwd: tmpdirPath, env: {} });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    // `runLocalFilesReview` returns BEFORE mkdirSync/writeFile when
    // dryRun is set (local-files-run.ts:157-158), so neither the
    // `.umactually-auto-ctx/` directory nor the `*-dry-run.diff` file
    // should exist on disk.
    const autoCtxDir = join(tmpdirPath, ".umactually-auto-ctx");
    expect(existsSync(autoCtxDir)).toBe(false);
    expect(
      readdirSync(tmpdirPath).some((name) => name === ".umactually-auto-ctx"),
    ).toBe(false);
  });

  it("--files silently skips binary files (NUL-byte >5%) and the diff excludes them", async () => {
    // The binary file alone would yield `ok-no-files`; add a non-binary
    // companion so the run stays in the `ok` branch and writes a diff
    // whose content we can inspect.
    const realPath = join(tmpdirPath, "src/foo.ts");
    writeFileSync(realPath, "export const real = 1;\n");
    const pngPath = join(tmpdirPath, "src/asset.png");
    // 6 NUL bytes + "data" (4 bytes) = 10 bytes total, 60% NUL. Threshold
    // in isBinary() is `nulBytes / bytesRead > 0.05`.
    writeFileSync(pngPath, "\x00\x00\x00\x00\x00\x00data");

    // Spy on console.error so we can assert the skip line was emitted.
    // isBinary logs `${BRAND_PREFIX}--files: skipped ${relativePath} (binary)`.
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const parsed = buildParsedFor(`${realPath},${pngPath}`);
      const result = await runLocalFilesReview({ parsed, cwd: tmpdirPath, env: {} });
      expect(result.kind).toBe("ok");
      if (result.kind !== "ok") return;

      // The skip line was emitted to stderr at least once and contains
      // both the brand-prefixed marker and the (binary) suffix.
      const joinedStderr = stderrSpy.mock.calls.map((call) => String(call[0])).join("\n");
      expect(joinedStderr).toContain(`${BRAND_PREFIX}--files: skipped`);
      expect(joinedStderr).toContain("(binary)");

      // The synthesized diff must NOT contain the binary asset path;
      // only the non-binary `src/foo.ts` block survives.
      const autoCtxDir = join(tmpdirPath, ".umactually-auto-ctx");
      const diffFiles = readdirSync(autoCtxDir).filter(
        (name) => /^local-files-(?:dry-run|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.diff$/u.test(name),
      );
      expect(diffFiles).toHaveLength(1);
      const diffText = readFileSync(join(autoCtxDir, diffFiles[0] as string), "utf8");
      expect(diffText).not.toContain("a/src/asset.png");
      expect(diffText).toContain("a/src/foo.ts");
    } finally {
      stderrSpy.mockRestore();
    }
  });

  it("collectLocalFilesExclusionErrors: --files combined with --diff returns 1 error naming both flags", () => {
    const parsed = parseCliArgs(["--files", "a.ts", "--diff", "x.diff"]);
    const errors = collectLocalFilesExclusionErrors(parsed);
    const diffError = errors.find((e) => e.message.includes("--diff"));
    expect(diffError).toBeDefined();
    expect(diffError?.flag).toBe("--files");
    expect(diffError?.message).toBe("--files cannot be combined with --diff");
  });

  it("collectLocalFilesExclusionErrors: --files combined with --event returns 1 error naming --event", () => {
    const parsed = parseCliArgs(["--files", "a.ts", "--event", "x.json"]);
    const errors = collectLocalFilesExclusionErrors(parsed);
    const eventError = errors.find((e) => e.message.includes("--event"));
    expect(eventError).toBeDefined();
    expect(eventError?.flag).toBe("--files");
    expect(eventError?.message).toBe("--files cannot be combined with --event");
  });

  it("collectLocalFilesExclusionErrors: --files combined with --review returns 1 error naming --review", () => {
    const parsed = parseCliArgs(["--files", "a.ts", "--review", "review.json"]);
    const errors = collectLocalFilesExclusionErrors(parsed);
    const reviewError = errors.find((e) => e.message.includes("--review"));
    expect(reviewError).toBeDefined();
    expect(reviewError?.flag).toBe("--files");
    expect(reviewError?.message).toBe("--files cannot be combined with --review");
  });

  it("collectValidationErrors composes every per-flag exclusion into one error list (mutual exclusion surfaces 3 entries)", () => {
    // All three mutual exclusions present → 3 errors, each flagged --files.
    const parsed = parseCliArgs([
      "--files", "a.ts",
      "--diff", "x.diff",
      "--event", "x.json",
      "--review", "review.json",
    ]);
    const errors = collectValidationErrors(parsed);
    const filesConflicts = errors.filter((e) => e.flag === "--files");
    expect(filesConflicts.length).toBeGreaterThanOrEqual(3);
    const messages = filesConflicts.map((e) => e.message);
    expect(messages).toContain("--files cannot be combined with --diff");
    expect(messages).toContain("--files cannot be combined with --event");
    expect(messages).toContain("--files cannot be combined with --review");
  });

  it("collectLocalFilesCommaErrors: returns [] for normal multi-path input (comma-as-separator, no nesting)", () => {
    // Plain `--files a,b` splits at parse time; the validator's defensive
    // comma check then sees two entries with no embedded commas.
    const parsed = parseCliArgs(["--files", "a.ts,b.ts"]);
    const errors = collectLocalFilesCommaErrors(parsed);
    expect(errors).toEqual([]);
  });

  it("--files with GITHUB_ACTIONS=true still routes to runLocalFilesReview (CI marker is ignored per Constraint C-3)", async () => {
    const srcPath = join(tmpdirPath, "src/foo.ts");
    writeFileSync(srcPath, "export function hello() { return 1; }\n");

    // Force the CI marker; beforeEach already cleared it for us.
    process.env["GITHUB_ACTIONS"] = "true";
    try {
      const parsed = buildParsedFor(srcPath);
      const result = await runLocalFilesReview({ parsed, cwd: tmpdirPath, env: {} });
      // The local-files branch runs regardless of CI markers; result
      // shape is `ok` (the provider call is stubbed by stubProviderFetch).
      expect(result.kind).toBe("ok");
    } finally {
      // afterEach will restore savedEnv; explicitly clear in case of failure.
      delete process.env["GITHUB_ACTIONS"];
    }
  });

  it("--files with duplicate paths deduplicates (single diff hunk per file)", async () => {
    const srcPath = join(tmpdirPath, "src/foo.ts");
    writeFileSync(srcPath, "export const x = 1;\n");

    // Same path repeated via comma-list. `splitPaths` produces
    // ["<abs>", "<abs>"]; `collectFiles` deduplicates via Set<absolute>.
    const parsed = buildParsedFor(`${srcPath},${srcPath}`);
    const result = await runLocalFilesReview({ parsed, cwd: tmpdirPath, env: {} });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    const autoCtxDir = join(tmpdirPath, ".umactually-auto-ctx");
    const diffFiles = readdirSync(autoCtxDir).filter(
      (name) => /^local-files-(?:dry-run|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.diff$/u.test(name),
    );
    expect(diffFiles).toHaveLength(1);
    const diffText = readFileSync(join(autoCtxDir, diffFiles[0] as string), "utf8");

    // Exactly one `diff --git a/src/foo.ts` block (no duplicate hunk).
    const blocks = diffText.match(/^diff --git a\/src\/foo\.ts /gum) ?? [];
    expect(blocks).toHaveLength(1);
    // Synthesized diff for "export const x = 1;" contains the +line.
    expect(diffText).toContain("+export const x = 1;");
  });

  it("--files with a directory argument walks recursively (relative path is preserved through the walk)", async () => {
    // Build a nested directory the walker must descend through.
    const nestedDir = join(tmpdirPath, "src", "sub1", "sub2");
    mkdirSync(nestedDir, { recursive: true });
    const nestedPath = join(nestedDir, "foo.ts");
    writeFileSync(nestedPath, "line1\n");

    // Pass the `src/` directory (absolute) as the single --files entry;
    // `readdir(recursive)` should pick up `src/sub1/sub2/foo.ts`.
    const parsed = buildParsedFor(join(tmpdirPath, "src"));
    const result = await runLocalFilesReview({ parsed, cwd: tmpdirPath, env: {} });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    const autoCtxDir = join(tmpdirPath, ".umactually-auto-ctx");
    const diffFiles = readdirSync(autoCtxDir).filter(
      (name) => /^local-files-(?:dry-run|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.diff$/u.test(name),
    );
    expect(diffFiles).toHaveLength(1);
    const diffText = readFileSync(join(autoCtxDir, diffFiles[0] as string), "utf8");

    // Relative path is preserved through the walk: `a/src/sub1/sub2/foo.ts`.
    expect(diffText).toContain("a/src/sub1/sub2/foo.ts");
    expect(diffText).toContain("+line1");
  });

  it("--files with build-artifact directories (dist/) is excluded — no `a/dist/...` block ends up in the synthesized diff", async () => {
    // Real source file inside `src/` AND a fake file inside the excluded
    // `dist/` directory. `DEFAULT_BUILD_ARTIFACT_PATTERNS` (filter-build-artifacts.ts:43)
    // lists `dist/` as a trailing-slash directory pattern; `isExcludedPath`
    // strips any path matching it OR anything beneath it.
    mkdirSync(join(tmpdirPath, "src"), { recursive: true });
    mkdirSync(join(tmpdirPath, "dist"), { recursive: true });
    writeFileSync(join(tmpdirPath, "src/keep.ts"), "export const k = 1;\n");
    writeFileSync(join(tmpdirPath, "dist/skip.js"), "var skipped = true;\n");

    // Pass a directory at the root that contains both src/ and dist/; the
    // walker must emit a block for src/keep.ts and must NOT emit one for
    // dist/skip.js.
    const parsed = buildParsedFor(tmpdirPath);
    const result = await runLocalFilesReview({ parsed, cwd: tmpdirPath, env: {} });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    const autoCtxDir = join(tmpdirPath, ".umactually-auto-ctx");
    const diffFiles = readdirSync(autoCtxDir).filter(
      (name) => /^local-files-(?:dry-run|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.diff$/u.test(name),
    );
    expect(diffFiles).toHaveLength(1);
    const diffText = readFileSync(join(autoCtxDir, diffFiles[0] as string), "utf8");

    expect(diffText).toContain("a/src/keep.ts");
    expect(diffText).not.toContain("a/dist/skip.js");
    expect(diffText).not.toContain("b/dist/skip.js");
  });

  it("--files with node_modules/ inside the cwd is excluded — no `a/node_modules/...` block in the synthesized diff", async () => {
    mkdirSync(join(tmpdirPath, "src"), { recursive: true });
    mkdirSync(join(tmpdirPath, "node_modules"), { recursive: true });
    writeFileSync(join(tmpdirPath, "src/keep.ts"), "export const k = 1;\n");
    writeFileSync(join(tmpdirPath, "node_modules/foo.ts"), "export const skipped = 1;\n");

    const parsed = buildParsedFor(tmpdirPath);
    const result = await runLocalFilesReview({ parsed, cwd: tmpdirPath, env: {} });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    const autoCtxDir = join(tmpdirPath, ".umactually-auto-ctx");
    const diffFiles = readdirSync(autoCtxDir).filter(
      (name) => /^local-files-(?:dry-run|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.diff$/u.test(name),
    );
    expect(diffFiles).toHaveLength(1);
    const diffText = readFileSync(join(autoCtxDir, diffFiles[0] as string), "utf8");

    expect(diffText).toContain("a/src/keep.ts");
    expect(diffText).not.toContain("a/node_modules/foo.ts");
    expect(diffText).not.toContain("b/node_modules/foo.ts");
  });

  it("parseCliArgs round-trips the --files flag: present string is preserved verbatim, absent is null", () => {
    expect(parseCliArgs(["--files", "a,b"]).files).toBe("a,b");
    expect(parseCliArgs(["--files", "x.ts"]).files).toBe("x.ts");
    expect(parseCliArgs([]).files).toBeNull();
    expect(parseCliArgs(["--diff", "x.diff"]).files).toBeNull();
  });

  it("runLocalFilesReview: synthesized diff starts with `diff --git a/` and ends with a `+...` line", async () => {
    const srcPath = join(tmpdirPath, "src/foo.ts");
    writeFileSync(srcPath, "hello\nworld\n");

    const parsed = buildParsedFor(srcPath);
    const result = await runLocalFilesReview({ parsed, cwd: tmpdirPath, env: {} });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    const autoCtxDir = join(tmpdirPath, ".umactually-auto-ctx");
    const diffFiles = readdirSync(autoCtxDir).filter(
      (name) => /^local-files-(?:dry-run|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.diff$/u.test(name),
    );
    expect(diffFiles).toHaveLength(1);
    const diffText = readFileSync(join(autoCtxDir, diffFiles[0] as string), "utf8");

    expect(diffText.startsWith("diff --git a/")).toBe(true);

    // Last non-empty trimmed line should be a synthesized `+` line, not a
    // stray marker. (`diffBlock` always emits `+<line>` for every content
    // line, so this gives a coarse shape check on the synthesized diff.)
    const nonEmptyLines = diffText.split(/\r?\n/u).filter((line) => line.length > 0);
    const lastLine = nonEmptyLines[nonEmptyLines.length - 1] as string;
    expect(lastLine.startsWith("+")).toBe(true);
    expect(lastLine.startsWith("+++")).toBe(false); // not the +++ header line
  });

  // ─────────────────────────────────────────────────────────────────
  // Constraint C-2: unreadable or vanishing files must be SKIPPED,
  // not propagated. Mirror `candidatePaths`'s contract: log
  // `${BRAND_PREFIX}--files: skipped <path> (<reason>)` and continue.
  // ─────────────────────────────────────────────────────────────────
  it("Constraint C-2: a single unreadable file does NOT abort the walk; surviving files are still reviewed", async () => {
    const realPath = join(tmpdirPath, "src/keep.ts");
    writeFileSync(realPath, "export const k = 1;\n");
    const lockedPath = join(tmpdirPath, "src/locked.ts");
    writeFileSync(lockedPath, "export const locked = 1;\n");
    await chmod(lockedPath, 0o000);

    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const parsed = buildParsedFor(`${realPath},${lockedPath}`);
      const result = await runLocalFilesReview({ parsed, cwd: tmpdirPath, env: {} });

      expect(result.kind).toBe("ok");
      if (result.kind !== "ok") return;

      const joinedStderr = stderrSpy.mock.calls
        .map((call) => String(call[0]))
        .join("\n");
      expect(joinedStderr).toContain(`${BRAND_PREFIX}--files: skipped`);
      expect(joinedStderr).toContain("src/locked.ts");

      const autoCtxDir = join(tmpdirPath, ".umactually-auto-ctx");
      const diffFiles = readdirSync(autoCtxDir).filter(
        (name) => /^local-files-(?:dry-run|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.diff$/u.test(name),
      );
      expect(diffFiles).toHaveLength(1);
      const diffText = readFileSync(join(autoCtxDir, diffFiles[0] as string), "utf8");

      expect(diffText).toContain("a/src/keep.ts");
      expect(diffText).not.toContain("a/src/locked.ts");
    } finally {
      await chmod(lockedPath, 0o644);
      stderrSpy.mockRestore();
    }
  });
});