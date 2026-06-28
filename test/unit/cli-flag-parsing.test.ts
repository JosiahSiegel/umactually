import { describe, expect, it } from "vitest";

import { expectNotImplementedExport } from "../helpers/assert-red-module.js";

type CliPlatform = "auto" | "github" | "azure";

type ParsedCliArgs = {
  readonly platform: CliPlatform;
  readonly eventPath: string | null;
  readonly diffPath: string | null;
  readonly prNumber: string | null;
  readonly repo: string | null;
  readonly apiUrl: string | null;
  readonly apiKey: string | null;
  readonly model: string | null;
  readonly promptFile: string | null;
  readonly additionalPromptFile: string | null;
  readonly includeSonarqube: boolean;
  readonly sonarHostUrl: string | null;
  readonly sonarToken: string | null;
  readonly sonarProjectKey: string | null;
  readonly ignoreMinor: boolean;
  readonly detectLeaks: boolean;
  readonly dryRun: boolean;
  readonly outputArtifact: string | null;
};

type ParseCliArgs = (args: readonly string[]) => ParsedCliArgs;

const cliModule = "../../src/cli.js";
const cliPath = "src/cli.ts";

function isParseCliArgs(value: unknown): value is ParseCliArgs {
  return typeof value === "function";
}

describe("CLI flag parsing RED contract", () => {
  it("CLI-RED-001 parses Azure DevOps pipeline flags into typed CLI options", async () => {
    // Given: an Azure pipeline invocation with provider, SonarQube, and safety flags.
    const args = [
      "--platform",
      "azure",
      "--event",
      "test/fixtures/azure/pull-request.json",
      "--diff",
      "test/fixtures/github/full-pr.diff",
      "--pr-number",
      "42",
      "--repo",
      "example/project",
      "--api-url",
      "https://provider.example.test/v1",
      "--api-key",
      "test-key",
      "--model",
      "review-model-synthetic",
      "--prompt-file",
      "prompts/review.md",
      "--additional-prompt-file",
      "prompts/extra.md",
      "--include-sonarqube",
      "--sonar-host-url",
      "https://sonar.example.test",
      "--sonar-token",
      "sonar-token",
      "--sonar-project-key",
      "umactually",
      "--ignore-minor",
      "--detect-leaks",
      "--dry-run",
      "--output-artifact",
      "artifacts/manual/azure-dry-run.json",
    ];

    // When: the future CLI parser normalizes the argv tokens.
    const parseCliArgs = await expectNotImplementedExport(cliModule, cliPath, "parseCliArgs");
    if (!isParseCliArgs(parseCliArgs)) {
      expect.fail("RED: src/cli.ts must export parseCliArgs(args)");
    }
    const result = parseCliArgs(args);

    // Then: every supported flag is represented without shelling out or reading files.
    expect(result).toEqual({
      platform: "azure",
      eventPath: "test/fixtures/azure/pull-request.json",
      diffPath: "test/fixtures/github/full-pr.diff",
      threadsPath: null,
      reviewPath: null,
      prNumber: "42",
      repo: "example/project",
      apiUrl: "https://provider.example.test/v1",
      apiKey: "test-key",
      model: "review-model-synthetic",
      promptFile: "prompts/review.md",
      additionalPromptFile: "prompts/extra.md",
      includeSonarqube: true,
      sonarHostUrl: "https://sonar.example.test",
      sonarToken: "sonar-token",
      sonarProjectKey: "umactually",
      ignoreMinor: true,
      detectLeaks: true,
      dryRun: true,
      outputArtifact: "artifacts/manual/azure-dry-run.json",
    });
  });
});
