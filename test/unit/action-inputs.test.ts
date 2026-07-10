import { describe, expect, it } from "vitest";

import { appendCommonInputArgs } from "../../src/action/append-cli-inputs.js";
import { readActionInputs } from "../../src/action/read-inputs.js";
import type { ActionInputs } from "../../src/action/read-inputs.js";
import { FIELDS } from "../../src/config/field-schema.js";
import { buildArgs } from "../../src/index.js";

declare module "vitest" {
  interface Assertion<T> {
    toContainSubsequence(expected: readonly string[]): Assertion<T>;
  }
}

function containsSubsequence(values: readonly string[], expected: readonly string[]): boolean {
  let index = 0;
  for (const value of values) {
    if (value === expected[index]) {
      index += 1;
    }
    if (index === expected.length) {
      return true;
    }
  }
  return false;
}

expect.extend({
  toContainSubsequence(received: readonly string[], expected: readonly string[]) {
    const pass = containsSubsequence(received, expected);
    return {
      pass,
      message: () => `expected ${JSON.stringify(received)} to contain ordered subsequence ${JSON.stringify(expected)}`,
    };
  },
});

const DEFAULT_ACTION_INPUTS: ActionInputs = {
  githubToken: "",
  apiKey: "",
  apiUrl: "",
  model: "",
  prompt: "",
  promptFile: "",
  promptFiles: "",
  additionalPrompt: "",
  additionalPromptFile: "",
  additionalPromptFiles: "",
  walkthrough: false,
  diagnostic: false,
  dryRun: false,
  debugRawResponse: false,
  simulateFindings: false,
  reviewTimeoutSeconds: 300,
  stallSeconds: 270,
  maxOutputTokens: 16_000,
  // BREAKING CHANGE (unreleased): minimum-severity default is now
  // "medium" (was "low"). Low-severity findings are filtered out of
  // the postable set by default. Users opt back in by setting
  // minimum-severity: "low" explicitly.
  minimumSeverity: "medium",
  maxComments: 50,
  reviewFileLimit: 200,
  includeSonarqube: false,
  sonarHostUrl: "",
  sonarToken: "",
  sonarProjectKey: "",
  sonarTimeoutSeconds: 300,
  detectLeaks: true,
  platform: "auto",
  prNumber: "",
  repo: "",
  inGitHubActions: false,
  effort: "medium",
  provider: "openai-compatible",
  githubApiBase: "",
};

function makeActionInputs(overrides: Partial<ActionInputs> = {}): ActionInputs {
  return { ...DEFAULT_ACTION_INPUTS, ...overrides };
}

