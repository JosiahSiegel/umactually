export class InvalidConfigError extends Error {
  override readonly name = "InvalidConfigError";

  constructor(
    readonly field: string,
    readonly reason: string,
    options?: ErrorOptions,
  ) {
    super(`Invalid config for '${field}': ${reason}`, options);
  }
}

export class PromptFileError extends Error {
  override readonly name = "PromptFileError";

  constructor(
    readonly path: string,
    readonly reason:
      | "outside-cwd"
      | "not-found"
      | "not-a-file"
      | "byte-cap-exceeded"
      | "read-failed",
    options?: ErrorOptions,
  ) {
    super(`Prompt file error: ${reason}`, options);
  }
}

/**
 * Marker used in error messages to replace any user-supplied value
 * (URLs, tokens, prompt content). Never echo the raw value.
 */
export const REDACTED = "[REDACTED]";