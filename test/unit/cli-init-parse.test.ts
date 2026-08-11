// SPDX-License-Identifier: MIT
//
// Tests for the init wizard's argv parser, formatters, and quick help/show
// paths. These pin the public surface added by Task 12 (interactive init)
// and lifted it onto the post-REFACTOR `parseInitArgs` decomposition that
// reduced CC from 59 to ~3.
//
// ITER-2e: these tests are NEW and additive — they do not modify the
// ITER-1/2a/2c/2d test files.

import { describe, expect, it } from "vitest";

import {
  INIT_HELP_TEXT,
  formatInitHuman,
  formatInitJson,
  parseInitArgs,
  runInit,
  type InitResult,
} from "../../src/cli/init.js";

function emptyEnv(): Readonly<Record<string, string | undefined>> {
  return {};
}

describe("parseInitArgs — flag parsing (ITER-2e)", () => {
  it("rejects unknown long flags with a 'unknown flag:' error", () => {
    const result = parseInitArgs(["--no-such-flag"], emptyEnv());
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors[0]).toContain("unknown flag: --no-such-flag");
  });

  it("rejects positional arguments with a 'unexpected positional argument' error", () => {
    const result = parseInitArgs(["extra"], emptyEnv());
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors[0]).toContain("unexpected positional argument: extra");
  });

  it("sets help=true for --help and -h", () => {
    expect(parseInitArgs(["--help"], emptyEnv()).help).toBe(true);
    expect(parseInitArgs(["-h"], emptyEnv()).help).toBe(true);
  });

  it("sets json, force, yes, apply, non-interactive, dry-run, show, policy-template as boolean toggles", () => {
    const args = parseInitArgs(
      ["--json", "--force", "--yes", "--apply", "--non-interactive", "--dry-run", "--show", "--policy-template"],
      emptyEnv(),
    );
    expect(args.json).toBe(true);
    expect(args.force).toBe(true);
    expect(args.yes).toBe(true);
    expect(args.apply).toBe(true);
    expect(args.nonInteractive).toBe(true);
    expect(args.dryRun).toBe(true);
    expect(args.show).toBe(true);
    expect(args.policyTemplate).toBe(true);
  });

  it("parses --ci with each valid value (auto|github|azure|none)", () => {
    expect(parseInitArgs(["--ci", "auto"], emptyEnv()).ci).toBe("auto");
    expect(parseInitArgs(["--ci", "github"], emptyEnv()).ci).toBe("github");
    expect(parseInitArgs(["--ci", "azure"], emptyEnv()).ci).toBe("azure");
    expect(parseInitArgs(["--ci", "none"], emptyEnv()).ci).toBe("none");
  });

  it("rejects --ci with an invalid value", () => {
    const result = parseInitArgs(["--ci", "bogus"], emptyEnv());
    expect(result.errors.some((e) => e.includes("--ci must be one of"))).toBe(true);
  });

  it("rejects --ci without a value", () => {
    const result = parseInitArgs(["--ci"], emptyEnv());
    expect(result.errors.some((e) => e.includes("--ci requires a value"))).toBe(true);
  });

  it("parses --scope with global|repo", () => {
    expect(parseInitArgs(["--scope", "global"], emptyEnv()).scope).toBe("global");
    expect(parseInitArgs(["--scope", "repo"], emptyEnv()).scope).toBe("repo");
  });

  it("rejects --scope with an invalid value", () => {
    const result = parseInitArgs(["--scope", "workspace"], emptyEnv());
    expect(result.errors.some((e) => e.includes("--scope must be"))).toBe(true);
  });

  it("parses --provider with openai-compatible|anthropic|copilot", () => {
    expect(parseInitArgs(["--provider", "openai-compatible"], emptyEnv()).provider).toBe("openai-compatible");
    expect(parseInitArgs(["--provider", "anthropic"], emptyEnv()).provider).toBe("anthropic");
    expect(parseInitArgs(["--provider", "copilot"], emptyEnv()).provider).toBe("copilot");
  });

  it("rejects --provider with an invalid value", () => {
    const result = parseInitArgs(["--provider", "gpt-9000"], emptyEnv());
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
  });

  it("rejects --provider without a value", () => {
    const result = parseInitArgs(["--provider"], emptyEnv());
    expect(result.errors.some((e) => e.includes("--provider requires a value"))).toBe(true);
  });

  it("parses --model as a free-form string", () => {
    expect(parseInitArgs(["--model", "gpt-4o-mini"], emptyEnv()).model).toBe("gpt-4o-mini");
  });

  it("rejects --model without a value", () => {
    const result = parseInitArgs(["--model"], emptyEnv());
    expect(result.errors.some((e) => e.includes("--model requires a value"))).toBe(true);
  });

  it("rejects --github-api-base without a value", () => {
    const result = parseInitArgs(["--github-api-base"], emptyEnv());
    expect(result.errors.some((e) => e.includes("--github-api-base requires a value"))).toBe(true);
  });

  it("falls back to env vars for provider/model/githubApiBase when flags are absent", () => {
    const env = {
      UMACTUALLY_PROVIDER: "anthropic",
      UMACTUALLY_MODEL: "claude-opus-4-7",
      UMACTUALLY_GITHUB_API_BASE: "https://ghe.example.com/api/v3",
    };
    const result = parseInitArgs([], env);
    expect(result.provider).toBe("anthropic");
    expect(result.model).toBe("claude-opus-4-7");
    expect(result.githubApiBase).toBe("https://ghe.example.com/api/v3");
  });

  it("silently ignores an unknown UMACTUALLY_PROVIDER env value (no error, no provider)", () => {
    const result = parseInitArgs([], { UMACTUALLY_PROVIDER: "gpt-9000" });
    expect(result.errors).toHaveLength(0);
    expect(result.provider).toBeUndefined();
  });
});

