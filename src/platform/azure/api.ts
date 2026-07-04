import type { AzureContext } from "./context.js";
import { buildUnifiedFileDiff } from "./diff.js";
import type { AzureChange, AzureFileSnapshot, AzureItemVersion } from "./diff.js";
import { AzureApiError, AZURE_EMPTY_DIFF_STATUS } from "./errors.js";
import { parseItemContent, parseIterationChanges, parseLatestIterationId, parseSourceCommitId } from "./payload.js";
import { authHeaders } from "../../util/http.js";
import type { FetchImpl } from "../../util/http.js";
import { commentBodyHasMarker } from "../../util/marker.js";
import {
  AZURE_API_VERSION,
  AZURE_DEVOPS_BASE_URL,
  azurePrBaseUrl,
} from "./urls.js";

export { AzureApiError } from "./errors.js";

const AZURE_FETCH_TIMEOUT_MS = 30_000;
const ZERO_OBJECT_ID_PATTERN = /^0+$/u;

type AzureJsonClient = {
  readonly context: AzureContext;
  readonly fetchImpl: FetchImpl;
};

type AzureSnapshotRequest = {
  readonly version: AzureItemVersion;
  readonly objectId: string | null;
};

export async function fetchAzurePrDiff(context: AzureContext, fetchImpl: FetchImpl = fetch): Promise<string> {
  const client: AzureJsonClient = { context, fetchImpl };
  const iterationId = parseLatestIterationId(await fetchAzureJson(buildPullRequestIterationsUrl(context), client));
  const sourceCommitId = parseSourceCommitId(await fetchAzureJson(buildPullRequestIterationUrl(context, iterationId), client));
  const changes = parseIterationChanges(await fetchAzureJson(buildPullRequestIterationChangesUrl(context, iterationId), client));
  const diffText = await reconstructUnifiedDiff(client, sourceCommitId, changes);

  if (diffText.length === 0) {
    throw new AzureApiError("AZURE_DIFF_EMPTY", AZURE_EMPTY_DIFF_STATUS, "Azure DevOps PR diff response body was empty.");
  }

  return diffText;
}

async function reconstructUnifiedDiff(
  client: AzureJsonClient,
  sourceCommitId: string,
  changes: readonly AzureChange[],
): Promise<string> {
  const fileDiffs: string[] = [];

  for (const change of changes) {
    const [oldFile, newFile] = await Promise.all([
      fetchAzureItemSnapshot(client, {
        version: {
          path: change.item.path,
          baseUrl: change.item.url,
          versionType: "Branch",
          version: client.context.targetBranch,
        },
        objectId: change.originalObjectId,
      }),
      fetchAzureItemSnapshot(client, {
        version: {
          path: change.item.path,
          baseUrl: change.item.url,
          versionType: "Commit",
          version: sourceCommitId,
        },
        objectId: change.item.objectId,
      }),
    ]);
    const fileDiff = buildUnifiedFileDiff(change.item.path, oldFile, newFile);
    if (fileDiff !== null) {
      fileDiffs.push(fileDiff);
    }
  }

  return fileDiffs.join("");
}

async function fetchAzureItemSnapshot(
  client: AzureJsonClient,
  request: AzureSnapshotRequest,
): Promise<AzureFileSnapshot> {
  if (!hasObjectId(request.objectId)) {
    return { exists: false, content: "" };
  }

  const payload = await fetchAzureJson(buildItemContentUrl(client.context, request.version), client);
  return { exists: true, content: parseItemContent(payload) };
}

async function fetchAzureJson(url: string, client: AzureJsonClient): Promise<unknown> {
  const response = await client.fetchImpl(url, buildAzureRequestInit(client.context));

  if (!response.ok) {
    throw new AzureApiError(
      "AZURE_FETCH_FAILED",
      response.status,
      `Azure DevOps PR diff request failed with status ${response.status}.`,
    );
  }

  const bodyText = await response.text();
  if (bodyText.length === 0) {
    throw new AzureApiError("AZURE_FETCH_FAILED", response.status, "Azure DevOps PR diff JSON response body was empty.");
  }

  try {
    const payload: unknown = JSON.parse(bodyText);
    return payload;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new AzureApiError("AZURE_FETCH_FAILED", response.status, "Azure DevOps PR diff JSON response body was invalid.", {
        cause: error,
      });
    }
    throw error;
  }
}

function buildAzureRequestInit(context: AzureContext): RequestInit {
  // GET requests must NOT include Content-Type — the Azure REST API treats a
  // body-bearing Content-Type on a bodiless GET as malformed. Reuse the
  // shared authHeaders helper with `contentType: false` so this header set
  // matches the one every other Azure call site builds.
  const headers = authHeaders(context.token, { contentType: false });
  return { method: "GET", headers, signal: AbortSignal.timeout(AZURE_FETCH_TIMEOUT_MS) };
}

