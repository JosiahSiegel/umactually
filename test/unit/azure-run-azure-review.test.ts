// SPDX-License-Identifier: MIT
//
// Unit tests for src/azure/run-azure-review.ts. The module's parse
// helpers (`parsePullRequest`, `parseAzureThreads`, `parseProviderReview`)
// are NOT exported; they are reached through the public surface
// `runAzureReview(contract)`. Each test below constructs a synthetic
// contract that exercises one parser path (happy + each error branch).
//
// The module ALWAYS runs `scanReviewSecrets` before posting — every test
// gives it benign content so the secret scanner returns 0 leaks and the
// thread-counting / status-mapping paths run normally.

import { beforeEach, describe, expect, it, vi } from "vitest";

import { runAzureReview, type AzureReviewContract } from "../../src/azure/run-azure-review.js";
import { scanReviewSecrets } from "../../src/security/scan-review-secrets.js";
import { REVIEW_MARKER } from "../../src/util/marker.js";

vi.mock("../../src/security/scan-review-secrets.js", () => ({
  scanReviewSecrets: vi.fn(async () => ({
    artifactPath: "artifacts/manual/s5-redaction-report.json",
    highConfidenceLeakCount: 0,
    redactedDiffIncludesSecret: false,
    blockedRawOutput: true as const,
  })),
}));

const mockedScanReviewSecrets = vi.mocked(scanReviewSecrets);

beforeEach(() => {
  mockedScanReviewSecrets.mockClear();
});

const PULL_REQUEST_JSON = JSON.stringify({
  pullRequestId: 1234,
  title: "Demo PR",
});

function makeAzureThreadFixture(): {
  readonly existingThreadsJson: string;
} {
  return {
    existingThreadsJson: JSON.stringify({
      value: [
        {
          status: "active",
          threadContext: {
            filePath: "/src/example.ts",
            rightFileStart: { line: 42 },
          },
          comments: [
            { content: `${REVIEW_MARKER}\nprior UmActually review` },
          ],
        },
      ],
    }),
  };
}

function makeContract(
  overrides: Partial<AzureReviewContract> = {},
): AzureReviewContract {
  return {
    pullRequestJson: PULL_REQUEST_JSON,
    existingThreadsJson: JSON.stringify({ value: [] }),
    reviewJson: JSON.stringify({
      verdict: "NEEDS_FIX",
      comments: [],
      suppressed_comments: [],
    }),
    expectedArtifact: "artifacts/manual/s4-azure-mocked-run.json",
    ...overrides,
  };
}

