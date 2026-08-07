// SPDX-License-Identifier: MIT
//
// Shared CLI helpers for scripts/*.mjs.
//
// Extracted to deduplicate the IIFE / argument-parsing / package-version /
// Node-version / tsdown-resolution blocks that were previously copy-pasted
// across six release-tooling scripts. Each helper here preserves the
// exact behavior of the originals so the calling sites stay
// byte-identical at runtime.
//
// This file is intentionally a thin `.mjs` with no test-seam env vars
// of its own — the test seams (UMACTUALLY_TSDOWN_BIN,
// UMACTUALLY_ALLOW_NON_WINDOWS_BUILD, etc.) live with the scripts that
// own them, and the helpers below forward the relevant env reads.

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * True when the calling script is the entrypoint of the current `node`
 * invocation.
 *
 * Mirrors the IIFE that every release-tooling script used to inline:
 *
 *   if (typeof process.argv[1] !== "string") return false;
 *   try { return resolve(process.argv[1]) === fileURLToPath(import.meta.url); }
 *   catch { return false; }
 *
 * Because this helper lives in its own file (`cli-shared.mjs`), its own
 * `import.meta.url` is NOT the caller's URL — so the caller must pass
 * its `import.meta.url` for the comparison to fire correctly:
 *
 *   import { invokedDirectly } from "./lib/cli-shared.mjs";
 *   if (invokedDirectly(import.meta.url)) main();
 *
 * Returns false when argv[1] is missing (no entry script) or when
 * `resolve()` throws on a non-string / unparseable path. Used by the
 * trailing `if (invokedDirectly(import.meta.url)) main()` guard so
 * importing the module from a test does not trigger a real `npm
 * publish` / `node --build-sea` / etc. side effect.
 *
 * @param {string} [callerUrl]  The caller's `import.meta.url` value.
 *   Pass it explicitly so the comparison is against the entrypoint
 *   script, not against this helper's own URL.
 * @returns {boolean}
 */
export function invokedDirectly(callerUrl) {
  if (typeof process.argv[1] !== "string") return false;
  if (typeof callerUrl !== "string") return false;
  try {
    return resolve(process.argv[1]) === fileURLToPath(callerUrl);
  } catch {
    return false;
  }
}

/**
 * Parse a `--key value` / `--key=value` argv array into a `{ key: value }` map.
 *
 * Mirrors the parser that `merge-candidate-bundles.mjs` used to inline:
 *
 *   for (let i = 0; i < argv.length; i += 1) {
 *     const flag = argv[i];
 *     if (!flag?.startsWith("--")) throw new Error(...);
 *     const value = argv[i + 1];
 *     if (!value || value.startsWith("--")) throw new Error(...);
 *     out[flag.slice(2)] = value;
 *     i += 1;
 *   }
 *
 * `publish-with-webauth.mjs` used the related `--key=value` form (regex
 * match `/^--timeout=(\d+)$/u`); this helper accepts BOTH forms so the
 * caller can do `const { timeout = "180" } = parseArgs(argv)` and pick up
 * either `--timeout 300` or `--timeout=300`. Whichever form the caller
 * passes, the resulting value is a string — coercion (e.g.
 * `Number.parseInt(value, 10)` for numeric flags) is the caller's job,
 * matching the original scripts.
 *
 * Throws on positional (non-`--`) arguments and on `--key` without a
 * following non-`--` value, matching the original error messages.
 *
 * @param {readonly string[]} argv
 * @returns {Record<string, string>}
 */
export function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (typeof arg !== "string" || !arg.startsWith("--")) {
      throw new Error(`unexpected argument ${arg ?? ""}`);
    }
    const eqIdx = arg.indexOf("=");
    if (eqIdx >= 0) {
      out[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      continue;
    }
    const key = arg.slice(2);
    const value = argv[i + 1];
    if (typeof value !== "string" || value.startsWith("--")) {
      throw new Error(`missing value for ${arg}`);
    }
    out[key] = value;
    i += 1;
  }
  return out;
}