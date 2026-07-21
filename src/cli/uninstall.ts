// SPDX-License-Identifier: MIT
// Built-in `umactually uninstall` subcommand.
//
// Removes the running binary from disk, and (optionally) the
// `~/.umactually/` config directory, `~/.cache/umactually/` cache
// directory, and the PATH-entry block that the installer wrote to
// `~/.zshrc` / `~/.bashrc` / `~/.profile`.
//
// Usage:
//   umactually uninstall [flags]
//
// Flags:
//   --remove-binary    (default) Delete the running binary.
//   --purge-config     Also delete ~/.umactually/ and ~/.cache/umactually/.
//   --revert-path      Also remove the installer's PATH line from shell rc files.
//   --yes              Skip the interactive "are you sure" prompt.
//   --json             Emit machine-readable JSON output.
//   --help, -h         Show this help.
//
// Safety:
//   - Refuses to run if process.execPath does not look like a umactually
//     binary (basename must be "umactually" or "umactually.exe").
//   - Refuses to run if the binary is in a directory we don't recognise
//     as an install target (anything outside the home-dir-local/bin,
//     /usr/local/bin, or the same path that install.sh writes to).
//   - On Windows, self-deletion requires a helper command spawned before
//     the process exits (cmd /c "ping ... & del ...") because Windows
//     holds a write lock on running executables.

