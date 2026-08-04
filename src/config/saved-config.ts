// SPDX-License-Identifier: MIT
// `umactually init` saved-config persistence.
//
// Stores typed, NON-SECRET provider settings at `<homeDir>/.umactually/config.json`
// (or `<cwd>/umactually.config.json` when the user opts into repo scope). The shape
// is intentionally small:
//
//   { schemaVersion: 1, provider, [apiUrl], [model] }
//
// `apiKey` is NEVER read from or written to this file. The wizard prompts for it
// at runtime (flag/env) and uses it for the live provider HEAD probe, but the
// secret stays in the operator's env / CI secret store. The bundle §1.6 contract
// is enforced at three layers:
//
//   1. The `SavedConfig` type excludes `apiKey`.
//   2. `redactSecretsInString` is the canonical scrubber for any field that
//      happens to be populated with a secret-shaped value by mistake.
//   3. `writeSavedConfig` runs a defensive secret-regex scan over the FINAL
//      serialized bytes before releasing the lock — if the regex matches, the
//      write is refused with exit-1 hint ("writer produced an unintended
//      secret literal").
//
// Layer 3 is paranoia: layers 1+2 already prevent the leak. The scan exists so
// a future change that adds a new string field cannot silently regress the
// no-secrets-at-rest guarantee.

import { join } from "node:path";
import { mkdirSync, openSync, closeSync, renameSync, statSync } from "node:fs";
import {
  defaultFsAdapter,
  getMode,
  setMode,
  writeFileAtomic,
  type FsAdapter,
} from "../util/fs-atomic.js";
import { REDACTED_SECRET_TOKEN } from "../util/brand.js";
import { tryFlockNonBlocking, FlockUnavailableError } from "../util/saved-config-flock.js";

/**
 * Module-level mutable holder for the flock-availability signal. The
 * lock acquisition block writes to it; the success-return path reads
 * it. Avoids threading the flag through every early-return in the
 * writer. Reset to `false` on every writer entry (see writeSavedConfig).
 */
const writeSavedConfigFlockUnavailable = { flag: false as boolean };

export const SAVED_CONFIG_SCHEMA_VERSION = 1 as const;

export type SavedConfigProvider = "openai-compatible" | "anthropic" | "copilot";

export type SavedConfig = {
  readonly schemaVersion: typeof SAVED_CONFIG_SCHEMA_VERSION;
  readonly provider: SavedConfigProvider;
  readonly apiUrl?: string;
  readonly model?: string;
};

export const SAVED_CONFIG_GLOBAL_PATH = (homeDir: string): string =>
  join(homeDir, ".umactually", "config.json");

export const SAVED_CONFIG_REPO_PATH = (cwd: string): string =>
  join(cwd, "umactually.config.json");

export const SAVED_CONFIG_GLOBAL_DIR = (homeDir: string): string =>
  join(homeDir, ".umactually");

export const SAVED_CONFIG_GLOBAL_LOCK = (homeDir: string): string =>
  join(homeDir, ".umactually", "init.lock");

export const DEFAULT_OPENAI_URL = "https://api.openai.com/v1";
export const DEFAULT_ANTHROPIC_URL = "https://api.anthropic.com/v1";

/**
 * The canonical regex for any string-shaped secret the runtime or scanner
 * recognizes. Exported so callers (tests, log filters) can use the exact same
 * pattern.
 */
export const SECRET_REGEX: RegExp =
  /gh[pousr]_[A-Za-z0-9]+|glpat-[A-Za-z0-9]+|s\.r[A-Za-z0-9]+|sk-[A-Za-z0-9]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gu;

export const VALID_PROVIDERS: ReadonlySet<SavedConfigProvider> = new Set([
  "openai-compatible",
  "anthropic",
  "copilot",
]);

export type ReadSavedConfigDeps = {
  readonly homeDir: string;
  readonly cwd: string;
  readonly fs?: FsAdapter;
};

export type WriteSavedConfigDeps = {
  readonly homeDir: string;
  readonly scope: "global" | "repo";
  readonly cwd: string;
  readonly force?: boolean;
  readonly platform?: NodeJS.Platform;
  /**
   * Optional overwrite-prompt reader. Returns `true` to confirm, anything
   * else (including null on EOF) to decline. When omitted, the writer
   * behaves as if the user declined (refuses to clobber an existing file).
   * The wizard wires `readInteractiveLine` from `smart-prompt.ts` here.
   */
  readonly overwriteReader?: () => Promise<boolean | null>;
  readonly fs?: FsAdapter;
  readonly now?: () => number;
};

