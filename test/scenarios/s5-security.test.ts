import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { scanReviewSecrets } from "../../src/security/scan-review-secrets.js";

describe("S5 redaction and leak-detection contract", () => {
  it("SEC-S5-RED-001 detects high-confidence diff secrets and prevents raw output leaks", async () => {
    // Given: a PR diff containing only synthetic secret-looking material.
    const diffText = await readFile(new URL("../fixtures/github/full-pr.diff", import.meta.url), "utf8");
    expect(diffText).toContain("sk_test_synthetic_fixture_value_do_not_use");

    // When: the scanner evaluates the diff before review rendering or posting.
    const result = await scanReviewSecrets({
      diffText,
      expectedArtifact: "artifacts/manual/s5-redaction-report.json",
    });

    // Then: the leak is counted, redacted from output, and raw model dumps are blocked from public comments.
    expect(result).toEqual({
      artifactPath: "artifacts/manual/s5-redaction-report.json",
      highConfidenceLeakCount: 1,
      redactedDiffIncludesSecret: false,
      blockedRawOutput: true,
    });
  });
});
