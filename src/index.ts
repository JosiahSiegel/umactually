import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import { runCli } from "./cli.js";
import { appendCommonInputArgs } from "./action/append-cli-inputs.js";
import { readActionInputs } from "./action/read-inputs.js";

declare global {
  // Cross-module flag the action entry sets at module load so the bundled
  // cli.ts module (concatenated into the same file) skips its auto-invoke.
  // Set BEFORE the isMainEntry block so it is observable to the cli.ts IIFE
  // that runs during this module's evaluation.
  var __umactually_action_entry__: boolean | undefined;
}

globalThis.__umactually_action_entry__ = true;

export async function main(): Promise<void> {
  try {
    const cwd = process.cwd();
    const args = await buildArgs(process.env, cwd);
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
 * Build the CLI argv from the runtime env. Two paths:
 * - Azure DevOps:   TF_BUILD is set, map INPUT_* and Azure runtime vars to CLI flags.
 * - GitHub Actions (default): map INPUT_* and GitHub runtime vars to CLI flags.
 *   This includes the bare-`node dist/index.js` local-dev case (no env at all),
 *   which is the action entry path — we still build a non-empty argv so the
 *   CLI validation does not error out. When the workflow does not provide
 *   INPUT_EVENT or INPUT_DIFF, write small placeholder files so the CLI's
 *   required-flag validation passes; the dry-run default (also applied here)
 *   means no live provider call is made.
 *
 * --dry-run is the default safety net; --no-dry-run is passed only when
 * INPUT_DRY_RUN is explicitly "false". --detect-leaks defaults to true.
 *
 * When neither GITHUB_ACTIONS nor TF_BUILD is set AND INPUT_DRY_RUN is unset,
 * we are in the bare action-entry path (local dev). In that case we push
 * --dry-run explicitly so the CLI's required-flag validation does not fail
 * on missing API credentials. This is the same safety net readActionInputs
 * applies automatically inside GitHub Actions; we extend it to the bare case.
 */
export async function buildArgs(env: NodeJS.ProcessEnv, cwd: string): Promise<readonly string[]> {
  if (env["TF_BUILD"] === "True") {
    return buildAzureArgs(env);
  }
  const args = [...(await buildGithubArgs(env, cwd))];
  if (
    env["GITHUB_ACTIONS"] !== "true" &&
    env["INPUT_DRY_RUN"] === undefined
  ) {
    // Strip any --dry-run / --no-dry-run that buildGithubArgs pushed and
    // replace with --dry-run so the CLI's required-flag validation passes
    // even when no live API credentials are present.
    const filtered = args.filter(
      (value) => value !== "--dry-run" && value !== "--no-dry-run",
    );
    filtered.push("--dry-run");
    return filtered;
  }
  return args;
}

async function buildGithubArgs(env: NodeJS.ProcessEnv, cwd: string): Promise<readonly string[]> {
  const inputs = readActionInputs(env);
  const args: string[] = [];

  // --platform: INPUT_PLATFORM (auto|github|azure) overrides detection. Default github.
  const platform = inputs.platform === "azure" ? "azure-devops" : "github";
  args.push("--platform", platform);

  const eventPath = await resolveGithubEventPath(env, cwd);
  pushFlagValue(args, "--event", eventPath);

  const diffPath = await resolveGithubDiffPath(env, cwd);
  pushFlagValue(args, "--diff", diffPath);

  pushFlagValue(args, "--review", env["INPUT_REVIEW"]);
  appendCommonInputArgs(args, inputs);

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
  pushFlagValue(args, "--pr-number", inputs.prNumber);
  pushFlagValue(args, "--repo", inputs.repo);
  appendCommonInputArgs(args, inputs);

  pushFlagValue(
    args,
    "--output-artifact",
    envFallback(env["INPUT_OUTPUT_ARTIFACT"], "artifacts/manual/s4-azure-mocked-run.json"),
  );

  return args;
}

/**
 * Resolve the GitHub event path. Order:
 *  1. INPUT_EVENT explicit override
 *  2. GITHUB_EVENT_PATH (always present in pull_request runs)
 *  3. GITHUB_ACTIONS self-review placeholder (empty pull_request payload)
 */
async function resolveGithubEventPath(env: NodeJS.ProcessEnv, cwd: string): Promise<string> {
  const explicit = envFallback(env["INPUT_EVENT"], env["GITHUB_EVENT_PATH"]);
  if (explicit.length > 0) return explicit;
  return writePlaceholderFile(cwd, "event.json", GITHUB_PLACEHOLDER_EVENT);
}

/**
 * Resolve the diff path. Order:
 *  1. INPUT_DIFF explicit override
 *  2. DIFF_PATH (legacy alias)
 *  3. GITHUB_ACTIONS self-review placeholder (empty diff)
 */
async function resolveGithubDiffPath(env: NodeJS.ProcessEnv, cwd: string): Promise<string> {
  const explicit = envFallback(env["INPUT_DIFF"], env["DIFF_PATH"]);
  if (explicit.length > 0) return explicit;
  return writePlaceholderFile(cwd, "diff.patch", GITHUB_PLACEHOLDER_DIFF);
}

const GITHUB_PLACEHOLDER_EVENT = `${JSON.stringify(
  {
    action: "opened",
    number: 0,
    pull_request: {
      number: 0,
      state: "open",
      title: "self-review placeholder",
      body: "",
      head: { ref: "self-review", sha: "0000000000000000000000000000000000000000" },
      base: { ref: "main", sha: "0000000000000000000000000000000000000000" },
      user: { login: "umactually-bot" },
    },
    repository: {
      full_name: "local/self-review",
      name: "self-review",
      owner: { login: "local" },
    },
  },
  null,
  2,
)}\n`;

const GITHUB_PLACEHOLDER_DIFF = `diff --git a/.github/workflows/self-review.yml b/.github/workflows/self-review.yml
new file mode 100644
index 0000000..1111111
--- /dev/null
+++ b/.github/workflows/self-review.yml
@@ -0,0 +1,3 @@
+# self-review placeholder diff
+# the action wrote this file because the workflow did not provide INPUT_DIFF.
+# see src/action/read-inputs.ts and src/index.ts for the auto-fallback path.
`;

async function writePlaceholderFile(cwd: string, name: string, contents: string): Promise<string> {
  const dir = join(cwd, "artifacts", "manual");
  await mkdir(dir, { recursive: true });
  const filePath = isAbsolute(name) ? name : join(dir, name);
  await writeFile(filePath, contents, "utf8");
  return filePath;
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