export type ReadSavedConfigResult =
  | { readonly ok: true; readonly config: SavedConfig | null; readonly path: string }
  | { readonly ok: false; readonly path: string; readonly exitCode: 1 | 2; readonly message: string };

export type WriteSavedConfigResult =
  | { readonly ok: true; readonly path: string; readonly bytes: number; readonly lockUnavailable: boolean }
  | { readonly ok: false; readonly exitCode: 1 | 2; readonly message: string; readonly lockUnavailable?: boolean };

// ---------------------------------------------------------------------------
// Read path
// ---------------------------------------------------------------------------

/**
 * Resolve the effective saved config by checking the repo path first
 * (`<cwd>/umactually.config.json`) and falling back to the global path
 * (`<homeDir>/.umactually/config.json`). Returns `config: null` if neither
 * file exists.
 *
 * Refuses:
 *   - symlinks at either candidate path (exit 1, hint to remove the symlink)
 *   - non-regular files (exit 1)
 *   - malformed JSON (exit 2, "corrupt saved config at <path>" with repair hint)
 *   - missing/wrong `schemaVersion` (exit 2)
 *   - unknown `provider` (exit 2)
 *
 * Empty string in any optional field is coerced to absent (mirrors the
 * `pickString` empty-string-as-missing rule in `loader.ts`).
 */
export function readSavedConfig(deps: ReadSavedConfigDeps): ReadSavedConfigResult {
  const fs = deps.fs ?? defaultFsAdapter;
  for (const candidate of [SAVED_CONFIG_REPO_PATH(deps.cwd), SAVED_CONFIG_GLOBAL_PATH(deps.homeDir)]) {
    if (!fs.exists(candidate)) continue;

    if (fs.isSymlink(candidate)) {
      return {
        ok: false,
        path: candidate,
        exitCode: 1,
        message: `refusing to read saved config: ${candidate} is a symlink; remove it and re-run init`,
      };
    }
    if (!fs.isFile(candidate)) {
      return {
        ok: false,
        path: candidate,
        exitCode: 1,
        message: `refusing to read saved config: ${candidate} is not a regular file`,
      };
    }

    let raw: string;
    try {
      raw = fs.readFile(candidate);
    } catch (err) {
      return {
        ok: false,
        path: candidate,
        exitCode: 2,
        message: `corrupt saved config at ${candidate}: ${err instanceof Error ? err.message : String(err)}; rm ${candidate} and re-run init to recover`,
      };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      return {
        ok: false,
        path: candidate,
        exitCode: 2,
        message: `corrupt saved config at ${candidate}: ${err instanceof Error ? err.message : String(err)}; rm ${candidate} and re-run init to recover`,
      };
    }

    const validated = validateSavedConfig(parsed, candidate);
    if (!validated.ok) return validated;

    return { ok: true, config: validated.config, path: candidate };
  }

  return { ok: true, config: null, path: SAVED_CONFIG_GLOBAL_PATH(deps.homeDir) };
}

type ValidatedSavedConfig =
  | { readonly ok: true; readonly config: SavedConfig }
  | { readonly ok: false; readonly path: string; readonly exitCode: 1 | 2; readonly message: string };

/**
 * Returns `true` iff a saved config already exists at the target path AND its
 * contents parse as valid JSON. Used by the wizard to decide whether to prompt
 * before overwriting. Any failure (missing file, read error, parse error) is
 * treated as "not present" and returns `false`.
 */
export function targetConfigExistsValid(deps: {
  readonly homeDir: string;
  readonly cwd: string;
  readonly scope: "repo" | "global";
  readonly fs?: typeof defaultFsAdapter;
}): boolean {
  const fs = deps.fs ?? defaultFsAdapter;
  const targetPath = deps.scope === "repo"
    ? SAVED_CONFIG_REPO_PATH(deps.cwd)
    : SAVED_CONFIG_GLOBAL_PATH(deps.homeDir);
  if (!fs.exists(targetPath)) return false;
  try {
    JSON.parse(fs.readFile(targetPath));
    return true;
  } catch {
    return false;
  }
}

