import { extractJsonBlock } from "../render/json-extract.js";
import {
  isRecord as isPlainObject,
  isUnknownArray,
  readArrayField as readArrayFieldHelper,
  readRecordField as readRecordFieldHelper,
  readSafeIntegerField as readSafeIntegerFieldHelper,
  readStringField as readStringFieldHelper,
} from "../util/json-guards.js";

type ProviderEndpoint = "responses" | "chat";

export type { ProviderEndpoint };

type ProviderComment = {
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
  if (parsed !== undefined && isPlainObject(parsed)) {
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
export function parseReviewPayload(text: string): ProviderReviewPayload | null {
  const candidate = extractJsonBlock(text);
  if (!isPlainObject(candidate)) {
    return null;
  }

  const summary = readStringField(candidate, "summary") ?? "";
  const verdict = readStringField(candidate, "verdict") ?? "";
  const comments = readCommentArray(candidate["comments"]);
  const suppressed_comments = readCommentArray(candidate["suppressed_comments"]);

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
    // "no diff / file contents were provided / shared / available"
    /\bno\s+(diff|file\s+contents?|contents?)\b.*\b(provided|shared|available|supplied)\b/u,
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
    if (!isPlainObject(entry)) {
      continue;
    }
    const content = entry["content"];
    // Responses API: content is an array of parts.
    if (Array.isArray(content)) {
      for (const part of content) {
        if (!isPlainObject(part)) {
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
    if (isPlainObject(content)) {
      const text = content["text"];
      if (typeof text === "string") {
        fragments.push(text);
      }
    }
  }
  return fragments.join("\n");
}

function readCommentArray(value: unknown): readonly ProviderComment[] {
  if (!isUnknownArray(value)) {
    return [];
  }
  const comments: ProviderComment[] = [];
  for (const entry of value) {
    if (!isPlainObject(entry)) {
      continue;
    }
    const path = entry["path"];
    const line = readSafeIntegerField(entry, "line");
    if (typeof path === "string" && line !== null) {
      comments.push({
        path,
        line,
        body: readStringField(entry, "body") ?? "",
        severity: readStringField(entry, "severity") ?? "medium",
        category: readStringField(entry, "category") ?? "general",
      });
    }
  }
  return comments;
}

function tryParseJson(rawText: string): unknown {
  try {
    return JSON.parse(rawText);
  } catch {
    return undefined;
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

  for (const line of trimmed.split("\n")) {
    const clean = line.trim();
    if (!clean.startsWith("data:")) {
      continue;
    }
    const payload = clean.slice("data:".length).trim();
    if (payload === "[DONE]" || payload === "") {
      continue;
    }

    const parsed = tryParseJson(payload);
    if (!isPlainObject(parsed)) {
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
  // fragments — providers that send a `response.completed` event usually
  // skip the per-fragment deltas, so fragment concatenation would be empty.
  if (completedResponseText !== null) {
    return completedResponseText;
  }
  return fragments.length > 0 ? fragments.join("") : null;
}

function readStringField(record: Record<string, unknown>, key: string): string | null {
  return readStringFieldHelper(record, key);
}

function readArrayField(record: Record<string, unknown>, key: string): readonly unknown[] | null {
  return readArrayFieldHelper(record, key);
}

function readRecordField(value: unknown, key: string): Record<string, unknown> | null {
  return readRecordFieldHelper(value, key);
}

function readSafeIntegerField(record: Record<string, unknown>, key: string): number | null {
  return readSafeIntegerFieldHelper(record, key);
}