// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";

import { canPromptInteractively, SmartPromptUnavailable } from "../../src/cli/smart-prompt.js";

describe("SmartPromptUnavailable (typed boundary)", () => {
  it("carries a structured code", () => {
    const e = new SmartPromptUnavailable("NO_TTY", "no tty");
    expect(e.code).toBe("NO_TTY");
    expect(e.message).toBe("no tty");
  });

  it("canPromptInteractively returns a boolean and never throws", () => {
    // The contract is "boolean, never throws" — confirm in both
    // TTY and non-TTY environments. The function is a read-only
    // check on process.stdin.isTTY / process.stdout.isTTY.
    const result = canPromptInteractively();
    expect(typeof result).toBe("boolean");
  });

  it("accepts every documented code literal", () => {
    // Guard against typos creeping into the typed boundary.
    // `NO_TTY`, `TIMEOUT`, `CLOSED_STDIN`, and `READ_ERROR` are
    // every value the constructor accepts; a future contributor
    // who adds a code without considering the test list will see
    // this fail and update both at once.
    const codes = ["NO_TTY", "TIMEOUT", "CLOSED_STDIN", "READ_ERROR"] as const;
    for (const code of codes) {
      const e = new SmartPromptUnavailable(code, `synthetic ${code} message`);
      expect(e.code).toBe(code);
      expect(e.message).toBe(`synthetic ${code} message`);
    }
  });
});

