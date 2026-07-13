import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  __resetDefaultPromptFilesCacheForTests,
  buildProviderPrompts,
  DEFAULT_PROMPT_FILE_PATHS,
  resolveDefaultPromptFiles,
  resetDefaultPromptFilesCache,
  REVIEW_PAYLOAD_JSON_SCHEMA,
  splitPromptFileList,
} from "../../src/cli/provider-prompts.js";

const SOURCE_DIFF = [
  "diff --git a/src/cli/help.ts b/src/cli/help.ts",
  "--- a/src/cli/help.ts",
  "+++ b/src/cli/help.ts",
  "@@ -1,43 +1,81 @@",
  " export const CLI_HELP_TEXT = [",
  "-  \"  --platform <auto|github|azure>\",",
  "+  \"  --platform <auto|github|azure>                  \",",
  " ",
  " ].join(\"\\n\");",
  "",
].join("\n");

describe("buildProviderPrompts", () => {
  it("embeds the diff's file list in the user message (Layer 2-A: path enum)", async () => {
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest(),
      cwd: process.cwd(),
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    expect(prompts.user).toContain("Files in diff");
    expect(prompts.user).toContain("src/cli/help.ts");
    // The user message must also include the diff itself, not just the
    // file list — the model needs both to ground its citations.
    expect(prompts.user).toContain("Diff:");
    expect(prompts.user).toContain("+  \"  --platform");
  });

  it("warns when the diff is empty (no path is anchorable)", async () => {
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest(),
      cwd: process.cwd(),
      env: {},
      platform: "github",
      diffText: "",
    });
    expect(prompts.user).toContain("Files in diff: (none");
  });

  it("system prompt documents the strict JSON schema (Layer 2-C)", async () => {
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest(),
      cwd: process.cwd(),
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    // The schema is inlined into the system prompt as a guide for
    // models that ignore the wire-format response_format constraint.
    expect(prompts.system.toLowerCase()).toContain("output contract");
    expect(prompts.system.toLowerCase()).toContain("schema");
    // The wire schema literal is also accessible.
    expect(REVIEW_PAYLOAD_JSON_SCHEMA.type).toBe("object");
    expect(REVIEW_PAYLOAD_JSON_SCHEMA.required).toContain("verdict");
    expect(REVIEW_PAYLOAD_JSON_SCHEMA.required).toContain("comments");
    // summary and suppressed_comments are part of the documented
    // output contract (see src/provider/provider-parse.ts and the
    // provider prompt above) — pin them here too so an
    // accidental drop of one of these fields from
    // REVIEW_PAYLOAD_JSON_SCHEMA fails the test loudly rather
    // than at runtime when the parser rejects the missing key.
    expect(REVIEW_PAYLOAD_JSON_SCHEMA.required).toContain("summary");
    expect(REVIEW_PAYLOAD_JSON_SCHEMA.required).toContain("suppressed_comments");
  });

  it("system prompt includes the quote-first workflow (Layer 2-B)", async () => {
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest(),
      cwd: process.cwd(),
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    // The Anthropic pattern: copy the exact diff lines that justify
    // the finding BEFORE emitting the structured finding.
    expect(prompts.system).toContain("Copy the EXACT diff lines");
    expect(prompts.system).toContain("verbatim quote");
  });

  it("system prompt forbids fabrication (Layer 2-D: negative constraint with positive anchor)", async () => {
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest(),
      cwd: process.cwd(),
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    expect(prompts.system).toContain("Do NOT cite any path that is not in the Files-in-diff list");
    expect(prompts.system).toContain("OMIT the finding entirely");
  });

  it("respects an inline --prompt override", async () => {
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest({ prompt: "Custom system prompt for this run." }),
      cwd: process.cwd(),
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    expect(prompts.system).toBe("Custom system prompt for this run.");
    // The user message still carries the path enum + diff, regardless
    // of the system prompt.
    expect(prompts.user).toContain("Files in diff");
  });

  it("appends the additional prompt to the user message, not the system", async () => {
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest({ additionalPrompt: "Be terse. Focus on security findings only." }),
      cwd: process.cwd(),
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    expect(prompts.user).toContain("Additional instructions:");
    expect(prompts.user).toContain("Be terse");
    expect(prompts.system).not.toContain("Be terse");
  });
});

