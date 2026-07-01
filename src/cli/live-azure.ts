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
  selectPostableComments,
  type FetchImpl,
  type LiveProviderOutcome,
  type LiveReviewComment,
  type LiveRunResult,
} from "./live-shared.js";

export async function runAzureLive(input: {
  readonly context: AzureContext;
  readonly diffText: string;
  readonly provider: LiveProviderOutcome;
  readonly parsed: Parameters<typeof selectPostableComments>[0]["parsed"];
  readonly fetchImpl: FetchImpl;
}): Promise<LiveRunResult> {
  const { context, diffText, provider, parsed, fetchImpl } = input;

  const comments = selectPostableComments({
    review: provider.review,
    diffText,
    parsed,
    secrets: [context.token],
  });
  const body = buildReviewBody({
    review: provider.review,
    provider: provider.provider,
    modelId: provider.modelId,
    validCommentCount: comments.length,
    suppressedCommentCount: countSuppressedComments(provider.review, diffText),
    secrets: [context.token],
  });
  const existingThreads = await listAzureThreads(context, fetchImpl);
  const postedIds: number[] = [];
  const failedIndices: number[] = [];
  for (let index = 0; index < comments.length; index += 1) {
    const comment = comments[index];
    if (comment === undefined) continue;
    if (hasDuplicateThread(existingThreads, comment)) {
      continue;
    }
    try {
      const threadId = await postAzureThread({ context, fetchImpl, comment, body });
      if (threadId !== undefined) {
        postedIds.push(threadId);
      }
    } catch (error) {
      failedIndices.push(index);
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(
        `::warning::umactually-pr-review: Azure thread ${index + 1}/${comments.length} failed (${comment.path}:${comment.line}): ${message}; continuing with remaining threads.\n`,
      );
    }
  }

  if (postedIds.length === 0 && failedIndices.length > 0) {
    const failed = failedIndices.length;
    const message = `Azure review failed: 0 threads posted, ${failed} failed`;
    process.stderr.write(
      `::error::umactually-pr-review: ${message}\n`,
    );
    return {
      exitCode: 1,
      posted: false,
      reviewId: undefined,
      message,
    };
  }

  // At least one thread landed — post the PR status.
  await postAzureStatus({
    context,
    fetchImpl,
    state: mapReviewVerdictToAzureStatus(provider.review.verdict),
    description: provider.review.summary,
  });

  const firstPostedId = postedIds[0];
  const successMessage = failedIndices.length > 0
    ? `posted Azure review (${postedIds.length} threads, ${failedIndices.length} failed)`
    : `posted Azure review (${postedIds.length} threads)`;
  return {
    exitCode: 0,
    posted: true,
    reviewId: firstPostedId,
    message: successMessage,
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

const AZURE_OPEN_STATUSES: ReadonlySet<string> = new Set(["active", "pending"]);
const AZURE_RESOLVED_STATUSES: ReadonlySet<string> = new Set(["closed", "fixed", "wontFix", "byDesign"]);

function hasDuplicateThread(threads: readonly AzureThread[], comment: LiveReviewComment): boolean {
  const azurePath = `/${comment.path}`.replace(/\/+/gu, "/");
  const targetLine = comment.line;
  return threads.some((thread) => {
    if (thread.threadContext.filePath !== azurePath) return false;
    if (thread.threadContext.rightFileStart.line !== targetLine) return false;
    if (AZURE_RESOLVED_STATUSES.has(thread.status)) return true;
    if (AZURE_OPEN_STATUSES.has(thread.status)) {
      return thread.comments.some((c) => c.content.includes(REVIEW_MARKER));
    }
    return false;
  });
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
  const comments = value["comments"];
  if (typeof status !== "string" || !Array.isArray(comments)) {
    return null;
  }
  const nestedContext = value["threadContext"];
  const threadContext = isRecord(nestedContext)
    ? readThreadContext(nestedContext)
    : readThreadContext(value);
  if (threadContext === null) {
    return null;
  }
  return {
    status,
    threadContext,
    comments: comments.map(parseAzureComment).filter((comment): comment is { readonly content: string } => comment !== null),
  };
}

function readThreadContext(record: Record<string, unknown>): AzureThread["threadContext"] | null {
  const start = readRightFileStart(record);
  const filePath = record["filePath"];
  if (typeof filePath !== "string" || start === null) {
    return null;
  }
  return { filePath, rightFileStart: start };
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
