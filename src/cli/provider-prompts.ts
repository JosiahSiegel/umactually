import { statSync } from "node:fs";

import { DEFAULT_PROMPT_BYTE_CAP } from "../config/defaults.js";
import { resolveField } from "../config/field-resolution.js";
import {
  DEFAULT_PROMPT_FILE_PATHS,
  readPromptFiles,
  resolveDefaultPromptFiles,
  splitPromptFileList,
} from "../config/prompt-files.js";
import { listDiffPaths } from "../diff/filter-build-artifacts.js";
import { ENV_KEYS } from "../util/env-keys.js";
import {
  collectVerifiedFacts,
  renderVerifiedFactsBlock,
} from "../review/verified-facts.js";
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

// Re-exports of the default-lookup and splitting primitives so callers
// (including the CLI help and tests) can import them from the public
// `cli/provider-prompts` surface without reaching into `config/`.
export { DEFAULT_PROMPT_FILE_PATHS, splitPromptFileList, resolveDefaultPromptFiles };

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
 * the layer that enforces truth.
 *
 * Compatibility note: the LIVE parser (in `provider-parse.ts`) is
 * permissive about `verdict` and `severity` strings (it accepts any
 * non-empty string and the `normalizeProviderSeverity` fallback
 * maps unrecognized values). The wire schema is therefore
 * permissive on those fields too — `string` with a `minLength: 1`
 * constraint rather than a strict enum. A strict enum here would
 * cause valid responses to be rejected by providers that enforce
 * the schema (and per the model-comparison survey, the `severity`
 * and `verdict` strings are exactly where providers diverge).
 *
 * The wire schema intentionally has NO `description` fields. Strict
 * JSON-schema providers (e.g. OpenAI strict-mode) treat `description`
 * as machine-checked, and a description with prose like "A path
 * from the Files-in-diff list below" can be interpreted as a
 * constraint that breaks valid responses. The in-context system
 * prompt carries the full description text; the wire schema is
 * pure shape.
 */
export const REVIEW_PAYLOAD_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "verdict", "comments", "suppressed_comments"],
  properties: {
    summary: { type: "string" },
    verdict: { type: "string", minLength: 1 },
    comments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "line", "body", "severity", "category"],
        properties: {
          path: { type: "string" },
          line: { type: "integer", minimum: 1 },
          body: { type: "string" },
          severity: { type: "string", minLength: 1 },
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
          severity: { type: "string", minLength: 1 },
          category: { type: "string" },
        },
      },
    },
  },
} as const;

export async function buildProviderPrompts(input: ProviderPromptsInput): Promise<ProviderPrompts> {
  // Resolve the default-lookup list ONCE per cwd so the chunked
  // orchestrator (which calls buildProviderPrompts PER chunk) does
  // not race on multiple parallel fs.stat calls or break the
  // single-threaded sink assumption that `setActiveSeveritySink`
  // relies on. Implementation: synchronous stat() so we do NOT add a
  // new `await` boundary at the top of buildProviderPrompts.
  const defaultPaths = resolveDefaultPromptFilesOnce(input.cwd);
  const additionalPrompt = await readAdditionalPrompt(input, defaultPaths);
  const userParts = [
    `Platform: ${input.platform}`,
    additionalPrompt.length > 0 ? `Additional instructions:\n${additionalPrompt}` : "Additional instructions: none",
  ];
  if (input.sonarContext !== undefined && input.sonarContext.length > 0) {
    userParts.push(input.sonarContext);
  }
  // Verified facts layer — pre-computed, authoritative repo state the
  // model sees BEFORE the diff. Without this layer the model can
  // hallucinate verifiable repo facts (e.g. claim dist/ is missing
  // from package.json#files when it is present in the diff). With
  // it, the model has an explicit contradiction anchor.
  const verifiedFacts = collectVerifiedFacts(input.diffText);
  const verifiedBlock = renderVerifiedFactsBlock(verifiedFacts);
  if (verifiedBlock.length > 0) {
    userParts.push(verifiedBlock);
  }
  // Layer 2-A: enumerate the diff's path list in the user message
  // so the model can verify any cited path by grep. We list the
  // paths even on the strict-schema path (which already constrains
  // `path` to a string type) because the model emits a literal
  // string the post-filter then validates against this list.
  userParts.push(buildFilesInDiffBlock(input.diffText));
  userParts.push("Diff:", input.diffText);
  return {
    system: await pickSystemPrompt(input, defaultPaths),
    user: userParts.join("\n\n"),
  };
}

