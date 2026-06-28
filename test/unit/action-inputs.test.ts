import { describe, expect, it } from "vitest";

import { readActionInputs } from "../../src/action/read-inputs.js";

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
