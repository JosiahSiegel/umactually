/**
 * Shared platform error base classes.
 *
 * Previously `AzureApiError`, `GithubApiError`, `AzureContextError`, and
 * `GithubContextError` each extended `Error` directly with hand-written
 * `code`/`status` fields. They now extend the generic bases here so the
 * shape is shared and any future platform (e.g. Bitbucket) gets a uniform
 * ancestor for `catch` clauses that don't care which platform threw.
 *
 * Each subclass keeps its own `override readonly name = "..."` literal so
 * `error.name` continues to print the platform-specific name in stack
 * traces (the base class leaves `name` open for that reason).
 */

/** Shared platform context error base; eliminates parallel Azure and GitHub context error class shapes. */
export class PlatformContextError<TCode extends string> extends Error {
  constructor(readonly code: TCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PlatformContextError";
  }
}

/** Shared platform API error base; eliminates parallel Azure and GitHub status-bearing error class shapes. */
export class PlatformApiError<TCode extends string> extends Error {
  constructor(
    readonly code: TCode,
    readonly status: number,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PlatformApiError";
  }
}
