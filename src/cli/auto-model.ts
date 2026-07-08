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
 *   - provider=openai-compatible otherwise (incl. api.openai.com)  → gpt-5-mini
 *
 * Users can always override via `--model` (or `UMACTUALLY_MODEL`).
 */

const COPILOT_DEFAULT_MODEL = "claude-3-5-sonnet";
const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-4.6";
const GOOGLE_DEFAULT_MODEL = "gemini-2.5-flash";
const OPENAI_DEFAULT_MODEL = "gpt-5-mini";

export function resolveAutoModel(input: {
  readonly provider: "openai-compatible" | "copilot";
  readonly apiUrl: string | null;
  readonly env: NodeJS.ProcessEnv;
}): string {
  if (input.provider === "copilot") {
    return COPILOT_DEFAULT_MODEL;
  }
  const url = input.apiUrl ?? input.env["UMACTUALLY_API_URL"] ?? "";
  if (url.includes("anthropic")) {
    return ANTHROPIC_DEFAULT_MODEL;
  }
  if (url.includes("generativelanguage") || url.includes("googleapis")) {
    return GOOGLE_DEFAULT_MODEL;
  }
  return OPENAI_DEFAULT_MODEL;
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
    COPILOT_DEFAULT_MODEL,
    COPILOT_DEFAULT_MODEL, // doubled deliberately: the Copilot
    // fallback list is shorter because the provider only accepts
    // Copilot-routable model strings. Doubling the entry gives
    // the retry loop a "second try" on the same model after the
    // first attempt hit a transient parse-fail.
  ],
};

export const DEFAULT_FALLBACK_MODELS: readonly string[] = PROVIDER_FALLBACKS["openai-compatible"];

/**
 * Return the fallback chain for a specific provider. Use this
 * instead of the bare `DEFAULT_FALLBACK_MODELS` constant in any
 * path that might be Copilot-routed — otherwise the parse-fail
 * recovery would itself fail with a 404.
 */
export function fallbackModelsFor(
  provider: "openai-compatible" | "copilot",
): readonly string[] {
  return PROVIDER_FALLBACKS[provider];
}

/**
 * Parse a `--fallback-models` CLI value (comma-separated) into a
 * list. Empty parts and duplicate entries are dropped.
 */
export function parseFallbackModels(value: string | null | undefined): readonly string[] {
  if (value === null || value === undefined || value.length === 0) {
    return DEFAULT_FALLBACK_MODELS;
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
  return out.length > 0 ? out : DEFAULT_FALLBACK_MODELS;
}
