// SPDX-License-Identifier: MIT
//
// M7 — Additive exit codes. New codes test for 3 (parse-fail) and 4
// (auth-required). These tests are RED before M7 lands (the CLI still
// emits 1 for parse-fail and 2 for auth-required) and GREEN after.
//
// Reference: .omo/plans/cli-simplification-hyperplan-bundle.md §1.M7
//
// Coverage:
//   - exit 3: validateLiveArtifact returns 3 for the parse-fail sentinel
//     artifact (the wire shape that surfaces when the provider response
//     could not be parsed into a structured review).
//   - exit 4: when the operator runs `review` with PR plumbing BUT no
//     --api-key, --api-url, or env-var fallback, the CLI surfaces the
//     "cli: --api-key is required" / "cli: --api-url is required" lines
//     (byte-identical to v0.6.21) and exits 4 — the auth-required
//     diagnostic.
//   - exit 4 surface-only invariant: the auth-required path still emits
//     the same stderr lines so external CI scrapers keep working.
//
// The parse-fail wire path is unit-testable via the `validateLiveArtifact`
// export in src/cli/run.ts. The auth-required path is exercised end-to-end
// via runCli() with a pre-cleared environment.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

type RunCli = (args: readonly string[], cwd: string) => Promise<{ readonly exitCode: number }>;
type ValidateLiveArtifact = (artifactPath: string, reviewExitCode: number) => number;

const ENV_KEYS_TO_CLEAR = [
  "UMACTUALLY_API_URL", "UMACTUALLY_API_KEY", "UMACTUALLY_MODEL",
  "UMACTUALLY_DRY_RUN", "UMACTUALLY_PROMPT_FILE", "UMACTUALLY_ADDITIONAL_PROMPT_FILE",
  "REVIEW_PROVIDER_URL", "REVIEW_PROVIDER_API_KEY", "REVIEW_PROVIDER_MODEL",
  "REVIEW_DRY_RUN", "REVIEW_PLATFORM",
  "GITHUB_ACTIONS", "TF_BUILD",
  "GITHUB_TOKEN", "AZURE_DEVOPS_TOKEN", "UMACTUALLY_INTERACTIVE",
  "UMACTUALLY_NO_INTERACTIVE", "UMACTUALLY_DISABLE_AUTO_INVOKE",
] as const;

