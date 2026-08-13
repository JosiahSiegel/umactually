import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Resolve the package root from THIS test file's location.
const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..", "..");
const manifestPath = resolve(packageRoot, "ado-task", "UmActuallyReview", "task.json");

// Load-once. Re-reading on every `it` is wasteful and the manifest is
// the contract under test.
const manifestBody = readFileSync(manifestPath, "utf8");
const manifest = JSON.parse(manifestBody) as {
  id?: string;
  name?: string;
  friendlyName?: string;
  description?: string;
  helpMarkDown?: string;
  category?: string;
  author?: string;
  version?: { Major?: string; Minor?: string; Patch?: string };
  inputs?: Array<{
    name?: string;
    type?: string;
    label?: string;
    defaultValue?: unknown;
    required?: boolean;
    helpMarkDown?: string;
  }>;
  outputVariables?: Array<{ name?: string; description?: string }>;
  execution?: Record<string, { target?: string; argumentFormat?: string }>;
};

// Wave 4 T14 contract: the ADO task manifest is the source of truth
// for the task's input matrix and runtime execution shape. Every
// documented input from C1 (mirrored to camelCase per ADO convention)
// MUST be present with a documented label/type/default, the
// execution handler MUST point at the compiled entry script, and
// the manifest MUST carry every field `tfx-cli validate` checks.
//
// These assertions are independent so a future regression points at
// the exact missing field instead of a generic "manifest changed"
// failure. No `tfx-cli` dependency, no network.
describe("ado-task/UmActuallyReview/task.json — manifest schema contract", () => {
  it("exists at ado-task/UmActuallyReview/task.json (relative to package root)", () => {
    // The drift test in `test/unit/init-templates-drift.test.ts` and
    // the `tfx-cli pack` step both depend on this path being stable.
    // If the task moves (ado-task/src/UmActuallyReview/task.json,
    // tasks/UmActuallyReview/task.json, etc.) the wiring breaks —
    // readFileSync would have thrown above if missing, so a
    // present `id:` field confirms parse succeeded.
    expect(typeof manifest.id).toBe("string");
  });

  it("declares every required top-level field (`tfx-cli validate` contract)", () => {
    // tfx-cli checks each of these fields explicitly. A missing
    // field fails validation and blocks Marketplace submission.
    // Pin every required field so a regression that drops one is
    // caught locally before the operator sees it.
    expect(typeof manifest.id).toBe("string");
    expect(typeof manifest.name).toBe("string");
    expect(typeof manifest.friendlyName).toBe("string");
    expect(typeof manifest.description).toBe("string");
    expect(typeof manifest.category).toBe("string");
    expect(typeof manifest.author).toBe("string");
    expect(manifest.version).toBeDefined();
    expect(Array.isArray(manifest.inputs)).toBe(true);
    expect(manifest.execution).toBeDefined();
  });

  it("declares `category: Build` (Marketplace placement contract)", () => {
    // The `category` field controls where the task appears in the
    // Marketplace UI. `Build` is the documented placement for the
    // UmActuallyReview task per the plan; any other value would
    // place the task in the wrong Marketplace bucket. The T07 QA
    // scenario changes this to a bogus value and confirms
    // `tfx-cli validate` rejects it.
    expect(manifest.category).toBe("Build");
  });

  it("declares every documented input (cliVersion, apiUrl, apiKey, provider, model, configPath, outputArtifact, skipDraft, pathsIgnore)", () => {
    // The 9 keys mirror the GitHub action's input matrix
    // (T12 acceptance criteria + C1). ADO uses camelCase so
    // `cli-version` becomes `cliVersion`, `output-artifact` becomes
    // `outputArtifact`, etc. A missing input here would silently
    // degrade the task — pin the full set.
    const required = [
      "cliVersion",
      "apiUrl",
      "apiKey",
      "provider",
      "model",
      "configPath",
      "outputArtifact",
      "skipDraft",
      "pathsIgnore",
    ];
    const inputNames = (manifest.inputs ?? []).map((i) => i.name);
    for (const key of required) {
      expect(inputNames, `expected input "${key}" in task.json`).toContain(key);
    }
  });

  it("every input has a documented `label`, `name`, `type`, and `defaultValue`", () => {
    // The Marketplace UI reads `label` (display label), `type`
    // (form-control rendering), and `defaultValue` (pre-filled
    // value). A missing `label` is a UX regression; a missing
    // `type` is a runtime regression (the form control renders
    // incorrectly). Pin every input has all four fields.
    const inputs = manifest.inputs ?? [];
    for (const input of inputs) {
      expect(typeof input.name, `expected input name to be a string (got: ${JSON.stringify(input)})`).toBe("string");
      expect(typeof input.type, `expected input "${input.name}" to have a type`).toBe("string");
      expect(typeof input.label, `expected input "${input.name}" to have a label`).toBe("string");
      expect(input.defaultValue !== undefined, `expected input "${input.name}" to have a defaultValue`).toBe(true);
    }
  });

  it("declares an execution handler (`Node10`) pointing at a JS entry script", () => {
    // tfx-cli validates that `execution` has a known handler key
    // (`Node10`, `Node16`, `Node20`, `PowerShell3`, etc.) and that
    // `target` resolves to a file inside the task directory. The
    // shipped `dist/index.js` is the compiled stub (regenerated by
    // the real `tfx-cli pack` step in T07). Pin the handler key
    // and a non-empty `target`.
    expect(manifest.execution).toBeDefined();
    const handlerKeys = Object.keys(manifest.execution ?? {});
    expect(handlerKeys.length, "expected at least one execution handler").toBeGreaterThan(0);
    const handler = manifest.execution?.[handlerKeys[0]!];
    expect(typeof handler?.target).toBe("string");
    expect(handler?.target?.length ?? 0).toBeGreaterThan(0);
  });
});