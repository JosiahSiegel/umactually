/** Canonical provider/platform URL defaults. Centralizing prevents drift between the loader, live provider, help text, and platform modules. */

/** OpenAI default base URL. Used by `config/loader.ts` and the OpenAI-compatible client as the default when `--api-url` is unset and no provider-specific override applies. */
export const DEFAULT_OPENAI_URL = "https://api.openai.com/v1";

/** Anthropic Messages API default base URL. Used by `cli/live-provider.ts` when `--provider anthropic` is set and `--api-url` is unset. */
export const DEFAULT_ANTHROPIC_URL = "https://api.anthropic.com/v1";

/** GitHub API default base URL. Used by Copilot token exchange (`provider/copilot.ts`) and Copilot routing in `cli/live-provider.ts`. */
export const DEFAULT_GITHUB_API_BASE = "https://api.github.com";