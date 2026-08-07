// test/unit/tui-hub.test.ts — unit tests for src/cli/tui/hub.ts (runHub).
//
// Verifies the hub's menu-loop contract without touching a real TTY:
//   - Test A: `select` returns "exit" → runHub resolves to { exitCode: 0 }
//             and never invokes the injected runFlow.
//   - Test B: mocked `isCancel` returns true for whatever `select` yields
//             → runHub resolves to { exitCode: 0 } (no error thrown, even
//             though the underlying value isn't a real menu choice).
//   - Test C: runFlow throws → hub catches, logs, and re-prompts (Fix E).
//
// The hub uses @clack/prompts' `select` and `isCancel`. We mock the whole
// module so the test is hermetic and never depends on stdin/stdout being
// attached to a real terminal.

import { describe, expect, it, vi } from "vitest";

vi.mock("@clack/prompts", () => ({
  select: vi.fn(),
  isCancel: vi.fn(),
  log: { error: vi.fn() },
}));

import { isCancel, log, select } from "@clack/prompts";

import { runHub, type HubFlowKind } from "../../src/cli/tui/hub.js";

describe("tui hub menu (runHub)", () => {
  it("HUB-A: select returns 'exit' → runHub resolves to { exitCode: 0 } and never calls runFlow", async () => {
    // Given: the hub prompts the user with `select`; the user picks "exit".
    vi.mocked(select).mockResolvedValueOnce("exit");
    vi.mocked(isCancel).mockReturnValue(false);

    const runFlow = vi.fn<(kind: HubFlowKind) => Promise<{ exitCode: number }>>(
      async () => ({ exitCode: 0 }),
    );

    // When: the hub is invoked.
    const result = await runHub({ runFlow });

    // Then: it returns { exitCode: 0 } without invoking the injected flow.
    expect(result).toEqual({ exitCode: 0 });
    expect(runFlow).not.toHaveBeenCalled();
  });

  it("HUB-B: mocked isCancel returns true → runHub resolves to { exitCode: 0 } (cancel branch)", async () => {
    // Given: the user hits Ctrl+C (or otherwise cancels) the select prompt.
    // @clack/prompts internally surfaces a sentinel; we don't care what it
    // is — the public API for callers is `isCancel(value)`. We force the
    // mocked `isCancel` to return `true` to simulate the cancel branch.
    vi.mocked(select).mockResolvedValueOnce("__cancelled__");
    vi.mocked(isCancel).mockReturnValue(true);

    const runFlow = vi.fn<(kind: HubFlowKind) => Promise<{ exitCode: number }>>(
      async () => ({ exitCode: 0 }),
    );

    // When: the hub is invoked.
    const result = await runHub({ runFlow });

    // Then: it short-circuits to { exitCode: 0 } without throwing and
    // without invoking the injected flow.
    expect(result).toEqual({ exitCode: 0 });
    expect(runFlow).not.toHaveBeenCalled();
  });

  it("HUB-C: runFlow throws → hub catches, logs the error, and re-prompts (Fix E)", async () => {
    // Given: the user picks "review", then a subsequent "exit" to break
    // the loop. The injected runFlow throws on the first call so the
    // hub's catch path must run, log via `log.error`, and re-prompt.
    vi.mocked(select)
      .mockResolvedValueOnce("review")
      .mockResolvedValueOnce("exit");
    vi.mocked(isCancel).mockReturnValue(false);

    const flowError = new Error("review wizard blew up");
    const runFlow = vi.fn<(kind: HubFlowKind) => Promise<{ exitCode: number }>>(
      async () => {
        throw flowError;
      },
    );

    // When: the hub is invoked. Without the catch, this would throw and
    // the test would fail. With the catch, the hub stays open and loops
    // back to the menu.
    const result = await runHub({ runFlow });

    // Then: the flow was invoked once (threw), the error was logged with
    // its message, and the hub returned cleanly after the user's second
    // select resolved to "exit".
    expect(runFlow).toHaveBeenCalledTimes(1);
    expect(runFlow).toHaveBeenCalledWith("review");
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining("Flow crashed"),
    );
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining(flowError.message),
    );
    expect(result).toEqual({ exitCode: 0 });
  });
});