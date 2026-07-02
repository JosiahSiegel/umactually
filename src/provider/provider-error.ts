type ProviderDiagnosticCode =
  | "responses_4xx"
  | "chat_4xx"
  | "network"
  | "timeout"
  | "parse"
  | "aborted";

type ProviderEndpoint = "responses" | "chat";

export type { ProviderDiagnosticCode, ProviderEndpoint };

export class ProviderError extends Error {
  override readonly name = "ProviderError";

  /**
   * Raw provider response body for diagnostic errors (currently only
   * `code === "parse"` carries it). Surfaced to the PR-level summary card
   * so reviewers can see exactly what the model returned. `undefined` for
   * non-parse errors so the constructor signature stays compatible.
   */
  readonly rawText: string | undefined;

  constructor(
    readonly code: ProviderDiagnosticCode,
    readonly endpoint: ProviderEndpoint,
    readonly status: number | null,
    readonly requestId: string,
    message: string,
    options?: ErrorOptions & { readonly rawText?: string },
  ) {
    super(message, options);
    this.rawText = options?.rawText;
  }
}

export function sanitizeHttpStatus(endpoint: ProviderEndpoint, status: number): string {
  return `Provider ${endpoint} responded with HTTP ${status}.`;
}

export function sanitizeMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const safe = error.message.replace(/\s+/g, " ").trim();
    if (safe.length === 0) {
      return fallback;
    }
    if (safe.length > 160) {
      return `${safe.slice(0, 157)}...`;
    }
    return safe;
  }
  return fallback;
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof Error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      return true;
    }
  }
  const code = readErrorCode(error);
  return code === "ABORT_ERR" || code === "23";
}

function readErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}