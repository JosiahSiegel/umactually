/**
 * Layer 5: opinionated `model: "auto"` resolution.
 *
 * The default `auto` was previously passed verbatim to the provider,
 * which on most OpenAI-compatible endpoints resolves to whatever the
 * provider's "auto" picks (often gpt-4o or gpt-4-turbo). Per the
 * Vectara HHEM 2026-05-11 leaderboard, those models have a 9-12%
 * hallucination rate on grounded summarization tasks, vs 3-5% for
 * gpt-5-mini / gemini-2.5-flash-lite / claude-haiku-4.5.
 *
 * PR-Agent (qodo-ai) made the same switch in 2025: their default
 * went from gpt-4o to gpt-5 explicitly to reduce path fabrication.
 *
 * The resolver here picks a model with the best cost-vs-hallucination
 * trade-off for the active provider:
 *   - provider=copilot  → claude-3-5-sonnet (Copilot's Claude backend;
 *     this is the model string the GitHub Copilot Chat Completions
 *     endpoint actually accepts — the v3.x and v3.5 Sonnet line is
 *     the Copilot-routable Claude. claude-sonnet-4.6 is NOT a
 *     Copilot-routable string and would 404.)
 *   - provider=openai-compatible + URL contains "anthropic"  → claude-sonnet-4.6
 *   - provider=openai-compatible + URL contains "generativelanguage"  → gemini-2.5-flash
 *   - provider=openai-compatible + URL contains "minimax" or "MiniMax"  → MiniMax-Text-01
 *   - provider=openai-compatible otherwise (incl. api.openai.com)  → gpt-5-mini
 *
 * The MiniMax branch was added when PR #28's self-review hit HTTP
 * 400 on every OpenAI/Anthropic model name — the MiniMax provider
 * only serves `MiniMax-Text-01` (or `abab*` aliases). Detected by
 * the URL hostname containing `minimax`.
 *
 * Users can always override via `--model` (or `UMACTUALLY_MODEL`).
 */

const COPILOT_DEFAULT_MODEL = "claude-3-5-sonnet";
const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-4.6";
const GOOGLE_DEFAULT_MODEL = "gemini-2.5-flash";
const MINIMAX_DEFAULT_MODEL = "MiniMax-Text-01";
const OPENAI_DEFAULT_MODEL = "gpt-5-mini";

/**
 * Hostname-based routing table for the openai-compatible provider.
 * Each entry maps a host substring to the model name that host
 * actually serves — i.e. the model the provider will accept without
 * returning HTTP 400. Hostname match wins over path-substring match
 * so a URL like `https://api.minimax.io/anthropic` (which contains
 * the substring "anthropic") correctly routes to MiniMax-Text-01
 * rather than the Anthropic-default claude-sonnet-4.6 (which the
 * MiniMax provider would 400 on).
 *
 * The substring match is on the **hostname**, not the full URL —
 * `apiUrl.includes("minimax")` is too loose (any URL with the word
 * "minimax" in the path would match). We use a URL-parsed hostname
 * to keep the match precise.
 *
 * Order matters: each entry is checked in order. The MiniMax
 * entry comes BEFORE the Anthropic entry so `api.minimax.io` is
 * detected as MiniMax even when the URL path contains
 * `/anthropic`.
 */
type HostRoute = {
  readonly hostSubstring: string;
  readonly model: string;
};
const HOST_ROUTES: readonly HostRoute[] = [
  // MiniMax: the api.minimax.io gateway only accepts MiniMax-Text-01
  // and abab* aliases. Any OpenAI/Anthropic model name returns
  // HTTP 400. Detected by hostname substring.
  { hostSubstring: "minimax", model: MINIMAX_DEFAULT_MODEL },
  // Anthropic: api.anthropic.com serves the claude-* line.
  { hostSubstring: "anthropic", model: ANTHROPIC_DEFAULT_MODEL },
  // Google: generativelanguage.googleapis.com (Gemini API) and
  // aiplatform.googleapis.com (Vertex AI) both serve gemini-*.
  { hostSubstring: "generativelanguage", model: GOOGLE_DEFAULT_MODEL },
  { hostSubstring: "googleapis", model: GOOGLE_DEFAULT_MODEL },
];

