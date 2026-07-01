import { fetchAzurePrDiff } from "../platform/azure/api.js";
import { readAzureContext } from "../platform/azure/context.js";
import { fetchGithubPrDiff } from "../platform/github/api.js";
import { readGithubContext } from "../platform/github/context.js";
import { runAzureLive } from "./live-azure.js";
import { runGithubLive } from "./live-github.js";
import {
  evaluateLeakGate,
  sanitizeForPost,
  type FetchImpl,
  type LivePlatform,
  type LiveRunResult,
} from "./live-shared.js";
import { requestLiveReview } from "./live-provider.js";
import { readLiveSonarContext } from "./sonar-context.js";
import { applySimulateFindings } from "./simulate-findings.js";
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

  // Copilot provider does not need UMACTUALLY_API_URL; it uses the GitHub
  // Copilot token exchange endpoint. Skip the URL check for copilot.
  const isCopilot = input.parsed.provider === "copilot";
  const providerUrl = input.parsed.apiUrl ?? env["UMACTUALLY_API_URL"];
  if (!isCopilot && (providerUrl === undefined || providerUrl.length === 0)) {
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
  const sonarContext = await readLiveSonarContext(input.parsed, fetchImpl);

  let result: LiveRunResult;
  try {
    result = await dispatchLivePlatform({
      platform,
      parsed: input.parsed,
      cwd: input.cwd,
      env,
      fetchImpl,
      ...(sonarContext !== undefined ? { sonarContext } : {}),
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
  readonly sonarContext?: string;
}): Promise<LiveRunResult> {
  const { platform, parsed, cwd, env, fetchImpl, sonarContext } = input;
  switch (platform) {
    case "github": {
      const context = await readGithubContext(env);
      const diffText = await fetchGithubPrDiff(context, fetchImpl);
      const leakGate = await evaluateLeakGate({
        diffText,
        detectLeaks: parsed.detectLeaks,
      });
      if (!leakGate.ok) {
        process.stderr.write(`::error::umactually-pr-review: ${leakGate.message}\n`);
        return {
          exitCode: 1,
          posted: false,
          reviewId: undefined,
          message: leakGate.message,
        };
      }
      const liveOutcome = await requestLiveReview({
        parsed,
        cwd,
        env,
        fetchImpl,
        platform: "github",
        diffText,
        platformToken: context.token,
        ...(sonarContext !== undefined ? { sonarContext } : {}),
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
      const leakGate = await evaluateLeakGate({
        diffText,
        detectLeaks: parsed.detectLeaks,
      });
      if (!leakGate.ok) {
        process.stderr.write(`::error::umactually-pr-review: ${leakGate.message}\n`);
        return {
          exitCode: 1,
          posted: false,
          reviewId: undefined,
          message: leakGate.message,
        };
      }
      const liveOutcome = await requestLiveReview({
        parsed,
        cwd,
        env,
        fetchImpl,
        platform: "azure",
        diffText,
        platformToken: context.token,
        ...(sonarContext !== undefined ? { sonarContext } : {}),
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
    env["AZURE_DEVOPS_TOKEN"] ?? "",
  ];
}

function assertNever(value: never): never {
  throw new TypeError(`Unhandled live platform: ${value}`);
}
