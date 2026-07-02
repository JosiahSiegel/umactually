import { InvalidConfigError } from "./errors.js";
import {
  parseBooleanFromUnknown,
  parseIntegerFromUnknown,
  parsePlatformFromUnknown,
  parseSeverityFromUnknown,
} from "./parsers.js";
import { normalizeApiUrl } from "./parsers.js";
import { readPromptFiles } from "./prompt-files.js";
import type {
  ActionInputs,
  AzureConfig,
  CliArgs,
  EnvSources,
  GuidanceFlags,
  LoadConfigSources,
  Platform,
  PromptConfig,
  ProviderConfig,
  ReviewConfig,
  ReviewScopeControls,
  Severity,
  SeverityControls,
  SonarConfig,
  TimeoutControls,
} from "./types.js";

export const DEFAULT_MAX_COMMENTS = 50;
export const DEFAULT_REVIEW_FILE_LIMIT = 200;
const DEFAULT_REVIEW_SECONDS = 300;
const DEFAULT_STALL_SECONDS = 270;
const DEFAULT_PER_REQUEST_SECONDS = 60;
const DEFAULT_SONAR_TIMEOUT_SECONDS = 60;
const DEFAULT_MINIMUM_SEVERITY: Severity = "minor";
const DEFAULT_PLATFORM: Platform = "auto";
const DEFAULT_PROVIDER_URL = "https://api.openai.com/v1";
const DEFAULT_PROVIDER_MODEL = "auto";
const DEFAULT_PROMPT_BYTE_CAP = 64 * 1024;

/**
 * Resolves the final ReviewConfig by merging CLI > inputs > env > defaults.
 * `cwd` is used to resolve prompt file paths (workspace-relative).
 */
export async function loadConfigFromSources(sources: LoadConfigSources): Promise<ReviewConfig> {
  const { cli, inputs, env, cwd } = sources;

  const provider: ProviderConfig = {
    url: normalizeApiUrl(
      pickString(cli.providerUrl, inputs.providerUrl, env.providerUrl, DEFAULT_PROVIDER_URL, "provider.url"),
      "provider.url",
    ),
    apiKey: pickString(cli.providerApiKey, inputs.providerApiKey, env.providerApiKey, "", "provider.apiKey"),
    model: pickString(cli.providerModel, inputs.providerModel, env.providerModel, DEFAULT_PROVIDER_MODEL, "provider.model"),
  };

  const guidance: GuidanceFlags = {
    walkthrough: pickBool(cli.walkthrough, inputs.walkthrough, env.walkthrough, false, "guidance.walkthrough"),
    diagnostic: pickBool(cli.diagnostic, inputs.diagnostic, env.diagnostic, false, "guidance.diagnostic"),
    dryRun: pickBool(cli.dryRun, inputs.dryRun, env.dryRun, false, "guidance.dryRun"),
    debugRawResponse: pickBool(
      cli.debugRawResponse,
      inputs.debugRawResponse,
      env.debugRawResponse,
      false,
      "guidance.debugRawResponse",
    ),
  };

  const timeouts: TimeoutControls = {
    reviewSeconds: pickInt(
      cli.reviewTimeoutSeconds,
      inputs.reviewTimeoutSeconds,
      env.reviewTimeoutSeconds,
      DEFAULT_REVIEW_SECONDS,
      "timeouts.reviewSeconds",
    ),
    stallSeconds: pickInt(
      cli.stallTimeoutSeconds,
      inputs.stallTimeoutSeconds,
      env.stallTimeoutSeconds,
      DEFAULT_STALL_SECONDS,
      "timeouts.stallSeconds",
    ),
    perRequestSeconds: pickInt(
      cli.perRequestTimeoutSeconds,
      inputs.perRequestTimeoutSeconds,
      env.perRequestTimeoutSeconds,
      DEFAULT_PER_REQUEST_SECONDS,
      "timeouts.perRequestSeconds",
    ),
  };

  const ignoreMinor = pickBool(cli.ignoreMinor, inputs.ignoreMinor, env.ignoreMinor, false, "severity.ignoreMinor");
  const minimumRaw = pickRawString(cli.minimumSeverity, inputs.minimumSeverity, env.minimumSeverity);
  const minimum: Severity = minimumRaw === undefined
    ? DEFAULT_MINIMUM_SEVERITY
    : parseSeverityFromUnknown(minimumRaw, "severity.minimum");
  const severity: SeverityControls = {
    ignoreMinor,
    minimum,
    maxComments: pickInt(cli.maxComments, inputs.maxComments, env.maxComments, DEFAULT_MAX_COMMENTS, "severity.maxComments"),
  };

  const scope: ReviewScopeControls = {
    reviewFileLimit: pickInt(
      cli.reviewFileLimit,
      inputs.reviewFileLimit,
      env.reviewFileLimit,
      DEFAULT_REVIEW_FILE_LIMIT,
      "scope.reviewFileLimit",
    ),
  };

  const sonar: SonarConfig = {
    enabled: pickBool(cli.sonarEnabled, inputs.sonarEnabled, env.sonarEnabled, false, "sonar.enabled"),
    host: pickString(cli.sonarHost, inputs.sonarHost, env.sonarHost, "", "sonar.host"),
    token: pickString(cli.sonarToken, inputs.sonarToken, env.sonarToken, "", "sonar.token"),
    project: pickString(cli.sonarProject, inputs.sonarProject, env.sonarProject, "", "sonar.project"),
    timeoutSeconds: pickInt(
      cli.sonarTimeoutSeconds,
      inputs.sonarTimeoutSeconds,
      env.sonarTimeoutSeconds,
      DEFAULT_SONAR_TIMEOUT_SECONDS,
      "sonar.timeoutSeconds",
    ),
  };

  const leakDetection = pickBool(cli.leakDetection, inputs.leakDetection, env.leakDetection, true, "leakDetection");
  const redactorEnabled = pickBool(cli.redactorEnabled, inputs.redactorEnabled, env.redactorEnabled, true, "redactor.enabled");

  const platformRaw = pickRawString(cli.platform, inputs.platform, env.platform);
  const platform: Platform = platformRaw === undefined ? DEFAULT_PLATFORM : parsePlatformFromUnknown(platformRaw, "platform");

  const githubToken = pickString(cli.githubToken, inputs.githubToken, env.githubToken, "", "githubToken");

  const azure: AzureConfig = {
    org: pickString(cli.azureOrg, inputs.azureOrg, env.azureOrg, "", "azure.org"),
    project: pickString(cli.azureProject, inputs.azureProject, env.azureProject, "", "azure.project"),
    repo: pickString(cli.azureRepo, inputs.azureRepo, env.azureRepo, "", "azure.repo"),
    pullRequestId: pickInt(
      cli.azurePullRequestId,
      inputs.azurePullRequestId,
      env.azurePullRequestId,
      0,
      "azure.pullRequestId",
    ),
    token: pickString(cli.azureToken, inputs.azureToken, env.azureToken, "", "azure.token"),
  };

  const promptByteCap = pickInt(
    cli.promptByteCap,
    inputs.promptByteCap,
    env.promptByteCap,
    DEFAULT_PROMPT_BYTE_CAP,
    "prompts.byteCap",
  );

  const prompts = await resolvePrompts(cli, inputs, env, cwd, promptByteCap);

  return {
    provider,
    prompts,
    guidance,
    timeouts,
    severity,
    scope,
    sonar,
    leakDetection,
    redactorEnabled,
    platform,
    githubToken,
    azure,
  };
}

