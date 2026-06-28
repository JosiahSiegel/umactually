import { scanReviewSecrets } from "../security/scan-review-secrets.js";

const REVIEW_MARKER = "<!-- umactually-pr-review -->";

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

  const postedThreadCount = countPostableThreads(review.comments, existingThreads);

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

function countPostableThreads(comments: readonly ReviewComment[], existingThreads: AzureThreads): number {
  let count = 0;
  for (const comment of comments) {
    if (hasMatchingReviewThread(comment, existingThreads)) {
      count += 1;
    }
  }
  return count;
}

function hasMatchingReviewThread(comment: ReviewComment, existingThreads: AzureThreads): boolean {
  const azurePath = `/${comment.path}`;
  for (const thread of existingThreads.value) {
    const firstComment = thread.comments[0];
    if (
      thread.status === "active" &&
      thread.threadContext.filePath === azurePath &&
      thread.threadContext.rightFileStart.line === comment.line &&
      firstComment?.content.includes(REVIEW_MARKER) === true
    ) {
      return true;
    }
  }
  return false;
}

function mapVerdictToStatus(verdict: ReviewVerdict): AzureMockedRun["postedStatusState"] {
  switch (verdict) {
    case "NEEDS_FIX":
      return "failed";
    case "APPROVED":
      return "succeeded";
    case "COMMENT":
      return "pending";
    default:
      return assertNever(verdict);
  }
}

function assertNever(value: never): never {
  throw new TypeError(`Unexpected provider verdict: ${value}`);
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError(`Expected ${label} to be an object, received: ${typeof value}`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumberField(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number") {
    throw new TypeError(`Expected field '${key}' to be a number, received: ${typeof value}`);
  }
  return value;
}

function readStringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string") {
    throw new TypeError(`Expected field '${key}' to be a string, received: ${typeof value}`);
  }
  return value;
}

function readVerdict(value: unknown): ReviewVerdict {
  if (value === "NEEDS_FIX" || value === "APPROVED" || value === "COMMENT") {
    return value;
  }
  throw new TypeError(`Expected provider verdict, received: ${typeof value}`);
}

function readCommentArray(value: unknown): readonly ReviewComment[] {
  if (!Array.isArray(value)) {
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
  if (!Array.isArray(value)) {
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
  if (!Array.isArray(value)) {
    throw new TypeError(`Expected Azure thread comments array, received: ${typeof value}`);
  }

  const comments: { readonly content: string }[] = [];
  for (const entry of value) {
    comments.push({ content: readStringField(readRecord(entry, "Azure thread comment"), "content") });
  }
  return comments;
}