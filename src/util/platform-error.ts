/**
 * Shared platform error base classes.
 *
 * Previously `AzureApiError`, `GithubApiError`, `AzureContextError`, and
 * `GithubContextError` each extended `Error` directly with hand-written
 * `code`/`status` fields. They now extend the generic bases here so the
 * shape is shared and any future platform (e.g. Bitbucket) gets a uniform
 * ancestor for `catch` clauses that don't care which platform threw.
 *
 * The base classes set a default `name` field, and each subclass keeps its
 * own `override readonly name = "..."` literal so `error.name` continues to
 * print the platform-specific name in stack traces.
 */

/** Shared platform context error base; subclasses override `name` with platform-specific literals. */
export class PlatformContextError<TCode extends string> extends Error {
  override readonly name: string = "PlatformContextError";

  constructor(readonly code: TCode, message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

/** Shared platform API error base; subclasses override `name` with platform-specific literals. */
export class PlatformApiError<TCode extends string> extends Error {
  override readonly name: string = "PlatformApiError";

  constructor(
    readonly code: TCode,
    readonly status: number,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
