// SPDX-License-Identifier: MIT
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
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

function runBuild(targetId: string): BuildResult {
  const sandbox = join(tmpdir(), `umactually-sea-policy-${crypto.randomUUID()}`);
  sandboxes.push(sandbox);
  const capturePath = join(sandbox, "capture.json");
  const releaseDir = join(sandbox, "release");
  mkdirSync(releaseDir, { recursive: true });

  const target = TARGETS.find((t) => t.id === targetId);
  if (target === undefined) throw new Error(`runBuild: unknown target id "${targetId}"`);
  const fakeOutputPath = join(releaseDir, target.rawName);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    UMACTUALLY_FAKE_NODE_VERSION: "25.7.0",
    UMACTUALLY_BUILD_CAPTURE_PATH: capturePath,
    UMACTUALLY_FAKE_OUTPUT_PATH: fakeOutputPath,
    UMACTUALLY_TSDOWN_BIN: HARNESS,
    NODE_OPTIONS: undefined,
  };

  const result = spawnSync(
    process.execPath,
    [BUILD_SCRIPT, targetId],
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

function deriveExpectedPlatform(id: string): "darwin" | "linux" | "win" {
  if (id.startsWith("darwin-")) return "darwin";
  if (id.startsWith("linux-")) return "linux";
  return "win";
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

  it("spawns tsdown with --config + --exe + per-target fileName", () => {
    const target = TARGETS[0];
    if (target === undefined) throw new Error("no targets in manifest");
    const result = runBuild(target.id);
    expect(result.status, result.stderr).toBe(0);
    expect(result.invocation, "harness was never invoked").toBeDefined();

    const argv = result.invocation?.argv ?? [];
    expect(argv[0]).toBe("--config");
    expect(argv[1]).toBe(TSDOWN_CONFIG);
    const exeIdx = argv.indexOf("--exe");
    expect(exeIdx).toBeGreaterThanOrEqual(0);
    const fileNameIdx = argv.indexOf("--exe.fileName");
    expect(fileNameIdx).toBeGreaterThan(exeIdx);
    expect(argv[fileNameIdx + 1]).toBe(target.rawName);
    const targetsIdx = argv.indexOf("--exe.targets");
    expect(targetsIdx).toBeGreaterThan(fileNameIdx);
    const [platform, arch, nodeVersion] = (argv[targetsIdx + 1] ?? "").split(",");
    expect(platform).toBe(deriveExpectedPlatform(target.id));
    expect(arch).toBe(target.id.endsWith("-x64") ? "x64" : "arm64");
    expect(nodeVersion).toBe("25.7.0");
  });

  it("builds every manifest target with the right fileName + platform/arch", () => {
    for (const target of TARGETS) {
      const result = runBuild(target.id);
      expect(result.status, `${target.id}: ${result.stderr}`).toBe(0);
      const argv = result.invocation?.argv ?? [];
      const fileNameIdx = argv.indexOf("--exe.fileName");
      expect(fileNameIdx, `${target.id}: --exe.fileName missing`).toBeGreaterThanOrEqual(0);
      expect(argv[fileNameIdx + 1]).toBe(target.rawName);
      const targetsIdx = argv.indexOf("--exe.targets");
      expect(targetsIdx, `${target.id}: --exe.targets missing`).toBeGreaterThanOrEqual(0);
      const [platform, arch] = (argv[targetsIdx + 1] ?? "").split(",");
      expect(platform, `${target.id}: platform`).toBe(deriveExpectedPlatform(target.id));
      expect(arch, `${target.id}: arch`).toBe(target.id.endsWith("-x64") ? "x64" : "arm64");
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
    // Don't pre-populate the fake output; the harness is told not to
    // produce one either. The build script should detect the missing
    // file and refuse.
    const target = TARGETS[0];
    if (target === undefined) throw new Error("no targets");
    const result = spawnSync(
      process.execPath,
      [BUILD_SCRIPT, target.id],
      {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          UMACTUALLY_TSDOWN_BIN: HARNESS,
          UMACTUALLY_BUILD_CAPTURE_PATH: capturePath,
          UMACTUALLY_FAKE_NODE_VERSION: "25.7.0",
          // Note: no UMACTUALLY_FAKE_OUTPUT_PATH → harness doesn't write
          // the output, and OUTDIR (cwd/release/) is empty.
        },
        encoding: "utf8",
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/expected output not found/);
  });
});
