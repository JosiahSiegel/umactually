import { runCopilotRequest } from "../provider/copilot.js";
import {
  runProviderRequest,
  type ProviderReviewPayload,
} from "../provider/openai-compatible.js";
import { runAnthropicRequest } from "../provider/anthropic-messages.js";
import {
  setActiveSeveritySink,
  type ResponseFormat,
  type SeverityWarning,
  type SeverityWarningSink,
} from "../provider/provider-parse.js";
import { scanReviewSecrets } from "../security/scan-review-secrets.js";
import { resolveAutoModel } from "./auto-model.js";
import {
  buildMalformedProviderFallback,
  LiveReviewError,
  sanitizeForPost,
  type FetchImpl,
  type LivePlatform,
  type LiveProviderOutcome,
  type LiveReview,
  type LiveReviewComment,
  type ParseFailureReason,
} from "./live-shared.js";
import type { ParsedCliArgs } from "./parse-args.js";
import { buildParseWarningsArtifact } from "./parse-warnings.js";
import { buildProviderPrompts, REVIEW_PAYLOAD_JSON_SCHEMA } from "./provider-prompts.js";
import { verifyFindingsAgainstDiff } from "./verify-findings.js";

const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
const PROVIDER_NAME = "openai-compatible";
const COPILOT_PROVIDER_NAME = "github-copilot";
const ANTHROPIC_PROVIDER_NAME = "anthropic-messages";