describe("M7 — new exit code 3 (parse-fail)", () => {
  // The parse-fail pipeline is triggered when the provider response
  // cannot be parsed into a structured review. The wire-level surface
  // is `validateLiveArtifact` (src/cli/run.ts:397), which reads the
  // artifact written by writeLiveArtifact and maps a parse-fail sentinel
  // to a non-zero exit code. Before M7 this was 1; after M7 it is 3.
  // We test the function directly so the test is independent of the
  // orchestrator (which would need a live provider key).

  it("validateLiveArtifact returns 3 for a parse-fail sentinel artifact", async () => {
    // The sentinel string is the literal text the orchestrator writes
    // when the provider response could not be parsed. See
    // src/cli/check-review-artifact.ts:PARSE_FAIL_MARKERS and the
    // writeLiveArtifact branch in src/cli/run.ts:476.
    const tmpdirPath = mkdtempSync(join(tmpdir(), "umactually-m7-parse-fail-"));
    try {
      const artifactPath = join(tmpdirPath, "review.json");
      writeFileSync(artifactPath, "Parse failed — provider response", "utf8");
      const runModule = await import("../../src/cli/run.js") as { readonly validateLiveArtifact?: ValidateLiveArtifact };
      expect(typeof runModule.validateLiveArtifact).toBe("function");
      const exitCode = runModule.validateLiveArtifact!(artifactPath, 0);
      expect(exitCode).toBe(3);
    } finally {
      rmSync(tmpdirPath, { recursive: true, force: true });
    }
  });

  it("validateLiveArtifact returns 3 for an explicitly parseFailed=true artifact", async () => {
    // An artifact whose body is valid JSON but whose `parseFailed` flag
    // is true indicates the live review surfaced a parse failure and
    // stamped the sentinel. M7 must map this to exit 3.
    const tmpdirPath = mkdtempSync(join(tmpdir(), "umactually-m7-parse-flag-"));
    try {
      const artifactPath = join(tmpdirPath, "review.json");
      writeFileSync(
        artifactPath,
        JSON.stringify({
          event: "REQUEST_CHANGES",
          verdict: "NEEDS_FIX",
          inlineThreadCount: 0,
          parseFailed: true,
        }),
        "utf8",
      );
      const runModule = await import("../../src/cli/run.js") as { readonly validateLiveArtifact?: ValidateLiveArtifact };
      expect(typeof runModule.validateLiveArtifact).toBe("function");
      const exitCode = runModule.validateLiveArtifact!(artifactPath, 0);
      expect(exitCode).toBe(3);
    } finally {
      rmSync(tmpdirPath, { recursive: true, force: true });
    }
  });

  it("validateLiveArtifact returns 3 for an empty artifact (no contents)", async () => {
    // The empty-artifact case is the universal "the review produced
    // nothing worth checking" sentinel. Pre-M7 it returned 1; post-M7 it
    // returns 3 because the underlying reason is parse-fail (no review
    // output to parse).
    const tmpdirPath = mkdtempSync(join(tmpdir(), "umactually-m7-parse-empty-"));
    try {
      const artifactPath = join(tmpdirPath, "review.json");
      writeFileSync(artifactPath, "", "utf8");
      const runModule = await import("../../src/cli/run.js") as { readonly validateLiveArtifact?: ValidateLiveArtifact };
      expect(typeof runModule.validateLiveArtifact).toBe("function");
      const exitCode = runModule.validateLiveArtifact!(artifactPath, 0);
      expect(exitCode).toBe(3);
    } finally {
      rmSync(tmpdirPath, { recursive: true, force: true });
    }
  });

  it("validateLiveArtifact keeps 0 when the artifact is valid (regression guard)", async () => {
    // Byte-identical guard: a fully-valid artifact (a real review with
    // a verdict) still maps to the review's exit code (0 here). M7 does
    // NOT touch the success path.
    const tmpdirPath = mkdtempSync(join(tmpdir(), "umactually-m7-parse-ok-"));
    try {
      const artifactPath = join(tmpdirPath, "review.json");
      writeFileSync(
        artifactPath,
        JSON.stringify({
          posted: true,
          event: "COMMENT",
          verdict: "APPROVED",
          inlineThreadCount: 0,
          parseFailed: false,
        }),
        "utf8",
      );
      const runModule = await import("../../src/cli/run.js") as { readonly validateLiveArtifact?: ValidateLiveArtifact };
      expect(typeof runModule.validateLiveArtifact).toBe("function");
      const exitCode = runModule.validateLiveArtifact!(artifactPath, 0);
      expect(exitCode).toBe(0);
    } finally {
      rmSync(tmpdirPath, { recursive: true, force: true });
    }
  });
});

