import { scanReviewSecrets } from "../security/scan-review-secrets.js";
import { REVIEW_MARKER } from "../util/marker.js";
import { isRecord, isUnknownArray, readSafeIntegerFieldOrThrow, readStringFieldOrThrow } from "../util/json-guards.js";
import { mapVerdictToAzureStatus } from "../util/verdict.js";
import { findDuplicateThread } from "../platform/azure/api.js";

export type AzureReviewContract = {
  readonly pullRequestJson: string;
  readonly existingThreadsJson: string;
  readonly reviewJson: string;
  readonly diffText?: string;
  readonly expectedArtifact: "artifacts/manual/s4-azure-mocked-run.json";
};

export type AzureMockedRun = {
  readonly artifactPath: string;
  readonly postedThreadCount: number;
  readonly postedStatusState: "succeeded" | "failed" | "pending";
  readonly marker: typeof REVIEW_MARKER;
};

type ReviewVerdict = "NEEDS_FIX" | "APPROVED" | "COMMENT";

type ReviewComment = {
  readonly path: string;
  readonly line: number;
};

type ProviderReview = {
  readonly verdict: ReviewVerdict;
  readonly comments: readonly ReviewComment[];
  readonly suppressed_comments: readonly ReviewComment[];
};

type AzureThread = {
  readonly status: string;
  readonly threadContext: {
    readonly filePath: string;
    readonly rightFileStart: {
      readonly line: number;
    };
  };
  readonly comments: readonly {
    readonly content: string;
  }[];
};

type AzureThreads = {
  readonly value: readonly AzureThread[];
};

export async function runAzureReview(contract: AzureReviewContract): Promise<AzureMockedRun> {
  parsePullRequest(contract.pullRequestJson);
  const existingThreads = parseAzureThreads(contract.existingThreadsJson);
  const review = parseProviderReview(contract.reviewJson);

  // Always run secret scan before posting — leaks block raw output regardless of flags.
  await scanReviewSecrets({
    diffText: contract.diffText ?? "",
    expectedArtifact: "artifacts/manual/s5-redaction-report.json",
  });

  const postedThreadCount = countCommentsMatchingExistingThread(review.comments, existingThreads);

  return {
    artifactPath: contract.expectedArtifact,
    postedThreadCount,
    postedStatusState: mapVerdictToStatus(review.verdict),
    marker: REVIEW_MARKER,
  };
}

function parsePullRequest(pullRequestJson: string): void {
  const value: unknown = JSON.parse(pullRequestJson);
  readNumberField(readRecord(value, "pull request"), "pullRequestId");
}

function parseAzureThreads(existingThreadsJson: string): AzureThreads {
  const value: unknown = JSON.parse(existingThreadsJson);
  const record = readRecord(value, "Azure threads response");
  return { value: readThreadArray(record["value"]) };
}

function parseProviderReview(reviewJson: string): ProviderReview {
  const value: unknown = JSON.parse(reviewJson);
  const record = readRecord(value, "provider review");
  return {
    verdict: readVerdict(record["verdict"]),
    comments: readCommentArray(record["comments"]),
    suppressed_comments: readCommentArray(record["suppressed_comments"]),
  };
}

function countCommentsMatchingExistingThread(comments: readonly ReviewComment[], existingThreads: AzureThreads): number {
  /**
   * Count how many review comments already have a matching UmActually
   * thread on the Azure PR (any marker-bearing comment on the same
   * filePath/line in an open-or-resolved thread). The S4 contract
   * exposes this as `postedThreadCount` because the mocked dry-run
   * represents each existing thread as a "posted" thread.
   */
  let count = 0;
  for (const comment of comments) {
    if (findDuplicateThread(comment, existingThreads.value) !== null) {
      count += 1;
    }
  }
  return count;
}

function mapVerdictToStatus(verdict: ReviewVerdict): AzureMockedRun["postedStatusState"] {
  return mapVerdictToAzureStatus(verdict);
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`Expected ${label} to be an object, received: ${typeof value}`);
  }
  return value;
}

const readNumberField = readSafeIntegerFieldOrThrow;
const readStringField = readStringFieldOrThrow;

function readVerdict(value: unknown): ReviewVerdict {
  if (value === "NEEDS_FIX" || value === "APPROVED" || value === "COMMENT") {
    return value;
  }
  throw new TypeError(`Expected provider verdict, received: ${typeof value}`);
}

function readCommentArray(value: unknown): readonly ReviewComment[] {
  if (!isUnknownArray(value)) {
    throw new TypeError(`Expected review comments array, received: ${typeof value}`);
  }

  const comments: ReviewComment[] = [];
  for (const entry of value) {
    const record = readRecord(entry, "review comment");
    comments.push({ path: readStringField(record, "path"), line: readNumberField(record, "line") });
  }
  return comments;
}

function readThreadArray(value: unknown): readonly AzureThread[] {
  if (!isUnknownArray(value)) {
    throw new TypeError(`Expected Azure threads array, received: ${typeof value}`);
  }

  const threads: AzureThread[] = [];
  for (const entry of value) {
    const record = readRecord(entry, "Azure thread");
    threads.push({
      status: readStringField(record, "status"),
      threadContext: readThreadContext(record["threadContext"]),
      comments: readThreadComments(record["comments"]),
    });
  }
  return threads;
}

function readThreadContext(value: unknown): AzureThread["threadContext"] {
  const context = readRecord(value, "Azure thread context");
  const start = readRecord(context["rightFileStart"], "Azure thread start");
  return {
    filePath: readStringField(context, "filePath"),
    rightFileStart: { line: readNumberField(start, "line") },
  };
}

function readThreadComments(value: unknown): AzureThread["comments"] {
  if (!isUnknownArray(value)) {
    throw new TypeError(`Expected Azure thread comments array, received: ${typeof value}`);
  }

  const comments: { readonly content: string }[] = [];
  for (const entry of value) {
    comments.push({ content: readStringField(readRecord(entry, "Azure thread comment"), "content") });
  }
  return comments;
}