export function resolveAutoModel(input: {
  readonly provider: "openai-compatible" | "copilot";
  readonly apiUrl: string | null;
  readonly env: NodeJS.ProcessEnv;
}): string {
  if (input.provider === "copilot") {
    return COPILOT_DEFAULT_MODEL;
  }
  const url = input.apiUrl ?? input.env["UMACTUALLY_API_URL"] ?? "";
  const hostname = extractHostname(url);
  if (hostname !== null) {
    const lowerHost = hostname.toLowerCase();
    for (const route of HOST_ROUTES) {
      if (lowerHost.includes(route.hostSubstring)) {
        return route.model;
      }
    }
  }
  return OPENAI_DEFAULT_MODEL;
}

/**
 * Extract the hostname from a URL string. Returns null when the
 * input is empty, malformed, or a bare string without a scheme
 * separator. The caller is expected to fall back to the default
 * model when null is returned.
 *
 * Why hostname-only: substring matching on the full URL is too
 * loose. A URL like `https://example.com/minimax-router` would
 * falsely match `url.includes("minimax")` and pick a MiniMax
 * model. The hostname extract prevents that — `example.com`
 * doesn't contain `minimax`, so the model is the default.
 */
function extractHostname(url: string): string | null {
  const trimmed = url.trim();
  if (trimmed.length === 0) return null;
  try {
    return new URL(trimmed).hostname.toLowerCase();
  } catch {
    // Fallback: strip scheme manually, then read up to the first
    // `/` or `:`. `localhost:8080` parses to hostname "localhost"
    // in some runtimes and `8080` in others, so this path handles
    // the parse-failure case explicitly.
    const schemeSep = trimmed.indexOf("://");
    if (schemeSep === -1) {
      const firstSlash = trimmed.indexOf("/");
      const firstColon = trimmed.indexOf(":");
      const stop = firstSlash === -1 ? trimmed.length : firstSlash;
      const host = firstColon === -1 || firstColon > stop
        ? trimmed.slice(0, stop)
        : trimmed.slice(0, firstColon);
      return host.length > 0 ? host : null;
    }
    const sepLen = 3; // "://" length
    const afterScheme = trimmed.slice(schemeSep + sepLen);
    const firstSlash = afterScheme.indexOf("/");
    const firstColon = afterScheme.indexOf(":");
    const stop = firstSlash === -1 ? afterScheme.length : firstSlash;
    const host = firstColon === -1 || firstColon > stop
      ? afterScheme.slice(0, stop)
      : afterScheme.slice(0, firstColon);
    return host.length > 0 ? host : null;
  }
}

/**
 * The fallback chain used when a primary model returns a parse-fail
 * or a non-parseable response. Each entry is a model name the
 * provider accepts. The current implementation is sequential (try
 * the first, fall back to the next on parse-fail), not parallel —
 * keeps the per-request cost predictable and matches the
 * PR-Agent `retry_with_fallback_models` pattern.
 *
 * IMPORTANT: the fallback chain is provider-specific. Trying
 * `claude-sonnet-4.6` as a Copilot fallback would 404 (per the
 * Copilot model routing documented in `resolveAutoModel`).
 * `fallbackModelsFor` filters the list to provider-routable models
 * so the parse-fail recovery doesn't itself fail.
 */
const PROVIDER_FALLBACKS: Readonly<Record<"openai-compatible" | "copilot", readonly string[]>> = {
  "openai-compatible": [
    OPENAI_DEFAULT_MODEL,
    "gpt-4.1",
    "gpt-4.1-mini",
    ANTHROPIC_DEFAULT_MODEL,
    GOOGLE_DEFAULT_MODEL,
  ],
  copilot: [
    // The Copilot fallback chain is intentionally short: the
    // provider only accepts Copilot-routable model strings, and
    // a parse-fail retry on a different model that's still
    // Copilot-routable would 404 too. The retry loop should fall
    // back to the same model with a parse-fail retry prompt
    // (handled in provider-parse.ts:PARSE_FAIL_RETRY_PROMPT);
    // a model-level fallback is a no-op for Copilot today.
    COPILOT_DEFAULT_MODEL,
  ],
};

