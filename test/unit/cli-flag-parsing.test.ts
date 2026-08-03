import { describe, expect, it } from "vitest";

import { CliUsageError } from "../../src/cli/parse-args.js";
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
  readonly promptFiles: string | null;
  readonly additionalPromptFile: string | null;
  readonly additionalPromptFiles: string | null;
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
      files: null,
      threadsPath: null,
      reviewPath: null,
      prNumber: "42",
      repo: "example/project",
      apiUrl: "https://provider.example.test/v1",
      apiKey: "test-key",
      model: "review-model-synthetic",
      promptFile: "prompts/review.md",
      promptFiles: null,
      additionalPromptFile: "prompts/extra.md",
      additionalPromptFiles: null,
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
      minimumSeverity: "medium",
      minimumSeverityInternal: "major",
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
      strictSchema: true,
      verifyFindings: true,
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
    "--prompt-files",
    "--additional-prompt-files",
    "--no-walkthrough",
    "--no-diagnostic",
    "--no-debug-raw-response",
    "--no-dry-run",
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
    "--prompt-files",
    "--additional-prompt-files",
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

  it("CLI smoke: --review-timeout-seconds --platform --no-dry-run --minimum-severity do not throw 'unknown flag'", async () => {
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
      "--minimum-severity",
      "medium",
    ];

    // When: parseCliArgs processes the flags.
    const parsed = parseCliArgs(args);

    // Then: the parsed values reflect the requested flags.
    expect(parsed.reviewTimeoutSeconds).toBe(300);
    expect(parsed.platform).toBe("github");
    expect(parsed.dryRun).toBe(false);
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

  it("--no-dry-run overrides earlier --dry-run in the same argv (last wins)", async () => {
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

  it("--no-walkthrough / --no-diagnostic / --no-debug-raw-response / --no-include-sonarqube flip the matching booleans off", async () => {
    const parseCliArgs = await expectNotImplementedExport(cliModule, cliPath, "parseCliArgs");
    if (!isParseCliArgs(parseCliArgs)) {
      expect.fail("RED: src/cli.ts must export parseCliArgs(args)");
    }
    const parsed = parseCliArgs([
      "--walkthrough",
      "--diagnostic",
      "--debug-raw-response",
      "--include-sonarqube",
      "--no-walkthrough",
      "--no-diagnostic",
      "--no-debug-raw-response",
      "--no-include-sonarqube",
    ]);
    expect(parsed.walkthrough).toBe(false);
    expect(parsed.diagnostic).toBe(false);
    expect(parsed.debugRawResponse).toBe(false);
    expect(parsed.includeSonarqube).toBe(false);
  });

  it("--ignore-minor throws CliUsageError with minimum-severity migration guidance", async () => {
    const parseCliArgs = await expectNotImplementedExport(cliModule, cliPath, "parseCliArgs");
    if (!isParseCliArgs(parseCliArgs)) {
      expect.fail("RED: src/cli.ts must export parseCliArgs(args)");
    }
    expect(() => parseCliArgs(["--ignore-minor"])).toThrow(CliUsageError);
    expect(() => parseCliArgs(["--ignore-minor"])).toThrow(/use --minimum-severity/u);
  });

  it("--no-ignore-minor throws CliUsageError with minimum-severity migration guidance", async () => {
    const parseCliArgs = await expectNotImplementedExport(cliModule, cliPath, "parseCliArgs");
    if (!isParseCliArgs(parseCliArgs)) {
      expect.fail("RED: src/cli.ts must export parseCliArgs(args)");
    }
    expect(() => parseCliArgs(["--no-ignore-minor"])).toThrow(CliUsageError);
    expect(() => parseCliArgs(["--no-ignore-minor"])).toThrow(/use --minimum-severity/u);
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

  it("rejects partial numeric garbage in integer flags instead of silently truncating", async () => {
    const parseCliArgs = await expectNotImplementedExport(cliModule, cliPath, "parseCliArgs");
    if (!isParseCliArgs(parseCliArgs)) {
      expect.fail("RED: src/cli.ts must export parseCliArgs(args)");
    }
    // Regression: Number.parseInt("12abc", 10) returns 12; the CLI must
    // throw CliUsageError instead of silently parsing partial garbage.
    //
    // Note: the empty-string case ("") was already rejected by the
    // previous Number.parseInt + isSafeInteger guard (NaN is not safe),
    // so it is pinned here for byte-completeness but is not the bug
    // being fixed. The remaining 6 cases are all genuinely new.
    const cases: ReadonlyArray<readonly string[]> = [
      ["--max-comments", "12abc"],
      ["--review-timeout-seconds", "300xyz"],
      ["--per-request-timeout-seconds", "60.5"],
      ["--sonar-timeout-seconds", "1e3"],
      ["--max-output-tokens", ""], // pre-existing: NaN is not a safe integer
      ["--stall-seconds", " 270 "],
      ["--max-comments", "1.0"],
    ];
    for (const argv of cases) {
      expect(() => parseCliArgs(argv as string[]), `argv=${argv.join(" ")}`).toThrow(
        /integer value/u,
      );
    }
  });

  it("--prompt-files accepts a raw comma/newline-separated list as a SINGLE string (split happens in provider-prompts)", async () => {
    // The CLI parser intentionally does NOT split the value. The split
    // is owned by `splitPromptFileList` in src/config/prompt-files.ts
    // so the same splitting contract applies to env-var inputs and
    // CLI inputs. Verify the parser surfaces the raw string.
    const parseCliArgs = await expectNotImplementedExport(cliModule, cliPath, "parseCliArgs");
    if (!isParseCliArgs(parseCliArgs)) {
      expect.fail("RED: src/cli.ts must export parseCliArgs(args)");
    }
    const parsed = parseCliArgs(["--prompt-files", "a.md,b.md,c.md"]);
    expect(parsed.promptFiles).toBe("a.md,b.md,c.md");
    // Then: the legacy promptFile field is untouched (no implicit merge).
    expect(parsed.promptFile).toBeNull();
  });

  it("--additional-prompt-files accepts a raw newline-separated list as a SINGLE string", async () => {
    const parseCliArgs = await expectNotImplementedExport(cliModule, cliPath, "parseCliArgs");
    if (!isParseCliArgs(parseCliArgs)) {
      expect.fail("RED: src/cli.ts must export parseCliArgs(args)");
    }
    const parsed = parseCliArgs(["--additional-prompt-files", "x.md\ny.md"]);
    expect(parsed.additionalPromptFiles).toBe("x.md\ny.md");
    expect(parsed.additionalPromptFile).toBeNull();
  });

  it("defaults promptFiles / additionalPromptFiles to null when no flag is supplied", async () => {
    // Regression for back-compat: an empty argv must surface
    // `promptFiles: null` so the live path knows the operator did
    // not opt in to the array (and can therefore consult the
    // default-lookup list).
    const parseCliArgs = await expectNotImplementedExport(cliModule, cliPath, "parseCliArgs");
    if (!isParseCliArgs(parseCliArgs)) {
      expect.fail("RED: src/cli.ts must export parseCliArgs(args)");
    }
    const parsed = parseCliArgs([]);
    expect(parsed.promptFiles).toBeNull();
    expect(parsed.additionalPromptFiles).toBeNull();
  });

  it("--prompt-files with no value (followed by another flag) throws CliUsageError", async () => {
    // Edge: `parseCliArgs(["--prompt-files", "--platform"])` must reject
    // because `--platform` looks like a flag, not a value.
    const parseCliArgs = await expectNotImplementedExport(cliModule, cliPath, "parseCliArgs");
    if (!isParseCliArgs(parseCliArgs)) {
      expect.fail("RED: src/cli.ts must export parseCliArgs(args)");
    }
    expect(() => parseCliArgs(["--prompt-files", "--platform"])).toThrow(CliUsageError);
    expect(() => parseCliArgs(["--additional-prompt-files", "--platform"])).toThrow(CliUsageError);
  });

  it("--prompt-files at the end of argv (no following value) throws CliUsageError", async () => {
    const parseCliArgs = await expectNotImplementedExport(cliModule, cliPath, "parseCliArgs");
    if (!isParseCliArgs(parseCliArgs)) {
      expect.fail("RED: src/cli.ts must export parseCliArgs(args)");
    }
    expect(() => parseCliArgs(["--platform", "github", "--prompt-files"])).toThrow(CliUsageError);
  });

  it("last-flag-wins: --prompt-files supplied twice keeps the second value", async () => {
    // The CLI parser uses `let promptFiles = null` then reassigns, so
    // duplicate flags must reflect last-wins semantics (matching the
    // existing behavior for every other flag in the parser).
    const parseCliArgs = await expectNotImplementedExport(cliModule, cliPath, "parseCliArgs");
    if (!isParseCliArgs(parseCliArgs)) {
      expect.fail("RED: src/cli.ts must export parseCliArgs(args)");
    }
    const parsed = parseCliArgs([
      "--prompt-files", "first.md",
      "--prompt-files", "second.md,third.md",
    ]);
    expect(parsed.promptFiles).toBe("second.md,third.md");
  });
});

describe("CLI flag parsing: --github-token + GH_TOKEN alias (plan T8/T9 RED)", () => {
  // Bundle-locked semantics:
  //   flag > canonical env (GITHUB_TOKEN) > legacy env (GH_TOKEN) > saved > default
  //
  // --github-token does not exist on ParsedCliArgs yet (field-schema.ts
  // currently has flag: null). Once the wiring lands, the parser must
  // expose `parsedCliArgs.githubToken` and the field-schema must set
  // flag: "--github-token" + env: ["GITHUB_TOKEN", "GH_TOKEN"].
  // These tests are RED until that wiring exists.

  it("--github-token=<value> populates parsedCliArgs.githubToken", async () => {
    const parseCliArgs = await expectNotImplementedExport(cliModule, cliPath, "parseCliArgs");
    if (!isParseCliArgs(parseCliArgs)) {
      expect.fail("RED: src/cli.ts must export parseCliArgs(args)");
    }
    const parsed = parseCliArgs(["--github-token", "test"]);
    // TODO(plan T9): githubToken not yet on ParsedCliArgs
    // @ts-expect-error githubToken not yet on ParsedCliArgs
    expect(parsed.githubToken).toBe("test");
  });

  it("--github-token=<value> (equals form) populates parsedCliArgs.githubToken", async () => {
    // Matches the README's documented `--github-token=<value>` shape.
    const parseCliArgs = await expectNotImplementedExport(cliModule, cliPath, "parseCliArgs");
    if (!isParseCliArgs(parseCliArgs)) {
      expect.fail("RED: src/cli.ts must export parseCliArgs(args)");
    }
    const parsed = parseCliArgs(["--github-token=ghp_equals_form_token"]);
    // TODO(plan T9): githubToken not yet on ParsedCliArgs
    // @ts-expect-error githubToken not yet on ParsedCliArgs
    expect(parsed.githubToken).toBe("ghp_equals_form_token");
  });

  it("--github-token with no value (followed by another flag) throws CliUsageError", async () => {
    // Edge: --github-token must require a value, like every other
    // value-bearing flag in the parser. The next token that starts
    // with `--` cannot be consumed as the value.
    const parseCliArgs = await expectNotImplementedExport(cliModule, cliPath, "parseCliArgs");
    if (!isParseCliArgs(parseCliArgs)) {
      expect.fail("RED: src/cli.ts must export parseCliArgs(args)");
    }
    expect(() => parseCliArgs(["--github-token", "--platform"])).toThrow(CliUsageError);
    expect(() => parseCliArgs(["--github-token", "--platform"])).toThrow(/--github-token/u);
  });

  it("--github-token at end of argv (no following value) throws CliUsageError", async () => {
    const parseCliArgs = await expectNotImplementedExport(cliModule, cliPath, "parseCliArgs");
    if (!isParseCliArgs(parseCliArgs)) {
      expect.fail("RED: src/cli.ts must export parseCliArgs(args)");
    }
    expect(() => parseCliArgs(["--platform", "github", "--github-token"])).toThrow(CliUsageError);
  });

  it("--no-github-token (negative form) is rejected as an unknown flag usage error", async () => {
    // githubToken is a string-typed field; the standard parser
    // contract is that --no- prefixes are NOT valid for string
    // fields (they're for boolean negations only). The parser must
    // surface the standard unknown-flag usage error rather than
    // silently accepting --no-github-token.
    const parseCliArgs = await expectNotImplementedExport(cliModule, cliPath, "parseCliArgs");
    if (!isParseCliArgs(parseCliArgs)) {
      expect.fail("RED: src/cli.ts must export parseCliArgs(args)");
    }
    expect(() => parseCliArgs(["--no-github-token"])).toThrow(CliUsageError);
    expect(() => parseCliArgs(["--no-github-token"])).toThrow(/unknown flag/u);
  });

  it("--github-token supplied twice keeps the second value (last wins)", async () => {
    // The parser uses `let ... = null` then reassigns, so duplicate
    // flags must reflect last-wins semantics (matching every other
    // string flag in the parser: --api-key, --model, --repo, etc.).
    const parseCliArgs = await expectNotImplementedExport(cliModule, cliPath, "parseCliArgs");
    if (!isParseCliArgs(parseCliArgs)) {
      expect.fail("RED: src/cli.ts must export parseCliArgs(args)");
    }
    const parsed = parseCliArgs([
      "--github-token", "first-token",
      "--github-token", "second-token",
    ]);
    // TODO(plan T9): githubToken not yet on ParsedCliArgs
    // @ts-expect-error githubToken not yet on ParsedCliArgs
    expect(parsed.githubToken).toBe("second-token");
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