describe("runAzureReview — happy paths", () => {
  it("posts 1 thread when a review comment matches an existing marker-bearing thread (status=pending for NEEDS_FIX)", async () => {
    // Given: an existing thread at /src/example.ts:42 already carries
    // the UmActually marker, and the provider review emits a comment
    // for the same path/line.
    const { existingThreadsJson } = makeAzureThreadFixture();
    const contract = makeContract({
      existingThreadsJson,
      reviewJson: JSON.stringify({
        verdict: "NEEDS_FIX",
        comments: [{ path: "src/example.ts", line: 42 }],
        suppressed_comments: [],
      }),
    });

    // When: the dry-run executes.
    const result = await runAzureReview(contract);

    // Then: postedThreadCount reflects the dedup match (1 thread on
    // the PR is "posted" in mocked-dry-run terms), and the status is
    // "pending" because mapVerdictToAzureStatus("NEEDS_FIX") returns
    // "pending" (NEEDS_FIX is not in the umbrella verdict set).
    expect(result.postedThreadCount).toBe(1);
    expect(result.postedStatusState).toBe("pending");
    expect(result.artifactPath).toBe("artifacts/manual/s4-azure-mocked-run.json");
    expect(result.marker).toBe(REVIEW_MARKER);
  });

  it("posts 0 threads when no review comment matches an existing thread (status=pending)", async () => {
    // Given: an empty Azure threads list and a review emitting a
    // comment for an unrelated path.
    const contract = makeContract({
      existingThreadsJson: JSON.stringify({ value: [] }),
      reviewJson: JSON.stringify({
        verdict: "NEEDS_FIX",
        comments: [{ path: "src/other.ts", line: 10 }],
        suppressed_comments: [],
      }),
    });

    // When: the dry-run executes.
    const result = await runAzureReview(contract);

    // Then: no thread is counted (the unmatched comment is not on
    // any existing thread) and status is pending for NEEDS_FIX.
    expect(result.postedThreadCount).toBe(0);
    expect(result.postedStatusState).toBe("pending");
  });

  it("returns status='succeeded' for an APPROVED verdict (umbrella verdict)", async () => {
    // Given: an APPROVED verdict (which is in the umbrella-verdict set
    // and maps to 'succeeded' in src/util/verdict.ts).
    const contract = makeContract({
      reviewJson: JSON.stringify({
        verdict: "APPROVED",
        comments: [],
        suppressed_comments: [],
      }),
    });

    // When/Then: postedStatusState is 'succeeded'.
    const result = await runAzureReview(contract);
    expect(result.postedStatusState).toBe("succeeded");
  });

  it("returns status='succeeded' for a COMMENT verdict (umbrella verdict)", async () => {
    // Given: a COMMENT verdict (also in the umbrella-verdict set).
    const contract = makeContract({
      reviewJson: JSON.stringify({
        verdict: "COMMENT",
        comments: [],
        suppressed_comments: [],
      }),
    });

    // When/Then: postedStatusState is 'succeeded'.
    const result = await runAzureReview(contract);
    expect(result.postedStatusState).toBe("succeeded");
  });

  it("counts a matched comment even when suppressed_comments are non-empty", async () => {
    // Given: a review that has postable comments matching a marker-
    // bearing thread AND a separate suppressed_comments list. The
    // dedup count must come from `comments`, not from the suppressed
    // list.
    const { existingThreadsJson } = makeAzureThreadFixture();
    const contract = makeContract({
      existingThreadsJson,
      reviewJson: JSON.stringify({
        verdict: "NEEDS_FIX",
        comments: [{ path: "src/example.ts", line: 42 }],
        suppressed_comments: [{ path: "src/suppressed.ts", line: 99 }],
      }),
    });

    // When/Then: postedThreadCount reflects only the matched `comments`
    // entry (suppressed entries are post-suppressed and not counted).
    const result = await runAzureReview(contract);
    expect(result.postedThreadCount).toBe(1);
  });

  it("returns 0 when ALL comments are suppressed (comments list is empty)", async () => {
    // Given: the model emitted only suppressed_comments (the
    // postable `comments` list is empty).
    const contract = makeContract({
      reviewJson: JSON.stringify({
        verdict: "NEEDS_FIX",
        comments: [],
        suppressed_comments: [{ path: "src/example.ts", line: 42 }],
      }),
    });

    // When/Then: postedThreadCount is 0 because no `comments` entry
    // is present to count against existing threads.
    const result = await runAzureReview(contract);
    expect(result.postedThreadCount).toBe(0);
  });

  it("passes an empty string to scanReviewSecrets when diffText is omitted", async () => {
    // Given: a contract without diffText — the runtime contract is
    // that scanReviewSecrets receives empty-string content (NOT
    // undefined) so its regex pre-scan does not throw on undefined.
    const contract = makeContract();

    // When: the dry-run executes.
    await runAzureReview(contract);

    // Then: scanReviewSecrets was called exactly once with diffText: "".
    expect(mockedScanReviewSecrets).toHaveBeenCalledTimes(1);
    const lastCall = mockedScanReviewSecrets.mock.calls.at(-1);
    expect(lastCall?.[0]?.diffText).toBe("");
    expect(lastCall?.[0]?.expectedArtifact).toBe(
      "artifacts/manual/s5-redaction-report.json",
    );
  });

  it("passes the supplied diffText through to scanReviewSecrets when provided", async () => {
    // Given: a contract that carries an explicit diffText.
    const contract = makeContract({ diffText: "+ console.log('hello')" });

    // When: the dry-run executes.
    await runAzureReview(contract);

    // Then: scanReviewSecrets received the literal diffText.
    const lastCall = mockedScanReviewSecrets.mock.calls.at(-1);
    expect(lastCall?.[0]?.diffText).toBe("+ console.log('hello')");
  });
});

