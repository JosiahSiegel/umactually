import { FIELDS } from "../config/field-schema.js";
import { didYouMean, parseStrictInt, readEnum } from "../util/cli-args.js";
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
export type CliProvider = "openai-compatible" | "copilot" | "anthropic";

const explicitFieldsByParse = new WeakMap<ParsedCliArgs, ReadonlySet<string>>();

const FIELD_BY_FLAG: ReadonlyMap<string, string> = new Map(
  Object.values(FIELDS).flatMap((field) =>
    field.flag === null ? [] : [[field.flag, field.field] as const]
  ),
);

export function wasCliFieldExplicitlySet(
  parsed: ParsedCliArgs,
  field: string,
): boolean {
  return explicitFieldsByParse.get(parsed)?.has(field) === true;
}

export type ParsedCliArgs = {
  readonly platform: CliPlatform;
  readonly eventPath: string | null;
  readonly diffPath: string | null;
  readonly files: string | null;
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
  /**
   * When true (the default), send `response_format: { type: "json_schema", strict: true }`
   * on the wire so the provider enforces the review schema at decode time.
   * Set to false via `--no-strict-schema` for providers that reject the
   * strict-schema payload (older Copilot routes, certain self-hosted
   * OpenAI-compatible servers). The in-context system prompt still
   * documents the schema, so omitting the wire constraint degrades to
   * "shape guide only" — the post-filter still catches semantic errors.
   */
  readonly strictSchema: boolean;
  /**
   * When true, the deterministic `verifyFindingsAgainstDiff` filter
   * runs an extra time on the model's `comments[]` before they're
   * passed to the inline-posting step. This is on by default and
   * matches the Layer 4 + Layer 3 contracts: any off-diff citation
   * is dropped, regardless of how it survived the previous filters.
   * Set to false via `--no-verify-findings` only if the caller has
   * their own out-of-band validation (rare).
   */
  readonly verifyFindings: boolean;
};

export class CliUsageError extends Error {
  override readonly name = "CliUsageError";

  constructor(message: string, readonly hint?: string) {
    super(message);
    // Mirror the LiveReviewError pattern: hint is a separate property
    // so message-based tests stay byte-identical and machine consumers
    // (JSON envelopes, log scrapers) can ignore the remediation text.
  }
}

export function parseCliArgs(args: readonly string[]): ParsedCliArgs {
  const explicitlySet = new Set<string>();
  let platform: CliPlatform = "auto";
  let eventPath: string | null = null;
  let diffPath: string | null = null;
  let files: string | null = null;
  let threadsPath: string | null = null;
  let reviewPath: string | null = null;
  let prNumber: string | null = null;
  let repo: string | null = null;
  let apiUrl: string | null = null;
  let apiKey: string | null = null;
  let model: string | null = null;
  let promptFile: string | null = null;
  let promptFiles: string | null = null;
  let additionalPromptFile: string | null = null;
  let additionalPromptFiles: string | null = null;
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
  // Layer 2-C: default ON so the wire-format JSON-schema constraint
  // fires by default. Operators on providers that reject the strict-
  // schema payload can opt out via --no-strict-schema.
  let strictSchema = true;
  // Layer 4: default ON so the deterministic verifyFindingsAgainstDiff
  // re-runs the (path, line) filter on the model's comments[] before
  // posting. The filter is the same one the post-filter uses; running
  // it explicitly is defense-in-depth (the parse-warnings artifact
  // would also catch the same off-diff citations, but this drops
  // them from the postable set before they even reach the platform).
  let verifyFindings = true;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === undefined) {
      continue;
    }
    const positiveFlag = token.startsWith("--no-")
      ? `--${token.slice("--no-".length)}`
      : token;
    const explicitField = FIELD_BY_FLAG.get(positiveFlag);
    if (explicitField !== undefined) {
      explicitlySet.add(explicitField);
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
      case "--files":
        files = readValue(args, index, "files");
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
      case "--prompt-files":
        promptFiles = readValue(args, index, "prompt-files");
        index += 1;
        break;
      case "--additional-prompt-file":
        additionalPromptFile = readValue(args, index, "additional-prompt-file");
        index += 1;
        break;
      case "--additional-prompt-files":
        additionalPromptFiles = readValue(args, index, "additional-prompt-files");
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
        throw new CliUsageError(
          "--ignore-minor was removed; use --minimum-severity medium (or low/high) to suppress minor findings. Leaks and security findings are never suppressed. Environment variables UMACTUALLY_IGNORE_MINOR and REVIEW_IGNORE_MINOR are also ignored.",
          "Run `umactually review --minimum-severity low` (or `medium`, `high`) to suppress minor findings instead of `--ignore-minor`. The legacy flag and its env-var aliases (`UMACTUALLY_IGNORE_MINOR`, `REVIEW_IGNORE_MINOR`) are intentionally ignored so CI does not silently change severity.",
        );
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
      case "--strict-schema":
        strictSchema = true;
        break;
      case "--no-strict-schema":
        strictSchema = false;
        break;
      case "--verify-findings":
        verifyFindings = true;
        break;
      case "--no-verify-findings":
        verifyFindings = false;
        break;
      case "--help":
      case "-h": {
        // Derive the command context from non-flag tokens seen so far
        // so CliHelpSignal carries the right subcommand for contextual
        // help rendering.
        const commandToken = args.slice(0, index).find((t) => !t.startsWith("-"));
        throw new CliHelpSignal(commandToken ?? null);
      }
      default:
        throw unknownFlagUsageError(token, args);
    }
  }

  const parsed: ParsedCliArgs = {
    platform,
    eventPath,
    diffPath,
    files,
    threadsPath,
    reviewPath,
    prNumber,
    repo,
    apiUrl,
    apiKey,
    model,
    promptFile,
    promptFiles,
    additionalPromptFile,
    additionalPromptFiles,
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
    strictSchema,
    verifyFindings,
  };
  explicitFieldsByParse.set(parsed, explicitlySet);
  return parsed;
}

