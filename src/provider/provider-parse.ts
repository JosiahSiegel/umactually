import { extractJsonBlock } from "../render/json-extract.js";
import {
  isRecord,
  isUnknownArray,
  readArrayField,
  readRecordField,
  readSafeIntegerField,
  readStringField,
  tryParseJson,
} from "../util/json-guards.js";
import type { ProviderEndpoint, ProviderErrorDetails, ProviderUsage } from "./provider-error.js";
import type { DurableFindingIdentity } from "../review/fingerprint.js";
import type { ValidatedSuggestion, RemediationInstruction, RawSuggestion, RemediationBuildInput } from "../review/suggestion.js";

export type { ProviderEndpoint, ProviderErrorDetails, ProviderUsage };
export type { ValidatedSuggestion, RemediationInstruction };

export type ProviderComment = {
  readonly path: string;
  readonly line: number;
  readonly body: string;
  readonly severity: string;
  readonly category: string;
  readonly durableIdentity?: DurableFindingIdentity;
  /** Validated suggestion — rendered to platform surfaces ONLY when present. */
  readonly validatedSuggestion?: ValidatedSuggestion;
  /** Serialized to JSON artifact ONLY — never to comment bodies. */
  readonly remediationInstruction?: RemediationInstruction;
  /** Internal: raw unvalidated suggestion from provider JSON. Consumed by the validation boundary. */
  readonly rawSuggestion?: RawSuggestion;
  /** Internal: raw remediation input from provider JSON. Consumed by the validation boundary. */
  readonly rawRemediation?: RemediationBuildInput;
};

export type ProviderReviewPayload = {
  readonly summary: string;
  readonly verdict: string;
  readonly comments: readonly ProviderComment[];
  readonly suppressed_comments: readonly ProviderComment[];
};

/**
 * Structured context for a single provider-severity mismatch event.
 * `providerName` identifies the live provider ("openai-compatible" /
 * "github-copilot"); `commentIndex` is the 0-based index of the comment
 * within whichever array was being parsed (comments[] or
 * suppressed_comments[]) — the two arrays share the same 0-based space
 * but are independent (so a malformed severity in suppressed_comments[2]
 * reports index 2 regardless of how many inline comments preceded it).
 */
export type SeverityWarningContext = {
  readonly providerName?: string;
  readonly commentIndex: number;
};

/**
 * Sink for surfacing non-fatal provider-severity mismatches. The parser
 * still falls back to "medium" so a misbehaving provider does not crash
 * the run; the sink exists purely so the operator (and any structured
 * telemetry downstream of `LiveProviderOutcome.severityWarnings`) can see
 * WHICH comment was wrong.
 *
 * Args: (rawValue, normalizedFallback, context). The rawValue may be the
 * empty string when the provider omitted the severity field entirely.
 */
export type SeverityWarningSink = (
  rawValue: string,
  normalizedFallback: string,
  context: SeverityWarningContext,
) => void;

/**
 * Captured record of a single provider-severity mismatch, suitable for
 * downstream serialization into `LiveProviderOutcome.severityWarnings`
 * and rendering in a future summary-layout footer (not wired yet — the
 * type is plumbed but no layout reads it).
 */
export type SeverityWarning = {
  readonly rawValue: string;
  readonly normalizedFallback: string;
  readonly commentIndex: number;
  readonly providerName: string;
};

/**
 * Ambient (module-singleton) sink slot. `live-provider.ts`
 * `requestLiveReview` installs a sink here before invoking the provider
 * and clears it in `finally`, so any `parseReviewPayload` call reachable
 * from `runCopilotRequest` / `runProviderRequest` will pick it up
 * without needing to thread it through every call site.
 *
 * Default value is `null` (no sink installed → no warnings surfaced),
 * preserving the previous silent-coercion behavior for any caller that
 * has not opted in.
 *
 * Concurrency note: a module-level singleton is only safe when callers
 * install → await → clear atomically (Node's single-threaded event loop
 * guarantees no `await` boundary interleaves another `setActiveSeveritySink`
 * call). Any future caller that runs two `requestLiveReview` requests
 * concurrently via `Promise.all` will have the second `setActiveSeveritySink`
 * overwrite the first's slot, and the first's `finally` will clear the
 * second's sink mid-flight — silently corrupting the telemetry array.
 * The guard below surfaces this condition loudly so the regression is
 * caught at install time, not silently after the fact.
 */
let activeSeveritySink: SeverityWarningSink | null = null;

export function setActiveSeveritySink(sink: SeverityWarningSink | null): void {
  if (sink !== null && activeSeveritySink !== null) {
    // Concurrency footgun detected: a sink is already installed and the
    // caller is overwriting it without clearing the previous one first.
    // Log + warn loudly so the regression class surfaces in CI logs
    // rather than silently corrupting telemetry.
    // eslint-disable-next-line no-console -- provider parse-fail diagnostic
    console.warn(
      "[provider-parse] setActiveSeveritySink: overwriting a non-null ambient sink. " +
        "This usually means two requestLiveReview calls are running concurrently " +
        "(Promise.all) — the second's sink will be cleared by the first's finally, " +
        "corrupting the captured warnings. Thread the sink via ParseContext instead.",
    );
  }
  activeSeveritySink = sink;
}

function getActiveSeveritySink(): SeverityWarningSink | null {
  return activeSeveritySink;
}

/**
 * Structured observation of a single body-key alias resolution — emitted
 * when a synonym key (not the canonical `body`) supplied the populated
 * comment body. `field` is the alias key that won; `commentIndex` is the
 * index of the comment in its `readCommentArray` input (independent of
 * which array — inline or suppressed — produced it).
 */
export type BodyAliasObservation = {
  readonly kind: "body-alias";
  readonly field: string;
  readonly commentIndex: number;
};

/**
 * Sink for surfacing body-key alias resolutions. Mirrors the severity
 * sink: ambient module-singleton, installed before the provider call and
 * cleared in `finally`, so `readCommentArray` can report which alias key
 * supplied a body without threading a sink through every call site.
 */
export type ParseObservationSink = (observation: BodyAliasObservation) => void;

/**
 * Ambient (module-singleton) observation sink slot. Default value is
 * `null` (no sink installed → no observations surfaced), preserving the
 * previous silent-alias behavior for any caller that has not opted in.
 *
 * Concurrency note: mirrors the severity sink above — only safe when
 * callers install → await → clear atomically. The guard below warns
 * loudly on overwrite so the regression class surfaces at install time.
 */
let activeParseObservationSink: ParseObservationSink | null = null;

export function setActiveParseObservationSink(sink: ParseObservationSink | null): void {
  if (sink !== null && activeParseObservationSink !== null) {
    // Concurrency footgun detected: a sink is already installed and the
    // caller is overwriting it without clearing the previous one first.
    // Log + warn loudly so the regression class surfaces in CI logs
    // rather than silently corrupting telemetry.
    // eslint-disable-next-line no-console -- provider parse-fail diagnostic
    console.warn(
      "[provider-parse] setActiveParseObservationSink: overwriting a non-null ambient sink. " +
        "This usually means two requestLiveReview calls are running concurrently " +
        "(Promise.all) — the second's sink will be cleared by the first's finally, " +
        "corrupting the captured observations. Thread the sink via ParseContext instead.",
    );
  }
  activeParseObservationSink = sink;
}

export function getActiveParseObservationSink(): ParseObservationSink | null {
  return activeParseObservationSink;
}

/**
 * Shared options type threaded through `parseReviewPayload` →
 * `readCommentArray` → `normalizeProviderSeverity`. All fields are
 * optional — when omitted, behavior is byte-identical to the previous
 * silent-coercion path.
 */
export type ParseContext = {
  readonly sink?: SeverityWarningSink;
  readonly providerName?: string;
};

/**
 * Emit a structured warning when the parser encounters a severity value
 * it cannot classify. Always also writes a single `console.warn` line so
 * operators can see the mismatch in CI logs without needing to inspect
 * the structured sink channel.
 */
function emitSeverityWarning(
  rawValue: string,
  normalizedFallback: string,
  context: SeverityWarningContext,
  sink: SeverityWarningSink | undefined,
): void {
  const providerLabel = context.providerName ?? "unknown-provider";
  const safeRaw = JSON.stringify(rawValue);
  const message =
    `provider ${providerLabel} emitted unrecognized severity ${safeRaw} ` +
    `at comment index ${context.commentIndex}; falling back to "${normalizedFallback}". ` +
    `Expected one of: info, low, medium, high, critical.`;
  // eslint-disable-next-line no-console -- provider parse-fail diagnostic
  console.warn(message, context);
  if (sink !== undefined) {
    sink(rawValue, normalizedFallback, context);
  }
}