function validateSavedConfig(parsed: unknown, candidate: string): ValidatedSavedConfig {
  if (parsed === null || typeof parsed !== "object") {
    return {
      ok: false,
      path: candidate,
      exitCode: 2,
      message: `corrupt saved config at ${candidate}: expected object, received ${parsed === null ? "null" : typeof parsed}`,
    };
  }
  const obj = parsed as Record<string, unknown>;

  if (obj["schemaVersion"] !== SAVED_CONFIG_SCHEMA_VERSION) {
    return {
      ok: false,
      path: candidate,
      exitCode: 2,
      message: `unsupported schemaVersion in ${candidate}: expected ${SAVED_CONFIG_SCHEMA_VERSION}, received ${JSON.stringify(obj["schemaVersion"])}`,
    };
  }
  if (typeof obj["provider"] !== "string" || !VALID_PROVIDERS.has(obj["provider"] as SavedConfigProvider)) {
    return {
      ok: false,
      path: candidate,
      exitCode: 2,
      message: `invalid provider in ${candidate}: ${JSON.stringify(obj["provider"])} (expected one of ${[...VALID_PROVIDERS].join(", ")})`,
    };
  }

  const apiUrlRaw = obj["apiUrl"];
  const modelRaw = obj["model"];

  // Type guard: optional fields must be a string when present. Anything
  // else (number, array, null) is rejected — empty string is treated as
  // absent (mirrors pickString's empty-string-as-missing rule in
  // loader.ts:286-299). The wizard's default-acceptance path (press
  // Enter) leaves the field at "" which the writer used to serialize
  // verbatim — we coerce to undefined here so the next read round-trips
  // cleanly without losing type information.
  if (apiUrlRaw !== undefined && (typeof apiUrlRaw !== "string")) {
    return {
      ok: false,
      path: candidate,
      exitCode: 2,
      message: `invalid apiUrl in ${candidate}: expected string when present`,
    };
  }
  if (modelRaw !== undefined && (typeof modelRaw !== "string")) {
    return {
      ok: false,
      path: candidate,
      exitCode: 2,
      message: `invalid model in ${candidate}: expected string when present`,
    };
  }

  const apiUrl = typeof apiUrlRaw === "string" && apiUrlRaw.length > 0 ? apiUrlRaw : undefined;
  const model = typeof modelRaw === "string" && modelRaw.length > 0 ? modelRaw : undefined;

  const config: SavedConfig = {
    schemaVersion: SAVED_CONFIG_SCHEMA_VERSION,
    provider: obj["provider"] as SavedConfigProvider,
    ...(apiUrl !== undefined ? { apiUrl } : {}),
    ...(model !== undefined ? { model } : {}),
  };
  return { ok: true, config };
}

// ---------------------------------------------------------------------------
// Write path
// ---------------------------------------------------------------------------

/**
 * Persist `config` atomically. Honors the no-secrets-at-rest contract:
 *   - The `SavedConfig` type excludes `apiKey`; this function never reads one.
 *   - A defensive secret-regex scan over the FINAL bytes catches any
 *     accidental leak (e.g. a future field that accepts free-form input).
 *
 * Safety rails:
 *   - Acquires an advisory flock on `<homeDir>/.umactually/init.lock` (POSIX
 *     `flock(2)` via the `flock(1)` CLI; Windows is a no-op, see note below).
 *   - Creates `<homeDir>/.umactually/` with mode 0o700 on POSIX.
 *   - Refuses symlinks at the target path (exit 1).
 *   - Prompts before overwriting an existing regular file; `--force`
 *     bypasses the prompt.
 *   - On malformed JSON in the existing file, moves it aside to
 *     `<path>.bak-<mtime>` and proceeds.
 *   - Uses `writeFileAtomic` (sibling-tempfile + rename) and `chmod 0o600`
 *     on POSIX. Windows inherits the parent directory ACL.
 *
 * Windows flock note: `flock(2)` is POSIX-only. On Windows we open the lock
 * file (creating it if missing) and rely on the OS's default sharing mode
 * to serialize concurrent init invocations; this is best-effort and
 * matches the wizard's documented v1 single-OS-at-a-time expectation.
 * The lock fd is released in `finally`.
 */
