import type { AzureContext } from "./context.js";

/** Canonical Azure DevOps REST API version. Bump in one place to update every endpoint. */
export const AZURE_API_VERSION = "7.1";

/** Base URL of the public Azure DevOps host. */
export const AZURE_DEVOPS_BASE_URL = "https://dev.azure.com";

/**
 * Builds the canonical pull-request URL prefix used by both the live and
 * dry-run paths. Use this instead of hand-constructing the host/project/
 * repository/pull-request string in multiple files.
 */
export function azurePrBaseUrl(context: AzureContext): string {
  const projectSegment = encodeURIComponent(context.project);
  return `${AZURE_DEVOPS_BASE_URL}/${context.org}/${projectSegment}/_apis/git/repositories/${context.repoId}/pullRequests/${context.prNumber}`;
}

/** Same as azurePrBaseUrl but suffixed with the API-version query string. */
export function azurePrBaseUrlWithVersion(context: AzureContext): string {
  return `${azurePrBaseUrl(context)}?api-version=${AZURE_API_VERSION}`;
}