/**
 * Returns true when the parsed review has at least one non-empty
 * summary, verdict, or comment — used by the parse-fail retry paths
 * to decide whether the parsed response carries any usable signal.
 */
export function isNonEmptyReview(review: ProviderReviewPayload | null): review is ProviderReviewPayload {
  return review !== null
    && (review.summary.length > 0 || review.verdict.length > 0 || review.comments.length > 0);
}

/**
 * Returns true when the review carries findings but every one of them has
 * an empty or whitespace-only body — the schema-valid-but-useless shape
 * a model can emit when it collapses under output-token pressure.
 *
 * Origin: the Minimax-M3 empty-body incident (waffle-house-menu PR,
 * workflow run 31801055564). The model returned a review whose comment
 * bodies were all empty strings while the surrounding JSON was perfectly
 * schema-valid, so the payload sailed through validation and posted an
 * empty findings table as if it were a real review. These predicates let
 * callers detect that shape and route to the soft-fail/retry path
 * instead of publishing the hollow output (wiring lands in T10).
 *
 * Semantics:
 *   - Vacuous-truth guard: zero comments → false. A clean 0-finding
 *     review must NOT trigger the soft-fail path.
 *   - `suppressed_comments` are deliberately EXCLUDED — only the
 *     published `comments` array decides.
 */
/**
 * Defense-in-depth coercion: treats any non-string body as effectively
 * empty. The type system guarantees `ProviderComment.body` is `string`,
 * but the soft-fail predicates in this module operate on the parse-result
 * `ProviderReviewPayload` shape — a caller that bypasses the parser (or a
 * future schema relaxation) could surface `null`/`undefined`/numeric bodies
 * that would otherwise throw at the `.trim()` call. Coercing to "" here is
 * cheap and keeps the predicates total.
 */
function bodyIsEffectivelyEmpty(body: unknown): boolean {
  return typeof body !== "string" || body.trim().length === 0;
}

export function hasOnlyEmptyBodyFindings(review: ProviderReviewPayload): boolean {
  return review.comments.length > 0 && review.comments.every(c => bodyIsEffectivelyEmpty(c.body));
}

/**
 * Counts how many comments in the review carry non-whitespace body text.
 *
 * Companion to {@link hasOnlyEmptyBodyFindings} for the same Minimax-M3
 * empty-body incident (waffle-house-menu PR, workflow run 31801055564):
 * callers use it to distinguish "all bodies hollow" from "some bodies
 * survived" when deciding how degraded a parsed review actually is
 * (wiring lands in T10). Pure — no logging, no telemetry.
 */
export function countPopulatedBodies(review: ProviderReviewPayload): number {
  return review.comments.filter(c => !bodyIsEffectivelyEmpty(c.body)).length;
}

export type RequestBody = Record<string, unknown>;

/**
 * Self-healing follow-up prefix prepended to the original user
 * message when the first response could not be parsed as a JSON
 * review payload. The prefix explicitly asks the model to emit
 * JSON-only output (no prose, no fences); the original user
 * content is APPENDED after the prefix so the model still has
 * the PR diff + review instructions to work from.
 *
 * Prepending (rather than replacing) is critical: a prior version
 * replaced `config.user` with just the reminder, which caused the
 * model to fall back to "Reviewer not yet engaged — no code
 * context was provided" because it no longer had the diff to
 * review. That fallback then passed `isNonEmptyReview` (its
 * `summary` field is non-empty), got posted as the actual review
 * with 0 findings, and masked the underlying parse-fail — the
 * operator saw an empty findings table instead of the
 * "raise --max-output-tokens and retry" / "model regression"
 * parse-fail diagnostic. Pinned by PR #20 review screenshot.
 *
 * Some providers ignore `stream: false` and return an empty SSE
 * stream; some wrap their output in markdown fences or prose;
 * some omit the JSON entirely. We retry once with the prefix
 * appended before falling back to the parse-fail surface — that
 * often recovers the review without operator intervention.
 *
 * Shared between `openai-compatible.ts` and `copilot.ts` so the
 * self-healing message stays byte-identical regardless of provider.
 */
export const PARSE_FAIL_RETRY_PROMPT =
  "Your previous response did not contain a valid JSON review payload. " +
  "Please respond with ONLY a JSON object matching this schema (no prose, no fences): " +
  '{"summary": "...", "verdict": "NEEDS_FIX|APPROVED|COMMENT|DISCUSS|SHIP", "comments": [...], "suppressed_comments": [...]}.\n' +
  "Each item in comments and suppressed_comments is an object with exactly these fields: " +
  '"path" (string — the file path from the diff), ' +
  '"line" (integer ≥ 1 — the line in that file the finding applies to), ' +
  '"body" (string — must be a non-empty string explaining the issue; never emit ""), ' +
  '"severity" (string), "category" (string). ' +
  "Do not omit any field and do not leave any body empty.\n\n" +
  "Original review request follows:\n\n";

/**
 * Schema for `response_format` on OpenAI Responses / Chat Completions.
 * Defined in `src/cli/provider-prompts.ts:REVIEW_PAYLOAD_JSON_SCHEMA`
 * and re-exported here for the provider layer's request-body builder.
 * Wire-format strict schemas are NOT a hallucination cure-all — see
 * the "Valid JSON Is Not Correct JSON" caveat in the
 * citation-grounding research — but they close the failure class
 * where the model emits prose-wrapped JSON or path-garbage text.
 */
export type ResponseFormat =
  | { readonly type: "json_object" }
  | {
      readonly type: "json_schema";
      readonly strict: true;
      readonly schema: Record<string, unknown>;
    };

export function buildResponsesBody(
  config: {
    readonly model: string;
    readonly system: string;
    readonly user: string;
    readonly maxOutputTokens?: number;
    readonly reasoningEffort?: "low" | "medium" | "high";
    readonly responseFormat?: ResponseFormat;
  },
  opts?: { readonly userOverride?: string },
): RequestBody {
  // When `userOverride` is set (parse-fail retry), APPEND the original
  // user content so the model retains the PR diff + review instructions.
  // The override prefix asks the model to emit JSON-only output; the
  // trailing original content gives it the actual work. See
  // PARSE_FAIL_RETRY_PROMPT for the why.
  const userContent = opts?.userOverride !== undefined
    ? `${opts.userOverride}${config.user}`
    : config.user;
  const body: Record<string, unknown> = {
    model: config.model,
    input: [
      { role: "system", content: config.system },
      { role: "user", content: userContent },
    ],
  };
  if (config.maxOutputTokens !== undefined) {
    body["max_output_tokens"] = config.maxOutputTokens;
  }
  if (config.reasoningEffort !== undefined) {
    body["reasoning"] = { effort: config.reasoningEffort };
  }
  if (config.responseFormat !== undefined) {
    body["text"] = { format: config.responseFormat };
  }
  return body;
}

export function buildChatBody(
  config: {
    readonly model: string;
    readonly system: string;
    readonly user: string;
    readonly maxOutputTokens?: number;
    readonly reasoningEffort?: "low" | "medium" | "high";
    readonly responseFormat?: ResponseFormat;
  },
  opts?: { readonly userOverride?: string },
): RequestBody {
  // When `userOverride` is set (parse-fail retry), APPEND the original
  // user content so the model retains the PR diff + review instructions.
  // See `buildResponsesBody` + `PARSE_FAIL_RETRY_PROMPT` for the why.
  const userContent = opts?.userOverride !== undefined
    ? `${opts.userOverride}${config.user}`
    : config.user;
  const body: Record<string, unknown> = {
    model: config.model,
    messages: [
      { role: "system", content: config.system },
      { role: "user", content: userContent },
    ],
  };
  if (config.maxOutputTokens !== undefined) {
    body["max_tokens"] = config.maxOutputTokens;
  }
  if (config.reasoningEffort !== undefined) {
    body["reasoning_effort"] = config.reasoningEffort;
  }
  if (config.responseFormat !== undefined) {
    body["response_format"] = config.responseFormat;
  }
  return body;
}

