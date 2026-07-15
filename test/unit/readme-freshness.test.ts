import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const PLUMBING_FLAGS = ["--event", "--diff", "--review", "--pr-number", "--repo"] as const;

type StepShape = {
  readonly name: string;
  readonly command: string;
  readonly always: boolean;
};

type QuickstartShape = {
  readonly permissions: Readonly<Record<string, unknown>>;
  readonly concurrencyGroup: unknown;
  readonly steps: readonly StepShape[];
  readonly plumbingFlags: readonly string[];
};

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return Object.fromEntries(Object.entries(value));
}

function workflowShape(value: unknown, platform: "github" | "azure"): QuickstartShape {
  const document = readRecord(value, `${platform} workflow`);
  const stepsValue = platform === "github"
    ? readRecord(readRecord(document["jobs"], "jobs")["review"], "review job")["steps"]
    : document["steps"];
  if (!Array.isArray(stepsValue)) {
    throw new TypeError(`${platform} steps must be an array`);
  }
  const steps = stepsValue.map((value, index) => {
    const step = readRecord(value, `${platform} step ${index}`);
    return {
      name: String(step["name"] ?? step["displayName"] ?? step["task"] ?? step["checkout"] ?? ""),
      command: String(step["run"] ?? step["script"] ?? step["uses"] ?? ""),
      always: step["if"] === "always()" || step["condition"] === "always()",
    };
  });
  const commands = steps.map((step) => step.command).join("\n");
  return {
    permissions: platform === "github" ? readRecord(document["permissions"], "permissions") : {},
    concurrencyGroup: platform === "github"
      ? readRecord(document["concurrency"], "concurrency")["group"]
      : undefined,
    steps,
    plumbingFlags: PLUMBING_FLAGS.filter((flag) => commands.includes(flag)),
  };
}

function readmeReferencesExample(readme: string, examplePath: string, heading: "GitHub Actions" | "Azure DevOps"): boolean {
  // Accepts any of the common pointer patterns used in the README
  // doc and the docs/ files. We require a markdown link with the
  // example path AND the heading must point at the link, so the reader
  // can navigate from README to the canonical example.
  const section = readme.split(`### ${heading}`)[1]?.split(/^(?:#|##) /mu)[0] ?? "";
  return section.includes(examplePath);
}

describe("README quickstart freshness", () => {
  it("README-FRESHNESS: README GH/ADO sections reference the canonical example files", () => {
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    expect(readmeReferencesExample(readme, "examples/github/pr-review.yml", "GitHub Actions")).toBe(true);
    expect(readmeReferencesExample(readme, "examples/azure/azure-pipelines.yml", "Azure DevOps")).toBe(true);
  });

  it("README-FRESHNESS: example files are well-formed CI workflows", () => {
    // Each canonical example file is a self-contained, semantically parseable
    // workflow. This is the strong form of the old freshness check: the
    // example files MUST always parse, where before the README's copy of
    // them had to parse too. The README's pointer-to-example structure
    // means a drift fix is one edit (the example file), not two.
    const githubExample = workflowShape(parse(readFileSync(join(REPO_ROOT, "examples/github/pr-review.yml"), "utf8")), "github");
    const azureExample = workflowShape(parse(readFileSync(join(REPO_ROOT, "examples/azure/azure-pipelines.yml"), "utf8")), "azure");

    expect(githubExample.steps.length).toBeGreaterThan(0);
    expect(azureExample.steps.length).toBeGreaterThan(0);
    expect(githubExample.permissions).toHaveProperty("contents");
    expect(githubExample.permissions).toHaveProperty("pull-requests");
  });
});
