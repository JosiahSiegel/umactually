import { readFile } from "node:fs/promises";

import * as p from "@clack/prompts";

import { tryReadSavedConfig } from "../../load-saved-config.js";
import { runStandalone, type StandaloneRunResult } from "../../standalone-run.js";
import { selectPostableComments, type LiveReview } from "../../live-shared.js";
import { parseCliArgs, type ParsedCliArgs } from "../../parse-args.js";
import { renderSummary, type ReviewData } from "../../../render/summary-layouts.js";

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

function buildReviewData(review: LiveReview, parsed: ParsedCliArgs): ReviewData {
  const postedComments = selectPostableComments({
    review,
    diffText: "",
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

async function showSuccess(result: Extract<StandaloneRunResult, { kind: "ok" | "ok-no-diff" }>, parsed: ParsedCliArgs): Promise<void> {
  if (result.kind === "ok-no-diff") {
    await p.stream.message([result.note]);
    return;
  }
  const artifact = JSON.parse(await readFile(result.artifactPath, "utf8")) as { review: LiveReview };
  await p.stream.message([renderSummary(buildReviewData(artifact.review, parsed))]);
}

export async function runReviewFlow(): Promise<{ exitCode: 0 }> {
  let retry = false;
  do {
    retry = false;
    let apiKeyLocal: string | null = null;
    try {
      const saved = tryReadSavedConfig().config;
      const providerAnswer = await p.select({ message: "Provider", options: providerOptions, initialValue: saved?.provider ?? "openai-compatible" });
      if (p.isCancel(providerAnswer)) return { exitCode: 0 };
      const provider = providerAnswer;
      let apiUrl: string | null = null;
      if (provider !== "copilot") {
        const answer = await p.text({ message: "API URL", initialValue: saved?.apiUrl ?? "", validate: (value) => value?.startsWith("http") === true ? undefined : "must be http(s)" });
        if (p.isCancel(answer)) return { exitCode: 0 };
        apiUrl = answer;
      }
      const modelAnswer = await p.text({ message: "Model", initialValue: saved?.model ?? "auto" });
      if (p.isCancel(modelAnswer)) return { exitCode: 0 };
      const model = modelAnswer;
      if (process.env["UMACTUALLY_API_KEY"] === undefined) {
        const answer = await p.password({ message: "API key", mask: "*" });
        if (p.isCancel(answer)) return { exitCode: 0 };
        apiKeyLocal = answer;
      }
      const source = await p.select({ message: "Diff source", options: diffOptions });
      if (p.isCancel(source) || source === "cancel") return { exitCode: 0 };
      const parsed = emptyParsedArgs();
      Object.assign(parsed, {
        provider,
        apiUrl,
        model,
        apiKey: apiKeyLocal,
        diffPath: source === "diff" ? "./.git-diff" : null,
        files: source === "files" ? "." : null,
      });
      const result = await runStandalone({ parsed, cwd: process.cwd(), env: process.env });
      if (result.kind === "ok" || result.kind === "ok-no-diff") {
        await showSuccess(result, parsed);
        return { exitCode: 0 };
      }
      p.stream.error(result.message);
      const next = await p.select({ message: "Provider error", options: [{ value: "retry", label: "Retry" }, { value: "menu", label: "Back to menu" }] as const });
      if (p.isCancel(next) || next === "menu") return { exitCode: 0 };
      retry = next === "retry";
    } finally {
      apiKeyLocal = null;
    }
  } while (retry);
  return { exitCode: 0 };
}