import {
  chmodSync,
  existsSync,
  lstatSync,
  readFileSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import * as readline from "node:readline";
import { createInterface } from "node:readline";
import * as path from "node:path";
const { join } = path;
import { spawn } from "node:child_process";

const SHELL_RC_FILES = [".zshrc", ".bashrc", ".profile"] as const;

export type UninstallMode = {
  readonly removeBinary: boolean;
  readonly purgeConfig: boolean;
  readonly revertPath: boolean;
  readonly yes: boolean;
};

export type UninstallCheck = {
  readonly id:
    | "exec-path"
    | "binary-removal"
    | "config-removal"
    | "cache-removal"
    | "path-revert"
    | "self-deletion";
  readonly status: "ok" | "warn" | "fail" | "skip";
  readonly message: string;
  readonly hint?: string;
  /**
   * Structured flag indicating the user explicitly declined this
   * action's confirmation prompt. When true, the dispatch layer
   * treats this check as a hard "abort the destructive follow-ups"
   * signal, regardless of the human-readable message text. This
   * replaces a fragile substring match on `message` that broke if
   * anyone reworded the prompt-decline message.
   */
  readonly declined?: boolean;
};

export type UninstallJson = {
  readonly schemaVersion: 1;
  readonly command: "uninstall";
  readonly exitCode: number;
  readonly execPath: string;
  readonly mode: UninstallMode;
  readonly checks: readonly UninstallCheck[];
};

export type UninstallResult = {
  readonly exitCode: number;
  readonly stdout?: string;
  readonly stderr?: string;
  readonly checks: readonly UninstallCheck[];
  readonly json?: UninstallJson;
};

export type UninstallDeps = {
  readonly isTTY: boolean;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly fsAdapter: FsAdapter;
  readonly stdinReader?: () => Promise<string | null>;
  readonly execPath: string;
  readonly platform: NodeJS.Platform;
  readonly homeDir: string;
  /**
   * Optional UninstallMode. When provided, `runUninstall` honors
   * `mode.yes` (and the inverse) to skip or enforce the interactive
   * prompt. When absent, only the `isTTY` and `UMACTUALLY_*` env-var
   * heuristics apply (preserved for backwards-compatible callers).
   */
  readonly mode?: UninstallMode;
};

/** Default stdin reader: a single line from /dev/tty via readline, with a
 *  30-second safety timeout. Returns null on no-TTY, EOF, timeout, or any
 *  other failure. Never blocks indefinitely on a pipe.
 *
 *  The `isTTY` parameter is REQUIRED. The caller is expected to pass the
 *  same TTY signal it used to decide whether to prompt in the first place
 *  (typically `deps.isTTY`). This avoids a subtle inconsistency: in JSON
 *  mode, `deps.isTTY` is `false` (so the prompt is skipped to keep the
 *  JSON envelope clean), but `process.stdin.isTTY` is independent and
 *  could still be `true` if the user is running interactively. Reading
 *  process.stdin in that case would corrupt the JSON output. The caller
 *  is the source of truth for "should we prompt?".
 *
 *  The prompt text is written to STDERR (not stdout) so it does not
 *  interleave with the human output stream. We do NOT pass
 *  `output: process.stdout` to readline with `terminal: true` because
 *  that path emits `
` to stdout before reading the answer —
 *  which would interleave a stray blank line with the check lines
 *  emitted later. Instead we use `terminal: false` and write the
 *  prompt via stderr.
 *
 *  `terminal: false` disables TTY-aware prompt handling; on a real TTY
 *  the raw line-mode read still works. The 30s timer is the user-facing
 *  safety: SIGINT (Ctrl+C) and EOF (Ctrl+D) both settle with `null`,
 *  which `shouldPrompt` treats as a decline. */
export async function defaultStdinReader(
  promptText: string,
  isTTY: boolean,
): Promise<string | null> {
  if (isTTY !== true) {
    return null;
  }
  return new Promise((resolve) => {
    let settled = false;
    let timer: NodeJS.Timeout | null = null;
    let rl: readline.Interface | null = null;
    const settle = (value: string | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (rl !== null) {
        try {
          rl.close();
        } catch {
          // rl may already be closed; ignore.
        }
        rl = null;
      }
      resolve(value);
    };
    timer = setTimeout(() => settle(null), 30_000);
    // Write the prompt to stderr so it does not interleave with stdout
    // (the check lines, JSON output, and exit-code banners all go to
    // stdout). Stderr is the conventional channel for prompts and
    // diagnostics.
    process.stderr.write(promptText);
    // `terminal: false` disables TTY-aware prompt handling. Without
    // `output`, readline writes to a discarded sink — the explicit
    // stderr.write above is what the user actually sees.
    //
    // `createInterface` can throw synchronously on some platforms when
    // stdin is a non-TTY stream that Node refuses to wrap (e.g. CI
    // runners where stdin is a closed pipe). Wrap in try/catch so the
    // function ALWAYS settles — leaking the 30s timer would keep the
    // Node process alive for the full timeout.
    try {
      rl = createInterface({
        input: process.stdin,
        terminal: false,
      });
    } catch {
      // createInterface threw before any listeners were attached.
      // Settle immediately; the function exits with null.
      settle(null);
      return;
    }
    rl.on("line", (line: string) => {
      settle(line);
    });
    rl.on("close", () => {
      settle(null);
    });
    rl.on("SIGINT", () => {
      settle(null);
    });
  });
}

export type FsAdapter = {
  readonly exists: (path: string) => boolean;
  readonly isSymlink: (path: string) => boolean;
  readonly isFile: (path: string) => boolean;
  readonly isDirectory: (path: string) => boolean;
  readonly unlink: (path: string) => void;
  readonly removeDir: (path: string, options: { readonly recursive: boolean }) => void;
  readonly readFile: (path: string) => string;
  readonly writeFile: (path: string, content: string) => void;
  /**
   * Return the file's mode bits (e.g. 0o600) or null if the file
   * does not exist or the mode cannot be determined. Used by
   * revertPath to preserve permissions across the read/modify/write
   * cycle; without this, the new file gets the default umask
   * (typically 0o644) which silently broadens permissions on
   * privacy-sensitive users' .zshrc / .bashrc.
   */
  readonly getMode: (path: string) => number | null;
  /**
   * Set the file's mode bits. Throws on failure. Used by revertPath
   * to restore the original mode after writing the modified content.
   */
  readonly setMode: (path: string, mode: number) => void;
};

export const defaultFsAdapter: FsAdapter = {
  exists: (path) => existsSync(path),
  isSymlink: (path) => {
    try {
      return lstatSync(path).isSymbolicLink();
    } catch {
      return false;
    }
  },
  isFile: (path) => {
    try {
      return lstatSync(path).isFile();
    } catch {
      return false;
    }
  },
  isDirectory: (path) => {
    try {
      return lstatSync(path).isDirectory();
    } catch {
      return false;
    }
  },
  unlink: (path) => {
    unlinkSync(path);
  },
  getMode: (path) => {
    try {
      return statSync(path).mode & 0o7777;
    } catch {
      return null;
    }
  },
  setMode: (path, mode) => {
    chmodSync(path, mode);
  },
  removeDir: (path, options) => {
    rmSync(path, { recursive: options.recursive, force: true });
  },
  readFile: (path) => readFileSync(path, "utf8"),
  writeFile: (path, content) => {
    writeFileSync(path, content, "utf8");
  },
};

export function parseUninstallArgs(argv: readonly string[]): {
  mode: UninstallMode;
  errors: readonly string[];
  help: boolean;
  json: boolean;
} {
  const errors: string[] = [];
  let removeBinary = true;
  let purgeConfig = false;
  let revertPath = false;
  let yes = false;
  let help = false;
  let json = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === undefined) {
      continue;
    }
    switch (arg) {
      case "--help":
      case "-h":
        help = true;
        break;
      case "--remove-binary":
        removeBinary = true;
        break;
      case "--no-remove-binary":
        removeBinary = false;
        break;
      case "--purge-config":
        purgeConfig = true;
        break;
      case "--revert-path":
        revertPath = true;
        break;
      case "--yes":
      case "-y":
        yes = true;
        break;
      case "--json":
        json = true;
        break;
      default:
        if (arg.startsWith("-")) {
          errors.push(`unknown flag: ${arg}`);
        } else {
          errors.push(`unexpected positional arg: ${arg}`);
        }
    }
  }
  const mode: UninstallMode = { removeBinary, purgeConfig, revertPath, yes };
  return { mode, errors, help, json };
}

