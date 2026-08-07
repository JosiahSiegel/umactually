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

import { existsSync, globSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Regex used by resolveTsdownCommand() to detect when the
// UMACTUALLY_TSDOWN_BIN override points at a Node-runnable script
// (rather than a compiled binary).
const TSDOWN_SCRIPT_DETECT = /\.(mjs|cjs|js)$/i;

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

/**
 * Read `package.json` at `packageRoot` and return the `version` string.
 *
 * Mirrors `readPackageVersion()` in `scripts/check-version-alignment.mjs`
 * and `scripts/render-versions.mjs`. Both originals used the same
 * `/^\d+\.\d+\.\d+/` semver check and only differed in the error-message
 * label — we accept that label as a parameter (`errorLabel`) so each
 * caller can keep its own error message prefix byte-identical to before
 * the extraction.
 *
 * @param {string} packageRoot
 * @param {string} errorLabel  Prefix for the thrown error message (e.g.
 *   `"check-version-alignment"` or `"render-versions"`).
 * @returns {string} The `version` field from `package.json`.
 */
export function readPackageVersion(packageRoot, errorLabel) {
  const pkg = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
  if (typeof pkg.version !== "string" || !/^\d+\.\d+\.\d+/.test(pkg.version)) {
    throw new Error(
      `${errorLabel}: package.json "version" is missing or not a semver triple: ${JSON.stringify(pkg.version)}`,
    );
  }
  return pkg.version;
}

/**
 * Walk a list of glob patterns relative to `packageRoot` and return the
 * matching files, sorted, with any path under `skipDirs` filtered out.
 *
 * Mirrors `collectTargets()` in `scripts/check-version-alignment.mjs` and
 * `scripts/render-versions.mjs`. Both originals used the same Windows-aware
 * `relative()` guard (because `path.relative("C:\\foo", "README.md")`
 * resolves the second arg against process.cwd() and returns a wrong
 * drive's path on cross-drive sandboxes). The `globSync` `withFileTypes`
 * flag was explicitly `false` in render-versions.mjs and unset in
 * check-version-alignment.mjs; both default to false, so the explicit
 * `withFileTypes: false` is preserved here to keep behavior identical.
 *
 * @param {string} packageRoot
 * @param {readonly string[]} targets  Glob patterns to walk.
 * @param {ReadonlySet<string>} skipDirs  Directory names (any path segment
 *   matching one of these is dropped from the result).
 * @returns {string[]} Sorted, forward-slash-normalized relative paths.
 */
export function collectTargets(packageRoot, targets, skipDirs) {
  const found = new Set();
  for (const pattern of targets) {
    const matches = globSync(pattern, { cwd: packageRoot, withFileTypes: false });
    for (const match of matches) {
      // Two cases to disambiguate on Windows:
      //   1. globSync returned a path relative to packageRoot (the
      //      common case). Use `path.relative` to canonicalize it.
      //   2. globSync returned an absolute path (rare — happens on
      //      cross-drive sandboxes). Trust the absolute path as-is.
      let rel;
      if (isAbsolute(match)) {
        rel = match;
      } else {
        const candidate = relative(packageRoot, match);
        const isStillInside =
          candidate === "" ||
          (!candidate.startsWith("..") && !isAbsolute(candidate));
        rel = isStillInside
          ? (candidate === "." ? match : candidate)
          : match;
      }
      rel = rel.replace(/[\\/]/g, "/");
      const segments = rel.split(/[\\/]/);
      if (!segments.some((segment) => skipDirs.has(segment))) {
        found.add(rel);
      }
    }
  }
  return [...found].sort();
}

/**
 * Assert that the running Node version is at least `minMajor.minMinor`.
 *
 * Mirrors `assertNodeVersion()` in `scripts/build-sea.mjs` and
 * `scripts/build-sea-windows.mjs`. The two originals differed ONLY in
 * their error-message label (`"Node version mismatch"` vs.
 * `"build-sea-windows: Node version mismatch"`), the inline feature
 * label (`"Node SEA"` vs `"node"`), and the upgrade-hint sentence
 * (Linux/macOS got the `nvm install` hint; Windows got nothing). The
 * `errorLabel`, `featureLabel`, and `upgradeHint` parameters let each
 * caller keep its own message byte-identical to before the extraction.
 *
 * The Windows-only platform gate (`process.platform !== "win32"` and
 * `UMACTUALLY_ALLOW_NON_WINDOWS_BUILD`) is NOT included here — it
 * belongs to the build-sea-windows script's specific surface, not to
 * the shared Node-version check.
 *
 * @param {number} minMajor
 * @param {number} minMinor
 * @param {string} errorLabel  Prefix for the thrown error message
 *   (e.g. `""` for the build-sea form, or `"build-sea-windows: "` for
 *   the Windows form).
 * @param {string} featureLabel  Inline label between the parenthesised
 *   description (e.g. `"Node SEA"` or `"node"`).
 * @param {string} upgradeHint  Optional trailing sentence appended to
 *   the mismatch error (the Linux/macOS caller passes
 *   `" Upgrade Node via 'nvm install 25' or use 'fnm use' with the repo's .nvmrc."`).
 */
export function assertNodeVersion(minMajor, minMinor, errorLabel, featureLabel, upgradeHint) {
  const version = process.versions.node ?? "";
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (match === null) {
    throw new Error(
      `Node version parse failed: process.versions.node="${version}". ` +
      `Expected >= ${minMajor}.${minMinor}.0.`,
    );
  }
  const major = Number(match[1]);
  const minor = Number(match[2]);
  if (
    major < minMajor ||
    (major === minMajor && minor < minMinor)
  ) {
    throw new Error(
      `${errorLabel}Node version mismatch: expected >= ${minMajor}.${minMinor}.0 ` +
      `(for ${featureLabel} --build-sea) but found ${version}.${upgradeHint ?? ""}`,
    );
  }
}

/**
 * Resolve the tsdown binary path. Returns `{ command, prefixArgs }`
 * suitable for `spawnSync(command, [...prefixArgs, ...args])`.
 *
 * Honors the `UMACTUALLY_TSDOWN_BIN` test-seam env var (when set,
 * points at either a Node-runnable script — `.mjs`/`.cjs`/`.js`, in
 * which case it's invoked via `process.execPath` — or a compiled
 * binary, in which case it's spawned directly). When unset, walks
 * `node_modules/.bin/tsdown` candidates (`tsdown.cmd`, `tsdown.ps1`,
 * `tsdown`) in the order appropriate for the current platform; falls
 * back to `npx --no-install tsdown`.
 *
 * @param {string} repoRoot  Absolute path to the repo root
 *   (i.e. the directory containing `node_modules`).
 * @returns {{ command: string, prefixArgs: string[] }}
 */
export function resolveTsdownCommand(repoRoot) {
  const override = process.env["UMACTUALLY_TSDOWN_BIN"];
  if (override !== undefined && override.length > 0) {
    if (TSDOWN_SCRIPT_DETECT.test(override)) {
      return { command: process.execPath, prefixArgs: [override] };
    }
    return { command: override, prefixArgs: [] };
  }
  // Local install via `node_modules/.bin/tsdown`. npm creates a
  // platform-specific shim here:
  //   - Linux/macOS:  node_modules/.bin/tsdown          (executable file)
  //   - Windows:      node_modules/.bin/tsdown.cmd      (cmd batch file)
  //   - Windows:      node_modules/.bin/tsdown.ps1      (PowerShell shim)
  // On Windows, spawnSync of the bare .bin/tsdown path fails with
  // ENOENT because the file is .cmd (or .ps1), not the literal
  // name. Resolve the actual shim by trying the three candidates
  // in order; fall back to `npx tsdown` (which handles platform
  // shims automatically) if none match.
  const binDir = join(repoRoot, "node_modules", ".bin");
  const candidates = process.platform === "win32"
    ? ["tsdown.cmd", "tsdown.ps1", "tsdown"]
    : ["tsdown"];
  for (const name of candidates) {
    const path = join(binDir, name);
    if (existsSync(path)) {
      // .ps1 must go through PowerShell, not spawnSync directly.
      if (name.endsWith(".ps1")) {
        return {
          command: "powershell",
          prefixArgs: ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path],
        };
      }
      return { command: path, prefixArgs: [] };
    }
  }
  // Last resort: `npx tsdown` defers to npm's shim resolution.
  return { command: "npx", prefixArgs: ["--no-install", "tsdown"] };
}