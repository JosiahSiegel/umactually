import { describe, expect, it } from "vitest";

import { readActionInputs } from "../../src/action/read-inputs.js";
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

  it("simulateFindings honors the literal-hyphen INPUT_SIMULATE-FINDINGS form (GitHub quirk)", () => {
    // Given: a GitHub Actions runtime where only the literal-hyphen env form
    // is set (this is what GitHub Actions actually emits for hyphenated input
    // names that exceed the underscore-mapping threshold in some runners).
    const env = {
      GITHUB_ACTIONS: "true",
      "INPUT_SIMULATE-FINDINGS": "true",
    } satisfies NodeJS.ProcessEnv;

    // When: readActionInputs resolves the flag.
    const inputs = readActionInputs(env);

    // Then: simulateFindings is true so the orchestrator can inject the fixture
    // regardless of which env-var form the runner emitted.
    expect(inputs.simulateFindings).toBe(true);
  });

  it("prefers the underscore form when both INPUT_SIMULATE_FINDINGS forms are set", () => {
    // Given: both env-var forms are set (runner emitted both for some reason).
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
