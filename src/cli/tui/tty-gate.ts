// src/cli/tui/tty-gate.ts — TTY gate for the tui subcommand.
// Shapes pinned by todo:8; runtime body filled in by todo:11.
// Dispatch (todo:9) imports `runTtyGate` and `defaultCheckTTY`; tests inject `checkTTY`.
export type TtyGateResult =
  | { ok: true }
  | { ok: false; exitCode: 2; hint: string };

export function defaultCheckTTY(): boolean {
  // Body filled in by todo:11 — see plan lines 262-271.
  throw new Error("defaultCheckTTY: not yet implemented (filled in by todo:11)");
}

export function runTtyGate(
  _opts: { checkTTY?: () => boolean } = {},
): TtyGateResult {
  // Body filled in by todo:11.
  throw new Error("runTtyGate: not yet implemented (filled in by todo:11)");
}
