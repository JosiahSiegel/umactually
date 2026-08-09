import { readdirSync as fsReaddirSync, realpathSync as fsRealpathSync } from "node:fs";
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
 * Repository-relative filenames (and glob patterns) UmActually
 * auto-discovers when no explicit prompt-file or prompt-files override
 * is supplied. Each entry is checked with `fs.stat`; missing files
 * (and glob patterns that match nothing) are silently skipped so repos
 * that lack any of these files fall through to the built-in default
 * system prompt (or empty additional prompt).
 *
 * Order matters: files are concatenated in the listed order. The
 * recognized conventions are organized across three tiers:
 *
 * **Tier 1 — cross-tool "umbrella" conventions** (the five entries at
 * the top are the legacy short list; the three local/override variants
 * below extend the same families):
 *
 * - `CLAUDE.md` — Anthropic Claude Code / Cowork repo-level
 *   instructions.
 * - `AGENTS.md` — emerging agent-agnostic convention (also adopted by
 *   Cursor, aider, and OpenAI Codex).
 * - `.github/copilot-instructions.md` — GitHub Copilot Coding Agent
 *   instructions (documented at
 *   https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot).
 * - `.cursorrules` — Cursor legacy single-file rules format.
 * - `GEMINI.md` — Google Gemini CLI repo-level instructions.
 * - `AGENTS.local.md` — local-machine override of `AGENTS.md`
 *   (gitignored personal preferences).
 * - `AGENTS.override.md` — workspace-level override of `AGENTS.md`
 *   (committed team override).
 * - `CLAUDE.local.md` — local-machine override of `CLAUDE.md`.
 *
 * **Tier 3 — IDE/tool-specific single-file rules** (legacy flat-file
 * formats that the auto-discovery layer still honors for backwards
 * compatibility):
 *
 * - `.windsurfrules` — Windsurf legacy single-file rules.
 * - `.clinerules` — Cline legacy single-file rules.
 * - `.roorules` — Roo Code legacy single-file rules.
 * - `.kilocoderules` — Kilo Code legacy single-file rules.
 * - `.github/git-commit-instructions.md` — GitHub Copilot
 *   commit-message conventions.
 * - `.opencode/AGENTS.md` — OpenCode agent instructions file.
 *
 * **Glob patterns** — the recursive `.rules/`-directory formats
 * adopted by the same tools when they outgrew the single-file
 * variants. Each glob is anchored at the repo root and must match
 * a regular file; the resolver expands globs safely (the
 * call site that consumes this list enforces an allowlist-aware
 * directory read):
 *
 * - `.github/instructions/*.instructions.md` — GitHub Copilot
 *   multi-file instructions mode.
 * - `.cursor/rules/*.mdc` — Cursor modern `.mdc` rule files.
 * - `.clinerules/**​/*.md` — Cline recursive rules.
 * - `.roo/rules/**​/*.md` — Roo Code recursive rules.
 * - `.roo/rules-*​/**​/*.md` — Roo Code scoped rules variants.
 * - `.kilocode/rules/**​/*.md` — Kilo Code recursive rules.
 * - `.kilocode/rules-*​/**​/*.md` — Kilo Code scoped rules variants.
 * - `.continue/rules/*.md` — Continue assistant rules.
 * - `.windsurf/rules/**​/*.md` — Windsurf recursive rules.
 * - `.claude/rules/**​/*.md` — Claude Code path-scoped rules.
 *
 * **Human convention files** — README, CONTRIBUTING, the codes of
 * conduct, etc. These are not AI-instruction files; they are
 * appended so the model has the project context a human contributor
 * would read on day one. They share this array for now but are
 * loaded with a smaller per-file cap at the call site (TODO part 5)
 * to avoid the aggregate byte budget being consumed by long
 * LICENSE/CHANGELOG files.
 *
 * - `README.md`
 * - `CONTRIBUTING.md`
 * - `CODE_OF_CONDUCT.md`
 * - `SECURITY.md`
 * - `CHANGELOG.md`
 * - `LICENSE`
 *
 * Excluded by design (out of scope for this iteration):
 * Tier 5 product-config files (`.aider.conf.yml`, `opencode.json`,
 * `kilo.jsonc`) — those are parsed by the tools themselves, not
 * surfaced as prompt text. Subdirectory walking (e.g. `docs/AGENTS.md`)
 * is also excluded; this list stays anchored at the repo root plus
 * the explicitly-listed leading subdirectories (`.github/`,
 * `.cursor/`, `.clinerules/`, `.roo/`, `.kilocode/`,
 * `.continue/`, `.windsurf/`, `.claude/`, `.opencode/`).
 */
