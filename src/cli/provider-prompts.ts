import { DEFAULT_PROMPT_BYTE_CAP } from "../config/defaults.js";
import { readPromptFiles } from "../config/prompt-files.js";
import { listDiffPaths } from "../diff/filter-build-artifacts.js";
import type { LivePlatform } from "./live-shared.js";
import type { ParsedCliArgs } from "./parse-args.js";

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

/**
 * The strict JSON schema the model must emit. We send this on the
 * wire as `response_format: { type: "json_schema", strict: true }`
 * for the OpenAI Responses/Chat APIs that support it (see
 * `src/provider/provider-parse.ts:buildResponsesBody`). The schema
 * is a duplicate of the prose in the system prompt — the prose is
 * the in-context guide, the wire schema is the API enforcement.
 *
 * The model can still emit the *wrong* path or line — strict schema
 * enforces shape, not truth. The post-filter in
 * `parseDiffPositions` + the `parse-warnings.json` artifact are
 * the layer that enforces truth. See the deep-research summary
 * in `.omo/plans/` (or the PR body) for why this is the right
 * combination per the production-tool survey.
 */
export const REVIEW_PAYLOAD_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "verdict", "comments", "suppressed_comments"],
  properties: {
    summary: { type: "string" },
    verdict: {
      type: "string",
      enum: ["COMMENT", "APPROVED", "NEEDS_FIX", "DISCUSS", "SHIP"],
    },
    comments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "line", "body", "severity", "category"],
        properties: {
          path: { type: "string", description: "A path from the Files-in-diff list below. Emit a literal string the model can verify by grep." },
          line: { type: "integer", minimum: 1, description: "A line number that appears in the diff for that path (either a + line or a context line)." },
          body: { type: "string", description: "Markdown body. Keep under 600 chars. No secrets. No code blocks outside the diff." },
          severity: {
            type: "string",
            enum: ["info", "low", "medium", "high", "critical", "security", "leak"],
          },
          category: { type: "string" },
        },
      },
    },
    suppressed_comments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "line", "body", "severity", "category"],
        properties: {
          path: { type: "string" },
          line: { type: "integer", minimum: 1 },
          body: { type: "string" },
          severity: { type: "string" },
          category: { type: "string" },
        },
      },
    },
  },
} as const;

export async function buildProviderPrompts(input: ProviderPromptsInput): Promise<ProviderPrompts> {
  const additionalPrompt = await readAdditionalPrompt(input);
  const userParts = [
    `Platform: ${input.platform}`,
    additionalPrompt.length > 0 ? `Additional instructions:\n${additionalPrompt}` : "Additional instructions: none",
  ];
  if (input.sonarContext !== undefined && input.sonarContext.length > 0) {
    userParts.push(input.sonarContext);
  }
  // Layer 2-A: enumerate the diff's path list in the user message
  // so the model can verify any cited path by grep. We list the
  // paths even on the strict-schema path (which already constrains
  // `path` to a string type) because the model emits a literal
  // string the post-filter then validates against this list.
  userParts.push(buildFilesInDiffBlock(input.diffText));
  userParts.push("Diff:", input.diffText);
  return {
    system: await pickSystemPrompt(input),
    user: userParts.join("\n\n"),
  };
}

/**
 * Format the diff's file list as an explicit, copy-pastable block the
 * model can match against. Pinned by the citation-grounding plan
 * (Layer 2-A): the prompt now lists every path the model is
 * permitted to cite, which makes hallucinated paths obvious to
 * both the model and the post-filter.
 */
function buildFilesInDiffBlock(diffText: string): string {
  const paths = listDiffPaths(diffText);
  if (paths.length === 0) {
    return "Files in diff: (none — empty diff)";
  }
  const lines = paths.map((p, i) => `  ${i + 1}. ${p}`);
  return [
    "Files in diff (the ONLY paths you may cite):",
    ...lines,
    "Do NOT cite any path that is not in this list. If a finding requires a file not in the diff, omit the finding entirely rather than fabricating a path.",
  ].join("\n");
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
  return buildDefaultSystemPrompt();
}

/**
 * The built-in default system prompt. Rewritten in PR #26 (the
 * "LLM citation grounding" fix) to:
 *
 * 1. Quote the source lines BEFORE emitting a finding (Anthropic
 *    pattern: "if it can't find a quote, state that no relevant
 *    quote was found"). This forces the model to anchor each
 *    finding to a real diff line and makes fabrication obvious.
 * 2. Foreground the diff path enum (the user message carries the
 *    same list — see `buildFilesInDiffBlock`) so the model knows
 *    the EXACT set of valid paths.
 * 3. Include the strict JSON schema so a free-form model that
 *    ignores the wire `response_format` still gets a clear
 *    shape guide. (Prose schema + wire schema is the standard
 *    pattern; see the Ellipsis "27 months of LLM agents" post.)
 * 4. Pre-empt the "DO NOT cite dist/" failure mode (PR #56) by
 *    telling the model that build artifacts are excluded upstream
 *    AND the post-filter will reject any off-path citation. The
 *    "Negative Constraints Backfire" finding from the
 *    hallucination-survey (Rana, 2026) shows that bare "DO NOT
 *    cite X" instructions can paradoxically prime X — so we
 *    include the prohibition paired with the positive constraint
 *    (cite only what's in the list) and the consequence (filtered
 *    out, surfaces in the warning artifact).
 */
function buildDefaultSystemPrompt(): string {
  return [
    "You are UmActually, a precise pull request reviewer.",
    "",
    "Workflow for every finding you emit:",
    "1. Identify a real concern introduced by the diff.",
    "2. Copy the EXACT diff lines that justify the concern (a verbatim quote, 1-3 lines).",
    "3. Emit a JSON object whose `path` matches a file from the Files-in-diff list in the user message and whose `line` matches a line number that appears in the diff for that file.",
    "If you cannot complete steps 2-3, OMIT the finding entirely. Do not invent a citation.",
    "",
    "Forbidden (a non-exhaustive list to make the boundary explicit; the positive constraint above takes precedence):",
    "- Do NOT cite any path that is not in the Files-in-diff list. Build artifacts, generated files, and lockfiles are stripped from the diff upstream and are never reviewable here.",
    "- Do NOT cite any line number that does not appear in the diff for the cited path. Off-by-one or hallucinated line numbers are rejected by the post-filter.",
    "- Do NOT infer missing context. If the diff does not show a function call, do not claim a function call exists.",
    "- Do NOT include secrets, tokens, or any literal that looks like a credential.",
    "",
    "Severity values: info, low, medium, high, critical, security, leak. Use 'security' for an active vulnerability, 'leak' for a confirmed secret, 'critical' for severe bugs. Style and hygiene issues go in 'low' or 'info'.",
    "",
    "Return strict JSON only — no prose, no markdown fences. Schema:",
    JSON.stringify(REVIEW_PAYLOAD_JSON_SCHEMA, null, 2),
    "",
    "If the diff is empty or has no actionable findings, return verdict=COMMENT with an empty comments array. Do not invent findings to fill the response.",
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