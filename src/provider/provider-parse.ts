import { extractJsonBlock } from "../render/json-extract.js";

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

export function buildResponsesBody(config: {
  readonly model: string;
  readonly system: string;
  readonly user: string;
  readonly maxOutputTokens?: number;
  readonly reasoningEffort?: "low" | "medium" | "high";
}): RequestBody {
  const body: Record<string, unknown> = {
    model: config.model,
    input: [
      { role: "system", content: config.system },
      { role: "user", content: config.user },
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

export function buildChatBody(config: {
  readonly model: string;
  readonly system: string;
  readonly user: string;
  readonly maxOutputTokens?: number;
  readonly reasoningEffort?: "low" | "medium" | "high";
}): RequestBody {
  const body: Record<string, unknown> = {
    model: config.model,
    messages: [
      { role: "system", content: config.system },
      { role: "user", content: config.user },
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

export function extractTextPayload(endpoint: ProviderEndpoint, rawText: string): string {
  const sseText = tryExtractSse(rawText);
  if (sseText !== null) {
    return sseText;
  }

  const parsed = tryParseJson(rawText);
  if (parsed === undefined || !isPlainObject(parsed)) {
    return rawText;
  }

  if (endpoint === "responses") {
    const direct = readStringField(parsed, "output_text");
    if (direct !== null) {
      return direct;
    }
    const output = readArrayField(parsed, "output");
    if (output !== null) {
      const fromOutput = joinOutputText(output);
      if (fromOutput.length > 0) {
        return fromOutput;
      }
    }
    return rawText;
  }

  const choices = readArrayField(parsed, "choices");
  if (choices === null) {
    return rawText;
  }
  for (const choice of choices) {
    const message = readRecordField(choice, "message");
    if (message === null) {
      continue;
    }
    const content = readStringField(message, "content");
    if (content !== null) {
      return content;
    }
  }
  return rawText;
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

function joinOutputText(output: readonly unknown[]): string {
  const fragments: string[] = [];
  for (const entry of output) {
    if (!isPlainObject(entry)) {
      continue;
    }
    const content = entry["content"];
    if (!isPlainObject(content)) {
      continue;
    }
    const text = content["text"];
    if (typeof text === "string") {
      fragments.push(text);
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
 * Some providers (e.g. Manifest) ignore `stream: false` and always return
 * Server-Sent Events. Detect the `data: ` prefix format and concatenate
 * content from all chunks into a single string.
 *
 * Handles both the /chat/completions streaming format (delta.content) and
 * the /responses streaming format (delta or output_text.delta).
 */
function tryExtractSse(rawText: string): string | null {
  const trimmed = rawText.trim();
  if (!trimmed.startsWith("data:")) {
    return null;
  }

  const fragments: string[] = [];

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

    // /responses streaming: delta is a string directly on the JSON object
    // (response.output_text.delta event)
    const deltaText = readStringField(parsed, "delta");
    if (deltaText !== null) {
      fragments.push(deltaText);
    }
  }

  return fragments.length > 0 ? fragments.join("") : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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