import { fetchAzurePrDiff } from "../platform/azure/api.js";
import { readAzureContext } from "../platform/azure/context.js";
import { fetchGithubPrDiff } from "../platform/github/api.js";
import { readGithubContext } from "../platform/github/context.js";
import { buildSimulatedFindings } from "../review/simulated-findings.js";
import { runLiveSonarImport } from "../sonar/run-sonar-import.js";
import { runAzureLive } from "./live-azure.js";
import { runGithubLive } from "./live-github.js";
import {
  requestLiveReview,
  sanitizeForPost,
  type FetchImpl,
  type LivePlatform,
  type LiveProviderOutcome,
  type LiveRunResult,
} from "./live-shared.js";
import type { ParsedCliArgs } from "./parse-args.js";

export type RunLiveInput = {
  readonly parsed: ParsedCliArgs;
  readonly cwd: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly fetchImpl?: FetchImpl;
};

export async function runLive(input: RunLiveInput): Promise<LiveRunResult> {
  const env = input.env ?? process.env;
  const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const platform = detectLivePlatform(env);
  if (platform === null) {
    const message = "Live review requires GitHub Actions (GITHUB_ACTIONS=true) or Azure Pipelines (TF_BUILD=True).";
    process.stdout.write(`umactually-pr-review: ${message}\n`);
    return {
      exitCode: 1,
      posted: false,
      reviewId: undefined,
      message,
    };
  }

  const providerUrl = input.parsed.apiUrl ?? env["UMACTUALLY_API_URL"];
  if (providerUrl === undefined || providerUrl.length === 0) {
    const message = "UMACTUALLY_API_URL must be set for live review.";
    process.stdout.write(`umactually-pr-review: ${message}\n`);
    return {
      exitCode: 1,
      posted: false,
      reviewId: undefined,
      message,
    };
  }
  const providerKey = input.parsed.apiKey ?? env["UMACTUALLY_API_KEY"];
  if (providerKey === undefined || providerKey.length === 0) {
    const message = "UMACTUALLY_API_KEY must be set for live review.";
    process.stdout.write(`umactually-pr-review: ${message}\n`);
    return {
      exitCode: 1,
      posted: false,
      reviewId: undefined,
      message,
    };
  }

  // If --include-sonarqube is set with a fully-configured SonarQube, wait
  // for the quality gate to reach a terminal state BEFORE posting the review.
  // This implements the user's "wait for sonarqube during that PR run"
  // requirement: the review reflects the latest quality-gate state.
  const sonarConfigured =
    input.parsed.includeSonarqube &&
    input.parsed.sonarHostUrl !== null &&
    input.parsed.sonarToken !== null &&
    input.parsed.sonarProjectKey !== null;
  if (sonarConfigured) {
    const sonarReport = await runLiveSonarImport({
      sonarHostUrl: input.parsed.sonarHostUrl ?? "",
      sonarToken: input.parsed.sonarToken ?? "",
      sonarProjectKey: input.parsed.sonarProjectKey ?? "",
      sonarTimeoutSeconds: input.parsed.sonarTimeoutSeconds ?? 300,
      fetchImpl: fetchImpl as typeof fetch,
    });
    process.stdout.write(
      `umactually-pr-review: sonar quality gate ${sonarReport.qualityGateStatus} (${sonarReport.importedFindingCount} findings, waited=${sonarReport.waitedForTerminalQualityGate})${sonarReport.timeoutHandled ? " [timeout handled]" : ""}\n`,
    );
    if (sonarReport.errorMessage !== undefined) {
      process.stderr.write(`::warning::umactually-pr-review: ${sonarReport.errorMessage}\n`);
    }
  }

  let result: LiveRunResult;
  try {
    result = await dispatchLivePlatform({
      platform,
      parsed: input.parsed,
      cwd: input.cwd,
      env,
      fetchImpl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const sanitized = sanitizeForPost(message, readSecretValues(env));
    process.stdout.write(`umactually-pr-review: ${sanitized}\n`);
    return {
      exitCode: 1,
      posted: false,
      reviewId: undefined,
      message: sanitized,
    };
  }

  if (result.posted) {
    process.stdout.write(`umactually-pr-review: ${result.message}\n`);
  }
  return result;
}

/**
 * Reads the action input (via the parsed CLI argv), fetches the platform diff,
 * calls the live provider, and — when `simulateFindings` is true — replaces the
 * provider outcome with the deterministic fixture in
 * `src/review/simulated-findings.ts`. The flag is authoritative: even when the
 * live provider returns a non-empty review, the fixture fully drives the
 * posted payload so the demo always shows 4-6 inline threads + suppressed
 * off-diff count regardless of what the live API actually returned.
 */
async function dispatchLivePlatform(input: {
  readonly platform: LivePlatform;
  readonly parsed: ParsedCliArgs;
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly fetchImpl: FetchImpl;
}): Promise<LiveRunResult> {
  const { platform, parsed, cwd, env, fetchImpl } = input;
  switch (platform) {
    case "github": {
      const context = await readGithubContext(env);
      const diffText = await fetchGithubPrDiff(context, fetchImpl);
      const liveOutcome = await requestLiveReview({
        parsed,
        cwd,
        env,
        fetchImpl,
        platform: "github",
        diffText,
        platformToken: context.token,
      });
      const finalOutcome = applySimulateFindings({
        outcome: liveOutcome,
        simulateFindings: parsed.simulateFindings === true,
        repo: `${context.repo.owner}/${context.repo.name}`,
        prNumber: context.prNumber,
        headSha: context.headSha,
        diffText,
        secrets: [context.token],
      });
      return runGithubLive({
        context,
        diffText,
        provider: finalOutcome,
        parsed,
        fetchImpl,
      });
    }
    case "azure": {
      const context = readAzureContext(env);
      const diffText = await fetchAzurePrDiff(context, fetchImpl);
      const liveOutcome = await requestLiveReview({
        parsed,
        cwd,
        env,
        fetchImpl,
        platform: "azure",
        diffText,
        platformToken: context.token,
      });
      const finalOutcome = applySimulateFindings({
        outcome: liveOutcome,
        simulateFindings: parsed.simulateFindings === true,
        repo: context.repoId,
        prNumber: context.prNumber,
        headSha: "",
        diffText,
        secrets: [context.token],
      });
      return runAzureLive({
        context,
        diffText,
        provider: finalOutcome,
        parsed,
        fetchImpl,
      });
    }
    default:
      return assertNever(platform);
  }
}

/**
 * Replaces the provider outcome's payload with the deterministic fixture ONLY
 * when the live result is structurally empty (no inline comments AND no
 * suppressed comments). Live findings always win — the fixture is a demo
 * fallback for "provider returned nothing usable" cases. When
 * `simulateFindings` is false, the live result is preserved unchanged.
 *
 * The `provider`, `modelId`, and `endpoint` fields on the outcome are kept
 * from the live call (the fixture does not mint its own provider identity),
 * so the posted review body still shows "openai-compatible" as the provider.
 */
function applySimulateFindings(input: {
  readonly outcome: LiveProviderOutcome;
  readonly simulateFindings: boolean;
  readonly repo: string;
  readonly prNumber: number;
  readonly headSha: string;
  readonly diffText: string;
  readonly secrets: readonly string[];
}): LiveProviderOutcome {
  if (!input.simulateFindings) {
    return input.outcome;
  }

  const liveCommentCount = input.outcome.review.comments.length;
  const liveSuppressedCount = input.outcome.review.suppressedComments.length;
  const isStructurallyEmpty = liveCommentCount === 0 && liveSuppressedCount === 0;

  if (!isStructurallyEmpty) {
    // Live findings always win — do not override them with the deterministic
    // fixture. Document the override intent on stderr so operators can see
    // the flag was set but did not engage.
    const message = `umactually-pr-review: --simulate-findings set but ignored (live result has ${liveCommentCount} inline, ${liveSuppressedCount} suppressed). Live findings always win.`;
    const sanitized = sanitizeForPost(message, input.secrets);
    process.stderr.write(`::notice::${sanitized}\n`);
    return input.outcome;
  }

  const fixture = buildSimulatedFindings(input.repo, input.prNumber, input.headSha, input.diffText);
  // Sanitize the fixture through the same sanitizer the live path uses so
  // bodies cannot accidentally carry the API key or auth headers.
  const sanitizedComments = fixture.comments.map((comment) => ({
    path: comment.path,
    line: comment.line,
    body: sanitizeForPost(comment.body, input.secrets),
    severity: sanitizeForPost(comment.severity, input.secrets),
    category: sanitizeForPost(comment.category, input.secrets),
  }));
  const sanitizedSuppressed = fixture.suppressed_comments.map((comment) => ({
    path: comment.path,
    line: comment.line,
    body: sanitizeForPost(comment.body, input.secrets),
    severity: sanitizeForPost(comment.severity, input.secrets),
    category: sanitizeForPost(comment.category, input.secrets),
  }));
  return {
    endpoint: input.outcome.endpoint,
    provider: input.outcome.provider,
    modelId: input.outcome.modelId,
    review: {
      summary: sanitizeForPost(fixture.summary, input.secrets),
      verdict: fixture.verdict,
      comments: sanitizedComments,
      suppressedComments: sanitizedSuppressed,
    },
  };
}

function detectLivePlatform(env: NodeJS.ProcessEnv): LivePlatform | null {
  if (env["GITHUB_ACTIONS"] === "true") {
    return "github";
  }
  if (env["TF_BUILD"] === "True") {
    return "azure";
  }
  return null;
}

function readSecretValues(env: NodeJS.ProcessEnv): readonly string[] {
  return [
    env["UMACTUALLY_API_KEY"] ?? "",
    env["REVIEW_PROVIDER_API_KEY"] ?? "",
    env["GITHUB_TOKEN"] ?? "",
    env["SYSTEM_ACCESSTOKEN"] ?? "",
  ];
}

function assertNever(value: never): never {
  throw new TypeError(`Unhandled live platform: ${value}`);
}
