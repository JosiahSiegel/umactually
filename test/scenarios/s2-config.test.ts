import { describe, expect, it } from "vitest";

import { expectNotImplementedExport } from "../helpers/assert-red-module.js";

type ReviewConfigInput = {
  readonly model: "auto" | "review-model-synthetic";
  readonly effort: "low" | "medium" | "high";
  readonly reviewTimeoutSeconds: number;
  readonly stallSeconds: number;
  readonly maxOutputTokens: number;
  readonly minorFindings: "post" | "suppress";
  readonly dryRun: boolean;
};

type ParsedReviewConfig = {
  readonly model: "auto" | "review-model-synthetic";
  readonly effort: "medium";
  readonly reviewTimeoutSeconds: 300;
  readonly stallSeconds: 270;
  readonly minorFindings: "suppress";
  readonly dryRunArtifact: "artifacts/manual/s2-config-dry-run.json";
};

type ParseReviewConfig = (input: ReviewConfigInput) => ParsedReviewConfig;

const configModule = "../../src/config/review-config.js";
const configPath = "src/config/review-config.ts";

function isParseReviewConfig(value: unknown): value is ParseReviewConfig {
  return typeof value === "function";
}

describe("S2 config, prompt, timeout, and minor-finding RED contract", () => {
  it("CFG-S2-RED-001 clamps config, suppresses minor findings, and emits dry-run artifact", async () => {
    // Given: user-facing config inputs covering model, prompt effort, timeout, stall, and minor-finding policy.
    const input: ReviewConfigInput = {
      model: "auto",
      effort: "medium",
      reviewTimeoutSeconds: 999,
      stallSeconds: 270,
      maxOutputTokens: 16_000,
      minorFindings: "suppress",
      dryRun: true,
    };

    // When: the future config parser normalizes the action inputs.
    const parseReviewConfig = await expectNotImplementedExport(configModule, configPath, "parseReviewConfig");
    if (!isParseReviewConfig(parseReviewConfig)) {
      expect.fail("RED: src/config/review-config.ts must export parseReviewConfig(input)");
    }
    const result = parseReviewConfig(input);

    // Then: timeout semantics and minor-finding behavior are explicit and dry-run output is contractually named.
    expect(result).toEqual({
      model: "auto",
      effort: "medium",
      reviewTimeoutSeconds: 300,
      stallSeconds: 270,
      minorFindings: "suppress",
      dryRunArtifact: "artifacts/manual/s2-config-dry-run.json",
    });
  });
});