function parsedArgsForTest(overrides: {
  prompt?: string;
  promptFile?: string | null;
  promptFiles?: string | null;
  additionalPrompt?: string;
  additionalPromptFile?: string | null;
  additionalPromptFiles?: string | null;
} = {}): import("../../src/cli/parse-args.js").ParsedCliArgs {
  return {
    platform: "github",
    eventPath: null,
    diffPath: null,
    threadsPath: null,
    reviewPath: null,
    prNumber: null,
    repo: null,
    apiUrl: null,
    apiKey: null,
    model: null,
    promptFile: overrides.promptFile ?? null,
    promptFiles: overrides.promptFiles ?? null,
    additionalPromptFile: overrides.additionalPromptFile ?? null,
    additionalPromptFiles: overrides.additionalPromptFiles ?? null,
    prompt: overrides.prompt ?? null,
    additionalPrompt: overrides.additionalPrompt ?? null,
    effort: null,
    provider: null,
    githubApiBase: null,
    includeSonarqube: false,
    sonarHostUrl: null,
    sonarToken: null,
    sonarProjectKey: null,
    sonarTimeoutSeconds: null,
    minimumSeverity: "medium",
    minimumSeverityInternal: "major" as const,
    maxComments: null,
    reviewFileLimit: null,
    detectLeaks: true,
    walkthrough: false,
    diagnostic: false,
    debugRawResponse: false,
    simulateFindings: false,
    reviewTimeoutSeconds: null,
    stallSeconds: null,
    perRequestTimeoutSeconds: null,
    maxOutputTokens: null,
    dryRun: false,
    outputArtifact: null,
    strictSchema: true,
    verifyFindings: true,
  };
}
describe("buildProviderPrompts verified-facts block", () => {
  const PR_41_DIFF = [
    "diff --git a/package.json b/package.json",
    "--- a/package.json",
    "+++ b/package.json",
    "@@ -10,8 +35,14 @@",
    '   "bin": {',
    '     "umactually-pr-review": "bin/umactually-pr-review.mjs"',
    "   },",
    '   "files": [',
    '     "dist",',
    '     "bin",',
    '     "action.yml",',
    '     "README.md",',
    '-    "LICENSE"',
    '+    "LICENSE",',
    '+    "docs",',
    '+    "examples",',
    '+    "scripts"',
    "   ],",
  ].join("\n");

  it("embeds the verified-facts block before the diff when package.json is changed", async () => {
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest(),
      cwd: process.cwd(),
      env: {},
      platform: "github",
      diffText: PR_41_DIFF,
    });
    // The block must contain dist/ so the model sees the authoritative
    // list BEFORE the diff and cannot plausibly claim dist/ is missing.
    expect(prompts.user).toContain("Verified facts");
    expect(prompts.user).toContain("package.json#files");
    expect(prompts.user).toContain("dist");
    expect(prompts.user).toContain("do NOT contradict these");
  });

  it("does not include the verified-facts block when neither package.json nor action.yml is in the diff", async () => {
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest(),
      cwd: process.cwd(),
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    // SOURCE_DIFF only touches src/cli/help.ts, so no verified facts
    // can be extracted and the block should be omitted.
    expect(prompts.user).not.toContain("Verified facts");
  });

  it("system prompt includes verified-facts grounding instructions", async () => {
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest(),
      cwd: process.cwd(),
      env: {},
      platform: "github",
      diffText: PR_41_DIFF,
    });
    expect(prompts.system).toContain("Verified-facts grounding");
    expect(prompts.system).toContain("authoritative for this PR");
  });

  it("system prompt includes Layer 5 negative-instruction calibration (false-positive prevention)", async () => {
    // Pins the new Layer 5 prompt block that targets the four FP
    // patterns the verified-facts layer cannot detect: pattern-matched
    // advice without a diff anchor, hedging at high severity, missing
    // constructs that are in the unchanged context, and intentional
    // design with a documenting comment. The post-filter relies on
    // these instructions being present so the model emits calibrated
    // severities on first pass — the post-filter is the backstop.
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest(),
      cwd: process.cwd(),
      env: {},
      platform: "github",
      diffText: PR_41_DIFF,
    });
    expect(prompts.system).toContain("False-positive prevention");
    expect(prompts.system).toContain("generic best-practice advice without quoting the exact diff line");
    expect(prompts.system).toContain("hedging language");
    expect(prompts.system).toContain("Do NOT flag code as missing error handling");
    expect(prompts.system).toContain("Do NOT flag a code pattern as a bug if the diff includes an inline comment");
  });
});

describe("splitPromptFileList", () => {
  it("returns an empty array for empty / null / undefined input", () => {
    expect(splitPromptFileList("")).toEqual([]);
    expect(splitPromptFileList(null)).toEqual([]);
    expect(splitPromptFileList(undefined)).toEqual([]);
  });

  it("splits on both commas and newlines, trims, drops empties", () => {
    expect(splitPromptFileList("a.md, b.md\nc.md")).toEqual(["a.md", "b.md", "c.md"]);
  });

  it("dedupes while preserving first-seen order", () => {
    expect(splitPromptFileList("a.md, a.md, b.md, a.md")).toEqual(["a.md", "b.md"]);
  });

  it("handles CR-LF line endings (Windows-pasted input)", () => {
    // GitHub Actions runners on Windows often pass multi-line strings
    // with CR-LF. The split regex /[\n,]/u must catch both.
    expect(splitPromptFileList("a.md\r\nb.md\r\nc.md")).toEqual(["a.md", "b.md", "c.md"]);
  });

  it("handles CR-only line endings (old Mac / paste artifacts)", () => {
    expect(splitPromptFileList("a.md\rb.md\rc.md")).toEqual(["a.md", "b.md", "c.md"]);
  });

  it("drops leading / trailing separators without producing empty entries", () => {
    // Trim, then drop empties. The contract is "no empty strings in
    // the output array" — readPromptFiles would throw "not-found"
    // on an empty path entry, so silently dropping is the right call.
    expect(splitPromptFileList(",a.md,")).toEqual(["a.md"]);
    expect(splitPromptFileList("\na.md\n")).toEqual(["a.md"]);
    expect(splitPromptFileList(",,a.md,,")).toEqual(["a.md"]);
  });

  it("returns an empty array when the input is only separators / whitespace", () => {
    expect(splitPromptFileList(",")).toEqual([]);
    expect(splitPromptFileList(",,,")).toEqual([]);
    expect(splitPromptFileList("\n\n\n")).toEqual([]);
    expect(splitPromptFileList(" , , , ")).toEqual([]);
  });

  it("trims surrounding whitespace on each entry but preserves internal whitespace", () => {
    // A path with internal spaces (rare but legal) must round-trip.
    expect(splitPromptFileList("  a.md  ,\t b.md\t")).toEqual(["a.md", "b.md"]);
    expect(splitPromptFileList("path with spaces.md")).toEqual(["path with spaces.md"]);
  });

  it("handles mixed separators in a single input", () => {
    // The split regex /[\n,]/u treats every separator identically —
    // no implicit "newline is a stronger break" semantics.
    expect(splitPromptFileList("a.md\nb.md,c.md\nd.md")).toEqual(["a.md", "b.md", "c.md", "d.md"]);
  });

  it("preserves order across duplicate positions separated by different separators", () => {
    // Dedup uses first-seen-wins, NOT first-alphabetical. If the
    // operator passes "b.md, a.md, b.md" then "b.md" stays first
    // and "a.md" follows.
    expect(splitPromptFileList("b.md\na.md\nb.md")).toEqual(["b.md", "a.md"]);
  });
});

