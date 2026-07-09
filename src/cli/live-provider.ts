import { runCopilotRequest } from "../provider/copilot.js";
import {
  runProviderRequest,
  type ProviderCallResult,
  type ProviderReviewPayload,
} from "../provider/openai-compatible.js";
import {
  runAnthropicRequest,
  type AnthropicProviderCallResult,
} from "../provider/anthropic-messages.js";
import {
  setActiveSeveritySink,
  type ResponseFormat,
  type SeverityWarning,
  type SeverityWarningSink,
} from "../provider/provider-parse.js";
import type { ProviderEndpoint } from "../provider/provider-error.js";
import { looksLikeAnthropicEndpoint, redactUrlForLog } from "../util/url.js";
import { scanReviewSecrets } from "../security/scan-review-secrets.js";
import { BRAND_PREFIX } from "../util/brand.js";
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

/**
 * Map a `ProviderEndpoint` (the wire-shape discriminator returned by
 * the provider client on success) to its operator-facing display name
 * used in the review outcome, the parse-warnings artifact, and the
 * surface-level attribution. When cross-protocol fallback fires, the
 * named provider fails but the OTHER protocol succeeds; this helper
 * recovers the actual-protocol name so the outcome attribute is
 * correct (e.g. "anthropic-messages" not "openai-compatible").
 */
