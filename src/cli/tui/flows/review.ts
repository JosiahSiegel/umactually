import { execFile as execFileCallback } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

import {
  isCancel,
  password,
  select,
  stream,
  text,
} from "@clack/prompts";

import { tryReadSavedConfig } from "../../load-saved-config.js";
import { runStandalone, type StandaloneRunResult } from "../../standalone-run.js";
import { selectPostableComments, type LiveReview } from "../../live-shared.js";
import { parseCliArgs, type ParsedCliArgs } from "../../parse-args.js";
import { renderSummary, type ReviewData } from "../../../render/summary-layouts.js";

const execFile = promisify(execFileCallback);

const providerOptions = [
  { value: "openai-compatible", label: "openai-compatible" },
  { value: "anthropic", label: "anthropic" },
  { value: "copilot", label: "copilot" },
];

const diffOptions = [
  { value: "diff", label: "Use git diff (cwd)" },
  { value: "files", label: "Use --files from cwd" },
  { value: "cancel", label: "Cancel" },
];

function emptyParsedArgs(): ParsedCliArgs {
  return parseCliArgs([]);
}

function buildReviewData(
  review: LiveReview,
  parsed: ParsedCliArgs,
  diffText: string = "",
): ReviewData {
  // `diffText` defaults to "" so existing callers that don't pass a diff
  // (e.g. the legacy no-diff path or test mocks) keep working. When the
  // wizard picks "Use git diff (cwd)", `showSuccess` reads the temp
  // diff file produced by `resolveGitDiffPath()` and forwards its
  // contents here — without that, every finding is classified as
  // off-diff by `selectPostableComments`'s position index, and the
  // review flow renders zero inline comments even when the model
  // emitted perfectly valid findings.
  const postedComments = selectPostableComments({
    review,
    diffText,
    parsed,
    secrets: [],
  });
  const severityCounts = postedComments.reduce<Record<string, number>>((counts, comment) => {
    counts[comment.severity] = (counts[comment.severity] ?? 0) + 1;
    return counts;
  }, {});
  return {
    review,
    provider: parsed.provider ?? "openai-compatible",
    modelId: parsed.model ?? "auto",
    validCommentCount: postedComments.length,
    suppressedCommentCount: 0,
    severityCounts,
    offDiffFromComments: [],
    postedComments,
    secrets: [],
  };
}

async function showSuccess(
  result: Extract<StandaloneRunResult, { kind: "ok" | "ok-no-diff" }>,
  parsed: ParsedCliArgs,
  diffText: string = "",
): Promise<void> {
  if (result.kind === "ok-no-diff") {
    await stream.message([result.note]);
    return;
  }
  const artifact = JSON.parse(await readFile(result.artifactPath, "utf8")) as { review: LiveReview };
  await stream.message([renderSummary(buildReviewData(artifact.review, parsed, diffText))]);
}

/**
 * Resolve the diff source for the "Use git diff (cwd)" option.
 *
 * Runs `git diff` via `execFile` (no shell, no injection surface) in the
 * caller's cwd. Three outcomes:
 *
 *   - non-empty stdout → write to a fresh temp file and return its path
 *     so `runStandalone` can `readFile` it via `parsed.diffPath`.
 *   - empty stdout (clean working tree, no staged + unstaged diff) →
 *     return `null`; `runStandalone` already treats `diffPath === null`
 *     as the graceful "no-diff artifact" path (writes the no-posting
 *     artifact and returns `kind: "ok"`).
 *   - `git diff` itself throws (not a git repo, git not installed,
 *     permission error, etc.) → warn and fall back to `null` so the
 *     wizard still degrades gracefully instead of unwinding the hub.
 *
 * The temp file lives next to the cwd so `runStandalone` resolves it
 * with `resolve(cwd, diffPath)` exactly like a user-supplied path.
 */