describe("M7 — new exit code 4 (auth-required)", () => {
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
    tmpdirPath = mkdtempSync(join(tmpdir(), "umactually-m7-auth-"));
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

  it("`review --pr-number 1 --repo x/y` with no auth exits 4 (auth-required)", async () => {
    // The auth-required path: operator passes plumbing flags (signalling
    // intent to run a review) but no auth is configured. Pre-M7 this
    // exited 2; post-M7 it exits 4. The "auth-required" diagnostic is
    // more specific than the bare-invocation catch-all (which keeps
    // exiting 2 with the modes banner).
    const mod = await import("../../src/cli.js") as { readonly runCli?: RunCli };
    expect(typeof mod.runCli).toBe("function");
    const result = await mod.runCli!(["--pr-number", "1", "--repo", "x/y"], tmpdirPath);
    expect(result.exitCode).toBe(4);
  });

  it("`review --platform github --pr-number 1 --repo x/y` with no auth exits 4", async () => {
    // Same path, explicit --platform flag. The platform flag is
    // additive (it does not change the auth-state) so the exit code
    // is still 4.
    const mod = await import("../../src/cli.js") as { readonly runCli?: RunCli };
    expect(typeof mod.runCli).toBe("function");
    const result = await mod.runCli!(
      ["--platform", "github", "--pr-number", "1", "--repo", "x/y"],
      tmpdirPath,
    );
    expect(result.exitCode).toBe(4);
  });

  it("auth-required path still surfaces the legacy `cli: --api-key is required` stderr line", async () => {
    // The byte-identical stderr contract: any operator workflow grep'ing
    // for `cli: --api-key is required` must keep working. M7 changes the
    // exit code only — the stderr lines are untouched.
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
    try {
      const mod = await import("../../src/cli.js") as { readonly runCli?: RunCli };
      expect(typeof mod.runCli).toBe("function");
      await mod.runCli!(["--pr-number", "1", "--repo", "x/y"], tmpdirPath);
    } finally {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
    }
    // The stderr line is the joined legacy form: `cli: --api-url is required; --api-key is required`.
    // Assert it contains the --api-key is required fragment (byte-identical
    // to v0.6.21) so external CI scrapers keep working.
    expect(stderrBuf).toContain("--api-key is required");
    // Suppress the lint: we don't have a positive assertion on stdoutBuf
    // beyond the buffer being a string.
    expect(typeof stdoutBuf).toBe("string");
  });

  it("auth-required path still surfaces `cli: --api-url is required` for non-copilot, non-anthropic providers", async () => {
    // The default provider is openai-compatible, which requires
    // --api-url. Without --api-key (the capturing assertion above) and
    // without --api-url, both errors fire. The stderr must contain both
    // legacy lines.
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
    try {
      const mod = await import("../../src/cli.js") as { readonly runCli?: RunCli };
      expect(typeof mod.runCli).toBe("function");
      await mod.runCli!(["--pr-number", "1", "--repo", "x/y"], tmpdirPath);
    } finally {
      process.stdout.write = originalStdout;
      process.stderr.write = originalStderr;
    }
    // The joined legacy form contains both --api-url and --api-key substrings.
    expect(stderrBuf).toContain("--api-url is required");
    expect(stderrBuf).toContain("cli:");
    expect(typeof stdoutBuf).toBe("string");
  });

  it("`review --api-key <key>` (url-only missing) still exits 4 — the auth-required path is symmetric", async () => {
    // When only --api-url is missing (the operator provided --api-key),
    // the auth-required path still applies. The exit code is 4 because
    // the failure is purely authentication-shaped (no provider URL).
    const mod = await import("../../src/cli.js") as { readonly runCli?: RunCli };
    expect(typeof mod.runCli).toBe("function");
    // Use --provider anthropic to skip the --api-url check (anthropic
    // defaults to https://api.anthropic.com/v1). For the symmetric
    // case we want the default provider which DOES require --api-url.
    const result = await mod.runCli!(
      ["--pr-number", "1", "--repo", "x/y", "--api-key", "test-key"],
      tmpdirPath,
    );
    expect(result.exitCode).toBe(4);
  });

  it("`review --api-key <key> --api-url <url>` with PR plumbing exits 0 (auth provided)", async () => {
    // Boundary: when the operator provides both --api-key and --api-url,
    // validation passes and the CLI proceeds to the dry-run / live
    // pipeline. With no other flags, the CLI still has no review
    // content to write; the dry-run ceiling is exit 0. Pin this
    // boundary so the auth-required path is correctly off when auth
    // IS provided.
    //
    // We use --dry-run to avoid the live review path which would need
    // a real provider.
    const mod = await import("../../src/cli.js") as { readonly runCli?: RunCli };
    expect(typeof mod.runCli).toBe("function");
    const result = await mod.runCli!(
      ["--api-key", "test-key", "--api-url", "https://api.example.com/v1", "--dry-run"],
      tmpdirPath,
    );
    expect(result.exitCode).toBe(0);
  });
});
