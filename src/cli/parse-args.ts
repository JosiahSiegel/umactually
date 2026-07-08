import { FIELDS } from "../config/field-schema.js";
import { parseStrictInt, readEnum } from "../util/cli-args.js";
import type { Severity } from "../config/types.js";
import { parseSeverityFromUnknown } from "../config/parsers.js";

/**
 * CLI-side normalized platform union. The CLI parser accepts `"azure-devops"`
 * as an input alias for `"azure"`, then normalizes it before returning
 * `ParsedCliArgs`, so this type intentionally exposes only the canonical
 * downstream variants. Distinct from `Platform` in `src/config/types.ts`
 * (which is the config-side canonical set).
 */
export type CliPlatform = "auto" | "github" | "azure";
export type CliMinimumSeverity = "low" | "medium" | "high";
export type CliEffort = "low" | "medium" | "high";
export type CliProvider = "openai-compatible" | "copilot";

export type ParsedCliArgs = {
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
  readonly minimumSeverity: CliMinimumSeverity | null;
  /**
   * Pre-resolved internal `Severity` for `minimumSeverity` (mapped via
   * the alias table: low→minor, medium→major, high→critical). `null`
   * when no threshold is set. Computed once at arg-parse time so
   * per-comment consumers like `passesSeverityPolicy` don't re-parse
   * (and don't re-throw `InvalidConfigError` deep in the live path on
   * a future bad value).
   */
  readonly minimumSeverityInternal: Severity | null;
  readonly maxComments: number | null;
  readonly reviewFileLimit: number | null;
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

export class CliUsageError extends Error {
  override readonly name = "CliUsageError";
}

export function parseCliArgs(args: readonly string[]): ParsedCliArgs {
  let platform: CliPlatform = "auto";
  let eventPath: string | null = null;
  let diffPath: string | null = null;
  let threadsPath: string | null = null;
  let reviewPath: string | null = null;
  let prNumber: string | null = null;
  let repo: string | null = null;
  let apiUrl: string | null = null;
  let apiKey: string | null = null;
  let model: string | null = null;
  let promptFile: string | null = null;
  let additionalPromptFile: string | null = null;
  let prompt: string | null = null;
  let additionalPrompt: string | null = null;
  let effort: CliEffort | null = null;
  let provider: CliProvider | null = null;
  let githubApiBase: string | null = null;
  let includeSonarqube = false;
  let sonarHostUrl: string | null = null;
  let sonarToken: string | null = null;
  let sonarProjectKey: string | null = null;
  let sonarTimeoutSeconds: number | null = null;
  // BREAKING CHANGE: default flipped from null (no minimum) to "medium".
  // Matches the action.yml default and src/config/field-schema.ts so the
  // CLI and the GitHub Action behave the same out of the box. Without
  // this, the CLI path's passesSeverityPolicy() short-circuits on null
  // and posts every finding including low/info, while the action filters
  // them. Users who want the old "no minimum" behavior can pass
  // `--minimum-severity low` explicitly.
  let minimumSeverity: CliMinimumSeverity | null = "medium";
  let maxComments: number | null = null;
  let reviewFileLimit: number | null = null;
  let detectLeaks = true;
  let walkthrough = false;
  let diagnostic = false;
  let debugRawResponse = false;
  let simulateFindings = false;
  let reviewTimeoutSeconds: number | null = null;
  let stallSeconds: number | null = null;
  let perRequestTimeoutSeconds: number | null = null;
  let maxOutputTokens: number | null = null;
  let dryRun = false;
  let outputArtifact: string | null = null;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === undefined) {
      continue;
    }
    switch (token) {
      case "--platform":
        index = consumeValue(args, index, "platform", (value) => {
          platform = readPlatform(value);
        });
        break;
      case "--event":
        eventPath = readValue(args, index, "event");
        index += 1;
        break;
      case "--diff":
        diffPath = readValue(args, index, "diff");
        index += 1;
        break;
      case "--threads":
        threadsPath = readValue(args, index, "threads");
        index += 1;
        break;
      case "--review":
        reviewPath = readValue(args, index, "review");
        index += 1;
        break;
      case "--pr-number":
        prNumber = readValue(args, index, "pr-number");
        index += 1;
        break;
      case "--repo":
        repo = readValue(args, index, "repo");
        index += 1;
        break;
      case "--api-url":
        apiUrl = readValue(args, index, "api-url");
        index += 1;
        break;
      case "--api-key":
        apiKey = readValue(args, index, "api-key");
        index += 1;
        break;
      case "--model":
        model = readValue(args, index, "model");
        index += 1;
        break;
      case "--prompt-file":
        promptFile = readValue(args, index, "prompt-file");
        index += 1;
        break;
      case "--additional-prompt-file":
        additionalPromptFile = readValue(args, index, "additional-prompt-file");
        index += 1;
        break;
      case "--prompt":
        prompt = readValue(args, index, "prompt");
        index += 1;
        break;
      case "--additional-prompt":
        additionalPrompt = readValue(args, index, "additional-prompt");
        index += 1;
        break;
      case "--effort":
        effort = readEffort(args, index);
        index += 1;
        break;
      case "--provider":
        index = consumeValue(args, index, "provider", (value) => {
          provider = readProvider(value);
        });
        break;
      case "--github-api-base":
        githubApiBase = readValue(args, index, "github-api-base");
        index += 1;
        break;
      case "--include-sonarqube":
        includeSonarqube = true;
        break;
      case "--no-include-sonarqube":
        includeSonarqube = false;
        break;
      case "--sonar-host-url":
        sonarHostUrl = readValue(args, index, "sonar-host-url");
        index += 1;
        break;
      case "--sonar-token":
        sonarToken = readValue(args, index, "sonar-token");
        index += 1;
        break;
      case "--sonar-project-key":
        sonarProjectKey = readValue(args, index, "sonar-project-key");
        index += 1;
        break;
      case "--sonar-timeout-seconds":
        sonarTimeoutSeconds = readIntValue(args, index, "sonar-timeout-seconds");
        index += 1;
        break;
      case "--ignore-minor":
      case "--no-ignore-minor":
        throw new CliUsageError("--ignore-minor was removed; use --minimum-severity medium (or low/high) to suppress minor findings. Leaks and security findings are never suppressed. Environment variables UMACTUALLY_IGNORE_MINOR and REVIEW_IGNORE_MINOR are also ignored.");
      case "--minimum-severity":
        minimumSeverity = readMinimumSeverity(args, index);
        index += 1;
        break;
      case "--max-comments":
        maxComments = readIntValue(args, index, "max-comments");
        index += 1;
        break;
      case "--review-file-limit":
        reviewFileLimit = readIntValue(args, index, "review-file-limit");
        index += 1;
        break;
      case "--detect-leaks":
        detectLeaks = true;
        break;
      case "--no-detect-leaks":
        detectLeaks = false;
        break;
      case "--walkthrough":
        walkthrough = true;
        break;
      case "--no-walkthrough":
        walkthrough = false;
        break;
      case "--diagnostic":
        diagnostic = true;
        break;
      case "--no-diagnostic":
        diagnostic = false;
        break;
      case "--debug-raw-response":
        debugRawResponse = true;
        break;
      case "--no-debug-raw-response":
        debugRawResponse = false;
        break;
      case "--simulate-findings":
        simulateFindings = true;
        break;
      case "--no-simulate-findings":
        simulateFindings = false;
        break;
      case "--review-timeout-seconds":
        reviewTimeoutSeconds = readIntValue(args, index, "review-timeout-seconds");
        index += 1;
        break;
      case "--stall-seconds":
        stallSeconds = readIntValue(args, index, "stall-seconds");
        index += 1;
        break;
      case "--per-request-timeout-seconds":
        perRequestTimeoutSeconds = readIntValue(args, index, "per-request-timeout-seconds");
        index += 1;
        break;
      case "--max-output-tokens":
        maxOutputTokens = readIntValue(args, index, "max-output-tokens");
        index += 1;
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--no-dry-run":
        dryRun = false;
        break;
      case "--output-artifact":
        outputArtifact = readValue(args, index, "output-artifact");
        index += 1;
        break;
      case "--help":
      case "-h":
        throw new CliHelpSignal();
      default:
        throw new CliUsageError(`unknown flag: ${token}`);
    }
  }

  return {
    platform,
    eventPath,
    diffPath,
    threadsPath,
    reviewPath,
    prNumber,
    repo,
    apiUrl,
    apiKey,
    model,
    promptFile,
    additionalPromptFile,
    prompt,
    additionalPrompt,
    effort,
    provider,
    githubApiBase,
    includeSonarqube,
    sonarHostUrl,
    sonarToken,
    sonarProjectKey,
    sonarTimeoutSeconds,
    minimumSeverity,
    minimumSeverityInternal: minimumSeverity === null
      ? null
      : parseSeverityFromUnknown(minimumSeverity, "cli.minimumSeverity"),
    maxComments,
    reviewFileLimit,
    detectLeaks,
    walkthrough,
    diagnostic,
    debugRawResponse,
    simulateFindings,
    reviewTimeoutSeconds,
    stallSeconds,
    perRequestTimeoutSeconds,
    maxOutputTokens,
    dryRun,
    outputArtifact,
  };
}

