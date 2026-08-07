// test/unit/tui-debug-flow.test.ts — unit tests for src/cli/tui/flows/debug.ts
// (todo:14).
//
// Verifies the Debug panel's contract without touching a real TTY,
// real filesystem, or real git: the real `runDoctor` is replaced with
// a mock that yields a pre-built `DoctorResult`, and `@clack/prompts`
// is mocked so the test is hermetic.
//
// Cases:
//   - DBG-A: every check ok → flow returns { exitCode: 0 }.
//   - DBG-B: any check fails → flow STILL returns { exitCode: 0 } but
//            the exit-code summary reflects the failure (failed: 1).
//   - DBG-C: checks with hints render the hint in the displayed panel.
//   - DBG-D: `isCancel()` mid-flow (on the menu select) → returns
//            { exitCode: 0 } without throwing.
//   - DBG-E: "Back to menu" select → returns { exitCode: 0 } to hub.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clack/prompts", () => ({
  select: vi.fn(),
  isCancel: vi.fn(),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
  note: vi.fn(),
}));

import { isCancel, note, select } from "@clack/prompts";

import { runDebugFlow } from "../../src/cli/tui/flows/debug.js";
import type { DoctorCheck, DoctorResult } from "../../src/cli/doctor.js";

function okCheck(id: DoctorCheck["id"], message: string): DoctorCheck {
  return { id, status: "ok", message };
}

function failCheck(id: DoctorCheck["id"], message: string, hint?: string): DoctorCheck {
  return hint === undefined
    ? { id, status: "fail", message }
    : { id, status: "fail", message, hint };
}

function doctorResult(checks: readonly DoctorCheck[]): DoctorResult {
  const exitCode = checks.some((check) => check.status === "fail") ? 1 : 0;
  return { exitCode, checks };
}

const HEALTHY_CHECKS: readonly DoctorCheck[] = [
  okCheck("node", "Node 24.0.0"),
  okCheck("dist-freshness", "/repo/dist/cli.js present and fresh"),
  okCheck("env", "5/5 known env vars present"),
  okCheck("git", "cwd is inside a git work tree"),
];

describe("tui debug flow (runDebugFlow)", () => {
  beforeEach(() => {
    // Reset @clack/prompts mocks between tests so per-test assertions on
    // `note.calls` and `select.calls` are not contaminated by earlier
    // tests in the same file.
    vi.clearAllMocks();
  });

  it("DBG-A: all checks ok → returns { exitCode: 0 } and renders the panel", async () => {
    // Given: doctor reports a healthy environment; the operator picks "Back to menu".
    const runDoctorFn = vi.fn(async () => doctorResult(HEALTHY_CHECKS));
    vi.mocked(select).mockResolvedValueOnce("menu");
    vi.mocked(isCancel).mockReturnValue(false);

    // When: the debug flow is invoked.
    const result = await runDebugFlow({ runDoctorFn });

    // Then: the flow returns { exitCode: 0 } and the panel contents were
    // emitted exactly once (note(...) is the single rendering point).
    expect(result).toEqual({ exitCode: 0 });
    expect(runDoctorFn).toHaveBeenCalledTimes(1);
    expect(note).toHaveBeenCalledTimes(1);
    expect(vi.mocked(select).mock.calls[0]?.[0]?.options).toEqual([
      { value: "menu", label: "Back to menu" },
    ]);
  });

  it("DBG-B: a failing check → flow STILL returns { exitCode: 0 } but the panel shows failure", async () => {
    // Given: doctor reports a Node-too-old failure alongside an OK dist check.
    const failingChecks: readonly DoctorCheck[] = [
      failCheck("node", "Node 22.18.0 detected; 24.x or later required", "Install Node 24+"),
      okCheck("dist-freshness", "/repo/dist/cli.js present and fresh"),
      okCheck("env", "5/5 known env vars present"),
      okCheck("git", "cwd is inside a git work tree"),
    ];
    const runDoctorFn = vi.fn(async () => doctorResult(failingChecks));
    vi.mocked(select).mockResolvedValueOnce("menu");
    vi.mocked(isCancel).mockReturnValue(false);

    // When: the debug flow is invoked.
    const result = await runDebugFlow({ runDoctorFn });

    // Then: the TUI stays interactive (exitCode 0) but the panel body
    // carries the failure summary so the operator sees what to fix.
    expect(result).toEqual({ exitCode: 0 });
    expect(note).toHaveBeenCalledTimes(1);
    const noteBody = vi.mocked(note).mock.calls[0]?.[0] ?? "";
    expect(noteBody).toMatch(/exitCode: 1/);
    expect(noteBody).toMatch(/failed: 1/u);
    expect(noteBody).toMatch(/Install Node 24\+/u);
  });

  it("DBG-C: checks with hints render the hint in the panel", async () => {
    // Given: a hint-bearing check (the canonical Node-too-old shape).
    const hintChecks: readonly DoctorCheck[] = [
      failCheck(
        "node",
        "Node 22.18.0 detected; 24.x or later required",
        "Install Node 24+ from https://nodejs.org/",
      ),
      okCheck("dist-freshness", "/repo/dist/cli.js present and fresh"),
      okCheck("env", "5/5 known env vars present"),
      okCheck("git", "cwd is inside a git work tree"),
    ];
    const runDoctorFn = vi.fn(async () => doctorResult(hintChecks));
    vi.mocked(select).mockResolvedValueOnce("menu");
    vi.mocked(isCancel).mockReturnValue(false);

    // When: the debug flow is invoked.
    const result = await runDebugFlow({ runDoctorFn });

    // Then: the hint text shows up in the panel body (formatDoctorHuman
    // appends `\n  hint: <text>` for any check with a hint).
    expect(result).toEqual({ exitCode: 0 });
    const noteBody = vi.mocked(note).mock.calls[0]?.[0] ?? "";
    expect(noteBody).toMatch(/hint: Install Node 24\+ from https:\/\/nodejs\.org\//u);
  });

  it("DBG-D: isCancel() on the menu select → returns { exitCode: 0 }", async () => {
    // Given: the operator hits Ctrl+C on the "Back to menu" select.
    const runDoctorFn = vi.fn(async () => doctorResult(HEALTHY_CHECKS));
    vi.mocked(select).mockResolvedValueOnce("__cancelled__");
    vi.mocked(isCancel).mockReturnValue(true);

    // When: the debug flow is invoked.
    const result = await runDebugFlow({ runDoctorFn });

    // Then: the flow short-circuits to { exitCode: 0 } without
    // propagating the cancel sentinel and without throwing.
    expect(result).toEqual({ exitCode: 0 });
    expect(runDoctorFn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(isCancel)).toHaveBeenCalledWith("__cancelled__");
  });

  it("DBG-E: 'Back to menu' select returns { exitCode: 0 } to hub", async () => {
    // Given: the operator picks the only menu option.
    const runDoctorFn = vi.fn(async () => doctorResult(HEALTHY_CHECKS));
    vi.mocked(select).mockResolvedValueOnce("menu");
    vi.mocked(isCancel).mockReturnValue(false);

    // When: the debug flow is invoked.
    const result = await runDebugFlow({ runDoctorFn });

    // Then: the flow returns { exitCode: 0 } so the hub's while-loop
    // keeps the operator in the menu (the sentinel value is not
    // surfaced to the hub — the hub only sees the exit code).
    expect(result).toEqual({ exitCode: 0 });
    expect(vi.mocked(select).mock.calls[0]?.[0]?.options).toEqual([
      { value: "menu", label: "Back to menu" },
    ]);
  });
});
