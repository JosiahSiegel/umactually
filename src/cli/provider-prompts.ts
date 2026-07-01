import { readPromptFiles } from "../config/prompt-files.js";
import type { LivePlatform } from "./live-shared.js";
import type { ParsedCliArgs } from "./parse-args.js";

const DEFAULT_PROMPT_BYTE_CAP = 64 * 1024;

type ProviderPromptsInput = {
  readonly parsed: ParsedCliArgs;
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly platform: LivePlatform;
  readonly diffText: string;
  readonly sonarContext?: string;
};

export type ProviderPrompts = {
  readonly system: string;
  readonly user: string;
};

export async function buildProviderPrompts(input: ProviderPromptsInput): Promise<ProviderPrompts> {
  const additionalPrompt = await readAdditionalPrompt(input);
  const userParts = [
    `Platform: ${input.platform}`,
    additionalPrompt.length > 0 ? `Additional instructions:\n${additionalPrompt}` : "Additional instructions: none",
  ];
  if (input.sonarContext !== undefined && input.sonarContext.length > 0) {
    userParts.push(input.sonarContext);
  }
  userParts.push("Diff:", input.diffText);
  return {
    system: await pickSystemPrompt(input),
    user: userParts.join("\n\n"),
  };
}

async function pickSystemPrompt(input: {
  readonly parsed: ParsedCliArgs;
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
}): Promise<string> {
  const inline = input.parsed.prompt;
  if (typeof inline === "string" && inline.length > 0) {
    return inline;
  }
  const filePath = input.parsed.promptFile ?? input.env["UMACTUALLY_PROMPT_FILE"];
  if (filePath !== undefined && filePath.length > 0) {
    return readPromptFiles([filePath], DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
  }
  return [
    "You are UmActually, a precise pull request reviewer.",
    "Return strict JSON only with this schema:",
    "{\"summary\":string,\"verdict\":\"COMMENT\"|\"APPROVED\"|\"NEEDS_FIX\",\"comments\":[{\"path\":string,\"line\":number,\"body\":string,\"severity\":string,\"category\":string}],\"suppressed_comments\":[{\"path\":string,\"line\":number,\"body\":string,\"severity\":string,\"category\":string}]}",
    "Anchor comments only to changed or context lines present in the diff. Do not include secrets.",
  ].join("\n");
}

async function readAdditionalPrompt(input: {
  readonly parsed: ParsedCliArgs;
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
}): Promise<string> {
  const inline = input.parsed.additionalPrompt;
  if (typeof inline === "string" && inline.length > 0) {
    return inline;
  }
  const filePath = input.parsed.additionalPromptFile ?? input.env["UMACTUALLY_ADDITIONAL_PROMPT_FILE"];
  if (filePath === undefined || filePath.length === 0) {
    return "";
  }
  return readPromptFiles([filePath], DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
}
