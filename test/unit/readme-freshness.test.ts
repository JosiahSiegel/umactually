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

function extractYamlBlock(readme: string, heading: "GitHub Actions" | "Azure DevOps"): string {
  const section = readme.split(`## ${heading}`)[1]?.split(/^## /mu)[0] ?? "";
  const match = /```yaml\s*\n([\s\S]*?)```/u.exec(section);
  if (match?.[1] === undefined) {
    throw new TypeError(`README ${heading} section must contain a fenced YAML block`);
  }
  return match[1];
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

describe("README quickstart freshness", () => {
  it("README-FRESHNESS: GitHub and Azure YAML quickstarts semantically match their examples", () => {
    // Given: README quickstarts and canonical examples parsed independently.
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    const githubReadme = workflowShape(parse(extractYamlBlock(readme, "GitHub Actions")), "github");
    const azureReadme = workflowShape(parse(extractYamlBlock(readme, "Azure DevOps")), "azure");
    const githubExample = workflowShape(parse(readFileSync(join(REPO_ROOT, "examples/github/pr-review.yml"), "utf8")), "github");
    const azureExample = workflowShape(parse(readFileSync(join(REPO_ROOT, "examples/azure/azure-pipelines.yml"), "utf8")), "azure");

    // Then: semantic workflow shape stays synchronized without pinning formatting or comments.
    expect(githubReadme).toEqual(githubExample);
    expect(azureReadme).toEqual(azureExample);
  });
});
