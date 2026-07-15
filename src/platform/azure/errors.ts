import { PlatformApiError } from "../../util/platform-error.js";

/**
 * API-layer error for the Azure DevOps platform adapter. Inherits the
 * `PlatformApiError` shape from `src/util/platform-error.ts` so it
 * shares a common ancestor with `GithubApiError` and is catchable as
 * `PlatformApiError<...>` when callers don't care about the platform.
 *
 * Inheriting from `PlatformApiError` instead of `Error` directly keeps
 * the existing `code` + `status` public fields unchanged so all
 * `throw new AzureApiError(...)` call sites continue to compile.
 */
export class AzureApiError extends PlatformApiError<"AZURE_FETCH_FAILED" | "AZURE_DIFF_EMPTY"> {
  override readonly name = "AzureApiError";

  constructor(
    code: "AZURE_FETCH_FAILED" | "AZURE_DIFF_EMPTY",
    status: number,
    message: string,
    options?: ErrorOptions,
  ) {
    super(code, status, message, options);
  }
}

export const AZURE_EMPTY_DIFF_STATUS = 200;
