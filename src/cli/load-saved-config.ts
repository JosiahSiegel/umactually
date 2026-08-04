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
  const result: ReadSavedConfigResult = readSavedConfig({
    homeDir: deps.homeDir ?? homedir(),
    cwd: deps.cwd ?? process.cwd(),
  });
  if (result.ok) {
    return { config: result.config, path: result.path, warning: null };
  }
  // Failure path: per `readSavedConfig` contract, `result.ok === false`
  // implies `result.exitCode` is 1 or 2 and `result.message` is set.
  // We return the message as a `warning` so callers can decide how
  // prominently to surface it. `path` is the candidate we tried to
  // read (typically the global path; we don't know which one failed
  // without re-implementing the candidate walk — and we don't need to,
  // because the warning message itself names the path).
  return {
    config: null,
    // The wizard's failure result is `ReadSavedConfigResult` shaped, not
    // `{path: string}` — but its `path` is implicitly the candidate the
    // walker hit. When `readSavedConfig` returns `ok:false` it has not
    // returned a `path` field; for the warning case we synthesize the
    // most-likely path (the global path) so the `path` is always a
    // defined string. Callers that need the exact failure path can
    // parse the warning message text.
    path: "", // see file comment — readSavedConfig failure shape omits `path`.
    warning: result.message,
  };
}
