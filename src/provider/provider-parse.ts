import { extractJsonBlock } from "../render/json-extract.js";
import { isRecord as isPlainObject } from "../util/json-guards.js";

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
 *   4. **Unusable** — returns `null`. Signals to the caller that no
 *      review-shaped content was extractable. Use this for SSE streams
 *      with only metadata events (response.created / response.completed
 *      with empty output[]) so the parse-fail path fires instead of
 *      silently falling back to the raw SSE text (which would otherwise
 *      match the first balanced `{...}` in the stream and look like
 *      a "successful empty review").
 *
 * The "null vs empty string" distinction is critical: callers test
 * `textPayload === null` to distinguish "provider returned nothing
 * usable" from "provider returned an empty string that happens to
 * not be parseable as JSON". See CLARITY-10.
 */
export function extractTextPayload(endpoint: ProviderEndpoint, rawText: string): string | null {
  if (rawText.length === 0) {
    return null;
  }

  const trimmedStart = rawText.trimStart();

  // 1. SSE stream (input starts with "data:" or "event:" prefix).
  //    When the SSE format was detected but no text fragments were
  //    extractable (only metadata events like response.created /
  //    response.completed with empty output[]), return null so the
  //    parse-fail path fires — don't fall through to the raw-text
  //    path because that would let `extractJsonBlock` pluck the first
  //    balanced `{...}` out of the stream and treat it as an empty
  //    review, masking the real failure (CLARITY-10).
  if (trimmedStart.startsWith("data:") || trimmedStart.startsWith("event:")) {
    const sseText = tryExtractSse(rawText);
    if (sseText === null || sseText.length === 0) {
      return null;
    }
    return sseText;
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
      // Not in the Responses API shape — but it might be a direct review
      // JSON (model returned `{"summary": ..., "verdict": ...}` directly).
      // Fall through to the raw-text path so `extractJsonBlock` can
      // extract the whole object and `parseReviewPayload` can validate
      // it (which includes the strict empty-fields check from CLARITY-10).
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
      // Chat JSON shape but no extractable content — usable as raw
      // text for `parseReviewPayload` to attempt.
    }
  }

  // 3. Raw text (could be plain prose, markdown, or a JSON block
  //    wrapped in ``` fences — `extractJsonBlock` handles the latter).
  //    Only useful if non-empty; empty string would just become a
  //    useless parse attempt.
  return rawText.trim().length > 0 ? rawText : null;
}

export function parseReviewPayload(text: string): ProviderReviewPayload | null {
  const candidate = extractJsonBlock(text);
  if (!isPlainObject(candidate)) {
    return null;
  }

  return {
    summary: readStringField(candidate, "summary") ?? "",
    verdict: readStringField(candidate, "verdict") ?? "",
    comments: readCommentArray(candidate["comments"]),
    suppressed_comments: readCommentArray(candidate["suppressed_comments"]),
  };
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
  if (!Array.isArray(value)) {
    return [];
  }
  const comments: ProviderComment[] = [];
  for (const entry of value) {
    if (!isPlainObject(entry)) {
      continue;
    }
    const path = entry["path"];
    const line = entry["line"];
    if (typeof path === "string" && typeof line === "number" && Number.isFinite(line)) {
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
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function readArrayField(record: Record<string, unknown>, key: string): readonly unknown[] | null {
  const value = record[key];
  return Array.isArray(value) ? value : null;
}

function readRecordField(value: unknown, key: string): Record<string, unknown> | null {
  if (!isPlainObject(value)) {
    return null;
  }
  const inner = value[key];
  return isPlainObject(inner) ? inner : null;
}