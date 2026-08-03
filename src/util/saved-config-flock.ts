// SPDX-License-Identifier: MIT
// Internal POSIX `flock(2)` wrapper used by `saved-config.ts` to serialize
// concurrent `umactually init` invocations.
//
// node:fs does not expose `flock(2)` directly and we don't want to add a
// native dependency. We shell out to the coreutils `flock(1)` CLI with the
// `-n` flag (non-blocking try-lock) and pass the LOCK FILE PATH (not the
// fd number) — passing an fd number to flock(1) only works when the child
// process inherits the parent's fd table, which is not portable across
// CI sandboxes, vite-node workers, or any setup that uses
// `stdio: "ignore"`. The path form uses the same inode and is portable.
//
// On hosts without `flock(1)` (macOS without coreutils, alpine without
// busybox flock) we fall through to a lenient path — the atomic-rename
// write in `saved-config.ts` still protects against corruption; we lose
// only the "second init wins cleanly" guarantee. v1 of the wizard
// documents this as single-machine-only and the parent writeSavedConfig()
// guards with a no-op on win32.

export class FlockUnavailableError extends Error {
  public constructor() {
    super("flock(1) is unavailable");
    this.name = "FlockUnavailableError";
  }
}

export function tryFlockNonBlocking(lockPath: string): boolean {
  try {
    const { spawnSync } = require("node:child_process") as typeof import("node:child_process");
    const r = spawnSync("flock", ["-n", lockPath, "true"], { stdio: "ignore", timeout: 1000 });
    return r.status === 0;
  } catch {
    throw new FlockUnavailableError();
  }
}