import { DEFAULT_MAX_COMMENTS_MERGE, DEFAULT_REVIEW_FILE_LIMIT } from "../config/defaults.js";
import { resolveField } from "../config/field-resolution.js";
import { fetchAzurePrDiff, fetchAzurePrInstructions } from "../platform/azure/api.js";
import { chunkDiffByFile, countDiffFiles } from "../platform/azure/chunk.js";
import { AzureContextError, readAzureContext } from "../platform/azure/context.js";
import { GithubContextError, readGithubContext } from "../platform/github/context.js";
import { detectPlatform, PlatformDetectionError } from "../platform/detect.js";
import { fetchGithubPrDiff, fetchGithubPrInstructions } from "../platform/github/api.js";
import { BRAND_PREFIX } from "../util/brand.js";
import { ENV_KEYS } from "../util/env-keys.js";
import { formatError } from "../util/error.js";
import { logError, logWarning } from "../util/log.js";
import { RequiredConfigError, requireLiveConfig } from "../util/required-config.js";
import { runAzureLive } from "./live-azure.js";
import { runGithubLive } from "./live-github.js";
import { mergeReviewResults } from "./live-merge.js";
import {
  LiveReviewError,
  buildTooLargeFallback,
  evaluateLeakGate,
  getLiveReviewHint,
  sanitizeForPost,
  type FetchImpl,
  type LivePlatform,
  type LiveProviderOutcome,
  type LiveRunResult,
} from "./live-shared.js";
import { requestLiveReview } from "./live-provider.js";
import { readLiveSonarContext } from "./sonar-context.js";
import { DEFAULT_PROMPT_FILE_PATHS, resetDefaultPromptFilesCache } from "./provider-prompts.js";
import type { ParsedCliArgs } from "./parse-args.js";
import { applySimulateFindings } from "./simulate-findings.js";

/**
 * Number of chunks to process concurrently when the chunked path is
 * active. 4 is a safe default that respects provider rate-limit headers
 * while still giving us a roughly 4x speed-up over serial chunking.
 * See `chunkDiffByFile` (src/platform/azure/chunk.ts) for the chunking
 * contract.
 */
const DEFAULT_CHUNK_CONCURRENCY = 4;
// DEFAULT_REVIEW_FILE_LIMIT is imported from src/config/defaults.ts
// to keep the live review cap in sync with the field schema.

/**
 * Helper used by the Azure live path. Each chunk is fed through
 * `requestLiveReview` independently and the per-chunk outcomes are
 * reconciled through `mergeReviewResults`.
 *
 * Concurrency is bounded with a small worker pool (default 4) so we
 * never stampede the provider with rate-limited parallel calls while
 * still finishing ~100 chunks in ~25 seconds.
 *
 * Resilience contract: if any individual chunk FAILS (timeout,
 * network error, 5xx), we log the failure and substitute a
 * structurally-empty outcome for that chunk. The merged review
 * continues with the successes — a single rate-limit hiccup does
 * NOT cost us the whole review.
 */
