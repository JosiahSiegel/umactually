export type AzureContext = {
  readonly token: string;
  readonly org: string;
  readonly project: string;
  readonly repoId: string;
  readonly prNumber: number;
  readonly sourceCommit: string;
  readonly targetBranch: string;
};

export class AzureContextError extends Error {
  override readonly name = "AzureContextError";
  readonly code:
    | "AZURE_TOKEN_MISSING"
    | "AZURE_COLLECTION_URI_INVALID"
    | "AZURE_TEAM_PROJECT_MISSING"
    | "AZURE_REPOSITORY_ID_MISSING"
    | "AZURE_PR_NUMBER_INVALID"
    | "AZURE_SOURCE_COMMIT_MISSING"
    | "AZURE_TARGET_BRANCH_MISSING";

  constructor(code: AzureContextError["code"], message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
  }
}

const SYSTEM_ACCESSTOKEN_ALIAS = "SYSTEM_ACCESSTOKEN";
const AZURE_DEVOPS_HOST = "dev.azure.com";

export function readAzureContext(env: NodeJS.ProcessEnv): AzureContext {
  const token = readAzureToken(env);
  const org = readAzureOrg(env);
  const project = readAzureProject(env);
  const repoId = readAzureRepoId(env);
  const prNumber = readAzurePrNumber(env);
  const sourceCommit = readAzureSha(env);
  const targetBranch = readAzureTargetBranch(env);

  return {
    token,
    org,
    project,
    repoId,
    prNumber,
    sourceCommit,
    targetBranch,
  };
}

function readAzureToken(env: NodeJS.ProcessEnv): string {
  const token = env[SYSTEM_ACCESSTOKEN_ALIAS];
  if (token === undefined || token.length === 0) {
    throw new AzureContextError("AZURE_TOKEN_MISSING", "Azure Pipelines SYSTEM_ACCESSTOKEN must be set.");
  }
  return token;
}

function readAzureOrg(env: NodeJS.ProcessEnv): string {
  const collectionUri = env["SYSTEM_COLLECTIONURI"];
  if (collectionUri === undefined || collectionUri.length === 0) {
    throw new AzureContextError("AZURE_COLLECTION_URI_INVALID", "Azure Pipelines SYSTEM_COLLECTIONURI must be set.");
  }
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(collectionUri);
  } catch {
    throw new AzureContextError("AZURE_COLLECTION_URI_INVALID", "Azure Pipelines SYSTEM_COLLECTIONURI must be a valid URL.");
  }
  if (parsedUrl.hostname !== AZURE_DEVOPS_HOST) {
    throw new AzureContextError(
      "AZURE_COLLECTION_URI_INVALID",
      `Azure Pipelines SYSTEM_COLLECTIONURI must target '${AZURE_DEVOPS_HOST}'.`,
    );
  }
  const segments = parsedUrl.pathname.split("/").filter((segment) => segment.length > 0);
  const orgSegment = segments[0];
  if (orgSegment === undefined || orgSegment.length === 0) {
    throw new AzureContextError("AZURE_COLLECTION_URI_INVALID", "Azure Pipelines SYSTEM_COLLECTIONURI must include the organization segment.");
  }
  return orgSegment;
}

function readAzureProject(env: NodeJS.ProcessEnv): string {
  const project = env["SYSTEM_TEAMPROJECT"];
  if (project === undefined || project.length === 0) {
    throw new AzureContextError("AZURE_TEAM_PROJECT_MISSING", "Azure Pipelines SYSTEM_TEAMPROJECT must be set.");
  }
  return project;
}

function readAzureRepoId(env: NodeJS.ProcessEnv): string {
  const repoId = env["BUILD_REPOSITORY_ID"];
  if (repoId === undefined || repoId.length === 0) {
    throw new AzureContextError("AZURE_REPOSITORY_ID_MISSING", "Azure Pipelines BUILD_REPOSITORY_ID must be set.");
  }
  return repoId;
}

function readAzurePrNumber(env: NodeJS.ProcessEnv): number {
  const raw = env["SYSTEM_PULLREQUEST_PULLREQUESTID"];
  if (raw === undefined || raw.length === 0) {
    throw new AzureContextError("AZURE_PR_NUMBER_INVALID", "Azure Pipelines SYSTEM_PULLREQUEST_PULLREQUESTID must be set.");
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new AzureContextError("AZURE_PR_NUMBER_INVALID", "Azure Pipelines SYSTEM_PULLREQUEST_PULLREQUESTID must be a positive integer.");
  }
  return parsed;
}

function readAzureSha(env: NodeJS.ProcessEnv): string {
  const value = env["SYSTEM_PULLREQUEST_SOURCECOMMITID"];
  if (value === undefined || value.length === 0) {
    throw new AzureContextError("AZURE_SOURCE_COMMIT_MISSING", "Azure Pipelines SYSTEM_PULLREQUEST_SOURCECOMMITID must be set.");
  }
  return value;
}

function readAzureTargetBranch(env: NodeJS.ProcessEnv): string {
  const value = env["SYSTEM_PULLREQUEST_TARGETBRANCHNAME"];
  if (value === undefined || value.length === 0) {
    throw new AzureContextError("AZURE_TARGET_BRANCH_MISSING", "Azure Pipelines SYSTEM_PULLREQUEST_TARGETBRANCHNAME must be set.");
  }
  return value;
}