/**
 * Extract the text payload from a provider response. Handles four shapes:
 *   1. SSE stream (responses API output_text.delta / chat completions delta /
 *      generic top-level delta) — concatenates fragments into one string.
 *   2. Plain JSON object (Responses API or Chat Completions) — returns
 *      `output_text` (responses), joins `output[].content[].text`
 *      (responses), or `choices[].message.content` (chat).
 *   3. Raw text — returned verbatim (caller tries to extract a JSON
 *      block from it via `extractJsonBlock`).
 *   4. Empty input — returns `""`.
 *
 * The function does NOT report "unusable" — it always returns SOMETHING
 * (possibly empty) and lets the downstream `parseReviewPayload` plus
 * the CLARITY-10 strict empty-fields check decide whether the result
 * is a valid review. This keeps the public signature stable
 * (`string`, not `string | null`) so existing callers don't need to
 * change their null-handling.
 *
 * History note: an earlier revision returned `string | null` to signal
 * "unusable SSE stream with no text fragments" (CLARITY-10). That
 * approach was reverted in favor of returning the raw SSE text in
 * that case so `parseReviewPayload`'s strict empty-fields check (and
 * the CLARITY-10b soft parse-fail detector) catches the failure as a
 * null return rather than relying on a separate null-handling path
 * in callers.
 */
export function extractTextPayload(endpoint: ProviderEndpoint, rawText: string): string {
  if (rawText.length === 0) {
    return "";
  }

  // 1. SSE stream (input starts with "data:" or "event:" prefix).
  //    Concatenate fragments. If the stream only has metadata events
  //    (no usable text fragments), return the rawText so the
  //    downstream strict-empty-fields check (CLARITY-10) catches
  //    it as a parse failure.
  const trimmedStart = rawText.trimStart();
  if (trimmedStart.startsWith("data:") || trimmedStart.startsWith("event:")) {
    const sseText = tryExtractSse(rawText);
    if (sseText !== null && sseText.length > 0) {
      return sseText;
    }
    // SSE was detected but no usable fragments — return rawText so the
    // empty-fields strict check can fire. (Returning `""` here would
    // cause `parseReviewPayload("")` to return null without the
    // strict-check safeguard.)
    return rawText;
  }

  // 2. Plain JSON object.
  const parsed = tryParseJson(rawText);
  if (parsed !== undefined && isRecord(parsed)) {
    if (endpoint === "responses") {
      const direct = readStringField(parsed, "output_text");
      if (direct !== null && direct.length > 0) {
        return direct;
      }
      const output = readArrayField(parsed, "output");
      if (output !== null) {
        const fromOutput = joinOutputText(output);
        if (fromOutput.length > 0) {
          return fromOutput;
        }
        // The response had an `output[]` array but `joinOutputText`
        // produced nothing — every entry was a reasoning block the
        // parser intentionally skipped. Returning the raw envelope
        // would leak the chain-of-thought prose (stored in the
        // reasoning parts) into the extracted text, which then
        // fails `parseReviewPayload` because the first balanced `{`
        // is inside the reasoning prose. Return empty so the
        // strict-empty-fields check downstream classifies it as
        // a parse failure.
        if (output.length > 0) {
          // Reasoning-fallback: some reasoning-capable providers
          // write a draft of the final review JSON inside their
          // reasoning block, then run out of output budget before
          // emitting it as the formal `output_text` answer. The
          // reasoning can contain MULTIPLE drafts of the review
          // (the model revises as it reasons); we want the LAST
          // valid one, which is the most refined. If we find one,
          // return it so `parseReviewPayload` can produce a real
          // review instead of a parse-fail.
          const recovered = extractLastReviewDraftFromReasoning(output);
          if (recovered !== null) {
            return recovered;
          }
          return "";
        }
      }
      // No `output[]` array at all — fall through to raw text so
      // `parseReviewPayload` can extract a direct review JSON object
      // (model returned `{"summary": ..., "verdict": ...}` outside
      // the Responses API envelope).
    } else {
      // Chat completions.
      const choices = readArrayField(parsed, "choices");
      if (choices !== null) {
        for (const choice of choices) {
          const message = readRecordField(choice, "message");
          if (message === null) continue;
          const content = readStringField(message, "content");
          if (content !== null && content.length > 0) {
            return content;
          }
        }
      }
      // Chat JSON shape but no extractable content — fall through.
    }
  }

  // 3. Raw text (could be plain prose, markdown, or a JSON block
  //    wrapped in ``` fences — `extractJsonBlock` handles the latter).
  return rawText;
}

/**
 * Parse a provider text response into a structured review payload.
 *
 * Returns `null` in three distinct cases:
 *   1. No JSON object found in `text` (plain prose, markdown, or non-JSON
 *      SSE tail — i.e. `extractJsonBlock` yielded nothing parseable).
 *   2. `extractJsonBlock` returned a value that isn't a JSON object
 *      (e.g. a string or array).
 *   3. (CLARITY-10b) The parsed object is structurally valid but its
 *      `summary` matches an apology pattern AND it has zero findings
 *      (no `comments`, no `suppressed_comments`). The model returned a
 *      legitimate-looking JSON wrapper around an apology message; we
 *      treat it as a parse failure so the self-healing retry fires.
 *
 * Callers that need to distinguish the cases (e.g. for different error
 * messages) can use the returned `ProviderReviewPayload` shape to
 * differentiate "structured empty review" (returned, all fields empty)
 * from "no parseable content" (returns null).
 */
export function parseReviewPayload(
  text: string,
  context?: ParseContext,
): ProviderReviewPayload | null {
  const candidate = extractJsonBlock(text);
  if (!isRecord(candidate)) {
    return null;
  }

  const summary = readStringField(candidate, "summary") ?? "";
  const verdict = readStringField(candidate, "verdict") ?? "";
  const comments = readCommentArray(candidate["comments"], context);
  const suppressed_comments = readCommentArray(candidate["suppressed_comments"], context);

  // Soft parse-fail detector (CLARITY-10b): some providers/models return
  // a *structurally valid* JSON wrapper whose contents are an apology
  // ("No diff or file contents were provided to review...", "I cannot
  // review this without...", "Please share the diff..."). These pass
  // the basic `extractJsonBlock` parse AND the strict non-empty check
  // (because `summary` is non-empty) but are functionally equivalent
  // to a parse failure — the model did not produce a review.
  //
  // Surface these as null so the self-healing retry path fires and
  // the parse-fail badge renders, instead of silently posting a
  // 0-finding review that LOOKS clean.
  //
  // Only trigger when there are zero findings (comments + suppressed_comments).
  // A real review with findings but a frustrated summary ("The code looks
  // fine but I noticed one issue...") is legitimate; we don't want to
  // rewrite that as a parse-fail.
  if (
    comments.length === 0 &&
    suppressed_comments.length === 0 &&
    isApologySummary(summary)
  ) {
    return null;
  }

  return { summary, verdict, comments, suppressed_comments };
}

/**
 * True when the raw SSE stream ended before the model emitted the
 * final `response.completed` (or `response.done`) event. Distinguishes
 * "the stream was truncated" from "the stream completed but the JSON
 * inside was malformed". Used by the parse-fail diagnostic so reviewers
 * see "raise --max-output-tokens and retry" instead of a generic
 * "provider response was not valid JSON".
 *
 * Detection walks `data:` lines only (not the raw text), so a review
 * whose comment body happens to contain the literal string
 * `"type":"response.completed"` cannot trick the detector into
 * thinking the stream completed cleanly. Mirrors `tryExtractSse`'s
 * SSE-spec parsing: blank lines separate events, comment lines
 * (`:` prefix) are ignored, and the payload is the substring after
 * `data:` with optional leading space stripped.
 *
 * Edge cases that intentionally return `false`:
 *   - Non-SSE responses (chat-completions, plain JSON): there's no
 *     stream-completion concept for a single-shot response, so
 *     truncation only applies to streaming endpoints. Detected by
 *     absence of any `data:` line.
 *   - Empty rawText: trivially not a truncated stream.
 *   - A response.completed event whose output_text was empty: still
 *     a completed stream, just one whose model output was nothing.
 *     `tryExtractSse` falls back to the delta accumulation in this
 *     case but the stream itself terminated cleanly.
 */
/**
 * Scan SSE `data:` lines for the terminal event-type marker.
 *
 * Walks `rawText` line-by-line and looks only at the JSON payloads
 * inside `data:` lines (not at `event:` header lines or arbitrary
 * text content like review-comment bodies). This is essential because
 * a model reviewing a diff that contains the literal string
 * `"type":"response.completed"` would otherwise match the
 * substring check and trick the parser into thinking the stream
 * completed cleanly. Mirrors the structure-walk pattern used by
 * `tryExtractSse` (above) so the SSE contract is enforced the same
 * way everywhere.
 */