async function resolveGitDiffPath(): Promise<string | null> {
  let stdout: string;
  try {
    const output = await execFile("git", ["diff"], { cwd: process.cwd() });
    stdout = output.stdout;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    stream.warn(`git diff failed (${message}); no diff available, falling back to no-diff artifact.`);
    return null;
  }
  if (stdout.trim().length === 0) {
    return null;
  }
  const tempPath = `./.umactually-tui-diff-${process.pid}-${Date.now()}.tmp`;
  await writeFile(tempPath, stdout, "utf8");
  return tempPath;
}

export async function runReviewFlow(): Promise<{ exitCode: 0 }> {
  let retry = false;
  do {
    retry = false;
    let apiKeyLocal: string | null = null;
    let tempDiffPath: string | null = null;
    try {
      const saved = tryReadSavedConfig().config;
      const providerAnswer = await select({ message: "Provider", options: providerOptions, initialValue: saved?.provider ?? "openai-compatible" });
      if (isCancel(providerAnswer)) return { exitCode: 0 };
      const provider = providerAnswer;
      let apiUrl: string | null = null;
      if (provider !== "copilot") {
        const answer = await text({ message: "API URL", initialValue: saved?.apiUrl ?? "", validate: (value) => value?.startsWith("http") === true ? undefined : "must be http(s)" });
        if (isCancel(answer)) return { exitCode: 0 };
        apiUrl = answer;
      }
      const modelAnswer = await text({ message: "Model", initialValue: saved?.model ?? "auto" });
      if (isCancel(modelAnswer)) return { exitCode: 0 };
      const model = modelAnswer;
      if (process.env["UMACTUALLY_API_KEY"] === undefined) {
        const answer = await password({ message: "API key", mask: "*" });
        if (isCancel(answer)) return { exitCode: 0 };
        apiKeyLocal = answer;
      }
      const source = await select({ message: "Diff source", options: diffOptions });
      if (isCancel(source) || source === "cancel") return { exitCode: 0 };
      const diffPath: string | null = source === "diff" ? await resolveGitDiffPath() : null;
      if (source === "diff") {
        tempDiffPath = diffPath;
      }
      // Read the diff text so the post-review summary panel can route
      // findings through selectPostableComments's position index.
      // Passing "" would classify every comment as off-diff and render
      // zero inline comments regardless of what the model produced.
      const diffText: string = diffPath === null ? "" : await readFile(diffPath, "utf8");
      const parsed: ParsedCliArgs = {
        ...emptyParsedArgs(),
        provider: provider as ParsedCliArgs["provider"],
        apiUrl,
        model: model as ParsedCliArgs["model"],
        apiKey: apiKeyLocal,
        diffPath,
        files: source === "files" ? "." : null,
      };
      const result = await runStandalone({ parsed, cwd: process.cwd(), env: process.env });
      if (result.kind === "ok" || result.kind === "ok-no-diff") {
        await showSuccess(result, parsed, diffText);
        return { exitCode: 0 };
      }
      stream.error(result.message);
      const next = await select({ message: "Provider error", options: [{ value: "retry", label: "Retry" }, { value: "menu", label: "Back to menu" }] as const });
      if (isCancel(next) || next === "menu") return { exitCode: 0 };
      retry = next === "retry";
    } catch (err) {
      // Every return path must be { exitCode: 0 }; if runStandalone or
      // a future provider bug throws, surface the message and return
      // to the hub instead of unwinding the whole TUI.
      const message = err instanceof Error ? err.message : String(err);
      stream.error(message);
      return { exitCode: 0 };
    } finally {
      apiKeyLocal = null;
      if (tempDiffPath !== null) {
        // Best-effort cleanup; the temp file lives in cwd and is only
        // ever consumed by runStandalone in the body above.
        const path = tempDiffPath;
        tempDiffPath = null;
        try {
          const { unlink } = await import("node:fs/promises");
          await unlink(path);
        } catch {
          // ignore — file may not exist if git diff returned empty
        }
      }
    }
  } while (retry);
  return { exitCode: 0 };
}