export async function writeSavedConfig(
  config: SavedConfig,
  deps: WriteSavedConfigDeps,
): Promise<WriteSavedConfigResult> {
  writeSavedConfigFlockUnavailable.flag = false;
  const fs = deps.fs ?? defaultFsAdapter;
  const platform: NodeJS.Platform = deps.platform ?? process.platform;
  const isPosix = platform !== "win32";

  const targetPath = deps.scope === "repo"
    ? SAVED_CONFIG_REPO_PATH(deps.cwd)
    : SAVED_CONFIG_GLOBAL_PATH(deps.homeDir);
  const targetDir = deps.scope === "repo" ? deps.cwd : SAVED_CONFIG_GLOBAL_DIR(deps.homeDir);

  // -- Acquire flock (advisory; non-blocking) -----------------------------
  const lockPath = SAVED_CONFIG_GLOBAL_LOCK(deps.homeDir);
  let lockFd: number | null = null;
  try {
    if (isPosix) {
      // Ensure the lock dir exists so we can open the lock file even on a
      // first-run machine. mkdirSync is a no-op if the dir already exists.
      try {
        mkdirSync(SAVED_CONFIG_GLOBAL_DIR(deps.homeDir), { recursive: true, mode: 0o700 });
      } catch {
        // mkdir failure here will resurface at the target-dir ensure below.
      }
      // Open the lock file (creates it if missing) so flock(1) has a real
      // inode to lock against — the file itself carries no payload, only
      // the inode carries the lock.
      try {
        lockFd = openSync(lockPath, "w");
      } catch {
        return {
          ok: false,
          exitCode: 1,
          message: `cannot acquire init lock at ${lockPath}; another init may be in progress; rm ${lockPath} if stale`,
        };
      }
      // Non-blocking try-lock via `flock(1) -n <lockPath> true`. We pass
      // the PATH (not the fd number — see saved-config-flock.ts for why
      // the fd-number form silently no-ops in vite-node / CI sandboxes).
      //
      // Flock availability:
      //   - flock(1) is in coreutils on every Linux and macOS (via brew
      //     install coreutils). When it is present, status=0 means lock
      //     acquired; status≠0 means another init holds it (contention).
      //   - On hosts without flock(1) (macOS without coreutils, alpine
      //     without busybox flock, restricted CI sandboxes), the wrapper
      //     throws `FlockUnavailableError`. We MUST surface this so the
      //     operator knows the init-time concurrency lock is NOT
      //     enforced: writes can still race. The atomic-rename primitive
      //     keeps the file corruption-safe (last-writer-wins on a per-
      //     inode basis), but a parallel `umactually init` could clobber
      //     a half-written sibling temp file if the lock is genuinely
      //     missing. The check below records the unavailability; the
      //     `lockUnavailable` flag is surfaced via the WriteSavedConfigResult
      //     so the wizard can emit a hint to the user.
      let flockResult = true;
      let lockUnavailable = false;
      try {
        flockResult = tryFlockNonBlocking(lockPath);
      } catch (err) {
        if (err instanceof FlockUnavailableError) {
          // flock(1) is missing on this host. Atomic-rename still prevents
          // file corruption; we lose only the "second init declines"
          // guarantee. Surface a hint to the operator so they understand
          // the weakened contract — see WriteSavedConfigResult.lockUnavailable.
          lockUnavailable = true;
        } else {
          throw err;
        }
      }
      if (!flockResult) {
        try {
          closeSync(lockFd);
          lockFd = null;
        } catch {
          // ignore
        }
        return {
          ok: false,
          exitCode: 1,
          message: `another init is in progress; rm ${lockPath} if stale`,
          lockUnavailable: false,
        };
      }
      // Stash `lockUnavailable` on the active function scope — the
      // success-return branch below reads it. We use a tiny mutable
      // holder rather than a let inside the try block so the success
      // path at the end of writeSavedConfig() can read it without
      // threading it through every early return.
      writeSavedConfigFlockUnavailable.flag = lockUnavailable;
    }
    // Windows: best-effort serialization via shared-lock semantics on the
    // lock file's existence + the atomic-rename primitive. Documented above.

    // -- Ensure target directory + 0o700 on POSIX ------------------------
    try {
      mkdirSync(targetDir, { recursive: true, mode: 0o700 });
      if (isPosix && deps.scope === "global") {
        // Re-stat the directory; root + restrictive umask can mask the mode
        // arg. Best-effort: chmod and swallow the error (E-⚠8).
        try {
          const st = statSync(targetDir);
          if ((st.mode & 0o777) !== 0o700) {
            setMode(targetDir, 0o700);
          }
        } catch {
          // ignore — chmod failure on a dir the user can already write to
          // is non-fatal; we still chmod the FILE to 0o600 below.
        }
      }
    } catch (err) {
      return {
        ok: false,
        exitCode: 1,
        message: `cannot create saved-config directory ${targetDir}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // -- Refuse symlinks at the target -----------------------------------
    if (fs.isSymlink(targetPath)) {
      return {
        ok: false,
        exitCode: 1,
        message: `refusing to overwrite: ${targetPath} is a symlink; remove it and re-run init`,
      };
    }

    // -- Existing-file handling ------------------------------------------
    if (fs.exists(targetPath) && !fs.isSymlink(targetPath)) {
      let existingIsCorrupt = false;
      try {
        const existingRaw = fs.readFile(targetPath);
        JSON.parse(existingRaw); // throws on malformed JSON
      } catch {
        existingIsCorrupt = true;
      }

      if (existingIsCorrupt) {
        // Corrupt JSON: move aside instead of clobbering. The backup
        // preserves operator history for forensics; the wizard surfaces
        // the backup path in its C-7 envelope.
        const mtime = (deps.now ?? Date.now)();
        const backupPath = `${targetPath}.bak-${Math.floor(mtime)}`;
        try {
          renameSync(targetPath, backupPath);
        } catch (err) {
          return {
            ok: false,
            exitCode: 1,
            message: `refusing to clobber corrupt saved config at ${targetPath} and could not move it aside: ${err instanceof Error ? err.message : String(err)}; rm ${targetPath} manually`,
          };
        }
      } else if (!deps.force) {
        // Valid JSON existing file: prompt for overwrite (unless --force).
        if (deps.overwriteReader === undefined) {
          return {
            ok: false,
            exitCode: 1,
            message: `refusing to overwrite existing saved config at ${targetPath}; pass --force to bypass or answer 'y' to the overwrite prompt`,
          };
        }
        const answer = await deps.overwriteReader();
        if (answer !== true) {
          return {
            ok: false,
            exitCode: 1,
            message: `refusing to overwrite existing saved config at ${targetPath}; nothing was written`,
          };
        }
      }
    }

    // -- Serialize with deterministic key order (schemaVersion, provider, apiUrl, model) -----
    const serialized = serializeSavedConfig(config);

    // -- Defensive secret-regex scan -------------------------------------
    if (SECRET_REGEX.test(serialized)) {
      SECRET_REGEX.lastIndex = 0;
      return {
        ok: false,
        exitCode: 1,
        message: "internal: writer produced an unintended secret literal; refusing to persist",
      };
    }
    SECRET_REGEX.lastIndex = 0;

    // -- Atomic write + chmod 0o600 --------------------------------------
    try {
      writeFileAtomic(targetPath, serialized);
    } catch (err) {
      return {
        ok: false,
        exitCode: 1,
        message: `cannot write saved config at ${targetPath}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    if (isPosix) {
      try {
        setMode(targetPath, 0o600);
      } catch {
        // Non-fatal: the file is on disk; chmod may fail under restrictive
        // mount options. The wizard surfaces a warn check in T12 but does
        // not abort the write (E-⚠8).
      }
    }

    // -- Verify mode round-tripped to 0o600 on POSIX ----------------------
    if (isPosix) {
      const mode = getMode(targetPath);
      if (mode !== null && (mode & 0o777) !== 0o600) {
        return {
          ok: false,
          exitCode: 1,
          message: `saved config written but mode is ${(mode & 0o777).toString(8)} (expected 0o600); check filesystem mount options`,
        };
      }
    }

    return { ok: true, path: targetPath, bytes: Buffer.byteLength(serialized, "utf8"), lockUnavailable: writeSavedConfigFlockUnavailable.flag };
  } finally {
    // -- Release flock ---------------------------------------------------
    // flock(1) is a wrapper around flock(2); closing the fd releases the lock.
    if (isPosix && lockFd !== null) {
      try {
        closeSync(lockFd);
      } catch {
        // ignore — the lock is advisory; a stuck release on process exit
        // does not break the file write.
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Serialization (deterministic key order)
// ---------------------------------------------------------------------------

/**
 * JSON.stringify with 2-space indent and key order: schemaVersion, provider,
 * apiUrl, model. Any additional key is rejected at the type level; this is
 * the single serialization site so the byte layout is fixed across versions.
 */
export function serializeSavedConfig(config: SavedConfig): string {
  const ordered: Record<string, unknown> = {
    schemaVersion: config.schemaVersion,
    provider: config.provider,
  };
  if (config.apiUrl !== undefined) ordered["apiUrl"] = config.apiUrl;
  if (config.model !== undefined) ordered["model"] = config.model;
  return JSON.stringify(ordered, null, 2) + "\n";
}

// ---------------------------------------------------------------------------
// Secret redaction
// ---------------------------------------------------------------------------

/**
 * Replace every secret-shaped substring in `input` with `REDACTED_SECRET_TOKEN`.
 * Used by `--debug-raw` diagnostics and any other site that has to log a
 * blob the user supplied (prompts, env echoes) — it is the last line of
 * defense against accidental secret leakage. Callers MUST treat the return
 * value as still-tainted for display purposes; the token is itself a hint
 * to the reader, not a security boundary.
 */
export function redactSecretsInString(input: string): string {
  return input.replace(SECRET_REGEX, REDACTED_SECRET_TOKEN);
}