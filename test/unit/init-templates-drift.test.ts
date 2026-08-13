import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { renderCiTemplate } from "../../src/cli/init-templates.js";

const longformFiles = {
  github: "examples/github/pr-review.yml",
  azure: "examples/azure/azure-pipelines.yml",
} as const;

const shortformFiles = {
  github: "examples/github/pr-review.yml.action-ref.yml",
  azure: "examples/azure/azure-pipelines.yml.task-ref.yml",
} as const;

const packageVersion = String(JSON.parse(
  readFileSync(resolve("package.json"), "utf8"),
).version);

describe("init CI templates drift contract", () => {
  // Longform byte-equality: when --longform is set, the rendered output
  // must still match the canonical inline example byte-for-byte modulo
  // the single `npm install -g umactually@<version>` substitution point.
  // The original test (kept for the longform path).
  // Longform deprecation comment block — added to `examples/azure/azure-pipelines.yml`
  // by the single-click-github-install plan (T08) to record that this is
  // the inline longform kept for one release (removed in
  // `umactually-action@v2`, target: 2026-Q4). The drift test strips it
  // from the canonical fixture before comparing so the byte equality
  // is against the actual rendered workflow body only (mirrors the
  // shortform `shortformFixtureDocComment` pattern above).
  const longformFixtureDeprecationComment =
    /^[ \t]*#\s*(Inline-form|Inline longform|Removal of the inline|longform kept|umactually init --ci azure)[^\n]*\n(?:^[ \t]*#\s*[^\n]*\n)*/gum;
  for (const [target, relativePath] of Object.entries(longformFiles)) {
    it(`${target} longform bytes equal the canonical file modulo the one version pin`, async () => {
      // Given: the checked-in canonical longform workflow, independent from generated output.
      const canonical = readFileSync(resolve(relativePath), "utf8")
        .replace(longformFixtureDeprecationComment, "")
        .replace(
          /npm install -g umactually@[^\s]+/gu,
          "npm install -g umactually@9.8.7",
        );

      // When: the longform template is rendered at the same version.
      const rendered = renderCiTemplate({
        target: target === "github" ? "github" : "azure",
        packageVersion: "9.8.7",
        longform: true,
      });

      // Then: only the canonical version-pin line may vary.
      expect(rendered.body).toBe(canonical);
    });
  }

  // Shortform byte-equality: when --longform is NOT set (the new
  // default), the rendered output must match the canonical published-
  // action / published-task fixture byte-for-byte modulo the single
  // `__UMACTUALLY_VERSION__` substitution point (which lives on the
  // `cli-version:` / `cliVersion:` input line in shortform, vs the
  // `npm install -g umactually@...` line in longform). The shortform
  // fixtures include a maintenance comment block that is purely
  // documentation (the deprecation pin for `umactually-action@v2`) and
  // is NOT part of the rendered template body; the test strips those
  // maintenance comments from the fixture before comparing so the byte
  // equality is against the actual rendered workflow body only.
  const shortformFixtureDocComment =
    /^[ \t]*#\s*(Published-task|Removal of the published task|--longform on)[^\n]*\n(?:^[ \t]*#\s*[^\n]*\n)*/gum;
  for (const [target, relativePath] of Object.entries(shortformFiles)) {
    it(`${target} shortform bytes equal the canonical action-ref / task-ref fixture modulo the version pin`, () => {
      // Given: the checked-in canonical shortform fixture, with the
      // maintenance comment block stripped (it's fixture-only metadata).
      const canonical = readFileSync(resolve(relativePath), "utf8")
        .replace(shortformFixtureDocComment, "")
        .replace("__UMACTUALLY_VERSION__", "9.8.7");

      // When: the shortform template is rendered at the same version.
      const rendered = renderCiTemplate({
        target: target === "github" ? "github" : "azure",
        packageVersion: "9.8.7",
      });

      // Then: only the version-pin substitution line may vary.
      expect(rendered.body).toBe(canonical);
    });
  }

  // Per-file explicit drift assertions for the LONGFORM canonical example
  // files (prior fixtures). The plan requires an explicit drift assertion
  // per canonical example file so a future regression that loses a
  // structurally significant line (e.g. the `concurrency:` block, the
  // `permissions:` block, the env-var forwarding) is caught even if the
  // byte-equality assertion above keeps passing. Each test pins the unique
  // structural fingerprints of one canonical example file.
  it("github longform: canonical example pins the install version, forwards UMACTUALLY_API_KEY, and posts on `pull_request`", () => {
    const body = readFileSync(resolve(longformFiles.github), "utf8");
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

  it("azure longform: canonical example pins the install version, forwards SYSTEM_ACCESSTOKEN, and runs on ubuntu-latest", () => {
    const body = readFileSync(resolve(longformFiles.azure), "utf8");
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

  // Per-file explicit structural fingerprints for the SHORTFORM (action-
  // ref / task-ref) fixtures. Pins every documented `with:` / `inputs:`
  // key enumerated in T12 acceptance criteria so a future regression that
  // drops a key (e.g. `paths-ignore`, `output-artifact`) is caught
  // independent of the byte-equality check above.
  it("github shortform: canonical action-ref fixture references the published action and lists every documented `with:` input", () => {
    const body = readFileSync(resolve(shortformFiles.github), "utf8");
    expect(body).toMatch(/JosiahSiegel\/umactually-action@v1/u);
    expect(body).toMatch(/on:\s*\[pull_request\]/u);
    expect(body).toMatch(/concurrency:/u);
    expect(body).toMatch(/cancel-in-progress:\s*true/u);
    expect(body).toMatch(/contents:\s*read/u);
    expect(body).toMatch(/pull-requests:\s*write/u);
    expect(body).toMatch(/cli-version:\s*__UMACTUALLY_VERSION__/u);
    // Secrets must be forwarded through the action's `with:` inputs.
    expect(body).toMatch(/with:\s*\n(?:\s*[^\n]+\n)*?\s*api-url:\s*\$\{\{\s*secrets\.UMACTUALLY_API_URL\s*\}\}/u);
    expect(body).toMatch(/with:\s*\n(?:\s*[^\n]+\n)*?\s*api-key:\s*\$\{\{\s*secrets\.UMACTUALLY_API_KEY\s*\}\}/u);
    expect(body).not.toMatch(/^\s*secrets:/mu);
    expect(body).toMatch(/provider:\s*openai-compatible/u);
    expect(body).toMatch(/config-path:\s*\.\/umactually\.review\.json/u);
    expect(body).toMatch(/output-artifact:\s*umactually-review\.json/u);
    expect(body).toMatch(/skip-draft:\s*'true'/u);
    expect(body).toMatch(/paths-ignore:\s*'\*\*\/\*\.md,docs\/\*\*,\*\*\/\*\.lock'/u);
    // The shortform MUST NOT carry the inline `npm install -g umactually@...`
    // step — that responsibility is delegated to the action.
    expect(body).not.toMatch(/npm install -g umactually@/u);
    expect(body).not.toMatch(/actions\/setup-node/u);
  });

  it("azure shortform: canonical task-ref fixture references the published task and lists every documented `inputs:` key", () => {
    const body = readFileSync(resolve(shortformFiles.azure), "utf8");
    expect(body).toMatch(/UmActuallyReview@1/u);
    expect(body).toMatch(/trigger:\s*none/u);
    expect(body).toMatch(/pr:\s*[\s\S]*branches:[\s\S]*include:\s*\[main\]/u);
    expect(body).toMatch(/vmImage:\s*ubuntu-latest/u);
    expect(body).toMatch(/checkout:\s*self/u);
    expect(body).toMatch(/cliVersion:\s*__UMACTUALLY_VERSION__/u);
    expect(body).toMatch(/apiUrl:\s*\$\(UMACTUALLY_API_URL\)/u);
    expect(body).toMatch(/apiKey:\s*\$\(UMACTUALLY_API_KEY\)/u);
    expect(body).toMatch(/provider:\s*openai-compatible/u);
    expect(body).toMatch(/configPath:\s*\.\/umactually\.review\.json/u);
    expect(body).toMatch(/outputArtifact:\s*umactually-review\.json/u);
    expect(body).toMatch(/skipDraft:\s*'true'/u);
    expect(body).toMatch(/pathsIgnore:\s*'\*\*\/\*\.md,docs\/\*\*,\*\*\/\*\.lock'/u);
    // SYSTEM_ACCESSTOKEN env-passthrough is mandatory even in shortform.
    expect(body).toMatch(/SYSTEM_ACCESSTOKEN:\s*\$\(System\.AccessToken\)/u);
    // The shortform MUST NOT carry the inline `npm install -g umactually@...`
    // step or the inline `umactually review --platform azure` script.
    expect(body).not.toMatch(/npm install -g umactually@/u);
    expect(body).not.toMatch(/umactually review --platform/u);
  });

  for (const target of ["github", "azure"] as const) {
    it(`${target}: longform generated workflow pins exactly the current package.json version`, () => {
      // Given: the package version used by both npm/dev and bundled CLI paths.
      // When: init renders the longform platform workflow using that running version.
      // (Shortform delegates the install to the action / task, so it does not
      // emit a literal `umactually@<x.y.z>`; only the longform is asserted here.)
      const rendered = renderCiTemplate({ target, packageVersion, longform: true });
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
    const githubBody = readFileSync(resolve(longformFiles.github), "utf8");
    const azureBody = readFileSync(resolve(longformFiles.azure), "utf8");
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
