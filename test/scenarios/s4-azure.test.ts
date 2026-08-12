import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { runAzureReview } from "../../src/azure/run-azure-review.js";
import { REVIEW_MARKER } from "../../src/util/marker.js";

describe("S4 Azure DevOps mocked PR review contract", () => {
  it("AZ-S4-RED-001 posts Azure PR threads and statuses through the mocked surface", async () => {
    // Given: Azure PR metadata, existing review threads, and a provider review payload.
    const pullRequestJson = await readFile(new URL("../fixtures/azure/pull-request.json", import.meta.url), "utf8");
    const existingThreadsJson = await readFile(new URL("../fixtures/azure/threads.json", import.meta.url), "utf8");
    const reviewJson = await readFile(new URL("../fixtures/github/provider-review.json", import.meta.url), "utf8");
    expect(pullRequestJson).toContain("pullRequestId");
    expect(existingThreadsJson).toContain(REVIEW_MARKER);
    expect(reviewJson).toContain("Synthetic test secret");

    // When: the Azure runner processes the mocked PR surface.
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
      postedStatusState: "pending",
      marker: REVIEW_MARKER,
    });
  });
});
