import type { Effort } from "../config/effort.js";
import { isRecord, readStringField, tryParseJson } from "../util/json-guards.js";
import { replaceSecretsLiterally } from "../util/redact.js";
import { ProviderError, type ProviderEndpoint } from "./provider-error.js";

const GUIDANCE = "Choose a supported effort for this provider/model or omit --effort to use the provider default.";

function effortRejectionDetail(envelope: unknown, raw: string): string {
  if (isRecord(envelope)) return readStringField(envelope, "message") ?? raw;
  if (typeof envelope === "string") return envelope;
  return raw;
}

export function assertAnthropicEffort(effort: Effort | undefined): void {
  if (effort === "none" || effort === "minimal") {
    throw new ProviderError("provider_error", "anthropic", null, "", `Anthropic does not accept effort '${effort}'. ${GUIDANCE}`,
      { providerErrorDetails: { kind: "effort-rejection", message: GUIDANCE } });
  }
}

export async function checkEffortRejection(response: Response, context: {
  readonly reasoningEffort?: Effort;
  readonly endpoint: ProviderEndpoint;
  readonly requestId: string;
  readonly secrets: readonly string[];
}): Promise<void> {
  if (context.reasoningEffort === undefined) return;
  let raw: string;
  try {
    raw = await response.clone().text();
  } catch (error) {
    if (error instanceof Error) return;
    throw error;
  }
  const parsed = tryParseJson(raw);
  const envelope = isRecord(parsed) ? parsed["error"] : undefined;
  if (response.ok && envelope === undefined) return;
  const detail = effortRejectionDetail(envelope, raw);
  if (!/\beffort\b|reasoning_effort/iu.test(raw)) return;
  const safe = replaceSecretsLiterally(detail, context.secrets)
    .replace(/\b(?:sk-[\w-]+|gh[pousr]_\w+)\b/gu, "[REDACTED]")
    .replace(/Bearer\s+\S+/giu, "Bearer [REDACTED]")
    .replace(/[\u0000-\u001f\u007f]+/gu, " ").trim().slice(0, 600);
  const message = `Provider ${context.endpoint} rejected effort '${context.reasoningEffort}' (HTTP ${response.status}): ${safe} ${GUIDANCE}`;
  throw new ProviderError("provider_error", context.endpoint, response.status, context.requestId, message,
    { providerErrorDetails: { kind: "effort-rejection", message } });
}