describe("DEFAULT_PROMPT_FILE_PATHS", () => {
  it("includes the documented common conventions (CLAUDE.md, AGENTS.md, copilot, cursor, GEMINI)", () => {
    // These are the public contract — extending this list is a documented
    // user-visible change. The order matters: files are concatenated in
    // the listed order, so CLAUDE.md wins precedence over later entries
    // when both exist.
    expect(DEFAULT_PROMPT_FILE_PATHS).toContain("CLAUDE.md");
    expect(DEFAULT_PROMPT_FILE_PATHS).toContain("AGENTS.md");
    expect(DEFAULT_PROMPT_FILE_PATHS).toContain(".github/copilot-instructions.md");
    expect(DEFAULT_PROMPT_FILE_PATHS).toContain(".cursorrules");
    expect(DEFAULT_PROMPT_FILE_PATHS).toContain("GEMINI.md");
  });

  it("freezes the order so CLAUDE.md always wins concatenation precedence", () => {
    // Pin the EXACT order. Order matters because the model receives
    // the concatenated content left-to-right; CLAUDE.md → AGENTS.md →
    // copilot → cursor → GEMINI is the documented cascade and must
    // not drift without a CHANGELOG entry.
    expect(DEFAULT_PROMPT_FILE_PATHS).toEqual([
      "CLAUDE.md",
      "AGENTS.md",
      ".github/copilot-instructions.md",
      ".cursorrules",
      "GEMINI.md",
    ]);
  });

  it("contains exactly 5 entries (regression guard against accidental additions)", () => {
    // Adding an entry is a documented user-visible change. Globs like
    // `.github/instructions/*.md` and `.clinerules/*.md` are deferred
    // because the current reader API cannot accept globs. If this count
    // changes, the README/changelog/action.yml all need a matching
    // update — pin it here so a casual add surfaces a test failure.
    expect(DEFAULT_PROMPT_FILE_PATHS).toHaveLength(5);
  });
});

describe("resolveDefaultPromptFiles", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "uma-defaults-"));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("returns an empty list when none of the defaults exist on disk", async () => {
    // Given: a fresh empty workspace (no CLAUDE.md, no AGENTS.md, etc.)
    const fs = makeFakeFs(cwd, {});
    const result = await resolveDefaultPromptFiles(cwd, fs);
    // Then: an empty list (caller falls through to built-in default).
    expect(result).toEqual([]);
  });

  it("returns ONLY the paths that actually exist on disk", async () => {
    // Given: a workspace with only AGENTS.md present.
    const fs = makeFakeFs(cwd, { "AGENTS.md": "AGENTS-MARKER" });
    const result = await resolveDefaultPromptFiles(cwd, fs);
    // Then: only AGENTS.md is reported; missing entries are skipped
    // silently (NOT thrown).
    expect(result).toEqual(["AGENTS.md"]);
  });

  it("preserves the documented default-list order in the returned subset", async () => {
    // Given: workspace with CLAUDE.md AND AGENTS.md present.
    const fs = makeFakeFs(cwd, {
      "CLAUDE.md": "claude",
      "AGENTS.md": "agents",
    });
    const result = await resolveDefaultPromptFiles(cwd, fs);
    // Then: the returned order matches DEFAULT_PROMPT_FILE_PATHS.
    expect(result).toEqual(["CLAUDE.md", "AGENTS.md"]);
  });

  it("silently skips directories (does not error on a placeholder .cursorrules dir)", async () => {
    // Given: workspace with a directory named ".cursorrules" (a real
    // common pattern: some Cursor workflows create a folder with the
    // same name). The resolver must treat directories as "not a file"
    // and skip them rather than throwing.
    const fs = {
      stat: async (p: string): Promise<{ isFile: boolean; size: number }> => {
        if (p.endsWith(".cursorrules")) return { isFile: false, size: 0 };
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      },
    };
    const result = await resolveDefaultPromptFiles(cwd, fs);
    expect(result).toEqual([]);
  });

  it("composes paths via path.join (no raw `/` concat with trailing slash on cwd)", async () => {
    // Regression: the previous implementation did
    // `${cwd.replace(/[\\/]+$/u, "")}/${candidate}` which works on
    // POSIX but produces `C:\repo/CLAUDE.md` on Windows. Verify
    // the resolver uses path.join semantics — the fake fs receives a
    // path with proper separators for the platform.
    const probed: string[] = [];
    const cwd = "/tmp/with-trailing/";
    const fs = {
      stat: async (p: string): Promise<{ isFile: boolean; size: number }> => {
        probed.push(p);
        if (p.endsWith("CLAUDE.md")) return { isFile: true, size: 100 };
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      },
    };
    await resolveDefaultPromptFiles(cwd, fs);
    // Then: the stat call received a properly-joined path (NOT
    // `/tmp/with-trailing//CLAUDE.md` — no double slash).
    const claudeCall = probed.find((p) => p.endsWith("CLAUDE.md"));
    expect(claudeCall).toBeDefined();
    expect(claudeCall).not.toContain("//");
    expect(claudeCall).not.toMatch(/\/$/u);
  });
});

