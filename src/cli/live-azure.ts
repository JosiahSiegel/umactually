import { type AzureContext } from "../platform/azure/context.js";
import { REVIEW_MARKER } from "../review/run-review.js";
import {
  buildInlineCommentBody,
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

  // Post the parent PR-level review summary FIRST so the conversation
  // timeline shows a single review-summary card above all inline threads.
  // This is the documented "Comment on the pull request" shape from
  // https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/create?view=azure-devops-rest-7.1
  // — same /threads endpoint, body OMITS `threadContext`, which causes
  // ADO to render it as a free-form PR-level comment rather than a
  // file-pinned inline thread. Best-effort: a parent failure never blocks
  // the inline-thread loop that follows. If an existing parent marker
  // thread is found, we PATCH it in place via the documented Update
  // endpoint so subsequent runs can refresh the body (e.g. recover from a
  // parse-fail fallback that landed on a previous run):
  //   PATCH .../pullRequests/{id}/threads/{threadId}?api-version=7.1
  // See https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/update?view=azure-devops-rest-7.1
  const parentThread = await postAzurePrComment({ context, fetchImpl, body, existingThreads });
  const parentThreadId = parentThread?.id;

  const postedIds: number[] = [];
  const failedIndices: number[] = [];
  for (let index = 0; index < comments.length; index += 1) {
    const comment = comments[index];
    if (comment === undefined) continue;
    if (hasDuplicateThread(existingThreads, comment)) {
      continue;
    }
    try {
      const threadId = await postAzureThread({
        context,
        fetchImpl,
        comment,
        body,
        parentThreadId,
      });
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
  readonly id: number | undefined;
  readonly status: string;
  readonly threadContext: {
    readonly filePath: string;
    readonly rightFileStart: {
      readonly line: number;
    };
  } | null;
  readonly comments: readonly {
    readonly id: number | undefined;
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
    if (thread.threadContext === null) return false;
    if (thread.threadContext.filePath !== azurePath) return false;
    if (thread.threadContext.rightFileStart.line !== targetLine) return false;
    if (AZURE_RESOLVED_STATUSES.has(thread.status)) return true;
    if (AZURE_OPEN_STATUSES.has(thread.status)) {
      return thread.comments.some((c) => c.content.includes(REVIEW_MARKER));
    }
    return false;
  });
}

/**
 * Locate the existing parent PR-level marker thread (one whose
 * `threadContext` is null and whose first comment carries our stable
 * marker) so we can PATCH its content in place on subsequent runs.
 *
 * Returns the thread + its first comment so the PATCH can preserve the
 * existing `id` per Microsoft Learn:
 *   https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/update?view=azure-devops-rest-7.1
 *   "comments: Comment[] - A list of the comments." + Comment.id is
 *   required to keep the comment when patching the thread.
 */
function findExistingParentPrComment(threads: readonly AzureThread[]): {
  readonly thread: AzureThread;
  readonly comment: AzureThread["comments"][number];
} | null {
  for (const thread of threads) {
    if (thread.threadContext !== null) continue;
    const firstComment = thread.comments[0];
    if (firstComment === undefined) continue;
    if (!firstComment.content.includes(REVIEW_MARKER)) continue;
    return { thread, comment: firstComment };
  }
  return null;
}

type AzureParentResult =
  | { readonly id: number; readonly updated: boolean }
  | undefined;

/**
 * Post a free-form, PR-level (issue-style) review summary as the first card
 * in the ADO PR conversation. Uses the documented "Comment on the pull
 * request" pattern from the Pull Request Threads - Create endpoint: same
 * `/threads` URL, but the body OMITS `threadContext`. ADO renders that
 * shape as a top-level conversation card rather than a file-pinned inline
 * thread, which gives us GitHub-like "review summary above inline
 * findings" parity at the PR-conversation level.
 *
 * Update-in-place behavior: when an existing parent marker thread is
 * found, this PATCHes the thread in place via the documented Update
 * endpoint (so subsequent runs can refresh the body — e.g. recover from a
 * parse-fail fallback that landed on a previous run) instead of leaving a
 * stale summary. The PATCH body carries the existing comment's `id` to
 * keep the comment, with new `content`.
 *
 * The parent POST/PATCH is best-effort: failures are logged and the
 * inline-thread loop proceeds regardless. The pipeline gate still depends
 * on the status POST, which only fires after at least one inline thread
 * lands.
 */
async function postAzurePrComment(input: {
  readonly context: AzureContext;
  readonly fetchImpl: FetchImpl;
  readonly body: string;
  readonly existingThreads: readonly AzureThread[];
}): Promise<AzureParentResult> {
  const existing = findExistingParentPrComment(input.existingThreads);
  if (existing !== null) {
    if (existing.thread.id === undefined || existing.comment.id === undefined) {
      // Thread or comment missing ids → fall back to POST. Should never
      // happen for real ADO responses (both ids are required fields), but
      // keep the flow total.
      return postParentThread(input.context, input.fetchImpl, input.body);
    }
    return patchParentThread({
      context: input.context,
      fetchImpl: input.fetchImpl,
      body: input.body,
      threadId: existing.thread.id,
      commentId: existing.comment.id,
    });
  }
  return postParentThread(input.context, input.fetchImpl, input.body);
}

async function postParentThread(
  context: AzureContext,
  fetchImpl: FetchImpl,
  body: string,
): Promise<AzureParentResult> {
  try {
    const response = await fetchImpl(azureThreadsUrl(context), {
      method: "POST",
      headers: azureHeaders(context.token),
      body: JSON.stringify({
        comments: [
          {
            parentCommentId: 0,
            content: body,
            commentType: 1,
          },
        ],
        status: 1,
        // No `threadContext` field — ADO renders this as a PR-level comment.
      }),
    });
    ensureHttpOk(response, "AZURE_CREATE_PR_COMMENT_FAILED", "Azure create PR comment");
    const created = readResponseId(await readJsonResponse(response));
    return created === undefined ? undefined : { id: created, updated: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `::warning::umactually-pr-review: Azure parent PR comment POST failed (${message}); continuing with inline threads only.\n`,
    );
    return undefined;
  }
}

/**
 * Update an existing parent PR-level thread in place via the documented
 * Pull Request Threads - Update endpoint. The body MUST include the
 * existing comment's `id` so ADO keeps that comment (and not create a new
 * one), with the new `content` for that comment.
 *
 * Best-effort: a PATCH failure is logged and treated as if no parent
 * summary exists for downstream correlation — inline threads proceed
 * without a parent reference. This matches the original POST's
 * best-effort behavior.
 */
async function patchParentThread(input: {
  readonly context: AzureContext;
  readonly fetchImpl: FetchImpl;
  readonly body: string;
  readonly threadId: number;
  readonly commentId: number;
}): Promise<AzureParentResult> {
  try {
    const url = `${azurePrBaseUrl(input.context)}/threads/${input.threadId}?api-version=7.1`;
    const response = await input.fetchImpl(url, {
      method: "PATCH",
      headers: azureHeaders(input.context.token),
      body: JSON.stringify({
        // Per Microsoft Learn, the request body is the thread object
        // shape with `comments: Comment[]`. Each Comment in the array
        // MUST carry its existing `id` to be preserved.
        // https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/update?view=azure-devops-rest-7.1
        comments: [
          {
            id: input.commentId,
            parentCommentId: 0,
            content: input.body,
            commentType: 1,
          },
        ],
        status: 1,
      }),
    });
    ensureHttpOk(response, "AZURE_UPDATE_PR_COMMENT_FAILED", "Azure update PR comment");
    return { id: input.threadId, updated: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `::warning::umactually-pr-review: Azure parent PR comment PATCH failed (${message}); continuing with inline threads only.\n`,
    );
    return undefined;
  }
}

async function postAzureThread(input: {
  readonly context: AzureContext;
  readonly fetchImpl: FetchImpl;
  readonly comment: LiveReviewComment;
  readonly body: string;
  readonly parentThreadId: number | undefined;
}): Promise<number | undefined> {
  const response = await input.fetchImpl(azureThreadsUrl(input.context), {
    method: "POST",
    headers: azureHeaders(input.context.token),
    body: JSON.stringify({
      comments: [
        {
          parentCommentId: 0,
          content: buildInlineCommentBody({
            comment: input.comment,
            secrets: [input.context.token],
            includeMarker: true,
            ...(input.parentThreadId !== undefined ? { parentThreadId: input.parentThreadId } : {}),
          }),
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
      description: input.description.slice(0, 255),
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
  const hasThreadContextKey = "threadContext" in value;
  const nestedContext = value["threadContext"];
  // A parent PR-level comment is one where `threadContext` is explicitly
  // null in the ADO response. Flat-key test fixtures omit the
  // `threadContext` key entirely, so distinguish between the two:
  //   - key present and value null   → parent PR-level comment
  //   - key present and value object → inline thread
  //   - key absent (flat fixture)     → inline thread with filePath + line at top level
  let threadContext: AzureThread["threadContext"] = null;
  if (hasThreadContextKey) {
    if (isRecord(nestedContext)) {
      const parsed = readThreadContext(nestedContext);
      if (parsed !== null) {
        threadContext = parsed;
      }
    }
  } else {
    const flat = readThreadContext(value);
    if (flat !== null) {
      threadContext = flat;
    }
  }
  const rawId = value["id"];
  const threadId = typeof rawId === "number" && Number.isSafeInteger(rawId) ? rawId : undefined;
  return {
    id: threadId,
    status,
    threadContext,
    comments: comments
      .map(parseAzureComment)
      .filter((comment): comment is { readonly id: number | undefined; readonly content: string } => comment !== null),
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

function readRightFileStart(context: Record<string, unknown>): { readonly line: number } | null {
  const start = context["rightFileStart"];
  if (!isRecord(start)) {
    return null;
  }
  const line = start["line"];
  return typeof line === "number" && Number.isSafeInteger(line) ? { line } : null;
}

function parseAzureComment(value: unknown): { readonly id: number | undefined; readonly content: string } | null {
  if (!isRecord(value)) {
    return null;
  }
  const content = value["content"];
  if (typeof content !== "string") {
    return null;
  }
  const rawId = value["id"];
  const id = typeof rawId === "number" && Number.isSafeInteger(rawId) ? rawId : undefined;
  return { id, content };
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