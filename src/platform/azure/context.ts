import { parseStrictInt } from "../../util/cli-args.js";
import { ENV_KEYS } from "../../util/env-keys.js";
import { PlatformContextError } from "../../util/platform-error.js";

export type AzureContext = {
  readonly token: string;
  readonly org: string;
  readonly project: string;
  readonly repoId: string;
  readonly prNumber: number;
  readonly sourceCommit: string;
  readonly targetBranch: string;
  readonly baseCommit: string | undefined;
};

/**
 * Context-resolution error for the Azure DevOps platform adapter.
 * Inherits the `PlatformContextError` shape from
 * `src/util/platform-error.ts` so it shares a common ancestor with
 * `GithubContextError`. The typed `code` literal remains Azure-specific
 * — only the base class is shared.
 */
export class AzureContextError extends PlatformContextError<
  | "AZURE_TOKEN_MISSING"
  | "AZURE_COLLECTION_URI_INVALID"
  | "AZURE_TEAM_PROJECT_MISSING"
  | "AZURE_REPOSITORY_ID_MISSING"
  | "AZURE_PR_NUMBER_INVALID"
  | "AZURE_SOURCE_COMMIT_MISSING"
  | "AZURE_TARGET_BRANCH_MISSING"
> {
  override readonly name = "AzureContextError";
}

const SYSTEM_ACCESSTOKEN_ALIAS = "SYSTEM_ACCESSTOKEN";
const AZURE_DEVOPS_TOKEN_ALIAS = "AZURE_DEVOPS_TOKEN";
const AZURE_DEVOPS_HOST = "dev.azure.com";

export function readAzureContext(
  env: NodeJS.ProcessEnv,
  overrides?: { readonly prNumber?: number | undefined },
): AzureContext {
  const token = readAzureToken(env);
  const org = readAzureOrg(env);
  const project = readAzureProject(env);
  const repoId = readAzureRepoId(env);
  const prNumber = readAzurePrNumber(env, overrides?.prNumber);
  const sourceCommit = readAzureSha(env);
  const targetBranch = readAzureTargetBranch(env);
  const baseCommit = readAzureBaseCommit(env);

  return {
    token,
    org,
    project,
    repoId,
    prNumber,
    sourceCommit,
    targetBranch,
    baseCommit,
  };
}

function readAzureToken(env: NodeJS.ProcessEnv): string {
  // Prefer an explicit Azure DevOps PAT (set by a variable group) so PR
  // threads/statuses can be posted by an identity that already holds the
  // "Contribute to pull requests" permission. The project build service
  // identity mapped to SYSTEM_ACCESSTOKEN does not always hold that
  // permission, which causes HTTP 403 on the threads and statuses
  // endpoints. Falling back keeps the standard Azure Pipelines OAuth
  // token usable for manual/dry-run callers that do not have a PAT.
  const explicitToken = env[AZURE_DEVOPS_TOKEN_ALIAS];
  if (explicitToken !== undefined && explicitToken.length > 0) {
    return explicitToken;
  }
  const token = env[SYSTEM_ACCESSTOKEN_ALIAS];
  if (token === undefined || token.length === 0) {
    throw new AzureContextError(
      "AZURE_TOKEN_MISSING",
      "Azure Pipelines SYSTEM_ACCESSTOKEN (or explicit AZURE_DEVOPS_TOKEN) must be set.",
    );
  }
  return token;
}

function readAzureOrg(env: NodeJS.ProcessEnv): string {
  const collectionUri = env[ENV_KEYS.SYSTEM_COLLECTIONURI];
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
  const project = env[ENV_KEYS.SYSTEM_TEAMPROJECT];
  if (project === undefined || project.length === 0) {
    throw new AzureContextError("AZURE_TEAM_PROJECT_MISSING", "Azure Pipelines SYSTEM_TEAMPROJECT must be set.");
  }
  return project;
}

function readAzureRepoId(env: NodeJS.ProcessEnv): string {
  const repoId = env[ENV_KEYS.BUILD_REPOSITORY_ID];
  if (repoId === undefined || repoId.length === 0) {
    throw new AzureContextError("AZURE_REPOSITORY_ID_MISSING", "Azure Pipelines BUILD_REPOSITORY_ID must be set.");
  }
  return repoId;
}

