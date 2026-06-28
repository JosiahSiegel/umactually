import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { expectNotImplementedExport } from "../helpers/assert-red-module.js";

type GithubReviewContract = {
  readonly platform: "github";
  readonly eventJson: string;
  readonly diffText: string;
  readonly providerReviewJson: string;
  readonly expectedArtifact: "artifacts/manual/s1-github-self-review.md";
};

type PostedGithubReview = {
  readonly artifactPath: string;
  readonly event: "COMMENT";
  readonly marker: "<!-- umactually-pr-review -->";
  readonly inlineThreadCount: number;
  readonly suppressedCommentCount: number;
};

type RunReview = (contract: GithubReviewContract) => Promise<PostedGithubReview>;

const runReviewModule = "../../src/review/run-review.js";
const runReviewPath = "src/review/run-review.ts";

function isRunReview(value: unknown): value is RunReview {
  return typeof value === "function";
}

describe("S1 GitHub self-review RED contract", () => {
  it("GH-S1-RED-001 posts a GitHub PR review with inline threads, suppressed comments, and manual artifact", async () => {
    // Given: a synthetic GitHub PR event, full PR diff, and provider review payload.
    const eventJson = await readFile(new URL("../fixtures/github/pull-request-event.json", import.meta.url), "utf8");
    const diffText = await readFile(new URL("../fixtures/github/full-pr.diff", import.meta.url), "utf8");
    const providerReviewJson = await readFile(new URL("../fixtures/github/provider-review.json", import.meta.url), "utf8");
    expect(eventJson).toContain("example/umactually-fixture");
    expect(diffText).toContain("sk_test_synthetic_fixture_value_do_not_use");
    expect(providerReviewJson).toContain("suppressed_comments");

    // When: the future review runner processes the GitHub fixture in dry-run mode.
    const runReview = await expectNotImplementedExport(runReviewModule, runReviewPath, "runReview");
    if (!isRunReview(runReview)) {
      expect.fail("RED: src/review/run-review.ts must export runReview(contract)");
    }
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
      marker: "<!-- umactually-pr-review -->",
      inlineThreadCount: 1,
      suppressedCommentCount: 1,
    });
  });
});
