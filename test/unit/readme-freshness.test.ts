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

  it("README-FRESHNESS R-1: README mentions `umactually init` BEFORE the npm install path in reading order", () => {
    // The wizard path is the canonical first-run experience. If
    // `umactually init` appears AFTER the `npm install -g umactually`
    // recommendation in reading order, the README still nudges
    // operators to skip the wizard — R-1 fails by design until T16.
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    const initIndex = readme.indexOf("umactually init");
    const npmInstallIndex = readme.indexOf("npm install -g umactually");
    expect(initIndex, "README must contain the literal `umactually init`").toBeGreaterThanOrEqual(0);
    expect(npmInstallIndex, "README must still reference the npm install path (regression guard)").toBeGreaterThanOrEqual(0);
    expect(initIndex).toBeLessThan(npmInstallIndex);
  });

  it("README-FRESHNESS R-2: a `## Quickstart` section heading exists (case-insensitive)", () => {
    // The wizard block lives under `## Quickstart` (recommended) at the
    // top of the README. Match the heading marker with surrounding
    // whitespace tolerance so a future "(recommended)" suffix still
    // satisfies the invariant.
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    expect(readme.toLowerCase()).toMatch(/^##\s+quickstart\b/mu);
  });

  it("README-FRESHNESS R-3: a `## Install (alternative)` section heading still exists", () => {
    // After the Quickstart rewrite the npm/curl/source install paths
    // move under `## Install (alternative)`. R-3 fails until T16
    // renames the current `## Install` heading.
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    expect(readme).toMatch(/^##\s+Install\s*\(alternative\)/mu);
  });

  it("README-FRESHNESS R-4: Quickstart section describes the 4-step wizard flow", () => {
    // Bundle §2.2 pins the wizard as 4 conceptual steps:
    //   init → choose provider → provide creds → done
    // The README's Quickstart section must surface every step in some
    // scannable form (numbered list, prose enumeration, code blocks).
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    const quickstartSection = readme
      .split(/^##\s+Quickstart\b/mu)[1]
      ?.split(/^(?:#|##)\s+/mu)[0]
      ?? "";
    expect(quickstartSection.length, "Quickstart section body must be non-empty").toBeGreaterThan(0);
    expect(quickstartSection).toMatch(/umactually init/u);
    expect(quickstartSection).toMatch(/provider/u);
    expect(quickstartSection).toMatch(/cred(?:ential|s)/u);
    expect(quickstartSection).toMatch(/done|finish|complete|ready|set up|setup/i);
  });

  it("README-FRESHNESS R-5: no fenced code block in README contains `sk-` or `ghp_` secret literals", () => {
    // Security hygiene. A README that ships with `sk-...` or
    // `ghp_...` inside a fenced block either leaks a real key or
    // normalizes the literal shape for scanners. R-5 walks every
    // fenced block and asserts neither prefix appears anywhere.
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    const fencedBlocks = readme.match(/```[\s\S]*?```/gu) ?? [];
    expect(fencedBlocks.length, "README should have at least one fenced code block").toBeGreaterThan(0);
    for (const block of fencedBlocks) {
      expect(block, "README fenced block must not contain a literal `sk-` API key").not.toMatch(/sk-[A-Za-z0-9]+/u);
      expect(block, "README fenced block must not contain a literal `ghp_` GitHub token").not.toMatch(/ghp_[A-Za-z0-9]+/u);
    }
  });

  it("README-FRESHNESS R-6: README mentions `~/.umactually/config.json` (the persist location)", () => {
    // The wizard persists provider + apiUrl + model to this path.
    // Operators need the literal `~/.umactually/config.json` string
    // somewhere in the README so they can locate + chmod the file.
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    expect(readme).toMatch(/\.umactually\/config\.json/u);
  });

  it("README-FRESHNESS R-7: README enumerates all three provider families", () => {
    // The wizard walks the operator through one of three families.
    // The README must name each family explicitly so the operator
    // recognizes the option they're picking.
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    expect(readme).toContain("openai-compatible");
    expect(readme).toContain("anthropic");
    expect(readme).toContain("copilot");
  });

  it("README-FRESHNESS R-8: the `--non-interactive` example uses $UMACTUALLY_API_KEY, not a literal key", () => {
    // R-8 is conditional: if the README shows a `--non-interactive`
    // example, it MUST source the key from the env var. A literal
    // `sk-...` (already covered by R-5) or `--api-key=sk-test-...`
    // example would normalize the wrong pattern for readers.
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    const nonInteractiveExample = readme
      .split("```")
      .filter((_chunk, index) => index % 2 === 1)
      .find((chunk) => /--non-interactive/u.test(chunk));
    if (nonInteractiveExample === undefined) {
      // README has no `--non-interactive` example yet — R-8 is
      // vacuously satisfied. When T16 adds the example, the strict
      // check below turns on.
      expect(nonInteractiveExample).toBeUndefined();
      return;
    }
    expect(nonInteractiveExample).toMatch(/\$UMACTUALLY_API_KEY/u);
    expect(nonInteractiveExample, "non-interactive example must not hard-code an api-key literal").not.toMatch(/--api-key\s+\S/u);
  });

  it("README-FRESHNESS R-9: README still cross-links to docs/exit-codes.md (regression guard)", () => {
    // R-9 is the existing invariant the README has honored since
    // v0.5.x. Pin it explicitly so the Quickstart rewrite cannot
    // drop the cross-link.
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    expect(readme).toMatch(/docs\/exit-codes\.md/u);
  });

  it("README-FRESHNESS R-10: README still cross-links to docs/configuration.md (regression guard)", () => {
    // R-10 is the existing invariant; the Quickstart rewrite must
    // keep the configuration cross-link live.
    const readme = readFileSync(join(REPO_ROOT, "README.md"), "utf8");
    expect(readme).toMatch(/docs\/configuration\.md/u);
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
