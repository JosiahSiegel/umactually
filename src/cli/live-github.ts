import { type GithubContext } from "../platform/github/context.js";
import { REVIEW_MARKER } from "../review/run-review.js";
import {
  LiveReviewError,
  buildReviewBody,
  countSuppressedComments,
  ensureHttpOk,
  evaluateLeakGate,
  mapReviewVerdictToGithubEvent,
  readJsonResponse,
  readResponseId,
  selectPostableComments,
  type FetchImpl,
  type LiveProviderOutcome,
  type LiveRunResult,
} from "./live-shared.js";

export async function runGithubLive(input: {
  readonly context: GithubContext;
  readonly diffText: string;
  readonly provider: LiveProviderOutcome;
  readonly parsed: Parameters<typeof selectPostableComments>[0]["parsed"];
  readonly fetchImpl: FetchImpl;
}): Promise<LiveRunResult> {
  const { context, diffText, provider, parsed, fetchImpl } = input;

  // Refuse to post when the diff contains high-confidence secrets.
  // This is the runtime enforcement of "identify leaks" — the scanner
  // (src/security/scan-review-secrets.ts) counts leaks, this gate enforces.
  const leakGate = await evaluateLeakGate({
    diffText,
    detectLeaks: parsed.detectLeaks,
  });
  if (!leakGate.ok) {
    process.stderr.write(`::error::umactually-pr-review: ${leakGate.message}\n`);
    return {
      exitCode: 1,
      posted: false,
      reviewId: undefined,
      message: leakGate.message,
    };
  }

  const comments = selectPostableComments({
    review: provider.review,
    diffText,
    parsed,
    secrets: [context.token],
  });
  const postableComments = comments.map((comment) => ({
    path: comment.path,
    line: comment.line,
    side: "RIGHT" as const,
    body: comment.body,
  }));
  const body = buildReviewBody({
    review: provider.review,
    provider: provider.provider,
    modelId: provider.modelId,
    validCommentCount: comments.length,
    suppressedCommentCount: countSuppressedComments(provider.review, diffText),
    secrets: [context.token],
  });
  const existing = await findExistingMarkerReview(context, fetchImpl);
  // When simulate-findings is set the demo path must ALWAYS replace the
  // existing review via DELETE+POST — even when the new payload carries 0
  // inline comments. PUT only works on PENDING reviews, but an action's
  // submitted review is COMMENTED, so PUT is silently dropped by GitHub.
  // The DELETE+POST path produces a fully populated review body that
  // replaces whatever was on the PR before.
  const forceReplace = parsed.simulateFindings === true;
  if (
    existing !== null &&
    !forceReplace &&
    existing.state === "PENDING" &&
    postableComments.length === 0
  ) {
    const reviewId = await updateExistingReview({ context, fetchImpl, review: existing, body });
    if (reviewId !== null) {
      return { exitCode: 0, posted: true, reviewId, message: "updated existing GitHub review" };
    }
    // PUT failed (e.g., 422 because submitted) — fall through to DELETE+POST below.
  }
  if (existing !== null) {
    await deleteExistingReview({ context, fetchImpl, review: existing });
  }
  // simulate-findings is a demo of a populated review — keep the event neutral
  // regardless of the underlying verdict so we never block the PR with a
  // REQUEST_CHANGES from synthetic data.
  const event: "COMMENT" | "REQUEST_CHANGES" = forceReplace
    ? "COMMENT"
    : mapReviewVerdictToGithubEvent(provider.review.verdict);
  const reviewId = await createGithubReview({
    context,
    fetchImpl,
    body,
    event,
    comments: postableComments,
  });
  return {
    exitCode: 0,
    posted: true,
    reviewId,
    message: existing !== null ? "replaced existing GitHub review" : "posted GitHub review",
  };
}

type ExistingGithubReview = {
  readonly id: number;
  readonly body: string;
  readonly state: string;
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
    if (review !== null && review.body.includes(REVIEW_MARKER) && review.state !== "DISMISSED") {
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
}): Promise<number | null> {
  try {
    const response = await input.fetchImpl(`${githubReviewsUrl(input.context)}/${input.review.id}`, {
      method: "PUT",
      headers: githubHeaders(input.context.token),
      body: JSON.stringify({ body: input.body }),
    });
    ensureHttpOk(response, "GITHUB_UPDATE_REVIEW_FAILED", "GitHub update review");
    return input.review.id;
  } catch (error) {
    if (error instanceof LiveReviewError && error.code === "GITHUB_UPDATE_REVIEW_FAILED") {
      process.stderr.write(
        `::warning::umactually-pr-review: failed to update existing GitHub review ${input.review.id} (likely already submitted); falling back to DELETE+POST.\n`,
      );
      return null;
    }
    throw error;
  }
}

async function deleteExistingReview(input: {
  readonly context: GithubContext;
  readonly fetchImpl: FetchImpl;
  readonly review: ExistingGithubReview;
}): Promise<void> {
  const response = await input.fetchImpl(`${githubReviewsUrl(input.context)}/${input.review.id}`, {
    method: "DELETE",
    headers: githubHeaders(input.context.token),
  });
  if (response.status === 204 || response.status === 404) {
    return;
  }
  process.stderr.write(
    `::warning::umactually-pr-review: failed to delete existing review ${input.review.id} (${response.status}); posting new review anyway.\n`,
  );
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
  const state = record["state"];
  if (
    typeof id === "number" && Number.isSafeInteger(id) &&
    typeof body === "string" &&
    typeof state === "string"
  ) {
    return { id, body, state };
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
