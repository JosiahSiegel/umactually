import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { expectNotImplementedExport } from "../helpers/assert-red-module.js";

type SecretScanInput = {
  readonly diffText: string;
  readonly expectedArtifact: "artifacts/manual/s5-redaction-report.json";
};

type SecretScanReport = {
  readonly artifactPath: string;
  readonly highConfidenceLeakCount: 1;
  readonly redactedDiffIncludesSecret: false;
  readonly blockedRawOutput: true;
};

type ScanReviewSecrets = (input: SecretScanInput) => Promise<SecretScanReport>;

const securityModule = "../../src/security/scan-review-secrets.js";
const securityPath = "src/security/scan-review-secrets.ts";

function isScanReviewSecrets(value: unknown): value is ScanReviewSecrets {
  return typeof value === "function";
}

describe("S5 redaction and leak-detection RED contract", () => {
  it("SEC-S5-RED-001 detects high-confidence diff secrets and prevents raw output leaks", async () => {
    // Given: a PR diff containing only synthetic secret-looking material.
    const diffText = await readFile(new URL("../fixtures/github/full-pr.diff", import.meta.url), "utf8");
    expect(diffText).toContain("sk_test_synthetic_fixture_value_do_not_use");

    // When: the future scanner evaluates the diff before review rendering or posting.
    const scanReviewSecrets = await expectNotImplementedExport(securityModule, securityPath, "scanReviewSecrets");
    if (!isScanReviewSecrets(scanReviewSecrets)) {
      expect.fail("RED: src/security/scan-review-secrets.ts must export scanReviewSecrets(input)");
    }
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
