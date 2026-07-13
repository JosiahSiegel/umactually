import { describe, expect, it } from "vitest";

import { CLI_HELP_TEXT } from "../../src/cli/help.js";

describe("CLI help text", () => {
  it("mentions --prompt-files so operators discover the new array override", () => {
    expect(CLI_HELP_TEXT).toContain("--prompt-files");
  });

  it("mentions --additional-prompt-files so operators discover the new array override", () => {
    expect(CLI_HELP_TEXT).toContain("--additional-prompt-files");
  });

  it("documents that --prompt-files / --additional-prompt-files OVERRIDE the default lookup list", () => {
    // The help text MUST explain the override semantics so an operator
    // reading `umactually-pr-review --help` understands the new
    // behavior. If a future edit drops the override-language, the
    // operator can no longer discover the auto-lookup behavior from
    // --help output alone.
    expect(CLI_HELP_TEXT).toMatch(/--prompt-files[^]*overrides defaults/u);
    expect(CLI_HELP_TEXT).toMatch(/--additional-prompt-files[^]*overrides defaults/u);
  });

  it("mentions the existing --prompt-file and --additional-prompt-file (back-compat surface)", () => {
    // Regression: if the legacy single-file flags drop off the help
    // text, operators who scripted against them lose discoverability.
    expect(CLI_HELP_TEXT).toContain("--prompt-file <path>");
    expect(CLI_HELP_TEXT).toContain("--additional-prompt-file <path>");
  });
});