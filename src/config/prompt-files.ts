import { realpath as fsRealpath, stat as fsStat, readFile as fsReadFile } from "node:fs/promises";
import { isAbsolute, join as pathJoin, resolve as pathResolve, sep as pathSep, posix } from "node:path";

import { InvalidConfigError, PromptFileError } from "./errors.js";

const PROMPT_SEPARATOR = "\n\n---\n\n";

export type PromptFileSystem = {
  realpath(cwd: string): Promise<string>;
  realpathWithinCwd(
    path: string,
    cwdReal: string,
    self: PromptFileSystem,
  ): Promise<{ readonly absolute: string; readonly withinCwd: boolean }>;
  stat(path: string): Promise<{ readonly isFile: boolean; readonly size: number }>;
  readFile(path: string): Promise<string>;
};

const nodePromptFileSystem: PromptFileSystem = {
  realpath(cwd) {
    return fsRealpath(cwd);
  },
  async realpathWithinCwd(path, cwdReal, _self) {
    const absolute = pathResolve(cwdReal, path);
    let real: string;
    try {
      real = await fsRealpath(absolute);
    } catch {
      return { absolute, withinCwd: isWithinCwdLexical(absolute, cwdReal) };
    }
    return { absolute: real, withinCwd: isWithinCwdReal(real, cwdReal) };
  },
  stat(path) {
    return fsStat(path).then((s) => ({ isFile: s.isFile(), size: s.size }));
  },
  readFile(path) {
    return fsReadFile(path, "utf8");
  },
};

function isWithinCwdReal(real: string, cwdReal: string): boolean {
  if (process.platform === "win32") {
    const r = real.toLowerCase();
    const c = cwdReal.toLowerCase();
    return r === c || r.startsWith(`${c}${pathSep}`);
  }
  return real === cwdReal || real.startsWith(`${cwdReal}/`);
}

function isWithinCwdLexical(absolute: string, cwdReal: string): boolean {
  const rel = posix.relative(toPosix(cwdReal), toPosix(absolute));
  return rel !== "" && !rel.startsWith("..") && !posix.isAbsolute(rel);
}

function toPosix(value: string): string {
  return process.platform === "win32" ? value.replace(/\\/g, "/") : value;
}

/**
 * Reads each file under `cwd` and concatenates contents.
 * - Rejects any path whose resolved-realpath escapes `cwd`.
 * - Enforces a per-file and aggregate byte cap.
 * - Never includes file contents in errors; only the `[REDACTED]` marker.
 */
export async function readPromptFiles(
  paths: readonly string[],
  byteCap: number,
  options: { readonly cwd: string; readonly fs?: PromptFileSystem },
): Promise<string> {
  if (!Number.isInteger(byteCap) || byteCap <= 0) {
    throw new InvalidConfigError("prompt.byteCap", `expected positive integer, received ${byteCap}`);
  }
  const fs = options.fs ?? nodePromptFileSystem;
  const cwdReal = await fs.realpath(options.cwd);

  const parts: string[] = [];
  let aggregateBytes = 0;

  for (const rawPath of paths) {
    if (typeof rawPath !== "string" || rawPath.length === 0) {
      throw new PromptFileError(String(rawPath), "not-found");
    }
    if (isAbsolute(rawPath)) {
      throw new PromptFileError(rawPath, "outside-cwd");
    }
    const resolved = await fs.realpathWithinCwd(rawPath, cwdReal, fs);
    if (!resolved.withinCwd) {
      throw new PromptFileError(rawPath, "outside-cwd");
    }
    let stat: { readonly isFile: boolean; readonly size: number };
    try {
      stat = await fs.stat(resolved.absolute);
    } catch {
      throw new PromptFileError(rawPath, "not-found");
    }
    if (!stat.isFile) {
      throw new PromptFileError(rawPath, "not-a-file");
    }
    if (stat.size > byteCap) {
      throw new PromptFileError(rawPath, "byte-cap-exceeded");
    }
    aggregateBytes += stat.size;
    if (aggregateBytes > byteCap) {
      throw new PromptFileError(rawPath, "byte-cap-exceeded");
    }
    let text: string;
    try {
      text = await fs.readFile(resolved.absolute);
    } catch {
      throw new PromptFileError(rawPath, "read-failed");
    }
    parts.push(text);
  }

  return parts.join(PROMPT_SEPARATOR);
}

