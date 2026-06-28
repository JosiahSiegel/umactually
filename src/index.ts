import { runCli } from "./cli.js";
import { readActionInputs, type ActionInputs } from "./action/read-inputs.js";

export async function main(): Promise<void> {
  try {
    const args = buildArgs(process.env);
    const cwd = process.cwd();
    const result = await runCli(args, cwd);
    if (result.exitCode !== 0) {
      process.exit(result.exitCode);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`::error::umactually-pr-review: ${message}\n`);
    process.exit(1);
  }
}

/**
 * Build the CLI argv from the runtime env. Three paths:
 * - GitHub Actions: map INPUT_* and GitHub runtime vars to CLI flags.
 * - Azure DevOps:   map INPUT_* and TF_BUILD vars to CLI flags.
 * - Bare CLI:       pass through process.argv.slice(2) unchanged.
 *
 * --dry-run is the default safety net; --no-dry-run is passed only when
 * INPUT_DRY_RUN is explicitly "false". --detect-leaks defaults to true.
 */
function buildArgs(env: NodeJS.ProcessEnv): readonly string[] {
  if (env["GITHUB_ACTIONS"] === "true") {
    return buildGithubArgs(env);
  }
  if (env["TF_BUILD"] === "True") {
    return buildAzureArgs(env);
  }
  return process.argv.slice(2);
}

function buildGithubArgs(env: NodeJS.ProcessEnv): readonly string[] {
  const inputs = readActionInputs(env);
  const args: string[] = [];

  // --platform: INPUT_PLATFORM (auto|github|azure) overrides detection. Default github.
  const platform = inputs.platform === "azure" ? "azure-devops" : "github";
  args.push("--platform", platform);

  pushFlagValue(args, "--event", envFallback(env["INPUT_EVENT"], env["GITHUB_EVENT_PATH"]));
  pushFlagValue(args, "--diff", envFallback(env["INPUT_DIFF"], env["DIFF_PATH"]));
  pushFlagValue(args, "--review", env["INPUT_REVIEW"]);
  pushFlagValue(args, "--api-url", inputs.apiUrl);
  pushFlagValue(args, "--api-key", inputs.apiKey);
  pushFlagValue(args, "--model", inputs.model);
  pushFlagValue(args, "--prompt-file", inputs.promptFile);
  pushFlagValue(args, "--additional-prompt-file", inputs.additionalPromptFile);
  pushFlagValue(args, "--sonar-host-url", inputs.sonarHostUrl);
  pushFlagValue(args, "--sonar-token", inputs.sonarToken);
  pushFlagValue(args, "--sonar-project-key", inputs.sonarProjectKey);

  pushNumber(args, "--review-timeout-seconds", inputs.reviewTimeoutSeconds);
  pushNumber(args, "--stall-seconds", inputs.stallSeconds);
  pushNumber(args, "--max-output-tokens", inputs.maxOutputTokens);

  pushBool(args, inputs.ignoreMinor, "--ignore-minor");
  pushBool(args, inputs.includeSonarqube, "--include-sonarqube");
  pushBool(args, inputs.walkthrough, "--walkthrough");
  pushBool(args, inputs.diagnostic, "--diagnostic");
  pushBool(args, inputs.debugRawResponse, "--debug-raw-response");

  args.push(inputs.detectLeaks ? "--detect-leaks" : "--no-detect-leaks");
  pushDryRunFlag(args, inputs);

  pushFlagValue(
    args,
    "--output-artifact",
    envFallback(env["INPUT_OUTPUT_ARTIFACT"], "artifacts/manual/s1-github-self-review.md"),
  );

  return args;
}

function buildAzureArgs(env: NodeJS.ProcessEnv): readonly string[] {
  const inputs = readActionInputs(env);
  const args: string[] = ["--platform", "azure-devops"];

  pushFlagValue(args, "--event", envFallback(env["INPUT_EVENT"], env["AZURE_PULL_REQUEST_PATH"]));
  pushFlagValue(
    args,
    "--diff",
    envFallback(env["INPUT_DIFF"], env["AZURE_DIFF_PATH"], env["DIFF_PATH"]),
  );
  pushFlagValue(args, "--threads", envFallback(env["INPUT_THREADS"], env["AZURE_THREADS_PATH"]));
  pushFlagValue(args, "--review", envFallback(env["INPUT_REVIEW"], env["AZURE_REVIEW_PATH"]));
  pushFlagValue(args, "--api-url", inputs.apiUrl);
  pushFlagValue(args, "--api-key", inputs.apiKey);
  pushFlagValue(args, "--model", inputs.model);
  pushFlagValue(args, "--prompt-file", inputs.promptFile);
  pushFlagValue(args, "--additional-prompt-file", inputs.additionalPromptFile);
  pushFlagValue(args, "--pr-number", inputs.prNumber);
  pushFlagValue(args, "--repo", inputs.repo);
  pushFlagValue(args, "--sonar-host-url", inputs.sonarHostUrl);
  pushFlagValue(args, "--sonar-token", inputs.sonarToken);
  pushFlagValue(args, "--sonar-project-key", inputs.sonarProjectKey);

  pushNumber(args, "--review-timeout-seconds", inputs.reviewTimeoutSeconds);
  pushNumber(args, "--stall-seconds", inputs.stallSeconds);
  pushNumber(args, "--max-output-tokens", inputs.maxOutputTokens);

  pushBool(args, inputs.ignoreMinor, "--ignore-minor");
  pushBool(args, inputs.includeSonarqube, "--include-sonarqube");
  pushBool(args, inputs.walkthrough, "--walkthrough");
  pushBool(args, inputs.diagnostic, "--diagnostic");
  pushBool(args, inputs.debugRawResponse, "--debug-raw-response");

  args.push(inputs.detectLeaks ? "--detect-leaks" : "--no-detect-leaks");
  pushDryRunFlag(args, inputs);

  pushFlagValue(
    args,
    "--output-artifact",
    envFallback(env["INPUT_OUTPUT_ARTIFACT"], "artifacts/manual/s4-azure-mocked-run.json"),
  );

  return args;
}

function pushFlagValue(args: string[], flag: string, value: string | undefined): void {
  if (typeof value === "string" && value.length > 0) {
    args.push(flag, value);
  }
}

function envFallback(...values: ReadonlyArray<string | undefined>): string {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "";
}

function pushNumber(args: string[], flag: string, value: number): void {
  args.push(flag, String(value));
}

function pushBool(args: string[], condition: boolean, flag: string): void {
  if (condition) {
    args.push(flag);
  }
}

function pushDryRunFlag(args: string[], inputs: ActionInputs): void {
  // Force --dry-run when INPUT_DRY_RUN is unset or true. When INPUT_DRY_RUN is
  // explicitly false, push --no-dry-run so the CLI's dispatchLive path runs.
  if (inputs.dryRun) {
    args.push("--dry-run");
  } else {
    args.push("--no-dry-run");
  }
}

const isMainEntry = (() => {
  if (typeof process === "undefined") {
    return false;
  }
  const argv1 = process.argv[1];
  if (argv1 === undefined) {
    return false;
  }
  return import.meta.url === pathToFileUrl(argv1);
})();

if (isMainEntry) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`::error::umactually-pr-review: ${message}\n`);
    process.exit(1);
  });
}

function pathToFileUrl(value: string): string {
  return new URL(`file://${value.replace(/\\/gu, "/")}`).href;
}