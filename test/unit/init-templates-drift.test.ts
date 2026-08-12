import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { renderCiTemplate } from "../../src/cli/init-templates.js";

const versionPin = /npm install -g umactually@[^\s]+/gu;
const canonicalFiles = {
  github: "examples/github/pr-review.yml",
  azure: "examples/azure/azure-pipelines.yml",
} as const;

const packageVersion = String(JSON.parse(
  readFileSync(resolve("package.json"), "utf8"),
).version);

describe("init CI templates drift contract", () => {
  for (const [target, relativePath] of Object.entries(canonicalFiles)) {
    it(`${target} bytes equal the canonical file modulo the one version pin`, async () => {
      // Given: the checked-in canonical workflow, independent from generated output.
      const canonical = readFileSync(resolve(relativePath), "utf8").replace(versionPin, "npm install -g umactually@9.8.7");

      // When: the future inline template is rendered at the same version.
      const rendered = renderCiTemplate({
        target: target === "github" ? "github" : "azure",
        packageVersion: "9.8.7",
      });

      // Then: only the canonical version-pin line may vary.
      expect(rendered.body).toBe(canonical);
    });
  }

  // Per-file explicit drift assertions. The plan requires an explicit drift
  // assertion per canonical example file (one for GitHub, one for Azure) so
  // a future regression that loses a structurally significant line (e.g.
  // the `concurrency:` block, the `permissions:` block, the env-var
  // forwarding) is caught even if the byte-equality assertion above keeps
  // passing. Each test pins the unique structural fingerprints of one
  // canonical example file.
  it("github: canonical example pins the install version, forwards UMACTUALLY_API_KEY, and posts on `pull_request`", () => {
    const body = readFileSync(resolve(canonicalFiles.github), "utf8");
    expect(body).toMatch(/npm install -g umactually@/u);
    expect(body).toMatch(/on:\s*\[pull_request\]/u);
    expect(body).toMatch(/concurrency:/u);
    expect(body).toMatch(/cancel-in-progress:\s*true/u);
    expect(body).toMatch(/contents:\s*read/u);
    expect(body).toMatch(/pull-requests:\s*write/u);
    expect(body).toMatch(/actions\/setup-node@v7/u);
    expect(body).toMatch(/node-version:\s*"24"/u);
    expect(body).toMatch(/GITHUB_TOKEN:\s*\$\{\{\s*github\.token\s*\}\}/u);
    expect(body).toMatch(/UMACTUALLY_API_URL:\s*\$\{\{\s*secrets\.UMACTUALLY_API_URL\s*\}\}/u);
    expect(body).toMatch(/UMACTUALLY_API_KEY:\s*\$\{\{\s*secrets\.UMACTUALLY_API_KEY\s*\}\}/u);
    expect(body).toMatch(/umactually review --platform github/u);
  });

  it("azure: canonical example pins the install version, forwards SYSTEM_ACCESSTOKEN, and runs on ubuntu-latest", () => {
    const body = readFileSync(resolve(canonicalFiles.azure), "utf8");
    expect(body).toMatch(/npm install -g umactually@/u);
    expect(body).toMatch(/trigger:\s*none/u);
    expect(body).toMatch(/pr:\s*[\s\S]*branches:[\s\S]*include:\s*\[main\]/u);
    expect(body).toMatch(/vmImage:\s*ubuntu-latest/u);
    expect(body).toMatch(/checkout:\s*self/u);
    expect(body).toMatch(/NodeTool@0/u);
    expect(body).toMatch(/versionSpec:\s*"24\.x"/u);
    expect(body).toMatch(/SYSTEM_ACCESSTOKEN:\s*\$\(System\.AccessToken\)/u);
    expect(body).toMatch(/UMACTUALLY_API_URL:\s*\$\(UMACTUALLY_API_URL\)/u);
    expect(body).toMatch(/UMACTUALLY_API_KEY:\s*\$\(UMACTUALLY_API_KEY\)/u);
    expect(body).toMatch(/umactually review --platform azure/u);
  });

  for (const target of ["github", "azure"] as const) {
    it(`${target}: generated workflow pins exactly the current package.json version`, () => {
      // Given: the package version used by both npm/dev and bundled CLI paths.
      // When: init renders the platform workflow using that running version.
      const rendered = renderCiTemplate({ target, packageVersion });
      const pins = [...rendered.body.matchAll(/umactually@(\d+\.\d+\.\d+)/gu)];

      // Then: the generated workflow contains one immutable, exact npm pin.
      expect(pins.map((match) => match[1])).toEqual([packageVersion]);
      expect(rendered.body).not.toContain("umactually@latest");
      expect(rendered.body).not.toContain("umactually@main");
    });
  }

  it("github + azure: every literal `umactually@<x.y.z>` pin equals the current package.json version", () => {
    // The plan ships both canonical example files with the same version
    // pin the release workflow publishes (`umactually@0.8.0`). If a
    // future bump forgets to update one of the two files, the byte
    // equality test above would still pass (the substitution normalizes
    // both sides) — this guard catches the live drift directly.
    const githubBody = readFileSync(resolve(canonicalFiles.github), "utf8");
    const azureBody = readFileSync(resolve(canonicalFiles.azure), "utf8");
    const literalPin = new RegExp(`umactually@${packageVersion.replace(/\./gu, "\\.")}`, "u");
    expect(githubBody).toMatch(literalPin);
    expect(azureBody).toMatch(literalPin);
    // And no leftover historical pin: every `umactually@X.Y.Z` form in
    // the example files must equal the current version, regardless of
    // how many lines back-reference it.
    const historicalPin = /umactually@(\d+\.\d+\.\d+)/gu;
    for (const [body, label] of [[githubBody, "github"], [azureBody, "azure"]] as const) {
      for (const match of body.matchAll(historicalPin)) {
        expect(match[1], `${label} example has stale version pin ${match[0]}`).toBe(packageVersion);
      }
    }
  });
});
