import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { runReview } from "../../src/review/run-review.js";
import { REVIEW_MARKER } from "../../src/util/marker.js";

describe("S1 GitHub self-review contract", () => {
  it("does not re-export REVIEW_MARKER from the review runner", async () => {
    // Given / When: the review runner module is loaded.
    const reviewModule = await import("../../src/review/run-review.js");

    // Then: callers use the canonical marker module directly.
    expect("REVIEW_MARKER" in reviewModule).toBe(false);
  });

  it("GH-S1-RED-001 posts a GitHub PR review with inline threads, suppressed comments, and manual artifact", async () => {
    // Given: a synthetic GitHub PR event, full PR diff, and provider review payload.
    const eventJson = await readFile(new URL("../fixtures/github/pull-request-event.json", import.meta.url), "utf8");
    const diffText = await readFile(new URL("../fixtures/github/full-pr.diff", import.meta.url), "utf8");
    const providerReviewJson = await readFile(new URL("../fixtures/github/provider-review.json", import.meta.url), "utf8");
    expect(eventJson).toContain("example/umactually-fixture");
    expect(diffText).toContain("sk_test_synthetic_fixture_value_do_not_use");
    expect(providerReviewJson).toContain("suppressed_comments");

    // When: the review runner processes the GitHub fixture in dry-run mode.
    const result = await runReview({
      platform: "github",
      eventJson,
      diffText,
      providerReviewJson,
      expectedArtifact: "artifacts/manual/s1-github-self-review.md",
    });

    // Then: the observable posting surface uses the non-blocking review API and writes the manual artifact.
    expect(result).toEqual({
      artifactPath: "artifacts/manual/s1-github-self-review.md",
      event: "COMMENT",
      marker: REVIEW_MARKER,
      inlineThreadCount: 1,
      suppressedCommentCount: 1,
    });
  });
});