/**
 * Split a newline- or comma-separated list of paths into a deduplicated,
 * ordered, trimmed array of non-empty strings. Empty input yields an
 * empty array. Order is preserved by first-occurrence.
 *
 * Public so tests can pin the splitting contract directly and so the
 * config-loader pipeline (which receives raw env-var strings) can
 * apply the same splitting semantics as the live prompt assembly.
 */
export function splitPromptFileList(raw: string | null | undefined): readonly string[] {
  if (typeof raw !== "string" || raw.length === 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  // Split on commas AND any newline flavor (LF, CR-LF, CR-only).
  // The trim() on each piece also strips trailing CR that CR-LF
  // leaves behind after the LF split, so the round-trip is safe on
  // Windows-pasted strings.
  for (const piece of raw.split(/[\n\r,]/u)) {
    const trimmed = piece.trim();
    if (trimmed.length === 0) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * Repository-relative filenames UmActually auto-discovers when no explicit
 * prompt-file or prompt-files override is supplied. Each entry is checked
 * with `fs.stat`; missing files are silently skipped so repos that lack
 * any of these files fall through to the built-in default system prompt
 * (or empty additional prompt).
 *
 * Order matters: files are concatenated in the listed order. The
 * recognized conventions are:
 *
 * - `CLAUDE.md` — Anthropic Claude Code / Cowork repo-level instructions.
 * - `AGENTS.md` — emerging agent-agnostic convention (also adopted by
 *   Cursor, aider, and OpenAI Codex).
 * - `.github/copilot-instructions.md` — GitHub Copilot Coding Agent
 *   instructions (documented at
 *   https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot).
 * - `.cursorrules` — Cursor legacy single-file rules format.
 * - `GEMINI.md` — Google Gemini CLI repo-level instructions.
 *
 * Excluded by design (deferred to a future iteration that needs glob
 * support): `.github/instructions/*.md` (Copilot multi-file mode) and
 * `.clinerules/*.md` (Cline). Glob support requires an allowlist-aware
 * directory read; the current `readPromptFiles` API only accepts a flat
 * list of paths.
 */
export const DEFAULT_PROMPT_FILE_PATHS: readonly string[] = [
  "CLAUDE.md",
  "AGENTS.md",
  ".github/copilot-instructions.md",
  ".cursorrules",
  "GEMINI.md",
];

/**
 * Resolve `DEFAULT_PROMPT_FILE_PATHS` against `cwd` and return only the
 * paths that exist on disk and are regular files. Missing entries are
 * silently dropped (not an error). Symlink targets are NOT followed here
 * — `readPromptFiles` does its own realpath resolution at read time.
 *
 * Pure (no global fs). Accepts the same `PromptFileSystem` shape used
 * by `readPromptFiles` so tests can inject a fake filesystem. The
 * default implementation uses the real `node:fs`.
 */
export async function resolveDefaultPromptFiles(
  cwd: string,
  fs: {
    readonly stat: (path: string) => Promise<{ readonly isFile: boolean; readonly size: number }>;
  },
): Promise<readonly string[]> {
  const existing: string[] = [];
  for (const candidate of DEFAULT_PROMPT_FILE_PATHS) {
    try {
      // Use path.join for proper platform-aware path composition
      // (handles POSIX, Windows separators, and trailing slashes on
      // cwd without ad-hoc string manipulation). DEFAULT_PROMPT_FILE_PATHS
      // entries are hardcoded relative paths so this is safe; the
      // security boundary for explicit `prompt-files` arrays is
      // enforced separately inside `readPromptFiles`.
      const stat = await fs.stat(pathJoin(cwd, candidate));
      if (stat.isFile) {
        existing.push(candidate);
      }
    } catch {
      // ENOENT (or any other stat failure): silently skip. The user did
      // not opt in to this file; its absence is not an error.
    }
  }
  return existing;
}