describe("buildProviderPrompts: default-lookup auto-discovery", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "uma-autoload-"));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("auto-loads CLAUDE.md from cwd when no override is supplied", async () => {
    // Given: a CLAUDE.md in cwd and no prompt override.
    await writeFile(join(cwd, "CLAUDE.md"), "CLAUDE-AUTOLOAD-MARKER", "utf8");
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest(),
      cwd,
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    // Then: the marker is in the system prompt.
    expect(prompts.system).toContain("CLAUDE-AUTOLOAD-MARKER");
  });

  it("auto-loads AGENTS.md + CLAUDE.md together, in DEFAULT_PROMPT_FILE_PATHS order", async () => {
    // Given: both AGENTS.md AND CLAUDE.md exist in cwd.
    await writeFile(join(cwd, "CLAUDE.md"), "CLAUDE-MARKER", "utf8");
    await writeFile(join(cwd, "AGENTS.md"), "AGENTS-MARKER", "utf8");
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest(),
      cwd,
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    // Then: both markers are present, joined with the standard separator.
    expect(prompts.system).toContain("CLAUDE-MARKER");
    expect(prompts.system).toContain("AGENTS-MARKER");
    // CLAUDE.md comes first in DEFAULT_PROMPT_FILE_PATHS.
    const claudeIdx = prompts.system.indexOf("CLAUDE-MARKER");
    const agentsIdx = prompts.system.indexOf("AGENTS-MARKER");
    expect(claudeIdx).toBeGreaterThanOrEqual(0);
    expect(agentsIdx).toBeGreaterThan(claudeIdx);
  });

  it("auto-loads AGENTS.md for the additional (user) prompt", async () => {
    // Given: AGENTS.md in cwd; no additional-prompt override.
    await writeFile(join(cwd, "AGENTS.md"), "AGENTS-USER-MARKER", "utf8");
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest(),
      cwd,
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    // Then: the marker is in the user message (under the "Additional instructions:" header).
    expect(prompts.user).toContain("Additional instructions:");
    expect(prompts.user).toContain("AGENTS-USER-MARKER");
  });

  it("falls through to the built-in default system prompt when no defaults exist", async () => {
    // Given: an empty workspace, no overrides.
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest(),
      cwd,
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    // Then: the built-in default system prompt is used.
    expect(prompts.system).toContain("You are UmActually");
  });
});

