// SPDX-License-Identifier: MIT

/**
 * CONSTRAINT C-1 GATE TEST.
 *
 * The `--files <path>[,<path>...]` mode in `runLocalFilesReview`
 * (`src/cli/local-files-run.ts`) synthesizes a unified diff from the
 * on-disk file contents and feeds it through the existing
 * `runStandalone` pipeline. The synthesized diff MUST be in the same
 * shape that `parseDiffPositions` / `verifyFindingsAgainstDiff` accept,
 * otherwise every model comment against `--files` review gets
 * suppressed as "off-diff" and the entire feature is silently broken.
 *
 * The current implementation's `diffBlock` helper omits the
 * `+++ b/<path>` line that `parseNewFilePath` (in
 * `src/diff/parse-positions.ts`) requires to bind a `currentPath` to
 * the file. Without that line, `parseDiffPositions` returns an empty
 * index, `verifyFindingsAgainstDiff` drops every comment, and the
 * --files mode posts zero findings regardless of what the model says.
 *
 * This test pins the gate by:
 *   1. Running `runLocalFilesReview` end-to-end (dryRun: false) so the
 *      synthesized diff IS written to `.umactually-auto-ctx/`.
 *   2. Reading that exact diff from disk.
 *   3. Asserting a model comment at (src/foo.ts, line 1) survives
 *      `verifyFindingsAgainstDiff` against the EXACT diff produced
 *      by runLocalFilesReview.
 *
 * Status (RED at first commit): the current shipped `diffBlock` does
 * NOT emit `+++ b/<path>`, so `verifyFindingsAgainstDiff` drops the
 * comment and the test fails. Fix path: add `--- a/<path>` and
 * `+++ b/<path>` lines to `diffBlock` in `src/cli/local-files-run.ts`.
 * Then this test turns GREEN.
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
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { parseCliArgs } from "../../src/cli/parse-args.js";
import { runLocalFilesReview } from "../../src/cli/local-files-run.js";
import { verifyFindingsAgainstDiff } from "../../src/cli/verify-findings.js";
import type { LiveReviewComment, LiveReview } from "../../src/cli/live-shared.js";

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
  } as ReturnType<typeof parseCliArgs>;
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

  // ─────────────────────────────────────────────────────────────────
  // CONSTRAINT C-1 GATE: synthesized-diff hunks MUST survive
  // verifyFindingsAgainstDiff. A model comment with (path, line) that
  // anchors to the synthesized diff's +line positions MUST be kept,
  // not dropped.
  //
  // This test fails RED against the current runLocalFilesReview
  // implementation (which omits the `+++ b/<path>` line that
  // parseDiffPositions requires). Fix runLocalFilesRun's diffBlock
  // to include the `+++ b/<path>` line. Then this test turns GREEN.
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
      (name) => /^local-files-\d+-\d+\.diff$/u.test(name),
    );
    expect(diffFiles.length).toBe(1);
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
});