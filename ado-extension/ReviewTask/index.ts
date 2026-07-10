// SPDX-License-Identifier: MIT
//
// UmActually PR Review — Azure DevOps Build/Release task implementation.
//
// This file is bundled by tsc/esbuild into index.js, which is what the
// Azure Pipelines agent executes. It MUST be runnable on Node 20 (see
// task.json `execution.Node20_1.target`).
//
// IN DEVELOPMENT: the implementation is functional but has not been
// sideloaded into a real ADO organization yet. See the file
// ado-extension/README.md for the pre-publish checklist.
//
// Strategy: the task shells out to the system `node` (or a bundled
// `umactually-pr-review.mjs` if shipped with the task) with the CLI
// flags documented in docs/providers.md. We do NOT re-implement the
// CLI's parser — keeping the task a thin wrapper means upgrades to
// UmActually flow through without touching the extension package.
//
// Alternative distribution model: ship a `node_modules/umactually-pr-review`
// dependency inside the task folder. That would let the task self-contain
// its CLI version. We've kept the system-binary approach for now because
// it matches how the rest of the UmActually repos distribute the CLI
// (via `bin/umactually-pr-review.mjs` at the repo root or as a published
// npm package). The end-state is to switch to a bundled `node_modules`
// once the task reaches v0.2.

import * as tl from "azure-pipelines-task-lib/task";
import * as path from "node:path";
import * as fs from "node:fs";

// ---------------------------------------------------------------------------
// Input reading
// ---------------------------------------------------------------------------

interface TaskInputs {
  /** Provider base URL (prefer the pipeline variable — see notes in task.json). */
  readonly apiUrl: string;
  /** Provider API key (secret — prefer the pipeline variable). */
  readonly apiKey: string;
  /** Provider model id (`auto` resolves per-provider + per-URL). */
  readonly model: string;
  /** Provider family: `openai-compatible` | `anthropic` | `copilot`. */
  readonly provider: "openai-compatible" | "anthropic" | "copilot";
  /** GitHub API base (Copilot token exchange; only used when provider=copilot). */
  readonly githubApiBase: string;
  /** Reasoning effort hint: `low` | `medium` | `high`. */
  readonly effort: "low" | "medium" | "high";
  /** Minimum severity threshold; below this tier is suppressed. */
  readonly minimumSeverity: "info" | "low" | "medium" | "high" | "critical";
  /** Cap on inline comments posted per run. */
  readonly maxComments: number;
  /** Cap on the number of changed files the live review will process. */
  readonly reviewFileLimit: number;
  /** Whether to include SonarQube context in the prompt. */
  readonly includeSonarqube: boolean;
  /** SonarQube base URL (only when includeSonarqube=true). */
  readonly sonarHostUrl: string;
  /** SonarQube auth token (only when includeSonarqube=true; secret). */
  readonly sonarToken: string;
  /** SonarQube project key (only when includeSonarqube=true). */
  readonly sonarProjectKey: string;
  /** When true, post inline threads (live mode). When false, generate-only. */
  readonly noDryRun: boolean;
  /** When true, run the leak-detector on top of the always-on redaction. */
  readonly detectLeaks: boolean;
  /** Maximum review wall-clock time in seconds. */
  readonly reviewTimeoutSeconds: number;
  /** Path (relative to agent cwd) where the raw provider response is written. */
  readonly outputArtifact: string;
}

