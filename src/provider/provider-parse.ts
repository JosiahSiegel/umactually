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
import type { ProviderEndpoint } from "./provider-error.js";

export type { ProviderEndpoint };

export type ProviderComment = {
  readonly path: string;
  readonly line: number;
  readonly body: string;
  readonly severity: string;
  readonly category: string;
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

export type RequestBody = Record<string, unknown>;

/**
 * Self-healing follow-up message sent to the model when its first response
 * could not be parsed as a JSON review payload. Some providers ignore
 * `stream: false` and return an empty SSE stream; some wrap their output
 * in markdown fences or prose; some omit the JSON entirely. We retry
 * once with an explicit reminder before falling back to the parse-fail
 * surface — that often recovers the review without operator intervention.
 *
 * Shared between `openai-compatible.ts` and `copilot.ts` so the
 * self-healing message stays byte-identical regardless of provider.
 */
export const PARSE_FAIL_RETRY_PROMPT =
  "Your previous response did not contain a valid JSON review payload. " +
  "Please respond with ONLY a JSON object matching this schema (no prose, no fences): " +
  '{"summary": "...", "verdict": "NEEDS_FIX|APPROVED|COMMENT|DISCUSS|SHIP", "comments": [...], "suppressed_comments": [...]}.';

export function buildResponsesBody(
  config: {
    readonly model: string;
    readonly system: string;
    readonly user: string;
    readonly maxOutputTokens?: number;
    readonly reasoningEffort?: "low" | "medium" | "high";
  },
  opts?: { readonly userOverride?: string },
): RequestBody {
  const userContent = opts?.userOverride ?? config.user;
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
  return body;
}

export function buildChatBody(
  config: {
    readonly model: string;
    readonly system: string;
    readonly user: string;
    readonly maxOutputTokens?: number;
    readonly reasoningEffort?: "low" | "medium" | "high";
  },
  opts?: { readonly userOverride?: string },
): RequestBody {
  const userContent = opts?.userOverride ?? config.user;
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
      }
      // Not in the Responses API shape — fall through to raw text
      // so `parseReviewPayload` can extract a direct review JSON
      // object (model returned `{"summary": ..., "verdict": ...}`).
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
        const text = part["text"];
        if (typeof text === "string") {
          fragments.push(text);
        }
      }
      continue;
    }
    // Chat-style: content is a single object with a text field.
    if (isRecord(content)) {
      const text = content["text"];
      if (typeof text === "string") {
        fragments.push(text);
      }
    }
  }
  return fragments.join("\n");
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
      const body = readStringField(entry, "body") ?? "";
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
                ...(effectiveSink !== undefined ? { sink: effectiveSink } : {}),
                ...(effectiveProviderName !== undefined
                  ? { providerName: effectiveProviderName }
                  : {}),
                commentIndex: index,
              }
            : { commentIndex: index },
        ),
        category: readStringField(entry, "category") ?? "general",
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
    // Empty/null is treated the same as unknown: fall back to "medium"
    // but emit a warning so operators can tell the difference between
    // "provider omitted severity entirely" vs "provider emitted a
    // non-canonical value".
    emitSeverityWarning(value ?? "", "medium", context, sink);
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
 * Some providers (e.g. Manifest, MiniMax) ignore `stream: false` and always
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
  // like Manifest prepend event: lines before data: lines).
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
    // string directly on the JSON object.
    const deltaText = readStringField(parsed, "delta");
    if (deltaText !== null) {
      fragments.push(deltaText);
    }
  }

  // Prefer the completed-response text (full output) over accumulated
  // fragments — but ONLY if the completed text looks like real content.
  //
  // Some providers (notably MiniMax-M3 observed in Azure DevOps PR #43
  // thread 589) emit a `response.completed` event whose `output[]` carries
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
 * pins the behavior end-to-end with the production failure mode
 * (MiniMax-M3 `response.completed` stub "placeholder").
 */
function isStubCompletedText(text: string): boolean {
  if (text.length === 0) return true;
  if (text.length < 8) return true;
  if (!text.includes("{")) return true;
  return false;
}
