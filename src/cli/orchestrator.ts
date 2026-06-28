import { readAzureContext } from "../platform/azure/context.js";
import { readGithubContext } from "../platform/github/context.js";
import { runAzureLive } from "./live-azure.js";
import { runGithubLive } from "./live-github.js";
import { sanitizeForPost, type FetchImpl, type LiveRunResult, type LiveRuntimeConfig } from "./live-shared.js";
import type { ParsedCliArgs } from "./parse-args.js";

export type RunLiveInput = {
  readonly parsed: ParsedCliArgs;
  readonly cwd: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly fetchImpl?: FetchImpl;
};

export async function runLive(input: RunLiveInput): Promise<LiveRunResult> {
  const env = input.env ?? process.env;
  process.stdout.write(`DEBUG env GITHUB_TOKEN=${env["GITHUB_TOKEN"] ? "set" : "unset"} INPUT_GITHUB_TOKEN=${env["INPUT_GITHUB_TOKEN"] ? "set" : "unset"} TF_BUILD=${env["TF_BUILD"] ?? "unset"}\n`);
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

  const runtime: LiveRuntimeConfig = { parsed: input.parsed, cwd: input.cwd, env, fetchImpl };
  let result: LiveRunResult;
  try {
    switch (platform) {
      case "github":
        result = await runGithubLive({ ...runtime, context: await readGithubContext(env) });
        break;
      case "azure":
        result = await runAzureLive({ ...runtime, context: readAzureContext(env) });
        break;
      default:
        return assertNever(platform);
    }
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

function detectLivePlatform(env: NodeJS.ProcessEnv): "github" | "azure" | null {
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
