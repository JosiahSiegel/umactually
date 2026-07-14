import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

import { runAzureReview } from "../azure/run-azure-review.js";
import { runReview } from "../review/run-review.js";
import { BRAND_PREFIX } from "../util/brand.js";
import { scanReviewSecrets } from "../security/scan-review-secrets.js";
import { runSonarImport } from "../sonar/run-sonar-import.js";
import { readEnvSources } from "../config/env-sources.js";
import type { EnvSources } from "../config/types.js";
import { withDebugRawEnv } from "../util/debug-raw.js";
import { formatError } from "../util/error.js";
import { REVIEW_MARKER } from "../util/marker.js";
import type { ParsedCliArgs } from "./parse-args.js";
import { resetDefaultPromptFilesCache } from "./provider-prompts.js";
import { resolvePlatform, type ResolvedPlatform } from "./validate.js";
import { runLive as runOrchestrator } from "./orchestrator.js";
import { isStandaloneMode } from "./standalone-run.js";

export type CliJsonOutcome = {
  readonly postedToPlatform?: boolean;
  readonly artifactPath?: string;
  readonly parseWarnings?: readonly string[];
  readonly suppressedCommentCount?: number;
  readonly commentCount?: number;
  readonly verdict?: string;
  readonly parseFailed?: boolean;
};

export type CliRunResult = {
  readonly exitCode: number;
  readonly jsonOutcome?: CliJsonOutcome;
};

const DEFAULT_AZURE_ARTIFACT = "artifacts/manual/s4-azure-mocked-run.json";
const DEFAULT_REDACTION_REPORT = "artifacts/manual/s5-redaction-report.json";
const DEFAULT_SONAR_REPORT = "artifacts/manual/s6-sonar-mocked-run.json";
const SONAR_FIXTURE_ISSUES = JSON.stringify({ issues: [{}, {}] });
const SONAR_FIXTURE_HOTSPOTS = JSON.stringify({ hotspots: [] });
const SONAR_FIXTURE_QUALITY_GATE = JSON.stringify({
  sequence: [{ projectStatus: { status: "OK" } }],
});