export async function requestLiveReview(input: {
  readonly parsed: ParsedCliArgs;
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
  readonly fetchImpl: FetchImpl;
  readonly platform: LivePlatform;
  readonly diffText: string;
  readonly platformToken: string;
  readonly sonarContext?: string;
}): Promise<LiveProviderOutcome> {
  await scanReviewSecrets({
    diffText: input.diffText,
    expectedArtifact: "artifacts/manual/s5-redaction-report.json",
  });
  const providerApiKey = readRequiredConfig(input.parsed.apiKey ?? input.env["UMACTUALLY_API_KEY"], "UMACTUALLY_API_KEY");
  const modelId = readConfiguredModel(input.parsed, input.env);
  const prompts = await buildProviderPrompts(input);

  // Install an ambient severity-warning sink for the duration of this
  // request. Any `parseReviewPayload` call inside `runCopilotRequest` /
  // `runProviderRequest` will push warnings into the captured array
  // (the sink is auto-cleared in `finally`). Node's single-threaded
  // event loop means no two concurrent `requestLiveReview` calls can
  // interleave the set/await/clear sequence, so the singleton slot is
  // safe. The provider name is captured at install time so every warning
  // recorded during this request is attributed correctly even if a
  // generic test runner does not pass `providerName` explicitly.
  const severityWarnings: SeverityWarning[] = [];
  const sinkProviderName =
    input.parsed.provider === "copilot" ? COPILOT_PROVIDER_NAME
      : input.parsed.provider === "anthropic" ? ANTHROPIC_PROVIDER_NAME
      : PROVIDER_NAME;
  const sink: SeverityWarningSink = (raw, normalized, ctx) => {
    severityWarnings.push({
      rawValue: raw,
      normalizedFallback: normalized,
      commentIndex: ctx.commentIndex,
      providerName: ctx.providerName ?? sinkProviderName,
    });
  };
  setActiveSeveritySink(sink);
  // Layer 2-C: when the CLI flag enables it, send the strict JSON-schema
  // response_format on the wire. Defaults to true so the model is
  // constrained at decode time; the in-context system prompt carries
  // the same schema as a guide for free-form models.
  //
  // Some models don't support strict JSON schema and produce prose
  // instead of JSON. Rather than maintaining a hardcoded list of
  // non-compliant models, the provider layer's self-healing retry
  // path detects the parse-fail and retries WITHOUT the schema —
  // the system prompt's "Return strict JSON only" instruction
  // handles models that follow instructions but reject the wire
  // constraint. This makes the action dynamically adapt to any
  // provider without operator intervention.
  const responseFormat: ResponseFormat | undefined = input.parsed.strictSchema === false
    ? undefined
    : { type: "json_schema", strict: true, schema: REVIEW_PAYLOAD_JSON_SCHEMA as unknown as Record<string, unknown> };

  /**
   * Success path shared by all three provider families
   * (`openai-compatible` / `copilot` / `anthropic`). Mirrors the
   * 3-step flow that previously lived inline in each branch:
   * normalize (secrets scrubbed) → parse-warnings artifact → verify
   * filter for downstream platform-posting. Behavior is BYTE-IDENTICAL
   * regardless of provider.
   */
  function handleSuccess(
    result: { readonly ok: true; readonly endpoint: string; readonly review: ProviderReviewPayload },
    providerName: string,
  ): LiveProviderOutcome {
    const preVerifyReview = normalizeProviderReview(result.review, [providerApiKey, input.platformToken]);
    const preVerifyOutcome = withParseWarnings({
      review: preVerifyReview,
      endpoint: result.endpoint,
      provider: providerName,
      modelId,
      severityWarnings: severityWarnings.slice(),
      diffText: input.diffText,
    });
    const finalReview = input.parsed.verifyFindings !== false
      ? applyVerifyFilter(preVerifyReview, input.diffText)
      : preVerifyReview;
    return { ...preVerifyOutcome, review: finalReview };
  }

  /**
   * Parse-failure path shared by all three provider families.
   * Builds the malformed-provider fallback review and attaches the
   * parse-warnings artifact so operators see what was wrong with the
   * model's response (off-diff citations, missed severity classification,
   * truncated-stream marker, etc.) before the action exits non-zero.
   */
  function handleParse(
    result: {
      readonly ok: false;
      readonly error: {
        readonly code: string;
        readonly endpoint: string;
        readonly truncated: boolean | undefined;
        readonly usage: { input_tokens?: number; output_tokens?: number; total_tokens?: number } | undefined;
      };
    },
    providerName: string,
    rawText: string,
  ): LiveProviderOutcome {
    const review = buildMalformedProviderFallback({
      provider: providerName,
      modelId,
      rawText,
      secrets: [providerApiKey, input.platformToken],
      ...parseFailureReasonFromProviderError(result.error, input.parsed.maxOutputTokens),
    });
    return withParseWarnings({
      review,
      endpoint: result.error.endpoint,
      provider: providerName,
      modelId,
      severityWarnings: severityWarnings.slice(),
      diffText: input.diffText,
    });
  }

  try {
    if (input.parsed.provider === "copilot") {
      const result = await runCopilotRequest({
        githubToken: providerApiKey,
        apiBase: input.parsed.githubApiBase ?? input.env["UMACTUALLY_GITHUB_API_BASE"] ?? "https://api.github.com",
        system: prompts.system,
        user: prompts.user,
        model: modelId,
        requestTimeoutMs: readRequestTimeoutMs(input.parsed),
        ...(input.parsed.maxOutputTokens !== null ? { maxOutputTokens: input.parsed.maxOutputTokens } : {}),
        ...(input.parsed.effort !== null ? { reasoningEffort: input.parsed.effort } : {}),
        ...(responseFormat !== undefined ? { responseFormat } : {}),
        fetchImpl: input.fetchImpl as typeof fetch,
      });
      if (result.ok) {
        return handleSuccess(result, COPILOT_PROVIDER_NAME);
      }
      if (result.error.code === "parse") {
        return handleParse(result, COPILOT_PROVIDER_NAME, result.error.rawText ?? "");
      }
      if (result.error.code === "provider_error") {
        const details = result.error.providerErrorDetails;
        throw new LiveReviewError("PROVIDER_ERROR", details?.message ?? result.error.message, { cause: result.error });
      }
      throw new LiveReviewError("PROVIDER_REQUEST_FAILED", result.error.message, { cause: result.error });
    }

    if (input.parsed.provider === "anthropic") {
      // Anthropic native provider (`/v1/messages`). The wire body uses
      // the Anthropic Messages schema (top-level `system`, user-only
      // `messages[]`, `max_tokens` instead of `max_output_tokens`,
      // `x-api-key`/`anthropic-version` headers) — which the
      // openai-compatible client does NOT speak. Routing through a
      // dedicated client avoids an OpenAI-shaped request going to
      // `/v1/messages` and getting 400'd at the wire layer.
      const providerUrl = readRequiredConfig(input.parsed.apiUrl ?? input.env["UMACTUALLY_API_URL"], "UMACTUALLY_API_URL");
      const result = await runAnthropicRequest({
        baseUrl: providerUrl,
        apiKey: providerApiKey,
        model: modelId,
        system: prompts.system,
        user: prompts.user,
        requestTimeoutMs: readRequestTimeoutMs(input.parsed),
        ...(input.parsed.maxOutputTokens !== null ? { maxOutputTokens: input.parsed.maxOutputTokens } : {}),
        fetchImpl: input.fetchImpl,
      });
      if (result.ok) {
        return handleSuccess(result, ANTHROPIC_PROVIDER_NAME);
      }
      if (result.error.code === "parse") {
        return handleParse(result, ANTHROPIC_PROVIDER_NAME, result.error.rawText ?? "");
      }
      if (result.error.code === "provider_error") {
        const details = result.error.providerErrorDetails;
        throw new LiveReviewError("PROVIDER_ERROR", details?.message ?? result.error.message, { cause: result.error });
      }
      throw new LiveReviewError("PROVIDER_REQUEST_FAILED", result.error.message, { cause: result.error });
    }

    const providerUrl = readRequiredConfig(input.parsed.apiUrl ?? input.env["UMACTUALLY_API_URL"], "UMACTUALLY_API_URL");
    const result = await runProviderRequest({
      baseUrl: providerUrl,
      apiKey: providerApiKey,
      model: modelId,
      system: prompts.system,
      user: prompts.user,
      requestTimeoutMs: readRequestTimeoutMs(input.parsed),
      ...(input.parsed.maxOutputTokens !== null ? { maxOutputTokens: input.parsed.maxOutputTokens } : {}),
      ...(input.parsed.effort !== null ? { reasoningEffort: input.parsed.effort } : {}),
      ...(responseFormat !== undefined ? { responseFormat } : {}),
      fetchImpl: input.fetchImpl,
    });

    if (result.ok) {
      return handleSuccess(result, PROVIDER_NAME);
    }

    if (result.error.code === "parse") {
      return handleParse(result, PROVIDER_NAME, result.error.rawText ?? "");
    }
    // Provider errors (router misconfig, no providers configured,
    // invalid API key, etc.) are NOT parse failures and must NOT
    // be posted as a COMMENT review. Hard-fail so CI sees the error.
    if (result.error.code === "provider_error") {
      const details = result.error.providerErrorDetails;
      throw new LiveReviewError(
        "PROVIDER_ERROR",
        details?.message ?? result.error.message,
        { cause: result.error },
      );
    }

    throw new LiveReviewError("PROVIDER_REQUEST_FAILED", result.error.message, { cause: result.error });
  } finally {
    // Always clear the sink so a subsequent, unrelated request does not
    // inherit this request's warnings array.
    setActiveSeveritySink(null);
  }
}

