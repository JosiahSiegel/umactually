// SPDX-License-Identifier: MIT
// Runtime wrapper around the CLI's `umactually init` saved-config reader.
//
// `readSavedConfig` in `src/config/saved-config.ts` is shaped for the wizard
// (exit-code + message) and refuses to proceed on malformed JSON. The
// `umactually review` and `umactually --files` entry paths, plus the bare
// `umactually` quickstart gate, need a NON-exit-shaped variant: read the
// file, return whatever you got, surface the failure as a `warning` the
// caller decides whether to print. This keeps the resolver sites
// (`apply-saved-config`, `runLoadedConfigQuickstart`) free of `process.exit`
// concerns and keeps the wizard's strict contract intact.
//
// S6 contract: this function NEVER persists or transmits `apiKey`.
// The `SavedConfig` type excludes it; `readSavedConfig` rejects attempts
// to deserialize unknown keys at the type level.

import {
  readSavedConfig,
  type ReadSavedConfigResult,
  type SavedConfig,
} from "../config/saved-config.js";
import { homedir } from "node:os";

export type TryReadSavedConfigDeps = {
  readonly homeDir?: string;
  readonly cwd?: string;
};

export type TryReadSavedConfigResult = {
  readonly config: SavedConfig | null;
  readonly path: string;
  readonly warning: string | null;
};

/**
 * Read the runtime-effective saved config (repo path first, global fallback),
 * without ever exiting on failure. Returns `{config: null, warning: <msg>}`
 * when the file is missing, malformed, or refused for security reasons —
 * callers decide whether to surface the warning to the user.
 *
 * Defaults `cwd` to `process.cwd()` and `homeDir` to `os.homedir()` so
 * the common path is a no-arg call. Tests inject explicit values to
 * avoid touching the real user's `~/.umactually/config.json`.
 *
 * Never throws. The wizard's `readSavedConfig` is the throwing/exiting
 * variant; this one is the runtime-tolerant variant. They share the
 * underlying validation through the same `SavedConfig` type.
 */
export function tryReadSavedConfig(
  deps: TryReadSavedConfigDeps = {},
): TryReadSavedConfigResult {
  const homeDir = deps.homeDir ?? homedir();
  const result: ReadSavedConfigResult = readSavedConfig({
    homeDir,
    cwd: deps.cwd ?? process.cwd(),
  });
  if (result.ok) {
    return { config: result.config, path: result.path, warning: null };
  }
  // Failure path: synthesize the global path as the canonical
  // "where the loader looked" pointer. The wizard's failure result
  // doesn't carry a path field, but an operator running
  // `umactually --show-config` against a corrupt file wants to know
  // WHICH file failed to parse; the global-path shape is the closest
  // meaningful answer we can give without re-implementing the
  // candidate walk that `readSavedConfig` does. The exact failure
  // path is also embedded in `warning` text (per the wizard's
  // "corrupt saved config at <path>" contract) so callers needing
  // the precise file path can parse the warning.
  return {
    config: null,
    path: result.path,
    warning: result.message,
  };
}
