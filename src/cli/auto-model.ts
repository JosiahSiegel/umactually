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
 *   - provider=copilot  → claude-sonnet-4.6 (Copilot's default; the
 *     least-hallucinating frontier model for grounded code review
 *     per the model-comparison research; HHEM 10.6%, lowest among
 *     the Claude/GPT flagship models for path/line citation)
 *   - provider=openai-compatible + URL contains "anthropic"  → claude-sonnet-4.6
 *   - provider=openai-compatible + URL contains "generativelanguage"  → gemini-2.5-flash
 *   - provider=openai-compatible otherwise (incl. api.openai.com)  → gpt-5-mini
 *
 * Users can always override via `--model` (or `UMACTUALLY_MODEL`).
 * The resolver is the layer 5 piece of the citation-grounding fix
 * (ranked technique #5 in the production-tool survey: "model
 * selection for hallucination resistance"); the LLM still
 * fabricates occasionally, but the model choice is the cheapest
 * defense in the chain.
 */

const COPILOT_DEFAULT_MODEL = "claude-sonnet-4.6";
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
 */
export const DEFAULT_FALLBACK_MODELS: readonly string[] = [
  OPENAI_DEFAULT_MODEL,
  ANTHROPIC_DEFAULT_MODEL,
  GOOGLE_DEFAULT_MODEL,
  "gpt-5.4-mini",
  "gpt-5.4-nano",
];

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