/**
 * Compute parse warnings for the review (off-diff citations the
 * model fabricated) and attach them to the outcome. Layer 3 of the
 * citation-grounding fix — makes the fabrication visible in the
 * parse-warnings.json artifact instead of silently suppressing it.
 */
function withParseWarnings(input: {
  readonly review: LiveReview;
  readonly endpoint: string;
  readonly provider: string;
  readonly modelId: string;
  readonly severityWarnings: readonly import("../provider/provider-parse.js").SeverityWarning[];
  readonly diffText: string;
}): LiveProviderOutcome {
  return {
    review: input.review,
    endpoint: input.endpoint,
    provider: input.provider,
    modelId: input.modelId,
    severityWarnings: input.severityWarnings,
    parseWarnings: buildParseWarningsArtifact({
      review: input.review,
      diffText: input.diffText,
    }).warnings,
  };
}

/**
 * Apply the deterministic (path, line) verify filter to the
 * review's comments[]. Returns a new LiveReview with the filtered
 * comments[]. The original is left untouched so callers (the
 * parse-warnings artifact builder) see the pre-filter payload.
 *
 * Defense-in-depth Layer 4: the post-filter in
 * `selectPostableComments` runs the same check, but doing it here
 * means the platform-posting paths only see anchorable findings.
 */
