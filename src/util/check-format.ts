// SPDX-License-Identifier: MIT
//
// Shared human formatter for "checks" — the array of `{ id, status,
// message, hint? }` rows emitted by the `doctor` and `uninstall`
// subcommands. Both commands used to carry an identical
// `${STATUS.padEnd(4)} ${id}: ${message}\n  hint: ${hint}` inline copy
// (see `src/cli/doctor.ts:formatDoctorHuman` and
// `src/cli/uninstall.ts:formatUninstallHuman` before this refactor). This
// helper centralises the shape so future commands (e.g. verify) can
// reuse it without re-deriving the per-check line.
//
// The `padEnd(4)` is HARDCODED — both original call sites used `4` at
// HEAD, and the existing unit tests (`test/unit/cli-doctor.test.ts` and
// `test/unit/cli-uninstall.test.ts`) pin that width implicitly. Changing
// it would change the byte shape of every diagnostic line and is a
// breaking change for any downstream consumer that greps for `STATUS id:`
// in CI logs.
//
// The `emojiPrefix` option is OFF by default — the canonical wire shape
// is the plain `STATUS id: message` line. When a caller opts in, the
// status column gains a status-keyed emoji (`✅` ok / `⚠️` warn / `❌`
// fail / `⏭` skip), inserted between the emoji and the padded status
// so the column alignment is preserved. The emoji is appended BEFORE the
// `padEnd(4)` width, which means the status word still lines up at
// column N+1 regardless of whether emojis are enabled — the prefix is
// outside the column that tests pin.
//
// Pure: no I/O, no clock side-effects. Safe to call from synchronous
// dispatch sites (the human-output branch of `formatDoctorHuman` /
// `formatUninstallHuman`).

export type CheckLine = {
  readonly id: string;
  readonly status: string;
  readonly message: string;
  readonly hint?: string;
};

export type FormatCheckLinesOptions = {
  /**
   * When true, prefix each line's status column with a status-keyed
   * emoji (✅ / ⚠️ / ❌ / ⏭). Default false — keeps the byte shape
   * identical to the pre-refactor `formatDoctorHuman` /
   * `formatUninstallHuman` output. The emoji is rendered BEFORE the
   * `padEnd(4)` column so the status word stays at the same column
   * position; only the row's overall visual width grows.
   */
  readonly emojiPrefix?: boolean;
};

/**
 * Status → emoji lookup used when `emojiPrefix` is enabled. The mapping
 * is exhaustive over the canonical DoctorStatus / UninstallStatus
 * vocabulary (`"ok" | "warn" | "fail" | "skip"`); unknown statuses fall
 * back to `⏭` so a malformed upstream producer cannot crash the
 * renderer.
 */
const STATUS_EMOJI: Readonly<Record<string, string>> = {
  ok: "\u2705",
  warn: "\u26A0\uFE0F",
  fail: "\u274C",
  skip: "\u23ED\uFE0F",
};

/**
 * Render a list of check rows as a single human-readable string.
 *
 * Each check produces one or two lines:
 *   - `${status} ${id}: ${message}` (the per-check row)
 *   - `  hint: ${hint}` (only when `check.hint` is set; 2-space indent
 *     is preserved from the pre-refactor shape)
 *
 * Lines are joined with `\n` and the function appends a single trailing
 * `\n` so the output is line-terminated exactly like the pre-refactor
 * `formatDoctorHuman` / `formatUninstallHuman` did.
 *
 * The function is intentionally not exported with a per-command name
 * (no `formatDoctorHuman` / `formatUninstallHuman` re-export) — those
 * wrappers stay in their respective command modules so callers continue
 * to import the command-specific symbol without churn.
 */
export function formatCheckLines(
  checks: readonly CheckLine[],
  options: FormatCheckLinesOptions = {},
): string {
  const emojiPrefix = options.emojiPrefix === true;
  const lines = checks.map((check) => {
    const status = check.status.toUpperCase().padEnd(4);
    const prefix = emojiPrefix ? `${STATUS_EMOJI[check.status.toLowerCase()] ?? STATUS_EMOJI["skip"]} ` : "";
    const hint = check.hint === undefined ? "" : `\n  hint: ${check.hint}`;
    return `${prefix}${status} ${check.id}: ${check.message}${hint}`;
  });
  return `${lines.join("\n")}\n`;
}