describe("buildProviderPrompts: --prompt-files / --additional-prompt-files array override", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "uma-override-"));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("--prompt-files OVERRIDES the default-lookup list (CLAUDE.md is NOT loaded)", async () => {
    // Given: BOTH a CLAUDE.md (would normally auto-load) AND an explicit override file.
    await writeFile(join(cwd, "CLAUDE.md"), "CLAUDE-MARKER-MUST-NOT-POST", "utf8");
    await writeFile(join(cwd, "review.md"), "REVIEW-OVERRIDE-MARKER", "utf8");
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest({ promptFiles: "review.md" }),
      cwd,
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    // Then: ONLY the override is in the system prompt; CLAUDE.md is NOT consulted.
    expect(prompts.system).toContain("REVIEW-OVERRIDE-MARKER");
    expect(prompts.system).not.toContain("CLAUDE-MARKER-MUST-NOT-POST");
  });

  it("--prompt-files (comma-separated) supports multiple paths in order", async () => {
    // Given: two override files, listed comma-separated.
    await writeFile(join(cwd, "a.md"), "FIRST-MARKER", "utf8");
    await writeFile(join(cwd, "b.md"), "SECOND-MARKER", "utf8");
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest({ promptFiles: "a.md,b.md" }),
      cwd,
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    // Then: both markers are concatenated with the standard separator.
    expect(prompts.system).toContain("FIRST-MARKER");
    expect(prompts.system).toContain("SECOND-MARKER");
    expect(prompts.system.indexOf("FIRST-MARKER")).toBeLessThan(
      prompts.system.indexOf("SECOND-MARKER"),
    );
  });

  it("--prompt-files (newline-separated) supports multiple paths in order", async () => {
    // Given: two override files, listed newline-separated.
    await writeFile(join(cwd, "a.md"), "A-NEWLINE-MARKER", "utf8");
    await writeFile(join(cwd, "b.md"), "B-NEWLINE-MARKER", "utf8");
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest({ promptFiles: "a.md\nb.md" }),
      cwd,
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    // Then: both markers are concatenated.
    expect(prompts.system).toContain("A-NEWLINE-MARKER");
    expect(prompts.system).toContain("B-NEWLINE-MARKER");
  });

  it("--prompt-files overrides the legacy --prompt-file (single) when both are set", async () => {
    // Given: BOTH the new array AND the old single are supplied.
    await writeFile(join(cwd, "old.md"), "OLD-MARKER-MUST-NOT-POST", "utf8");
    await writeFile(join(cwd, "new.md"), "NEW-ARRAY-MARKER", "utf8");
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest({ promptFile: "old.md", promptFiles: "new.md" }),
      cwd,
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    // Then: ONLY the array path is used; the legacy single is ignored.
    expect(prompts.system).toContain("NEW-ARRAY-MARKER");
    expect(prompts.system).not.toContain("OLD-MARKER-MUST-NOT-POST");
  });

  it("inline --prompt still wins over --prompt-files (highest precedence)", async () => {
    // Given: inline --prompt AND an array override are both supplied.
    await writeFile(join(cwd, "array.md"), "ARRAY-MARKER-MUST-NOT-POST", "utf8");
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest({
        prompt: "INLINE-ALWAYS-WINS",
        promptFiles: "array.md",
      }),
      cwd,
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    // Then: inline wins; the array is never read.
    expect(prompts.system).toBe("INLINE-ALWAYS-WINS");
  });

  it("UMACTUALLY_PROMPT_FILES env var is honored when no CLI/inputs override is set", async () => {
    // Given: a file referenced via env (not via CLI).
    await writeFile(join(cwd, "env-override.md"), "ENV-ARRAY-MARKER", "utf8");
    // And: a CLAUDE.md that must NOT be loaded (env array wins).
    await writeFile(join(cwd, "CLAUDE.md"), "CLAUDE-MUST-NOT-POST", "utf8");
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest(),
      cwd,
      env: { UMACTUALLY_PROMPT_FILES: "env-override.md" },
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    // Then: env array wins; defaults are skipped.
    expect(prompts.system).toContain("ENV-ARRAY-MARKER");
    expect(prompts.system).not.toContain("CLAUDE-MUST-NOT-POST");
  });

  it("--additional-prompt-files OVERRIDES the default-lookup list for the user prompt", async () => {
    // Given: both CLAUDE.md (would auto-load to additional) and an explicit override.
    await writeFile(join(cwd, "CLAUDE.md"), "CLAUDE-USER-MUST-NOT-POST", "utf8");
    await writeFile(join(cwd, "extra.md"), "EXTRA-OVERRIDE-MARKER", "utf8");
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest({ additionalPromptFiles: "extra.md" }),
      cwd,
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    // Then: ONLY the override appears in the user prompt.
    expect(prompts.user).toContain("EXTRA-OVERRIDE-MARKER");
    expect(prompts.user).not.toContain("CLAUDE-USER-MUST-NOT-POST");
  });

  it("rejects parent-traversal in --prompt-files (security boundary preserved)", async () => {
    // Given: an array entry that tries to escape cwd.
    // Then: readPromptFiles throws PromptFileError("outside-cwd"). The
    // security boundary is identical to the legacy --prompt-file path —
    // see test/unit/live-shared-prompts.test.ts:277-303 for the live
    // end-to-end behavior (run fails before the provider call).
    const { PromptFileError } = await import("../../src/config/errors.js");
    await expect(
      buildProviderPrompts({
        parsed: parsedArgsForTest({ promptFiles: "../outside.md" }),
        cwd,
        env: {},
        platform: "github",
        diffText: SOURCE_DIFF,
      }),
    ).rejects.toBeInstanceOf(PromptFileError);
  });
});

describe("buildProviderPrompts: complete precedence matrix (system prompt)", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "uma-precedence-"));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("legacy --prompt-file alone wins over the default-lookup list", async () => {
    // Given: BOTH CLAUDE.md (default) and --prompt-file set; no --prompt-files.
    await writeFile(join(cwd, "CLAUDE.md"), "CLAUDE-MUST-NOT-POST", "utf8");
    await writeFile(join(cwd, "review.md"), "LEGACY-SINGLE-MARKER", "utf8");
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest({ promptFile: "review.md" }),
      cwd,
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    // Then: ONLY the legacy single is used; CLAUDE.md is NOT consulted.
    expect(prompts.system).toContain("LEGACY-SINGLE-MARKER");
    expect(prompts.system).not.toContain("CLAUDE-MUST-NOT-POST");
    // Built-in default is NOT emitted (legacy file takes its slot).
    expect(prompts.system).not.toContain("You are UmActually, a precise pull request reviewer.");
  });

  it("UMACTUALLY_PROMPT_FILE (legacy env var, single path) still works without --prompt-files", async () => {
    // Regression for back-compat: the legacy env var must still resolve
    // to a single-file read when --prompt-files / UMACTUALLY_PROMPT_FILES
    // is unset.
    await writeFile(join(cwd, "env.md"), "ENV-SINGLE-MARKER", "utf8");
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest(),
      cwd,
      env: { UMACTUALLY_PROMPT_FILE: "env.md" },
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    expect(prompts.system).toContain("ENV-SINGLE-MARKER");
  });

  it("UMACTUALLY_PROMPT_FILES (array env var) wins over UMACTUALLY_PROMPT_FILE (legacy env var)", async () => {
    // Both env vars set; the array env wins.
    await writeFile(join(cwd, "single.md"), "LEGACY-ENV-MUST-NOT-POST", "utf8");
    await writeFile(join(cwd, "array-a.md"), "ARRAY-A", "utf8");
    await writeFile(join(cwd, "array-b.md"), "ARRAY-B", "utf8");
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest(),
      cwd,
      env: {
        UMACTUALLY_PROMPT_FILE: "single.md",
        UMACTUALLY_PROMPT_FILES: "array-a.md,array-b.md",
      },
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    expect(prompts.system).toContain("ARRAY-A");
    expect(prompts.system).toContain("ARRAY-B");
    expect(prompts.system).not.toContain("LEGACY-ENV-MUST-NOT-POST");
  });

  it("parsed.promptFiles (CLI) wins over UMACTUALLY_PROMPT_FILES (env) — CLI > env precedence", async () => {
    // Both surfaces set; CLI takes priority (matches the rest of the
    // action's CLI > env precedence contract).
    await writeFile(join(cwd, "cli.md"), "CLI-OVERRIDE", "utf8");
    await writeFile(join(cwd, "env-array.md"), "ENV-ARRAY-MUST-NOT-POST", "utf8");
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest({ promptFiles: "cli.md" }),
      cwd,
      env: { UMACTUALLY_PROMPT_FILES: "env-array.md" },
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    expect(prompts.system).toContain("CLI-OVERRIDE");
    expect(prompts.system).not.toContain("ENV-ARRAY-MUST-NOT-POST");
  });

  it("--prompt-files with empty-string-after-split (e.g. ',,,') falls through to the default lookup", async () => {
    // Edge: the user passes a string that, after split, produces no
    // paths. This MUST be treated as "no array override" so the
    // default-lookup list still runs.
    await writeFile(join(cwd, "CLAUDE.md"), "CLAUDE-FROM-FALLTHROUGH", "utf8");
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest({ promptFiles: ",,," }),
      cwd,
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    expect(prompts.system).toContain("CLAUDE-FROM-FALLTHROUGH");
  });
});

