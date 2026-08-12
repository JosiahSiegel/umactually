import { statSync } from "node:fs";
import { join as pathJoin } from "node:path";

import { DEFAULT_PROMPT_BYTE_CAP } from "../config/defaults.js";
import {
  DEFAULT_PROMPT_FILE_PATHS,
  readHumanConventionFiles,
  readPromptFiles,
  resolveDefaultPromptFiles,
  resolveGlobs,
  splitPromptFileList,
} from "../config/prompt-files.js";
import { listDiffPaths } from "../diff/filter-build-artifacts.js";
import { resolveField } from "../config/field-resolution.js";
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
  readonly instructionFilesByBaseBranch?: Map<string, string>;
  readonly sonarContext?: string;
  /**
   * Optional Task 5 typed context-provenance result. When supplied,
   * the user message embeds the rendered (typed) context block AND the
   * content-free manifest; when omitted, the prompt renders exactly as
   * it did before this task. Process-scoped memory via
   * `getLastContextProvenanceForTests()` lets the artifact writer
   * observe the last value without growing the live API shape.
   */
  readonly contextProvenance?: import("./context-provenance.js").ContextProvenanceResult;
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
  const defaultPaths = input.instructionFilesByBaseBranch !== undefined
    && input.instructionFilesByBaseBranch.size > 0
    ? [...input.instructionFilesByBaseBranch.keys()]
    : resolveDefaultPromptFilesOnce(input.cwd);
  const additionalPrompt = await readAdditionalPrompt(input, defaultPaths);
  const userParts: string[] = [
    `Platform: ${input.platform}`,
    additionalPrompt.length > 0 ? `Additional instructions:\n${additionalPrompt}` : "Additional instructions: none",
  ];
  // Task 5 — when the orchestrator supplies typed context provenance,
  // remember it for the artifact writer (test-only hook), and embed
  // the rendered (typed) block + content-free manifest in the user
  // message ABOVE the diff so the model sees the context overlay
  // before it grounds citations. A render failure MUST NOT abort the
  // review; we surface a fallback line and continue.
  if (input.contextProvenance !== undefined) {
    __setLastContextProvenanceForTests(input.contextProvenance);
    try {
      const { renderContextBlock } = await import("./context-provenance.js");
      const renderedBlock = renderContextBlock(input.contextProvenance);
      const manifestBlock = renderContextBlock(input.contextProvenance, { asManifest: true });
      userParts.push(...[renderedBlock.text, manifestBlock.text]);
    } catch {
      userParts.push("Repository context: (unavailable — render failed; review continues without)");
    }
  }
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
  // Human convention files (README, CONTRIBUTING, LICENSE, …) layer:
  // loaded AFTER pickSystemPrompt so they precede every other system
  // content the model sees. The labelled separator + header makes the
  // boundary explicit so the model treats the human docs as a distinct
  // "ground-truth repo contract" layer (vs. the AI instruction files
  // layered behind it). Read is silent on per-file failures by design
  // (see `readHumanConventionFiles` doc), so a missing README never
  // aborts the review — the system prompt simply degrades to the
  // pickSystemPrompt-only content.
  //
  // The opt-out (`--no-instruction-files`) suppresses the AI-files
  // lookup inside `pickSystemPrompt`; this gate mirrors it for the
  // human-files load so the entire default-lookup surface (AI + human)
  // is skipped in one shot. Inline + --prompt-files + --prompt-file
  // overrides inside `pickSystemPrompt` still take precedence (those
  // branches early-return BEFORE this code runs).
  const baseSystem = await pickSystemPrompt(input, defaultPaths);
  const humanConventionFiles = isInstructionFilesExplicitlyFalse(input.parsed)
    ? ""
    : await readHumanConventionFiles({ cwd: input.cwd });
  const system =
    humanConventionFiles.length > 0
      ? `\n---\nHuman convention files (README, CONTRIBUTING, …):\n${humanConventionFiles}\n${baseSystem}`
      : baseSystem;
  return {
    system,
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
 * ## Cache lifetime contract
 *
 * The cache is **process-scoped and lives for the lifetime of the
 * Node process**. It is intentionally NOT invalidated by anything
 * other than `__resetDefaultPromptFilesCacheForTests` (which is a
 * test-only hook). This is acceptable for the action's documented
 * deployment model — each `umactually` invocation
 * (GitHub Actions, Azure DevOps, CLI) runs as a FRESH Node
 * process, so the cache effectively lives for one review run.
 *
 * What this means for callers:
 *
 * - **Standard usage (one process per review run):** The cache is
 *   populated on the first `buildProviderPrompts` call (with up to
 *   five sync `fs.stat` calls for `DEFAULT_PROMPT_FILE_PATHS`); every
 *   subsequent call within the same run reuses the cached path list.
 *   Per-chunk reads re-stat the disk (cheap; cache is path-list, not
 *   file-content).
 *
 * - **Long-lived processes (rare):** If you reuse the bundled CLI
 *   inside a daemon or composite step that runs the action multiple
 *   times against the same cwd, the cache entry will persist across
 *   runs — a `CLAUDE.md` added AFTER the first run will not be
 *   auto-loaded by the second run. This is acceptable because the
 *   documented deployment model is one process per review; the
 *   alternative (cache-busting) would either add a new `await`
 *   boundary (race) or require a per-run `reset()` call that the
 *   caller is responsible for invoking. Documented here so the
 *   contract is explicit; if a long-lived-process use case emerges,
 *   revisit this design.
 *
 * - **Tests:** Use `__resetDefaultPromptFilesCacheForTests()` to
 *   clear the cache between scenarios that mutate the workspace.
 */
const DEFAULT_PROMPT_FILES_CACHE: Map<string, readonly string[]> = new Map();
function resolveDefaultPromptFilesOnce(cwd: string): readonly string[] {
  const cached = DEFAULT_PROMPT_FILES_CACHE.get(cwd);
  if (cached !== undefined) return cached;
  // Expand DEFAULT_PROMPT_FILE_PATHS through `resolveGlobs` so glob
  // patterns (e.g. `.cursor/rules/*.md`) yield their matches alongside
  // the flat-path entries. `resolveGlobs` enforces the same realpath
  // boundary as `readPromptFiles` (drops anything that escapes cwd)
  // and only emits cwd-relative paths, so the per-candidate defensive
  // check that lived here before is now redundant.
  const expanded = resolveGlobs(DEFAULT_PROMPT_FILE_PATHS, cwd);
  const out: string[] = [];
  for (const candidate of expanded) {
    try {
      const s = statSync(pathJoin(cwd, candidate));
      if (!s.isFile()) continue;
      // Auto-discovery skips over-cap files silently: throwing here
      // would abort the review for any repo whose own auto-discovered
      // files (e.g. CHANGELOG.md) exceed the per-file cap. The
      // explicit --prompt-files override still throws via
      // readPromptFiles — the loud failure is reserved for the
      // operator-controlled surface, not the auto-discovery surface.
      if (s.size > DEFAULT_PROMPT_BYTE_CAP) continue;
      out.push(candidate);
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
 *
 * Production callers should NOT need this — see the cache lifetime
 * contract on `DEFAULT_PROMPT_FILES_CACHE`.
 */
export function __resetDefaultPromptFilesCacheForTests(): void {
  DEFAULT_PROMPT_FILES_CACHE.clear();
}

/**
 * Process-scoped memory for the last `contextProvenance` value passed
 * to `buildProviderPrompts`. The artifact-writing path (Task 12) can
 * observe this without growing the public `buildProviderPrompts`
 * return shape or threading the value through every caller.
 *
 * Test-only entry points live here; production code should pass the
 * result via `input.contextProvenance` and read it via the public
 * API surface (no direct reads from production code).
 */
const LAST_CONTEXT_PROVENANCE: {
  readonly value: import("./context-provenance.js").ContextProvenanceResult | null;
} = { value: null };

export function __setLastContextProvenanceForTests(
  next: import("./context-provenance.js").ContextProvenanceResult,
): void {
  (LAST_CONTEXT_PROVENANCE as { value: typeof next }).value = next;
}

export function getLastContextProvenanceForTests():
  | import("./context-provenance.js").ContextProvenanceResult
  | null {
  return LAST_CONTEXT_PROVENANCE.value;
}

export function __resetLastContextProvenanceForTests(): void {
  (LAST_CONTEXT_PROVENANCE as { value: null }).value = null;
}

/**
 * Reset hook called by the CLI entry points (`runCli`, `runDryRun`,
 * `runLive`) at the start of each invocation. Under the documented
 * deployment model — one Node process per review run — this is
 * effectively a no-op (the cache is fresh on the first build call).
 *
 * Why it exists:
 * 1. **Tests that exercise the chunked orchestrator's per-call
 *    buildProviderPrompts path need to invalidate the cache between
 *    independent runLive invocations in the same process.** The
 *    test-only hook above exists for that — but production callers
 *    never need it.
 * 2. **A long-lived-process deployment (out of scope; not the
 *    action's model) would call this between reviews to force a
 *    fresh stat of the cwd's default-lookup files.** Documented
 *    but not used by the bundled CLI today.
 *
 * The function name intentionally preserves the "ForTests" pattern in
 * the dedicated test hook above; this entry-point reset is a
 * separate surface and is the one production callers could call if
 * they ever needed to.
 */
export function resetDefaultPromptFilesCache(): void {
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
  readonly instructionFilesByBaseBranch?: Map<string, string>;
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
  const promptFilesRaw = resolveField(input.parsed.promptFiles, undefined, "");
  const promptFilesList = splitPromptFileList(promptFilesRaw);
  if (promptFilesList.length > 0) {
    return readPromptFiles(promptFilesList, DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
  }
  const filePath = resolveField(input.parsed.promptFile, undefined, "");
  if (filePath.length > 0) {
    return readPromptFiles([filePath], DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
  }
  // Opt-out: `--no-instruction-files` (or UMACTUALLY_INSTRUCTION_FILES=false)
  // suppresses the AI-files default-lookup entirely and falls through to the
  // built-in default. Only the literal `false` value is treated as the
  // opt-out (a missing field, `null`, `undefined`, or `true` is opt-in,
  // matching the schema default).
  if (isInstructionFilesExplicitlyFalse(input.parsed)) {
    return buildDefaultSystemPrompt();
  }
  if (defaultPaths.length > 0) {
    return readResolvedDefaultPromptFiles(input, defaultPaths);
  }
  return buildDefaultSystemPrompt();
}

/**
 * Returns true only when the operator has explicitly opted out of the
 * default instruction-file lookup via `--no-instruction-files` (or the
 * `UMACTUALLY_INSTRUCTION_FILES=false` env var). The flag is declared
 * as a boolean on `ParsedCliArgs`; the literal `false` is the opt-out
 * signal, anything else (`true`, missing) means "use the defaults".
 */
function isInstructionFilesExplicitlyFalse(parsed: ParsedCliArgs): boolean {
  return parsed.instructionFiles === false;
}

/**
 * Join the base-branch instruction-file map into a single string and
 * truncate to the shared byte cap. Used by both `readResolvedDefaultPromptFiles`
 * (system prompt) and `readAdditionalPrompt` so the cap-truncation
 * semantics stay identical between the two paths.
 *
 * Rationale for truncation: the base-branch fetch joins multiple files
 * with no per-file cap (unlike the cwd path's `readPromptFiles`
 * aggregate guard). Truncating here keeps the model contract uniform
 * across both surfaces. `slice` respects UTF-16 boundaries, which is
 * good enough for our UTF-8 content because every UTF-8 codepoint
 * occupies 1-3 UTF-16 code units and a partial codepoint at the
 * boundary just renders as a replacement char — same outcome as the
 * cwd path's per-file cap, which also slices at byte boundaries.
 */
function formatBaseBranchContent(map: Map<string, string>): string {
  const joined = [...map.values()].join("\n\n");
  if (joined.length <= DEFAULT_PROMPT_BYTE_CAP) return joined;
  const truncated = joined.slice(0, DEFAULT_PROMPT_BYTE_CAP);
  return `${truncated}\n\n[... truncated at ${DEFAULT_PROMPT_BYTE_CAP}-byte cap ...]`;
}

function readResolvedDefaultPromptFiles(
  input: { readonly cwd: string; readonly instructionFilesByBaseBranch?: Map<string, string> },
  defaultPaths: readonly string[],
): Promise<string> {
  const baseBranch = input.instructionFilesByBaseBranch;
  if (baseBranch !== undefined && baseBranch.size > 0) {
    return Promise.resolve(formatBaseBranchContent(baseBranch));
  }
  return readPromptFiles(defaultPaths, DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
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
  readonly instructionFilesByBaseBranch?: Map<string, string>;
}, defaultPaths: readonly string[]): Promise<string> {
  const inline = input.parsed.additionalPrompt;
  if (typeof inline === "string" && inline.length > 0) {
    return inline;
  }
  // Precedence mirrors `pickSystemPrompt`: array overrides defaults,
  // single-file is the legacy path, then default-lookup, then empty.
  const filesRaw = resolveField(input.parsed.additionalPromptFiles, undefined, "");
  const filesList = splitPromptFileList(filesRaw);
  if (filesList.length > 0) {
    return readPromptFiles(filesList, DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
  }
  const filePath = resolveField(input.parsed.additionalPromptFile, undefined, "");
  if (filePath.length > 0) {
    return readPromptFiles([filePath], DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
  }
  // Opt-out mirrors `pickSystemPrompt`: with `--no-instruction-files` the
  // additional prompt's default-lookup is suppressed and the function
  // returns `""` so the user message renders "Additional instructions: none".
  // Inline + array + single-file overrides above still take precedence.
  if (isInstructionFilesExplicitlyFalse(input.parsed)) return "";
  // Base-branch mirror: when the base-branch Map is supplied the keys
  // are base-branch paths and may not exist in cwd; reuse the joined
  // + cap-truncated content rather than reading those paths from cwd
  // (which would trip `byte-cap-exceeded` / `not-found`).
  const baseBranch = input.instructionFilesByBaseBranch;
  if (baseBranch !== undefined && baseBranch.size > 0) {
    return formatBaseBranchContent(baseBranch);
  }
  if (defaultPaths.length === 0) return "";
  return readPromptFiles(defaultPaths, DEFAULT_PROMPT_BYTE_CAP, { cwd: input.cwd });
}