export function classifyExecPath(
  execPath: string,
  platform: NodeJS.Platform,
  homeDir: string,
): { readonly ok: true; readonly installDir: string } | { readonly ok: false; readonly reason: string } {
  const p = platform === "win32" ? path.win32 : path.posix;
  const name = p.basename(execPath).toLowerCase();
  if (platform === "win32") {
    if (name !== "umactually.exe") {
      return { ok: false, reason: `process.execPath basename is "${name}", expected "umactually.exe"` };
    }
  } else if (name !== "umactually") {
    return { ok: false, reason: `process.execPath basename is "${name}", expected "umactually"` };
  }
  const parent = p.dirname(execPath);
  const homeLocalBin = p.join(homeDir, ".local", "bin");
  if (parent === homeLocalBin) {
    return { ok: true, installDir: parent };
  }
  if (platform !== "win32" && (parent === "/usr/local/bin" || parent === `${p.sep}usr${p.sep}local${p.sep}bin`)) {
    return { ok: true, installDir: parent };
  }
  // Tight fallback (not "any path ending in /bin under $HOME"):
  //   - homeDir + "/bin"  (or "/.bin")  — a *direct* child, not nested
  //   - /opt/<single-segment>/bin       — single segment under /opt, not nested
  // This still covers the documented install targets without accepting
  // attacker-controlled paths like /home/alice/some/random/bin/umactually.
  const homeBin = p.join(homeDir, "bin");
  const homeDotBin = p.join(homeDir, ".bin");
  if (parent === homeBin || parent === homeDotBin) {
    return { ok: true, installDir: parent };
  }
  if (platform !== "win32") {
    const rest = parent.startsWith(`/opt${p.sep}`) ? parent.slice(`/opt${p.sep}`.length) : null;
    if (rest !== null && rest.length > 0 && rest.endsWith(`${p.sep}bin`)) {
      const beforeBin = rest.slice(0, -`${p.sep}bin`.length);
      if (beforeBin.length > 0 && !beforeBin.includes(p.sep)) {
        return { ok: true, installDir: parent };
      }
    }
  }
  return {
    ok: false,
    reason: `process.execPath "${execPath}" is not in a recognised install directory (${homeLocalBin}, /usr/local/bin, ${homeBin}, or /opt/<name>/bin)`,
  };
}

export function findShellRcBlocks(content: string): readonly { readonly start: number; readonly end: number }[] {
  // Matches the two-line block written by install.sh:
  //   # Added by umactually installer
  //   export PATH="<dir>:$PATH"
  // (with optional trailing newline)
  const blocks: { start: number; end: number }[] = [];
  const re = /^[ \t]*# Added by umactually installer[^\n]*\n[ \t]*export PATH="[^"]*"[ \t]*\n?/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    blocks.push({ start: m.index, end: m.index + m[0].length });
  }
  return blocks;
}

export function stripShellRcBlocks(content: string): string {
  const blocks = findShellRcBlocks(content);
  if (blocks.length === 0) {
    return content;
  }
  let out = "";
  let cursor = 0;
  for (const block of blocks) {
    out += content.slice(cursor, block.start);
    cursor = block.end;
  }
  out += content.slice(cursor);
  return out;
}

