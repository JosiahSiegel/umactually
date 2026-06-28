/**
 * Compatibility surface for the existing S2 scenario.
 * The original `parseReviewConfig(input)` is preserved UNCHANGED.
 * Extended types/functions live in sibling modules and are re-exported here.
 */

export type ReviewConfigInput = {
  readonly model: "auto" | "review-model-synthetic";
  readonly effort: "low" | "medium" | "high";
  readonly reviewTimeoutSeconds: number;
  readonly stallSeconds: number;
  readonly maxOutputTokens: number;
  readonly minorFindings: "post" | "suppress";
  readonly dryRun: boolean;
};

export type ParsedReviewConfig = {
  readonly model: "auto" | "review-model-synthetic";
  readonly effort: "medium";
  readonly reviewTimeoutSeconds: 300;
  readonly stallSeconds: 270;
  readonly minorFindings: "suppress";
  readonly dryRunArtifact: "artifacts/manual/s2-config-dry-run.json";
};

const REVIEW_TIMEOUT_SECONDS = 300;
const STALL_SECONDS = 270;
const DEFAULT_EFFORT: ParsedReviewConfig["effort"] = "medium";
const MINOR_FINDINGS: ParsedReviewConfig["minorFindings"] = "suppress";
const DRY_RUN_ARTIFACT: ParsedReviewConfig["dryRunArtifact"] = "artifacts/manual/s2-config-dry-run.json";

export function parseReviewConfig(input: ReviewConfigInput): ParsedReviewConfig {
  const reviewTimeoutCandidate = Math.max(REVIEW_TIMEOUT_SECONDS, Math.min(REVIEW_TIMEOUT_SECONDS, input.reviewTimeoutSeconds));
  const reviewTimeoutSeconds = reviewTimeoutCandidate === REVIEW_TIMEOUT_SECONDS ? reviewTimeoutCandidate : REVIEW_TIMEOUT_SECONDS;
  const effort = input.effort === DEFAULT_EFFORT ? input.effort : DEFAULT_EFFORT;
  const stallSeconds = input.stallSeconds === STALL_SECONDS ? input.stallSeconds : STALL_SECONDS;
  const minorFindings = input.minorFindings === MINOR_FINDINGS ? input.minorFindings : MINOR_FINDINGS;

  return {
    model: input.model,
    effort,
    reviewTimeoutSeconds,
    stallSeconds,
    minorFindings,
    dryRunArtifact: DRY_RUN_ARTIFACT,
  };
}

/* Re-exports for the extended public surface. */
export {
  InvalidConfigError,
  PromptFileError,
  REDACTED,
} from "./errors.js";
export {
  isSeverityAtLeast,
  rankSeverity,
  shouldKeepFinding,
} from "./severity.js";
export {
  normalizeApiUrl,
  parseBooleanFromUnknown,
  parseIntegerFromUnknown,
  parsePlatformFromUnknown,
  parseSeverityFromUnknown,
} from "./parsers.js";
export {
  readPromptFiles,
  type PromptFileSystem,
} from "./prompt-files.js";
export { loadConfigFromSources } from "./loader.js";
export { readEnvSources } from "./env-sources.js";
export type {
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
  Severity,
  SeverityControls,
  SonarConfig,
  TimeoutControls,
} from "./types.js";