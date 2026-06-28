import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { expectNotImplementedExport } from "../helpers/assert-red-module.js";

type AzureReviewContract = {
  readonly pullRequestJson: string;
  readonly existingThreadsJson: string;
  readonly reviewJson: string;
  readonly expectedArtifact: "artifacts/manual/s4-azure-mocked-run.json";
};

type AzureMockedRun = {
  readonly artifactPath: string;
  readonly postedThreadCount: number;
  readonly postedStatusState: "succeeded" | "failed" | "pending";
  readonly marker: "<!-- umactually-pr-review -->";
};

type RunAzureReview = (contract: AzureReviewContract) => Promise<AzureMockedRun>;

const azureModule = "../../src/azure/run-azure-review.js";
const azurePath = "src/azure/run-azure-review.ts";

function isRunAzureReview(value: unknown): value is RunAzureReview {
  return typeof value === "function";
}

describe("S4 Azure DevOps mocked PR review RED contract", () => {
  it("AZ-S4-RED-001 posts Azure PR threads and statuses through the mocked surface", async () => {
    // Given: Azure PR metadata, existing review threads, and a provider review payload.
    const pullRequestJson = await readFile(new URL("../fixtures/azure/pull-request.json", import.meta.url), "utf8");
    const existingThreadsJson = await readFile(new URL("../fixtures/azure/threads.json", import.meta.url), "utf8");
    const reviewJson = await readFile(new URL("../fixtures/github/provider-review.json", import.meta.url), "utf8");
    expect(pullRequestJson).toContain("pullRequestId");
    expect(existingThreadsJson).toContain("<!-- umactually-pr-review -->");
    expect(reviewJson).toContain("Synthetic test secret");

    // When: the future Azure runner processes the mocked PR surface.
    const runAzureReview = await expectNotImplementedExport(azureModule, azurePath, "runAzureReview");
    if (!isRunAzureReview(runAzureReview)) {
      expect.fail("RED: src/azure/run-azure-review.ts must export runAzureReview(contract)");
    }
    const result = await runAzureReview({
      pullRequestJson,
      existingThreadsJson,
      reviewJson,
      expectedArtifact: "artifacts/manual/s4-azure-mocked-run.json",
    });

    // Then: Azure output records thread and status calls without touching real Azure DevOps.
    expect(result).toEqual({
      artifactPath: "artifacts/manual/s4-azure-mocked-run.json",
      postedThreadCount: 1,
      postedStatusState: "failed",
      marker: "<!-- umactually-pr-review -->",
    });
  });
});
