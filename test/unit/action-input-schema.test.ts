import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

// Resolve the package root from THIS test file's location.
const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..", "..");
const actionPath = resolve(packageRoot, "action", "action.yml");

// Load-once. Re-reading on every `it` is wasteful and the YAML is the
// contract under test.
const actionBody = readFileSync(actionPath, "utf8");
const actionDoc = parseYaml(actionBody) as {
  name?: string;
  description?: string;
  author?: string;
  branding?: { icon?: string; color?: string };
  inputs?: Record<string, { description?: string; required?: boolean; default?: unknown }>;
  outputs?: Record<string, { description?: string }>;
  runs?: {
    using?: string;
    steps?: Array<{ name?: string; uses?: string; with?: Record<string, unknown>; run?: string; shell?: string }>;
  };
};

// Wave 4 T14 contract: the action.yml file is the source of truth for
// the GitHub Action's input matrix. Every documented input MUST have a
// description (so the Marketplace UI renders help text), and the
// outputs MUST be present (so branch-protection rules can branch on
// them). The action MUST be a composite, MUST use
// actions/setup-node@v7, and MUST pin Node.js 24.
//
// These assertions are independent so a future regression points at
// the exact missing field instead of a generic "schema changed"
// failure. Every assertion is structural — no `actionlint` dependency,
// no network.
describe("action/action.yml — Composite Action schema contract", () => {
  it("exists at action/action.yml (relative to package root)", () => {
    // The Marketplace listing and the test files both depend on this
    // path being stable. If the action moves (action/src/action.yml,
    // github-action/action.yml, etc.) the input matrix changes — this
    // assertion locks the path. readFileSync would have thrown above
    // if the file were missing, so a present `name:` field is the
    // contract under test.
    expect(typeof actionDoc.name).toBe("string");
  });

  it("declares `using: composite` (Composite Action shape, not Node.js or Docker)", () => {
    // Composite Actions run as a sequence of steps under the calling
    // job's runner. Node.js / Docker actions would change the
    // input/output contract — pin `composite`.
    expect(actionDoc.runs?.using).toBe("composite");
  });

  it("references actions/setup-node@v7 with node-version: \"24\"", () => {
    // The plan's contract (C1 + T14 acceptance criteria): Node.js 24
    // is the only supported runtime. The setup-node action MUST be
    // present (otherwise Node.js is missing) and the version MUST be
    // 24 (otherwise the CLI's `engines.node` guard fires).
    const steps = actionDoc.runs?.steps ?? [];
    const setupNode = steps.find((s) => /actions\/setup-node@v7/u.test(s.uses ?? ""));
    expect(setupNode, "expected a step that uses actions/setup-node@v7").toBeDefined();
    expect(setupNode?.with?.["node-version"]).toBe("24");
  });

  it("documents every input from the documented matrix (cli-version, api-url, api-key, provider, model, config-path, output-artifact, skip-draft, paths-ignore)", () => {
    // The full input matrix from T12 acceptance criteria. The
    // Marketplace listing copy and `docs/install-action.md` both
    // mirror this list. A missing input here would silently degrade
    // the action — pin the full set.
    const required = [
      "cli-version",
      "api-url",
      "api-key",
      "provider",
      "model",
      "config-path",
      "output-artifact",
      "skip-draft",
      "paths-ignore",
    ];
    const inputs = actionDoc.inputs ?? {};
    for (const key of required) {
      expect(inputs[key], `expected input "${key}" in action.yml`).toBeDefined();
    }
  });

  it("every input has a non-empty `description` field (Marketplace help-text contract)", () => {
    // The Marketplace UI reads `inputs.<key>.description` to render
    // the help text under each input. An empty / missing description
    // is a UX regression for every operator browsing the listing —
    // pin every input has a description.
    const inputs = actionDoc.inputs ?? {};
    for (const [key, def] of Object.entries(inputs)) {
      expect(typeof def.description, `expected description for input "${key}"`).toBe("string");
      expect(def.description?.length ?? 0, `expected non-empty description for input "${key}"`).toBeGreaterThan(0);
    }
  });

  it("declares the three documented outputs (verdict, inline-thread-count, review-id)", () => {
    // Branch-protection rules branch on these three outputs.
    // `verdict` is the required status check signal;
    // `inline-thread-count` is the human-readable count surfaced in
    // the job summary; `review-id` is the log-correlation identifier.
    const required = ["verdict", "inline-thread-count", "review-id"];
    const outputs = actionDoc.outputs ?? {};
    for (const key of required) {
      expect(outputs[key], `expected output "${key}" in action.yml`).toBeDefined();
    }
  });

  it("declares a `branding:` block (Marketplace card icon + color)", () => {
    // The Marketplace card renders an icon + color stripe; both MUST
    // be present in the manifest so the card is not blank.
    expect(actionDoc.branding).toBeDefined();
    expect(typeof actionDoc.branding?.icon).toBe("string");
    expect(typeof actionDoc.branding?.color).toBe("string");
  });
});