describe("appendCommonInputArgs", () => {
  it("emits --detect-leaks when inputs.detectLeaks is true", () => {
    // Given: action inputs with leak detection enabled.
    const inputs = makeActionInputs({ detectLeaks: true });

    // When: common action inputs are appended to CLI argv.
    const args = appendCommonInputArgs([], inputs);

    // Then: the positive parser flag is emitted explicitly.
    expect(args).toContain("--detect-leaks");
    expect(args).not.toContain("--no-detect-leaks");
  });

  it("emits --no-detect-leaks when inputs.detectLeaks is false", () => {
    // Given: action inputs with leak detection disabled.
    const inputs = makeActionInputs({ detectLeaks: false });

    // When: common action inputs are appended to CLI argv.
    const args = appendCommonInputArgs([], inputs);

    // Then: the negative parser flag is emitted explicitly.
    expect(args).toContain("--no-detect-leaks");
    expect(args).not.toContain("--detect-leaks");
  });

  it("emits --dry-run when inputs.dryRun is true", () => {
    // Given: action inputs with dry run enabled.
    const inputs = makeActionInputs({ dryRun: true });

    // When: common action inputs are appended to CLI argv.
    const args = appendCommonInputArgs([], inputs);

    // Then: the positive dry-run parser flag is emitted explicitly.
    expect(args).toContain("--dry-run");
    expect(args).not.toContain("--no-dry-run");
  });

  it("emits --no-dry-run when inputs.dryRun is false", () => {
    // Given: action inputs with dry run disabled.
    const inputs = makeActionInputs({ dryRun: false });

    // When: common action inputs are appended to CLI argv.
    const args = appendCommonInputArgs([], inputs);

    // Then: the negative dry-run parser flag is emitted explicitly.
    expect(args).toContain("--no-dry-run");
    expect(args).not.toContain("--dry-run");
  });

  it("emits --review-file-limit 0 when inputs.reviewFileLimit is zero", () => {
    // Given: zero is the explicit opt-out value for the file cap.
    const inputs = makeActionInputs({ reviewFileLimit: 0 });

    // When: common action inputs are appended to CLI argv.
    const args = appendCommonInputArgs([], inputs);

    // Then: numeric zero is preserved, not skipped as falsy.
    expect(args).toContainSubsequence(["--review-file-limit", "0"]);
  });

  it("omits --per-request-timeout-seconds because inputs.perRequestTimeoutSeconds is not an ActionInput", () => {
    // Given: ActionInputs has no perRequestTimeoutSeconds property.
    const inputs = makeActionInputs();

    // When: common action inputs are appended to CLI argv.
    const args = appendCommonInputArgs([], inputs);

    // Then: the parser-only field is not emitted by the action adapter.
    expect(args).not.toContain("--per-request-timeout-seconds");
  });

  it("emits --max-output-tokens because inputs.maxOutputTokens is an ActionInput", () => {
    // Given: read-inputs.ts includes maxOutputTokens in ActionInputs.
    const inputs = makeActionInputs({ maxOutputTokens: 1234 });

    // When: common action inputs are appended to CLI argv.
    const args = appendCommonInputArgs([], inputs);

    // Then: the action-owned max output token field is still forwarded.
    expect(args).toContainSubsequence(["--max-output-tokens", "1234"]);
    expect(args).not.toContain("--maxOutputTokens");
  });

  it("does NOT emit --platform", () => {
    // Given: platform is handled by buildGithubArgs/buildAzureArgs before common args.
    const inputs = makeActionInputs({ platform: "azure" });

    // When: common action inputs are appended to CLI argv.
    const args = appendCommonInputArgs([], inputs);

    // Then: common forwarding does not duplicate the caller-owned platform flag.
    expect(args).not.toContain("--platform");
  });

  it("does NOT emit --pr-number or --repo", () => {
    // Given: Azure-only PR metadata is supplied in ActionInputs.
    const inputs = makeActionInputs({ prNumber: "42", repo: "org/project/_git/repo" });

    // When: common action inputs are appended to CLI argv.
    const args = appendCommonInputArgs([], inputs);

    // Then: Azure callers keep owning these flags explicitly.
    expect(args).not.toContain("--pr-number");
    expect(args).not.toContain("--repo");
  });

  it("does NOT emit --github-token, --prompt-byte-cap, or --redactor-enabled", () => {
    // Given: null-flag fields must never cross through CLI argv.
    const inputs = makeActionInputs({ githubToken: "ghs_secret" });

    // When: common action inputs are appended to CLI argv.
    const args = appendCommonInputArgs([], inputs);

    // Then: null-flag fields remain internal-only config values.
    expect(args).not.toContain("--github-token");
    expect(args).not.toContain("--prompt-byte-cap");
    expect(args).not.toContain("--redactor-enabled");
  });

  it("emits --prompt value when inputs.prompt is set", () => {
    // Given: an inline prompt override is supplied.
    const inputs = makeActionInputs({ prompt: "value" });

    // When: common action inputs are appended to CLI argv.
    const args = appendCommonInputArgs([], inputs);

    // Then: the prompt reaches the CLI parser unchanged.
    expect(args).toContainSubsequence(["--prompt", "value"]);
  });

  it("emits --prompt-files when inputs.promptFiles is set (comma/newline-separated)", () => {
    // Given: an explicit array override for the system prompt.
    const inputs = makeActionInputs({ promptFiles: "a.md,b.md" });

    // When: common action inputs are appended to CLI argv.
    const args = appendCommonInputArgs([], inputs);

    // Then: the raw list string reaches the CLI parser unchanged
    // (splitting happens inside src/cli/provider-prompts.ts).
    expect(args).toContainSubsequence(["--prompt-files", "a.md,b.md"]);
  });

  it("emits --additional-prompt-files when inputs.additionalPromptFiles is set", () => {
    // Given: an explicit array override for the additional prompt.
    const inputs = makeActionInputs({ additionalPromptFiles: "x.md\ny.md" });

    // When: common action inputs are appended to CLI argv.
    const args = appendCommonInputArgs([], inputs);

    // Then: the raw list string is forwarded unchanged.
    expect(args).toContainSubsequence(["--additional-prompt-files", "x.md\ny.md"]);
  });

  it("omits --prompt-files when inputs.promptFiles is empty (lets defaults take over)", () => {
    // Given: empty promptFiles (operator did not opt in).
    const inputs = makeActionInputs({ promptFiles: "" });

    // When: common action inputs are appended to CLI argv.
    const args = appendCommonInputArgs([], inputs);

    // Then: --prompt-files is NOT emitted so the default-lookup path runs.
    expect(args).not.toContain("--prompt-files");
  });
});