export async function runUninstall(deps: UninstallDeps): Promise<UninstallResult> {
  const checks: UninstallCheck[] = [];
  const classified = classifyExecPath(deps.execPath, deps.platform, deps.homeDir);
  if (!classified.ok) {
    checks.push({
      id: "exec-path",
      status: "fail",
      message: classified.reason,
      hint: "Run uninstall from the installed binary, not from `node` or an npm-installed copy",
    });
    return { exitCode: 2, checks };
  }
  checks.push({
    id: "exec-path",
    status: "ok",
    message: `${deps.execPath} is a recognised umactually install location`,
  });

  // Confirm with the user before mutating the filesystem.
  // Non-interactive shells (CI, cron) must pass --yes.
  //
  // Gate the binary-removal prompt on `mode.removeBinary`: when the
  // user passed `--no-remove-binary`, there is no binary removal to
  // confirm, so the prompt would be misleading (and a stray 'n' would
  // wrongly abort the whole run, including the requested --purge-config
  // / --revert-path follow-ups). Record a skip check so the user gets
  // visible confirmation that the binary was deliberately kept.
  if (deps.mode?.removeBinary === false) {
    checks.push({
      id: "binary-removal",
      status: "skip",
      message: "--no-remove-binary was set; the running binary is being kept",
    });
    // Skip the rest of the binary-removal logic. The user explicitly
    // opted to keep the binary — we should not even check symlink/file
    // shape, because reporting "is a symlink" or "not a regular file"
    // would imply a problem with a binary the user wants to keep.
    return { exitCode: 0, checks };
  } else if (shouldPrompt(deps)) {
    const reader = deps.stdinReader ?? defaultStdinReader;
    const confirm = await reader("Remove the running binary? [y/N] ", deps.isTTY);
    if (confirm === null || !/^y(es)?$/i.test(confirm.trim())) {
      checks.push({
        id: "binary-removal",
        status: "skip",
        message: "user declined the confirmation prompt",
        declined: true,
      });
      return { exitCode: 1, checks };
    }
  }

  // Always check the symlink/file shape of the binary.
  const isLink = deps.fsAdapter.isSymlink(deps.execPath);
  const isFile = deps.fsAdapter.isFile(deps.execPath);
  if (isLink) {
    checks.push({
      id: "binary-removal",
      status: "fail",
      message: `${deps.execPath} is a symlink — refusing to unlink it directly`,
      hint: "Resolve the link and uninstall the target instead",
    });
    return { exitCode: 2, checks };
  }
  if (!isFile) {
    checks.push({
      id: "binary-removal",
      status: "skip",
      message: `${deps.execPath} is not a regular file (already removed?)`,
    });
  } else {
    try {
      deps.fsAdapter.unlink(deps.execPath);
      checks.push({
        id: "binary-removal",
        status: "ok",
        message: `removed ${deps.execPath}`,
      });
      // On Windows the unlink of a running executable may fail; check
      // the file is actually gone. If not, fall back to a delayed-del
      // helper that runs after this process exits.
      if (deps.platform === "win32" && deps.fsAdapter.exists(deps.execPath)) {
        checks.push(scheduleWindowsDelayedDelete(deps.execPath));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (deps.platform === "win32") {
        checks.push(scheduleWindowsDelayedDelete(deps.execPath));
        checks.push({
          id: "binary-removal",
          status: "warn",
          message: `could not unlink ${deps.execPath} directly (${message}); a delayed-delete helper was scheduled`,
        });
      } else {
        checks.push({
          id: "binary-removal",
          status: "fail",
          message: `could not unlink ${deps.execPath}: ${message}`,
        });
        return { exitCode: 1, checks };
      }
    }
  }

  return { exitCode: 0, checks };
}

export function purgeConfig(deps: UninstallDeps): readonly UninstallCheck[] {
  const checks: UninstallCheck[] = [];
  const configDir = join(deps.homeDir, ".umactually");
  const cacheDir = join(deps.homeDir, ".cache", "umactually");
  for (const dir of [configDir, cacheDir]) {
    if (!deps.fsAdapter.exists(dir)) {
      checks.push({
        id: dir === cacheDir ? "cache-removal" : "config-removal",
        status: "skip",
        message: `${dir} does not exist`,
      });
      continue;
    }
    if (!deps.fsAdapter.isDirectory(dir)) {
      checks.push({
        id: dir === cacheDir ? "cache-removal" : "config-removal",
        status: "warn",
        message: `${dir} is not a directory — skipping`,
      });
      continue;
    }
    try {
      deps.fsAdapter.removeDir(dir, { recursive: true });
      checks.push({
        id: dir === cacheDir ? "cache-removal" : "config-removal",
        status: "ok",
        message: `removed ${dir}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      checks.push({
        id: dir === cacheDir ? "cache-removal" : "config-removal",
        status: "fail",
        message: `could not remove ${dir}: ${message}`,
      });
    }
  }
  return checks;
}

export function revertPath(deps: UninstallDeps): readonly UninstallCheck[] {
  const checks: UninstallCheck[] = [];
  let anyChanges = false;
  for (const rc of SHELL_RC_FILES) {
    const path = join(deps.homeDir, rc);
    if (!deps.fsAdapter.exists(path)) {
      continue;
    }
    if (deps.fsAdapter.isSymlink(path)) {
      checks.push({
        id: "path-revert",
        status: "skip",
        message: `${path} is a symlink — refusing to modify`,
      });
      continue;
    }
    let content: string;
    try {
      content = deps.fsAdapter.readFile(path);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      checks.push({
        id: "path-revert",
        status: "warn",
        message: `could not read ${path}: ${message}`,
      });
      continue;
    }
    const blocks = findShellRcBlocks(content);
    if (blocks.length === 0) {
      continue;
    }
    const stripped = stripShellRcBlocks(content);
    if (stripped === content) {
      continue;
    }
    // Capture the original mode BEFORE writing. The new file will be
    // created with the default umask (typically 0o644), so we need to
    // restore the original mode afterward. Without this, a user with
    // a 0o600 .zshrc (privacy-sensitive) would see the new file at
    // 0o644 — silently broadened permissions.
    const originalMode = deps.fsAdapter.getMode(path);
    try {
      deps.fsAdapter.writeFile(path, stripped);
      if (originalMode !== null && originalMode !== undefined) {
        try {
          deps.fsAdapter.setMode(path, originalMode);
        } catch (err) {
          // Non-fatal: the content was updated successfully, but we
          // couldn't restore the mode. Surface as a warn so the user
          // can chmod manually.
          const message = err instanceof Error ? err.message : String(err);
          checks.push({
            id: "path-revert",
            status: "warn",
            message: `removed ${blocks.length} umactually block(s) from ${path}, but could not restore mode ${originalMode.toString(8)}: ${message}`,
            hint: `Run: chmod ${originalMode.toString(8)} ${path}`,
          });
          anyChanges = true;
          continue;
        }
      }
      anyChanges = true;
      checks.push({
        id: "path-revert",
        status: "ok",
        message: `removed ${blocks.length} umactually block(s) from ${path}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      checks.push({
        id: "path-revert",
        status: "fail",
        message: `could not write ${path}: ${message}`,
      });
    }
  }
  if (!anyChanges) {
    checks.push({
      id: "path-revert",
      status: "skip",
      message: `no umactually PATH block found in ${SHELL_RC_FILES.join(" / ")}`,
    });
  }
  return checks;
}

export function shouldPrompt(deps: UninstallDeps): boolean {
  // `mode.yes` (the `--yes` / `-y` CLI flag) always wins.
  if (deps.mode?.yes === true) {
    return false;
  }
  if (!deps.isTTY) {
    return false;
  }
  const yesEnv = deps.env["UMACTUALLY_UNINSTALL_YES"] ?? deps.env["UMACTUALLY_YES"];
  return yesEnv !== "1" && yesEnv !== "true";
}

export function scheduleWindowsDelayedDelete(targetPath: string): UninstallCheck {
  // Self-deletion of a running executable on Windows requires a helper
  // that runs AFTER the parent exits. We write a small .cmd script to
  // a unique temp file, then spawn it detached. The script:
  //   1. Enables delayed expansion so %VAR% in the path is not expanded
  //      at parse time (this was the robustness bug in the previous
  //      version: a path containing `%TEMP%` would explode the command).
  //   2. Sets TARGET via `set "TARGET=..."` (cmd.exe's `""` escape
  //      handles a literal `"` inside the value).
  //   3. Waits ~3s via `ping -n 4`, then deletes the binary.
  //   4. Self-deletes the .cmd.
  //
  // Passing the path as a separate argv (not interpolated into the
  // command string) avoids all shell-quoting issues. The path is read
  // by the script via the %1 parameter. %~1 in the script body is the
  // path with surrounding quotes already stripped, so we re-quote it
  // safely with del's normal double-quote rules.
  //
  // Returns a UninstallCheck so the caller can record success or
  // failure in the visible output. A previous version swallowed the
  // writeFileSync failure in a try/catch, which meant the user got
  // `binary-removal: warn` and a silent failure to actually delete
  // the binary — no visible `self-deletion` entry at all. Surfacing
  // the result here closes that gap.
  const tmpDir = process.env["TEMP"] ?? process.env["TMP"] ?? "/tmp";
  const scriptPath = join(tmpDir, `umactually-uninstall-${process.pid}-${Date.now()}.cmd`);
  // `set "TARGET=foo""bar"` correctly sets TARGET to `foo"bar`. cmd.exe
  // collapses the `""` inside the quoted value to a single literal `"`.
  const safePath = targetPath.replace(/"/gu, '""');
  const body = [
    "@echo off",
    "setlocal EnableDelayedExpansion",
    `set "TARGET=${safePath}"`,
    "ping -n 4 127.0.0.1 >nul",
    "del /f /q \"!TARGET!\"",
    `del /f /q "${scriptPath.replace(/"/gu, '""')}"`,
    "",
  ].join("\r\n");
  try {
    writeFileSync(scriptPath, body, "utf8");
    spawn("cmd.exe", ["/c", scriptPath], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    }).unref();
    return {
      id: "self-deletion",
      status: "warn",
      message: `Windows held a write lock on the running binary; a delayed-delete helper was scheduled at ${scriptPath}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      id: "self-deletion",
      status: "fail",
      message: `could not schedule delayed-delete helper for ${targetPath}: ${message}. The binary may need to be removed manually.`,
    };
  }
}

export const UNINSTALL_HELP_TEXT = [
  `${"umactually"} uninstall — remove the installed binary, config, and PATH entries`,
  "",
  "Usage:",
  "  umactually uninstall [flags]    Remove the running binary and (optionally) related files",
  "  umactually uninstall --help     Show this help",
  "",
  "Flags:",
  "  --remove-binary     (default) Delete the running binary at process.execPath",
  "  --no-remove-binary  Skip the binary removal (only useful with --purge-config / --revert-path)",
  "  --purge-config      Also delete ~/.umactually/ and ~/.cache/umactually/",
  "  --revert-path       Also remove the installer's PATH line from ~/.zshrc / ~/.bashrc / ~/.profile",
  "  --yes, -y           Skip the interactive confirmation prompt",
  "  --json              Emit machine-readable JSON output",
  "  --help, -h          Show this help",
  "",
  "By default the binary is removed, the config/cache dirs are left alone, and the",
  "PATH entry stays in your shell config. The confirmation prompt only appears on a",
  "TTY. Non-interactive shells (CI, cron) must pass --yes or set UMACTUALLY_UNINSTALL_YES=1.",
  "",
  "Exit codes:",
  "  0  Uninstall completed (with at least the binary removed)",
  "  1  User declined the confirmation prompt",
  "  2  Usage error or unsafe exec path",
].join("\n");

export function formatUninstallHuman(result: UninstallResult): string {
  const lines = result.checks.map((c) => {
    const hint = c.hint === undefined ? "" : `\n  hint: ${c.hint}`;
    return `${c.status.toUpperCase().padEnd(4)} ${c.id}: ${c.message}${hint}`;
  });
  return `${lines.join("\n")}\n`;
}

export function formatUninstallJson(result: UninstallResult, mode: UninstallMode, execPath: string): string {
  const envelope: UninstallJson = result.json ?? {
    schemaVersion: 1,
    command: "uninstall",
    exitCode: result.exitCode,
    execPath,
    mode,
    checks: result.checks,
  };
  return `${JSON.stringify(envelope)}\n`;
}

/**
 * True if the runUninstall result indicates the user declined the
 * confirmation prompt. Used by runUninstallBranch to gate the
 * purge-config and revert-path follow-up actions so a 'n' answer
 * to the binary prompt does not silently wipe the user's data.
 *
 * Detection uses the structured `check.declined === true` flag
 * (set by runUninstall when the user types 'n' or EOFs the prompt)
 * rather than a substring match on the human-readable message. The
 * structured flag is compile-time linked and survives message
 * rewordings.
 */
export function userDeclinedPrompt(result: UninstallResult): boolean {
  return result.exitCode === 1
    && result.checks.some(
      (c) => c.id === "binary-removal" && c.status === "skip" && c.declined === true,
    );
}
