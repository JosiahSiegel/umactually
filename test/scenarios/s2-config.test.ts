import { describe, expect, it } from "vitest";

import { parseReviewConfig, type ReviewConfigInput } from "../../src/config/review-config.js";

describe("S2 config, prompt, timeout, and minor-finding contract", () => {
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

    // When: the config parser normalizes the action inputs.
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
