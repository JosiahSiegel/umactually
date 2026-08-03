// SPDX-License-Identifier: MIT
// Filesystem adapter + atomic-write primitive used by the uninstall
// subcommand to safely rewrite user-owned shell rc files (e.g. .zshrc,
// .bashrc, .profile) when reverting the installer's PATH entry.
//
// This module is intentionally pure (sync node:fs primitives, no I/O
// other than what the caller asks for) so that the uninstall tests can
// substitute their own in-memory adapter via `FsAdapter` without
// pulling in node:fs at all. The adapter shape was lifted verbatim
// from src/cli/uninstall.ts (T2/T3 of the init-guided-setup plan);
// behavior must remain byte-identical — the rc-file revert is a
// safety-critical path and the rename-on-sibling-tempfile primitive
// is what protects it from the disk-full / read-only-mount TOCTOU
// class of bug.

import {
  chmodSync,
  existsSync,
  lstatSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";

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
   * Atomically write `content` to `path`: write to a sibling temp
   * file, fsync, then rename over the target. A failed write leaves
   * the original file intact. Used by revertPath to avoid the
   * TOCTOU class of bug where the disk fills up or the mount goes
   * read-only between the read and the write — a non-atomic write
   * would leave the user's .zshrc truncated.
   *
   * Implementations may use the platform's atomic rename (POSIX
   * rename(2) is atomic on the same filesystem; Windows MoveFileEx
   * with MOVEFILE_REPLACE_EXISTING is similarly atomic).
   */
  readonly writeFileAtomic: (path: string, content: string) => void;
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

/**
 * Atomically write `content` to `path` by writing to a sibling temp
 * file and renaming over the target. On POSIX, rename(2) is atomic
 * on the same filesystem; on Windows, MoveFileEx with
 * MOVEFILE_REPLACE_EXISTING is similarly atomic. If anything fails
 * before the rename, the original file is untouched.
 *
 * The function name and rename-and-cleanup semantics are part of
 * the revertPath safety contract; do not relax the cleanup without
 * auditing the rc-file revert path.
 */
export function writeFileAtomic(path: string, content: string): void {
  // Write to a sibling temp file, then rename atomically over the
  // target. On POSIX, rename(2) is atomic on the same filesystem
  // (the target either points to the old content or the new, never
  // a partial state). On Windows, MoveFileEx with REPLACE_EXISTING
  // is similarly atomic. If anything fails before the rename, the
  // original file is untouched.
  const tmpPath = `${path}.umactually-tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(tmpPath, content, "utf8");
    renameSync(tmpPath, path);
  } catch (err) {
    // Best-effort cleanup of the orphan temp file.
    try {
      unlinkSync(tmpPath);
    } catch {
      // ignore
    }
    throw err;
  }
}

/**
 * Return the file's mode bits (e.g. 0o600) or null if the file
 * does not exist or the mode cannot be determined. Returns only the
 * permission bits (masked with 0o7777) so callers don't have to
 * think about the file-type bits in `Stats.mode`.
 */
export function getMode(path: string): number | null {
  try {
    return statSync(path).mode & 0o7777;
  } catch {
    return null;
  }
}

/**
 * Set the file's mode bits. Throws on failure. Callers are expected
 * to have already checked that the file exists and that the caller
 * has permission to change it (e.g. they own the file).
 */
export function setMode(path: string, mode: number): void {
  chmodSync(path, mode);
}

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
  getMode: (path) => getMode(path),
  setMode: (path, mode) => {
    setMode(path, mode);
  },
  removeDir: (path, options) => {
    rmSync(path, { recursive: options.recursive, force: true });
  },
  readFile: (path) => readFileSync(path, "utf8"),
  writeFile: (path, content) => {
    writeFileSync(path, content, "utf8");
  },
  writeFileAtomic: (path, content) => {
    writeFileAtomic(path, content);
  },
};
