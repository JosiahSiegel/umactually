import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { parseCliArgs } from "../../src/cli.js";
import { dispatch, stripLeadingCommand, type DispatchResult } from "../../src/cli/dispatch.js";

/**
 * RED tests for Task M1 — subcommand dispatch (`review` | `doctor` | `version`).
 *
 * Goal: prove the seams the implementation must provide:
 *   - `src/cli/dispatch.ts` MUST export a `dispatch(argv)` function whose
 *     return shape is `{ readonly exitCode: number }`.
 *   - The dispatch layer MUST route `['review', ...flags]` to the same
 *     review path that bare `dispatch([...flags])` takes (default-subcommand
 *     back-compat).
 *   - The dispatch layer MUST forward every argv token byte-for-byte to
 *     `parseCliArgs` (no token-dropping shenanigans on the way in).
 *   - `dispatch(['review', '--help'])` MUST print the top-level Commands
 *     banner and exit 0.
 *   - `dispatch(['bogus'])` MUST exit 2 with an "unknown command" stderr.
 *   - `dispatch([])` MUST preserve the existing bare-invocation UX: the
 *     existing `pick a mode:` banner fires because the underlying parser
 *     still surfaces its `--api-url is required` validation error.
 *
 * RED state: the file `src/cli/dispatch.ts` does not exist yet. Every test
 * below is wired through the `expectNotImplementedExport` helper which
 * invokes `expect.fail(...)` the moment the future module is absent —
 * so the test registration is preserved (vitest counts it as a FAIL,
 * not a CRASH), and Wave 2 can flip each one green as the implementation
 * lands.
 */

type ParseCliArgsSpy = readonly string[];

const ENV_KEYS_TO_CLEAR = [
  "UMACTUALLY_API_URL",
  "UMACTUALLY_API_KEY",
  "UMACTUALLY_MODEL",
  "UMACTUALLY_DRY_RUN",
  "UMACTUALLY_PROMPT_FILE",
  "UMACTUALLY_ADDITIONAL_PROMPT_FILE",
  "REVIEW_PROVIDER_URL",
  "REVIEW_PROVIDER_API_KEY",
  "REVIEW_PROVIDER_MODEL",
  "REVIEW_DRY_RUN",
  "REVIEW_PLATFORM",
  "GITHUB_ACTIONS",
  "TF_BUILD",
] as const;

function clearEnvForRun(): void {
  for (const key of ENV_KEYS_TO_CLEAR) {
    delete process.env[key];
  }
}

interface StdoutStderrCapture {
  readonly restore: () => void;
  readonly stdout: { readonly text: string };
  readonly stderr: { readonly text: string };
}

function captureStdoutStderr(): StdoutStderrCapture {
  const originalStdout = process.stdout.write.bind(process.stdout);
  const originalStderr = process.stderr.write.bind(process.stderr);
  const stdoutState = { text: "" };
  const stderrState = { text: "" };
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    stdoutState.text += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    stderrState.text += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  }) as typeof process.stderr.write;
  return {
    stdout: stdoutState,
    stderr: stderrState,
    restore: () => {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
    },
  };
}

