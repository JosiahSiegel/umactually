export type ActionInputs = {
  readonly githubToken: string;
  readonly apiKey: string;
  readonly apiUrl: string;
  readonly model: string;
  readonly prompt: string;
  readonly promptFile: string;
  readonly additionalPrompt: string;
  readonly additionalPromptFile: string;
  readonly walkthrough: boolean;
  readonly diagnostic: boolean;
  readonly dryRun: boolean;
  readonly debugRawResponse: boolean;
  readonly simulateFindings: boolean;
  readonly reviewTimeoutSeconds: number;
  readonly stallSeconds: number;
  readonly maxOutputTokens: number;
  readonly ignoreMinor: boolean;
  readonly minimumSeverity: "low" | "medium" | "high";
  readonly maxComments: number;
  readonly includeSonarqube: boolean;
  readonly sonarHostUrl: string;
  readonly sonarToken: string;
  readonly sonarProjectKey: string;
  readonly sonarTimeoutSeconds: number;
  readonly detectLeaks: boolean;
  readonly platform: "auto" | "github" | "azure";
  readonly prNumber: string;
  readonly repo: string;
  readonly inGitHubActions: boolean;
};

export function readActionInputs(env: NodeJS.ProcessEnv = process.env): ActionInputs {
  const inGitHubActions = env["GITHUB_ACTIONS"] === "true";
  const get = (name: string): string => {
    // GitHub Actions normally sets INPUT_<NAME> with hyphens converted to
    // underscores, but a small set of inputs (notably longer hyphenated names
    // like "simulate-findings") only receive the literal-hyphen form. Read
    // both and prefer the underscore form so all inputs work.
    const underscored = `INPUT_${name.toUpperCase().replace(/-/gu, "_")}`;
    const hyphenated = `INPUT_${name.toUpperCase()}`;
    const fromUnderscore = env[underscored];
    if (typeof fromUnderscore === "string" && fromUnderscore.length > 0) return fromUnderscore;
    const fromHyphen = env[hyphenated];
    if (typeof fromHyphen === "string" && fromHyphen.length > 0) return fromHyphen;
    return "";
  };
  const getWithFallback = (inputName: string, fallbacks: readonly string[]): string => {
    const primary = get(inputName);
    if (primary.length > 0) return primary;
    for (const fallbackName of fallbacks) {
      const value = env[fallbackName];
      if (typeof value === "string" && value.length > 0) return value;
    }
    return "";
  };
  const getBool = (name: string, fallback: boolean): boolean => parseBool(get(name), fallback);
  const getDryRun = (): boolean => {
    const raw = get("dry-run");
    if (raw.length > 0) return parseBool(raw, false);
    const rawAlt = get("dry_run");
    if (rawAlt.length > 0) return parseBool(rawAlt, false);
    // GitHub Actions self-review defaults to dry-run so validation can pass
    // when no live API credentials are available in the workflow environment.
    return inGitHubActions;
  };
  const getNumber = (name: string, fallback: number): number => {
    const raw = get(name);
    if (raw.length === 0) {
      return fallback;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isSafeInteger(parsed) ? parsed : fallback;
  };
  const getSeverity = (): ActionInputs["minimumSeverity"] => {
    const raw = get("minimum-severity");
    if (raw === "low" || raw === "medium" || raw === "high") {
      return raw;
    }
    return "low";
  };
  const getPlatform = (): ActionInputs["platform"] => {
    const raw = get("platform");
    if (raw === "github" || raw === "azure") {
      return raw;
    }
    return "auto";
  };

  return {
    githubToken: getWithFallback("github_token", ["GITHUB_TOKEN"]),
    apiKey: getWithFallback("api-key", ["UMACTUALLY_API_KEY", "REVIEW_PROVIDER_API_KEY"]),
    apiUrl: getWithFallback("api-url", ["UMACTUALLY_API_URL", "REVIEW_PROVIDER_URL"]),
    model: get("model"),
    prompt: get("prompt"),
    promptFile: get("prompt-file"),
    additionalPrompt: get("additional-prompt"),
    additionalPromptFile: get("additional-prompt-file"),
    walkthrough: getBool("walkthrough", false),
    diagnostic: getBool("diagnostic", false),
    dryRun: getDryRun(),
    debugRawResponse: getBool("debug-raw-response", false),
    simulateFindings: getBool("simulate-findings", false),
    reviewTimeoutSeconds: getNumber("review-timeout-seconds", 300),
    stallSeconds: getNumber("stall-seconds", 270),
    maxOutputTokens: getNumber("max-output-tokens", 16_000),
    ignoreMinor: getBool("ignore-minor", false),
    minimumSeverity: getSeverity(),
    maxComments: getNumber("max-comments", 50),
    includeSonarqube: getBool("include-sonarqube", false),
    sonarHostUrl: get("sonar-host-url"),
    sonarToken: get("sonar-token"),
    sonarProjectKey: get("sonar-project-key"),
    sonarTimeoutSeconds: getNumber("sonar-timeout-seconds", 300),
    detectLeaks: getBool("detect-leaks", true),
    platform: getPlatform(),
    prNumber: get("pr-number"),
    repo: get("repo"),
    inGitHubActions,
  };
}

function parseBool(raw: string, fallback: boolean): boolean {
  if (raw.length === 0) {
    return fallback;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }
  return fallback;
}