/**
 * Per-cwd memoized wrapper around `resolveDefaultPromptFiles`. The
 * chunked live path invokes `buildProviderPrompts` per chunk, so a
 * per-call resolve would multiply the fs.stat calls and (more
 * importantly) introduce an extra `await` boundary that breaks the
 * single-threaded event-loop assumption `setActiveSeveritySink`
 * relies on (see `src/provider/provider-parse.ts:86-88`).
 *
 * Implementation note: uses synchronous fs.stat to avoid any `await`
 * boundary in `buildProviderPrompts`. Each stat is sub-millisecond
 * and the result is cached per cwd, so the total cost is at most 5
 * sync stats on the FIRST `buildProviderPrompts` call per process.
 *
 * The cache is process-scoped. Tests that need to assert the empty
 * path should use the un-cached `resolveDefaultPromptFiles` exported
 * from `src/config/prompt-files.ts`.
 */
const DEFAULT_PROMPT_FILES_CACHE: Map<string, readonly string[]> = new Map();
function resolveDefaultPromptFilesOnce(cwd: string): readonly string[] {
  const cached = DEFAULT_PROMPT_FILES_CACHE.get(cwd);
  if (cached !== undefined) return cached;
  const out: string[] = [];
  for (const candidate of DEFAULT_PROMPT_FILE_PATHS) {
    try {
      const s = statSync(`${cwd.replace(/[\\/]+$/u, "")}/${candidate}`);
      if (s.isFile()) out.push(candidate);
    } catch {
      // ENOENT (or any other stat failure): silently skip.
    }
  }
  const frozen = Object.freeze(out);
  DEFAULT_PROMPT_FILES_CACHE.set(cwd, frozen);
  return frozen;
}

/**
 * Test-only hook to clear the per-cwd default-prompt cache. Used by
 * tests that mutate the workspace mid-run and need the next
 * `buildProviderPrompts` call to re-stat the disk.
 */