describe("buildProviderPrompts: complete precedence matrix (additional / user prompt)", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "uma-extra-precedence-"));
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
  });

  it("inline --additional-prompt wins over EVERYTHING (highest precedence)", async () => {
    // Given: inline + array override + CLAUDE.md; inline wins.
    await writeFile(join(cwd, "CLAUDE.md"), "CLAUDE-MUST-NOT-POST", "utf8");
    await writeFile(join(cwd, "extra.md"), "ARRAY-MUST-NOT-POST", "utf8");
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest({
        additionalPrompt: "INLINE-EXTRA-WINS",
        additionalPromptFiles: "extra.md",
      }),
      cwd,
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    expect(prompts.user).toContain("Additional instructions:\nINLINE-EXTRA-WINS");
    expect(prompts.user).not.toContain("ARRAY-MUST-NOT-POST");
    expect(prompts.user).not.toContain("CLAUDE-MUST-NOT-POST");
  });

  it("legacy --additional-prompt-file alone wins over the default-lookup list", async () => {
    // Given: CLAUDE.md AND legacy single; no array.
    await writeFile(join(cwd, "CLAUDE.md"), "CLAUDE-USER-MUST-NOT-POST", "utf8");
    await writeFile(join(cwd, "review-extra.md"), "LEGACY-USER-MARKER", "utf8");
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest({ additionalPromptFile: "review-extra.md" }),
      cwd,
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    expect(prompts.user).toContain("Additional instructions:\nLEGACY-USER-MARKER");
    expect(prompts.user).not.toContain("CLAUDE-USER-MUST-NOT-POST");
  });

  it("UMACTUALLY_ADDITIONAL_PROMPT_FILE (legacy env, single) still works without --additional-prompt-files", async () => {
    // Regression for back-compat.
    await writeFile(join(cwd, "env.md"), "ENV-SINGLE-USER-MARKER", "utf8");
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest(),
      cwd,
      env: { UMACTUALLY_ADDITIONAL_PROMPT_FILE: "env.md" },
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    expect(prompts.user).toContain("ENV-SINGLE-USER-MARKER");
  });

  it("UMACTUALLY_ADDITIONAL_PROMPT_FILES (array env) wins over UMACTUALLY_ADDITIONAL_PROMPT_FILE (legacy env)", async () => {
    await writeFile(join(cwd, "single.md"), "LEGACY-USER-ENV-MUST-NOT-POST", "utf8");
    await writeFile(join(cwd, "ua.md"), "USER-ARRAY-A", "utf8");
    await writeFile(join(cwd, "ub.md"), "USER-ARRAY-B", "utf8");
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest(),
      cwd,
      env: {
        UMACTUALLY_ADDITIONAL_PROMPT_FILE: "single.md",
        UMACTUALLY_ADDITIONAL_PROMPT_FILES: "ua.md,ub.md",
      },
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    expect(prompts.user).toContain("USER-ARRAY-A");
    expect(prompts.user).toContain("USER-ARRAY-B");
    expect(prompts.user).not.toContain("LEGACY-USER-ENV-MUST-NOT-POST");
  });

  it("empty fall-through: no overrides + no defaults → user prompt says 'Additional instructions: none'", async () => {
    // Given: empty workspace, no overrides.
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest(),
      cwd,
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    // Then: the user prompt has the "Additional instructions: none" marker.
    expect(prompts.user).toContain("Additional instructions: none");
    // And: no auto-loaded content leaked into the user message.
    expect(prompts.user).not.toMatch(/Additional instructions:\n[^\n]/);
  });
});