function readAzurePrNumber(
  env: NodeJS.ProcessEnv,
  override?: number,
): number {
  // Prefer an explicit CLI flag (`--pr-number`) override so manual
  // invocations outside of an Azure Pipelines PR build work without
  // synthesising SYSTEM_PULLREQUEST_PULLREQUESTID. The flag is
  // validated at the CLI boundary (see src/cli/validate.ts), but we
  // re-validate here so direct callers of readAzureContext (tests,
  // future internal call sites) cannot smuggle a non-positive value
  // past the boundary.
  if (override !== undefined) {
    if (!Number.isInteger(override) || override <= 0) {
      throw new AzureContextError(
        "AZURE_PR_NUMBER_INVALID",
        "Azure CLI flag --pr-number must be a positive integer.",
      );
    }
    return override;
  }
  const raw = env[ENV_KEYS.SYSTEM_PULLREQUEST_PULLREQUESTID];
  if (raw === undefined || raw.length === 0) {
    throw new AzureContextError(
      "AZURE_PR_NUMBER_INVALID",
      [
        "Azure Pipelines SYSTEM_PULLREQUEST_PULLREQUESTID must be set.",
        "",
        "Recovery options:",
        "  (1) Run as a build validation policy on an Azure Repos branch —",
        "      Azure Pipelines sets SYSTEM_PULLREQUEST_PULLREQUESTID automatically.",
        "      See docs/azure-devops.md.",
        "  (2) For manual/CLI invocations, pass --pr-number <N> on the command line",
        "      (in addition to supplying BUILD_REPOSITORY_ID, SYSTEM_COLLECTIONURI,",
        "      SYSTEM_TEAMPROJECT, SYSTEM_PULLREQUEST_SOURCECOMMITID,",
        "      SYSTEM_PULLREQUEST_TARGETBRANCHNAME, and either SYSTEM_ACCESSTOKEN",
        "      or AZURE_DEVOPS_TOKEN as env vars).",
      ].join("\n"),
    );
  }
  // Strict helper: "42abc" must NOT coerce to 42 (which would land on a
  // 404 from the Azure DevOps REST API instead of a typed error).
  // parseStrictInt already returns null for non-safe-integer parses,
  // so the remaining guard is "must be a positive integer".
  const parsed = parseStrictInt(raw);
  if (parsed === null || parsed <= 0) {
    throw new AzureContextError(
      "AZURE_PR_NUMBER_INVALID",
      [
        "Azure Pipelines SYSTEM_PULLREQUEST_PULLREQUESTID must be a positive integer.",
        "",
        "Recovery options:",
        "  (1) Run as a build validation policy on an Azure Repos branch —",
        "      Azure Pipelines sets SYSTEM_PULLREQUEST_PULLREQUESTID automatically.",
        "  (2) For manual/CLI invocations, pass --pr-number <N> instead of relying",
        "      on the env var (the flag accepts positive integers only).",
      ].join("\n"),
    );
  }
  return parsed;
}

function readAzureSha(env: NodeJS.ProcessEnv): string {
  const value = env[ENV_KEYS.SYSTEM_PULLREQUEST_SOURCECOMMITID];
  if (value === undefined || value.length === 0) {
    throw new AzureContextError("AZURE_SOURCE_COMMIT_MISSING", "Azure Pipelines SYSTEM_PULLREQUEST_SOURCECOMMITID must be set.");
  }
  return value;
}

function readAzureTargetBranch(env: NodeJS.ProcessEnv): string {
  const value = env[ENV_KEYS.SYSTEM_PULLREQUEST_TARGETBRANCHNAME];
  if (value === undefined || value.length === 0) {
    throw new AzureContextError("AZURE_TARGET_BRANCH_MISSING", "Azure Pipelines SYSTEM_PULLREQUEST_TARGETBRANCHNAME must be set.");
  }
  return value;
}

function readAzureBaseCommit(env: NodeJS.ProcessEnv): string | undefined {
  // Azure Pipelines does not expose a dedicated "base commit" env var.
  // Operators who want the umbrella-instruction-files fetch to read from
  // the PR's base SHA (so a PR cannot rewrite its own reviewer
  // instructions) should set SYSTEM_PULLREQUEST_MERGECOMMITID to the
  // tip of the target branch as resolved at PR creation time. When the
  // var is missing we deliberately return `undefined` rather than
  // falling back to `sourceCommit` (the PR HEAD) — falling back would
  // re-open the attacker-injected AGENTS.md vector this whole feature
  // exists to close. The orchestrator treats `undefined` as "skip the
  // base-branch fetch and fall back to cwd lookup".
  const explicit = env["SYSTEM_PULLREQUEST_MERGECOMMITID"];
  if (typeof explicit === "string" && explicit.length > 0) {
    return explicit;
  }
  return undefined;
}