function findSseEventTypeMarker(rawText: string): "response.completed" | "response.done" | null {
  for (const line of rawText.split("\n")) {
    if (!line.startsWith("data:")) {
      continue;
    }
    // Per SSE spec: data: is followed by an optional single space,
    // then the payload. Trim the leading space so the JSON parse
    // (or substring check) sees a clean value.
    const payload = line.slice("data:".length).replace(/^ /u, "");
    if (payload === "" || payload === "[DONE]") {
      continue;
    }
    if (payload.includes('"type":"response.completed"')) {
      return "response.completed";
    }
    if (payload.includes('"type":"response.done"')) {
      return "response.done";
    }
  }
  return null;
}

/**
 * True when the raw SSE stream ended before the model emitted the
 * final `response.completed` (or `response.done`) event. Distinguishes
 * "the stream was truncated" from "the stream completed but the JSON
 * inside was malformed". Used by the parse-fail diagnostic so reviewers
 * see "raise --max-output-tokens and retry" instead of a generic
 * "provider response was not valid JSON".
 *
 * Detection walks `data:` lines only (not the raw text), so a review
 * whose comment body happens to contain the literal string
 * `"type":"response.completed"` cannot trick the detector into
 * thinking the stream completed cleanly. Mirrors `tryExtractSse`'s
 * SSE-spec parsing: blank lines separate events, comment lines
 * (`:` prefix) are ignored, and the payload is the substring after
 * `data:` with optional leading space stripped.
 *
 * Edge cases that intentionally return `false`:
 *   - Non-SSE responses (chat-completions, plain JSON): there's no
 *     stream-completion concept for a single-shot response, so
 *     truncation only applies to streaming endpoints. Detected by
 *     absence of any `data:` line.
 *   - Empty rawText: trivially not a truncated stream.
 *   - A response.completed event whose output_text was empty: still
 *     a completed stream, just one whose model output was nothing.
 *     `tryExtractSse` falls back to the delta accumulation in this
 *     case but the stream itself terminated cleanly.
 */
export function wasResponseStreamTruncated(rawText: string): boolean {
  if (rawText.length === 0) {
    return false;
  }
  // Quick exit for non-SSE responses (chat-completions, plain JSON).
  // Any `data:` line anywhere in the text indicates an SSE stream;
  // single-shot JSON has none.
  if (!rawText.includes("data:")) {
    return false;
  }
  return findSseEventTypeMarker(rawText) === null;
}

/**
 * Extract the terminal-event payload from an SSE stream. Walks
 * `data:` lines, parses each as JSON, and returns the FIRST parsed
 * payload whose `type` field is `response.completed` or
 * `response.done`. Returns `undefined` if no terminal event was
 * emitted or if every data: line fails to parse.
 *
 * Scoping the search to the SSE event stream (rather than searching
 * the raw text) is essential: a model reviewing a diff that contains
 * a `"usage":` literal would otherwise pick up the wrong value.
 */
function extractTerminalEventPayload(rawText: string): Record<string, unknown> | undefined {
  for (const line of rawText.split("\n")) {
    if (!line.startsWith("data:")) {
      continue;
    }
    const payload = line.slice("data:".length).replace(/^ /u, "");
    if (payload === "" || payload === "[DONE]") {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      continue;
    }
    if (!isRecord(parsed)) continue;
    const eventType = parsed["type"];
    if (eventType === "response.completed" || eventType === "response.done") {
      return parsed;
    }
  }
  return undefined;
}

/**
 * Extract a `ProviderUsage` subset from the raw SSE stream's terminal
 * `response.completed` event's `usage` block. Returns `undefined` when
 * the stream was truncated (no completed event) or when the provider
 * didn't emit a usage block. Used by the token-headroom warning so
 * operators can see whether the model filled its `max_output_tokens`
 * budget when a parse-fail occurs.
 *
 * Scoping: the usage block is read from the terminal event's PARSED
 * JSON payload — not from a raw `indexOf('"usage":')` substring scan
 * over the whole rawText. This avoids picking up usage-like JSON
 * from intermediate events, model review-content bodies that happen
 * to contain `"usage":`, or any other unrelated occurrence.
 */
export function parseProviderUsage(rawText: string): ProviderUsage | undefined {
  const terminalEvent = extractTerminalEventPayload(rawText);
  if (terminalEvent === undefined) {
    return undefined;
  }
  const usageRaw = terminalEvent["usage"];
  if (!isRecord(usageRaw)) {
    return undefined;
  }
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let totalTokens: number | undefined;
  if (typeof usageRaw["input_tokens"] === "number") inputTokens = usageRaw["input_tokens"];
  if (typeof usageRaw["output_tokens"] === "number") outputTokens = usageRaw["output_tokens"];
  if (typeof usageRaw["total_tokens"] === "number") totalTokens = usageRaw["total_tokens"];
  if (inputTokens === undefined && outputTokens === undefined && totalTokens === undefined) {
    return undefined;
  }
  return {
    ...(inputTokens !== undefined ? { input_tokens: inputTokens } : {}),
    ...(outputTokens !== undefined ? { output_tokens: outputTokens } : {}),
    ...(totalTokens !== undefined ? { total_tokens: totalTokens } : {}),
  };
}

/**
 * Structured outcome of classifying a parse-failed provider response.
 * `truncated` is true when the stream ended without a
 * `response.completed` event; `usage` carries the model's token
 * usage when the terminal event emitted one (otherwise undefined).
 *
 * Both providers (openai-compatible and Copilot) emit the same shape
 * here so the parse-fail diagnostic can render a single
 * reason-specific message regardless of which provider produced the
 * failure. See `diagnoseParseFailure` for the consumer-facing helper.
 */
export type ParseFailureDiagnosis = {
  readonly truncated: boolean;
  readonly usage: ProviderUsage | undefined;
};

/**
 * Combined truncation-detection + usage-extraction helper. Returns
 * the diagnosis that callers attach to the ProviderError so the
 * parse-fail diagnostic can render a reason-specific headline.
 *
 * Both `openai-compatible.ts` and `copilot.ts` use this helper
 * instead of duplicating the inline `wasResponseStreamTruncated` +
 * `parseProviderUsage` block. Keeping the logic in one place means
 * the "what counts as truncated" contract is enforced uniformly
 * across providers. (See the self-review finding on
 * `src/provider/openai-compatible.ts:263` for the duplication
 * rationale.)
 *
 * Note: this helper does NOT emit the headroom `::warning::` line
 * that was in the prior inline duplicate. That warning required
 * BOTH `truncated === true` AND a populated `usage.output_tokens`,
 * but `parseProviderUsage` only reads usage from the terminal event
 * — and a stream with the terminal event is by definition NOT
 * truncated. The combination is unreachable in practice; the
 * warning was dead code. If a future provider emits usage on
 * intermediate events, the warning should be re-introduced via a
 * dedicated `parseIntermediateUsage` helper.
 */
export function diagnoseParseFailure(input: {
  readonly rawText: string;
}): ParseFailureDiagnosis {
  const truncated = wasResponseStreamTruncated(input.rawText);
  const usage = parseProviderUsage(input.rawText);
  return { truncated, usage };
}

/**
 * Pattern match for "the model couldn't actually review the input" apology
 * summaries. These are NOT real reviews even when wrapped in valid JSON.
 *
 * Matched phrases (case-insensitive, whole-word where reasonable):
 *   - "no diff" / "no file contents" / "no contents were provided"
 *   - "please share" / "please provide" / "please send"
 *   - "i cannot" / "i'm unable" / "i am unable" / "i can not"
 *   - "cannot review" / "unable to review" / "can't review"
 *   - "did not receive" / "haven't received" / "no input"
 *
 * The match is intentionally narrow — it must look like the model is
 * telling us *it* failed to receive input, not commenting on the code.
 * Phrases like "no issues found" or "nothing to flag" are deliberately
 * excluded — those are legitimate clean-review signals.
 */
