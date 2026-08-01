import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const PLUMBING_FLAGS = ["--event", "--diff", "--review", "--pr-number", "--repo"] as const;
// Pinned invocation: a specific version must appear in the example workflow.
// Accepted forms: `umactually@X.Y.Z review` (direct npm exec),
// `npx github:JosiahSiegel/umactually#vX.Y.Z review` (git ref),
// `npm install -g umactually@X.Y.Z` (the canonical install path per the
// README; the version pin lives on the install line). Unpinned
// (`@latest` / `main`) forms are explicitly rejected by the README.
const PINNED = /umactually@\d+\.\d+\.\d+ review|npx github:JosiahSiegel\/umactually#v\d+\.\d+\.\d+ review|npm install -g umactually@\d+\.\d+\.\d+/u;

type WorkflowStep = {
  readonly run?: string;
  readonly script?: string;
  readonly uses?: string;
  readonly if?: string;
  readonly condition?: string;
  readonly env?: Readonly<Record<string, unknown>>;
};

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return Object.fromEntries(Object.entries(value));
}

function readSteps(value: unknown, label: string): readonly WorkflowStep[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array`);
  }
  return value.map((entry, index) => readRecord(entry, `${label}[${index}]`));
}

function githubSteps(document: Record<string, unknown>): readonly WorkflowStep[] {
  const jobs = readRecord(document["jobs"], "GitHub jobs");
  const review = readRecord(jobs["review"], "GitHub review job");
  return readSteps(review["steps"], "GitHub review steps");
}

function commandText(steps: readonly WorkflowStep[]): string {
  return steps.map((step) => step.run ?? step.script ?? "").join("\n");
}

function expectNoPlumbingFlags(text: string): void {
  for (const flag of PLUMBING_FLAGS) {
    expect(text).not.toContain(flag);
  }
}

describe("CLI-only example workflow contract", () => {
  it("WORKFLOW-CONTRACT: GitHub and Azure examples install and invoke only the public CLI", () => {
    // Given: both copyable example workflows parsed as YAML structures.
    const github = readRecord(parse(readFileSync(join(REPO_ROOT, "examples/github/pr-review.yml"), "utf8")), "GitHub workflow");
    const azure = readRecord(parse(readFileSync(join(REPO_ROOT, "examples/azure/azure-pipelines.yml"), "utf8")), "Azure workflow");
    const ghSteps = githubSteps(github);
    const adoSteps = readSteps(azure["steps"], "Azure steps");
    const ghCommands = commandText(ghSteps);
    const adoCommands = commandText(adoSteps);

    // Then: GitHub carries posting permissions, stable concurrency, token wiring, and CLI-only steps.
    expect(readRecord(github["permissions"], "GitHub permissions")["pull-requests"]).toBe("write");
    const concurrency = readRecord(github["concurrency"], "GitHub concurrency");
    expect(concurrency["group"]).toBe("umactually-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}");
    expect(concurrency["cancel-in-progress"]).toBe(true);
    expect(ghSteps.some((step) => step.env?.["GITHUB_TOKEN"] === "${{ github.token }}" || step.env?.["GITHUB_TOKEN"] === "${{ secrets.GITHUB_TOKEN }}")).toBe(true);
    expect(ghSteps.some((step) => step.uses === "./")).toBe(false);
    expect(ghSteps.some((step) => step.uses?.startsWith("actions/github-script") === true)).toBe(false);
    expectNoPlumbingFlags(ghCommands);
    expect(ghCommands).not.toContain("check-review-artifact");
    expect(ghCommands).toMatch(PINNED);
    expect(ghSteps).toHaveLength(4);

    // And: Azure explicitly wires its OAuth token and preserves the same slim public-CLI contract.
    expect(adoSteps.some((step) => step.env?.["SYSTEM_ACCESSTOKEN"] === "$(System.AccessToken)")).toBe(true);
    expectNoPlumbingFlags(adoCommands);
    expect(adoCommands).not.toContain("check-review-artifact");
    expect(adoCommands).not.toContain("optional_env_value");
    expect(adoCommands).not.toContain("EXTRA_ARGS");
    expect(adoCommands).toMatch(PINNED);
    expect(adoSteps).toHaveLength(4);
  });
});