function hasObjectId(objectId: string | null): boolean {
  return objectId !== null && !ZERO_OBJECT_ID_PATTERN.test(objectId);
}

function buildPullRequestIterationsUrl(context: AzureContext): string {
  return `${buildPullRequestUrl(context)}/iterations?api-version=${AZURE_API_VERSION}`;
}

function buildPullRequestIterationUrl(context: AzureContext, iterationId: number): string {
  return `${buildPullRequestUrl(context)}/iterations/${iterationId}?api-version=${AZURE_API_VERSION}`;
}

function buildPullRequestIterationChangesUrl(context: AzureContext, iterationId: number): string {
  return `${buildPullRequestUrl(context)}/iterations/${iterationId}/changes?api-version=${AZURE_API_VERSION}`;
}

function buildPullRequestUrl(context: AzureContext): string {
  return azurePrBaseUrl(context);
}

function buildItemContentUrl(context: AzureContext, version: AzureItemVersion): string {
  const url = parseItemBaseUrl(version.baseUrl) ?? new URL(`${azureRepositoryBaseUrl(context)}/items`);
  url.searchParams.set("path", version.path);
  url.searchParams.set("versionType", version.versionType);
  url.searchParams.set("version", version.version);
  url.searchParams.set("includeContent", "true");
  url.searchParams.set("api-version", AZURE_API_VERSION);

  return url.toString();
}

function parseItemBaseUrl(value: string | null): URL | null {
  if (value === null) {
    return null;
  }

  try {
    return new URL(value);
  } catch (error) {
    if (error instanceof TypeError) {
      return null;
    }
    throw error;
  }
}

function azureRepositoryBaseUrl(context: AzureContext): string {
  const projectSegment = encodeURIComponent(context.project);
  return `${AZURE_DEVOPS_BASE_URL}/${context.org}/${projectSegment}/_apis/git/repositories/${context.repoId}`;
}

/** Active Azure thread statuses — a thread still in flight. */
const AZURE_OPEN_STATUSES: ReadonlySet<string> = new Set(["active", "pending"]);
/** Resolved Azure thread statuses — closed but kept in the diff history. */
const AZURE_RESOLVED_STATUSES: ReadonlySet<string> = new Set(["closed", "fixed", "wontFix", "byDesign"]);

/**
 * Structural Azure thread shape consumed by `findDuplicateThread`. Both the
 * live CLI (`src/cli/live-azure.ts`) and the dry-run reviewer
 * (`src/azure/run-azure-review.ts`) parse Azure's `/threads` response into
 * thread records; their concrete types are not structurally identical, so
 * the helper narrows to the subset it actually reads:
 *   - `status` (string)
 *   - `threadContext` (nullable; `filePath` + `rightFileStart.line` for inline threads)
 *   - `comments` (each comment carries a `content` string that may include the marker)
 * `threadContext === null` indicates a parent PR-level comment — those are
 * always skipped because dedup is an inline-only concern.
 */
export type AzureInlineThread = {
  readonly status: string;
  readonly threadContext: {
    readonly filePath: string;
    readonly rightFileStart: { readonly line: number };
  } | null;
  readonly comments: readonly { readonly content: string }[];
};

/**
 * Returns the first Azure thread that already carries a marker-bearing
 * comment for the same `(filePath, line)` as `comment`, when the thread
 * status is in the open or resolved set. Used by both the live and the
 * dry-run dedup paths so a previous UmActually review does not get
 * double-posted.
 *
 * The unified helper picks the stricter semantics from each call site:
 *   - status filter (open + resolved) — from the live path; ignored
 *     threads would otherwise let stale `closed`/`fixed` rows get
 *     double-posted as fresh findings.
 *   - multi-comment marker check (any comment carrying the marker counts)
 *     — from the live path; the dry-run's "first comment only" check
 *     misses threads whose marker landed in a reply.
 *   - path normalization (`/+ → /`) — from the live path; raw diff paths
 *     are unprefixed and Azure's API always returns the leading slash.
 *
 * Returns `null` when no duplicate thread exists.
 */
export function findDuplicateThread(
  comment: { readonly path: string; readonly line: number },
  threads: readonly AzureInlineThread[]
): AzureInlineThread | null {
  const azurePath = `/${comment.path}`.replace(/\/+/gu, "/");
  for (const thread of threads) {
    if (thread.threadContext === null) continue;
    if (thread.threadContext.filePath !== azurePath) continue;
    if (thread.threadContext.rightFileStart.line !== comment.line) continue;
    if (!AZURE_OPEN_STATUSES.has(thread.status) && !AZURE_RESOLVED_STATUSES.has(thread.status)) continue;
    for (const c of thread.comments) {
      if (commentBodyHasMarker(c.content)) {
        return thread;
      }
    }
  }
  return null;
}