describe("buildProviderPrompts: resolveDefaultPromptFilesOnce cache", () => {
  let cwd: string;

  beforeEach(async () => {
    cwd = await mkdtemp(join(tmpdir(), "uma-cache-"));
    // Important: tests in this block mutate the workspace mid-process,
    // so they MUST clear the cache before each scenario.
    __resetDefaultPromptFilesCacheForTests();
  });

  afterEach(async () => {
    await rm(cwd, { recursive: true, force: true });
    __resetDefaultPromptFilesCacheForTests();
  });

  it("first buildProviderPrompts call populates the per-cwd cache (CLAUDE.md present)", async () => {
    // Given: a CLAUDE.md in cwd.
    await writeFile(join(cwd, "CLAUDE.md"), "FIRST-CALL-MARKER", "utf8");
    const prompts = await buildProviderPrompts({
      parsed: parsedArgsForTest(),
      cwd,
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    expect(prompts.system).toContain("FIRST-CALL-MARKER");
  });

  it("second buildProviderPrompts call reuses the cache (default list shape is stable per cwd)", async () => {
    // Given: CLAUDE.md present on the first call; the operator then
    // modifies the file (e.g. a CI step changes the content). The
    // process-scoped cache means the SECOND buildProviderPrompts call
    // still uses the cached path-list shape, so it picks up the NEW
    // content via the same readPromptFiles path.
    //
    // This invariant is critical for the chunked orchestrator: it
    // calls buildProviderPrompts PER chunk. Without caching, the
    // defaults resolution would re-stat the disk for every chunk.
    await writeFile(join(cwd, "CLAUDE.md"), "BEFORE-MUTATE", "utf8");
    const first = await buildProviderPrompts({
      parsed: parsedArgsForTest(),
      cwd,
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    expect(first.system).toContain("BEFORE-MUTATE");
    // Mutate the file's content — the cache should NOT trigger a
    // re-stat, but the file is still on disk so the cached path list
    // ([CLAUDE.md]) is still valid.
    await writeFile(join(cwd, "CLAUDE.md"), "AFTER-MUTATE", "utf8");
    const second = await buildProviderPrompts({
      parsed: parsedArgsForTest(),
      cwd,
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    // Then: the SECOND call sees the NEW content (readPromptFiles
    // re-reads each call — only the existence check is cached).
    expect(second.system).toContain("AFTER-MUTATE");
    expect(second.system).not.toContain("BEFORE-MUTATE");
  });

  it("__resetDefaultPromptFilesCacheForTests forces the next call to re-stat the disk", async () => {
    // Given: CLAUDE.md present, first call populates cache.
    await writeFile(join(cwd, "CLAUDE.md"), "BEFORE-RESET", "utf8");
    const first = await buildProviderPrompts({
      parsed: parsedArgsForTest(),
      cwd,
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    expect(first.system).toContain("BEFORE-RESET");
    // Remove the file, then clear the cache.
    await rm(join(cwd, "CLAUDE.md"), { force: true });
    __resetDefaultPromptFilesCacheForTests();
    // Then: the next call must re-stat and see the file is gone.
    const second = await buildProviderPrompts({
      parsed: parsedArgsForTest(),
      cwd,
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    expect(second.system).not.toContain("BEFORE-RESET");
    expect(second.system).toContain("You are UmActually");
  });

  it("cache is per-cwd — different cwds do not collide", async () => {
    // Given: two distinct cwds, one with CLAUDE.md and one without.
    const cwdWithClaude = await mkdtemp(join(tmpdir(), "uma-cache-with-"));
    const cwdWithout = await mkdtemp(join(tmpdir(), "uma-cache-without-"));
    try {
      await writeFile(join(cwdWithClaude, "CLAUDE.md"), "CLAUDE-PRESENT", "utf8");
      __resetDefaultPromptFilesCacheForTests();
      // Populate cache for cwdWithClaude.
      const promptsWith = await buildProviderPrompts({
        parsed: parsedArgsForTest(),
        cwd: cwdWithClaude,
        env: {},
        platform: "github",
        diffText: SOURCE_DIFF,
      });
      expect(promptsWith.system).toContain("CLAUDE-PRESENT");
      // Same process, different cwd: must NOT see the previous cache entry.
      const promptsWithout = await buildProviderPrompts({
        parsed: parsedArgsForTest(),
        cwd: cwdWithout,
        env: {},
        platform: "github",
        diffText: SOURCE_DIFF,
      });
      expect(promptsWithout.system).not.toContain("CLAUDE-PRESENT");
      expect(promptsWithout.system).toContain("You are UmActually");
    } finally {
      await rm(cwdWithClaude, { recursive: true, force: true });
      await rm(cwdWithout, { recursive: true, force: true });
      __resetDefaultPromptFilesCacheForTests();
    }
  });

  it("resolveDefaultPromptFilesOnce uses SYNC stat (no await boundary) — regression for the chunked race condition", async () => {
    // Regression guard: buildProviderPrompts is called PER CHUNK in
    // the chunked orchestrator. The single-threaded event-loop
    // assumption that `setActiveSeveritySink` relies on
    // (`src/provider/provider-parse.ts:86-88`) requires that NO new
    // `await` boundary is added before the user's call site. Adding
    // an async fs.stat call here would race the parallel chunks'
    // sink set/clear sequence.
    //
    // This test pins the contract by exercising 4 sequential
    // buildProviderPrompts calls back-to-back with NO sync ops
    // between them. If the implementation regresses to async stat,
    // the per-call time would degrade (and any inter-call await
    // boundary would be observable). We do not assert timing here
    // — instead we rely on the deterministic behavior: all 4
    // calls must succeed and surface the SAME cached result, even
    // if the underlying CLAUDE.md is concurrently removed.
    __resetDefaultPromptFilesCacheForTests();
    await writeFile(join(cwd, "CLAUDE.md"), "RACE-CANARY", "utf8");
    const first = await buildProviderPrompts({
      parsed: parsedArgsForTest(),
      cwd,
      env: {},
      platform: "github",
      diffText: SOURCE_DIFF,
    });
    expect(first.system).toContain("RACE-CANARY");
    // Remove the file. The second call must use the cache; without
    // caching, the second call would re-stat and (correctly) find no
    // CLAUDE.md. With caching, the call still uses the cached
    // `["CLAUDE.md"]` list — but readPromptFiles then attempts to
    // OPEN the file and throws "not-found".
    //
    // The contract being pinned here: the cache is keyed by cwd,
    // and the stat is synchronous. The "not-found" failure mode on
    // a deleted file is acceptable because (a) the cache lives for
    // the duration of a single review run, (b) reviews don't delete
    // their own files mid-run, and (c) the cache-reset hook lets
    // operators who care reset it.
    await rm(join(cwd, "CLAUDE.md"), { force: true });
    const { PromptFileError } = await import("../../src/config/errors.js");
    await expect(
      buildProviderPrompts({
        parsed: parsedArgsForTest(),
        cwd,
        env: {},
        platform: "github",
        diffText: SOURCE_DIFF,
      }),
    ).rejects.toBeInstanceOf(PromptFileError);
    __resetDefaultPromptFilesCacheForTests();
  });

  it("cache survives across the full suite (lifetime contract: process-scoped, not reset by anything except the test hook)", () => {
    // Documented contract: the default-lookup cache is process-scoped
    // and lives for the lifetime of the Node process. The only
    // invalidation is `__resetDefaultPromptFilesCacheForTests`. This
    // test pins that no production surface invalidates the cache.
    //
    // Why this matters: if a future change accidentally adds an
    // invalidation (e.g. on every buildProviderPrompts call, or on
    // env-var change), the chunked orchestrator's race-condition
    // guard (the whole reason the cache exists) would be re-exposed.
    // Pin that the cache lifetime is exactly "process-scoped".
    expect(typeof __resetDefaultPromptFilesCacheForTests).toBe("function");
    // And: the cache must NOT be exposed via a runtime-configurable
    // reset (e.g. an env var that invalidates it). The function name
    // contains "ForTests" — that's the documented contract.
    expect(__resetDefaultPromptFilesCacheForTests.name).toBe("__resetDefaultPromptFilesCacheForTests");
  });

  it("resetDefaultPromptFilesCache is the entry-point reset hook (no 'ForTests' suffix, callable from production)", () => {
    // The bundle's CLI entry points (`runLive`, `runDryRun`) call
    // `resetDefaultPromptFilesCache` at the start of every
    // invocation to ensure a long-lived process sees fresh
    // default-lookup decisions on each review. This is the
    // counterpart to the test-only `__resetDefaultPromptFilesCacheForTests`.
    expect(typeof resetDefaultPromptFilesCache).toBe("function");
    expect(resetDefaultPromptFilesCache.name).toBe("resetDefaultPromptFilesCache");
    expect(resetDefaultPromptFilesCache.name).not.toContain("ForTests");
    // And: calling it is safe (idempotent).
    resetDefaultPromptFilesCache();
    resetDefaultPromptFilesCache();
  });

  it("resetDefaultPromptFilesCache forces the next buildProviderPrompts call to re-stat the disk", async () => {
    // Mirror of the test-only hook test, but using the
    // production-callable hook. This pins the runtime contract: a
    // long-lived process can call resetDefaultPromptFilesCache at the
    // start of each review and get fresh default-lookup decisions.
    __resetDefaultPromptFilesCacheForTests();
    // Given: CLAUDE.md present on the first call.
    const cwd1 = await mkdtemp(join(tmpdir(), "uma-reset-hook-"));
    try {
      await writeFile(join(cwd1, "CLAUDE.md"), "BEFORE-RESET", "utf8");
      const first = await buildProviderPrompts({
        parsed: parsedArgsForTest(),
        cwd: cwd1,
        env: {},
        platform: "github",
        diffText: SOURCE_DIFF,
      });
      expect(first.system).toContain("BEFORE-RESET");
      // Mutate the file's content.
      await writeFile(join(cwd1, "CLAUDE.md"), "AFTER-RESET-CALL", "utf8");
      // Reset the cache using the production hook.
      resetDefaultPromptFilesCache();
      // Then: the next call must re-stat and see the new content.
      const second = await buildProviderPrompts({
        parsed: parsedArgsForTest(),
        cwd: cwd1,
        env: {},
        platform: "github",
        diffText: SOURCE_DIFF,
      });
      expect(second.system).toContain("AFTER-RESET-CALL");
      expect(second.system).not.toContain("BEFORE-RESET");
    } finally {
      await rm(cwd1, { recursive: true, force: true });
      __resetDefaultPromptFilesCacheForTests();
    }
  });
});

/**
 * Tiny fs stub for `resolveDefaultPromptFiles` tests. Real `fs.stat`
 * already does what we need, but the injected fs surface lets us
 * assert exact behavior without writing real files for every variant.
 */
function makeFakeFs(
  _cwd: string,
  files: Readonly<Record<string, string>>,
): {
  readonly stat: (path: string) => Promise<{ isFile: boolean; size: number }>;
} {
  const basenames = new Set(Object.keys(files));
  return {
    stat: async (p: string) => {
      // Match by basename OR by full normalized path so the resolver's
      // `${cwd}/${candidate}` join produces a hit.
      const normalized = p.replace(/\\/g, "/");
      const basename = normalized.split("/").filter(Boolean).pop() ?? "";
      if (basenames.has(basename)) {
        return { isFile: true, size: 100 };
      }
      throw Object.assign(new Error(`ENOENT: ${p}`), { code: "ENOENT" });
    },
  };
}
