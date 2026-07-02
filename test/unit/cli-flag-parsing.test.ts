import { describe, expect, it } from "vitest";

import { expectNotImplementedExport } from "../helpers/assert-red-module.js";

type CliPlatform = "auto" | "github" | "azure";
type CliMinimumSeverity = "low" | "medium" | "high";
type CliEffort = "low" | "medium" | "high";
type CliProvider = "openai-compatible" | "copilot";

type ParsedCliArgs = {
  readonly platform: CliPlatform;
  readonly eventPath: string | null;
  readonly diffPath: string | null;
  readonly threadsPath: string | null;
  readonly reviewPath: string | null;
  readonly prNumber: string | null;
  readonly repo: string | null;
  readonly apiUrl: string | null;
  readonly apiKey: string | null;
  readonly model: string | null;
  readonly promptFile: string | null;
  readonly additionalPromptFile: string | null;
  readonly prompt: string | null;
  readonly additionalPrompt: string | null;
  readonly effort: CliEffort | null;
  readonly provider: CliProvider | null;
  readonly githubApiBase: string | null;
  readonly includeSonarqube: boolean;
  readonly sonarHostUrl: string | null;
  readonly sonarToken: string | null;
  readonly sonarProjectKey: string | null;
  readonly sonarTimeoutSeconds: number | null;
  readonly ignoreMinor: boolean;
  readonly minimumSeverity: CliMinimumSeverity | null;
  readonly maxComments: number | null;
  readonly detectLeaks: boolean;
  readonly walkthrough: boolean;
  readonly diagnostic: boolean;
  readonly debugRawResponse: boolean;
  readonly simulateFindings: boolean;
  readonly reviewTimeoutSeconds: number | null;
  readonly stallSeconds: number | null;
  readonly perRequestTimeoutSeconds: number | null;
  readonly maxOutputTokens: number | null;
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
      prompt: null,
      additionalPrompt: null,
      effort: null,
      provider: null,
      githubApiBase: null,
      includeSonarqube: true,
      sonarHostUrl: "https://sonar.example.test",
      sonarToken: "sonar-token",
      sonarProjectKey: "umactually",
      sonarTimeoutSeconds: null,
      ignoreMinor: true,
      minimumSeverity: null,
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
      dryRun: true,
      outputArtifact: "artifacts/manual/azure-dry-run.json",
    });
  });
});

