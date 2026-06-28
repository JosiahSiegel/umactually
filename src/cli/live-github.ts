import { fetchGithubPrDiff } from "../platform/github/api.js";
import { type GithubContext } from "../platform/github/context.js";
import { REVIEW_MARKER } from "../review/run-review.js";
import {
  buildReviewBody,
  countSuppressedComments,
  ensureHttpOk,
  mapReviewVerdictToGithubEvent,
  readJsonResponse,
  readResponseId,
  requestLiveReview,
  selectPostableComments,
  type FetchImpl,
  type LiveRunResult,
  type LiveRuntimeConfig,
} from "./live-shared.js";

export async function runGithubLive(config: LiveRuntimeConfig & { readonly context: GithubContext }): Promise<LiveRunResult> {
  const diffText = await fetchGithubPrDiff(config.context, config.fetchImpl);
  const provider = await requestLiveReview({
    parsed: config.parsed,
    cwd: config.cwd,
    env: config.env,
    fetchImpl: config.fetchImpl,
    platform: "github",
    diffText,
    platformToken: config.context.token,
  });
  const comments = selectPostableComments({
    review: provider.review,
    diffText,
    parsed: config.parsed,
    secrets: [config.context.token],
  });
  const body = buildReviewBody({
    review: provider.review,
    provider: provider.provider,
    modelId: provider.modelId,
    validCommentCount: comments.length,
    suppressedCommentCount: countSuppressedComments(provider.review, diffText),
    secrets: [config.context.token],
  });
  const existing = await findExistingMarkerReview(config.context, config.fetchImpl);
  if (existing !== null) {
    const reviewId = await updateExistingReview({ context: config.context, fetchImpl: config.fetchImpl, review: existing, body });
    return { exitCode: 0, posted: true, reviewId, message: "updated existing GitHub review" };
  }
  const reviewId = await createGithubReview({
    context: config.context,
    fetchImpl: config.fetchImpl,
    body,
    event: mapReviewVerdictToGithubEvent(provider.review.verdict),
    comments: comments.map((comment) => ({
      path: comment.path,
      line: comment.line,
      side: "RIGHT",
      body: comment.body,
    })),
  });
  return { exitCode: 0, posted: true, reviewId, message: "posted GitHub review" };
}

type ExistingGithubReview = {
  readonly id: number;
  readonly body: string;
};

type GithubReviewCommentRequest = {
  readonly path: string;
  readonly line: number;
  readonly side: "RIGHT";
  readonly body: string;
};

type CreateGithubReviewRequest = {
  readonly commit_id: string;
  readonly body: string;
  readonly event: "COMMENT" | "REQUEST_CHANGES";
  readonly comments: readonly GithubReviewCommentRequest[];
};

async function findExistingMarkerReview(context: GithubContext, fetchImpl: FetchImpl): Promise<ExistingGithubReview | null> {
  const response = await fetchImpl(githubReviewsUrl(context), {
    method: "GET",
    headers: githubHeaders(context.token),
  });
  ensureHttpOk(response, "GITHUB_LIST_REVIEWS_FAILED", "GitHub list reviews");
  const json = await readJsonResponse(response);
  if (!Array.isArray(json)) {
    return null;
  }
  for (const entry of json) {
    const review = parseExistingReview(entry);
    if (review !== null && review.body.includes(REVIEW_MARKER)) {
      return review;
    }
  }
  return null;
}

async function updateExistingReview(input: {
  readonly context: GithubContext;
  readonly fetchImpl: FetchImpl;
  readonly review: ExistingGithubReview;
  readonly body: string;
}): Promise<number> {
  const response = await input.fetchImpl(`${githubReviewsUrl(input.context)}/${input.review.id}`, {
    method: "PUT",
    headers: githubHeaders(input.context.token),
    body: JSON.stringify({ body: input.body }),
  });
  ensureHttpOk(response, "GITHUB_UPDATE_REVIEW_FAILED", "GitHub update review");
  return input.review.id;
}

async function createGithubReview(input: {
  readonly context: GithubContext;
  readonly fetchImpl: FetchImpl;
  readonly body: string;
  readonly event: "COMMENT" | "REQUEST_CHANGES";
  readonly comments: readonly GithubReviewCommentRequest[];
}): Promise<number | undefined> {
  const request: CreateGithubReviewRequest = {
    commit_id: input.context.headSha,
    body: input.body,
    event: input.event,
    comments: input.comments,
  };
  const response = await input.fetchImpl(githubReviewsUrl(input.context), {
    method: "POST",
    headers: githubHeaders(input.context.token),
    body: JSON.stringify(request),
  });
  ensureHttpOk(response, "GITHUB_CREATE_REVIEW_FAILED", "GitHub create review");
  return readResponseId(await readJsonResponse(response));
}

function parseExistingReview(value: unknown): ExistingGithubReview | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const id = record["id"];
  const body = record["body"];
  if (typeof id === "number" && Number.isSafeInteger(id) && typeof body === "string") {
    return { id, body };
  }
  return null;
}

function githubReviewsUrl(context: GithubContext): string {
  const owner = encodeURIComponent(context.repo.owner);
  const repo = encodeURIComponent(context.repo.name);
  return `https://api.github.com/repos/${owner}/${repo}/pulls/${context.prNumber}/reviews`;
}

function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2026-03-10",
    "User-Agent": "umactually-pr-review",
  };
}