describe("runAzureReview — parsePullRequest invalid input", () => {
  it("throws on completely invalid JSON (SyntaxError propagates from JSON.parse)", async () => {
    // Given: a pullRequestJson string that is not JSON at all.
    const contract = makeContract({ pullRequestJson: "this is not json" });

    // When/Then: JSON.parse throws SyntaxError which propagates through
    // parsePullRequest (it does not catch the parse failure).
    await expect(runAzureReview(contract)).rejects.toBeInstanceOf(SyntaxError);
  });

  it.each([
    ["valid json, but an array", "[1,2,3]"],
    ["valid json, but a string", '"hello"'],
    ["valid json, but null", "null"],
    ["valid json, but missing pullRequestId", JSON.stringify({ title: "x" })],
    ["valid json, pullRequestId is a string", JSON.stringify({ pullRequestId: "1234" })],
  ])("throws on %s", async (_label, pullRequestJson) => {
    // Given: a malformed pullRequestJson string.
    const contract = makeContract({ pullRequestJson });

    // When/Then: the dry-run rejects with a TypeError (the parsePullRequest
    // helper rejects non-objects and non-number pullRequestId values).
    await expect(runAzureReview(contract)).rejects.toBeInstanceOf(TypeError);
  });
});

describe("runAzureReview — parseAzureThreads invalid input", () => {
  it("throws on completely invalid JSON (SyntaxError propagates from JSON.parse)", async () => {
    // Given: an existingThreadsJson string that is not JSON.
    const contract = makeContract({ existingThreadsJson: "this is not json" });

    // When/Then: JSON.parse throws SyntaxError.
    await expect(runAzureReview(contract)).rejects.toBeInstanceOf(SyntaxError);
  });

  it.each([
    ["valid json, but an array", "[1,2,3]"],
    ["valid json, but missing 'value' field", JSON.stringify({ notValue: [] })],
    ["'value' is not an array", JSON.stringify({ value: "string" })],
    ["'value' contains a thread missing status", JSON.stringify({
      value: [{ threadContext: { filePath: "/x", rightFileStart: { line: 1 } }, comments: [] }],
    })],
    ["'value' contains a thread with non-string filePath", JSON.stringify({
      value: [{
        status: "active",
        threadContext: { filePath: 42, rightFileStart: { line: 1 } },
        comments: [],
      }],
    })],
  ])("throws on %s", async (_label, existingThreadsJson) => {
    // Given: a malformed existingThreadsJson string.
    const contract = makeContract({ existingThreadsJson });

    // When/Then: the dry-run rejects (parseAzureThreads rejects
    // non-object roots, missing/non-array 'value', and per-thread
    // shape errors).
    await expect(runAzureReview(contract)).rejects.toBeInstanceOf(TypeError);
  });
});

