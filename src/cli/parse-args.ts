export type CliPlatform = "auto" | "github" | "azure";

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
  readonly includeSonarqube: boolean;
  readonly sonarHostUrl: string | null;
  readonly sonarToken: string | null;
  readonly sonarProjectKey: string | null;
  readonly ignoreMinor: boolean;
  readonly detectLeaks: boolean;
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
  let includeSonarqube = false;
  let sonarHostUrl: string | null = null;
  let sonarToken: string | null = null;
  let sonarProjectKey: string | null = null;
  let ignoreMinor = false;
  let detectLeaks = true;
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
      case "--include-sonarqube":
        includeSonarqube = true;
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
      case "--ignore-minor":
        ignoreMinor = true;
        break;
      case "--detect-leaks":
        detectLeaks = true;
        break;
      case "--no-detect-leaks":
        detectLeaks = false;
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
    includeSonarqube,
    sonarHostUrl,
    sonarToken,
    sonarProjectKey,
    ignoreMinor,
    detectLeaks,
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

function readPlatform(value: string): CliPlatform {
  switch (value) {
    case "auto":
    case "github":
      return value;
    case "azure":
    case "azure-devops":
      return "azure";
    default:
      throw new CliUsageError(`invalid --platform value: ${value}`);
  }
}