function isApologySummary(summary: string): boolean {
  if (summary.length === 0) {
    return false;
  }
  const lower = summary.toLowerCase();
  // Most common patterns from the 3e62237 self-review incident.
  // Each pattern is anchored narrowly to avoid over-matching legitimate
  // clean-review summaries that happen to contain "cannot" or "review"
  // in other contexts (e.g. "I cannot find any issues to review").
  const APOLOGY_PATTERNS: readonly RegExp[] = [
    // "no diff / file contents were provided / shared / available" — direct form.
    /\bno\s+(diff|file\s+contents?|contents?)\b.*\b(provided|shared|available|supplied)\b/u,
    // "no [pull request | pr | file] diff was provided" — the model often
    // adds "pull request" / "pr" / "file" between "no" and "diff" before
    // reaching the apology verb. Live evidence (PR self-review at
    // 2026-07-06T22:08Z): "No pull request diff was provided in the
    // request, so no review can be produced." — the narrow `no\s+(diff|...)`
    // pattern above misses this. This broadened pattern matches any
    // "no <modifier>* diff/file/contents ... <apology verb>" form.
    /\bno\s+(?:pull\s+request\s+|pr\s+|file\s+|the\s+|any\s+)*(?:diff|file\s+contents?|contents?)\b.*\b(provided|shared|available|supplied|received)\b/u,
    // "please share / provide / send the diff / file / pull request"
    /\bplease\s+(share|provide|send)\s+(the\s+)?(diff|file|pull\s+request|pr)\b/u,
    // "I cannot / can't review this / it / the PR" — narrow to the
    // direct-object-after-verb pattern so "I cannot find issues to
    // review" does NOT match. Requires the verb (cannot/can't/etc.)
    // immediately followed by review + determiner (this/it/the/a).
    /\bi\s+(cannot|can'?t|am\s+unable|i'?m\s+unable)\s+review\s+(this|it|the|a|that)\b/u,
    // "cannot / can't / unable to review" — REQUIRES a direct object
    // (this/it/the/a/that/self) so "Cannot review the legacy code" or
    // "unable to review itself" do NOT match (those are legitimate
    // reviews describing what the model CAN or CANNOT do in context).
    /\b(cannot|can'?t|unable\s+to)\s+review\s+(this|it|the|a|that|self)\b/u,
    // "didn't / haven't received" or "no input"
    /\b(didn'?t\s+receive|haven'?t\s+received|no\s+input)\b/u,
    // "empty diff" or "without diff / input"
    /\b(empty\s+diff|no\s+diff\s+to\s+review|without\s+(diff|input))\b/u,
    // "the diff is empty, nothing to review" / "was empty... review"
    /\b(is\s+empty|was\s+empty)\b.*\b(nothing|to\s+review)\b/u,
    // "nothing to review"
    /\bnothing\s+to\s+review\b/u,
  ];
  for (const pattern of APOLOGY_PATTERNS) {
    if (pattern.test(lower)) {
      return true;
    }
  }
  return false;
}

/**
 * Walks the OpenAI Responses API `output[]` array and concatenates all
 * text fragments it finds. The Responses API puts output items under
 * `content[]` as an array of parts (each part is `{type, text}` or
 * `{type, image_url}` etc) — so this function recurses into content
 * arrays and pulls out any `text` strings, in order.
 *
 * Accepts both the Responses API shape (`content: [{type, text}]`)
 * and a simpler chat-style shape (`content: {text: "..."}`) for
 * providers that return the latter.
 */
function joinOutputText(output: readonly unknown[]): string {
  const fragments: string[] = [];
  for (const entry of output) {
    if (!isRecord(entry)) {
      continue;
    }
    const content = entry["content"];
    // Responses API: content is an array of parts.
    if (Array.isArray(content)) {
      for (const part of content) {
        if (!isRecord(part)) {
          continue;
        }
        // The Responses API puts reasoning content in a separate
        // `type: "reasoning_text"` part. Including it would concat
        // 100+ KB of chain-of-thought prose ahead of the final JSON
        // answer and break `parseReviewPayload` (the first balanced
        // `{` is in the reasoning prose, not the real output). Skip
        // any part whose type is in the reasoning family — the
        // `output_text` (or untyped) parts are the actual review.
        const partType = part["type"];
        if (typeof partType === "string" && partType.includes("reasoning")) {
          continue;
        }
        const text = part["text"];
        if (typeof text === "string") {
          fragments.push(text);
        }
      }
      continue;
    }
    // Chat-style: content is a single object with a text field.
    if (isRecord(content)) {
      const contentType = content["type"];
      if (typeof contentType === "string" && contentType.includes("reasoning")) {
        continue;
      }
      const text = content["text"];
      if (typeof text === "string") {
        fragments.push(text);
      }
    }
  }
  return fragments.join("\n");
}

/**
 * Some reasoning-capable providers write a draft of the final
 * review JSON inside their reasoning block — the model narrates
 * "let me write the JSON: ```json\n{...}\n```" as part of its
 * chain-of-thought — then runs out of the output budget before the
 * formal `output_text` field gets emitted. The response.completed
 * envelope then has `output[]` containing only reasoning entries,
 * and the actual review is recoverable only from inside the
 * reasoning text.
 *
 * The reasoning can contain MULTIPLE drafts (the model revises its
 * own answer as it reasons). We want the LAST valid review-shaped
 * JSON object — that's the most refined version, closest to what
 * the model would have emitted.
 *
 * Returns the JSON string (the contents of the last ```json fenced
 * block that parses as a review) or `null` if no valid draft is
 * found. The returned string is the raw JSON, which downstream
 * `parseReviewPayload` will re-parse and validate.
 */
function extractLastReviewDraftFromReasoning(
  output: readonly unknown[],
): string | null {
  let lastDraft: string | null = null;
  for (const entry of output) {
    if (!isRecord(entry)) continue;
    const content = entry["content"];
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!isRecord(part)) continue;
      const partType = part["type"];
      if (typeof partType === "string" && !partType.includes("reasoning")) {
        // Not a reasoning part — skip.
        continue;
      }
      const text = part["text"];
      if (typeof text !== "string") continue;
      // Scan this reasoning block for fenced JSON objects.
      // The model uses ```json, ```typescript, or just ``` fences.
      // The opener accepts any language tag (or none); the body is
      // captured up to the next ``` closer. Bodies that don't start
      // with `{` (code snippets, typescript signatures, plain prose)
      // are skipped — only review-shaped JSON objects are kept.
      const fenceRe = /```[a-zA-Z0-9_+\-]*\s*\n([\s\S]*?)\n```/gu;
      let m: RegExpExecArray | null;
      while ((m = fenceRe.exec(text)) !== null) {
        const body = m[1]?.trim() ?? "";
        if (!body.startsWith("{")) continue;
        try {
          const parsed = JSON.parse(body);
          if (!isRecord(parsed)) continue;
          // Must look like a review: has summary or verdict or comments.
          if (
            "summary" in parsed ||
            "verdict" in parsed ||
            "comments" in parsed
          ) {
            lastDraft = body;
          }
        } catch {
          // Not valid JSON — skip; the model often writes
          // partial JSON in its thinking that doesn't parse.
        }
      }
    }
  }
  return lastDraft;
}