export async function runDryRun(parsed: ParsedCliArgs, cwd: string, platform: ResolvedPlatform): Promise<CliRunResult> {
  // Mirror runLive's reset hook so a long-lived process that invokes
  // runDryRun repeatedly (e.g. a test runner) doesn't see stale
  // default-lookup decisions. See
  // src/cli/provider-prompts.ts:resetDefaultPromptFilesCache.
  resetDefaultPromptFilesCache();
  const artifactPath = resolveArtifactPath(parsed.outputArtifact, platform, cwd);
  const envSources = readEnvSources(process.env);
  const artifactBody = await buildDryRunArtifact(parsed, platform, cwd);
  mergeEnvDiagnostics(artifactBody, envSources);
  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(artifactBody, null, 2)}\n`, "utf8");
  process.stdout.write(`${BRAND_PREFIX}dry-run wrote ${artifactPath}\n`);
  return { exitCode: 0 };
}

/**
 * Sibling artifact path for the parse-warnings record. The parse-warnings
 * JSON sits next to the main review artifact so a CI guard or operator
 * can `cat artifacts/manual/s1-github-parse-warnings.json` alongside
 * the s1 review. Filename is fixed (not user-configurable) so the
 * downstream check tools have a stable path.
 */
export function resolveParseWarningsArtifactPath(
  primaryArtifactPath: string,
): string {
  // Replace the extension with `.parse-warnings.json`. Most reviews use
  // `.md` (s1-github-self-review.md) or `.json` (s4-azure-mocked-run.json);
  // we keep the directory and stem, swap the suffix.
  //
  // We use our own custom `basename` and `joinPath` (instead of
  // `node:path`'s) because the input can be either a POSIX path
  // (Linux/macOS CI) or a Windows path (Windows local dev). The
  // node:path versions behave correctly per-platform but a path
  // captured on Windows and consumed on Linux (or vice versa)
  // yields the wrong dirname. The custom pair handles both.
  const dir = customDirname(primaryArtifactPath);
  const stem = customBasename(primaryArtifactPath).replace(/\.[^.]+$/u, "");
  return customJoinPath(dir, `${stem}.parse-warnings.json`);
}

function customBasename(path: string): string {
  const idx = path.lastIndexOf("/");
  const winIdx = path.lastIndexOf("\\");
  const cut = Math.max(idx, winIdx);
  return cut === -1 ? path : path.slice(cut + 1);
}

function customDirname(path: string): string {
  const idx = path.lastIndexOf("/");
  const winIdx = path.lastIndexOf("\\");
  const cut = Math.max(idx, winIdx);
  return cut === -1 ? "" : path.slice(0, cut);
}

function customJoinPath(dir: string, file: string): string {
  if (dir === "" || dir === ".") {
    return file;
  }
  const sep = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
  return dir.endsWith("/") || dir.endsWith("\\") ? `${dir}${file}` : `${dir}${sep}${file}`;
}

/**
 * Merge sanitized env diagnostics into the dry-run artifact body.
 * Never includes raw secret values: only booleans (presence) and non-secret
 * scalars (providerUrl, providerModel, env-sourced guidance flag strings).
 * Called once per dry-run invocation so callers can inspect what the runtime
 * actually resolved from the process environment without leaking credentials.
 */
function mergeEnvDiagnostics(body: Record<string, unknown>, env: EnvSources): void {
  body["effectiveConfig"] = buildEffectiveConfig(env);
  body["secretsDetected"] = buildSecretsDetected(env);
}

/**
 * Returns the non-secret env-sourced fields the dry-run artifact should expose.
 * Every secret-bearing key (apiKey, sonarToken, githubToken, azureToken) is
 * excluded; only their presence is reported via `secretsDetected`.
 */
function buildEffectiveConfig(env: EnvSources): Record<string, unknown> {
  return {
    providerUrl: env.providerUrl ?? null,
    providerModel: env.providerModel ?? null,
    walkthrough: env.walkthrough ?? null,
    diagnostic: env.diagnostic ?? null,
    dryRun: env.dryRun ?? null,
    debugRawResponse: env.debugRawResponse ?? null,
    reviewTimeoutSeconds: env.reviewTimeoutSeconds ?? null,
    stallTimeoutSeconds: env.stallTimeoutSeconds ?? null,
    perRequestTimeoutSeconds: env.perRequestTimeoutSeconds ?? null,
    minimumSeverity: env.minimumSeverity ?? null,
    maxComments: env.maxComments ?? null,
    sonarEnabled: env.sonarEnabled ?? null,
    sonarHost: env.sonarHost ?? null,
    sonarProject: env.sonarProject ?? null,
    sonarTimeoutSeconds: env.sonarTimeoutSeconds ?? null,
    leakDetection: env.leakDetection ?? null,
    redactorEnabled: env.redactorEnabled ?? null,
    platform: env.platform ?? null,
  };
}

/**
 * Returns a boolean-only map describing which secret-bearing env vars were
 * present in the process environment. Values are NEVER included.
 */
function buildSecretsDetected(env: EnvSources): Record<string, boolean> {
  return {
    apiKey: typeof env.providerApiKey === "string" && env.providerApiKey.length > 0,
    sonarToken: typeof env.sonarToken === "string" && env.sonarToken.length > 0,
    githubToken: typeof env.githubToken === "string" && env.githubToken.length > 0,
    azureToken: typeof env.azureToken === "string" && env.azureToken.length > 0,
  };
}

function resolveArtifactPath(
  outputArtifact: string | null,
  platform: ResolvedPlatform,
  cwd: string,
): string {
  if (outputArtifact !== null) {
    return isAbsolute(outputArtifact) ? outputArtifact : resolve(cwd, outputArtifact);
  }
  const defaultRelative = platform === "github"
    ? "artifacts/manual/s1-github-self-review.md"
    : DEFAULT_AZURE_ARTIFACT;
  return resolve(cwd, defaultRelative);
}

async function buildDryRunArtifact(
  parsed: ParsedCliArgs,
  platform: ResolvedPlatform,
  cwd: string,
): Promise<Record<string, unknown>> {
  if (platform === "github") {
    return buildGithubDryRunArtifact(parsed, cwd);
  }
  return buildAzureDryRunArtifact(parsed, cwd);
}

async function buildGithubDryRunArtifact(parsed: ParsedCliArgs, cwd: string): Promise<Record<string, unknown>> {
  // Standalone dry-run short-circuit: when the operator is in standalone mode
  // (no CI markers) AND has not supplied --review, this is a smoke test, NOT
  // a posting run. The auto-context-derived synthetic event.json has null
  // posting identity (pull_request.number=null) that the runReview
  // pipeline rejects. Mirror the Azure stub at the bottom of this file
  // (lines 215-224): return a no-posting artifact body.
  if (parsed.dryRun && parsed.reviewPath === null && isStandaloneMode(process.env)) {
    return {
      artifactPath: "artifacts/manual/s1-github-self-review.md",
      posted: false,
      marker: REVIEW_MARKER,
      inlineThreadCount: 0,
      suppressedCommentCount: 0,
      note: "no --review supplied; this was a standalone dry-run smoke test, no posting path executed",
    };
  }

  // The validator (src/cli/validate.ts:collectPostingValidationErrors)
  // is the sole gate for posting-required identity. Here in the consumer
  // path we tolerate null event/diff when the operator is running a
  // smoke test without posting context. Pass empty strings; the runReview
  // pipeline tolerates empty eventJson / empty diffText (it returns zero
  // findings, which is what a smoke test expects).
  const eventJson = parsed.eventPath === null
    ? ""
    : await readRequiredFile(parsed.eventPath, cwd, "--event");
  const diffText = parsed.diffPath === null
    ? ""
    : await readRequiredFile(parsed.diffPath, cwd, "--diff");
  const providerReviewJson = await readOptionalFile(
    parsed.reviewPath ?? parsed.promptFile,
    cwd,
    "{}",
    "review",
  );
  const expectedArtifact = "artifacts/manual/s1-github-self-review.md";
  const result = await runReview({
    platform: "github",
    eventJson,
    diffText,
    providerReviewJson,
    expectedArtifact,
  });

  const body: Record<string, unknown> = {
    artifactPath: result.artifactPath,
    event: result.event,
    marker: result.marker,
    inlineThreadCount: result.inlineThreadCount,
    suppressedCommentCount: result.suppressedCommentCount,
  };

  await maybeMergeRedactionReport(parsed, diffText, body);
  await maybeMergeSonarReport(parsed, body);

  return body;
}

async function buildAzureDryRunArtifact(parsed: ParsedCliArgs, cwd: string): Promise<Record<string, unknown>> {
  const reviewPath = parsed.reviewPath;
  if (parsed.dryRun || reviewPath === null) {
    return {
      artifactPath: DEFAULT_AZURE_ARTIFACT,
      postedThreadCount: 0,
      postedStatusState: "succeeded",
      marker: REVIEW_MARKER,
      postingRequested: false,
      note: "no --review supplied; this was a capability-detection smoke run, no posting path executed",
    };
  }

  // The validator (src/cli/validate.ts:collectPostingValidationErrors)
  // already gated on --review requires --event / --diff for posting,
  // so by the time we reach here those fields are non-null. Throw a
  // defensive error if the validator let a malformed invocation slip
  // through; don't silently produce a broken artifact.
  if (parsed.eventPath === null || parsed.diffPath === null) {
    throw new CliArgumentError("--review requires --event and --diff to be supplied");
  }

  const pullRequestJson = await readRequiredFile(parsed.eventPath, cwd, "--event");
  const existingThreadsJson = parsed.threadsPath === null
    ? "{\"count\":0,\"value\":[]}"
    : await readRequiredFile(parsed.threadsPath, cwd, "--threads");
  const reviewJson = reviewPath === null
    ? "{\"verdict\":\"COMMENT\",\"comments\":[],\"suppressed_comments\":[]}"
    : await readRequiredFile(reviewPath, cwd, "--review");

  const diffPath = parsed.diffPath;
  const diffText = diffPath === null ? "" : await readRequiredFile(diffPath, cwd, "--diff");

  const expectedArtifact = DEFAULT_AZURE_ARTIFACT;
  const result = await runAzureReview({
    pullRequestJson,
    existingThreadsJson,
    reviewJson,
    diffText,
    expectedArtifact,
  });

  const body: Record<string, unknown> = {
    artifactPath: result.artifactPath,
    postedThreadCount: result.postedThreadCount,
    postedStatusState: result.postedStatusState,
    marker: result.marker,
  };

  await maybeMergeRedactionReport(parsed, diffText, body);
  await maybeMergeSonarReport(parsed, body);

  return body;
}

async function maybeMergeRedactionReport(
  parsed: ParsedCliArgs,
  diffText: string,
  body: Record<string, unknown>,
): Promise<void> {
  if (!parsed.detectLeaks) {
    return;
  }
  const report = await scanReviewSecrets({
    diffText,
    expectedArtifact: DEFAULT_REDACTION_REPORT,
  });
  // Merge S5 contract fields directly into the artifact body so the artifact
  // contains highConfidenceLeakCount, redactedDiffIncludesSecret, and blockedRawOutput.
  body["highConfidenceLeakCount"] = report.highConfidenceLeakCount;
  body["redactedDiffIncludesSecret"] = report.redactedDiffIncludesSecret;
  body["blockedRawOutput"] = report.blockedRawOutput;
  body["redactionReport"] = report;
}

async function maybeMergeSonarReport(
  parsed: ParsedCliArgs,
  body: Record<string, unknown>,
): Promise<void> {
  if (!parsed.includeSonarqube) {
    return;
  }
  const report = await runSonarImport({
    qualityGateSequenceJson: SONAR_FIXTURE_QUALITY_GATE,
    issuesJson: SONAR_FIXTURE_ISSUES,
    hotspotsJson: SONAR_FIXTURE_HOTSPOTS,
    configured: parsed.sonarHostUrl !== null && parsed.sonarToken !== null && parsed.sonarProjectKey !== null,
    expectedArtifact: DEFAULT_SONAR_REPORT,
  });
  // Merge S6 contract fields directly into the artifact body.
  body["waitedForTerminalQualityGate"] = report.waitedForTerminalQualityGate;
  body["importedFindingCount"] = report.importedFindingCount;
  body["timeoutHandled"] = report.timeoutHandled;
  body["skipWhenUnconfigured"] = report.skipWhenUnconfigured;
  body["sonarReport"] = report;
}

async function readRequiredFile(path: string, cwd: string, label: string): Promise<string> {
  const absolute = isAbsolute(path) ? path : resolve(cwd, path);
  try {
    return await readFile(absolute, "utf8");
  } catch (error) {
    throw new CliArgumentError(`failed to read ${label} file ${absolute}: ${formatError(error)}`);
  }
}

async function readOptionalFile(
  path: string | null,
  cwd: string,
  fallback: string,
  label: string,
): Promise<string> {
  if (path === null || path.length === 0) {
    return fallback;
  }
  return readRequiredFile(path, cwd, label);
}

export class CliArgumentError extends Error {
  override readonly name = "CliArgumentError";
}

export async function dispatchLive(parsed: ParsedCliArgs, cwd: string, env: NodeJS.ProcessEnv): Promise<CliRunResult> {
  // Live orchestration lives in src/cli/orchestrator.ts so the dry-run path
  // keeps a single-responsibility surface. This thin wrapper exists only to
  // preserve the public CLI module exports expected by existing tests.
  // Static import (no dynamic import()) so ncc emits a single bundle chunk
  // rather than a content-hashed dynamic chunk that would need to be committed.
  //
  // Compatibility shim: provider debug logging still reads
  // UMACTUALLY_DEBUG_RAW from process.env. `withDebugRawEnv` sets it only
  // for this dispatch and restores/deletes it in finally so same-process
  // batch runs do not inherit --debug-raw-response from an earlier review.
  return withDebugRawEnv(parsed.debugRawResponse === true, async () => {
    const result = await runOrchestrator({ parsed, cwd, env });
    // Write a summary artifact at the same path the dry-run uses so the
    // self-review CI guard (`scripts/check-self-review-output.mjs`) can
    // inspect the live review's outcome. Without this, a parse-fail
    // card posted via the GitHub API leaves no local trace for the
    // guard to catch — the action exits 0 and CI sees "pass".
    const platform = resolvePlatform(parsed.platform, env);
    await writeLiveArtifact(parsed, cwd, platform, result);
    return { exitCode: result.exitCode };
  });
}

/**
 * Persist the live review outcome to the same artifact path the dry-run
 * uses. The shape matches the dry-run artifact's top-level fields so
 * `scripts/check-self-review-output.mjs` can inspect either path with
 * the same classifier.
 *
 * Critical for the self-review guard: when the action posts a parse-fail
 * card via the GitHub API, this artifact is the only local signal that
 * the review produced zero findings. Without it, the guard has nothing
 * to inspect and CI passes despite garbage on the PR.
 *
 * Two cases:
 *   1. `result.posted === false`: write a parse-fail sentinel so the
 *      guard catches it.
 *   2. `result.posted === true`: write a success marker that reflects
 *      the live review's actual counts. The dry-run path may have
 *      already written a stub to this artifact, but the live path's
 *      counts (which match what GitHub/Azure actually saw) are more
 *      accurate. The guard inspects `inlineThreadCount`/`postedThreadCount`
 *      + `parseFailed` to classify, so writing the live counts keeps
 *      the guard honest about what really happened.
 *
 * Concurrency: also surfaced via the severity-warning concurrency guard
 * in `setActiveSeveritySink`. This function runs once per `dispatchLive`
 * invocation, in `finally` — so a panic mid-review still writes the
 * sentinel.
 */
async function writeLiveArtifact(
  parsed: ParsedCliArgs,
  cwd: string,
  platform: ResolvedPlatform,
  result: {
    readonly posted: boolean;
    readonly message: string;
    readonly inlineThreadCount?: number;
    readonly suppressedCommentCount?: number;
    readonly verdict?: string;
    readonly parseFailed?: boolean;
    readonly parseWarnings?: readonly import("./parse-warnings.js").ParseWarning[];
  },
): Promise<void> {
  // Use the same default path resolution as the dry-run path so the
  // self-review CI guard has a local trace even when the caller did
  // NOT pass --output-artifact. Without this, a parse-fail card posted
  // via the GitHub/Azure API leaves no local trace and the guard sees
  // an empty artifact directory.
  const artifactPath = resolveArtifactPath(parsed.outputArtifact, platform, cwd);
  await mkdir(dirname(artifactPath), { recursive: true });
  if (!result.posted) {
    const body = {
      artifactPath,
      posted: false,
      message: result.message,
      marker: REVIEW_MARKER,
      inlineThreadCount: 0,
      suppressedCommentCount: 0,
      blockedRawOutput: false,
      parseFailed: true,
      note: "Live review did not post anything via the GitHub/Azure API. Inspect the action log for the underlying parser/network error.",
    };
    await writeFile(artifactPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
    await writeParseWarningsArtifact(artifactPath, result.parseWarnings ?? []);
    return;
  }
  // Successful post: write a success artifact reflecting the live
  // counts. If the dry-run already wrote a stub to this path, this
  // OVERWRITES it with the real counts (so the guard sees the truth
  // rather than whatever the dry-run fixture produced). The shape
  // matches the dry-run artifact's top-level fields.
  const body = {
    artifactPath,
    posted: true,
    message: result.message,
    marker: REVIEW_MARKER,
    inlineThreadCount: result.inlineThreadCount ?? 0,
    suppressedCommentCount: result.suppressedCommentCount ?? 0,
    blockedRawOutput: false,
    parseFailed: result.parseFailed === true,
    ...(result.verdict !== undefined ? { verdict: result.verdict } : {}),
    note: "Live review posted successfully; counts reflect what the GitHub/Azure API saw.",
  };
  await writeFile(artifactPath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await writeParseWarningsArtifact(artifactPath, result.parseWarnings ?? []);
}

/**
 * Write the parse-warnings sibling artifact at a path derived from the
 * main artifact path. Empty warnings list → still write the file
 * (with summary counts) so downstream tooling has a stable contract;
 * the file's `summary.invalidCount` is the field operators should
 * watch for non-zero regressions.
 */
async function writeParseWarningsArtifact(
  primaryArtifactPath: string,
  warnings: readonly import("./parse-warnings.js").ParseWarning[],
): Promise<void> {
  const path = resolveParseWarningsArtifactPath(primaryArtifactPath);
  // Build the summary from the warnings list using the same logic as
  // buildParseWarningsArtifact (we re-import rather than re-invoke the
  // function because we already have the warnings array).
  const byReason: Record<"path-not-in-diff" | "line-not-in-diff", number> = {
    "path-not-in-diff": 0,
    "line-not-in-diff": 0,
  };
  const bySource: Record<"comments" | "suppressed_comments", number> = {
    comments: 0,
    suppressed_comments: 0,
  };
  for (const w of warnings) {
    byReason[w.reason] += 1;
    bySource[w.source] += 1;
  }
  const body = {
    summary: {
      invalidCount: warnings.length,
      byReason,
      bySource,
      note: warnings.length === 0
        ? "All model citations anchored to the supplied diff. No fabrication detected."
        : `${warnings.length} comment(s) cited a path or line not present in the supplied diff. The review post-filter (parseDiffPositions) dropped these from inline posting. See PR #56 for the canonical regression that produced 8 such warnings on a source-only diff.`,
    },
    warnings,
  };
  await writeFile(path, `${JSON.stringify(body, null, 2)}\n`, "utf8");
}
