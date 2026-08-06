import { type GithubContext } from "../platform/github/context.js";
import { commentBodyHasMarker } from "../util/marker.js";
import { githubHeaders } from "../util/http.js";
import { isRecord, isSafeInteger } from "../util/json-guards.js";
import { writeBrandedAnnotation } from "../util/log.js";
import { DEFAULT_GITHUB_API_BASE } from "../util/provider-defaults.js";
import type { ParsedCliArgs } from "./parse-args.js";
import { fetchSonarPrFindings } from "./fetch-sonar-pr-findings.js";
import {
  LiveReviewError,
  buildInlineCommentBody,
  ensureHttpOk,
  mapReviewVerdictToGithubEvent,
  passesSeverityPolicy,
  preparePostedReview,
  readJsonResponse,
  readResponseId,
  type FetchImpl,
  type LiveProviderOutcome,
  type LiveRunResult,
} from "./live-shared.js";

const GITHUB_API_BASE_URL = process.env["GITHUB_API_URL"]?.replace(/\/$/u, "") || DEFAULT_GITHUB_API_BASE;

export async function runGithubLive(input: {
  readonly context: GithubContext;
  readonly diffText: string;
  readonly provider: LiveProviderOutcome;
  readonly parsed: ParsedCliArgs;
  readonly fetchImpl: FetchImpl;
}): Promise<LiveRunResult> {
  const { context, diffText, provider, parsed, fetchImpl } = input;

  // Fetch SonarCloud PR inline comments (when the flag is set) and
  // merge them into the provider review's comments list BEFORE
  // `preparePostedReview` runs. Three invariants this preserves:
  // (1) severity filtering applies uniformly to the SonarCloud findings
  // (the same `passesSeverityPolicy` gate that drops model findings
  // below `--minimum-severity`); position validation runs downstream
  // in `preparePostedReview` via the same `positions.hasPosition` gate;
  // (2) the PR #183 verdict-reconciliation rule sees the surviving
  // SonarCloud severity counts, so a postable SonarCloud MAJOR/CRITICAL
  // escalates the verdict from SHIP/APPROVED to NEEDS_FIX; (3)
  // SonarCloud findings render as inline threads on the bot's own
  // review (one place to dismiss), in addition to SonarCloud's
  // separate reviews.
  const rawSonarFindings = parsed.includePrSonarFindings
    ? await fetchSonarPrFindings({ context, fetchImpl })
    : [];
  const sonarPrFindings = rawSonarFindings.filter((finding) =>
    passesSeverityPolicy(finding, parsed),
  );
  const droppedBySeverity = rawSonarFindings.length - sonarPrFindings.length;
  if (droppedBySeverity > 0) {
    writeBrandedAnnotation(
      "warning",
      `filtered ${droppedBySeverity} SonarCloud PR inline finding(s) below --minimum-severity=${parsed.minimumSeverity ?? "default"}; ${sonarPrFindings.length} postable.`,
    );
  }
  if (sonarPrFindings.length > 0) {
    writeBrandedAnnotation(
      "warning",
      `merged ${sonarPrFindings.length} SonarCloud PR inline finding(s) into the review (flag --include-pr-sonar-findings).`,
    );
  }
  const providerReview = sonarPrFindings.length > 0
    ? {
        ...provider.review,
        comments: [...provider.review.comments, ...sonarPrFindings],
      }
    : provider.review;

  const prepared = preparePostedReview({
    review: providerReview,
    provider: provider.provider,
    modelId: provider.modelId,
    diffText,
    parsed,
    secrets: [context.token],
  });
  const { postableComments: comments, body } = prepared;
  const postableComments = comments.map((comment) => ({
    path: comment.path,
    line: comment.line,
    side: "RIGHT" as const,
    body: buildInlineCommentBody({ comment, secrets: [context.token] }),
  }));
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
      const parseFailed = provider.review.parseFailed === true;
      return {
        exitCode: parseFailed ? 1 : 0,
        posted: true,
        reviewId,
        message: parseFailed ? "updated existing GitHub review (parse failed)" : "updated existing GitHub review",
        parseFailed,
        parseWarnings: provider.parseWarnings,
      };
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
    : mapReviewVerdictToGithubEvent(prepared.effectiveVerdict);
  const reviewId = await createGithubReview({
    context,
    fetchImpl,
    body,
    event,
    comments: postableComments,
  });
  const parseFailed = provider.review.parseFailed === true;
  return {
    exitCode: parseFailed ? 1 : 0,
    posted: true,
    reviewId,
    message: existing !== null
      ? (parseFailed ? "replaced existing GitHub review (parse failed)" : "replaced existing GitHub review")
      : (parseFailed ? "posted GitHub review (parse failed)" : "posted GitHub review"),
    // Surface the live review's actual counts so the self-review guard
    // artifact-write path can persist them — the dry-run stub's counts
    // would otherwise mask what GitHub actually saw.
    inlineThreadCount: postableComments.length,
    // Use the *effective* verdict (post-reconciliation) so the artifact
    // matches what GitHub actually saw via the `event` parameter. A
    // NEEDS_FIX review whose findings were all severity-filtered out
    // surfaces here as `COMMENT`, matching the `📊 0 inline findings`
    // body and the `COMMENT` review event.
    verdict: prepared.effectiveVerdict,
    // Signal parse-fail to the artifact-write path so writeLiveArtifact
    // can stamp `parseFailed: true` on the posted=true branch.
    parseFailed,
    // Thread parse warnings (off-diff citation hallucinations) to the
    // artifact-write path so the parse-warnings.json sibling artifact
    // surfaces them for operators / CI guards.
    parseWarnings: provider.parseWarnings,
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
  ensureHttpOk(
    response,
    "GITHUB_LIST_REVIEWS_FAILED",
    "GitHub list reviews",
    "Verify GITHUB_TOKEN has `pull_requests: read` scope (or the equivalent on GitHub Enterprise), and that the PR number is correct. See https://docs.github.com/en/rest/pulls/reviews for the API contract.",
  );
  const json = await readJsonResponse(response);
  if (!Array.isArray(json)) {
    return null;
  }
  for (const entry of json) {
    const review = parseExistingReview(entry);
    if (review !== null && commentBodyHasMarker(review.body) && review.state !== "DISMISSED") {
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
    ensureHttpOk(
      response,
      "GITHUB_UPDATE_REVIEW_FAILED",
      "GitHub update review",
      "Updates only succeed on PENDING reviews. The expected fallback is DELETE+POST (handled by the caller). If you see this on a fresh run, check that the bot token has `pull_requests: write`.",
    );
    return input.review.id;
  } catch (error) {
    if (error instanceof LiveReviewError && error.code === "GITHUB_UPDATE_REVIEW_FAILED") {
      writeBrandedAnnotation(
        "warning",
        `failed to update existing GitHub review ${input.review.id} (likely already submitted); falling back to DELETE+POST.`,
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
  writeBrandedAnnotation(
    "warning",
    `failed to delete existing review ${input.review.id} (${response.status}); posting new review anyway.`,
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
  ensureHttpOk(
    response,
    "GITHUB_CREATE_REVIEW_FAILED",
    "GitHub create review",
    "Check (1) GITHUB_TOKEN has `pull_requests: write` scope, (2) the commit SHA matches the head of the PR, and (3) every comment path+line exists in the diff. The most common cause is a stale SHA; rerun on a fresh `pull_request` event.",
  );
  return readResponseId(await readJsonResponse(response));
}

function parseExistingReview(value: unknown): ExistingGithubReview | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = value["id"];
  const body = value["body"];
  const state = value["state"];
  if (
    isSafeInteger(id) &&
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
  return `${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/pulls/${context.prNumber}/reviews`;
}