/** Defensively parse a raw suggestion object from provider JSON. Returns undefined on any structural issue. */
function parseRawSuggestion(value: unknown): { readonly rawSuggestion?: import("../review/suggestion.js").RawSuggestion } {
  if (value === undefined || value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const obj = value as Record<string, unknown>;
  const replacement = obj["replacement"];
  const originalTextHash = obj["originalTextHash"];
  const endLine = obj["endLine"];
  if (typeof replacement !== "string" || typeof originalTextHash !== "string") {
    return {};
  }
  const raw: import("../review/suggestion.js").RawSuggestion = {
    replacement,
    originalTextHash,
    ...(typeof endLine === "number" ? { endLine } : {}),
  };
  return { rawSuggestion: raw };
}

/** Defensively parse a raw remediation object from provider JSON. Returns undefined on any structural issue. */
function parseRawRemediation(value: unknown): { readonly rawRemediation?: import("../review/suggestion.js").RemediationBuildInput } {
  if (value === undefined || value === null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const obj = value as Record<string, unknown>;
  const objective = obj["objective"];
  const targetPath = obj["targetPath"];
  const targetAnchor = obj["targetAnchor"];
  if (typeof objective !== "string" || typeof targetPath !== "string" || typeof targetAnchor !== "string") {
    return {};
  }
  const constraints = Array.isArray(obj["constraints"])
    ? (obj["constraints"] as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  const verificationCommands = Array.isArray(obj["verificationCommands"])
    ? (obj["verificationCommands"] as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  return {
    rawRemediation: { objective, targetPath, targetAnchor, constraints, verificationCommands },
  };
}

/**
 * Ordered body-key fallback chain. Providers occasionally emit the finding
 * text under a synonym of `body`; without this chain those findings land
 * with an empty body and post as empty inline comments.
 *
 * A key wins only when it holds a trim-nonempty string — fallthrough is
 * triggered by a missing, non-string, or whitespace-only value. A
 * populated canonical `body` therefore always wins outright.
 */
const BODY_KEY_ALIAS_ORDER = ["body", "description", "message", "comment", "issue", "detail"] as const;

function readBodyWithAlias(entry: Record<string, unknown>, commentIndex: number): { readonly body: string } {
  for (const key of BODY_KEY_ALIAS_ORDER) {
    const value = readStringField(entry, key);
    if (value !== null && value.trim().length > 0) {
      if (key !== "body") {
        getActiveParseObservationSink()?.({ kind: "body-alias", field: key, commentIndex });
      }
      return { body: value };
    }
  }
  return { body: "" };
}

function readCommentArray(
  value: unknown,
  context?: ParseContext,
): readonly ProviderComment[] {
  if (!isUnknownArray(value)) {
    return [];
  }
  // Prefer an explicit context; fall back to the ambient module-singleton
  // sink so live-provider.ts can install a sink once per request without
  // threading it through every parseReviewPayload call site.
  const effectiveSink = context?.sink ?? getActiveSeveritySink() ?? undefined;
  const effectiveProviderName = context?.providerName;
  const comments: ProviderComment[] = [];
  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      return;
    }
    const path = entry["path"];
    const line = readSafeIntegerField(entry, "line");
    if (typeof path === "string" && line !== null) {
      const { body } = readBodyWithAlias(entry, index);
      comments.push({
        path,
        line,
        body,
        // Pass body so body-scoped rules (security + hardening/leak
        // heuristics) can distinguish a hardening tip from an active
        // leak. Without body, normalizeProviderSeverity falls back to
        // the severity-only mapping (security → high).
        //
        // The sink + providerName + commentIndex options let the caller
        // (live-provider.ts via the ambient sink; tests via explicit
        // options) observe malformed severity values per-comment.
        severity: normalizeProviderSeverity(
          readStringField(entry, "severity"),
          body,
          // exactOptionalPropertyTypes: omit undefined keys so the call
          // is assignable to the strict optional types in
          // `normalizeProviderSeverity`'s third parameter.
          effectiveSink !== undefined || effectiveProviderName !== undefined
            ? {
                ...(effectiveSink !== undefined && { sink: effectiveSink }),
                ...(effectiveProviderName !== undefined && { providerName: effectiveProviderName }),
                commentIndex: index,
              }
            : { commentIndex: index },
        ),
        category: readStringField(entry, "category") ?? "general",
        ...(parseRawSuggestion(entry["suggestion"]) ?? {}),
        ...(parseRawRemediation(entry["remediation"]) ?? {}),
      });
    }
  });
  return comments;
}

/**
 * Normalize a provider-emitted severity string to one of our canonical
 * scale values (`low | medium | high | critical | info`).
 *
 * Different providers use different scales — OpenAI-style models tend to
 * emit `low | medium | high`, Sonar-style models emit `info | minor |
 * major | critical | blocker`, Copilot-style emits similar. Without
 * normalization, an unknown severity falls through to the catch-all
 * `"medium"` default in `readCommentArray` — which bypasses the
 * `minimum-severity` threshold (default `medium`) and posts the finding
 * inline even when the user has configured a stricter filter.
 *
 * Mapping (severity-only, no body):
 *   - `info`     → `info`
 *   - `nit`      → `info`     (style nit, below `low`)
 *   - `minor`    → `low`      (Sonar minor ≈ our low)
 *   - `low`      → `low`
 *   - `major`    → `medium`   (Sonar major ≈ our medium)
 *   - `medium`   → `medium`
 *   - `high`     → `high`
 *   - `critical` → `critical`
 *   - `blocker`  → `critical` (Sonar blocker ≈ our critical)
 *   - `security` → see body-scoped rules below
 *   - `leak`     → `critical` (leaked secrets are always the highest
 *                              severity class — no hardening-tip
 *                              ambiguity here)
 *   - anything else → `medium` (preserves prior default behavior)
 *
 * Body-scoped rules for `security` (when a body is provided):
 *   - body matches HARDENING_HINT_PATTERN ("consider adding a CSP",
 *     "rate limiting", etc.) → `high` (it's a hardening tip, not a
 *     current vulnerability — let the user's threshold filter it if
 *     they want)
 *   - body matches LEAK_INDICATOR_PATTERN ("secret", "credential",
 *     "token", "API key", "password") → `critical` (active leak, must
 *     survive any threshold)
 *   - anything else → `high` (default for `security` severity when body
 *     doesn't indicate either hardening or active leak)
 *
 * Rationale for body-scoped rules: a provider that emits severity:
 * "security" for a low-severity hardening tip ("consider adding a CSP
 * header") would bypass the user's minimum-severity: critical filter
 * and post a non-critical finding inline. Body-scoped scoping lets the
 * mapping distinguish "this is a hardening tip" from "this is an active
 * leak" using the comment's textual content.
 *
 * Unknown-but-non-empty values now get a sensible rank instead of the
 * catch-all `medium`. The `minimum-severity` threshold then does its job
 * correctly: a `nit` becomes `info` (rank 0) and is filtered out under
 * `minimum-severity: medium` (rank 2).
 */

/** Patterns that indicate a low-severity hardening tip, not an active vulnerability. */
const HARDENING_HINT_PATTERN = /\b(consider\s+add(?:ing)?|suggest(?:ed|s)?\s+(?:adding|using)|you\s+(?:may|might|should)\s+want\s+to|harden(?:ing)?|best\s+practice)\b/iu;

/** Patterns that indicate an active secret leak or credential exposure. */
const LEAK_INDICATOR_PATTERN = /\b(secret|credential|token|api[\s_-]?key|password|private[\s_-]?key|exposed|leaked|disclosed|committed\s+by\s+accident)\b/iu;

export function normalizeProviderSeverity(
  value: string | null,
  body?: string | null,
  options?: {
    readonly sink?: SeverityWarningSink;
    readonly providerName?: string;
    readonly commentIndex?: number;
  },
): string {
  const sink = options?.sink;
  // Build the context object explicitly so undefined keys are omitted
  // (required by exactOptionalPropertyTypes: `providerName?: string`
  // does not accept the value `undefined`, only the key's absence).
  const context: SeverityWarningContext = options?.providerName !== undefined
    ? { providerName: options.providerName, commentIndex: options.commentIndex ?? -1 }
    : { commentIndex: options?.commentIndex ?? -1 };

  if (value === null || value.length === 0) {
    // Empty/null: silently fall back to "medium" WITHOUT emitting a
    // warning. Rationale: many live providers (notably GitHub Copilot)
    // routinely omit the `severity` field entirely. Warning on every
    // omitted field would multiply to one warning per finding (50+ per
    // review) and bury any genuinely-unrecognized-value warnings in
    // noise. Operators can still surface empty-severity warnings via
    // the ambient sink's debug channel — the raw `rawValue` is `""`
    // for empty/null, distinguishable from `unrecognized string`.
    return "medium";
  }
  const lower = value.toLowerCase();
  switch (lower) {
    case "info":
    case "nit":
      return "info";
    case "minor":
    case "low":
      return "low";
    case "major":
    case "medium":
      return "medium";
    case "high":
      return "high";
    case "critical":
    case "blocker":
      return "critical";
    case "leak":
      // Leaked secrets are always critical — no hardening-tip ambiguity.
      return "critical";
    case "security":
      // Body-scoped: hardening tips stay at high; active leaks escalate
      // to critical. When no body is provided, default to high (the
      // conservative choice that lets the user's threshold filter).
      if (body !== undefined && body !== null && body.length > 0) {
        if (LEAK_INDICATOR_PATTERN.test(body)) {
          return "critical";
        }
        if (HARDENING_HINT_PATTERN.test(body)) {
          return "high";
        }
      }
      return "high";
    default:
      // Unknown severity — preserve previous fallback to "medium" so
      // the run does not crash, but warn so operators see the misbehavior.
      emitSeverityWarning(value, "medium", context, sink);
      return "medium";
  }
}

/**
 * Some OpenAI-compatible gateways ignore `stream: false` and always
 * return Server-Sent Events. Detect the SSE format and concatenate text
 * fragments from all chunks into a single string.
 *
 * Handles the SSE formats we've observed in the wild:
 *   1. /chat/completions streaming: `choices[].delta.content`
 *   2. /responses streaming with top-level `delta` string (some non-OpenAI
 *      providers use this variant)
 *   3. OpenAI /responses streaming with nested events:
 *        event: response.output_text.delta
 *        data: {"type":"response.output_text.delta","delta":"fragment"}
 *      We extract the inner `delta` field regardless of the wrapping key.
 *   4. /responses streaming where the final `response.completed` event
 *      contains the full `output[]` array (some providers only send the
 *      done-event with output and skip the per-fragment deltas). When we
 *      see a `response.completed` event, we extract `output_text` from
 *      the inner `response` and prefer it over fragment accumulation.
 *
 * Returns the concatenated text if any fragment was found, or null if
 * the input wasn't SSE or no text fragments were extractable. The caller
 * (`extractTextPayload`) then falls back to plain-JSON parsing.
 */
function tryExtractSse(rawText: string): string | null {
  const trimmed = rawText.trim();
  // Detect SSE format: either starts with "data:" or "event:" (some providers
  // prepend event: lines before data: lines).
  if (!trimmed.startsWith("data:") && !trimmed.startsWith("event:")) {
    return null;
  }

  const fragments: string[] = [];
  let completedResponseText: string | null = null;

  // Group the input into events separated by blank lines, then within each
  // event concatenate the data: lines per the SSE spec ("If the line starts
  // with data:, the rest of the line after the colon is the data. If the
  // line is just data:, the data is an empty string. Multiple data: lines
  // in the same event are concatenated with newlines."). This handles the
  // case where an SSE encoder wrote a JSON-encoded data line that contains
  // a literal newline character — splitting that into separate "data:" lines
  // would lose the trailing portion of the JSON payload.
  const events: string[][] = [[]];
  for (const line of trimmed.split("\n")) {
    if (line.trim() === "") {
      if (events[events.length - 1]!.length > 0) {
        events.push([]);
      }
      continue;
    }
    events[events.length - 1]!.push(line);
  }

  for (const eventLines of events) {
    // Concatenate all data: lines in this event with newlines (per SSE spec).
    const dataLines: string[] = [];
    for (const line of eventLines) {
      if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length));
      }
    }
    if (dataLines.length === 0) {
      continue;
    }
    // Per SSE spec: data segments are joined with a single newline. Leading
    // space after "data:" is stripped if present (some encoders add it).
    const payload = dataLines.map((d) => d.startsWith(" ") ? d.slice(1) : d).join("\n").trim();
    if (payload === "" || payload === "[DONE]") {
      continue;
    }

    const parsed = tryParseJson(payload);
    if (!isRecord(parsed)) {
      continue;
    }

    // /responses streaming (OpenAI Responses API format):
    //   event: response.output_text.delta
    //   data: {"type":"response.output_text.delta","delta":"fragment"}
    // The delta may live at the top level OR inside a wrapped envelope
    // depending on the provider. Try the wrapped form first since it's
    // the canonical OpenAI Responses API shape.
    const wrappedResponse = readRecordField(parsed, "response");
    if (wrappedResponse !== null) {
      const eventType = readStringField(parsed, "type");
      // Skip reasoning-text deltas entirely. Some providers emit
      // `response.reasoning_text.delta` events
      // alongside the final answer. Concat-ing them into `fragments`
      // would prepend 100+ KB of chain-of-thought prose ahead of the
      // JSON review, breaking `parseReviewPayload` (the first
      // balanced `{` would be inside the reasoning prose). The actual
      // review text is in `response.output_text.delta` and the final
      // `response.completed` event.
      if (typeof eventType === "string" && eventType.includes("reasoning")) {
        continue;
      }
      if (eventType === "response.completed" || eventType === "response.done") {
        // Final event: prefer the full response payload if it has output_text.
        const outText = readStringField(wrappedResponse, "output_text");
        if (outText !== null && outText.length > 0) {
          completedResponseText = outText;
        } else {
          // Fall back to joining output[] entries.
          const output = readArrayField(wrappedResponse, "output");
          if (output !== null) {
            const joined = joinOutputText(output);
            if (joined.length > 0) {
              completedResponseText = joined;
            }
          }
        }
        continue;
      }
      if (eventType === "response.output_text.delta" || eventType === "response.delta") {
        const deltaText = readStringField(parsed, "delta");
        if (deltaText !== null) {
          fragments.push(deltaText);
        }
        continue;
      }
    }

    // /chat/completions streaming: choices[].delta.content
    const choices = readArrayField(parsed, "choices");
    if (choices !== null) {
      for (const choice of choices) {
        const delta = readRecordField(choice, "delta");
        if (delta !== null) {
          const content = readStringField(delta, "content");
          if (content !== null) {
            fragments.push(content);
          }
        }
      }
      continue;
    }

    // /responses streaming (alternative non-OpenAI variant): top-level delta
    // string directly on the JSON object. Skip reasoning deltas — they
    // are chain-of-thought prose, not part of the final review payload.
    const topLevelType = readStringField(parsed, "type");
    if (typeof topLevelType === "string" && topLevelType.includes("reasoning")) {
      continue;
    }
    const deltaText = readStringField(parsed, "delta");
    if (deltaText !== null) {
      fragments.push(deltaText);
    }
  }

  // Prefer the completed-response text (full output) over accumulated
  // fragments — but ONLY if the completed text looks like real content.
  //
  // Some providers emit a `response.completed` event whose `output[]` carries
  // a stub/placeholder string (e.g. "placeholder", the model wrapper
  // metadata, or just the prompt echo) — and the real review text only
  // appears in the per-fragment `response.output_text.delta` events.
  //
  // If we naively prefer the placeholder, `extractTextPayload` returns the
  // placeholder and `parseReviewPayload` cannot extract a review from it,
  // producing a parse-fail surface.
  //
  // Resolution: prefer the completed text only when it is "non-stub" OR
  // when no delta fragments were collected (i.e. the completed event is
  // the only source of truth). When deltas exist and the completed text
  // looks like a stub, fall back to the deltas.
  if (completedResponseText !== null) {
    const onlySource = fragments.length === 0;
    if (onlySource || !isStubCompletedText(completedResponseText)) {
      return completedResponseText;
    }
  }
  return fragments.length > 0 ? fragments.join("") : null;
}

