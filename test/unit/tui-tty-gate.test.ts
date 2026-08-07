import { afterEach, describe, expect, it } from "vitest";

import { defaultCheckTTY, runTtyGate } from "../../src/cli/tui/tty-gate.js";

/**
 * Unit tests for the TTY gate (todo:11).
 *
 * `runTtyGate` is the single TTY checkpoint for the `umactually tui`
 * subcommand: production callers (todo:9's `runTuiBranch`) invoke it with
 * no arguments and rely on `defaultCheckTTY`; tests inject their own
 * `checkTTY` so the result is deterministic regardless of the runner's
 * own TTY status.
 */

describe("tty-gate", () => {
  describe("runTtyGate", () => {
    it("returns { ok: true } when checkTTY reports a TTY", () => {
      const result = runTtyGate({ checkTTY: () => true });
      expect(result).toEqual({ ok: true });
    });

    it("returns the exitCode-2 hint shape when checkTTY reports no TTY", () => {
      const result = runTtyGate({ checkTTY: () => false });
      expect(result).toEqual({
        ok: false,
        exitCode: 2,
        hint:
          "umactually tui requires a TTY; run from an interactive terminal (or use 'umactually review' for non-interactive flows).\n",
      });
    });
  });

  describe("defaultCheckTTY", () => {
    const ORIGINAL_STDIN_TTY = process.stdin.isTTY;
    const ORIGINAL_STDOUT_TTY = process.stdout.isTTY;

    afterEach(() => {
      // Restore the originals so subsequent tests / the runner see the
      // real TTY state.
      Object.defineProperty(process.stdin, "isTTY", {
        value: ORIGINAL_STDIN_TTY,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(process.stdout, "isTTY", {
        value: ORIGINAL_STDOUT_TTY,
        configurable: true,
        writable: true,
      });
    });

    it("returns false when stdin is a TTY but stdout is not", () => {
      Object.defineProperty(process.stdin, "isTTY", {
        value: true,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(process.stdout, "isTTY", {
        value: false,
        configurable: true,
        writable: true,
      });
      expect(defaultCheckTTY()).toBe(false);
    });

    it("returns true when both stdin and stdout are TTYs", () => {
      Object.defineProperty(process.stdin, "isTTY", {
        value: true,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(process.stdout, "isTTY", {
        value: true,
        configurable: true,
        writable: true,
      });
      expect(defaultCheckTTY()).toBe(true);
    });
  });
});
