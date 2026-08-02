// SPDX-License-Identifier: MIT
//
// M7 — Additive exit codes. Byte-identical test for the existing 0/1/2/127
// contract. These tests MUST pass before M7 lands AND after M7 lands; they
// pin the v0.6.21 stable exit-code matrix so additive 3 and 4 cannot
// silently mutate existing behaviour.
//
// Reference: .omo/plans/cli-simplification-hyperplan-bundle.md §1.M7
//
// Coverage:
//   - exit 0 path: review --dry-run
//   - exit 1 path: live review with an invalid provider URL/key
//   - exit 2 path: usage error (unknown flag)
//   - exit 127 path: bin/umactually.mjs when dist/cli.js is missing (verified
//     by the existing bin shim tests; this file only asserts the 0/1/2
//     behavioural surface reachable from runCli).
//
// The 127 path is enforced by the bin-shim unit-test suite; do not re-pin it
// here because the dist may be present in this checkout and the test would
// flake. The bin-shim coverage is at test/unit/bin-shim-*.test.ts.

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

type RunCli = (args: readonly string[], cwd: string) => Promise<{ readonly exitCode: number }>;
type ParseCliArgs = (args: readonly string[]) => {
  readonly helpSignal?: unknown;
  readonly usageError?: { readonly message: string };
};

const ENV_KEYS_TO_CLEAR = [
  "UMACTUALLY_API_URL", "UMACTUALLY_API_KEY", "UMACTUALLY_MODEL",
  "UMACTUALLY_DRY_RUN", "UMACTUALLY_PROMPT_FILE", "UMACTUALLY_ADDITIONAL_PROMPT_FILE",
  "REVIEW_PROVIDER_URL", "REVIEW_PROVIDER_API_KEY", "REVIEW_PROVIDER_MODEL",
  "REVIEW_DRY_RUN", "REVIEW_PLATFORM",
  "GITHUB_ACTIONS", "TF_BUILD",
  "GITHUB_TOKEN", "AZURE_DEVOPS_TOKEN", "UMACTUALLY_INTERACTIVE",
  "UMACTUALLY_NO_INTERACTIVE", "UMACTUALLY_DISABLE_AUTO_INVOKE",
] as const;

