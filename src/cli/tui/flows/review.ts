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
import type { SavedConfig } from "../../../config/saved-config.js";
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

type WizardPrompt =
  | { cancel: true }
  | {
      cancel: false;
      provider: ParsedCliArgs["provider"];
      apiUrl: string | null;
      model: ParsedCliArgs["model"];
      apiKeyLocal: string | null;
      source: "diff" | "files";
      diffPath: string | null;
      diffText: string;
    };

/**
 * Run the wizard's prompt sequence (provider, apiUrl, model, apiKey,
 * diff source). Returns a discriminated union: `{ cancel: true }`
 * short-circuits the loop; otherwise the ok-branch carries the parsed
 * user choices plus the resolved diff path and text.
 *
 * Extracted from `runReviewFlow` to keep the outer loop below the
 * SonarCloud cognitive-complexity threshold (15). Each `isCancel`
 * return is a true early-exit so the helper bails out before any
 * nested state accumulates.
 */
async function runWizardPrompts(
  savedConfig: SavedConfig | null | undefined,
): Promise<WizardPrompt> {
  const providerAnswer = await select({
    message: "Provider",
    options: providerOptions,
    initialValue: savedConfig?.provider ?? "openai-compatible",
  });
  if (isCancel(providerAnswer)) return { cancel: true };
  const provider = providerAnswer;
  let apiUrl: string | null = null;
  if (provider !== "copilot") {
    const answer = await text({
      message: "API URL",
      initialValue: savedConfig?.apiUrl ?? "",
      validate: (value) =>
        value?.startsWith("http") === true ? undefined : "must be http(s)",
    });
    if (isCancel(answer)) return { cancel: true };
    apiUrl = answer;
  }
  const modelAnswer = await text({
    message: "Model",
    initialValue: savedConfig?.model ?? "auto",
  });
  if (isCancel(modelAnswer)) return { cancel: true };
  const model = modelAnswer;
  let apiKeyLocal: string | null = null;
  if (process.env["UMACTUALLY_API_KEY"] === undefined) {
    const answer = await password({ message: "API key", mask: "*" });
    if (isCancel(answer)) return { cancel: true };
    apiKeyLocal = answer;
  }
  const source = await select({ message: "Diff source", options: diffOptions });
  if (isCancel(source) || source === "cancel") return { cancel: true };
  const diffSource: "diff" | "files" = source as "diff" | "files";
  const diffPath: string | null = diffSource === "diff" ? await resolveGitDiffPath() : null;
  // Read the diff text so the post-review summary panel can route
  // findings through selectPostableComments's position index.
  // Passing "" would classify every comment as off-diff and render
  // zero inline comments regardless of what the model produced.
  const diffText: string = diffPath === null ? "" : await readFile(diffPath, "utf8");
  return {
    cancel: false,
    provider: provider as ParsedCliArgs["provider"],
    apiUrl,
    model: model as ParsedCliArgs["model"],
    apiKeyLocal,
    source: diffSource,
    diffPath,
    diffText,
  };
}

type RunOutcome =
  | { exit: true }
  | { exit: false; retry: true }
  | { exit: false; retry: false };

/**
 * Invoke `runStandalone` with the freshly captured key propagated to
 * `env`, then dispatch the result. The success path zeroizes the key
 * before `showSuccess` runs (Fix D); the error path zeroizes before
 * the retry/menu prompt so the secret never survives the decision.
 *
 * Returns a small `RunOutcome` so the outer loop can keep its
 * `retry` flag out of the helper's scope.
 */
async function runAndHandle(
  parsed: ParsedCliArgs,
  diffText: string,
  apiKeyLocal: string | null,
): Promise<RunOutcome> {
  // Fix C: build the env so the freshly captured key reaches the
  // provider even when the operator typed it into the wizard.
  const env = {
    ...process.env,
    ...(apiKeyLocal !== null && { UMACTUALLY_API_KEY: apiKeyLocal }),
  };
  const result = await runStandalone({ parsed, cwd: process.cwd(), env });
  if (result.kind === "ok" || result.kind === "ok-no-diff") {
    // Fix D: zeroize before any awaitable that doesn't depend on the
    // key (Fix D explicitly notes this is stack-dwell mitigation, not
    // a security guarantee).
    apiKeyLocal = null;
    await showSuccess(result, parsed, diffText);
    return { exit: true };
  }
  stream.error(result.message);
  const next = await select({
    message: "Provider error",
    options: [
      { value: "retry", label: "Retry" },
      { value: "menu", label: "Back to menu" },
    ] as const,
  });
  apiKeyLocal = null;
  if (isCancel(next) || next === "menu") return { exit: true };
  return { exit: false, retry: next === "retry" };
}

export async function runReviewFlow(): Promise<{ exitCode: 0 }> {
  let retry = false;
  do {
    let apiKeyLocal: string | null = null;
    let tempDiffPath: string | null = null;
    try {
      const saved = tryReadSavedConfig().config;
      const prompt = await runWizardPrompts(saved);
      if (prompt.cancel) return { exitCode: 0 };
      apiKeyLocal = prompt.apiKeyLocal;
      if (prompt.source === "diff") tempDiffPath = prompt.diffPath;
      const parsed: ParsedCliArgs = {
        ...emptyParsedArgs(),
        provider: prompt.provider,
        apiUrl: prompt.apiUrl,
        model: prompt.model,
        apiKey: apiKeyLocal,
        diffPath: prompt.diffPath,
        files: prompt.source === "files" ? "." : null,
      };
      const outcome = await runAndHandle(parsed, prompt.diffText, apiKeyLocal);
      apiKeyLocal = null;
      if (outcome.exit) return { exitCode: 0 };
      retry = outcome.retry;
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