function readInputs(): TaskInputs {
  const get = (name: string, required: boolean): string => {
    const v = tl.getInput(name, required);
    return (v ?? "").trim();
  };
  const getBool = (name: string): boolean => tl.getBoolInput(name, false);
  const getInt = (name: string, fallback: number): number => {
    const raw = tl.getInput(name, false);
    if (!raw) return fallback;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(`Invalid integer for input '${name}': ${raw}`);
    }
    return n;
  };

  const providerRaw = get("provider", true);
  const provider = providerRaw as TaskInputs["provider"];
  if (provider !== "openai-compatible" && provider !== "anthropic" && provider !== "copilot") {
    throw new Error(`Invalid provider: ${providerRaw}. Must be openai-compatible, anthropic, or copilot.`);
  }

  const effortRaw = get("effort", true);
  const effort = effortRaw as TaskInputs["effort"];
  if (effort !== "low" && effort !== "medium" && effort !== "high") {
    throw new Error(`Invalid effort: ${effortRaw}. Must be low, medium, or high.`);
  }

  const sevRaw = get("minimumSeverity", true);
  const minimumSeverity = sevRaw as TaskInputs["minimumSeverity"];
  if (!["info", "low", "medium", "high", "critical"].includes(minimumSeverity)) {
    throw new Error(`Invalid minimum-severity: ${sevRaw}.`);
  }

  const includeSonarqube = getBool("includeSonarqube");

  return {
    apiUrl: get("apiUrl", false),
    apiKey: get("apiKey", false),
    model: get("model", false) || "auto",
    provider,
    githubApiBase: get("githubApiBase", false) || "https://api.github.com",
    effort,
    minimumSeverity,
    maxComments: getInt("maxComments", 50),
    reviewFileLimit: getInt("reviewFileLimit", 200),
    includeSonarqube,
    sonarHostUrl: includeSonarqube ? get("sonarHostUrl", true) : "",
    sonarToken: includeSonarqube ? get("sonarToken", false) : "",
    sonarProjectKey: includeSonarqube ? get("sonarProjectKey", true) : "",
    noDryRun: getBool("noDryRun"),
    detectLeaks: getBool("detectLeaks"),
    reviewTimeoutSeconds: getInt("reviewTimeoutSeconds", 300),
    outputArtifact: get("outputArtifact", false) || "artifacts/manual/s4-azure-mocked-run.json",
  };
}

// ---------------------------------------------------------------------------
// Pipeline-context detection
// ---------------------------------------------------------------------------

interface AzureContext {
  readonly collectionUri: string;
  readonly teamProject: string;
  readonly repositoryName: string;
  readonly sourceCommit: string;
  readonly targetBranch: string;
  readonly pullRequestId: string;
}

function readAzureContext(): AzureContext {
  const collectionUri = tl.getVariable("SYSTEM_COLLECTIONURI");
  const teamProject = tl.getVariable("SYSTEM_TEAMPROJECT");
  const repositoryName = tl.getVariable("BUILD_REPOSITORY_NAME");
  const sourceCommit = tl.getVariable("BUILD_SOURCEVERSION");
  const targetBranch = tl.getVariable("SYSTEM_PULLREQUEST_TARGETBRANCHNAME")
    ?? tl.getVariable("BUILD_SOURCEBRANCHNAME")
    ?? "refs/heads/main";
  const pullRequestId = tl.getVariable("SYSTEM_PULLREQUEST_PULLREQUESTID");
  if (!collectionUri) throw new Error("SYSTEM_COLLECTIONURI is not set; this task must run in an Azure Pipelines PR build.");
  if (!teamProject) throw new Error("SYSTEM_TEAMPROJECT is not set.");
  if (!repositoryName) throw new Error("BUILD_REPOSITORY_NAME is not set.");
  if (!pullRequestId) throw new Error("SYSTEM_PULLREQUEST_PULLREQUESTID is not set; this task only runs on PR validation builds. Manual branch runs are not supported.");
  return {
    collectionUri,
    teamProject,
    repositoryName,
    sourceCommit: sourceCommit ?? "",
    targetBranch,
    pullRequestId,
  };
}

// ---------------------------------------------------------------------------
// CLI resolution
// ---------------------------------------------------------------------------

interface CliResolution {
  /** The CLI entry path (absolute) or "node" if the CLI is on PATH. */
  readonly command: string;
  /** The arguments that come AFTER the command (e.g. `["./bin/umactually-pr-review.mjs"]` or `[]`). */
  readonly argsPrefix: readonly string[];
  /** Where the CLI came from (for diagnostics). */
  readonly source: "bundled" | "PATH" | "REPO_BIN";
}

