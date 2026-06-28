import { fetchAzurePrDiff } from "../platform/azure/api.js";
import { type AzureContext } from "../platform/azure/context.js";
import { REVIEW_MARKER } from "../review/run-review.js";
import {
  buildReviewBody,
  countSuppressedComments,
  ensureHttpOk,
  isRecord,
  mapReviewVerdictToAzureStatus,
  readJsonResponse,
  readResponseId,
  requestLiveReview,
  selectPostableComments,
  type FetchImpl,
  type LiveReviewComment,
  type LiveRunResult,
  type LiveRuntimeConfig,
} from "./live-shared.js";

export async function runAzureLive(config: LiveRuntimeConfig & { readonly context: AzureContext }): Promise<LiveRunResult> {
  const diffText = await fetchAzurePrDiff(config.context, config.fetchImpl);
  const provider = await requestLiveReview({
    parsed: config.parsed,
    cwd: config.cwd,
    env: config.env,
    fetchImpl: config.fetchImpl,
    platform: "azure",
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
  const existingThreads = await listAzureThreads(config.context, config.fetchImpl);
  const postedIds: number[] = [];
  for (const comment of comments) {
    if (hasDuplicateThread(existingThreads, comment)) {
      continue;
    }
    const threadId = await postAzureThread({ context: config.context, fetchImpl: config.fetchImpl, comment, body });
    if (threadId !== undefined) {
      postedIds.push(threadId);
    }
  }
  await postAzureStatus({
    context: config.context,
    fetchImpl: config.fetchImpl,
    state: mapReviewVerdictToAzureStatus(provider.review.verdict),
    description: provider.review.summary,
  });
  const firstPostedId = postedIds[0];
  return {
    exitCode: 0,
    posted: true,
    reviewId: firstPostedId,
    message: `posted Azure review (${postedIds.length} threads)`,
  };
}

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

async function listAzureThreads(context: AzureContext, fetchImpl: FetchImpl): Promise<readonly AzureThread[]> {
  const response = await fetchImpl(azureThreadsUrl(context), {
    method: "GET",
    headers: azureHeaders(context.token),
  });
  ensureHttpOk(response, "AZURE_LIST_THREADS_FAILED", "Azure list PR threads");
  const json = await readJsonResponse(response);
  if (!isRecord(json)) {
    return [];
  }
  const value = json["value"];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(parseAzureThread).filter((thread): thread is AzureThread => thread !== null);
}

function hasDuplicateThread(threads: readonly AzureThread[], comment: LiveReviewComment): boolean {
  const azurePath = `/${comment.path}`;
  for (const thread of threads) {
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

async function postAzureThread(input: {
  readonly context: AzureContext;
  readonly fetchImpl: FetchImpl;
  readonly comment: LiveReviewComment;
  readonly body: string;
}): Promise<number | undefined> {
  const response = await input.fetchImpl(azureThreadsUrl(input.context), {
    method: "POST",
    headers: azureHeaders(input.context.token),
    body: JSON.stringify({
      comments: [
        {
          parentCommentId: 0,
          content: `${input.body}\n\n${input.comment.body}`,
          commentType: 1,
        },
      ],
      status: 1,
      threadContext: {
        filePath: `/${input.comment.path}`,
        rightFileStart: { line: input.comment.line, offset: 1 },
        rightFileEnd: { line: input.comment.line, offset: 1 },
      },
    }),
  });
  ensureHttpOk(response, "AZURE_CREATE_THREAD_FAILED", "Azure create PR thread");
  return readResponseId(await readJsonResponse(response));
}

async function postAzureStatus(input: {
  readonly context: AzureContext;
  readonly fetchImpl: FetchImpl;
  readonly state: "succeeded" | "failed" | "pending";
  readonly description: string;
}): Promise<void> {
  const response = await input.fetchImpl(azureStatusesUrl(input.context), {
    method: "POST",
    headers: azureHeaders(input.context.token),
    body: JSON.stringify({
      state: input.state,
      description: input.description,
      context: { name: "UmActually", genre: "pr-review" },
    }),
  });
  ensureHttpOk(response, "AZURE_CREATE_STATUS_FAILED", "Azure create PR status");
}

function parseAzureThread(value: unknown): AzureThread | null {
  if (!isRecord(value)) {
    return null;
  }
  const status = value["status"];
  const context = value["threadContext"];
  const comments = value["comments"];
  if (typeof status !== "string" || !isRecord(context) || !Array.isArray(comments)) {
    return null;
  }
  const start = readRightFileStart(context);
  const filePath = context["filePath"];
  if (typeof filePath !== "string" || start === null) {
    return null;
  }
  return {
    status,
    threadContext: { filePath, rightFileStart: start },
    comments: comments.map(parseAzureComment).filter((comment): comment is { readonly content: string } => comment !== null),
  };
}

function readRightFileStart(context: Record<string, unknown>): AzureThread["threadContext"]["rightFileStart"] | null {
  const start = context["rightFileStart"];
  if (!isRecord(start)) {
    return null;
  }
  const line = start["line"];
  return typeof line === "number" && Number.isSafeInteger(line) ? { line } : null;
}

function parseAzureComment(value: unknown): { readonly content: string } | null {
  if (!isRecord(value)) {
    return null;
  }
  const content = value["content"];
  return typeof content === "string" ? { content } : null;
}

function azureThreadsUrl(context: AzureContext): string {
  return `${azurePrBaseUrl(context)}/threads?api-version=7.1`;
}

function azureStatusesUrl(context: AzureContext): string {
  return `${azurePrBaseUrl(context)}/statuses?api-version=7.1`;
}

function azurePrBaseUrl(context: AzureContext): string {
  const project = encodeURIComponent(context.project);
  return `https://dev.azure.com/${context.org}/${project}/_apis/git/repositories/${context.repoId}/pullRequests/${context.prNumber}`;
}

function azureHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": "umactually-pr-review",
  };
}
