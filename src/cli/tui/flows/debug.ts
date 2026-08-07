// src/cli/tui/flows/debug.ts — Debug panel.
//
// Read-only display surface for the operator: shows the same diagnostics
// `umactually doctor` prints on the CLI, but rooted inside the TUI so the
// hub can route the operator to it from the menu.
//
// Every check the real `runDoctor` emits is rendered as a row with a
// [OK]/[WARN]/[FAIL]/[SKIP] badge + the check id + the message + the
// hint (if any). The display reuses `formatDoctorHuman` from
// `src/cli/doctor.ts:175-181` so the TUI panel stays byte-identical to
// the CLI surface — DO NOT duplicate the formatting here.
//
// The flow is read-only: it never mutates env, never writes files, never
// opens a network connection. `runDoctor` itself is read-only; the
// `fsAdapter` and `execFile` we pass in only probe the filesystem and
// spawn `git rev-parse` to confirm the cwd is a work tree.
//
// Exit-code contract: the TUI is interactive, so failures do NOT escalate
// the exit code. The hub invokes this flow and always returns to the menu;
// the human stays in control. Even when `runDoctor` reports a non-zero
// exit code (e.g. Node version too old, dist missing), this flow returns
// `{ exitCode: 0 }` to the hub. Error surfaces are shown in the panel as
// [FAIL] badges, not as non-zero process exits.
//
// Pattern references:
//   - src/cli/doctor.ts:53-65 (runDoctor signature + DoctorResult shape)
//   - src/cli/doctor.ts:175-181 (formatDoctorHuman — reuse, do NOT duplicate)
//   - src/cli/tui/flows/config.ts (todo:13 — same single-option "Back to menu"
//     select pattern, so the hub's menu loop keeps the same UX)

import { execFile as execFileCallback } from "node:child_process";
import { stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { isCancel, log, note, select } from "@clack/prompts";

import {
  formatDoctorHuman,
  type DoctorCheck,
  type DoctorDeps,
  type DoctorResult,
  runDoctor,
} from "../../doctor.js";

const execFile = promisify(execFileCallback);

/**
 * Test seam: callers (and tests) inject a mock `runDoctor` to drive the
 * flow deterministically without touching the real filesystem or git. The
 * production path uses the real `runDoctor` from `src/cli/doctor.ts`.
 */
export type RunDebugFlowDeps = {
  readonly runDoctorFn?: (deps: DoctorDeps) => Promise<DoctorResult>;
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
  readonly packageRoot?: string;
};

export async function runDebugFlow(deps: RunDebugFlowDeps = {}): Promise<{ exitCode: 0 }> {
  // The TUI never escalates exit codes — the operator stays in the menu
  // and decides what to do next. We pre-declare the result so the
  // try/catch in the control-flow is the only path that can early-return.
  const packageRoot =
    deps.packageRoot ?? fileURLToPath(new URL("../..", import.meta.url));
  const runDoctorFn = deps.runDoctorFn ?? runDoctor;

  let result: DoctorResult;
  try {
    result = await runDoctorFn({
      cwd: deps.cwd ?? process.cwd(),
      isTTY: true,
      env: deps.env ?? process.env,
      fsAdapter: { stat },
      execFile: async (file, fileArgs, options) => {
        const output = await execFile(file, fileArgs, options);
        return { stdout: output.stdout, stderr: output.stderr };
      },
      packageRoot,
    });
  } catch (err) {
    // Doctor probes (stat / `git rev-parse`) are read-only, but a
    // pathological environment could still throw — e.g. a permission
    // error on the dist or a segfault in `git`. Render an error panel
    // and bounce back to the menu so the operator is never stranded.
    const message = err instanceof Error ? err.message : String(err);
    log.error(`Debug panel failed: ${message}`);
    await select({
      message: "Return to menu?",
      options: [{ value: "menu", label: "Back to menu" }],
    });
    return { exitCode: 0 };
  }

  const summary = renderDebugSummary(result.checks);
  // Reuse `formatDoctorHuman` for the per-check lines (so the TUI
  // matches the CLI's `umactually doctor` output byte-for-byte), then
  // append the synthetic exit-code summary on top of the note.
  note(`${formatDoctorHuman(result.checks).trimEnd()}\n\n${summary}`, "Debug environment");

  const choice = await select({
    message: "Return to menu?",
    options: [{ value: "menu", label: "Back to menu" }],
  });
  if (isCancel(choice)) {
    return { exitCode: 0 };
  }
  return { exitCode: 0 };
}

function renderDebugSummary(checks: readonly DoctorCheck[]): string {
  const failed = checks.filter((check) => check.status === "fail").length;
  const warned = checks.filter((check) => check.status === "warn").length;
  const exitCode = failed > 0 ? 1 : 0;
  return `exitCode: ${exitCode} (failed: ${failed}, warned: ${warned})`;
}
