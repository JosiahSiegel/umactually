import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

import { runAzureReview } from "../azure/run-azure-review.js";
import { runReview } from "../review/run-review.js";
import { scanReviewSecrets } from "../security/scan-review-secrets.js";
import { runSonarImport } from "../sonar/run-sonar-import.js";
import { readEnvSources } from "../config/env-sources.js";
import type { EnvSources } from "../config/types.js";
import type { ParsedCliArgs } from "./parse-args.js";
import type { ResolvedPlatform } from "./validate.js";

export type CliRunResult = {
  readonly exitCode: number;
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
  const artifactPath = resolveArtifactPath(parsed.outputArtifact, platform, cwd);
  const envSources = readEnvSources(process.env);
  const artifactBody = await buildDryRunArtifact(parsed, platform, cwd);
  mergeEnvDiagnostics(artifactBody, envSources);
  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(artifactBody, null, 2)}\n`, "utf8");
  return { exitCode: 0 };
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
    ignoreMinor: env.ignoreMinor ?? null,
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
  const eventPath = requireArg(parsed.eventPath, "--event");
  const diffPath = requireArg(parsed.diffPath, "--diff");
  const eventJson = await readRequiredFile(eventPath, cwd, "--event");
  const diffText = await readRequiredFile(diffPath, cwd, "--diff");
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
  const pullRequestPath = requireArg(parsed.eventPath, "--event");
  const reviewPath = parsed.reviewPath;
  const pullRequestJson = await readRequiredFile(pullRequestPath, cwd, "--event");
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

function requireArg(value: string | null, flag: string): string {
  if (value === null) {
    throw new CliArgumentError(`${flag} is required`);
  }
  return value;
}

async function readRequiredFile(path: string, cwd: string, label: string): Promise<string> {
  const absolute = isAbsolute(path) ? path : resolve(cwd, path);
  try {
    return await readFile(absolute, "utf8");
  } catch (error) {
    throw new CliArgumentError(`failed to read ${label} file ${absolute}: ${stringifyError(error)}`);
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

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export class CliArgumentError extends Error {
  override readonly name = "CliArgumentError";
}

export function dispatchLive(): CliRunResult {
  process.stderr.write("cli: live provider calls are not supported in this build; use --dry-run\n");
  return { exitCode: 3 };
}