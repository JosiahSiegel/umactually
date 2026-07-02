import { realpath as fsRealpath, stat as fsStat, readFile as fsReadFile } from "node:fs/promises";
import { isAbsolute, resolve as pathResolve, sep as pathSep, posix } from "node:path";

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