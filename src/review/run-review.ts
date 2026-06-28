import { scanReviewSecrets } from "../security/scan-review-secrets.js";
import { parseDiffPositions } from "../diff/parse-positions.js";

export type GithubReviewContract = {
  readonly platform: "github";
  readonly eventJson: string;
  readonly diffText: string;
  readonly providerReviewJson: string;
  readonly expectedArtifact: "artifacts/manual/s1-github-self-review.md";
};

export type PostedGithubReview = {
  readonly artifactPath: string;
  readonly event: "COMMENT";
  readonly marker: "<!-- umactually-pr-review -->";
  readonly inlineThreadCount: number;
  readonly suppressedCommentCount: number;
};

export const REVIEW_MARKER = "<!-- umactually-pr-review -->";

type ProviderComment = {
  readonly path: string;
  readonly line: number;
};

type ProviderReviewPayload = {
  readonly comments: readonly ProviderComment[];
  readonly suppressed_comments: readonly ProviderComment[];
};

export async function runReview(contract: GithubReviewContract): Promise<PostedGithubReview> {
  parseEvent(contract.eventJson);
  const review = parseProviderReview(contract.providerReviewJson);
  const positions = parseDiffPositions(contract.diffText);

  // Always run secret scan before posting — leaks block raw output regardless of flags.
  await scanReviewSecrets({
    diffText: contract.diffText,
    expectedArtifact: "artifacts/manual/s5-redaction-report.json",
  });

  const inlineThreadCount = countMatchingComments(review.comments, positions);
  const suppressedCommentCount = countOffDiffComments(review, positions);

  return {
    artifactPath: contract.expectedArtifact,
    event: "COMMENT",
    marker: REVIEW_MARKER,
    inlineThreadCount,
    suppressedCommentCount,
  };
}

function parseEvent(eventJson: string): void {
  const value: unknown = JSON.parse(eventJson);
  parsePullRequestEvent(value);
}

function parseProviderReview(providerReviewJson: string): ProviderReviewPayload {
  const value: unknown = JSON.parse(providerReviewJson);
  return parseProviderReviewPayload(value);
}

function countMatchingComments(
  comments: readonly ProviderComment[],
  positions: ReturnType<typeof parseDiffPositions>,
): number {
  let count = 0;
  for (const comment of comments) {
    if (positions.hasPosition(comment)) {
      count += 1;
    }
  }
  return count;
}

function countOffDiffComments(
  review: ProviderReviewPayload,
  positions: ReturnType<typeof parseDiffPositions>,
): number {
  let count = 0;
  for (const comment of review.comments) {
    if (!positions.hasPosition(comment)) {
      count += 1;
    }
  }
  for (const comment of review.suppressed_comments) {
    if (!positions.hasPosition(comment)) {
      count += 1;
    }
  }
  return count;
}

function parsePullRequestEvent(value: unknown): void {
  const event = readRecord(value, "GitHub event");
  const pullRequest = readRecord(readField(event, "pull_request"), "pull_request");
  readNumberField(pullRequest, "number");
}

function parseProviderReviewPayload(value: unknown): ProviderReviewPayload {
  const review = readRecord(value, "provider review");
  const comments = readCommentArray(readField(review, "comments"));
  const suppressedComments = readCommentArray(readField(review, "suppressed_comments"));
  return { comments: comments, suppressed_comments: suppressedComments };
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`Expected ${label} to be an object, received: ${typeof value}`);
  }

  return value as Record<string, unknown>;
}

function readField(record: Record<string, unknown>, key: string): unknown {
  return record[key];
}

function readNumberField(record: Record<string, unknown>, key: string): number {
  const value = readField(record, key);
  if (typeof value !== "number") {
    throw new TypeError(`Expected field '${key}' to be a number, received: ${typeof value}`);
  }
  return value;
}

function readCommentArray(value: unknown): readonly ProviderComment[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`Expected comment array, received: ${typeof value}`);
  }

  const comments: ProviderComment[] = [];
  for (const entry of value) {
    comments.push(parseComment(entry));
  }
  return comments;
}

function parseComment(value: unknown): ProviderComment {
  const record = readRecord(value, "comment");
  const path = readField(record, "path");
  const line = readField(record, "line");
  if (typeof path !== "string") {
    throw new TypeError(`Expected comment 'path' to be a string, received: ${typeof path}`);
  }
  if (typeof line !== "number") {
    throw new TypeError(`Expected comment 'line' to be a number, received: ${typeof line}`);
  }

  return { path, line };
}