async function resolvePrompts(
  cli: CliArgs,
  inputs: ActionInputs,
  env: EnvSources,
  cwd: string,
  byteCap: number,
): Promise<PromptConfig> {
  const systemInline = pickString(cli.promptSystem, inputs.promptSystem, undefined, "", "prompts.system.inline");
  const systemFiles = collectFiles(cli.promptSystemFile, inputs.promptSystemFile, env.promptSystemFile);
  const userInline = pickString(cli.promptUser, inputs.promptUser, undefined, "", "prompts.user.inline");
  const userFiles = collectFiles(cli.promptUserFile, inputs.promptUserFile, env.promptUserFile);

  let system = "";
  if (systemInline.length > 0) {
    system = systemInline;
  } else if (systemFiles.length > 0) {
    system = await readPromptFiles(systemFiles, byteCap, { cwd });
  }

  let user = "";
  if (userInline.length > 0) {
    user = userInline;
  } else if (userFiles.length > 0) {
    user = await readPromptFiles(userFiles, byteCap, { cwd });
  }

  return {
    system,
    user,
    systemFiles,
    userFiles,
  };
}

function collectFiles(cliValue: string | undefined, inputValue: string | undefined, envValue: string | undefined): readonly string[] {
  const out: string[] = [];
  if (typeof cliValue === "string" && cliValue.length > 0) out.push(cliValue);
  if (typeof inputValue === "string" && inputValue.length > 0 && !out.includes(inputValue)) out.push(inputValue);
  if (typeof envValue === "string" && envValue.length > 0 && !out.includes(envValue)) out.push(envValue);
  return out;
}

function pickString(
  cliValue: string | undefined,
  inputValue: string | undefined,
  envValue: string | undefined,
  fallback: string,
  field: string,
): string {
  const value = firstDefined<string>(cliValue, inputValue, envValue);
  if (value === undefined) return fallback;
  if (typeof value !== "string") {
    throw new InvalidConfigError(field, `expected string, received ${typeof value}`);
  }
  return value;
}

function pickRawString(
  cliValue: string | undefined,
  inputValue: unknown,
  envValue: string | undefined,
): string | undefined {
  if (typeof cliValue === "string" && cliValue.trim().length > 0) return cliValue;
  if (typeof inputValue === "string" && inputValue.trim().length > 0) return inputValue;
  if (typeof envValue === "string" && envValue.trim().length > 0) return envValue;
  return undefined;
}

function pickInt(
  cliValue: number | undefined,
  inputValue: number | string | undefined,
  envValue: number | string | undefined,
  fallback: number,
  field: string,
): number {
  if (cliValue !== undefined) return parseIntegerFromUnknown(cliValue, field);
  if (inputValue !== undefined) return parseIntegerFromUnknown(inputValue, field);
  if (envValue !== undefined) return parseIntegerFromUnknown(envValue, field);
  return fallback;
}

function pickBool(
  cliValue: boolean | undefined,
  inputValue: boolean | string | undefined,
  envValue: string | undefined,
  fallback: boolean,
  field: string,
): boolean {
  if (cliValue !== undefined) return parseBooleanFromUnknown(cliValue, field);
  if (inputValue !== undefined) return parseBooleanFromUnknown(inputValue, field);
  if (envValue !== undefined) return parseBooleanFromUnknown(envValue, field);
  return fallback;
}

function firstDefined<T>(...values: readonly (T | undefined)[]): T | undefined {
  for (const v of values) {
    if (v !== undefined) return v;
  }
  return undefined;
}