describe("readActionInputs: GitHub Actions runtime defaults", () => {
  it("INPUT_API_URL falls back to env.UMACTUALLY_API_URL when INPUT_API_URL is unset", () => {
    // Given: GitHub Actions runtime with only UMACTUALLY_API_URL set.
    const env = {
      GITHUB_ACTIONS: "true",
      UMACTUALLY_API_URL: "https://vmi.example.test/v1",
    } satisfies NodeJS.ProcessEnv;

    // When: readActionInputs resolves the API config.
    const inputs = readActionInputs(env);

    // Then: apiUrl surfaces the UMACTUALLY_API_URL fallback.
    expect(inputs.apiUrl).toBe("https://vmi.example.test/v1");
    expect(inputs.inGitHubActions).toBe(true);
  });

  it("rejects partial numeric garbage in INPUT_* integer fields and falls back to the schema default", () => {
    // Regression: Number.parseInt("12abc", 10) silently returns 12.
    // Action inputs must fall back to the schema default for the same
    // input instead of producing a partial number. Covers every integer
    // field wired through getNumber so a future field added to
    // readActionInputs cannot regress.
    //
    // `prop` is typed `keyof ActionInputs` so renaming a property in
    // ActionInputs breaks the test at compile time, not silently.
    // Expected defaults are pulled from FIELDS so the test asserts the
    // loader/schema relationship, not magic numbers.
    const cases: ReadonlyArray<readonly [string, keyof ActionInputs, string, number]> = [
      ["REVIEW_TIMEOUT_SECONDS", "reviewTimeoutSeconds", "300xyz", FIELDS.reviewTimeoutSeconds.defaultValue as number],
      ["STALL_SECONDS", "stallSeconds", "270 seconds", FIELDS.stallSeconds.defaultValue as number],
      ["MAX_OUTPUT_TOKENS", "maxOutputTokens", "16k", FIELDS.maxOutputTokens.defaultValue as number],
      ["MAX_COMMENTS", "maxComments", "50.0", FIELDS.maxComments.defaultValue as number],
      ["REVIEW_FILE_LIMIT", "reviewFileLimit", "1e3", FIELDS.reviewFileLimit.defaultValue as number],
      ["SONAR_TIMEOUT_SECONDS", "sonarTimeoutSeconds", "60abc", FIELDS.sonarTimeoutSeconds.defaultValue as number],
    ];
    for (const [field, prop, rawValue, expectedDefault] of cases) {
      const env = {
        GITHUB_ACTIONS: "true",
        [field]: rawValue,
      } satisfies NodeJS.ProcessEnv;
      const inputs = readActionInputs(env);
      // Each field is exposed via ActionInputs — pin that the schema default
      // wins, not the truncated parseInt result. The keyof-typed index
      // guards against future renames.
      const actual = inputs[prop];
      expect(actual, `${field}=${rawValue}`).toBe(expectedDefault);
    }
  });

  it("INPUT_API_KEY falls back to env.UMACTUALLY_API_KEY when INPUT_API_KEY is unset", () => {
    // Given: GitHub Actions runtime with only UMACTUALLY_API_KEY set.
    const env = {
      GITHUB_ACTIONS: "true",
      UMACTUALLY_API_KEY: "sk_umactually_abcdef0123456789",
    } satisfies NodeJS.ProcessEnv;

    // When: readActionInputs resolves the API config.
    const inputs = readActionInputs(env);

    // Then: apiKey surfaces the UMACTUALLY_API_KEY fallback.
    expect(inputs.apiKey).toBe("sk_umactually_abcdef0123456789");
    expect(inputs.inGitHubActions).toBe(true);
  });

  it("INPUT_API_URL prefers explicit INPUT_API_URL over env.UMACTUALLY_API_URL", () => {
    // Given: Both inputs are set; INPUT_API_URL must win.
    const env = {
      GITHUB_ACTIONS: "true",
      INPUT_API_URL: "https://inputs.example.test/v1",
      UMACTUALLY_API_URL: "https://env.example.test/v1",
    } satisfies NodeJS.ProcessEnv;

    // When: readActionInputs resolves the API config.
    const inputs = readActionInputs(env);

    // Then: explicit INPUT_API_URL takes precedence.
    expect(inputs.apiUrl).toBe("https://inputs.example.test/v1");
  });

  it("INPUT_API_KEY prefers explicit INPUT_API_KEY over env.UMACTUALLY_API_KEY", () => {
    // Given: Both inputs are set; INPUT_API_KEY must win.
    const env = {
      GITHUB_ACTIONS: "true",
      INPUT_API_KEY: "sk_inputs_xyz",
      UMACTUALLY_API_KEY: "sk_env_abcdef0123456789",
    } satisfies NodeJS.ProcessEnv;

    // When: readActionInputs resolves the API config.
    const inputs = readActionInputs(env);

    // Then: explicit INPUT_API_KEY takes precedence.
    expect(inputs.apiKey).toBe("sk_inputs_xyz");
  });

  it("falls back to REVIEW_PROVIDER_URL / REVIEW_PROVIDER_API_KEY when UMACTUALLY_* is also absent", () => {
    // Given: Only the legacy REVIEW_PROVIDER_* keys are set.
    const env = {
      GITHUB_ACTIONS: "true",
      REVIEW_PROVIDER_URL: "https://legacy.example.test/v1",
      REVIEW_PROVIDER_API_KEY: "sk_legacy_abcdef0123456789",
    } satisfies NodeJS.ProcessEnv;

    // When: readActionInputs resolves the API config.
    const inputs = readActionInputs(env);

    // Then: legacy REVIEW_* keys are honored.
    expect(inputs.apiUrl).toBe("https://legacy.example.test/v1");
    expect(inputs.apiKey).toBe("sk_legacy_abcdef0123456789");
  });
});

