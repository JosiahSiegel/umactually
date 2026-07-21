// SPDX-License-Identifier: MIT
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

import { parseReleaseTargets } from "../../scripts/release-targets.ts";
import { NODE_24_REQUIRED } from "../helpers/node-version-gate.ts";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const BUILD_SCRIPT = join(REPO_ROOT, "scripts", "build-binary.mjs");
const TARGETS = parseReleaseTargets({
  manifestPath: join(REPO_ROOT, "scripts", "release-targets.json"),
});
const PACKAGE_VERSION = JSON.parse(
  readFileSync(join(REPO_ROOT, "package.json"), "utf8"),
) as { readonly version: string };
const CLEANED_ENV_KEYS = [
  "BUN_OPTIONS",
  "BUN_CONFIG_VERBOSE_FETCH",
  "BUN_CONFIG_MAX_HTTP_REQUESTS",
  "BUN_CONFIG_NO_CLEAR_TERMINAL",
  "BUN_CONFIG_REGISTRY",
  "BUN_INSTALL",
] as const;

type CapturedInvocation = Readonly<{
  argv: readonly string[];
  env: Readonly<Record<string, string>>;
}>;

type BuildResult = Readonly<{
  status: number | null;
  stderr: string;
  invocation?: CapturedInvocation;
  sandbox: string;
}>;

const sandboxes: string[] = [];
afterEach(() => {
  for (const sandbox of sandboxes.splice(0)) {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

function runBuild(fakeVersion: string, targetId: string): BuildResult {
  const sandbox = join(tmpdir(), `umactually-build-policy-${crypto.randomUUID()}`);
  sandboxes.push(sandbox);
  const capturePath = join(sandbox, "capture.json");
  mkdirSync(join(sandbox, "preserved-tmp"), { recursive: true });
  const harness = join(REPO_ROOT, "test", "helpers", "fake-bun-build.mjs");

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TMPDIR: join(sandbox, "preserved-tmp"),
    UMACTUALLY_FAKE_BUN_VERSION: fakeVersion,
    UMACTUALLY_BUILD_CAPTURE_PATH: capturePath,
    UMACTUALLY_NEUTRAL_SENTINEL: "preserved",
    // Test seam: build-binary.mjs uses this path as the `bun` binary and runs
    // it via Node (because the path ends in `.mjs`). Production ignores this.
    UMACTUALLY_BUN_BIN: harness,
    NODE_OPTIONS: undefined,
  };
  for (const key of CLEANED_ENV_KEYS) {
    env[key] = `seeded-${key}`;
  }

  // Spawn build-binary.mjs as a direct Node child. The build script runs with
  // the same argv shape production would produce (argv[0]=node,
  // argv[1]=build-binary.mjs, argv[2]=targetId), and the test seam
  // UMACTUALLY_BUN_BIN routes every `bun` invocation into the harness script.
  const result = spawnSync(
    process.execPath,
    [BUILD_SCRIPT, targetId],
    { cwd: REPO_ROOT, env, encoding: "utf8" },
  );
  const invocation = existsSync(capturePath)
    ? JSON.parse(readFileSync(capturePath, "utf8")) as CapturedInvocation
    : undefined;
  // exactOptionalPropertyTypes: omit `invocation` entirely when absent so the
  // return type is compatible with `invocation?: CapturedInvocation`.
  const base: {
    status: number | null;
    stderr: string;
    invocation?: CapturedInvocation;
    sandbox: string;
  } = { status: result.status, stderr: result.stderr, sandbox };
  if (invocation !== undefined) {
    base.invocation = invocation;
  }
  return base;
}

describe.skipIf(NODE_24_REQUIRED)("standalone binary build policy", () => {
  it("rejects every Bun version except exact 1.3.14 before spawning a build", () => {
    const accepted = runBuild("1.3.14", "linux-x64");
    expect(accepted.status, accepted.stderr).toBe(0);
    expect(accepted.invocation).toBeDefined();

    for (const version of ["1.3.13", "1.3.15", "1.3.14-canary.1"]) {
      const rejected = runBuild(version, "linux-x64");
      expect(rejected.status, version).toBe(1);
      expect(rejected.invocation, version).toBeUndefined();
      expect(rejected.stderr, version).toContain("1.3.14");
      expect(rejected.stderr, version).toContain(version);
    }
  });

  it("spawns each manifest target with the exact reviewed flags and no bytecode", () => {
    for (const target of TARGETS) {
      const result = runBuild("1.3.14", target.id);
      expect(result.status, result.stderr).toBe(0);
      expect(result.invocation?.argv, result.stderr).toEqual([
        "build",
        join(REPO_ROOT, "scripts", "compile-entry.ts"),
        "--compile",
        "--minify",
        "--sourcemap",
        "--no-compile-autoload-dotenv",
        "--no-compile-autoload-bunfig",
        `--target=${target.bunTarget}`,
        `--outfile=${join(REPO_ROOT, "release", target.rawName)}`,
        `--define=UMACTUALLY_VERSION='"${PACKAGE_VERSION.version}"'`,
      ]);
      expect(result.invocation?.argv.some((arg) => arg.includes("bytecode"))).toBe(false);
    }
  });

  it.each(CLEANED_ENV_KEYS)("deletes %s from the Bun build child environment", (key) => {
    const result = runBuild("1.3.14", "linux-x64");
    expect(result.status, result.stderr).toBe(0);
    expect(result.invocation?.env[key]).toBeUndefined();
  });

  it("preserves PATH, TMPDIR, and unrelated environment variables", () => {
    const result = runBuild("1.3.14", "linux-x64");
    expect(result.status, result.stderr).toBe(0);
    // PATH is preserved verbatim from the test runner — `bun` resolution no
    // longer goes through PATH because the test seam points straight at the
    // harness script, but PATH must still survive end-to-end so the produced
    // standalone binaries can locate their dependencies.
    expect(result.invocation?.env["PATH"]).toBe(process.env["PATH"]);
    expect(result.invocation?.env["TMPDIR"]).toBe(join(result.sandbox, "preserved-tmp"));
    expect(result.invocation?.env["UMACTUALLY_NEUTRAL_SENTINEL"]).toBe("preserved");
  });
});