/**
 * Heuristic: detect a `response.completed` `output_text` value that is
 * a stub/placeholder rather than the real review text.
 *
 * Triggers (returns true → caller falls back to delta concatenation):
 *   - Empty string
 *   - String shorter than 8 characters (real reviews are at minimum
 *     `{"summary":"x"}` ≈ 16 chars; provider stubs are usually < 8)
 *   - String that doesn't contain a `{` (the opening of a JSON object —
 *     a stub like "placeholder" or the model wrapper's prompt echo
 *     rarely contains a `{`)
 *
 * This is intentionally permissive: false positives (treating a real
 * short review as a stub) are rare because real reviews always contain
 * `{`. The test suite in `test/unit/azure-thread-589-repro.test.ts`
 * pins the behavior end-to-end with a captured production failure mode
 * (`response.completed` stub "placeholder").
 */
function isStubCompletedText(text: string): boolean {
  if (text.length === 0) return true;
  if (text.length < 8) return true;
  if (!text.includes("{")) return true;
  return false;
}

/**
 * Dynamically detect provider-error responses that arrive as HTTP 200
 * with a structurally valid JSON body but carry NO actual model output.
 * These are the most dangerous failure class because the existing
 * "parse failed" path treats them as genuine parse failures — posting
 * a COMMENT review with zero findings and exiting 0, so CI sees green
 * even though the model never ran.
 *
 * Provider-agnostic detection signals (any ONE suffices):
 *
 *   1. **Zero-usage signal**: The response JSON has a `usage` block
 *      where `input_tokens === 0` AND `output_tokens === 0` (and
 *      `total_tokens === 0` when present). A real model invocation
 *      always consumes at least 1 input token. This is the strongest
 *      signal because it comes directly from the provider's billing
 *      layer — routers, proxies, and gateways that fail to route the
 *      request still report zero usage because no model was called.
 *
 *      IMPORTANT: `usage` must be READ FROM the response JSON
 *      (top-level or inside the SSE terminal event), not from the
 *      `ProviderError.usage` field, which only carries usage from
 *      the terminal SSE event. A non-SSE provider error (plain JSON
 *      HTTP 200) would have usage on the top-level JSON object and
 *      nowhere else.
 *
 *   2. **Error-doc-URL signal**: The response text contains a
 *      documentation URL with an error-code path
 *      (`/docs/errors/R101`, `/docs/errors/`, `/help/error/`). This
 *      is common across LLM routers and custom gateways, which link to
 *      their error documentation.
 *
 *   3. **Error-envelope signal**: The response JSON has an `error`
 *      object or `errors` array at the top level with `type`/`message`/
 *      `code` fields. This is the standard shape for JSON-API errors
 *      (RFC 7807, JSON:API spec) and is used by every major API
 *      gateway when the request reaches the server but cannot be
 *      processed (bad model name, no route configured, quota exceeded).
 *
 *   4. **Zero-output + zero-usage fallback**: Response has
 *      `output_text: ""` or `output: []` (empty output) AND
 *      zero-usage. This catches providers that return a valid response
 *      envelope but with no actual model output — the "connected but
 *      no providers" case.
 *
 * IMPORTANT: The function intentionally does NOT match on branded
 * error labels or phrases like "model not supported" — those are
 * provider-specific and would miss new providers. The four signals
 * above are structural and work for any provider.
 *
 * Non-triggers (intentionally):
 *   - A response with `output_tokens > 0` is never a provider error
 *     (the model ran and produced output, even if the output is
 *     garbage — that's a parse failure, not a provider error).
 *   - A response with no `usage` block at all is ambiguous (some
 *     providers omit usage on streaming responses) — we only trigger
 *     when usage IS present and IS all-zeros.
 *   - A response with a valid review JSON (summary + comments) is
 *     never a provider error regardless of usage.
 */