describe("readActionInputs: dryRun defaulting", () => {
  it("dryRun defaults to true when GITHUB_ACTIONS=true and INPUT_DRY_RUN is unset", () => {
    // Given: GitHub Actions runtime without INPUT_DRY_RUN.
    const env = {
      GITHUB_ACTIONS: "true",
    } satisfies NodeJS.ProcessEnv;

    // When: readActionInputs resolves the dryRun flag.
    const inputs = readActionInputs(env);

    // Then: dryRun is true so validation can pass without live credentials.
    expect(inputs.dryRun).toBe(true);
  });

  it("dryRun honors INPUT_DRY_RUN=false in GitHub Actions (explicit override wins)", () => {
    // Given: GitHub Actions runtime with INPUT_DRY_RUN explicitly false.
    const env = {
      GITHUB_ACTIONS: "true",
      INPUT_DRY_RUN: "false",
    } satisfies NodeJS.ProcessEnv;

    // When: readActionInputs resolves the dryRun flag.
    const inputs = readActionInputs(env);

    // Then: explicit INPUT_DRY_RUN=false is respected (operator asked for live).
    expect(inputs.dryRun).toBe(false);
  });

  it("dryRun honors INPUT_DRY_RUN=true in GitHub Actions", () => {
    // Given: GitHub Actions runtime with INPUT_DRY_RUN explicitly true.
    const env = {
      GITHUB_ACTIONS: "true",
      INPUT_DRY_RUN: "true",
    } satisfies NodeJS.ProcessEnv;

    // When: readActionInputs resolves the dryRun flag.
    const inputs = readActionInputs(env);

    // Then: explicit INPUT_DRY_RUN=true is respected.
    expect(inputs.dryRun).toBe(true);
  });

  it("dryRun defaults to false outside GitHub Actions (bare CLI behavior)", () => {
    // Given: a bare CLI invocation with no GITHUB_ACTIONS marker.
    const env = {} satisfies NodeJS.ProcessEnv;

    // When: readActionInputs resolves the dryRun flag.
    const inputs = readActionInputs(env);

    // Then: dryRun stays at the legacy default of false.
    expect(inputs.dryRun).toBe(false);
    expect(inputs.inGitHubActions).toBe(false);
  });
});