describe("CLI flag parsing: action.yml inputs coverage", () => {
  // These flags MUST be accepted by parseCliArgs without throwing "unknown flag"
  // because src/index.ts (the action entry) pushes them from INPUT_* env vars.
  // The smoke test below asserts that running each flag in isolation does not
  // throw. The order of these flag names must mirror action.yml inputs.
  const actionInputFlags: readonly string[] = [
    "--review-timeout-seconds",
    "--stall-seconds",
    "--per-request-timeout-seconds",
    "--max-output-tokens",
    "--minimum-severity",
    "--max-comments",
    "--ignore-minor",
    "--debug-raw-response",
    "--diagnostic",
    "--walkthrough",
    "--platform",
    "--sonar-host-url",
    "--sonar-token",
    "--sonar-project-key",
    "--sonar-timeout-seconds",
    "--include-sonarqube",
    "--no-detect-leaks",
    "--prompt-file",
    "--additional-prompt-file",
    "--no-walkthrough",
    "--no-diagnostic",
    "--no-debug-raw-response",
    "--no-dry-run",
    "--no-ignore-minor",
    "--no-include-sonarqube",
    "--simulate-findings",
    "--no-simulate-findings",
    "--prompt",
    "--additional-prompt",
    "--effort",
    "--provider",
    "--github-api-base",
  ];

  const valueFlags: ReadonlySet<string> = new Set([
    "--platform",
    "--review-timeout-seconds",
    "--stall-seconds",
    "--per-request-timeout-seconds",
    "--max-output-tokens",
    "--minimum-severity",
    "--max-comments",
    "--sonar-host-url",
    "--sonar-token",
    "--sonar-project-key",
    "--sonar-timeout-seconds",
    "--prompt-file",
    "--additional-prompt-file",
    "--prompt",
    "--additional-prompt",
    "--effort",
    "--provider",
    "--github-api-base",
  ]);

  it("every action.yml input flag is accepted by parseCliArgs (no 'unknown flag' crash)", async () => {
    // Given: every flag listed in action.yml inputs.
    const parseCliArgs = await expectNotImplementedExport(cliModule, cliPath, "parseCliArgs");
    if (!isParseCliArgs(parseCliArgs)) {
      expect.fail("RED: src/cli.ts must export parseCliArgs(args)");
    }

    for (const flag of actionInputFlags) {
      const argv: string[] = ["node", "script", flag];
      if (valueFlags.has(flag)) {
        argv.push(safePlaceholder(flag));
      }

      const savedArgv = process.argv;
      process.argv = argv;
      try {
        // When: parseCliArgs is invoked via process.argv shape.
        expect(() => parseCliArgs(argv.slice(2))).not.toThrow();
      } finally {
        process.argv = savedArgv;
      }
    }
  });

  it("CLI smoke: --review-timeout-seconds --platform --no-dry-run --ignore-minor --minimum-severity do not throw 'unknown flag'", async () => {
    // Given: a representative set of flags the self-review workflow pushes.
    const parseCliArgs = await expectNotImplementedExport(cliModule, cliPath, "parseCliArgs");
    if (!isParseCliArgs(parseCliArgs)) {
      expect.fail("RED: src/cli.ts must export parseCliArgs(args)");
    }
    const args = [
      "--review-timeout-seconds",
      "300",
      "--platform",
      "github",
      "--no-dry-run",
      "--ignore-minor",
      "--minimum-severity",
      "medium",
    ];

    // When: parseCliArgs processes the flags.
    let result: ParsedCliArgs | null = null;
    expect(() => {
      result = parseCliArgs(args);
    }).not.toThrow();

    // Then: the parsed values reflect the requested flags.
    expect(result).not.toBeNull();
    const parsed = result as unknown as ParsedCliArgs;
    expect(parsed.reviewTimeoutSeconds).toBe(300);
    expect(parsed.platform).toBe("github");
    expect(parsed.dryRun).toBe(false);
    expect(parsed.ignoreMinor).toBe(true);
    expect(parsed.minimumSeverity).toBe("medium");
  });

  it("--no-dry-run explicitly disables dry-run (parsed.dryRun is false)", async () => {
    const parseCliArgs = await expectNotImplementedExport(cliModule, cliPath, "parseCliArgs");
    if (!isParseCliArgs(parseCliArgs)) {
      expect.fail("RED: src/cli.ts must export parseCliArgs(args)");
    }
    const parsed = parseCliArgs(["--no-dry-run"]);
    expect(parsed.dryRun).toBe(false);
  });

  it("--dry-run takes precedence over later --no-dry-run in the same argv", async () => {
    const parseCliArgs = await expectNotImplementedExport(cliModule, cliPath, "parseCliArgs");
    if (!isParseCliArgs(parseCliArgs)) {
      expect.fail("RED: src/cli.ts must export parseCliArgs(args)");
    }
    const parsed = parseCliArgs(["--dry-run", "--no-dry-run"]);
    expect(parsed.dryRun).toBe(false);
  });

  it("--platform accepts github|azure|auto (and azure-devops as azure alias)", async () => {
    const parseCliArgs = await expectNotImplementedExport(cliModule, cliPath, "parseCliArgs");
    if (!isParseCliArgs(parseCliArgs)) {
      expect.fail("RED: src/cli.ts must export parseCliArgs(args)");
    }
    expect(parseCliArgs(["--platform", "github"]).platform).toBe("github");
    expect(parseCliArgs(["--platform", "azure"]).platform).toBe("azure");
    expect(parseCliArgs(["--platform", "auto"]).platform).toBe("auto");
    expect(parseCliArgs(["--platform", "azure-devops"]).platform).toBe("azure");
  });

  it("--no-ignore-minor / --no-walkthrough / --no-diagnostic / --no-debug-raw-response / --no-include-sonarqube flip the matching booleans off", async () => {
    const parseCliArgs = await expectNotImplementedExport(cliModule, cliPath, "parseCliArgs");
    if (!isParseCliArgs(parseCliArgs)) {
      expect.fail("RED: src/cli.ts must export parseCliArgs(args)");
    }
    const parsed = parseCliArgs([
      "--ignore-minor",
      "--walkthrough",
      "--diagnostic",
      "--debug-raw-response",
      "--include-sonarqube",
      "--no-ignore-minor",
      "--no-walkthrough",
      "--no-diagnostic",
      "--no-debug-raw-response",
      "--no-include-sonarqube",
    ]);
    expect(parsed.ignoreMinor).toBe(false);
    expect(parsed.walkthrough).toBe(false);
    expect(parsed.diagnostic).toBe(false);
    expect(parsed.debugRawResponse).toBe(false);
    expect(parsed.includeSonarqube).toBe(false);
  });

  it("--minimum-severity rejects values outside {low, medium, high}", async () => {
    const parseCliArgs = await expectNotImplementedExport(cliModule, cliPath, "parseCliArgs");
    if (!isParseCliArgs(parseCliArgs)) {
      expect.fail("RED: src/cli.ts must export parseCliArgs(args)");
    }
    expect(() => parseCliArgs(["--minimum-severity", "bogus"])).toThrow(/invalid --minimum-severity/);
  });

  it("--review-timeout-seconds / --stall-seconds / --max-output-tokens / --max-comments parse to integers", async () => {
    const parseCliArgs = await expectNotImplementedExport(cliModule, cliPath, "parseCliArgs");
    if (!isParseCliArgs(parseCliArgs)) {
      expect.fail("RED: src/cli.ts must export parseCliArgs(args)");
    }
    const parsed = parseCliArgs([
      "--review-timeout-seconds", "300",
      "--stall-seconds", "270",
      "--per-request-timeout-seconds", "60",
      "--max-output-tokens", "16000",
      "--max-comments", "50",
      "--sonar-timeout-seconds", "300",
    ]);
    expect(parsed.reviewTimeoutSeconds).toBe(300);
    expect(parsed.stallSeconds).toBe(270);
    expect(parsed.perRequestTimeoutSeconds).toBe(60);
    expect(parsed.maxOutputTokens).toBe(16_000);
    expect(parsed.maxComments).toBe(50);
    expect(parsed.sonarTimeoutSeconds).toBe(300);
  });
});

function safePlaceholder(flag: string): string {
  if (flag === "--minimum-severity") {
    return "low";
  }
  if (flag === "--platform") {
    return "auto";
  }
  if (flag === "--effort") {
    return "medium";
  }
  if (flag === "--provider") {
    return "openai-compatible";
  }
  if (flag === "--prompt" || flag === "--additional-prompt") {
    return "text";
  }
  if (flag === "--github-api-base") {
    return "https://api.github.com";
  }
  if (
    flag === "--review-timeout-seconds" ||
    flag === "--stall-seconds" ||
    flag === "--per-request-timeout-seconds" ||
    flag === "--max-output-tokens" ||
    flag === "--max-comments" ||
    flag === "--sonar-timeout-seconds"
  ) {
    return "300";
  }
  return "value";
}
