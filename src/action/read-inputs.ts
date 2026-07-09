import { FIELDS } from "../config/field-schema.js";
import { parseStrictInt } from "../util/cli-args.js";

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
  readonly minimumSeverity: "low" | "medium" | "high";
  readonly maxComments: number;
  readonly reviewFileLimit: number;
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
  readonly effort: "low" | "medium" | "high";
  readonly provider: "openai-compatible" | "copilot" | "anthropic";
  readonly githubApiBase: string;
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
    // Trim before parsing so GitHub Actions INPUT_* values that
    // arrive with leading/trailing whitespace still parse. The strict
    // helper itself rejects whitespace-padded values by design (CLI
    // flags rarely carry accidental padding), but the env-var
    // surface is friendlier with a trim.
    const parsed = parseStrictInt(raw.trim());
    return parsed ?? fallback;
  };
  // Enum readers driven by FIELDS so adding a value to `enumValues` in
  // the schema doesn't require updating this file. The literal union
  // cast is safe because `enumValues` is the canonical set.
  const readEnumFromInput = <T extends string>(
    inputName: string,
    fallback: T,
    accepted: readonly T[],
  ): T => {
    const raw = get(inputName);
    for (const candidate of accepted) {
      if (raw === candidate) return candidate;
    }
    return fallback;
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
    // Numeric defaults sourced from FIELDS.<x>.defaultValue so the
    // schema stays the single source of truth — adding a new integer
    // field doesn't require editing this file.
    reviewTimeoutSeconds: getNumber("review-timeout-seconds", FIELDS.reviewTimeoutSeconds.defaultValue as number),
    stallSeconds: getNumber("stall-seconds", FIELDS.stallSeconds.defaultValue as number),
    maxOutputTokens: getNumber("max-output-tokens", FIELDS.maxOutputTokens.defaultValue as number),
    minimumSeverity: readEnumFromInput(
      "minimum-severity",
      FIELDS.minimumSeverity.defaultValue as "low" | "medium" | "high",
      FIELDS.minimumSeverity.enumValues as readonly ("low" | "medium" | "high")[],
    ),
    maxComments: getNumber("max-comments", FIELDS.maxComments.defaultValue as number),
    reviewFileLimit: getNumber("review-file-limit", FIELDS.reviewFileLimit.defaultValue as number),
    includeSonarqube: getBool("include-sonarqube", false),
    sonarHostUrl: get("sonar-host-url"),
    sonarToken: get("sonar-token"),
    sonarProjectKey: get("sonar-project-key"),
    sonarTimeoutSeconds: getNumber("sonar-timeout-seconds", FIELDS.sonarTimeoutSeconds.defaultValue as number),
    detectLeaks: getBool("detect-leaks", true),
    platform: readEnumFromInput(
      "platform",
      FIELDS.platform.defaultValue as "auto" | "github" | "azure",
      FIELDS.platform.enumValues as readonly ("auto" | "github" | "azure")[],
    ),
    prNumber: get("pr-number"),
    repo: get("repo"),
    inGitHubActions,
    effort: readEnumFromInput(
      "effort",
      FIELDS.effort.defaultValue as "low" | "medium" | "high",
      FIELDS.effort.enumValues as readonly ("low" | "medium" | "high")[],
    ),
    provider: readEnumFromInput(
      "provider",
      FIELDS.provider.defaultValue as "openai-compatible" | "copilot" | "anthropic",
      FIELDS.provider.enumValues as readonly ("openai-compatible" | "copilot" | "anthropic")[],
    ),
    githubApiBase: getWithFallback("github-api-base", ["UMACTUALLY_GITHUB_API_BASE"]),
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