export const DEFAULT_PROMPT_FILE_PATHS: readonly string[] = [
  // Tier 1 — cross-tool umbrella conventions (legacy top-5 + local/override variants)
  "CLAUDE.md",
  "AGENTS.md",
  ".github/copilot-instructions.md",
  ".cursorrules",
  "GEMINI.md",
  "AGENTS.local.md",
  "AGENTS.override.md",
  "CLAUDE.local.md",
  // Tier 3 — IDE/tool-specific single-file rules
  ".windsurfrules",
  ".clinerules",
  ".roorules",
  ".kilocoderules",
  ".github/git-commit-instructions.md",
  ".opencode/AGENTS.md",
  // Glob patterns — recursive `.rules/` directory formats
  ".github/instructions/*.instructions.md",
  ".cursor/rules/*.mdc",
  ".clinerules/**/*.md",
  ".roo/rules/**/*.md",
  ".roo/rules-*/**/*.md",
  ".kilocode/rules/**/*.md",
  ".kilocode/rules-*/**/*.md",
  ".continue/rules/*.md",
  ".windsurf/rules/**/*.md",
  ".claude/rules/**/*.md",
  // Human convention files (loaded with a smaller per-file cap at the call site)
  "README.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "SECURITY.md",
  "CHANGELOG.md",
  "LICENSE",
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

/**
 * Returns true when `pattern` contains any of the glob metacharacters
 * the rest of this module treats as "needs expansion": `*`, `?`, `[`, `{`.
 * Brace expansion (`{a,b}`) is detected at this gate but intentionally
 * NOT supported by the matcher below — it is grouped with the other
 * metacharacters so callers can fail fast / reject braces uniformly.
 */
function isGlobPattern(pattern: string): boolean {
  return /[*?[{]/u.test(pattern);
}

/**
 * Translate a single glob segment (`*`, `**`, `?`, `[abc]`, or literal)
 * into the corresponding regex source fragment. `/` is treated as a path
 * separator and never matches `*` or `?`; only `**` may span `/`. Char
 * classes are passed through verbatim so `[abc]` and `[^abc]` both work.
 */
function globToRegexSource(pattern: string): string {
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === undefined) continue;
    if (ch === "*") {
      // `**` → match anything including `/`; `*` → match anything except `/`.
      if (pattern[i + 1] === "*") {
        out += ".*";
        i++;
        // Consume an immediately following `/` so `**/foo` and `foo/**/bar`
        // both compile cleanly without an awkward `.*/foo` prefix.
        if (pattern[i + 1] === "/") i++;
      } else {
        out += "[^/]*";
      }
    } else if (ch === "?") {
      out += "[^/]";
    } else if (ch === "[") {
      // Pass char class through verbatim up to the closing `]`.
      const end = pattern.indexOf("]", i + 1);
      if (end === -1) {
        out += "\\[";
      } else {
        out += pattern.slice(i, end + 1);
        i = end;
      }
    } else {
      // Regex-escape any literal so `.`, `+`, `(`, `{`, etc. don't
      // break out. Brace-expansion patterns (`{a,b}`) are detected at
      // the gate but never expanded here — the braces are treated as
      // literal regex characters.
      out += ch.replace(/[\\^$.+()|{}]/gu, "\\$&");
    }
  }
  return out;
}

function globToRegExp(pattern: string): RegExp {
  // Anchor to the whole string; the path is fully-resolved when we test it.
  return new RegExp(`^${globToRegexSource(pattern)}$`, "u");
}

/**
 * Synchronously expand glob patterns into a flat list of file paths that
 * exist under `cwd`. Non-glob entries are passed through unchanged so the
 * caller can mix flat paths and patterns in a single argument list.
 *
 * Order contract: matches from each glob are returned in the order
 * `fs.readdirSync({ recursive: true })` yields them; the outer result
 * concatenates per-glob in `paths` order. This preserves the
 * "concatenate in the listed order" property that `readPromptFiles`
 * relies on.
 *
 * Symlink safety: every matched path is resolved with `realpathSync`
 * and silently dropped if it escapes `cwd`. This mirrors the
 * `readPromptFiles` boundary so a glob can never smuggle a file from
 * outside the repo root.
 *
 * Brace expansion (`{a,b}`) is detected (so callers see the same
 * metacharacter surface as `picomatch`) but intentionally NOT
 * supported — those entries expand to zero matches.
 */
export function resolveGlobs(paths: readonly string[], cwd: string): readonly string[] {
  const cwdReal = fsRealpathSync(cwd);
  const cwdRealWithSep = cwdReal.endsWith(pathSep) ? cwdReal : cwdReal + pathSep;
  // Walk the cwd tree once. `readdirSync` with `recursive: true` returns
  // Dirent objects tagged with their parent path. `Dirent.parentPath` is
  // ABSOLUTE (not relative to the readdir root), so we strip the cwd
  // prefix to reconstruct the repo-relative path used by the matcher.
  // We use the unresolved `cwd` here (not `cwdReal`) because
  // `parentPath` was produced by the same kernel walk that produced
  // the entries — they share the same unresolved spelling.
  const cwdWithSep = cwd.endsWith(pathSep) ? cwd : cwd + pathSep;
  const entries = fsReaddirSync(cwd, { recursive: true, withFileTypes: true });
  const out: string[] = [];
  for (const raw of paths) {
    if (!isGlobPattern(raw)) {
      out.push(raw);
      continue;
    }
    const re = globToRegExp(raw);
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      // `Dirent.parentPath` is absolute (e.g. `/repo/.cursor/rules`).
      // An entry whose parent is exactly `cwd` sits at the cwd root;
      // anything deeper gets its cwd-prefix stripped.
      const parent = entry.parentPath;
      const rel =
        parent === undefined || parent === null || parent === cwd
          ? entry.name
          : parent.startsWith(cwdWithSep)
            ? `${parent.slice(cwdWithSep.length)}/${entry.name}`
            : null;
      if (rel === null) continue;
      if (!re.test(rel)) continue;
      // Realpath guard: skip anything that resolves outside cwd. We
      // resolve against `cwdReal` (the symlink-free root) so that a
      // symlink that points back into cwd is still accepted, matching
      // the semantic `readPromptFiles` enforces.
      const absolute = pathJoin(cwdReal, rel);
      let real: string;
      try {
        real = fsRealpathSync(absolute);
      } catch {
        continue;
      }
      if (!(real === cwdReal || real.startsWith(cwdRealWithSep))) continue;
      out.push(rel);
    }
  }
  return out;
}