function providerNameForEndpoint(endpoint: ProviderEndpoint): string {
  switch (endpoint) {
    case "anthropic": return ANTHROPIC_PROVIDER_NAME;
    case "responses":
    case "chat":      return PROVIDER_NAME;
  }
}

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
      // `x-api-key`/`anthropic-version` headers). The URL resolution
      // (in `resolveAnthropicMessagesUrl`) preserves the operator's
      // path prefix so Anthropic-compatible gateways like
      // `https://api.minimax.io/anthropic` route correctly.
      //
      // When the URL fails with a routing-level rejection (404/400),
      // `runWithCrossProtocolFallback` transparently retries with the
      // OpenAI-compatible client at the same base URL — operators
      // pointing MiniMax-style gateways at the action don't have to
      // know which protocol lives under which path prefix.
      //
      // Anthropic defaults to https://api.anthropic.com/v1 when
      // --api-url is unset. This matches the contracts in
      // `action.yml`, the README's "Using the native Anthropic
      // Messages API" block, and `validate.ts`/`orchestrator.ts`
      // which both exempt --api-url from the required check when
      // --provider anthropic is set.
      const providerUrl = input.parsed.apiUrl
        ?? input.env["UMACTUALLY_API_URL"]
        ?? "https://api.anthropic.com/v1";
      let result = await runAnthropicRequest({
        baseUrl: providerUrl,
        apiKey: providerApiKey,
        model: modelId,
        system: prompts.system,
        user: prompts.user,
        requestTimeoutMs: readRequestTimeoutMs(input.parsed),
        ...(input.parsed.maxOutputTokens !== null ? { maxOutputTokens: input.parsed.maxOutputTokens } : {}),
        fetchImpl: input.fetchImpl,
      });
      if (!result.ok) {
        // Cross-protocol fallback to the OpenAI client at the same URL.
        // If the fallback also fails, surface the original anthropic error
        // (the operator picked `--provider anthropic` — honor that intent).
        const fallback = await runWithCrossProtocolFallback({
          namedProvider: "anthropic",
          namedResult: result,
          fallbackProvider: "openai-compatible",
          baseUrl: providerUrl,
          providerApiKey,
          modelId,
          prompts,
          readRequestTimeoutMs: () => readRequestTimeoutMs(input.parsed),
          fetchImpl: input.fetchImpl,
          parsed: input.parsed,
          responseFormat,
        });
        if (fallback.ok) {
          result = fallback;
        }
      }
      if (result.ok) {
        const providerName = providerNameForEndpoint(result.endpoint);
        return handleSuccess(result, providerName);
      }
      if (result.error.code === "parse") {
        const providerName = providerNameForEndpoint(result.error.endpoint);
        return handleParse(result, providerName, result.error.rawText ?? "");
      }
      if (result.error.code === "provider_error") {
        const details = result.error.providerErrorDetails;
        throw new LiveReviewError("PROVIDER_ERROR", details?.message ?? result.error.message, { cause: result.error });
      }
      throw new LiveReviewError("PROVIDER_REQUEST_FAILED", result.error.message, { cause: result.error });
    }

    const providerUrl = readRequiredConfig(input.parsed.apiUrl ?? input.env["UMACTUALLY_API_URL"], "UMACTUALLY_API_URL");

    // Path-prefix heuristic: if the operator's URL looks like an
    // Anthropic-protocol gateway (any path segment equal to
    // `anthropic`, case-insensitive — MiniMax's `/anthropic`,
    // self-hosted LiteLLM `/llm/anthropic`, etc.) commit to the
    // Anthropic Messages API client regardless of which `--provider`
    // was set. Otherwise the openai-compatible client's URL
    // candidate loop downgrades the URL to origin+`/v1` and may
    // happily succeed there, silently routing an `/anthropic`-prefix
    // URL to OpenAI Responses — which breaks operator intent on
    // dual-protocol gateways.
    //
    // The explicit `--provider anthropic` branch above already handles
    // this. The only flips this heuristic triggers is
    // `--provider openai-compatible` (the default) on a URL whose
    // `/anthropic` path component signals Anthropic-protocol intent.
    //
    // Emit a ::notice:: even when --provider=anthropic so operators see
    // the dispatcher considered and committed to the right protocol —
    // invisible-to-the-eye but logged for audit.
    const useAnthropicProtocol = looksLikeAnthropicEndpoint(providerUrl);
    if (useAnthropicProtocol) {
      process.stderr.write(
        `::notice::${BRAND_PREFIX}Operator URL contains an /anthropic path segment; using the Anthropic Messages API client (regardless of --provider).\n`,
      );
    }

    let result: ProviderCallResult | AnthropicProviderCallResult;
    if (useAnthropicProtocol) {
      result = await runAnthropicRequest({
        baseUrl: providerUrl,
        apiKey: providerApiKey,
        model: modelId,
        system: prompts.system,
        user: prompts.user,
        requestTimeoutMs: readRequestTimeoutMs(input.parsed),
        ...(input.parsed.maxOutputTokens !== null ? { maxOutputTokens: input.parsed.maxOutputTokens } : {}),
        fetchImpl: input.fetchImpl,
      });
    } else {
      result = await runProviderRequest({
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
    }

    if (!result.ok) {
      // Cross-protocol fallback: if the named (openai-compatible) client
      // exhausted its URL candidates with a routing-level failure, try
      // the Anthropic client at the same URL. On dual-protocol gateways
      // (MiniMax at /anthropic/, etc.) this lets `--provider
      // openai-compatible` discover the Anthropic-protocol endpoint at
      // `/anthropic/v1/messages` without operator intervention.
      //
      // If the fallback also fails, surface the original named error
      // (the operator picked `--provider openai-compatible`).
      const fallback = await runWithCrossProtocolFallback({
        namedProvider: "openai-compatible",
        namedResult: result,
        fallbackProvider: "anthropic",
        baseUrl: providerUrl,
        providerApiKey,
        modelId,
        prompts,
        readRequestTimeoutMs: () => readRequestTimeoutMs(input.parsed),
        fetchImpl: input.fetchImpl,
        parsed: input.parsed,
        responseFormat,
      });
      if (fallback.ok) {
        result = fallback;
      }
    }

    if (result.ok) {
      const providerName = providerNameForEndpoint(result.endpoint);
      return handleSuccess(result, providerName);
    }

    if (result.error.code === "parse") {
      const providerName = providerNameForEndpoint(result.error.endpoint);
      return handleParse(result, providerName, result.error.rawText ?? "");
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

/**
 * Cross-protocol fallback wrapper for the live dispatcher.
 *
 * Some operators point `--api-url` at an Anthropic-protocol-capable
 * gateway (the documented example is `https://api.minimax.io/anthropic`
 * per https://platform.minimax.io/docs/token-plan/claude-code) but
 * choose `--provider openai-compatible` (or vice versa — `--api-url
 * https://api.minimax.io/v1` with `--provider anthropic` per
 * https://platform.minimax.io/docs/token-plan/codex). MiniMax serves
 * BOTH protocols at the same hostname — Anthropic-protocol at
 * `/anthropic/v1/messages`, OpenAI-protocol at `/v1/responses`.
 *
 * When the operator's chosen provider returns a routing-level failure
 * (404 / 400 — the named protocol doesn't recognize the path), we
 * transparently retry with the other protocol client at the same
 * base URL. This makes `--provider` advisory on dual-protocol
 * gateways, so operators don't need to memorize which path prefix
 * maps to which protocol family.
 *
 * Failure mode the wrapper does NOT handle:
 *
 * - Auth failures (401 / 403) and server errors (5xx): the named
 *   provider already retried internally; another protocol won't help.
 * - Parse failures: the named provider returned a parse-able 200
 *   but the body didn't match — not a routing issue.
 * - Network errors (timeout / TCP): retrying with a different
 *   protocol won't help.
 *
 * On dual-protocol failure, the named provider's error is surfaced
 * (the operator picked it; we honor intent in the error path).
 */
type NamedProtocol = "openai-compatible" | "anthropic";

function isRoutableFailureForDispatcher(error: {
  readonly code: string;
  readonly status: number | null;
}): boolean {
  // Cross-protocol fallback fires on 404 only — the wire-shape
  // genuinely does not have a route for this URL at this provider.
  // We intentionally exclude HTTP 400 from this check, even though
  // the openai-compatible client's internal URL-candidate loop
  // treats both 404 and 400 as "advance to next candidate":
  //
  // 400 typically signals a payload-level error (malformed body,
  // missing required field, unsupported `max_tokens` value,
  // content-policy rejection). Firing cross-protocol fallback on a
  // payload-400 would silently mask wire-shape bugs: an Anthropic
  // call that 400s on an unsupported parameter would retry against
  // OpenAI's wire shape (different body layout) and possibly
  // succeed, with the operator seeing a successful review attributed
  // to the OTHER protocol without ever knowing their original
  // call was malformed. So at the dispatcher boundary we
  // restrict the cross-protocol trigger to truly-routing failures.
  return error.status === 404;
}

async function runWithCrossProtocolFallback(
  args: {
    readonly namedProvider: NamedProtocol;
    readonly namedResult: { readonly ok: false; readonly error: { readonly code: string; readonly status: number | null } };
    readonly fallbackProvider: NamedProtocol;
    readonly baseUrl: string;
    readonly providerApiKey: string;
    readonly modelId: string;
    readonly prompts: { readonly system: string; readonly user: string };
    readonly readRequestTimeoutMs: () => number;
    readonly fetchImpl: typeof fetch;
    readonly parsed: ParsedCliArgs;
    readonly responseFormat: import("../provider/provider-parse.js").ResponseFormat | undefined;
  },
): Promise<
  | { readonly ok: true; readonly endpoint: ProviderEndpoint; readonly review: ProviderReviewPayload; readonly requestId: string }
  | { readonly ok: false; readonly error: { readonly code: string; readonly status: number | null } }
> {
  if (!isRoutableFailureForDispatcher(args.namedResult.error)) {
    return args.namedResult;
  }
  // Surface the fallback so operators can SEE that the dispatcher
  // crossed protocol boundaries on their behalf. Without these
  // notices, a fallback success looks identical to a named-protocol
  // success in the GitHub review attribution, and the operator
  // can't audit which protocol actually produced the review.
  //
  // We log the protocol pair + a redacted URL (origin + path, no
  // query string) so the notice identifies which URL produced the
  // fallback without leaking any `?token=`-style session id into
  // the persisted action log.
  process.stderr.write(
    `::notice::${BRAND_PREFIX}Named provider "${args.namedProvider}" returned status=${args.namedResult.error.status} at ${redactUrlForLog(args.baseUrl)} — retrying with cross-protocol fallback "${args.fallbackProvider}".\n`,
  );
  // The named provider couldn't route at this base URL. Try the other
  // protocol at the SAME base URL — no URL transformation here, the
  // fallback provider's resolver (resolveProviderBaseUrlCandidates /
  // resolveAnthropicMessagesUrl) will do whatever path-prefix work
  // is appropriate for its wire shape.
  //
  // SECURITY NOTE: the operator's API key is passed to BOTH the
  // named and the fallback protocol client. This is correct on
  // dual-protocol gateways (MiniMax at /anthropic and /v1 accepts
  // the same key for both protocols). The 404-only trigger (see
  // isRoutableFailureForDispatcher) keeps this from happening for
  // payload-level errors, but operators pointing the action at a
  // non-dual-protocol URL can still expect this dispatcher's
  // fallback semantics to attempt a same-URL retry under a
  // different protocol family — wherever the operator's URL points
  // is where the key goes, exactly once per protocol.
  let fallbackResult: {
    readonly ok: true; readonly endpoint: ProviderEndpoint; readonly review: ProviderReviewPayload; readonly requestId: string;
  } | { readonly ok: false; readonly error: { readonly code: string; readonly status: number | null } };
  if (args.fallbackProvider === "anthropic") {
    fallbackResult = await runAnthropicRequest({
      baseUrl: args.baseUrl,
      apiKey: args.providerApiKey,
      model: args.modelId,
      system: args.prompts.system,
      user: args.prompts.user,
      requestTimeoutMs: args.readRequestTimeoutMs(),
      ...(args.parsed.maxOutputTokens !== null ? { maxOutputTokens: args.parsed.maxOutputTokens } : {}),
      fetchImpl: args.fetchImpl,
    });
  } else {
    fallbackResult = await runProviderRequest({
      baseUrl: args.baseUrl,
      apiKey: args.providerApiKey,
      model: args.modelId,
      system: args.prompts.system,
      user: args.prompts.user,
      requestTimeoutMs: args.readRequestTimeoutMs(),
      ...(args.parsed.maxOutputTokens !== null ? { maxOutputTokens: args.parsed.maxOutputTokens } : {}),
      ...(args.parsed.effort !== null ? { reasoningEffort: args.parsed.effort } : {}),
      // Carry the strict-JSON-schema constraint from the named call:
      // if the operator enabled `--strict-schema`/`responseFormat`,
      // the fallback should match (otherwise payload variance between
      // protocols can silently leak through).
      ...(args.responseFormat !== undefined ? { responseFormat: args.responseFormat } : {}),
      fetchImpl: args.fetchImpl,
    });
  }
  // Diagnostic on dual-protocol failure: if both protocols fail,
  // we surface the named error (per the contract), but we still log
  // the fallback's status so operators can distinguish "named
  // alone failed with 404" from "named AND fallback failed at this
  // URL" without needing to enable DEBUG mode.
  if (!fallbackResult.ok) {
    process.stderr.write(
      `::notice::${BRAND_PREFIX}Cross-protocol fallback "${args.fallbackProvider}" returned status=${fallbackResult.error.status} at ${redactUrlForLog(args.baseUrl)} — surfacing named protocol's error.\n`,
    );
  }
  return fallbackResult;
}