describe("runAzureReview — parseProviderReview invalid input", () => {
  it("throws on non-JSON review payload", async () => {
    // Given: a reviewJson that is not JSON.
    const contract = makeContract({ reviewJson: "not json" });

    // When/Then: JSON.parse throws SyntaxError (propagated through
    // the parseProviderReview helper).
    await expect(runAzureReview(contract)).rejects.toBeInstanceOf(SyntaxError);
  });

  it("throws when the root is not a JSON object", async () => {
    // Given: a JSON array as the review root.
    const contract = makeContract({ reviewJson: JSON.stringify([1, 2, 3]) });

    // When/Then: parseProviderReview rejects non-object roots.
    await expect(runAzureReview(contract)).rejects.toBeInstanceOf(TypeError);
  });

  it.each([
    ["verdict missing entirely", { comments: [], suppressed_comments: [] }],
    ["verdict is a number", { verdict: 42, comments: [], suppressed_comments: [] }],
    ["verdict is unknown string", { verdict: "MAYBE", comments: [], suppressed_comments: [] }],
  ])("throws on %s", async (_label, review) => {
    // Given: an invalid verdict (each case maps to a different parse
    // failure in readVerdict or the surrounding record reader).
    const contract = makeContract({ reviewJson: JSON.stringify(review) });

    // When/Then: the dry-run rejects.
    await expect(runAzureReview(contract)).rejects.toBeInstanceOf(TypeError);
  });

  it("throws when comments is not an array", async () => {
    // Given: comments is a string instead of an array.
    const contract = makeContract({
      reviewJson: JSON.stringify({
        verdict: "NEEDS_FIX",
        comments: "not-an-array",
        suppressed_comments: [],
      }),
    });

    // When/Then: readCommentArray rejects.
    await expect(runAzureReview(contract)).rejects.toBeInstanceOf(TypeError);
  });

  it("throws when a comment has a non-string path", async () => {
    // Given: a comment with a number where path is expected.
    const contract = makeContract({
      reviewJson: JSON.stringify({
        verdict: "NEEDS_FIX",
        comments: [{ path: 42, line: 1 }],
        suppressed_comments: [],
      }),
    });

    // When/Then: readStringField rejects.
    await expect(runAzureReview(contract)).rejects.toBeInstanceOf(TypeError);
  });

  it("throws when a comment has a non-number line", async () => {
    // Given: a comment with a string where line is expected.
    const contract = makeContract({
      reviewJson: JSON.stringify({
        verdict: "NEEDS_FIX",
        comments: [{ path: "x.ts", line: "1" }],
        suppressed_comments: [],
      }),
    });

    // When/Then: readSafeIntegerField rejects.
    await expect(runAzureReview(contract)).rejects.toBeInstanceOf(TypeError);
  });
});

describe("runAzureReview — Azure thread shape validation", () => {
  it("throws when a thread's threadContext is missing", async () => {
    // Given: a thread entry without the threadContext field.
    const contract = makeContract({
      existingThreadsJson: JSON.stringify({
        value: [{ status: "active", comments: [] }],
      }),
    });

    // When/Then: readThreadContext rejects the missing-context object.
    await expect(runAzureReview(contract)).rejects.toBeInstanceOf(TypeError);
  });

  it("throws when a thread's rightFileStart is missing", async () => {
    // Given: a thread whose threadContext lacks rightFileStart.
    const contract = makeContract({
      existingThreadsJson: JSON.stringify({
        value: [{
          status: "active",
          threadContext: { filePath: "/x" },
          comments: [],
        }],
      }),
    });

    // When/Then: readThreadContext rejects the missing-start object.
    await expect(runAzureReview(contract)).rejects.toBeInstanceOf(TypeError);
  });

  it("throws when a thread's comments is not an array", async () => {
    // Given: threadContext/comments shape where comments is a string.
    const contract = makeContract({
      existingThreadsJson: JSON.stringify({
        value: [{
          status: "active",
          threadContext: { filePath: "/x", rightFileStart: { line: 1 } },
          comments: "not-an-array",
        }],
      }),
    });

    // When/Then: readThreadComments rejects.
    await expect(runAzureReview(contract)).rejects.toBeInstanceOf(TypeError);
  });

  it("throws when a thread comment has non-string content", async () => {
    // Given: a thread entry whose comment content is a number.
    const contract = makeContract({
      existingThreadsJson: JSON.stringify({
        value: [{
          status: "active",
          threadContext: { filePath: "/x", rightFileStart: { line: 1 } },
          comments: [{ content: 42 }],
        }],
      }),
    });

    // When/Then: readStringField rejects.
    await expect(runAzureReview(contract)).rejects.toBeInstanceOf(TypeError);
  });
});