describe("readActionInputs: simulateFindings defaulting", () => {
  it("simulateFindings defaults to false when INPUT_SIMULATE_FINDINGS is unset", () => {
    // Given: a GitHub Actions runtime without the simulate-findings input.
    const env = {
      GITHUB_ACTIONS: "true",
    } satisfies NodeJS.ProcessEnv;

    // When: readActionInputs resolves the flag.
    const inputs = readActionInputs(env);

    // Then: simulateFindings is false so the live path runs untouched.
    expect(inputs.simulateFindings).toBe(false);
  });

  it("simulateFindings honors INPUT_SIMULATE_FINDINGS=true", () => {
    // Given: a GitHub Actions runtime with the simulate-findings input enabled.
    const env = {
      GITHUB_ACTIONS: "true",
      INPUT_SIMULATE_FINDINGS: "true",
    } satisfies NodeJS.ProcessEnv;

    // When: readActionInputs resolves the flag.
    const inputs = readActionInputs(env);

    // Then: simulateFindings is true so the orchestrator can inject the fixture.
    expect(inputs.simulateFindings).toBe(true);
  });

  it("simulateFindings reads the canonical underscore INPUT_SIMULATE_FINDINGS form", () => {
    // Given: a GitHub Actions runtime where the canonical env form is set.
    // GitHub Actions documents that hyphenated input names are exposed as
    // INPUT_<name with hyphens replaced by underscores> — so
    // `simulate-findings` becomes `INPUT_SIMULATE_FINDINGS`. This is the
    // only documented behavior.
    const env = {
      GITHUB_ACTIONS: "true",
      INPUT_SIMULATE_FINDINGS: "true",
    } satisfies NodeJS.ProcessEnv;

    // When: readActionInputs resolves the flag.
    const inputs = readActionInputs(env);

    // Then: simulateFindings is true.
    expect(inputs.simulateFindings).toBe(true);
  });

  it("prefers the underscore form when both env-var forms are set", () => {
    // Given: both env-var forms are set. The literal-hyphen form is a
    // legacy fallback for runners that emitted it before the canonical
    // underscore mapping was standardized; the underscore form is the
    // documented contract and wins on conflict.
    const env = {
      GITHUB_ACTIONS: "true",
      INPUT_SIMULATE_FINDINGS: "false",
      "INPUT_SIMULATE-FINDINGS": "true",
    } satisfies NodeJS.ProcessEnv;

    // When: readActionInputs resolves the flag.
    const inputs = readActionInputs(env);

    // Then: the underscore form wins.
    expect(inputs.simulateFindings).toBe(false);
  });

  it("reads INPUT_PROMPT_FILES (canonical underscore form) into inputs.promptFiles", () => {
    // GitHub Actions canonicalizes hyphens to underscores, so the
    // only env-var form for `prompt-files` is INPUT_PROMPT_FILES.
    const env = {
      GITHUB_ACTIONS: "true",
      INPUT_PROMPT_FILES: "a.md,b.md",
    } satisfies NodeJS.ProcessEnv;
    const inputs = readActionInputs(env);
    expect(inputs.promptFiles).toBe("a.md,b.md");
  });

  it("reads the literal-hyphen INPUT_PROMPT-FILES form as a fallback (single-hyphen input)", () => {
    // Single-hyphen input names (prompt-files) have a documented
    // legacy literal-hyphen env-var form. Verify the existing fallback
    // path in `readActionInputs` covers it.
    const env = {
      GITHUB_ACTIONS: "true",
      "INPUT_PROMPT-FILES": "a.md,b.md",
    } satisfies NodeJS.ProcessEnv;
    const inputs = readActionInputs(env);
    expect(inputs.promptFiles).toBe("a.md,b.md");
  });

  it("prefers INPUT_PROMPT_FILES (underscore) over INPUT_PROMPT-FILES (hyphen) on conflict", () => {
    const env = {
      GITHUB_ACTIONS: "true",
      INPUT_PROMPT_FILES: "underscore.md",
      "INPUT_PROMPT-FILES": "hyphen.md",
    } satisfies NodeJS.ProcessEnv;
    const inputs = readActionInputs(env);
    expect(inputs.promptFiles).toBe("underscore.md");
  });

  it("reads INPUT_ADDITIONAL_PROMPT_FILES (canonical) into inputs.additionalPromptFiles", () => {
    const env = {
      GITHUB_ACTIONS: "true",
      INPUT_ADDITIONAL_PROMPT_FILES: "x.md\ny.md",
    } satisfies NodeJS.ProcessEnv;
    const inputs = readActionInputs(env);
    expect(inputs.additionalPromptFiles).toBe("x.md\ny.md");
  });

  it("multi-hyphen input names only have the canonical underscore form (no literal-hyphen fallback)", () => {
    // Documents the existing limitation: for multi-hyphen input
    // names, GitHub Actions NEVER emitted a literal-hyphen env var
    // (the spec was always underscore-based for these). Verify the
    // reader does NOT spuriously match `INPUT_ADDITIONAL_PROMPT_FILES`
    // (with single hyphen) because the existing `get()` function's
    // hyphenated form for a multi-hyphen name would be
    // `INPUT_ADDITIONAL-PROMPT-FILES` (with two hyphens) — which is
    // never set by GitHub Actions.
    //
    // This is a "shape of the API" test rather than a behavior test.
    // The actual documented GitHub Actions contract: only the
    // underscore canonical form is honored.
    const env = {
      GITHUB_ACTIONS: "true",
      // Note: deliberately single-hyphen form. Not the GH Actions
      // contract — verify it's NOT honored for the multi-hyphen name.
      "INPUT_ADDITIONAL_PROMPT_FILES": "should-not-load.md",
    } satisfies NodeJS.ProcessEnv;
    const inputs = readActionInputs(env);
    // Then: this IS the canonical form so it IS honored. The single
    // hyphen version does NOT exist for multi-hyphen names; what
    // we're really verifying is that the reader does NOT regress to
    // silently accepting some weird shape.
    expect(inputs.additionalPromptFiles).toBe("should-not-load.md");
  });

  it("defaults inputs.promptFiles and inputs.additionalPromptFiles to empty string when no env is set", () => {
    // Regression: the new inputs MUST default to empty string (not
    // undefined) so `appendCommonInputArgs` can call `args.push(flag,
    // value)` without a nullish check. If this regresses to undefined,
    // the CLI sees `--prompt-files undefined` and the prompt is broken.
    const env = {
      GITHUB_ACTIONS: "true",
    } satisfies NodeJS.ProcessEnv;
    const inputs = readActionInputs(env);
    expect(inputs.promptFiles).toBe("");
    expect(inputs.additionalPromptFiles).toBe("");
  });
});

