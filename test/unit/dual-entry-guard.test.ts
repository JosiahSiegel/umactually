import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const PACKAGE_ROOT = resolve(__dirname, "..", "..");
const DIST_INDEX = join(PACKAGE_ROOT, "dist", "index.js");
const DIST_CLI = join(PACKAGE_ROOT, "dist", "cli.js");
const BIN_CLI = join(PACKAGE_ROOT, "bin", "umactually-pr-review.mjs");
const NODE_BIN = process.execPath;

const ENV_KEYS_TO_CLEAR = [
  "GITHUB_ACTIONS",
  "TF_BUILD",
  "INPUT_EVENT",
  "INPUT_DIFF",
  "INPUT_API_URL",
  "INPUT_API_KEY",
  "INPUT_DRY_RUN",
  "INPUT_REVIEW",
  "INPUT_PLATFORM",
  "INPUT_OUTPUT_ARTIFACT",
  "GITHUB_EVENT_PATH",
  "DIFF_PATH",
  "UMACTUALLY_API_URL",
  "UMACTUALLY_API_KEY",
  "REVIEW_PROVIDER_API_KEY",
  "REVIEW_PROVIDER_URL",
] as const;

function buildCleanEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of ENV_KEYS_TO_CLEAR) {
    delete env[key];
  }
  return env;
}

function spawnBundle(args: readonly string[], env: NodeJS.ProcessEnv): ReturnType<typeof spawnSync> {
  return spawnSync(NODE_BIN, [DIST_INDEX, ...args], {
    cwd: PACKAGE_ROOT,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

describe("dual-entry guard for dist/index.js", () => {
  it("dist/index.js and dist/cli.js both exist (build prerequisites)", () => {
    // Given: the action bundle is required for this test to be meaningful.
    // Then: both bundles must be present so the action entry path can be
    // distinguished from the CLI entry path.
    expect(existsSync(DIST_INDEX)).toBe(true);
    expect(existsSync(DIST_CLI)).toBe(true);
  });

  it("running dist/index.js with no args does NOT emit cli.ts validation errors", () => {
    // Given: a clean env (no GITHUB_ACTIONS, no TF_BUILD, no INPUT_*) and the
    // canonical action entry bundle. process.argv[1] inside the spawned Node
    // process is naturally the bundle path.
    const env = buildCleanEnv();

    // When: dist/index.js is invoked with no command-line args. The action
    // entry's src_main() must run; cli.ts's own auto-invoke must NOT fire
    // (otherwise it would short-circuit src_main by calling process.exit(2)).
    const result = spawnBundle([], env);

    // Then: stderr must not contain any cli.ts validation message
    // ("cli: --event is required...", "cli: --diff is required...", etc.).
    // Those messages come from collectValidationErrors in src/cli/validate.ts
    // and are written when runCli is called with an argv that fails the
    // required-flag check. The fix forces src_main to build non-empty args.
    const stderr = result.stderr ?? "";
    expect(stderr).not.toMatch(/cli: --event is required/);
    expect(stderr).not.toMatch(/cli: --diff is required/);
    expect(stderr).not.toMatch(/cli: --api-url is required/);
    expect(stderr).not.toMatch(/cli: --api-key is required/);
  });

  it("running dist/index.js with GITHUB_ACTIONS=true does NOT emit cli.ts validation errors", () => {
    // Given: GitHub Actions runtime, no INPUT_* provided. The action should
    // run as a self-review placeholder dry-run.
    const env: NodeJS.ProcessEnv = { ...buildCleanEnv(), GITHUB_ACTIONS: "true" };

    // When: dist/index.js is invoked with no command-line args.
    const result = spawnBundle([], env);

    // Then: same as above — no cli.ts validation errors.
    const stderr = result.stderr ?? "";
    expect(stderr).not.toMatch(/cli: --event is required/);
    expect(stderr).not.toMatch(/cli: --diff is required/);
    expect(stderr).not.toMatch(/cli: --api-url is required/);
    expect(stderr).not.toMatch(/cli: --api-key is required/);
  });

  it("the cli.ts entry path (via bin/umactually-pr-review.mjs --help) still works and emits no validation errors", () => {
    // Given: a clean env so the bin wrapper runs the bare CLI path.
    const env = buildCleanEnv();

    // When: the CLI wrapper delegates to dist/cli.js with --help.
    const result = spawnSync(NODE_BIN, [BIN_CLI, "--help"], {
      cwd: PACKAGE_ROOT,
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Then: the CLI help text is on stdout and there are no validation errors.
    expect(result.status).toBe(0);
    const stdout = result.stdout ?? "";
    expect(stdout).toMatch(/umactually-pr-review/);
    const stderr = result.stderr ?? "";
    expect(stderr).not.toMatch(/cli: --event is required/);
    expect(stderr).not.toMatch(/cli: --diff is required/);
  });
});