/**
 * Locate the UmActually CLI to invoke.
 *
 * Resolution order:
 *   1. Bundled with the task (when the task ships its own node_modules).
 *      Path: <taskFolder>/node_modules/umactually-pr-review/bin/umactually-pr-review.mjs
 *   2. In the repo's `bin/` directory (when the task runs from a checkout).
 *      Path: <repoRoot>/bin/umactually-pr-review.mjs
 *   3. On PATH as `umactually-pr-review` (when installed via npm globally).
 *
 * The current implementation only resolves option 2 (repo bin/). Option 1
 * (bundled) is the v0.2 plan once the task reaches a stable API. Option 3
 * is the fallback for users who installed the CLI via `npm install -g`.
 */
function resolveCli(taskFolder: string, cwd: string): CliResolution {
  // The v0.2 plan is to bundle `umactually-pr-review` as a
  // node_modules dependency inside the task folder at
  // `<taskFolder>/node_modules/umactually-pr-review/bin/...`. For
  // v0.1 we resolve from the agent cwd's `bin/` directory.
  const bundled = path.join(
    taskFolder,
    "node_modules",
    "umactually-pr-review",
    "bin",
    "umactually-pr-review.mjs",
  );
  if (fs.existsSync(bundled)) {
    return { command: "node", argsPrefix: [bundled], source: "bundled" };
  }
  const repoBin = path.join(cwd, "bin", "umactually-pr-review.mjs");
  if (fs.existsSync(repoBin)) {
    return { command: "node", argsPrefix: [repoBin], source: "REPO_BIN" };
  }
  const onPath = tl.which("umactually-pr-review", false);
  if (onPath) {
    return { command: onPath, argsPrefix: [], source: "PATH" };
  }
  throw new Error(
    `Could not locate the UmActually CLI. Looked for:
    1. ${bundled} (bundled in the task — v0.2 layout)
    2. ${repoBin} (repo bin/ directory — run from a checkout that has npm run bundle)
    3. 'umactually-pr-review' on PATH (npm install -g umactually-pr-review)
    Add one of these to fix.`,
  );
}

// ---------------------------------------------------------------------------
// Build the CLI command
// ---------------------------------------------------------------------------

interface CliInvocation {
  readonly tool: string;
  readonly args: readonly string[];
  /** Optional env overrides to apply to the spawned process. */
  readonly env: Record<string, string>;
}

function buildInvocation(
  inputs: TaskInputs,
  ctx: AzureContext,
  cli: CliResolution,
): CliInvocation {
  const args: string[] = [
    "--platform", "azure-devops",
    "--pr-number", ctx.pullRequestId,
    "--repo", ctx.repositoryName,
    "--api-url", inputs.apiUrl || (process.env["UMACTUALLY_API_URL"] ?? ""),
    "--api-key", inputs.apiKey || (process.env["UMACTUALLY_API_KEY"] ?? ""),
    "--model", inputs.model,
    "--provider", inputs.provider,
    "--github-api-base", inputs.githubApiBase,
    "--effort", inputs.effort,
    "--max-comments", String(inputs.maxComments),
    "--review-file-limit", String(inputs.reviewFileLimit),
    "--review-timeout-seconds", String(inputs.reviewTimeoutSeconds),
    "--minimum-severity", inputs.minimumSeverity,
    "--output-artifact", inputs.outputArtifact,
  ];

  if (inputs.includeSonarqube) {
    args.push("--include-sonarqube");
    if (inputs.sonarHostUrl) args.push("--sonar-host-url", inputs.sonarHostUrl);
    if (inputs.sonarToken) args.push("--sonar-token", inputs.sonarToken);
    if (inputs.sonarProjectKey) args.push("--sonar-project-key", inputs.sonarProjectKey);
  }

  if (inputs.noDryRun) {
    args.push("--no-dry-run");
  } else {
    args.push("--dry-run");
  }

  if (!inputs.detectLeaks) {
    args.push("--no-detect-leaks");
  }

  return {
    tool: cli.command,
    args: [...cli.argsPrefix, ...args],
    env: {
      // SYSTEM_ACCESSTOKEN is the build service identity — the CLI uses
      // it to read the PR diff and post review threads. Inherit from
      // the agent's env unless the operator pinned a specific token
      // via the `secureEnv: UMACTUALLY_ADO_TOKEN` override.
      SYSTEM_ACCESSTOKEN: process.env["SYSTEM_ACCESSTOKEN"] ?? "",
      SYSTEM_COLLECTIONURI: ctx.collectionUri,
      SYSTEM_TEAMPROJECT: ctx.teamProject,
      BUILD_REPOSITORY_NAME: ctx.repositoryName,
      BUILD_SOURCEVERSION: ctx.sourceCommit,
      SYSTEM_PULLREQUEST_PULLREQUESTID: ctx.pullRequestId,
      SYSTEM_PULLREQUEST_TARGETBRANCHNAME: ctx.targetBranch,
    },
  };
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

interface CliResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly findingCount: number;
  readonly severityHighCount: number;
}