function applyVerifyFilter(review: LiveReview, diffText: string): LiveReview {
  if (diffText.length === 0) {
    return review;
  }
  // Delegate to the standalone `verifyFindingsAgainstDiff` helper
  // so the inline filter and the parse-warnings artifact agree
  // on which comments get dropped — the previous inline
  // re-implementation diverged from the helper in a way that
  // let the artifact undercount fabrication events.
  const { verified } = verifyFindingsAgainstDiff({ review, diffText });
  return { ...review, comments: verified };
}

function normalizeProviderReview(
  payload: ProviderReviewPayload,
  secrets: readonly string[],
): LiveReview {
  // Layer 4 deterministic verification is applied in the caller
  // (see `applyVerifyFilter` in `live-provider.ts`) AFTER the
  // parse-warnings artifact is built. Doing it in the caller means
  // the artifact captures every fabrication event, even ones the
  // inline filter drops. Don't re-add the filter here — see
  // the three-step flow in the Copilot/openai-compatible
  // branches.
  return {
    summary: sanitizeForPost(payload.summary, secrets),
    verdict: payload.verdict,
    comments: payload.comments.map((comment) => normalizeProviderComment(comment, secrets)),
    suppressedComments: payload.suppressed_comments.map((comment) => normalizeProviderComment(comment, secrets)),
  };
}

function normalizeProviderComment(
  comment: ProviderReviewPayload["comments"][number],
  secrets: readonly string[],
): LiveReviewComment {
  return {
    path: comment.path,
    line: comment.line,
    body: sanitizeForPost(comment.body, secrets),
    severity: sanitizeForPost(comment.severity, secrets),
    category: sanitizeForPost(comment.category, secrets),
  };
}

function readRequiredConfig(value: string | undefined | null, name: string): string {
  if (value === undefined || value === null || value.length === 0) {
    throw new LiveReviewError("LIVE_CONFIG_MISSING", `${name} must be set for live review.`);
  }
  return value;
}

function readConfiguredModel(parsed: ParsedCliArgs, env: NodeJS.ProcessEnv): string {
  const fromArgs = parsed.model;
  // Treat the literal string "auto" the same as the default
  // (unset): the user is asking for the opinionated resolver,
  // not for the provider's "auto" pass-through. Without this,
  // `--model auto` would short-circuit before the resolver
  // runs and send the literal string "auto" to the provider.
  if (fromArgs !== null && fromArgs.length > 0 && fromArgs !== "auto") {
    return fromArgs;
  }
  const fromEnv = env["UMACTUALLY_MODEL"];
  if (fromEnv !== undefined && fromEnv.length > 0 && fromEnv !== "auto") {
    return fromEnv;
  }
  // Layer 5: `auto` is no longer passed verbatim. The resolver picks
  // a less-hallucinating model based on the active provider + API
  // URL. See `src/cli/auto-model.ts` for the per-provider mapping
  // and the Vectara HHEM rationale.
  const provider = (parsed.provider ?? "openai-compatible") as "openai-compatible" | "copilot" | "anthropic";
  return resolveAutoModel({
    provider,
    apiUrl: parsed.apiUrl,
    env,
  });
}

function readRequestTimeoutMs(parsed: ParsedCliArgs): number {
  const seconds = parsed.perRequestTimeoutSeconds ?? parsed.reviewTimeoutSeconds;
  return seconds === null || seconds <= 0 ? DEFAULT_REQUEST_TIMEOUT_MS : seconds * 1_000;
}

/**
 * Translate a ProviderError's parse-failure fields into the reason
 * shape that `buildMalformedProviderFallback` consumes. Returns an
 * empty spread when the error has no truncation signal (the caller
 * then omits the `reason` field and the fallback renders the generic
 * "Provider response did not contain a valid JSON review payload"
 * headline).
 */
function parseFailureReasonFromProviderError(
  error: { readonly truncated: boolean | undefined; readonly usage: { readonly output_tokens?: number; readonly total_tokens?: number } | undefined },
  maxOutputTokens: number | null,
): { reason?: ParseFailureReason } {
  if (error.truncated !== true) {
    return {};
  }
  return {
    reason: {
      kind: "truncated",
      ...(error.usage !== undefined ? { usage: error.usage } : {}),
      ...(maxOutputTokens !== null ? { maxOutputTokens } : {}),
    },
  };
}