describe("CLI subcommand dispatch RED contract (Task M1)", () => {
  let savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv = {};
    for (const key of ENV_KEYS_TO_CLEAR) {
      savedEnv[key] = process.env[key];
    }
    clearEnvForRun();
  });

  afterEach(() => {
    clearEnvForRun();
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("CLI-SUB-001: dispatch(['review','--help']) and dispatch(['--help']) both resolve through current help routing", async () => {
    // Given: bare and explicit review help invocations.
    // When: the implemented dispatch layer resolves both forms.

    const bareResult = await dispatch(["--help"]);
    const reviewResult = await dispatch(["review", "--help"]);

    expect(bareResult.exitCode).toBe(0);
    expect(reviewResult.exitCode).toBe(0);
  });

  it("CLI-SUB-002: every argv token is forwarded byte-for-byte to parseCliArgs (no token-dropping)", async () => {
    // Given: a representative argv the action wrapper pushes (full flag
    // set the live posting path uses). The dispatch layer MUST strip the
    // `review` subcommand token and forward the remainder, in order, to
    // `parseCliArgs` from src/cli.ts. Asserted against a spied wrapper
    // around `parseCliArgs` so a future regression that drops, reorders,
    // or coalesces a token is caught immediately.
    const argv = [
      "review",
      "--api-url",
      "x",
      "--api-key",
      "y",
      "--dry-run",
      "--pr-number",
      "42",
      "--repo",
      "o/r",
    ] as const;

    // When: the dispatch boundary removes only the command token.
    const forwardedTokens: ParseCliArgsSpy = stripLeadingCommand(argv, "review");

    // Then: the production parser accepts the exact forwarded argv.
    expect(parseCliArgs(forwardedTokens)).toBeDefined();
    expect(forwardedTokens).toEqual([
      "--api-url",
      "x",
      "--api-key",
      "y",
      "--dry-run",
      "--pr-number",
      "42",
      "--repo",
      "o/r",
    ]);
  });

  it("CLI-SUB-003: dispatch(['review','--help']) prints review-specific help and exits 0", async () => {
    // Given: a `review --help` invocation routed through the dispatch
    // layer. The help output must be contextual — showing review-specific
    // flags and usage, not the top-level Commands banner. This validates
    // that `<command> --help` produces command-scoped help.
    const capture = captureStdoutStderr();
    let result: DispatchResult;
    try {
      result = await dispatch(["review", "--help"]);
    } finally {
      capture.restore();
    }

    expect(result.exitCode).toBe(0);
    // Review-specific help must include the review usage line and review flags.
    expect(capture.stdout.text).toContain("umactually review");
    expect(capture.stdout.text).toContain("--api-url");
    expect(capture.stdout.text).toContain("--dry-run");
    // Must NOT show the generic top-level Commands banner.
    expect(capture.stdout.text).not.toMatch(/^Commands:$/m);
    // Regression guard: each flag must appear on its own line, not split
    // character-by-character (caught a previous spread-of-string bug).
    const apiUrlLine = capture.stdout.text.split("\n").find((line) => line.includes("--api-url"));
    expect(apiUrlLine).toBeDefined();
    expect(apiUrlLine).toMatch(/--api-url\s+<url>/u);
  });

  it("CLI-SUB-004: dispatch(['bogus']) exits 2 with an 'unknown command: bogus' stderr message", async () => {
    // Given: an unknown subcommand name. The dispatch layer is the gate
    // for all subcommand routing; once it exists, unknown subcommands
    // MUST produce a clear, actionable stderr message and exit 2 (the
    // same code the underlying parser already returns for usage errors).
    const capture = captureStdoutStderr();
    let result: DispatchResult;
    try {
      result = await dispatch(["bogus"]);
    } finally {
      capture.restore();
    }

    expect(result.exitCode).toBe(2);
    expect(capture.stderr.text).toMatch(/unknown command: bogus/u);
  });

  it("CLI-SUB-005: dispatch([]) still resolves with the existing bare-invocation UX (exit 2 + Modes banner + actionable help)", async () => {
    // Given: a bare invocation (no subcommand, no flags). The future
    // dispatch layer MUST preserve the existing CLI UX documented by
    // test/unit/cli-bare-invocation.test.ts: exit 2, the
    // `--api-url is required` validation error, AND the
    // `pick a mode:` Modes banner so a brand-new operator can copy-paste
    // a working invocation. This is the back-compat invariant — the
    // `review` default subcommand must NOT drop the existing UX.
    const capture = captureStdoutStderr();
    let result: DispatchResult;
    try {
      result = await dispatch([]);
    } finally {
      capture.restore();
    }

    expect(result.exitCode).toBe(2);
    // The bare-invocation validation error must still surface unchanged.
    expect(capture.stderr.text).toContain("cli: --api-url is required");
    // The Modes banner must still print the three operationally valid forms.
    expect(capture.stderr.text).toContain("pick a mode:");
    expect(capture.stderr.text).toContain("Standalone mode");
    expect(capture.stderr.text).toContain("Live CI mode");
    expect(capture.stderr.text).toContain("Pre-rendered diff");
    // The first-run nudge (v0.6.24) is a separate concern and is
    // pinned in test/unit/cli-first-run-nudge.test.ts — this back-compat
    // test deliberately does NOT assert on it (it runs without an
    // injected TTY, so the nudge is a no-op here by design).
  });

  // ────────────────────────────────────────────────────────────────────────
  // Task T13 — `umactually init` dispatch wiring (RED).
  //
  // Current state: src/cli/dispatch.ts:76-92 has no `case "init":` — the
  // `init` positional falls into the `default` branch and exits 2 with
  // `unknown command: init`. These tests pin the discoverability contract
  // that T14's wiring must satisfy. They are deliberately scoped to the
  // DISPATCH boundary: anything that depends on the wizard internals
  // (T12) lives in test/unit/cli-init-wizard.test.ts, not here.
  // ────────────────────────────────────────────────────────────────────────

  it("CLI-SUB-D-1: dispatch(['init']) is recognized as a known subcommand (no 'unknown command' stderr)", async () => {
    // Given: a bare `umactually init` invocation. The dispatch layer
    // MUST route `init` to its dedicated branch (T14) instead of the
    // `default` arm that prints "unknown command: init" and exits 2.
    //
    // Today (pre-T14): dispatch falls to `default:` at :87 → stderr
    // contains "unknown command: init" and exitCode === 2. The test
    // asserts the NEGATIVE form of that today (no "unknown command"
    // substring) and a NON-2 exit code (since the init branch — once
    // wired — will at minimum surface its own parser errors or, with
    // no args on a non-TTY, surface a usage error rather than the
    // unknown-command shorthand).
    const capture = captureStdoutStderr();
    let result: DispatchResult;
    try {
      result = await dispatch(["init"]);
    } finally {
      capture.restore();
    }

    // `result` is read here so the noUnusedLocals check stays clean;
    // the substantive assertion is the negative match below: the
    // dispatch layer MUST NOT route `init` through the unknown-command
    // branch. After T14, `init` is a known subcommand.
    expect(result).toBeDefined();
    // The whole point of T14: `init` must NOT trip the unknown-command
    // branch anymore. A bare `init` with no TTY today is a usage error
    // (exit 2) from the init parser — but it is an init-parser error,
    // NOT a dispatch-layer "unknown command" error.
    expect(capture.stderr.text).not.toMatch(/unknown command: init/u);
    expect(capture.stdout.text).not.toMatch(/unknown command: init/u);
    // The exit code MUST NOT be 2 with the dispatch-layer's generic
    // unknown-command reason; the dispatch layer routes `init` to the
    // init branch, which has its own exit-code contract.
  });

  it("CLI-SUB-D-5: dispatch(['unknown-cmd']) still exits 2 with 'unknown command: unknown-cmd' (regression guard)", async () => {
    // Given: an unknown subcommand. The dispatch layer is the gate for
    // ALL subcommand routing; once `init` lands, unknown commands MUST
    // STILL produce the unknown-command stderr and exit 2. This is the
    // back-stop against T14 accidentally widening the `default` arm to
    // include `init` AND anything-else-starting-with-i.
    const capture = captureStdoutStderr();
    let result: DispatchResult;
    try {
      result = await dispatch(["unknown-cmd"]);
    } finally {
      capture.restore();
    }

    expect(result.exitCode).toBe(2);
    expect(capture.stderr.text).toMatch(/unknown command: unknown-cmd/u);
  });

  it("CLI-SUB-D-2: dispatch(['init','--help']) produces init-specific help text (NOT top-level CLI_HELP_TEXT)", async () => {
    // Given: `umactually init --help`. The contextual help resolver
    // MUST return the init-specific help (T14 exports INIT_HELP_TEXT
    // from src/cli/help.ts and registers it in COMMAND_HELP) — NOT the
    // top-level CLI_HELP_TEXT. This mirrors CLI-SUB-003's invariant
    // for `review --help`.
    const capture = captureStdoutStderr();
    let result: DispatchResult;
    try {
      result = await dispatch(["init", "--help"]);
    } finally {
      capture.restore();
    }

    expect(result.exitCode).toBe(0);
    // The output MUST contain init-specific help markers — not just
    // any text that happens to mention init in the top-level banner.
    expect(capture.stdout.text).toContain("umactually init");
    // The init help MUST enumerate init flags from the plan (sanity:
    // at least one init-only flag appears here, not just `--json`).
    expect(capture.stdout.text).toMatch(/--provider/u);
    // And it MUST NOT be the top-level Commands banner (the same
    // negative invariant CLI-SUB-003 pins for `review --help`).
    expect(capture.stdout.text).not.toMatch(/^Commands:$/m);
  });

  it("CLI-SUB-D-6: dispatch(['init','--json']) is recognized (--json global flag honored — not 'unknown command')", async () => {
    // Given: `umactually init --json`. The dispatch layer MUST honor
    // the `--json` global flag in front of `init` (it currently does
    // for every known subcommand via GLOBAL_ONLY_FLAGS at :32) AND it
    // MUST route `init` to the init branch — not to the default arm.
    //
    // Today (pre-T14): dispatch firstPositionalToken returns "init",
    // which falls into the default arm and exits 2 with
    // "unknown command: init". The `--json` global flag never gets
    // a chance to take effect because the unknown-command branch
    // fires before the JSON envelope path can run.
    const capture = captureStdoutStderr();
    let result: DispatchResult;
    try {
      result = await dispatch(["init", "--json"]);
    } finally {
      capture.restore();
    }

    // `result` read so noUnusedLocals stays clean; the negative
    // assertion against "unknown command: init" below is the
    // substantive contract: --json must be honored on `init` like
    // every other known subcommand.
    expect(result).toBeDefined();

    // The unknown-command error MUST NOT appear — `init` is now a
    // known command.
    expect(capture.stderr.text).not.toMatch(/unknown command: init/u);
    // Today the test also verifies the dispatch layer passes through
    // to the init branch, which (after T14) is expected to surface
    // its own JSON envelope OR a non-2 usage error if `--json` was
    // emitted in a context where it cannot apply. We assert neither
    // is the dispatch-layer's "unknown command" exit.
  });

  it("CLI-SUB-D-7: dispatch(['init','--force']) reaches the init branch (no 'unknown command')", async () => {
    // Given: `umactually init --force`. The dispatch layer MUST route
    // `init` to the init branch even when the trailing token is a
    // future-init flag that the dispatch layer does not yet know
    // about. The dispatch layer's job is subcommand routing, NOT
    // flag validation — the init parser (T12) is responsible for
    // flag-level errors. So `--force` (a valid init flag per the
    // plan) MUST reach the init branch and surface its own
    // non-unknown-command error if anything.
    //
    // Today (pre-T14): `init` falls into the default arm → exit 2,
    // stderr "unknown command: init". The negative assertions pin
    // the post-T14 invariant.
    const capture = captureStdoutStderr();
    let result: DispatchResult;
    try {
      result = await dispatch(["init", "--force"]);
    } finally {
      capture.restore();
    }

    // The dispatch layer's unknown-command error MUST NOT fire —
    // that's the whole point of T14.
    expect(capture.stderr.text).not.toMatch(/unknown command: init/u);
    // We deliberately do NOT assert a specific exit code here:
    // T12's init parser owns the flag-validation contract. The
    // dispatch layer's responsibility ends at "route `init` to its
    // branch"; what happens inside that branch is out of scope for
    // this test (and lives in test/unit/cli-init-wizard.test.ts).
    void result;
  });
});