export class CliHelpSignal extends Error {
  override readonly name = "CliHelpSignal";
}

function consumeValue(
  args: readonly string[],
  index: number,
  flag: string,
  apply: (value: string) => void,
): number {
  const value = readValue(args, index, flag);
  apply(value);
  return index + 1;
}

function readValue(args: readonly string[], index: number, flag: string): string {
  const next = args[index + 1];
  if (next === undefined || next.startsWith("--")) {
    throw new CliUsageError(`flag --${flag} requires a value`);
  }
  return next;
}

function readIntValue(args: readonly string[], index: number, flag: string): number {
  const raw = readValue(args, index, flag);
  // parseStrictInt already returns null for non-safe-integer parses, so
  // no extra isSafeInteger check is needed at the call site — null
  // is the single sentinel for "not a valid integer".
  const parsed = parseStrictInt(raw);
  if (parsed === null) {
    throw new CliUsageError(`flag --${flag} requires an integer value (got "${raw}")`);
  }
  return parsed;
}

function readMinimumSeverity(args: readonly string[], index: number): CliMinimumSeverity {
  const raw = readValue(args, index, "minimum-severity");
  return readEnum<CliMinimumSeverity>("--minimum-severity", raw, FIELDS.minimumSeverity.enumValues as readonly CliMinimumSeverity[], CliUsageError);
}

function readPlatform(value: string): CliPlatform {
  // Accept "azure-devops" as a CLI-only alias for "azure" so callers
  // familiar with the older name keep working.
  if (value === "azure-devops") {
    return "azure";
  }
  return readEnum<CliPlatform>("--platform", value, FIELDS.platform.enumValues as readonly CliPlatform[], CliUsageError);
}

function readEffort(args: readonly string[], index: number): CliEffort {
  const raw = readValue(args, index, "effort");
  return readEnum<CliEffort>("--effort", raw, FIELDS.effort.enumValues as readonly CliEffort[], CliUsageError);
}

function readProvider(value: string): CliProvider {
  return readEnum<CliProvider>("--provider", value, FIELDS.provider.enumValues as readonly CliProvider[], CliUsageError);
}