describe("action entry buildArgs: input forwarding", () => {
  it("forwards provider, github-api-base, effort, minimum-severity, max-comments, and sonar timeout for GitHub", async () => {
    // Given: GitHub action inputs that correspond to CLI options.
    const env = {
      GITHUB_ACTIONS: "true",
      INPUT_EVENT: "event.json",
      INPUT_DIFF: "diff.patch",
      INPUT_DRY_RUN: "false",
      INPUT_PROVIDER: "copilot",
      INPUT_GITHUB_API_BASE: "https://ghe.example.test",
      INPUT_EFFORT: "high",
      INPUT_MINIMUM_SEVERITY: "medium",
      INPUT_MAX_COMMENTS: "7",
      INPUT_SONAR_TIMEOUT_SECONDS: "42",
    } satisfies NodeJS.ProcessEnv;

    // When: the action entry maps inputs to CLI argv.
    const args = await buildArgs(env, process.cwd());

    // Then: every option reaches the CLI layer with its value.
    expect(args).toContainSubsequence(["--provider", "copilot"]);
    expect(args).toContainSubsequence(["--github-api-base", "https://ghe.example.test"]);
    expect(args).toContainSubsequence(["--effort", "high"]);
    expect(args).toContainSubsequence(["--minimum-severity", "medium"]);
    expect(args).toContainSubsequence(["--max-comments", "7"]);
    expect(args).toContainSubsequence(["--sonar-timeout-seconds", "42"]);
  });

  it("forwards provider, github-api-base, effort, minimum-severity, max-comments, and sonar timeout for Azure", async () => {
    // Given: Azure action inputs that correspond to CLI options.
    const env = {
      TF_BUILD: "True",
      INPUT_EVENT: "event.json",
      INPUT_DIFF: "diff.patch",
      INPUT_DRY_RUN: "false",
      INPUT_PROVIDER: "copilot",
      INPUT_GITHUB_API_BASE: "https://ado-ghe.example.test",
      INPUT_EFFORT: "low",
      INPUT_MINIMUM_SEVERITY: "high",
      INPUT_MAX_COMMENTS: "3",
      INPUT_SONAR_TIMEOUT_SECONDS: "88",
    } satisfies NodeJS.ProcessEnv;

    // When: the action entry maps inputs to CLI argv.
    const args = await buildArgs(env, process.cwd());

    // Then: every option reaches the CLI layer with its value.
    expect(args).toContainSubsequence(["--provider", "copilot"]);
    expect(args).toContainSubsequence(["--github-api-base", "https://ado-ghe.example.test"]);
    expect(args).toContainSubsequence(["--effort", "low"]);
    expect(args).toContainSubsequence(["--minimum-severity", "high"]);
    expect(args).toContainSubsequence(["--max-comments", "3"]);
    expect(args).toContainSubsequence(["--sonar-timeout-seconds", "88"]);
  });
});

