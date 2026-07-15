// SPDX-License-Identifier: MIT
// Sandboxed contract tests for the release pre-flight helper.

import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const RELEASE_SH = join(REPO_ROOT, "scripts", "release.sh");
const INITIAL_PACKAGE = '{\n  "name": "umactually",\n  "version": "1.2.3"\n}\n';
const INITIAL_CHANGELOG = "# Changelog\n\n## [Unreleased]\n\n### Added\n\n- Existing change.\n";

type RunResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number;
};

function findBash(): string | null {
  const candidates: readonly string[] = process.platform === "win32"
    ? ["bash.exe", "bash"]
    : ["bash", "/usr/bin/bash", "/opt/homebrew/bin/bash"];
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["--version"], { stdio: "pipe" });
      return candidate;
    } catch {
      // Try the next supported shell location.
    }
  }
  return null;
}

const SHELL = findBash();
const SHELL_AVAILABLE = SHELL !== null;

function git(cwd: string, args: readonly string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

function commitSandbox(cwd: string, message: string): void {
  git(cwd, ["add", "."]);
  git(cwd, ["commit", "-m", message]);
  git(cwd, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
}

function runRelease(cwd: string, args: readonly string[]): RunResult {
  if (!SHELL_AVAILABLE || SHELL === null) {
    return { stdout: "SHELL_UNAVAILABLE", stderr: "", status: 0 };
  }
  try {
    const stdout = execFileSync(SHELL, [join(cwd, "scripts", "release.sh"), ...args], {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        EXPECTED_RELEASE_BRANCH: "main",
        PWD: cwd,
        RELEASE_TEST_MODE: "1",
      },
    });
    return { stdout, stderr: "", status: 0 };
  } catch (error: unknown) {
    if (!(error instanceof Error)) {
      throw error;
    }
    const failure = error as Error & {
      readonly status?: number;
      readonly stderr?: string;
      readonly stdout?: string;
    };
    return {
      stdout: failure.stdout ?? "",
      stderr: failure.stderr ?? "",
      status: failure.status ?? 1,
    };
  }
}

let sandbox = "";

beforeEach(() => {
  sandbox = mkdtempSync(join(tmpdir(), "umactually-release-test-"));
  mkdirSync(join(sandbox, "scripts"));
  copyFileSync(RELEASE_SH, join(sandbox, "scripts", "release.sh"));
  writeFileSync(join(sandbox, "package.json"), INITIAL_PACKAGE);
  writeFileSync(join(sandbox, "CHANGELOG.md"), INITIAL_CHANGELOG);
  git(sandbox, ["init", "-b", "main"]);
  git(sandbox, ["config", "user.email", "release-test@example.invalid"]);
  git(sandbox, ["config", "user.name", "Release Test"]);
  commitSandbox(sandbox, "test fixture");
});

afterEach(() => {
  if (sandbox !== "" && existsSync(sandbox)) {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

describe.skipIf(!SHELL_AVAILABLE)("release.sh", () => {
  it("prints usage and makes no writes when no version is supplied", () => {
    // Given: a clean release checkout.
    const packageBefore = readFileSync(join(sandbox, "package.json"), "utf8");
    const changelogBefore = readFileSync(join(sandbox, "CHANGELOG.md"), "utf8");

    // When: the helper runs without arguments.
    const result = runRelease(sandbox, []);

    // Then: usage is reported without touching release files.
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Usage:");
    expect(readFileSync(join(sandbox, "package.json"), "utf8")).toBe(packageBefore);
    expect(readFileSync(join(sandbox, "CHANGELOG.md"), "utf8")).toBe(changelogBefore);
  });

  it("--check is accepted in any position, not only as arg 1", () => {
    // Regression: prior to the arg-position fix, only `--check` as arg 1
    // worked; `bash scripts/release.sh v1.2.3 --check` showed the usage
    // screen. Both orderings must now drive the diagnostics-only path.
    //
    // The sandbox's INITIAL_PACKAGE already declares v1.2.3, so passing
    // v1.2.3 to --check trips the unchanged-version branch (exit 3) and
    // exercises the arg parser without any writes.

    // --check first.
    const r1 = runRelease(sandbox, ["--check", "v1.2.3"]);
    expect(r1.status, r1.stderr).toBe(3);
    expect(r1.stderr).not.toContain("Usage:");

    // --check second (the bug-fixed ordering).
    const r2 = runRelease(sandbox, ["v1.2.3", "--check"]);
    expect(r2.status, r2.stderr).toBe(3);
    expect(r2.stderr).not.toContain("Usage:");

    // No writes either way.
    const pkg = JSON.parse(readFileSync(join(sandbox, "package.json"), "utf8")) as { version: string };
    expect(pkg.version).toBe("1.2.3");
  });

  it("unknown flags are rejected with a clear error and no writes", () => {
    // Given: a clean release checkout.
    const packageBefore = readFileSync(join(sandbox, "package.json"), "utf8");

    // When: an unrecognised flag is supplied with a valid version.
    const result = runRelease(sandbox, ["--bogus", "v1.2.3"]);

    // Then: a clear error is reported and no files are touched.
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/unknown flag|Usage:/);
    expect(readFileSync(join(sandbox, "package.json"), "utf8")).toBe(packageBefore);
  });

  it("rejects a non-SemVer version without writes", () => {
    // Given: a clean release checkout.
    const packageBefore = readFileSync(join(sandbox, "package.json"), "utf8");
    const changelogBefore = readFileSync(join(sandbox, "CHANGELOG.md"), "utf8");

    // When: the target is not a strict SemVer triple.
    const result = runRelease(sandbox, ["v1.2"]);

    // Then: validation fails before mutation.
    expect(result.status).toBe(1);
    expect(readFileSync(join(sandbox, "package.json"), "utf8")).toBe(packageBefore);
    expect(readFileSync(join(sandbox, "CHANGELOG.md"), "utf8")).toBe(changelogBefore);
  });

  it("rejects a dirty working tree", () => {
    // Given: an uncommitted file in an otherwise release-ready checkout.
    writeFileSync(join(sandbox, "dirty.txt"), "dirty\n");

    // When: a release is requested.
    const result = runRelease(sandbox, ["1.2.4"]);

    // Then: the pre-flight names the dirty tree.
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("working tree is dirty");
  });

  it("reports ready without writes in --check mode for a new version", () => {
    // Given: a clean release checkout.
    const packageBefore = readFileSync(join(sandbox, "package.json"), "utf8");
    const changelogBefore = readFileSync(join(sandbox, "CHANGELOG.md"), "utf8");

    // When: diagnostics target a new version.
    const result = runRelease(sandbox, ["--check", "v1.2.4"]);

    // Then: readiness succeeds without mutation.
    expect(result.status).toBe(0);
    expect(readFileSync(join(sandbox, "package.json"), "utf8")).toBe(packageBefore);
    expect(readFileSync(join(sandbox, "CHANGELOG.md"), "utf8")).toBe(changelogBefore);
  });

  it("returns 3 in --check mode when the target is already current", () => {
    // Given: package.json already carries the requested version.
    // When: diagnostics target that same version.
    const result = runRelease(sandbox, ["--check", "1.2.3"]);

    // Then: the unchanged-version state is distinct from failure.
    expect(result.status).toBe(3);
    expect(result.stderr).toContain("current version is already");
  });

  it("bumps package.json and inserts a dated Keep a Changelog skeleton", () => {
    // Given: a clean release checkout at v1.2.3.
    // When: v1.2.4 is prepared.
    const result = runRelease(sandbox, ["v1.2.4"]);

    // Then: both release sources are updated with the standard structure.
    expect(result.status).toBe(0);
    const pkg = JSON.parse(readFileSync(join(sandbox, "package.json"), "utf8"));
    expect(pkg.version).toBe("1.2.4");
    expect(readFileSync(join(sandbox, "package.json"), "utf8").endsWith("\n")).toBe(true);
    const changelog = readFileSync(join(sandbox, "CHANGELOG.md"), "utf8");
    expect(changelog).toMatch(/## \[1\.2\.4\] - \d{4}-\d{2}-\d{2}/);
    for (const section of ["Added", "Changed", "Fixed", "Removed", "Security"] as const) {
      expect(changelog).toContain(`### ${section}\n\n- TBD.`);
    }
    expect(changelog.indexOf("## [1.2.4]")).toBeGreaterThan(changelog.indexOf("## [Unreleased]"));
  });

  it("does not duplicate an existing release heading", () => {
    // Given: the target heading already exists in a clean checkout.
    writeFileSync(
      join(sandbox, "CHANGELOG.md"),
      `${INITIAL_CHANGELOG}\n## [1.2.4] - 2026-07-15\n\n### Added\n\n- TBD.\n`,
    );
    commitSandbox(sandbox, "existing release heading");

    // When: the same release preparation is requested again.
    const result = runRelease(sandbox, ["1.2.4"]);

    // Then: the request is an idempotent no-op.
    expect(result.status).toBe(0);
    const headings = readFileSync(join(sandbox, "CHANGELOG.md"), "utf8")
      .split(/\r?\n/)
      .filter((line) => line.startsWith("## [1.2.4]"));
    expect(headings).toHaveLength(1);
  });
});