export function detectProviderError(rawText: string): ProviderErrorDetails | null {
  if (rawText.length === 0) {
    return null;
  }

  // Try parsing the raw text as JSON. If it's not JSON, fall through
  // to the text-signal checks (error-doc URLs in plain text).
  const parsed = tryParseJson(rawText);
  if (parsed !== undefined && isRecord(parsed)) {
    // Signal 1: error-envelope at the top level.
    const errorDetails = checkErrorEnvelope(parsed);
    if (errorDetails !== null) {
      return errorDetails;
    }

    // Signal 2: zero-usage with no output (or empty output).
    const zeroUsage = checkZeroUsage(parsed);
    if (zeroUsage !== null) {
      // If the response also has actual review content, this is NOT
      // a provider error — some routers emit zero usage on cached
      // responses. The review content check prevents a false positive.
      const hasReviewContent = checkHasReviewContent(parsed);
      if (!hasReviewContent) {
        return zeroUsage;
      }
    }
  }

  // Signal 3: error-doc-URL in the raw text (works for both JSON and
  // non-JSON responses — some providers return plain text error messages).
  const docUrlSignal = checkErrorDocUrl(rawText);
  if (docUrlSignal !== null) {
    return docUrlSignal;
  }

  return null;
}

/**
 * Check for a top-level `error` object or `errors` array in the JSON
 * response. This is the standard JSON-API error shape used by gateways,
 * routers, and proxies when the request reaches the server but cannot
 * be processed.
 */
function checkErrorEnvelope(
  parsed: Record<string, unknown>,
): ProviderErrorDetails | null {
  // Single `error` object (RFC 7807 / common shape).
  const errorField = parsed["error"];
  if (isRecord(errorField)) {
    const message =
      readStringField(errorField, "message") ??
      readStringField(errorField, "type") ??
      readStringField(errorField, "code") ??
      "Provider returned an error envelope.";
    return {
      kind: "error-envelope",
      message,
      ...(readStringField(errorField, "type") !== null
        ? { detail: `type: ${readStringField(errorField, "type")}` }
        : {}),
    };
  }

  // `errors` array (JSON:API spec shape).
  const errorsField = parsed["errors"];
  if (isUnknownArray(errorsField) && errorsField.length > 0) {
    const first = errorsField[0];
    if (isRecord(first)) {
      const message =
        readStringField(first, "message") ??
        readStringField(first, "detail") ??
        readStringField(first, "title") ??
        "Provider returned an errors array.";
      return {
        kind: "error-envelope",
        message,
      };
    }
  }

  return null;
}

/**
 * Check for a `usage` block where all token counts are zero. This
 * means no model was invoked — a dead giveaway for router/proxy
 * misconfiguration.
 *
 * Checks both top-level `usage` (non-SSE JSON responses) and
 * `response.usage` (SSE terminal event envelope). Does NOT use the
 * `ProviderError.usage` field because that only carries usage from
 * the terminal SSE event and would miss non-SSE responses.
 */
function checkZeroUsage(
  parsed: Record<string, unknown>,
): ProviderErrorDetails | null {
  const usage = readUsageBlock(parsed);
  if (usage === null) {
    return null;
  }

  const input = usage["input_tokens"];
  const output = usage["output_tokens"];
  const total = usage["total_tokens"];

  // Only trigger when usage IS present and ALL fields are zero (or
  // the only present field is zero). A missing usage block is NOT a
  // signal (some providers omit it); a partial-usage block with at
  // least one non-zero field is NOT a signal (the model ran).
  const hasAnyField =
    input !== undefined || output !== undefined || total !== undefined;
  if (!hasAnyField) {
    return null;
  }

  const allZero =
    (input === undefined || input === 0) &&
    (output === undefined || output === 0) &&
    (total === undefined || total === 0);

  if (allZero) {
    return {
      kind: "zero-usage",
      message: "Provider reported zero token usage — no model was invoked. Check provider configuration and API key.",
    };
  }

  return null;
}

/**
 * Read the `usage` block from a parsed JSON response. Checks both
 * top-level `usage` (non-SSE JSON) and `response.usage` (SSE
 * terminal-event envelope shape where the full response is wrapped
 * inside a `response` key).
 */
function readUsageBlock(
  parsed: Record<string, unknown>,
): Record<string, unknown> | null {
  // Top-level usage (non-SSE JSON response).
  const topLevelUsage = readRecordField(parsed, "usage");
  if (topLevelUsage !== null) {
    return topLevelUsage;
  }
  // SSE terminal-event envelope: { response: { ... usage: { ... } } }.
  const responseField = readRecordField(parsed, "response");
  if (responseField !== null) {
    const nestedUsage = readRecordField(responseField, "usage");
    if (nestedUsage !== null) {
      return nestedUsage;
    }
  }
  return null;
}

/**
 * Check whether the parsed JSON response contains actual review content
 * (summary, verdict, or comments). Used to prevent false positives
 * when zero-usage is detected — some routers emit zero usage on cached
 * responses that DO contain a valid review.
 */
function checkHasReviewContent(parsed: Record<string, unknown>): boolean {
  const summary = readStringField(parsed, "summary");
  if (summary !== null && summary.length > 0) {
    return true;
  }
  const verdict = readStringField(parsed, "verdict");
  if (verdict !== null && verdict.length > 0) {
    return true;
  }
  const comments = readArrayField(parsed, "comments");
  if (comments !== null && comments.length > 0) {
    return true;
  }
  return false;
}

/**
 * Check the raw text for error-documentation URLs. This is universal
 * across LLM routers and gateways — they all link to their error docs.
 *
 * Matches patterns like:
 *   - `/docs/errors/R101`
 *   - `/docs/errors/`
 *   - `/help/error/`
 *   - `/docs/error-codes#`
 *
 * Works on both JSON (extracted from string fields) and plain-text
 * responses.
 */
function checkErrorDocUrl(rawText: string): ProviderErrorDetails | null {
  // Match `/docs/errors/`, `/help/error/` (some enterprise gateways),
  // and `/docs/error-codes` (Azure-style).
  const ERROR_DOC_PATTERN = /\/(?:docs|help)\/errors?[-_/a-z0-9]*/iu;
  if (ERROR_DOC_PATTERN.test(rawText)) {
    // Extract the matched substring for the detail field so the
    // operator can see which documentation URL was referenced.
    const match = rawText.match(ERROR_DOC_PATTERN);
    const detail = match !== null ? match[0] : "";
    return {
      kind: "error-doc-url",
      message: "Provider response contains an error documentation URL — provider routing or configuration error.",
      ...(detail.length > 0 ? { detail } : {}),
    };
  }
  return null;
}
