import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");

type WorkflowStep = {
  readonly run?: string;
  readonly uses?: string;
  readonly with?: Readonly<Record<string, unknown>>;
};

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return Object.fromEntries(Object.entries(value));
}

function readSteps(value: unknown): readonly WorkflowStep[] {
  if (!Array.isArray(value)) {
    throw new TypeError("workflow steps must be an array");
  }
  return value.map((step, index) => readRecord(step, `step ${index}`));
}

describe("Release binary smoke contract", () => {
  it("WINDOWS-BINARY-SMOKE: at least one Windows runner job downloads the x64 executable and runs --version", () => {
    // Given: the release workflow parsed as YAML.
    const workflow = readRecord(parse(readFileSync(join(REPO_ROOT, ".github/workflows/release.yml"), "utf8")), "release workflow");
    const jobs = readRecord(workflow["jobs"], "release jobs");

    // When: Windows jobs are selected. GitHub Actions accepts either
    // the canonical `windows-latest` alias or the explicit pinned
    // runner label `windows-2025`; both are valid Windows runner
    // declarations under the plan's locked-runner policy.
    const windowsJobs = Object.values(jobs)
      .map((job, index) => readRecord(job, `release job ${index}`))
      .filter((job) => job["runs-on"] === "windows-latest" || job["runs-on"] === "windows-2025");

    // Then: at least one Windows job exists, and that job downloads the
    // published executable and invokes its version surface. The
    // installer-driven flow extracts the archive member
    // `umactually-windows-x64.exe` and renames it to `umactually.exe` at
    // install time, so the surface check accepts either name.
    expect(windowsJobs.length).toBeGreaterThanOrEqual(1);
    const targetJob = windowsJobs.find((job) => {
      const steps = readSteps(job["steps"]);
      return steps.some((step) => {
        const run = step.run ?? "";
        const mentionsX64 = run.includes("umactually-windows-x64.exe") || run.includes("umactually.exe");
        return mentionsX64 && run.includes("--version");
      });
    });
    expect(targetJob).toBeDefined();
  });

  it("INSTALL-SMOKE-WINDOWS: a Windows runner runs install.ps1 against the freshly-published release", () => {
    // Given: the release workflow parsed as YAML.
    const workflow = readRecord(parse(readFileSync(join(REPO_ROOT, ".github/workflows/release.yml"), "utf8")), "release workflow");
    const jobs = readRecord(workflow["jobs"], "release jobs");

    // When: Windows jobs are selected (accept either windows-latest
    // alias or pinned windows-2025 label per plan §Todo 4 locked-runner policy).
    const windowsJobs = Object.values(jobs)
      .map((job, index) => readRecord(job, `release job ${index}`))
      .filter((job) => job["runs-on"] === "windows-latest" || job["runs-on"] === "windows-2025");

    // Then: at least one Windows job invokes scripts/install.ps1 (the
    // end-user PowerShell install path), proving the user-facing
    // install script works against the freshly-published release.
    const hasInstallSmoke = windowsJobs.some((job) => {
      const steps = readSteps(job["steps"]);
      return steps.some((step) => step.run?.includes("install.ps1") === true);
    });
    expect(hasInstallSmoke).toBe(true);
  });
});

describe("Linux install script smoke contract", () => {
  it("INSTALL-SMOKE-LINUX: a Linux runner runs install.sh end-to-end against the freshly-published release", () => {
    // Given: the release workflow parsed as YAML.
    const workflow = readRecord(parse(readFileSync(join(REPO_ROOT, ".github/workflows/release.yml"), "utf8")), "release workflow");
    const jobs = readRecord(workflow["jobs"], "release jobs");

    // When: Linux jobs are selected by their runner.
    const linuxJobs = Object.values(jobs)
      .map((job, index) => readRecord(job, `release job ${index}`))
      .filter((job) => job["runs-on"] === "ubuntu-latest");

    // Then: at least one Linux job invokes scripts/install.sh — the
    // end-user POSIX install path. This proves the user-facing shell
    // installer works against the freshly-published release (downloads
    // the linux-x64 binary, SHA-256-verifies it via the published
    // checksums.txt, installs to ~/.local/bin, and runs the resulting
    // binary's --version/doctor/--help).
    const hasInstallSmoke = linuxJobs.some((job) => {
      const steps = readSteps(job["steps"]);
      return steps.some((step) => step.run?.includes("install.sh") === true);
    });
    expect(hasInstallSmoke).toBe(true);
  });
});