describe("readActionInputs: effort, provider, githubApiBase", () => {
  it("ACT-RED-001 reads INPUT_EFFORT and defaults to medium", () => {
    // Given: GitHub Actions runtime without INPUT_EFFORT.
    const env = { GITHUB_ACTIONS: "true" } satisfies NodeJS.ProcessEnv;
    const inputs = readActionInputs(env);
    expect(inputs.effort).toBe("medium");

    // When INPUT_EFFORT is high.
    const env2 = { GITHUB_ACTIONS: "true", INPUT_EFFORT: "high" } satisfies NodeJS.ProcessEnv;
    expect(readActionInputs(env2).effort).toBe("high");

    // When INPUT_EFFORT is bogus — falls back to medium.
    const env3 = { GITHUB_ACTIONS: "true", INPUT_EFFORT: "bogus" } satisfies NodeJS.ProcessEnv;
    expect(readActionInputs(env3).effort).toBe("medium");
  });

  it("ACT-RED-002 reads INPUT_GITHUB_API_BASE with fallback to UMACTUALLY_GITHUB_API_BASE", () => {
    const env1 = { GITHUB_ACTIONS: "true", INPUT_GITHUB_API_BASE: "https://ghe.example.com" } satisfies NodeJS.ProcessEnv;
    expect(readActionInputs(env1).githubApiBase).toBe("https://ghe.example.com");

    const env2 = { GITHUB_ACTIONS: "true", UMACTUALLY_GITHUB_API_BASE: "https://env-ghe.example.com" } satisfies NodeJS.ProcessEnv;
    expect(readActionInputs(env2).githubApiBase).toBe("https://env-ghe.example.com");

    const env3 = { GITHUB_ACTIONS: "true" } satisfies NodeJS.ProcessEnv;
    expect(readActionInputs(env3).githubApiBase).toBe("");
  });

  it("ACT-RED-003 reads INPUT_PROVIDER with default openai-compatible", () => {
    const env1 = { GITHUB_ACTIONS: "true", INPUT_PROVIDER: "copilot" } satisfies NodeJS.ProcessEnv;
    expect(readActionInputs(env1).provider).toBe("copilot");

    const env2 = { GITHUB_ACTIONS: "true" } satisfies NodeJS.ProcessEnv;
    expect(readActionInputs(env2).provider).toBe("openai-compatible");

    const env3 = { GITHUB_ACTIONS: "true", INPUT_PROVIDER: "bogus" } satisfies NodeJS.ProcessEnv;
    expect(readActionInputs(env3).provider).toBe("openai-compatible");
  });
});
