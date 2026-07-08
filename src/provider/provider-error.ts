type ProviderDiagnosticCode =
  | "responses_4xx"
  | "chat_4xx"
  | "network"
  | "timeout"
  | "parse"
  | "provider_error"
  | "aborted";

type ProviderEndpoint = "responses" | "chat";

export type { ProviderDiagnosticCode, ProviderEndpoint };

/**
 * Structured details for a `provider_error` diagnostic code. Carries
 * the `kind` (zero-usage, error-envelope, error-doc-url) and a
 * human-readable `message` so the live-review layer can surface
 * actionable advice (check API key, configure routing, etc.) instead
 * of the generic "parse failed" banner.
 */
export type ProviderErrorDetails = {
  readonly kind: string;
  readonly message: string;
  readonly detail?: string;
};

export class ProviderError extends Error {
  override readonly name = "ProviderError";

  /**
   * Raw provider response body for diagnostic errors (currently only
   * `code === "parse"` carries it). Surfaced to the PR-level summary card
   * so reviewers can see exactly what the model returned. `undefined` for
   * non-parse errors so the constructor signature stays compatible.
   */
  readonly rawText: string | undefined;

  /**
   * True when the parse error was caused by a truncated SSE stream —
   * the provider's response ended before the model emitted a
   * `response.completed` (or equivalent) event. Distinct from a
   * completed-but-malformed response (where the stream ended cleanly
   * but the JSON itself was structurally wrong). Surfaced in the
   * parse-fail diagnostic so reviewers can tell "raise
   * --max-output-tokens and retry" apart from "model returned bad JSON".
   * `undefined` for non-parse errors.
   */
  readonly truncated: boolean | undefined;

  /**
   * Token usage reported by the provider in the `response.completed`
   * event's `usage` block. Surfaced by the headroom-warning check so
   * operators can see whether the model filled its token budget
   * (explains the truncated-stream case). `undefined` when the
   * provider didn't emit usage data or the stream was truncated
   * before the completed event.
   */
  readonly usage: ProviderUsage | undefined;

  /**
   * Structured details when `code === "provider_error"`. Carries the
   * detection signal kind (zero-usage, error-envelope, error-doc-url)
   * and a human-readable message so downstream layers can surface
   * actionable remediation advice. `undefined` for all other error
   * codes.
   */
  readonly providerErrorDetails: ProviderErrorDetails | undefined;

  constructor(
    readonly code: ProviderDiagnosticCode,
    readonly endpoint: ProviderEndpoint,
    readonly status: number | null,
    readonly requestId: string,
    message: string,
    options?: ErrorOptions & {
      readonly rawText?: string;
      readonly truncated?: boolean;
      readonly usage?: ProviderUsage;
      readonly providerErrorDetails?: ProviderErrorDetails;
    },
  ) {
    super(message, options);
    this.rawText = options?.rawText;
    this.truncated = options?.truncated;
    this.usage = options?.usage;
    this.providerErrorDetails = options?.providerErrorDetails;
  }
}

/**
 * Subset of the provider's `usage` object the headroom warning reads.
 * Most providers report these on the response.completed event; the
 * `total` and `output` fields are the ones that matter for the
 * "did the model run out of tokens" check.
 */
export type ProviderUsage = {
  readonly input_tokens?: number;
  readonly output_tokens?: number;
  readonly total_tokens?: number;
};

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