export function __resetDefaultPromptFilesCacheForTests(): void {
  DEFAULT_PROMPT_FILES_CACHE.clear();
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
}, defaultPaths: readonly string[]): Promise<string> {
  const inline = input.parsed.prompt;
  if (typeof inline === "string" && inline.length > 0) {
    return inline;
  }
  // Precedence for system prompt file resolution:
  //   1. `--prompt-files` (array) — when set, COMPLETELY OVERRIDES the
  //      default-lookup list. The single-file `--prompt-file` is
  //      ignored in this branch so the array semantics are honest.
  //   2. `--prompt-file` (single, legacy) — used as-is.
  //   3. Auto-discover from `DEFAULT_PROMPT_FILE_PATHS` (CLAUDE.md,
  //      AGENTS.md, .github/copilot-instructions.md, .cursorrules,
  //      GEMINI.md). Files that do not exist are skipped.
  //   4. Built-in `buildDefaultSystemPrompt()`.
  const promptFilesRaw = resolveField(
    input.parsed.promptFiles,
    input.env[ENV_KEYS.UMACTUALLY_PROMPT_FILES],
    "",
  );
  const promptFilesList = splitPromptFileList(promptFilesRaw);
  if (promptFilesList.length > 0) {
    return readPromptFiles(promptFilesList, DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
  }
  const filePath = resolveField(input.parsed.promptFile, input.env[ENV_KEYS.UMACTUALLY_PROMPT_FILE], "");
  if (filePath !== undefined && filePath.length > 0) {
    return readPromptFiles([filePath], DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
  }
  if (defaultPaths.length > 0) {
    return readPromptFiles(defaultPaths, DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
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
    "Output contract:",
    "- Your entire response is parsed as a single JSON object matching the schema below. No prose before or after the JSON. No markdown code fences around the JSON (the parser strips them, but emitting them wastes output tokens).",
    "- If you would normally think before answering, the thinking must happen INSIDE the JSON (e.g. as a `reasoning` field) — not as separate prose. The parser discards any text before the first `{` and after the last `}`, so thinking prose only burns your output budget and the answer gets truncated.",
    "- The JSON must contain every required field (`summary`, `verdict`, `comments`, `suppressed_comments`). Missing fields cause a parse failure and the operator sees a parse-fail card instead of your review.",
    "",
    "Workflow for every finding you emit:",
    "1. Identify a real concern introduced by the diff.",
    "2. Copy the EXACT diff lines that justify the concern (a verbatim quote, 1-3 lines).",
    "3. Emit a JSON object whose `path` matches a file from the Files-in-diff list in the user message and whose `line` matches a line number that appears in the diff for that file.",
    "If you cannot complete steps 2-3, OMIT the finding entirely. Do not invent a citation.",
    "",
    "Verified-facts grounding:",
    "- When the user message includes a 'Verified facts' block, those facts are authoritative for this PR. They were reconstructed from the diff by a deterministic parser. Do NOT emit a finding whose `body` contradicts any fact in the block — omit the finding entirely or rephrase it without the contradiction.",
    "- Common contradiction patterns to avoid: claiming X is missing from a whitelist/list when X is in the verified list, claiming Y was removed when Y is in the verified list, claiming an output/input was deleted when the verified facts show it still exists.",
    "- If you would have made such a claim and the verified facts contradict it, the verified facts are correct; your reading of the diff was wrong. Omit the finding.",
    "",
    "False-positive prevention (Layer 5 — calibration):",
    "- Do NOT emit generic best-practice advice without quoting the exact diff line that demonstrates the issue. Advice like 'you should use parameterized queries', 'consider adding an index', 'this could be vulnerable to X' is only a finding if the diff shows the absence AND you can quote the relevant code. The post-filter explicitly downgrades bodies that use these phrasings without a diff anchor.",
    "- Do NOT emit findings whose severity is medium or higher if the body uses hedging language ('could', 'might', 'potentially', 'in some cases', 'in theory'). Reserve medium+ for confirmed violations. The post-filter calibrates hedged-at-high-severity findings down to info.",
    "- Do NOT flag code as missing error handling, validation, sanitization, or authentication if the diff's context lines already show it present. Read the surrounding lines of the cited file before claiming absence — the construct may be in the unchanged context the diff preserves. The post-filter downgrades findings whose body names a construct that the hunk actually contains.",
    "- Do NOT flag a code pattern as a bug if the diff includes an inline comment documenting it as intentional ('// intentional:', '// by design', '// note:', '// hack:', '// workaround', '// rationale:', '// see <link>'). The model often misses the documenting comment when the pattern LOOKS problematic in isolation. The post-filter downgrades these findings so the operator can see them with softer severity.",
    "- When a finding would be speculative ('in some edge case', 'if X were to happen', 'could theoretically lead to'), drop the severity to 'info' or 'low' AT EMISSION TIME rather than emitting at medium/high and relying on the post-filter.",
    "",
    "Forbidden (a non-exhaustive list to make the boundary explicit; the positive constraint above takes precedence):",
    "- Do NOT cite any path that is not in the Files-in-diff list. Build artifacts, generated files, and lockfiles are stripped from the diff upstream and are never reviewable here.",
    "- Do NOT cite any line number that does not appear in the diff for the cited path. Off-by-one or hallucinated line numbers are rejected by the post-filter.",
    "- Do NOT infer missing context. If the diff does not show a function call, do not claim a function call exists.",
    "- Do NOT include secrets, tokens, or any literal that looks like a credential.",
    "- Do NOT emit prose before or after the JSON. The parser will reject your response as a parse-fail.",
    "- Do NOT emit reasoning that is longer than the answer itself. If you have analyzed for a while and the answer is still ahead, you are about to run out of output budget — emit the JSON now with whatever findings you have, even if you would have found more.",
    "",
    "Severity values: info, low, medium, high, critical, security, leak. Use 'security' for an active vulnerability, 'leak' for a confirmed secret, 'critical' for severe bugs. Style and hygiene issues go in 'low' or 'info'.",
    "",
    "Schema:",
    JSON.stringify(REVIEW_PAYLOAD_JSON_SCHEMA, null, 2),
    "",
    "If the diff is empty or has no actionable findings, return verdict=COMMENT with an empty comments array. Do not invent findings to fill the response.",
  ].join("\n");
}

async function readAdditionalPrompt(input: {
  readonly parsed: ParsedCliArgs;
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
}, defaultPaths: readonly string[]): Promise<string> {
  const inline = input.parsed.additionalPrompt;
  if (typeof inline === "string" && inline.length > 0) {
    return inline;
  }
  // Precedence mirrors `pickSystemPrompt`: array overrides defaults,
  // single-file is the legacy path, then default-lookup, then empty.
  const filesRaw = resolveField(
    input.parsed.additionalPromptFiles,
    input.env[ENV_KEYS.UMACTUALLY_ADDITIONAL_PROMPT_FILES],
    "",
  );
  const filesList = splitPromptFileList(filesRaw);
  if (filesList.length > 0) {
    return readPromptFiles(filesList, DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
  }
  const filePath = resolveField(input.parsed.additionalPromptFile, input.env[ENV_KEYS.UMACTUALLY_ADDITIONAL_PROMPT_FILE], "");
  if (filePath !== undefined && filePath.length > 0) {
    return readPromptFiles([filePath], DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
  }
  if (defaultPaths.length === 0) return "";
  return readPromptFiles(defaultPaths, DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
}