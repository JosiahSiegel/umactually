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