// The redactSecretsForLog helper is in its own file (./redact-secrets.ts)
// so it can be unit-tested without booting the full task pipeline.
// The helper is pure: no azure-pipelines-task-lib dependencies, no
// top-level side effects. See ./tests/redact-secrets.test.ts.
import { redactSecretsForLog } from "./redact-secrets.js";

async function runCli(invocation: CliInvocation, timeoutMs: number): Promise<CliResult> {
  const { tool, args, env } = invocation;
  // Mask any value passed via --api-key, --sonar-token before logging.
  // Build logs are typically retained and visible to a wider audience
  // than the secret — leaking the key into the log would defeat the
  // whole redaction layer. Mirrors the same concern as parent repo
  // finding #2270 (chunk-failure sanitization in orchestrator.ts).
  const maskedArgs = redactSecretsForLog(args);
  console.log(`[umactually] $ ${tool} ${maskedArgs.join(" ")}`);

  // Use spawn so we get a real handle for timeout/streaming.
  const { spawn } = await import("node:child_process");
  return new Promise<CliResult>((resolve) => {
    const child = spawn(tool, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let killedByTimeout = false;

    child.stdout.on("data", (chunk: Buffer | string) => {
      const s = chunk.toString();
      stdout += s;
      process.stdout.write(s);
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      const s = chunk.toString();
      stderr += s;
      process.stderr.write(s);
    });

    const timer = setTimeout(() => {
      killedByTimeout = true;
      child.kill("SIGTERM");
      // Escalate to SIGKILL after 10s of grace.
      setTimeout(() => { try { child.kill("SIGKILL"); } catch { /* ignore */ } }, 10_000);
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      console.error(`[umactually] Failed to spawn CLI: ${err.message}`);
      resolve({
        exitCode: 1,
        stdout,
        stderr: stderr + `\n[umactually] spawn error: ${err.message}`,
        findingCount: 0,
        severityHighCount: 0,
      });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      const exitCode = killedByTimeout ? 124 : (code ?? 1);
      const findingCount = parseFindingCount(stdout);
      const severityHighCount = parseSeverityCount(stdout, "high");
      resolve({ exitCode, stdout, stderr, findingCount, severityHighCount });
    });
  });
}

/**
 * Pull the inline finding count out of the CLI's stdout. The CLI emits
 * a `📊 N inline findings` line as part of its summary card; we
 * parse it best-effort. If the format ever changes, the task still
 * succeeds — it just emits `0` for the output variable.
 */
function parseFindingCount(stdout: string): number {
  const m = stdout.match(/(\d+)\s+inline\s+findings/);
  return m ? Number.parseInt(m[1]!, 10) : 0;
}

/**
 * Parse a severity-tier count from the CLI's review summary. The CLI
 * renders a tally like:
 *   🏷️ `1` critical · `2` high · `5` medium · `3` low*
 * We use the `* N high` form (whitespace-tolerant).
 */
function parseSeverityCount(stdout: string, tier: string): number {
  const m = stdout.match(new RegExp(`\`(\\d+)\`\\s+${tier}\\b`));
  return m ? Number.parseInt(m[1]!, 10) : 0;
}

// ---------------------------------------------------------------------------
// Task entry
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  try {
    // isOutput: true exposes the variable to downstream *jobs* in the
    // same pipeline, not just downstream *steps* in the same job.
    // This is what enables a branch policy that gates a subsequent
    // stage on the review result (e.g. a "deploy only if review
    // passed" gate). The `false` second-to-last argument is `secret:
    // false` (these are not credentials).
    tl.setVariable("UMACTUALLY_REVIEWED", "false", false, true);
    const inputs = readInputs();
    const ctx = readAzureContext();

    console.log(`[umactually] PR #${ctx.pullRequestId} in ${ctx.teamProject}/${ctx.repositoryName} @ ${ctx.sourceCommit.slice(0, 12)}`);

    // The task folder is reserved for a future bundled-CLI layout (v0.2).
    // For v0.1, the CLI is resolved from the agent cwd's `bin/` directory.
    const cli = resolveCli(path.dirname(__filename), process.cwd());
    console.log(`[umactually] Using CLI from ${cli.source} (${cli.command} ${cli.argsPrefix.join(" ")})`);

    const invocation = buildInvocation(inputs, ctx, cli);
    const timeoutMs = inputs.reviewTimeoutSeconds * 1000;
    const result = await runCli(invocation, timeoutMs);

    // Set output variables for downstream steps / pipeline dashboard.
    // isOutput: true exposes the variable to downstream *jobs* in the
    // same pipeline (so a subsequent stage can branch on the result).
    // These three variables form the canonical dashboard surface for
    // branch policies that gate on review results.
    tl.setVariable("UMACTUALLY_REVIEWED", result.exitCode === 0 ? "true" : "false", false, true);
    tl.setVariable("UMACTUALLY_FINDING_COUNT", String(result.findingCount), false, true);
    tl.setVariable("UMACTUALLY_SEVERITY_HIGH_COUNT", String(result.severityHighCount), false, true);

    // Always upload the output artifact (regardless of pass/fail) so the
    // operator can inspect what the review found.
    if (inputs.outputArtifact) {
      const abs = path.isAbsolute(inputs.outputArtifact)
        ? inputs.outputArtifact
        : path.join(process.cwd(), inputs.outputArtifact);
      if (fs.existsSync(abs)) {
        console.log(`[umactually] Output artifact: ${abs}`);
        // addAttachment(type, name, path) — the "type" is the
        // attachment MIME category, "name" is what the user sees
        // in the pipeline UI attachment picker, "path" is the
        // absolute filesystem path.
        tl.addAttachment("umactually-review", "umactually-review.json", abs);
      } else {
        console.log(`[umactually] (no output artifact at ${abs})`);
      }
    }

    if (result.exitCode === 0) {
      if (inputs.noDryRun) {
        tl.setResult(tl.TaskResult.Succeeded, `UmActually review complete. Posted ${result.findingCount} inline comment(s).`);
      } else {
        tl.setResult(tl.TaskResult.Succeeded, `UmActually review complete (dry-run). Generated ${result.findingCount} comment(s).`);
      }
    } else if (result.exitCode === 124) {
      // setResult for TaskResult.Failed requires a message string as
      // the second argument; the third argument is `done: boolean`
      // (default true), not a category. The category is conveyed via
      // the message prefix.
      tl.setResult(
        tl.TaskResult.Failed,
        `[ReviewTimeout] UmActually review exceeded the configured timeout of ${inputs.reviewTimeoutSeconds} seconds.`,
      );
    } else {
      tl.setResult(
        tl.TaskResult.Failed,
        `[ReviewFailed] UmActually review failed with exit code ${result.exitCode}. See the build log for the CLI's stdout/stderr.`,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[umactually] Task error: ${message}`);
    tl.setResult(tl.TaskResult.Failed, `[TaskError] UmActually task failed: ${message}`);
  }
}

run();