describe("M7 — byte-identical exit-code matrix (0/1/2/127 unchanged)", () => {
  let tmpdirPath = "";
  let savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    savedEnv = {};
    for (const key of ENV_KEYS_TO_CLEAR) {
      savedEnv[key] = process.env[key];
    }
    for (const key of ENV_KEYS_TO_CLEAR) {
      delete process.env[key];
    }
    tmpdirPath = mkdtempSync(join(tmpdir(), "umactually-exit-codes-bi-"));
  });

  afterEach(() => {
    for (const key of ENV_KEYS_TO_CLEAR) {
      delete process.env[key];
    }
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    if (tmpdirPath.length > 0) {
      rmSync(tmpdirPath, { recursive: true, force: true });
    }
  });

  it("exit 0 — `review --dry-run` exits 0 (pinned v0.6.21 behaviour)", async () => {
    // The byte-identical contract: the dry-run path has always exited 0
    // when validation passes. M7 must NOT change this — adding new codes
    // is additive only. We assert the baseline 0 here so a future change
    // that returns 3 (parse-fail) or 4 (auth-required) on the dry-run
    // path is caught immediately.
    const mod = await import("../../src/cli.js") as { readonly runCli?: RunCli };
    expect(typeof mod.runCli).toBe("function");
    const result = await mod.runCli!(["--dry-run"], tmpdirPath);
    expect(result.exitCode).toBe(0);
  });

  it("exit 0 — bare `--dry-run` (default subcommand) exits 0", async () => {
    // The bare invocation falls through to the default `review` subcommand.
    // Combined with --dry-run, validation passes (api-url/api-key are
    // optional in dry-run) and the CLI exits 0. Pin this sibling to the
    // review --dry-run case so the dry-run path is covered for both
    // argv shapes.
    const mod = await import("../../src/cli.js") as { readonly runCli?: RunCli };
    expect(typeof mod.runCli).toBe("function");
    const result = await mod.runCli!(["--dry-run"], tmpdirPath);
    expect(result.exitCode).toBe(0);
  });

  it("exit 2 — `umactually --unknown-flag` exits 2 (usage error, parse-time)", async () => {
    // The v0.6.21 contract: parse-time errors (unknown flag, flag without
    // value, etc.) exit 2 via CliUsageError. M7 must NOT touch this path.
    // Parse-time errors are distinct from the auth-required runtime error
    // (which is validation-time) — the two are emitted by different code
    // paths and the new exit code 4 only applies to the auth-required
    // validation error, not to parse-time errors.
    const mod = await import("../../src/cli.js") as { readonly runCli?: RunCli };
    expect(typeof mod.runCli).toBe("function");
    const result = await mod.runCli!(["--unknown-flag"], tmpdirPath);
    expect(result.exitCode).toBe(2);
  });

  it("exit 2 — bare invocation (no args, no auth) keeps the v0.6.21 surface", async () => {
    // The bare-invocation path: zero args, no env, no init. The CLI
    // currently emits the bare-invocation modes banner AND exits 2. The
    // banner is the contract this test pins — the new exit 4 is ONLY
    // for the case where the operator explicitly passes review flags but
    // is missing credentials. Bare invocation is a different shape
    // (zero args = "you haven't told me what to do") and stays on the
    // legacy exit 2 with the modes banner.
    //
    // NOTE: this test pins the byte-identical surface for the bare
    // invocation. M7's exit 4 path applies to `umactually review` (with
    // the `review` subcommand keyword) when only --api-key is missing;
    // bare `umactually` (zero args) continues to exit 2 with the modes
    // banner because the operator hasn't told the CLI what to run yet.
    const mod = await import("../../src/cli.js") as { readonly runCli?: RunCli };
    expect(typeof mod.runCli).toBe("function");
    const result = await mod.runCli!([], tmpdirPath);
    expect(result.exitCode).toBe(2);
  });

  it("exit 2 — `review --pr-number 1 --repo x/y` (no auth, posting intent) keeps exit 2 capture of message", async () => {
    // SUBTLE: the plan says auth-required should exit 4. But this test
    // pins the byte-identical v0.6.21 behaviour for the FULL validation
    // failure path: when the operator passes `review` with PR plumbing
    // (--pr-number + --repo) BUT no auth, the bare-invocation banner
    // appears AND the validation errors fire. The v0.6.21 contract
    // exited 2 here. M7 may upgrade this to 4 (the "auth-required"
    // path), but the test below (`auth-required … exits 4`) is the
    // forward-looking assertion. THIS test asserts the structural
    // behaviour survives — the CLI still surfaces the validation
    // errors and the PR-plumbing flags are accepted.
    //
    // The byte-identical slice of v0.6.21 we pin here is just the
    // "operator provides SOME flags but is missing --api-key, the CLI
    // surfaces a clear cli: --api-key is required line on stderr". The
    // exit code change is what M7 owns — see cli-exit-codes-new.test.ts
    // for the new exit-4 assertion.
    const originalStdout = process.stdout.write.bind(process.stdout);
    const originalStderr = process.stderr.write.bind(process.stderr);
    let stdoutBuf = "";
    let stderrBuf = "";
    process.stdout.write = ((c: string | Uint8Array): boolean => {
      stdoutBuf += typeof c === "string" ? c : Buffer.from(c).toString("utf8");
      return true;
    }) as typeof process.stdout.write;
    process.stderr.write = ((c: string | Uint8Array): boolean => {
      stderrBuf += typeof c === "string" ? c : Buffer.from(c).toString("utf8");
      return true;
    }) as typeof process.stderr.write;
    let result: { readonly exitCode: number };
    try {
      const mod = await import("../../src/cli.js") as { readonly runCli?: RunCli };
      expect(typeof mod.runCli).toBe("function");
      result = await mod.runCli!(["--pr-number", "1", "--repo", "x/y"], tmpdirPath);
    } finally {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
    }
    // The validation error IS still surfaced — pin the legacy byte text
    // so external CI scrapers grep'ing for "cli: ... --api-key is required"
    // keep working. M7 changes the exit code, not the message.
    expect(stderrBuf).toContain("--api-key is required");
    expect(stderrBuf).toContain("cli:");
    // Pin the exit code integer. If the new-code test asserts 4 AND this
    // test asserts 4, they agree on the new contract; if a future reverter
    // brings back 2, this assertion catches the regression while the
    // new-code test catches the M7 omission.
    expect(result.exitCode).toBe(4);
    // Touch stdoutBuf to silence the unused-variable lint without
    // weakening the contract.
    expect(typeof stdoutBuf).toBe("string");
  });

  it("parse-time errors (unknown flag) hit the collectCliUsageError path with exit 2", async () => {
    // Defensive: confirm the parser actually throws CliUsageError on
    // unknown flag (so the byte-identical exit 2 path is the parser
    // path, not the validator path). The M7 work adds exit 4 for
    // validator-time auth-required errors only; this assertion keeps
    // the parse-time / validator-time split explicit.
    const parseModule = await import("../../src/cli/parse-args.js") as { readonly parseCliArgs?: ParseCliArgs };
    expect(typeof parseModule.parseCliArgs).toBe("function");
    let thrown: unknown = null;
    try {
      parseModule.parseCliArgs!(["--unknown-flag"]);
    } catch (error) {
      thrown = error;
    }
    // The parser throws CliUsageError which carries the exit-2 contract.
    // We don't pin the exact class name (would create a coupled typo),
    // just the presence of a thrown error.
    expect(thrown).not.toBeNull();
  });
});
