// src/cli/tui/tty-gate.ts — TTY gate for the tui subcommand.
// Shapes pinned by todo:8; runtime body filled in by todo:11.
// Dispatch (todo:9) imports `runTtyGate` and `defaultCheckTTY`; tests inject `checkTTY`.
export type TtyGateResult =
  | { ok: true }
  | { ok: false; exitCode: 2; hint: string };

const TTY_HINT = "umactually tui requires a TTY; run from an interactive terminal (or use 'umactually review' for non-interactive flows).\n";

export function defaultCheckTTY(): boolean {
  return process.stdin.isTTY === true && process.stdout.isTTY === true;
}

export function runTtyGate(
  opts: { checkTTY?: () => boolean } = {},
): TtyGateResult {
  const checkTTY = opts.checkTTY ?? defaultCheckTTY;
  if (checkTTY()) {
    return { ok: true };
  }
  return { ok: false, exitCode: 2, hint: TTY_HINT };
}