async function requestChunkedLiveReview(input: {
  readonly parsed: ParsedCliArgs;
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly fetchImpl: FetchImpl;
  readonly platform: "azure";
  readonly chunks: readonly string[];
  readonly platformToken: string;
  readonly concurrency?: number;
  readonly sonarContext?: string;
}): Promise<LiveProviderOutcome> {
  const concurrency = Math.max(1, input.concurrency ?? DEFAULT_CHUNK_CONCURRENCY);
  const outcomes: LiveProviderOutcome[] = [];
  let cursor = 0;
  let failedChunkCount = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, input.chunks.length) },
    async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= input.chunks.length) break;
        const chunk = input.chunks[index]!;
        let outcome: LiveProviderOutcome | null = null;
        try {
          outcome = await requestLiveReview({
            parsed: input.parsed,
            cwd: input.cwd,
            env: input.env,
            fetchImpl: input.fetchImpl,
            platform: input.platform,
            diffText: chunk,
            platformToken: input.platformToken,
            ...(input.sonarContext !== undefined ? { sonarContext: input.sonarContext } : {}),
          });
        } catch (error) {
          // One chunk failed (timeout, 5xx, network). Log a warning
          // so operators can correlate, then record an empty outcome
          // so the merge keeps going. This is the difference between
          // "we lost 1 of 66 chunks" and "the whole review dies on
          // chunk 12 because the provider was rate-limiting".
          failedChunkCount += 1;
          const message = formatError(error);
          // Sanitize against the FULL secret list (not just the platform
          // token) so an error message that quotes a 401 echo of the
          // `Authorization` header cannot leak the provider API key into
          // stdout. The sibling catch in `runLive` (line 207) already uses
          // `readSecretValues(env)`; this aligns the per-chunk catch with
          // that contract.
          const sanitized = sanitizeForPost(message, readSecretValues(input.env));
          // The chunk preview is the first 77 chars of the diff for this
          // file. Sanitize it against the full secret list too: a leaked
          // key in the first line of a changed file (e.g. a `.env`
          // example) would otherwise be emitted to stdout via the
          // warning. The earlier per-secret-token pass only handled the
          // platform token and missed every other secret.
          const preview = chunk.length > 80 ? `${chunk.slice(0, 77)}…` : chunk;
          const sanitizedPreview = sanitizeForPost(preview, readSecretValues(input.env));
          logWarning(
            "",
            `chunk ${index + 1}/${input.chunks.length} failed (${sanitized}); substituting empty outcome. chunk preview: ${sanitizedPreview}`,
          );
          outcome = {
            review: { summary: "", verdict: "COMMENT", comments: [], suppressedComments: [] },
            endpoint: "",
            provider: "chunk-failed",
            modelId: "",
            // Failed-chunk placeholder — no severity warnings to surface
            // (the parser never ran on this chunk).
            severityWarnings: [],
            parseWarnings: [],
            verifiedFactsFilter: { kept: [], downgraded: [], downgradeReasons: [] },
            confidenceFilter: { kept: [], downgraded: [], reasons: [] },
          };
        }
        outcomes[index] = outcome;
      }
    },
  );
  await Promise.all(workers);
  if (failedChunkCount > 0) {
    logWarning(
      "",
      `${failedChunkCount}/${input.chunks.length} chunks failed; merged review contains only findings from the chunks that succeeded.`,
    );
  }
  return mergeReviewResults(outcomes, {
    maxComments: input.parsed.maxComments ?? DEFAULT_MAX_COMMENTS_MERGE,
  });
}

export type RunLiveInput = {
  readonly parsed: ParsedCliArgs;
  readonly cwd: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly fetchImpl?: FetchImpl;
};

/**
 * Factory for the canonical "failed but did not post" result shape.
 * Used at every failure exit point in `runLive` so the wire shape stays
 * byte-identical regardless of where the run failed (missing config,
 * thrown error, leak gate, etc.).
 */
function failedResult(message: string): LiveRunResult {
  return { exitCode: 1, posted: false, reviewId: undefined, message };
}