/**
 * Per-URL fallback chains for providers that only accept their own
 * model names. The MiniMax provider (`api.minimax.io`) returns
 * HTTP 400 for any OpenAI/Anthropic/Google model name, so the
 * generic openai-compatible fallback chain would 400 too.
 *
 * The map key is the host substring used by `HOST_ROUTES` so a
 * single source of truth drives both primary and fallback model
 * selection. Adding a new provider means adding ONE entry to
 * `HOST_ROUTES` and (if it needs custom fallbacks) ONE entry here
 * with the same key.
 */
const URL_SPECIFIC_FALLBACKS: Readonly<Record<string, readonly string[]>> = {
  // `toLowerCase()` is applied to the URL before lookup so this
  // map is case-insensitive — `api.minimax.io` and `API.MINIMAX.IO`
  // both resolve to the same chain.
  "minimax": [
    MINIMAX_DEFAULT_MODEL,
    "abab6.5s-chat",
    "abab5.5-chat",
  ],
};

export const DEFAULT_FALLBACK_MODELS: readonly string[] = PROVIDER_FALLBACKS["openai-compatible"];

/**
 * Return the fallback chain for a specific provider. Use this
 * instead of the bare `DEFAULT_FALLBACK_MODELS` constant in any
 * path that might be Copilot-routed — otherwise the parse-fail
 * recovery would itself fail with a 404.
 *
 * If `apiUrl` is provided and the URL hostname matches a
 * URL-specific chain (e.g. `api.minimax.io`), the URL-specific
 * chain wins — the generic OpenAI chain would 400 on those
 * providers.
 *
 * Hostname-only matching: matches against the URL hostname, not
 * the full URL, so a path like `/minimax-router` in
 * `https://example.com/minimax-router` does NOT falsely trigger
 * the MiniMax fallback chain. This is the same contract as
 * `resolveAutoModel`'s hostname-based routing — both functions
 * use `extractHostname` so the match is consistent.
 */
export function fallbackModelsFor(
  provider: "openai-compatible" | "copilot",
  apiUrl?: string | null,
): readonly string[] {
  if (apiUrl !== undefined && apiUrl !== null && apiUrl.length > 0) {
    const hostname = extractHostname(apiUrl);
    if (hostname !== null) {
      for (const [hostKey, chain] of Object.entries(URL_SPECIFIC_FALLBACKS)) {
        if (hostname.includes(hostKey)) {
          return chain;
        }
      }
    }
  }
  return PROVIDER_FALLBACKS[provider];
}

/**
 * Parse a `--fallback-models` CLI value (comma-separated) into a
 * list. Empty parts and duplicate entries are dropped.
 *
 * When `apiUrl` is provided, the default fallback chain uses the
 * URL-specific model list when the URL matches a known provider
 * (e.g. `api.minimax.io` → MiniMax-Text-01, not the generic
 * openai-compatible chain). This makes `--fallback-models` consistent
 * with `resolveAutoModel`'s URL-aware behavior.
 */
export function parseFallbackModels(
  value: string | null | undefined,
  apiUrl?: string | null,
): readonly string[] {
  const defaultChain =
    apiUrl !== undefined && apiUrl !== null && apiUrl.length > 0
      ? fallbackModelsFor("openai-compatible", apiUrl)
      : DEFAULT_FALLBACK_MODELS;
  if (value === null || value === undefined || value.length === 0) {
    return defaultChain;
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of value.split(",")) {
    const trimmed = part.trim();
    if (trimmed.length === 0 || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out.length > 0 ? out : defaultChain;
}