describe("INIT_HELP_TEXT — content (ITER-2e)", () => {
  it("is a non-empty string mentioning the wizard and key flags", () => {
    expect(INIT_HELP_TEXT.length).toBeGreaterThan(0);
    expect(INIT_HELP_TEXT).toContain("init");
    expect(INIT_HELP_TEXT).toContain("--provider");
    expect(INIT_HELP_TEXT).toContain("--ci");
  });
});

describe("formatInitJson / formatInitHuman (ITER-2e)", () => {
  const okResult: InitResult = {
    mode: "non-interactive",
    outcome: "ok",
    exitCode: 0,
    savedConfigPath: "/home/u/.umactually/config.json",
    savedConfigBytes: 234,
    ciGenerated: ["github"],
    checks: [
      { id: "config-atomic-write", status: "ok", message: "saved." },
      { id: "ci-generation", status: "ok", message: "wrote workflow.", hint: "see CI logs" },
    ],
    hints: ["tip: run --review"],
    sources: {},
  };

  it("formatInitJson returns valid JSON ending with a newline", () => {
    const out = formatInitJson(okResult);
    expect(out.endsWith("\n")).toBe(true);
    const parsed = JSON.parse(out);
    expect(parsed.outcome).toBe("ok");
    expect(parsed.savedConfigPath).toBe("/home/u/.umactually/config.json");
    expect(parsed.ciGenerated).toEqual(["github"]);
    expect(parsed.checks).toHaveLength(2);
  });

  it("formatInitJson redacts secret-shaped values in check messages and hints", () => {
    const result: InitResult = {
      ...okResult,
      checks: [
        { id: "secret-redaction", status: "fail", message: "key was ghp_exampleleaked", hint: "rotate ghp_rotateme" },
      ],
    };
    const parsed = JSON.parse(formatInitJson(result));
    expect(parsed.checks[0].message).not.toContain("ghp_exampleleaked");
    expect(parsed.checks[0].hint).not.toContain("ghp_rotateme");
  });

  it("formatInitHuman renders 'init complete' for outcome=ok", () => {
    const out = formatInitHuman(okResult);
    expect(out).toContain("init complete");
    expect(out).toContain("saved config: /home/u/.umactually/config.json");
    expect(out).toContain("ci workflow: github");
  });

  it("formatInitHuman renders 'init aborted' for outcome=aborted", () => {
    const out = formatInitHuman({ ...okResult, outcome: "aborted", savedConfigPath: null, savedConfigBytes: null, ciGenerated: [] });
    expect(out).toContain("init aborted");
    expect(out).not.toContain("saved config:");
  });

  it("formatInitHuman renders 'init failed' for outcome=error", () => {
    const out = formatInitHuman({ ...okResult, outcome: "error", savedConfigPath: null, savedConfigBytes: null, ciGenerated: [] });
    expect(out).toContain("init failed");
  });

  it("formatInitHuman renders each check with bracket status and hint", () => {
    const out = formatInitHuman(okResult);
    expect(out).toContain("[OK");
    expect(out).toContain("hint: see CI logs");
  });
});

describe("runInit — help and show paths (ITER-2e)", () => {
  it("returns outcome=ok with exitCode 0 for --help (no I/O)", async () => {
    const result = await runInit({
      argv: ["--help"],
      deps: {
        cwd: "/repo",
        env: {}, argv: [],
        homeDir: "/home/u",
        platform: "linux",
        packageVersion: "0.0.0",
        isTTY: false,
        
      },
    });
    expect(result.outcome).toBe("ok");
    expect(result.exitCode).toBe(0);
  });

  it("returns outcome=ok for --show with no saved config present", async () => {
    const result = await runInit({
      argv: ["--show"],
      deps: {
        cwd: "/nonexistent-workdir-just-for-coverage",
        env: {}, argv: [],
        homeDir: "/tmp/nonexistent-home-for-coverage",
        platform: "linux",
        packageVersion: "0.0.0",
        isTTY: false,
        
      },
    });
    expect(result.outcome).toBe("ok");
    expect(result.savedConfigPath).toBeNull();
  });

  it("returns outcome=error with exitCode 2 for unknown flags", async () => {
    const result = await runInit({
      argv: ["--no-such-flag"],
      deps: {
        cwd: "/repo",
        env: {}, argv: [],
        homeDir: "/home/u",
        platform: "linux",
        packageVersion: "0.0.0",
        isTTY: false,
        
      },
    });
    expect(result.outcome).toBe("error");
    expect(result.exitCode).toBe(2);
    expect(result.checks.some((c) => c.status === "fail")).toBe(true);
  });
});
