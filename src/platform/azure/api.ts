import type { AzureContext } from "./context.js";
import { buildUnifiedFileDiff } from "./diff.js";
import type { AzureChange, AzureFileSnapshot, AzureItemVersion } from "./diff.js";
import { AzureApiError, AZURE_EMPTY_DIFF_STATUS } from "./errors.js";
import { parseItemContent, parseIterationChanges, parseLatestIterationId, parseSourceCommitId } from "./payload.js";

export { AzureApiError } from "./errors.js";

export type FetchImpl = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const AZURE_DEVOPS_BASE_URL = "https://dev.azure.com";
const AZURE_API_VERSION = "7.1";
const AZURE_FETCH_TIMEOUT_MS = 30_000;
const JSON_MEDIA_TYPE = "application/json";
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
  const headers = {
    Authorization: `Bearer ${context.token}`,
    Accept: JSON_MEDIA_TYPE,
    "User-Agent": "umactually-pr-review",
  };
  const signal = createAbortSignal();

  if (signal === null) {
    return { method: "GET", headers };
  }

  return { method: "GET", headers, signal };
}

function createAbortSignal(): AbortSignal | null {
  if (typeof AbortSignal === "undefined" || typeof AbortSignal.timeout !== "function") {
    return null;
  }

  return AbortSignal.timeout(AZURE_FETCH_TIMEOUT_MS);
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
  return `${buildRepositoryUrl(context)}/pullRequests/${context.prNumber}`;
}

function buildItemContentUrl(context: AzureContext, version: AzureItemVersion): string {
  const url = parseItemBaseUrl(version.baseUrl) ?? new URL(`${buildRepositoryUrl(context)}/items`);
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

function buildRepositoryUrl(context: AzureContext): string {
  const projectSegment = encodeURIComponent(context.project);
  return `${AZURE_DEVOPS_BASE_URL}/${context.org}/${projectSegment}/_apis/git/repositories/${context.repoId}`;
}
