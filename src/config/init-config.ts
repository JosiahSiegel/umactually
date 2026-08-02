// SPDX-License-Identifier: MIT
// Pure helper for the `umactually init` subcommand.
//
// `buildInitConfig` takes the parsed CLI args and the raw process env
// and produces the config-object shape that gets serialized to
// `~/.umactually/config.json`. It is deliberately tiny so it is easy
// to unit-test in isolation (no I/O, no fs, no child processes).
//
// Field rules (per the M2 plan):
//   - `provider` is always present (validated upstream by `parseInitArgs`).
//   - `apiUrl`, `apiKey`, `model` are only included when the resolved
//     value is non-empty. This keeps the on-disk file tight and avoids
//     accidental "key= " empty-string serialization that some JSON
//     schema validators treat as "key set".
//   - CLI flags win over env vars. The order in `args` is:
//     `--api-url <url>`, `--api-key <key>`, `--model <id>`. These
//     override the corresponding UMACTUALLY_* env vars so an operator
//     can dry-run a single change without unsetting their shell env.
//
// This module is intentionally I/O-free; the CLI wrapper
// (`src/cli/init.ts`) owns the filesystem and process I/O.

import { ENV_KEYS } from "../util/env-keys.js";

/** The three provider families supported by `umactually init`. */
export const INIT_PROVIDERS = ["openai", "anthropic", "copilot"] as const;
export type InitProvider = typeof INIT_PROVIDERS[number];

/** Parsed-but-unvalidated CLI args. The CLI wrapper does the actual
 *  validation and produces a typed `InitArgs`; this helper trusts the
 *  caller has already validated `provider` against `INIT_PROVIDERS`. */
export type InitArgsInput = {
  readonly provider: string | null;
  readonly apply: boolean;
  readonly json: boolean;
  readonly help: boolean;
  readonly apiUrl: string | null;
  readonly apiKey: string | null;
};

/** Dependency bag for `buildInitConfig` — keeps the function pure. */
export type InitConfigDeps = {
  readonly args: InitArgsInput;
  readonly env: Readonly<Record<string, string | undefined>>;
};

/** Resolved config-object shape. Fields are present only when their
 *  resolved value is non-empty (no `undefined` keys leak through). */
export type InitConfig = {
  readonly provider: string;
  readonly apiUrl?: string;
  readonly apiKey?: string;
  readonly model?: string;
};

/** Pick the first non-empty string from the candidate list. Used to
 *  implement "CLI flag wins over env var, env var wins over missing"
 *  without nesting ternaries all over the builder. */
function firstNonEmpty(...candidates: readonly (string | null | undefined)[]): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }
  return undefined;
}

/**
 * Build the JSON-serializable config object that the `init` subcommand
 * will write to `~/.umactually/config.json`. Pure: no I/O, no
 * environment mutation. The caller is responsible for validating the
 * provider string before invoking this.
 */
export function buildInitConfig(deps: InitConfigDeps): InitConfig {
  const { args, env } = deps;
  if (args.provider === null || args.provider.length === 0) {
    // Caller contract: provider is required. Returning a degenerate
    // object here would let an upstream bug leak into the config file
    // — throw so the CLI wrapper surfaces a clear error path.
    throw new Error("buildInitConfig called without a provider");
  }
  const apiUrl = firstNonEmpty(args.apiUrl, env[ENV_KEYS.UMACTUALLY_API_URL]);
  const apiKey = firstNonEmpty(args.apiKey, env[ENV_KEYS.UMACTUALLY_API_KEY]);
  const model = firstNonEmpty(undefined, env[ENV_KEYS.UMACTUALLY_MODEL]);

  const config: InitConfig = { provider: args.provider };
  return {
    ...config,
    ...(apiUrl === undefined ? {} : { apiUrl }),
    ...(apiKey === undefined ? {} : { apiKey }),
    ...(model === undefined ? {} : { model }),
  };
}

/** JSON serializer that omits `undefined` keys. `JSON.stringify`
 *  already drops `undefined` values, but we make the intent
 *  explicit so future maintainers see the "no empty strings, no
 *  undefined keys" contract at the call site. */
export function serializeInitConfig(config: InitConfig): string {
  const cleaned: { [k: string]: string } = {};
  if (config.provider.length > 0) {
    cleaned["provider"] = config.provider;
  }
  if (typeof config.apiUrl === "string" && config.apiUrl.length > 0) {
    cleaned["apiUrl"] = config.apiUrl;
  }
  if (typeof config.apiKey === "string" && config.apiKey.length > 0) {
    cleaned["apiKey"] = config.apiKey;
  }
  if (typeof config.model === "string" && config.model.length > 0) {
    cleaned["model"] = config.model;
  }
  return JSON.stringify(cleaned);
}