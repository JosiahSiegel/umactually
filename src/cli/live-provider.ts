import { runCopilotRequest } from "../provider/copilot.js";
import {
  runProviderRequest,
  type ProviderCallResult,
  type ProviderReviewPayload,
} from "../provider/openai-compatible.js";
import { resolveField } from "../config/field-resolution.js";
import {
  runAnthropicRequest,
  type AnthropicProviderCallResult,
} from "../provider/anthropic-messages.js";
import {
  setActiveParseObservationSink,
  setActiveSeveritySink,
  type BodyAliasObservation,
  type ResponseFormat,
  type SeverityWarning,
  type SeverityWarningSink,
} from "../provider/provider-parse.js";
import { isRoutableFailureForCrossProtocol, type ProviderEndpoint } from "../provider/provider-error.js";
import { scanReviewSecrets } from "../security/scan-review-secrets.js";
import { BRAND_PREFIX } from "../util/brand.js";
import { ENV_KEYS } from "../util/env-keys.js";
import {
  DEFAULT_ANTHROPIC_URL,
  DEFAULT_GITHUB_API_BASE,
} from "../util/provider-defaults.js";
import { requireLiveConfig } from "../util/required-config.js";
import { looksLikeAnthropicEndpoint, redactUrlForLog } from "../util/url.js";
import {
  buildMalformedProviderFallback,
  enrichWithDurableIdentity,
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
import {
  discoverAutoModel,
  type ModelDiscoveryError,
  type ModelDiscoveryInput,
} from "./auto-model.js";
import { buildProviderPrompts, REVIEW_PAYLOAD_JSON_SCHEMA } from "./provider-prompts.js";
import { applyVerifiedFactsFilter, verifyFindingsAgainstDiff } from "./verify-findings.js";
import { applyConfidenceFilter } from "../review/filter-confidence.js";

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
  readonly instructionFilesByBaseBranch?: Map<string, string>;
  readonly sonarContext?: string;
  readonly signal?: AbortSignal;
}): Promise<LiveProviderOutcome> {
  await scanReviewSecrets({
    diffText: input.diffText,
    expectedArtifact: "artifacts/manual/s5-redaction-report.json",
  });
  const providerApiKey = requireLiveConfig(
    resolveField(input.parsed.apiKey, input.env[ENV_KEYS.UMACTUALLY_API_KEY], ""),
    ENV_KEYS.UMACTUALLY_API_KEY,
  );
  const providerUrl = resolveProviderUrl(input.parsed, input.env);
  const modelId = await resolveRequestModel({
    configuredModel: input.parsed.model,
    provider: input.parsed.provider ?? "openai-compatible",
    apiUrl: providerUrl,
    apiKey: providerApiKey,
    fetchImpl: input.fetchImpl,
    ...(input.signal === undefined ? {} : { signal: input.signal }),
    timeoutMs: readRequestTimeoutMs(input.parsed),
  });
  const prompts = await buildProviderPrompts({
    ...input,
    ...(input.instructionFilesByBaseBranch !== undefined
      ? { instructionFilesByBaseBranch: input.instructionFilesByBaseBranch }
      : {}),
  });

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
  // Install an ambient body-alias observation sink alongside the
  // severity sink. Mirrors the install/clear pair: anything
  // `readCommentArray` emits (a synonym-keyed populated body) lands
  // in `bodyAliasObservations`, which `withParseWarnings` converts
  // into `body-alias` ParseWarning entries for the artifact.
  //
  // Note on source attribution: `parseReviewPayload` parses
  // `comments[]` first then `suppressed_comments[]`, so the
  // observation's `commentIndex` is index-into-whichever-array, and
  // we attribute source by range — observations with commentIndex
  // < review.comments.length come from `comments`, the remainder
  // from `suppressed_comments`. Robust for the common single-parse
  // case; the parse-fail retry path is rare enough to ignore for
  // T13's source attribution.
  const bodyAliasObservations: BodyAliasObservation[] = [];
  const observationSink = (observation: BodyAliasObservation) => {
    bodyAliasObservations.push(observation);
  };
  setActiveParseObservationSink(observationSink);
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
    result: { readonly ok: true; readonly endpoint: string; readonly review: ProviderReviewPayload; readonly usage?: import("../provider/provider-error.js").ProviderUsage },
    providerName: string,
  ): LiveProviderOutcome {
    const { review: preVerifyReview, emptyBodyDropped, originalCommentsLength } = normalizeProviderReview(result.review, [providerApiKey, input.platformToken]);
    const verifyFilterResult = input.parsed.verifyFindings !== false
      ? applyVerifyFilter(preVerifyReview, input.diffText)
      : {
          review: preVerifyReview,
          verifiedFactsFilter: {
            kept: preVerifyReview.comments,
            downgraded: [],
            downgradeReasons: [],
          },
          confidenceFilter: {
            kept: preVerifyReview.comments,
            downgraded: [],
            reasons: [],
          },
        };
    const preVerifyOutcome = withParseWarnings({
      review: preVerifyReview,
      endpoint: result.endpoint,
      provider: providerName,
      modelId,
      severityWarnings: severityWarnings.slice(),
      bodyAliasObservations: bodyAliasObservations.slice(),
      diffText: input.diffText,
      verifiedFactsFilter: verifyFilterResult.verifiedFactsFilter,
      confidenceFilter: verifyFilterResult.confidenceFilter,
      emptyBodyDropped,
      originalCommentsLength,
    });
    const emptyBodyDroppedCount = emptyBodyDropped.length;
    // `::notice::` disclosure when the provider emitted any
    // empty-body findings; mirrors src/cli/simulate-findings.ts:27-29.
    // Sanitized so secret-bearing model output can't slip into the
    // GitHub Actions notice metadata.
    if (emptyBodyDroppedCount > 0) {
      const message = `${BRAND_PREFIX}${emptyBodyDroppedCount} finding(s) had no body from the provider and were suppressed (see parse-warnings artifact); re-run or switch model if this persists.`;
      const sanitized = sanitizeForPost(message, [providerApiKey, input.platformToken]);
      process.stderr.write(`::notice::${sanitized}\n`);
    }
    return {
      ...preVerifyOutcome,
      review: verifyFilterResult.review,
      ...(result.usage !== undefined ? { usage: result.usage } : {}),
      ...(emptyBodyDroppedCount > 0 ? { emptyBodyDroppedCount } : {}),
    };
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
    maxOutputTokens: number | null,
  ): LiveProviderOutcome {
    const review = buildMalformedProviderFallback({
      provider: providerName,
      modelId,
      rawText,
      secrets: [providerApiKey, input.platformToken],
      ...parseFailureReasonFromProviderError(result.error, maxOutputTokens),
    });
    return withParseWarnings({
      review,
      endpoint: result.error.endpoint,
      provider: providerName,
      modelId,
      severityWarnings: severityWarnings.slice(),
      bodyAliasObservations: bodyAliasObservations.slice(),
      diffText: input.diffText,
      originalCommentsLength: review.comments.length,
    });
  }

  try {
    if (input.parsed.provider === "copilot") {
      const result = await runCopilotRequest(
        buildProviderRequestConfig({
          protocol: "copilot",
          parsed: input.parsed,
          env: input.env,
          modelId,
          prompts,
          fetchImpl: input.fetchImpl,
          responseFormat,
          providerApiKey,
          githubApiBase: resolveField(
            input.parsed.githubApiBase,
            input.env[ENV_KEYS.UMACTUALLY_GITHUB_API_BASE],
            DEFAULT_GITHUB_API_BASE,
          ),
        }),
      );
      return dispatchProviderResult(
        result,
        COPILOT_PROVIDER_NAME,
        input.parsed.maxOutputTokens,
        { handleSuccess, handleParse },
      );
    }

    if (input.parsed.provider === "anthropic") {
      // Anthropic native provider (`/v1/messages`). The wire body uses
      // the Anthropic Messages schema (top-level `system`, user-only
      // `messages[]`, `max_tokens` instead of `max_output_tokens`,
      // `x-api-key`/`anthropic-version` headers). The URL resolution
      // (in `resolveAnthropicMessagesUrl`) preserves the operator's
      // path prefix so Anthropic-compatible gateways mounted under
      // paths such as `/llm/anthropic` route correctly.
      //
      // When the URL fails with a routing-level rejection (404/400),
      // `runWithCrossProtocolFallback` transparently retries with the
      // OpenAI-compatible client at the same base URL — operators
      // pointing dual-protocol gateways at the action don't have to
      // know which protocol lives under which path prefix.
      //
      // Anthropic defaults to https://api.anthropic.com/v1 when
      // --api-url is unset. This matches the contracts in
      // `action.yml`, the README's "Using the native Anthropic
      // Messages API" block, and `validate.ts`/`orchestrator.ts`
      // which both exempt --api-url from the required check when
      // --provider anthropic is set.
      const anthropicUrl = providerUrl ?? DEFAULT_ANTHROPIC_URL;
      let result = await runAnthropicRequest(
        buildProviderRequestConfig({
          protocol: "anthropic",
          parsed: input.parsed,
          env: input.env,
          modelId,
          prompts,
          fetchImpl: input.fetchImpl,
          responseFormat,
          providerApiKey,
          baseUrl: anthropicUrl,
        }),
      );
      if (!result.ok) {
        // Cross-protocol fallback to the OpenAI client at the same URL.
        // If the fallback also fails, surface the original anthropic error
        // (the operator picked `--provider anthropic` — honor that intent).
        const fallback = await runWithCrossProtocolFallback({
          namedProvider: "anthropic",
          namedResult: result,
          fallbackProvider: "openai-compatible",
          baseUrl: anthropicUrl,
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
      return dispatchProviderResult(
        result,
        providerNameForEndpoint(result.ok ? result.endpoint : result.error.endpoint),
        input.parsed.maxOutputTokens,
        { handleSuccess, handleParse },
      );
    }

    const openaiUrl = requireLiveConfig(providerUrl ?? "", ENV_KEYS.UMACTUALLY_API_URL);

    // Path-prefix heuristic: if the operator's URL looks like an
    // Anthropic-protocol gateway (any path segment equal to
    // `anthropic`, case-insensitive — for example `/anthropic` or
    // `/llm/anthropic`) commit to the Anthropic Messages API client
    // regardless of which `--provider`
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
    const useAnthropicProtocol = looksLikeAnthropicEndpoint(openaiUrl);
    if (useAnthropicProtocol) {
      process.stderr.write(
        `::notice::${BRAND_PREFIX}Operator URL contains an /anthropic path segment; using the Anthropic Messages API client (regardless of --provider).\n`,
      );
    }

    let result: ProviderCallResult | AnthropicProviderCallResult;
    if (useAnthropicProtocol) {
      result = await runAnthropicRequest(
        buildProviderRequestConfig({
          protocol: "anthropic",
          parsed: input.parsed,
          env: input.env,
          modelId,
          prompts,
          fetchImpl: input.fetchImpl,
          responseFormat,
          providerApiKey,
          baseUrl: openaiUrl,
        }),
      );
    } else {
      result = await runProviderRequest(
        buildProviderRequestConfig({
          protocol: "openai",
          parsed: input.parsed,
          env: input.env,
          modelId,
          prompts,
          fetchImpl: input.fetchImpl,
          responseFormat,
          providerApiKey,
          baseUrl: openaiUrl,
        }),
      );
    }

    if (!result.ok) {
      // Cross-protocol fallback: if the named (openai-compatible) client
      // exhausted its URL candidates with a routing-level failure, try
      // the Anthropic client at the same URL. On dual-protocol gateways
      // with an `/anthropic/` path, this lets `--provider
      // openai-compatible` discover the Anthropic-protocol endpoint at
      // `/anthropic/v1/messages` without operator intervention.
      //
      // If the fallback also fails, surface the original named error
      // (the operator picked `--provider openai-compatible`).
      const fallback = await runWithCrossProtocolFallback({
        namedProvider: "openai-compatible",
        namedResult: result,
        fallbackProvider: "anthropic",
        baseUrl: openaiUrl,
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

    return dispatchProviderResult(
      result,
      providerNameForEndpoint(result.ok ? result.endpoint : result.error.endpoint),
      input.parsed.maxOutputTokens,
      { handleSuccess, handleParse },
    );
  } finally {
    // Always clear the sink so a subsequent, unrelated request does not
    // inherit this request's warnings array.
    setActiveSeveritySink(null);
    // Pair clear for the observation sink — concurrent reads in tests
    // fail loudly if the slot is left non-null across requests.
    setActiveParseObservationSink(null);
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
  readonly bodyAliasObservations: readonly import("../provider/provider-parse.js").BodyAliasObservation[];
  readonly diffText: string;
  readonly verifiedFactsFilter?: import("./verify-findings.js").VerifiedFactsFilterResult;
  readonly confidenceFilter?: import("../review/filter-confidence.js").ConfidenceFilterResult;
  // Empty-body entries moved out of `comments` by the partition layer,
  // each carrying the ORIGINAL index in the model's emitted comments
  // array so the parse-warnings artifact records `source: "comments"`.
  readonly emptyBodyDropped?: readonly { readonly index: number; readonly comment: LiveReviewComment }[];
  readonly originalCommentsLength: number;
}): LiveProviderOutcome {
  const emptyBodyDropped = input.emptyBodyDropped ?? [];
  const emptyBodyWarnings: import("./parse-warnings.js").ParseWarning[] = emptyBodyDropped.map((d) => ({
    reason: "empty-body" as const,
    source: "comments" as const,
    index: d.index,
    modelPath: d.comment.path,
    modelLine: d.comment.line,
    modelSeverity: d.comment.severity,
    bodyExcerpt: "",
  }));
  // An empty-body comment that is also off-diff appears in BOTH the
  // explicit "empty-body" warnings above AND the
  // "line-not-in-diff" / "path-not-in-diff" warnings from
  // `collectParseWarnings` (after the partition, the moved entry sits
  // in `review.suppressedComments` and re-enters the off-diff scan).
  // This double-count is intentional — the two reasons are
  // independently actionable and operators triage them separately.
  return {
    review: input.review,
    endpoint: input.endpoint,
    provider: input.provider,
    modelId: input.modelId,
    severityWarnings: input.severityWarnings,
    parseWarnings: [
      ...emptyBodyWarnings,
      ...buildParseWarningsArtifact({
        review: input.review,
        diffText: input.diffText,
        bodyAliasObservations: input.bodyAliasObservations,
        originalCommentsLength: input.originalCommentsLength,
      }).warnings,
    ],
    verifiedFactsFilter: input.verifiedFactsFilter ?? {
      kept: input.review.comments,
      downgraded: [],
      downgradeReasons: [],
    },
    confidenceFilter: input.confidenceFilter ?? {
      kept: input.review.comments,
      downgraded: [],
      reasons: [],
    },
  };
}

/**
 * Apply the deterministic (path, line) verify filter to the
 * review's comments[]. Returns a new LiveReview with the filtered
 * comments[] PLUS a verified-facts filter result describing
 * findings that were downgraded because they contradicted a verified
 * fact.
 *
 * The returned `review.comments` contains ONLY the KEPT findings
 * (at their original severity). Downgraded findings live in
 * `verifiedFactsFilter.downgraded` as a separate list — callers that
 * want to surface downgraded findings read that list directly. This
 * avoids double-counting: downstream code iterating
 * `review.comments` for posting sees the kept set; downstream code
 * reading `verifiedFactsFilter.downgraded` for audit sees the
 * downgraded set. The two are disjoint.
 *
 * The original is left untouched so callers (the parse-warnings
 * artifact builder) see the pre-filter payload.
 *
 * Defense-in-depth Layer 4: the post-filter in
 * `selectPostableComments` runs the same check, but doing it here
 * means the platform-posting paths only see anchorable findings.
 *
 * Layer 4.5: after the (path, line) filter, run the verified-facts
 * contradiction filter. Findings whose body asserts something is
 * missing from a verified list (e.g. "dist/ is missing from
 * package.json#files" when dist/ is in fact in files) are
 * downgraded to info severity in the downgraded list so the
 * operator can see what the model claimed and why it was
 * downgraded, but they do not enter `review.comments` (which is
 * what gets posted).
 */
function applyVerifyFilter(review: LiveReview, diffText: string): {
  readonly review: LiveReview;
  readonly verifiedFactsFilter: import("./verify-findings.js").VerifiedFactsFilterResult;
  readonly confidenceFilter: import("../review/filter-confidence.js").ConfidenceFilterResult;
} {
  if (diffText.length === 0) {
    return {
      review,
      verifiedFactsFilter: { kept: review.comments, downgraded: [], downgradeReasons: [] },
      confidenceFilter: { kept: review.comments, downgraded: [], reasons: [] },
    };
  }
  // Delegate to the standalone `verifyFindingsAgainstDiff` helper
  // so the inline filter and the parse-warnings artifact agree
  // on which comments get dropped — the previous inline
  // re-implementation diverged from the helper in a way that
  // let the artifact undercount fabrication events.
  const { verified } = verifyFindingsAgainstDiff({ review, diffText });
  const filteredReview = { ...review, comments: verified };
  const verifiedFactsFilter = applyVerifiedFactsFilter({
    review: filteredReview,
    diffText,
  });
  // Layer 5: confidence-filter pass. Catches the FP patterns the
  // verified-facts layer cannot detect (hedging-language calibration,
  // pattern-matched advice, contradicted-by-quote, intentional-design
  // blindness). Runs AFTER the verified-facts filter so the post-
  // filter sees only findings that survived prior checks.
  const confidenceFilter = applyConfidenceFilter({
    review: { ...filteredReview, comments: verifiedFactsFilter.kept },
    diffText,
  });
  // Only the KEPT findings go into review.comments. Downgraded
  // findings are surfaced separately via verifiedFactsFilter.downgraded
  // AND confidenceFilter.downgraded (the operator can choose to
  // render them; the platform-posting path ignores them). The two
  // lists are disjoint from review.comments.
  return {
    review: { ...filteredReview, comments: confidenceFilter.kept },
    verifiedFactsFilter,
    confidenceFilter,
  };
}

// Pair the post-partition LiveReview with the original-index map of
// empty-body entries that were moved out of `comments`. The
// parse-warnings artifact reads `emptyBodyDropped` to emit one
// `reason: "empty-body"` warning per moved entry with
// `source: "comments"` and the index in the model's emitted
// comments array — mirroring the un-partitioned indexing that the
// T12 contract pinned.
type NormalizeResult = {
  readonly review: LiveReview;
  readonly emptyBodyDropped: readonly { readonly index: number; readonly comment: LiveReviewComment }[];
  readonly originalCommentsLength: number;
};

function normalizeProviderReview(
  payload: ProviderReviewPayload,
  secrets: readonly string[],
): NormalizeResult {
  // Layer 4 deterministic verification is applied in the caller
  // (see `applyVerifyFilter` in `live-provider.ts`) AFTER the
  // parse-warnings artifact is built. Doing it in the caller means
  // the artifact captures every fabrication event, even ones the
  // inline filter drops. Don't re-add the filter here — see
  // the three-step flow in the Copilot/openai-compatible
  // branches.
  //
  // Identity enrichment runs before the empty-body partition so the
  // moved entries retain durableIdentity for fingerprinting / dedup.
  const sanitizedComments = payload.comments.map((comment) => normalizeProviderComment(comment, secrets));
  const sanitizedSuppressed = payload.suppressed_comments.map((comment) => normalizeProviderComment(comment, secrets));
  const keptComments: LiveReviewComment[] = [];
  const emptyBodyDropped: { readonly index: number; readonly comment: LiveReviewComment }[] = [];
  for (let i = 0; i < sanitizedComments.length; i += 1) {
    const entry = sanitizedComments[i];
    if (entry === undefined) continue;
    if (entry.body.trim().length === 0) {
      emptyBodyDropped.push({ index: i, comment: entry });
    } else {
      keptComments.push(entry);
    }
  }
  // Defense-in-depth: if the model emits the same empty-body finding in both
  // `comments` and `suppressed_comments`, count it exactly once. (path, line,
  // body) uniquely identifies the finding — body is included so a model that
  // emits a populated body in suppressed_comments at the same path/line still
  // surfaces it.
  const droppedKeys = new Set(
    emptyBodyDropped.map((d) => `${d.comment.path}:${d.comment.line}:${d.comment.body}`),
  );
  const dedupedSuppressed = sanitizedSuppressed.filter(
    (s) => !droppedKeys.has(`${s.path}:${s.line}:${s.body}`),
  );
  return {
    review: {
      summary: sanitizeForPost(payload.summary, secrets),
      verdict: payload.verdict,
      comments: keptComments,
      suppressedComments: [...dedupedSuppressed, ...emptyBodyDropped.map((d) => d.comment)],
    },
    emptyBodyDropped,
    originalCommentsLength: sanitizedComments.length,
  };
}

function normalizeProviderComment(
  comment: ProviderReviewPayload["comments"][number],
  secrets: readonly string[],
): LiveReviewComment {
  const sanitized: LiveReviewComment = {
    path: comment.path,
    line: comment.line,
    body: sanitizeForPost(comment.body, secrets),
    severity: sanitizeForPost(comment.severity, secrets),
    category: sanitizeForPost(comment.category, secrets),
  };
  return enrichWithDurableIdentity(sanitized);
}

function resolveProviderUrl(parsed: ParsedCliArgs, env: NodeJS.ProcessEnv): string | null {
  if (parsed.provider === "copilot") return null;
  const fallback = parsed.provider === "anthropic" ? DEFAULT_ANTHROPIC_URL : "";
  const resolved = resolveField(parsed.apiUrl, env[ENV_KEYS.UMACTUALLY_API_URL], fallback);
  return resolved.trim().length === 0 ? null : resolved;
}

async function resolveRequestModel(input: {
  readonly configuredModel: string | null;
  readonly provider: ModelDiscoveryInput["provider"];
  readonly apiUrl: string | null;
  readonly apiKey: string;
  readonly fetchImpl: FetchImpl;
  readonly signal?: AbortSignal;
  readonly timeoutMs: number;
}): Promise<string> {
  const configured = input.configuredModel;
  const normalized = configured?.trim();
  if (configured !== null && normalized !== undefined && normalized.length > 0 && normalized !== "auto") {
    return configured;
  }
  const discovery = await discoverAutoModel({
    provider: input.provider,
    apiUrl: input.apiUrl,
    apiKey: input.apiKey,
    dependencies: {
      fetchImpl: input.fetchImpl as typeof fetch,
      timeoutMs: input.timeoutMs,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    },
  });
  if (discovery.ok) return discovery.modelId;
  throw new LiveReviewError(
    "PROVIDER_ERROR",
    formatModelDiscoveryFailure(discovery.error),
    { cause: discovery.error },
  );
}

function formatModelDiscoveryFailure(error: ModelDiscoveryError): string {
  switch (error.kind) {
    case "empty":
      return "Provider model discovery returned no usable models. Set an available model explicitly with --model.";
    case "ambiguous":
      return `Provider model discovery returned ${error.modelIds.length} models and cannot choose safely. Set one explicitly with --model.`;
    case "unauthorized":
      return `Provider model discovery was not authorized (HTTP ${error.status}). Check provider credentials or set a known model explicitly with --model.`;
    case "malformed":
      return "Provider model discovery returned an invalid model catalog. Set a known model explicitly with --model.";
    case "unsupported":
      return `Automatic model discovery is unsupported for provider ${error.provider}. Set a model explicitly with --model.`;
    case "aborted":
      return "Provider model discovery was cancelled or timed out. Retry or set a known model explicitly with --model.";
    case "network":
      return "Provider model discovery could not reach the model catalog. Check the provider connection or set a known model explicitly with --model.";
  }
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
 * Some operators point `--api-url` at a gateway that serves both
 * Anthropic and OpenAI-compatible protocols but choose the other
 * provider family. Such gateways commonly expose Anthropic at
 * `/anthropic/v1/messages` and OpenAI-compatible responses at
 * `/v1/responses` on the same hostname.
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
  if (!isRoutableFailureForCrossProtocol(args.namedResult.error)) {
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
  // dual-protocol gateways that accept the same key for both protocols.
  // The 404-only trigger (see
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
    fallbackResult = await runAnthropicRequest(
      buildProviderRequestConfig({
        protocol: "anthropic",
        parsed: args.parsed,
        env: {} as NodeJS.ProcessEnv,
        modelId: args.modelId,
        prompts: args.prompts,
        fetchImpl: args.fetchImpl,
        responseFormat: args.responseFormat,
        providerApiKey: args.providerApiKey,
        baseUrl: args.baseUrl,
      }),
    );
  } else {
    fallbackResult = await runProviderRequest(
      buildProviderRequestConfig({
        protocol: "openai",
        parsed: args.parsed,
        env: {} as NodeJS.ProcessEnv,
        modelId: args.modelId,
        prompts: args.prompts,
        fetchImpl: args.fetchImpl,
        // Carry the strict-JSON-schema constraint from the named call:
        // if the operator enabled `--strict-schema`/`responseFormat`,
        // the fallback should match (otherwise payload variance between
        // protocols can silently leak through).
        responseFormat: args.responseFormat,
        providerApiKey: args.providerApiKey,
        baseUrl: args.baseUrl,
      }),
    );
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

/**
 * Build the per-protocol request config consumed by `runCopilotRequest`,
 * `runProviderRequest`, or `runAnthropicRequest`. The 5 inline config-build
 * sites (Copilot, Anthropic named, Anthropic-protocol fallback inside the
 * openai-compatible branch, OpenAI-compatible, and cross-protocol fallback
 * for both Anthropic + OpenAI arms) each become a single call to this
 * helper. The per-protocol field mapping preserves the pre-refactor wire
 * shape — `responseFormat` is intentionally forwarded for OpenAI + Copilot
 * only; Anthropic drops it (the native Messages API has no
 * `response_format` field, so the in-context system prompt is the only
 * constraint).
 */
type BuildProviderRequestConfigCopilot = {
  readonly protocol: "copilot";
  readonly parsed: ParsedCliArgs;
  readonly env: NodeJS.ProcessEnv;
  readonly modelId: string;
  readonly prompts: { readonly system: string; readonly user: string };
  readonly fetchImpl: FetchImpl;
  readonly responseFormat: ResponseFormat | undefined;
  readonly providerApiKey: string;
  readonly githubApiBase: string;
};

type BuildProviderRequestConfigOpenai = {
  readonly protocol: "openai";
  readonly parsed: ParsedCliArgs;
  readonly env: NodeJS.ProcessEnv;
  readonly modelId: string;
  readonly prompts: { readonly system: string; readonly user: string };
  readonly fetchImpl: FetchImpl;
  readonly responseFormat: ResponseFormat | undefined;
  readonly providerApiKey: string;
  readonly baseUrl: string;
};

type BuildProviderRequestConfigAnthropic = {
  readonly protocol: "anthropic";
  readonly parsed: ParsedCliArgs;
  readonly env: NodeJS.ProcessEnv;
  readonly modelId: string;
  readonly prompts: { readonly system: string; readonly user: string };
  readonly fetchImpl: FetchImpl;
  readonly responseFormat: ResponseFormat | undefined;
  readonly providerApiKey: string;
  readonly baseUrl: string;
};

export function buildProviderRequestConfig(
  input: BuildProviderRequestConfigCopilot,
): import("../provider/copilot.js").CopilotCallConfig;
export function buildProviderRequestConfig(
  input: BuildProviderRequestConfigOpenai,
): import("../provider/openai-compatible.js").ProviderCallConfig;
export function buildProviderRequestConfig(
  input: BuildProviderRequestConfigAnthropic,
): import("../provider/anthropic-messages.js").AnthropicProviderCallConfig;
export function buildProviderRequestConfig(
  input:
    | BuildProviderRequestConfigCopilot
    | BuildProviderRequestConfigOpenai
    | BuildProviderRequestConfigAnthropic,
):
  | import("../provider/copilot.js").CopilotCallConfig
  | import("../provider/openai-compatible.js").ProviderCallConfig
  | import("../provider/anthropic-messages.js").AnthropicProviderCallConfig {
  const requestTimeoutMs = readRequestTimeoutMs(input.parsed);
  const maxOutputTokensSpread = input.parsed.maxOutputTokens !== null
    ? { maxOutputTokens: input.parsed.maxOutputTokens } as const
    : {};
  const reasoningEffortSpread = input.parsed.effort !== null
    ? { reasoningEffort: input.parsed.effort } as const
    : {};
  if (input.protocol === "copilot") {
    return {
      githubToken: input.providerApiKey,
      apiBase: input.githubApiBase,
      system: input.prompts.system,
      user: input.prompts.user,
      model: input.modelId,
      requestTimeoutMs,
      ...maxOutputTokensSpread,
      ...reasoningEffortSpread,
      ...(input.responseFormat !== undefined ? { responseFormat: input.responseFormat } : {}),
      fetchImpl: input.fetchImpl as typeof fetch,
    };
  }
  if (input.protocol === "anthropic") {
    return {
      baseUrl: input.baseUrl,
      apiKey: input.providerApiKey,
      model: input.modelId,
      system: input.prompts.system,
      user: input.prompts.user,
      requestTimeoutMs,
      ...maxOutputTokensSpread,
      ...reasoningEffortSpread,
      fetchImpl: input.fetchImpl,
    };
  }
  return {
    baseUrl: input.baseUrl,
    apiKey: input.providerApiKey,
    model: input.modelId,
    system: input.prompts.system,
    user: input.prompts.user,
    requestTimeoutMs,
    ...maxOutputTokensSpread,
    ...reasoningEffortSpread,
    ...(input.responseFormat !== undefined ? { responseFormat: input.responseFormat } : {}),
    fetchImpl: input.fetchImpl,
  };
}

/**
 * Dispatch a provider result to the success / parse / error path. Owns the
 * `if (ok) → handleSuccess / if (parse) → handleParse / if (provider_error)
 * → throw / else throw` decision tree. The 3 dispatch trees (Copilot,
 * Anthropic, OpenAI-compatible) collapse to one call site each.
 *
 * `handleSuccess` / `handleParse` are caller-supplied closures so the
 * helper stays protocol-agnostic — the success / parse machinery depends
 * on ambient closure state (severity warnings, model id, etc.) that lives
 * inside `requestLiveReview`. `maxOutputTokens` is forwarded to the
 * `handleParse` closure so the parse-fail truncation diagnostic can report
 * the configured cap alongside the model's usage.
 */
export type DispatchProviderResult =
  | {
    readonly ok: true;
    readonly endpoint: ProviderEndpoint;
    readonly review: ProviderReviewPayload;
    readonly requestId: string;
    readonly usage?: import("../provider/provider-error.js").ProviderUsage;
  }
  | {
    readonly ok: false;
    readonly error: {
      readonly code: string;
      readonly endpoint: ProviderEndpoint;
      readonly message: string;
      readonly rawText: string | undefined;
      readonly truncated: boolean | undefined;
      readonly usage: { input_tokens?: number; output_tokens?: number; total_tokens?: number } | undefined;
      readonly providerErrorDetails: { readonly kind: string; readonly message: string } | undefined;
    };
  };

export function dispatchProviderResult(
  result: DispatchProviderResult,
  providerName: string,
  maxOutputTokens: number | null,
  ctx: {
    readonly handleSuccess: (
      result: { readonly ok: true; readonly endpoint: ProviderEndpoint; readonly review: ProviderReviewPayload; readonly usage?: import("../provider/provider-error.js").ProviderUsage },
      providerName: string,
    ) => LiveProviderOutcome;
    readonly handleParse: (
      result: {
        readonly ok: false;
        readonly error: {
          readonly code: string;
          readonly endpoint: ProviderEndpoint;
          readonly truncated: boolean | undefined;
          readonly usage: { input_tokens?: number; output_tokens?: number; total_tokens?: number } | undefined;
        };
      },
      providerName: string,
      rawText: string,
      maxOutputTokens: number | null,
    ) => LiveProviderOutcome;
  },
): LiveProviderOutcome {
  if (result.ok) {
    return ctx.handleSuccess(result, providerName);
  }
  if (result.error.code === "parse") {
    return ctx.handleParse(result, providerName, result.error.rawText ?? "", maxOutputTokens);
  }
  if (result.error.code === "provider_error") {
    const details = result.error.providerErrorDetails;
    throw new LiveReviewError("PROVIDER_ERROR", details?.message ?? result.error.message, { cause: result.error });
  }
  throw new LiveReviewError("PROVIDER_REQUEST_FAILED", result.error.message, { cause: result.error });
}