export class CliHelpSignal extends Error {
  override readonly name = "CliHelpSignal";
  /**
   * The subcommand that triggered the help signal, if any.
   * When `--help` appears in a `review` / `doctor` / etc. argv list,
   * this carries the subcommand name so the help printer can render
   * context-specific help text.
   */
  readonly command: string | null;
  constructor(command: string | null = null) {
    super();
    this.command = command;
  }
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
    throw new CliUsageError(
      `flag --${flag} requires a value`,
      `Supply the value immediately after --${flag}, e.g. \`umactually review --${flag} <value>\`. Run \`umactually review --help\` to see the expected shape for --${flag}.`,
    );
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
    throw new CliUsageError(
      `flag --${flag} requires an integer value (got "${raw}")`,
      `Pass a decimal integer with no sign or whitespace, e.g. \`--${flag} 60\`. Fractions, exponents, and decimal points are not accepted. Use \`umactually review --help\` for the units and bounds.`,
    );
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

/**
 * Build a `CliUsageError` for an unknown flag token, including a
 * "did you mean ...?" suggestion when one is close enough to be
 * plausible. The candidate set is the canonical flag list pulled from
 * the field schema; values from any field whose `flag` is non-null.
 *
 * Always includes a remediation hint pointing the operator at
 * `--help` (so they can list every accepted flag) and at the
 * modes banner (for the bare-invocation case where the user simply
 * forgot to supply the provider flags).
 */
function unknownFlagUsageError(token: string, argv: readonly string[]): CliUsageError {
  const candidates = [...FIELD_BY_FLAG.keys()];
  const suggestion = didYouMean(token, candidates);
  let message = `unknown flag: ${token}`;
  if (suggestion !== null && suggestion !== token) {
    message += ` (did you mean \`${suggestion}\`?)`;
  }
  // If the operator is running with no positional command AND no
  // provider flags AND the unknown token isn't itself a known flag,
  // the modes banner is the actionable next step.
  const sawPositionalCommand = argv.slice(0, argv.indexOf(token)).some((t) => !t.startsWith("-"));
  const hint = suggestion !== null && suggestion !== token
    ? `Try \`${suggestion}\`. To see every flag and what it does, run \`umactually review --help\`. If you meant to provide the review API config, run \`umactually review --api-url <url> --api-key <key>\`.`
    : sawPositionalCommand
      ? `Run \`umactually review --help\` for every flag the \`review\` subcommand accepts.`
      : `Run \`umactually --help\` for a flag list, or \`umactually review --api-url <url> --api-key <key>\` for the standard standalone invocation.`;
  return new CliUsageError(message, hint);
}
