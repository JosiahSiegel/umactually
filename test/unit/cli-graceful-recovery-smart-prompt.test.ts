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
});
