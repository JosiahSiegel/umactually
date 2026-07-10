import { describe, expect, it } from "vitest";

import {
  buildProviderPrompts,
  REVIEW_PAYLOAD_JSON_SCHEMA,
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
  additionalPrompt?: string;
  additionalPromptFile?: string | null;
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
    additionalPromptFile: overrides.additionalPromptFile ?? null,
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
