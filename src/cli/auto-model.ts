import { isAbortError } from "../provider/provider-error.js";
import { redactUrlForLog } from "../util/url.js";

export type ModelProvider = "openai-compatible" | "anthropic" | "copilot";

export type ModelDiscoveryError =
  | { readonly kind: "empty" }
  | { readonly kind: "ambiguous"; readonly modelIds: readonly string[] }
  | { readonly kind: "unauthorized"; readonly status: 401 | 403 }
  | { readonly kind: "malformed"; readonly reason: string }
  | { readonly kind: "unsupported"; readonly provider: ModelProvider }
  | { readonly kind: "aborted" }
  | { readonly kind: "network"; readonly reason: string };

export type ModelDiscoveryResult =
  | { readonly ok: true; readonly modelId: string }
  | { readonly ok: false; readonly error: ModelDiscoveryError };

export type ModelDiscoveryDependencies = {
  readonly fetchImpl?: typeof fetch;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
};

export type ModelDiscoveryInput = {
  readonly provider: ModelProvider;
  readonly apiUrl: string | null;
  readonly apiKey: string | null;
  readonly dependencies?: ModelDiscoveryDependencies;
};

function modelsUrl(apiUrl: string): string {
  const base = apiUrl.replace(/\/+$/u, "");
  return base.endsWith("/v1") ? `${base}/models` : `${base}/v1/models`;
}

function redactNetworkReason(error: unknown): string {
  if (!(error instanceof Error)) return "model discovery request failed";
  return error.message.replace(/https?:\/\/\S+/gu, (url) => redactUrlForLog(url));
}

type ParsedModelIds =
  | { readonly ok: true; readonly ids: readonly string[] }
  | { readonly ok: false; readonly error: ModelDiscoveryError };

function parseModelIds(body: unknown): ParsedModelIds {
  if (typeof body !== "object" || body === null || !("data" in body) || !Array.isArray(body.data)) {
    return { ok: false, error: { kind: "malformed", reason: "missing data array" } };
  }
  const ids = body.data.flatMap((entry): readonly string[] => {
    if (typeof entry !== "object" || entry === null || !("id" in entry)) return [];
    const id = entry.id;
    return typeof id === "string" && id.trim().length > 0 ? [id.trim()] : [];
  });
  if (ids.length === 0) return { ok: false, error: { kind: "empty" } };
  if (ids.length > 1) return { ok: false, error: { kind: "ambiguous", modelIds: ids } };
  return { ok: true, ids };
}

function discoverySignal(dependencies: ModelDiscoveryDependencies): AbortSignal | undefined {
  const timeoutSignal = dependencies.timeoutMs === undefined
    ? undefined
    : AbortSignal.timeout(dependencies.timeoutMs);
  if (dependencies.signal === undefined) return timeoutSignal;
  if (timeoutSignal === undefined) return dependencies.signal;
  return AbortSignal.any([dependencies.signal, timeoutSignal]);
}

export async function discoverAutoModel(input: ModelDiscoveryInput): Promise<ModelDiscoveryResult> {
  if (input.provider === "copilot") return { ok: true, modelId: "auto" };
  if (input.apiUrl === null || input.apiUrl.trim().length === 0 || input.apiKey === null || input.apiKey.length === 0) {
    return { ok: false, error: { kind: "unsupported", provider: input.provider } };
  }

  const dependencies = input.dependencies ?? {};
  const signal = discoverySignal(dependencies);
  if (signal?.aborted === true) return { ok: false, error: { kind: "aborted" } };
  const headers = input.provider === "anthropic"
    ? { accept: "application/json", "anthropic-version": "2023-06-01", "x-api-key": input.apiKey }
    : { accept: "application/json", authorization: `Bearer ${input.apiKey}` };

  let response: Response;
  try {
    response = await (dependencies.fetchImpl ?? globalThis.fetch)(modelsUrl(input.apiUrl), {
      method: "GET",
      headers,
      ...(signal === undefined ? {} : { signal }),
    });
  } catch (error) {
    return isAbortError(error)
      ? { ok: false, error: { kind: "aborted" } }
      : { ok: false, error: { kind: "network", reason: redactNetworkReason(error) } };
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, error: { kind: "unauthorized", status: response.status } };
  }
  if (!response.ok) {
    return { ok: false, error: { kind: "network", reason: `model discovery returned HTTP ${response.status}` } };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, error: { kind: "malformed", reason: "response body is not JSON" } };
  }
  const parsed = parseModelIds(body);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const modelId = parsed.ids[0];
  return modelId === undefined
    ? { ok: false, error: { kind: "empty" } }
    : { ok: true, modelId };
}
