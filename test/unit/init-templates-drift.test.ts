import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { expectNotImplementedExport } from "../helpers/assert-red-module.js";

const versionPin = /npm install -g umactually@[^\s]+/gu;
const canonicalFiles = {
  github: "examples/github/pr-review.yml",
  azure: "examples/azure/azure-pipelines.yml",
} as const;

type RenderedTemplate = {
  readonly body: string;
  readonly relativePath: string;
};

type RenderCiTemplate = (input: {
  readonly target: "github" | "azure";
  readonly packageVersion: string;
}) => RenderedTemplate;

function isRenderCiTemplate(value: unknown): value is RenderCiTemplate {
  return typeof value === "function";
}

describe("init CI templates RED drift contract", () => {
  for (const [target, relativePath] of Object.entries(canonicalFiles)) {
    it(`${target} bytes equal the canonical file modulo the one version pin`, async () => {
      // Given: the checked-in canonical workflow, independent from generated output.
      const canonical = readFileSync(resolve(relativePath), "utf8").replace(versionPin, "npm install -g umactually@9.8.7");

      // When: the future inline template is rendered at the same version.
      const candidate = await expectNotImplementedExport(
        "../../src/cli/init-templates.js",
        "src/cli/init-templates.ts",
        "renderCiTemplate",
      );
      if (!isRenderCiTemplate(candidate)) {
        expect.fail("init-templates module not implemented yet");
      }
      const rendered = candidate({ target: target === "github" ? "github" : "azure", packageVersion: "9.8.7" });

      // Then: only the canonical version-pin line may vary.
      expect(rendered.body).toBe(canonical);
    });
  }
});
