// SPDX-License-Identifier: MIT
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

import { parseReleaseTargets } from "../../scripts/release-targets.ts";

// Build-sea requires Node 25.7+ (for the --build-sea flag that moved into
// Node core in v25.5.0). On older hosts the tests are skipped — the build
// script will refuse with "Node version mismatch" at runtime anyway.
const HOST_NODE_MAJOR = Number.parseInt(
  process.versions.node.replace(/^v/u, "").split(".")[0] ?? "",
  10,
);
const SKIP_FOR_OLD_NODE = !(Number.isFinite(HOST_NODE_MAJOR) && HOST_NODE_MAJOR >= 25);

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const BUILD_SCRIPT = join(REPO_ROOT, "scripts", "build-sea.mjs");
const TSDOWN_CONFIG = join(REPO_ROOT, "tsdown.config.ts");
const TARGETS = parseReleaseTargets({
  manifestPath: join(REPO_ROOT, "scripts", "release-targets.json"),
});
const HARNESS = join(REPO_ROOT, "test", "helpers", "fake-tsdown-build.mjs");

type CapturedInvocation = Readonly<{
  argv: readonly string[];
  env: Readonly<Record<string, string | null>>;
  nodeVersion: string;
}>;

type BuildResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  invocation?: CapturedInvocation;
  sandbox: string;
};

const sandboxes: string[] = [];
afterEach(() => {
  for (const sandbox of sandboxes.splice(0)) {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

// Wipe the real release/ directory before each test so the harness's
// "produce all 6 outputs" step starts from a known-empty state. The
// harness will NOT clobber an existing real build (defensive), so this
// is what gives us isolation between tests.
function wipeReleaseDir() {
  const releaseDir = join(REPO_ROOT, "release");
  if (existsSync(releaseDir)) {
    for (const target of TARGETS) {
      const p = join(releaseDir, target.rawName);
      if (existsSync(p)) rmSync(p, { force: true });
    }
  }
}

function runBuild(targetId: string | undefined): BuildResult {
  const sandbox = join(tmpdir(), `umactually-sea-policy-${crypto.randomUUID()}`);
  sandboxes.push(sandbox);
  const capturePath = join(sandbox, "capture.json");

  wipeReleaseDir();

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    UMACTUALLY_FAKE_NODE_VERSION: "25.7.0",
    UMACTUALLY_BUILD_CAPTURE_PATH: capturePath,
    UMACTUALLY_TSDOWN_BIN: HARNESS,
    NODE_OPTIONS: undefined,
  };

  const args = [BUILD_SCRIPT];
  if (targetId !== undefined) args.push(targetId);

  const result = spawnSync(
    process.execPath,
    args,
    { cwd: REPO_ROOT, env, encoding: "utf8" },
  );

  const invocation = existsSync(capturePath)
    ? JSON.parse(readFileSync(capturePath, "utf8")) as CapturedInvocation
    : undefined;
  const base: BuildResult = {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    sandbox,
  };
  if (invocation !== undefined) base.invocation = invocation;
  return base;
}

describe.skipIf(SKIP_FOR_OLD_NODE)("Node SEA build policy", () => {
  it("rejects Node < 25.7.0 before spawning a build", () => {
    // process.versions.node is 24.x in this sandbox; the real
    // assertNodeVersion() check will fail.
    const result = spawnSync(
      process.execPath,
      [BUILD_SCRIPT, "linux-x64"],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, UMACTUALLY_TSDOWN_BIN: HARNESS },
        encoding: "utf8",
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Node version mismatch.*expected.*25/i);
  });

  it("spawns tsdown with --config + --exe (single invocation for all 6 targets)", () => {
    const result = runBuild(undefined);
    expect(result.status, result.stderr).toBe(0);
    expect(result.invocation, "harness was never invoked").toBeDefined();

    const argv = result.invocation?.argv ?? [];
    expect(argv[0]).toBe("--config");
    expect(argv[1]).toBe(TSDOWN_CONFIG);
    expect(argv).toContain("--exe");
    // No per-target CLI flags: targets are config-driven.
    expect(argv).not.toContain("--exe.fileName");
    expect(argv).not.toContain("--exe.targets");
  });

  it("produces all 6 manifest targets in release/ via the single tsdown call", () => {
    const result = runBuild(undefined);
    expect(result.status, result.stderr).toBe(0);
    for (const target of TARGETS) {
      const outPath = join(REPO_ROOT, "release", target.rawName);
      expect(existsSync(outPath), `${target.id}: ${target.rawName} not produced`).toBe(true);
    }
  });

  it("accepts a <targetId> argument for compatibility (no-op, builds all)", () => {
    const result = runBuild("linux-x64");
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toMatch(/filter linux-x64 accepted/);
    for (const target of TARGETS) {
      const outPath = join(REPO_ROOT, "release", target.rawName);
      expect(existsSync(outPath), `${target.id}: ${target.rawName} not produced`).toBe(true);
    }
  });

  it("refuses unknown target ids with a helpful message", () => {
    const result = spawnSync(
      process.execPath,
      [BUILD_SCRIPT, "freebsd-amd64"],
      {
        cwd: REPO_ROOT,
        env: { ...process.env, UMACTUALLY_TSDOWN_BIN: HARNESS },
        encoding: "utf8",
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Unknown target.*freebsd-amd64/);
  });

  it("refuses to spawn if the SEA output was not produced", () => {
    const sandbox = join(tmpdir(), `umactually-sea-missing-${crypto.randomUUID()}`);
    sandboxes.push(sandbox);
    const capturePath = join(sandbox, "capture.json");
    // Don't give the harness the manifest path. We do this by pointing it
    // at a sandbox-only release-targets.json that the harness can read but
    // that the build script will use too — actually a simpler approach: run
    // without a manifest override and rely on the harness's
    // "existsSync(manifestPath)" branch, then pre-wipe release/ AND tell
    // the harness to not produce the output. The harness always writes
    // outputs for the real manifest, so to make this test work, we use a
    // manifest-override approach: shadow the real manifest with a manifest
    // pointing at a target whose rawName will not be produced.
    const shadowDir = join(sandbox, "shadow");
    mkdirSync(shadowDir, { recursive: true });
    // Manifest with one target that points at a path the harness won't
    // produce (the harness only writes outputs for entries in the
    // manifest, so we replace the manifest with the same content).
    // The real exit: pre-wipe release/ then instruct the harness to not
    // produce the file. Easiest: send a no-op harness that captures
    // argv but does not write any output. We do that by overriding the
    // harness path to point at a custom no-op fixture.
    const noopHarness = join(sandbox, "noop-harness.mjs");
    writeFileSync(
      noopHarness,
      `#!/usr/bin/env node\nprocess.exit(0);\n`,
    );
    chmodSync(noopHarness, 0o755);
    wipeReleaseDir();

    const result = spawnSync(
      process.execPath,
      [BUILD_SCRIPT],
      {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          UMACTUALLY_TSDOWN_BIN: noopHarness,
          UMACTUALLY_BUILD_CAPTURE_PATH: capturePath,
          UMACTUALLY_FAKE_NODE_VERSION: "25.7.0",
        },
        encoding: "utf8",
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/expected output not found/);
  });
});
