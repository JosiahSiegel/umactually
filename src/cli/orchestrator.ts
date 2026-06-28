import { fetchAzurePrDiff } from "../platform/azure/api.js";
import { readAzureContext } from "../platform/azure/context.js";
import { fetchGithubPrDiff } from "../platform/github/api.js";
import { readGithubContext } from "../platform/github/context.js";
import { buildSimulatedFindings } from "../review/simulated-findings.js";
import { runAzureLive } from "./live-azure.js";
import { runGithubLive } from "./live-github.js";
import {
  isStructurallyEmptyReview,
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
 * calls the live provider, and — when `simulateFindings` is true and the
 * provider returned a structurally empty payload — replaces the payload with
 * the deterministic fixture in `src/review/simulated-findings.ts`. The
 * replacement is a no-op when the live provider already returned real findings.
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
 * Replaces the provider outcome's payload with the deterministic fixture when
 * `simulateFindings` is true AND the live provider returned an empty result.
 * Live findings always win: a non-empty result is returned unchanged.
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
  if (!isStructurallyEmptyReview(input.outcome.review)) {
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
    ...input.outcome,
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