export async function runLive(input: RunLiveInput): Promise<LiveRunResult> {
  // Reset the default-prompt-file cache on each entry point so a
  // long-lived process that calls runLive more than once against the
  // same cwd always re-stats the disk. See
  // src/cli/provider-prompts.ts:resetDefaultPromptFilesCache for the
  // rationale. This is effectively a no-op under the documented
  // deployment model (one process per review run).
  resetDefaultPromptFilesCache();
  const env = input.env ?? process.env;
  const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const platform = detectLivePlatform(env);
  if (platform === null) {
    const message = "Live review requires GitHub Actions (GITHUB_ACTIONS=true) or Azure Pipelines (TF_BUILD=True).";
    process.stdout.write(`${BRAND_PREFIX}${message}\n`);
    return failedResult(message);
  }

  // Copilot + Anthropic-native providers don't need UMACTUALLY_API_URL:
  //   - Copilot uses the GitHub Copilot token exchange endpoint.
  //   - Anthropic defaults to https://api.anthropic.com/v1 and reads
  //     `x-api-key` directly from UMACTUALLY_API_KEY.
  // Skip the URL check for both.
  const isCopilot = input.parsed.provider === "copilot";
  const isAnthropic = input.parsed.provider === "anthropic";
  try {
    if (!isCopilot && !isAnthropic) {
      requireLiveConfig(
        resolveField(input.parsed.apiUrl, env[ENV_KEYS.UMACTUALLY_API_URL], ""),
        ENV_KEYS.UMACTUALLY_API_URL,
      );
    }
    requireLiveConfig(
      resolveField(input.parsed.apiKey, env[ENV_KEYS.UMACTUALLY_API_KEY], ""),
      ENV_KEYS.UMACTUALLY_API_KEY,
    );
  } catch (error) {
    if (error instanceof RequiredConfigError) {
      const message = error.userMessage;
      // Surface the remediation hint alongside the message when available.
      // The hint lives on a second line so it's easy to grep in CI logs;
      // it tells the operator exactly how to set the env var / flag and
      // points to --dry-run as an escape hatch when they want to verify
      // the CLI without contacting the provider.
      const hintLine = error.hint === undefined ? "" : `\n${BRAND_PREFIX}hint: ${error.hint}`;
      process.stdout.write(`${BRAND_PREFIX}${message}${hintLine}\n`);
      return failedResult(message);
    }
    throw error;
  }

  // If --include-sonarqube is set with a fully-configured SonarQube, wait
  // for the quality gate to reach a terminal state BEFORE posting the review.
  // This implements the user's "wait for sonarqube during that PR run"
  // requirement: the review reflects the latest quality-gate state.
  const sonarContext = await readLiveSonarContext(input.parsed, fetchImpl);

  // Scope the fetch counter and timer to the provider-review phase
  // only. Pre-review phases (config validation, leak-gate, SonarQube
  // probe) MUST NOT inflate the counter, or a leak-gate fetch would
  // suppress the `provider-roundtrips-zero` warning the guard uses
  // to detect cache hits / short-circuit fallbacks. Likewise, the
  // timer must measure the provider-call window so pre-review
  // latency doesn't push a legitimately-fast review over the 3s
  // floor. Addresses inline self-review findings #1 (HIGH) + #3
  // (MEDIUM) on PR #144.
  const counter = { providerRoundTrips: 0 };
  const countingFetch: FetchImpl = (url, init) => {
    counter.providerRoundTrips += 1;
    return fetchImpl(url, init);
  };
  const startedAt = Date.now();
  let result: LiveRunResult;
  try {
    result = await dispatchLivePlatform({
      platform,
      parsed: input.parsed,
      cwd: input.cwd,
      env,
      fetchImpl: countingFetch,
      ...(sonarContext !== undefined ? { sonarContext } : {}),
    });
  } catch (error) {
    const message = formatError(error);
    const sanitized = sanitizeForPost(message, readSecretValues(env));
    // Surface the structured remediation hint when the throw carries
    // one (LiveReviewError / RequiredConfigError). Operators run the
    // CLI from CI logs that often lose context: printing the hint
    // next to the failure means the next person debugging the
    // pipeline sees exactly which token / scope / flag to fix.
    let hint: string | undefined;
    if (error instanceof LiveReviewError) {
      hint = getLiveReviewHint(error);
    } else if (error instanceof RequiredConfigError) {
      hint = error.hint;
    } else if (error instanceof AzureContextError || error instanceof GithubContextError) {
      hint = buildPlatformContextHint(error);
    }
    const hintLine = hint === undefined ? "" : `\n${BRAND_PREFIX}hint: ${hint}`;
    process.stdout.write(`${BRAND_PREFIX}${sanitized}${hintLine}\n`);
    return failedResult(sanitized);
  }

  if (result.posted) {
    process.stdout.write(`${BRAND_PREFIX}${result.message}\n`);
  }
  // Attach scope-limited telemetry for the artifact writer. Failed
  // pre-review paths return early via failedResult, so they never
  // reach this point — the suspicious-signal guard only fires on
  // posted=true reviews, so missing telemetry on failed paths is
  // intentional.
  return {
    ...result,
    providerRoundTrips: counter.providerRoundTrips,
    reviewDurationMs: Date.now() - startedAt,
  };
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
      let instructionFilesByBaseBranch: Map<string, string> | undefined;
      try {
        instructionFilesByBaseBranch = await fetchGithubPrInstructions(
          context,
          DEFAULT_PROMPT_FILE_PATHS,
          fetchImpl,
        );
      } catch (error) {
        logWarning("", `failed to fetch GitHub base-branch instruction files (${formatError(error)}); falling back to cwd lookup.`);
      }
      const diffText = await fetchGithubPrDiff(context, fetchImpl);
      const leakGate = await evaluateLeakGate({
        diffText,
        detectLeaks: parsed.detectLeaks,
      });
      if (!leakGate.ok) {
        logError("", leakGate.message);
        return failedResult(leakGate.message);
      }
      const liveOutcome = await requestLiveReview({
        parsed,
        cwd,
        env,
        fetchImpl,
        platform: "github",
        diffText,
        platformToken: context.token,
        ...(instructionFilesByBaseBranch !== undefined ? { instructionFilesByBaseBranch } : {}),
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
      // Forward --pr-number (when supplied) to the Azure context reader so
      // manual CLI invocations work without synthesising
      // SYSTEM_PULLREQUEST_PULLREQUESTID. The CLI boundary validates the
      // flag (see src/cli/validate.ts), but we re-parse here because:
      //   (1) readAzureContext is also callable directly from tests and
      //       future internal call sites that bypass the CLI boundary, so
      //       re-validating here keeps the invariant local to the context
      //       reader.
      //   (2) Silent fallback to the env var when the flag is invalid
      //       would mask a real user mistake (typo on the command line,
      //       shell quoting bug, etc.) by appearing to "work" with the
      //       env-var value while ignoring the flag. Better to surface
      //       the failure loudly than to silently do the wrong thing.
      //   (3) Number.parseInt("42abc") returns 42 (the legacy
      //       Number.parseInt trap). Use Number() which returns NaN for
      //       non-numeric strings — NaN fails isSafeInteger, which we
      //       surface as an error rather than dropping the override.
      let azurePrNumberOverride: number | undefined = undefined;
      if (parsed.prNumber !== null) {
        const candidate = Number(parsed.prNumber);
        if (!Number.isFinite(candidate) || !Number.isInteger(candidate) || candidate <= 0) {
          throw new AzureContextError(
            "AZURE_PR_NUMBER_INVALID",
            `Azure CLI flag --pr-number must be a positive integer (got ${JSON.stringify(parsed.prNumber)}).`,
          );
        }
        if (!Number.isSafeInteger(candidate)) {
          throw new AzureContextError(
            "AZURE_PR_NUMBER_INVALID",
            `Azure CLI flag --pr-number must be a safe integer (got ${candidate}).`,
          );
        }
        azurePrNumberOverride = candidate;
      }
      const context = readAzureContext(env, { prNumber: azurePrNumberOverride });
      let instructionFilesByBaseBranch: Map<string, string> | undefined;
      try {
        instructionFilesByBaseBranch = await fetchAzurePrInstructions(
          context,
          DEFAULT_PROMPT_FILE_PATHS,
          fetchImpl,
        );
      } catch (error) {
        logWarning("", `failed to fetch Azure base-branch instruction files (${formatError(error)}); falling back to cwd lookup.`);
      }
      const diffText = await fetchAzurePrDiff(context, fetchImpl);
      const leakGate = await evaluateLeakGate({
        diffText,
        detectLeaks: parsed.detectLeaks,
      });
      if (!leakGate.ok) {
        logError("", leakGate.message);
        return failedResult(leakGate.message);
      }
      // Gate the live review on the configured file count. The default
      // 200-file cap is a quality choice: chunked LLM reviews of an
      // arbitrarily-large initial-import diff produce hallucinated
      // findings that aren't grounded in the code. The user can
      // override via `--review-file-limit` (0 disables the limit).
      const reviewFileLimit = parsed.reviewFileLimit ?? DEFAULT_REVIEW_FILE_LIMIT;
      const fileCount = countDiffFiles(diffText);
      let liveOutcome: LiveProviderOutcome;
      if (reviewFileLimit > 0 && fileCount > reviewFileLimit) {
        process.stdout.write(`${BRAND_PREFIX}skipping live review — PR changes ${fileCount} files, exceeds --review-file-limit=${reviewFileLimit}. Use --review-file-limit 0 to disable.\n`);
        liveOutcome = {
          review: buildTooLargeFallback({
            fileCount,
            reviewFileLimit,
            provider: parsed.provider ?? "openai-compatible",
            modelId: parsed.model ?? "(auto)",
            secrets: [context.token],
          }),
          endpoint: "skipped",
          provider: parsed.provider ?? "openai-compatible",
          modelId: parsed.model ?? "(auto)",
          // Skipped-due-to-file-limit placeholder — no parser ran, so
          // no severity warnings to surface.
          severityWarnings: [],
          parseWarnings: [],
          verifiedFactsFilter: { kept: [], downgraded: [], downgradeReasons: [] },
            confidenceFilter: { kept: [], downgraded: [], reasons: [] },
        };
      } else {
        const chunks = chunkDiffByFile(diffText);
        if (chunks.length <= 1) {
          // Fallback: the entire diff fits in one chunk. Use the existing
          // single-call flow so a small PR review stays cheap and
          // deterministic.
          liveOutcome = await requestLiveReview({
            parsed,
            cwd,
            env,
            fetchImpl,
            platform: "azure",
            diffText,
            platformToken: context.token,
            ...(sonarContext !== undefined ? { sonarContext } : {}),
          });
        } else {
          // Chunked path: feed each per-file chunk to the provider in
          // parallel (bounded by DEFAULT_CHUNK_CONCURRENCY) and merge
          // the per-chunk outcomes into a single LiveProviderOutcome.
          process.stdout.write(`${BRAND_PREFIX}chunking large PR diff into ${chunks.length} provider requests (max concurrency ${DEFAULT_CHUNK_CONCURRENCY}).\n`);
          liveOutcome = await requestChunkedLiveReview({
            parsed,
            cwd,
            env,
            fetchImpl,
            platform: "azure",
            chunks,
            platformToken: context.token,
            ...(instructionFilesByBaseBranch !== undefined ? { instructionFilesByBaseBranch } : {}),
            ...(sonarContext !== undefined ? { sonarContext } : {}),
          });
        }
      }
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
  // Routes through the canonical detector so the live CLI and the
  // detection helper share one truth-table for CI marker recognition.
  try {
    const detected = detectPlatform(env);
    return detected === "azure-devops" ? "azure" : "github";
  } catch (error) {
    if (error instanceof PlatformDetectionError) {
      return null;
    }
    throw error;
  }
}

function readSecretValues(env: NodeJS.ProcessEnv): readonly string[] {
  return [
    env[ENV_KEYS.UMACTUALLY_API_KEY] ?? "",
    env[ENV_KEYS.GITHUB_TOKEN] ?? "",
    env[ENV_KEYS.SYSTEM_ACCESSTOKEN] ?? "",
    env["AZURE_DEVOPS_TOKEN"] ?? "",
  ];
}

function assertNever(value: never): never {
  throw new TypeError(`Unhandled live platform: ${value}`);
}

/**
 * Build a remediation hint for a {@link AzureContextError} or
 * {@link GithubContextError} thrown by the platform context readers.
 *
 * The context error classes carry a structured `code` (e.g.
 * `AZURE_TOKEN_MISSING`, `GITHUB_EVENT_PATH_MISSING`) but the
 * upstream `message` strings stay byte-compatible with the legacy
 * "must be set" wording. Matching on `code` lets the CLI surface a
 * much more actionable hint than a re-rendering of the message, while
 * still letting the message ride through unchanged for grep-
 * compatibility.
 *
 * Returns `undefined` for codes that don't yet have a curated hint
 * (we surface the bare message instead of guessing).
 */
function buildPlatformContextHint(error: AzureContextError | GithubContextError): string | undefined {
  const AZURE_HINTS: Readonly<Record<string, string>> = {
    AZURE_TOKEN_MISSING:
      "Set SYSTEM_ACCESSTOKEN as a pipeline variable and enable 'Allow scripts to access the OAuth token' on the Agent job. The token must have `Pull Request Contribute` permission on the target repository.",
    AZURE_COLLECTION_URI_INVALID:
      "Set SYSTEM_COLLECTIONURI to the org URL (e.g. https://dev.azure.com/your-org) — pipelines usually fill this in automatically; reset the job or re-queue the build if the value is `undefined`.",
    AZURE_TEAM_PROJECT_MISSING:
      "Set SYSTEM_TEAMPROJECT in the pipeline (or run inside a `microsoft/azure-pipelines` agent). The team project is the second segment of the repo path after `dev.azure.com/{org}/`.",
    AZURE_REPOSITORY_ID_MISSING:
      "Set BUILD_REPOSITORY_NAME on the pipeline, or pass --repo '<org>/<project>/<repo>' on the command line. See docs/azure-devops.md for the supported forms.",
    AZURE_PR_NUMBER_INVALID:
      "Set SYSTEM_PULLREQUEST_PULLREQUESTID in the pipeline (under PR trigger variables), or pass --pr-number <N> on the command line.",
    AZURE_SOURCE_COMMIT_MISSING:
      "Set SYSTEM_PULLREQUEST_SOURCECOMMITID in the pipeline (under PR trigger variables), or run on a pull_request-triggered build (the legacy PR_REVIEW_AUTHORING mode is not yet supported).",
    AZURE_TARGET_BRANCH_MISSING:
      "Set SYSTEM_PULLREQUEST_TARGETBRANCHNAME or BUILD_SOURCEBRANCHNAME in the pipeline environment. The target branch is what the review comments will be anchored against.",
  };
  const GITHUB_HINTS: Readonly<Record<string, string>> = {
    GITHUB_TOKEN_MISSING:
      "Set GITHUB_TOKEN (the default GITHUB_TOKEN provided to the runner is fine; re-check `permissions:` in the workflow file or pass `permissions: pull-requests: write`).",
    GITHUB_REPOSITORY_INVALID:
      "Set GITHUB_REPOSITORY to '<owner>/<name>'. On fork PRs from forks you also need GITHUB_REPOSITORY-relative paths; use `pull_request_target` workflows only with care.",
    GITHUB_PR_NUMBER_INVALID:
      "Pass PR_NUMBER (a positive integer) as an action input, set GITHUB_PR_NUMBER in the workflow env, or rely on the supplied `pull_request` event payload's `number` field.",
    GITHUB_SHA_MISSING:
      "Set GITHUB_SHA in the workflow env. For pull_request events GitHub Actions sets this automatically; for workflow_dispatch / schedule jobs you may need to pass it explicitly.",
    GITHUB_EVENT_PATH_MISSING:
      "Set GITHUB_EVENT_PATH to the absolute path of the `event.json` payload (GitHub Actions sets this for `pull_request` events). The CLI reads PR number, base/head SHA, and draft state from it.",
    GITHUB_EVENT_PAYLOAD_INVALID:
      "Re-queue the workflow: the event.json payload is malformed JSON or missing the `pull_request` object. This usually means a non-`pull_request` event type was supplied.",
  };
  if (error instanceof AzureContextError) {
    return AZURE_HINTS[error.code];
  }
  if (error instanceof GithubContextError) {
    return GITHUB_HINTS[error.code];
  }
  return undefined;
}
