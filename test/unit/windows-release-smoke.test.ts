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

describe("Windows release binary smoke contract", () => {
  it("WINDOWS-BINARY-SMOKE: a Windows runner downloads the x64 executable and runs --version", () => {
    // Given: the release workflow parsed as YAML.
    const workflow = readRecord(parse(readFileSync(join(REPO_ROOT, ".github/workflows/release.yml"), "utf8")), "release workflow");
    const jobs = readRecord(workflow["jobs"], "release jobs");

    // When: Windows jobs are selected by their runner.
    const windowsJobs = Object.values(jobs)
      .map((job, index) => readRecord(job, `release job ${index}`))
      .filter((job) => job["runs-on"] === "windows-latest");

    // Then: one Windows job downloads the published executable and invokes its version surface.
    expect(windowsJobs).toHaveLength(1);
    const steps = readSteps(windowsJobs[0]?.["steps"]);
    const serializedSteps = JSON.stringify(steps);
    expect(serializedSteps).toContain("umactually-windows-x64.exe");
    expect(steps.some((step) => step.run?.includes("umactually-windows-x64.exe") === true && step.run.includes("--version"))).toBe(true);
  });
});
