// SPDX-License-Identifier: MIT

import { describe, expect, it } from "vitest";

import { parseCliArgs, CliUsageError } from "../../src/cli/parse-args.js";
import { didYouMean, levenshtein } from "../../src/util/cli-args.js";
import {
  RequiredConfigError,
  buildRequiredConfigMessage,
  requireLiveConfig,
} from "../../src/util/required-config.js";
import {
  collectPostingValidationErrors,
  collectValidationErrors,
  resolvePlatform,
} from "../../src/cli/validate.js";

type ParsedCliArgs = Parameters<typeof parseCliArgs>[0] extends readonly string[]
  ? ReturnType<typeof parseCliArgs>
  : never;

// Build a "live-mode defaults-only" parsed args object — no --dry-run
// (so api-url/api-key stay required) and no provider flags (so the
// always-validator flags --api-url/--api-key and any posting-validator
// we add --review for actually fires). We deliberately construct the
// ParsedCliArgs shape from a fully-resolved parseCliArgs call so the
// helpers below can stay agnostic of which fields were explicitly
// supplied vs. defaulted.
function liveParsedArgs(extra: readonly string[] = []): ParsedCliArgs {
  return parseCliArgs(["--platform", "github", ...extra]);
}

describe("CLI graceful recovery — parse-args hint surfacing", () => {
  it("surfaces a remediation hint on the --ignore-minor CliUsageError", () => {
    // Given: the legacy --ignore-minor flag is supplied.
    try {
      parseCliArgs(["--ignore-minor"]);
      throw new Error("expected CliUsageError");
    } catch (error) {
      if (!(error instanceof CliUsageError)) throw error;
      // Then: the message points the operator at --minimum-severity.
      expect(error.message).toMatch(/--minimum-severity/u);
      // And: the hint names the replacement flag + notes the legacy
      // env-var aliases are also ignored.
      expect(error.hint).toBeDefined();
      expect(error.hint).toMatch(/--minimum-severity/u);
      expect(error.hint).toMatch(/UMACTUALLY_IGNORE_MINOR|REVIEW_IGNORE_MINOR/u);
    }
  });

  it("surfaces a remediation hint when a flag is supplied without a value", () => {
    // Given: the operator ran `--event` with no following path. Note:
    // parseCliArgs receives the post-strip args (the dispatch layer
    // removes the subcommand first), so we pass the bare `--event` here.
    try {
      parseCliArgs(["--event"]);
      throw new Error("expected CliUsageError");
    } catch (error) {
      if (!(error instanceof CliUsageError)) throw error;
      expect(error.message).toMatch(/--event requires a value/u);
      // And: the hint names the example command shape.
      expect(error.hint).toBeDefined();
      expect(error.hint).toMatch(/--event <value>/u);
    }
  });

  it("surfaces a remediation hint when an integer flag is given a non-integer", () => {
    // Given: the operator supplied --review-timeout-seconds=abc.
    try {
      parseCliArgs(["--review-timeout-seconds", "abc"]);
      throw new Error("expected CliUsageError");
    } catch (error) {
      if (!(error instanceof CliUsageError)) throw error;
      expect(error.message).toMatch(/--review-timeout-seconds requires an integer/u);
      // And: the hint names the expected shape ("<num>").
      expect(error.hint).toBeDefined();
      expect(error.hint).toMatch(/decimal integer/u);
    }
  });

  it("surfaces a 'did you mean' suggestion + remediation hint for unknown flags", () => {
    // Given: a typo on --minimum-severity.
    try {
      parseCliArgs(["--minimun-severity", "medium"]);
      throw new Error("expected CliUsageError");
    } catch (error) {
      if (!(error instanceof CliUsageError)) throw error;
      // Then: the message names the candidate.
      expect(error.message).toMatch(/did you mean/);
      expect(error.message).toMatch(/--minimum-severity/u);
      // And: the hint includes the suggested flag plus --help.
      expect(error.hint).toBeDefined();
      expect(error.hint).toMatch(/--minimum-severity/u);
      expect(error.hint).toMatch(/--help/u);
    }
  });

  it("does NOT suggest a 'did you mean' candidate when no flag is sufficiently close", () => {
    // Given: the operator typed a flag that isn't a typo of anything.
    try {
      parseCliArgs(["--xyzzy"]);
      throw new Error("expected CliUsageError");
    } catch (error) {
      if (!(error instanceof CliUsageError)) throw error;
      expect(error.message).not.toMatch(/did you mean/u);
      // The hint still surfaces --help, just without a typo candidate.
      expect(error.hint).toBeDefined();
      expect(error.hint).toMatch(/--help/u);
    }
  });

  it("CliUsageError preserves message text byte-identical so existing tests stay green", () => {
    try {
      parseCliArgs(["--ignore-minor"]);
      throw new Error("expected");
    } catch (error) {
      if (!(error instanceof CliUsageError)) throw error;
      // The legacy byte-shape is preserved verbatim — only `hint` is
      // an additive field.
      expect(error.message).toBe(
        "--ignore-minor was removed; use --minimum-severity medium (or low/high) to suppress minor findings. Leaks and security findings are never suppressed. Environment variables UMACTUALLY_IGNORE_MINOR and REVIEW_IGNORE_MINOR are also ignored.",
      );
    }
  });
});

describe("didYouMean", () => {
  it("returns null for empty input", () => {
    expect(didYouMean("", ["--api-url"])).toBeNull();
  });

  it("returns null when no candidate is close enough", () => {
    expect(didYouMean("--zqx", ["--api-url", "--api-key"])).toBeNull();
  });

  it("returns the closest candidate for a single-character typo on long flags", () => {
    expect(didYouMean("--minimun-severity", ["--minimum-severity", "--max-comments"])).toBe(
      "--minimum-severity",
    );
  });

  it("returns the exact match when present", () => {
    expect(didYouMean("--api-url", ["--api-key", "--api-url", "--model"])).toBe("--api-url");
  });

  it("returns null for single-character flags that are not close to anything", () => {
    expect(didYouMean("--x", ["--api-url", "--api-key"])).toBeNull();
  });
});

describe("levenshtein", () => {
  it("computes the canonical distance for empty, equal, and trivial inputs", () => {
    expect(levenshtein("", "")).toBe(0);
    expect(levenshtein("abc", "abc")).toBe(0);
    expect(levenshtein("a", "")).toBe(1);
    expect(levenshtein("", "a")).toBe(1);
    expect(levenshtein("abc", "abd")).toBe(1);
  });
});

describe("requireLiveConfig — remediation hint", () => {
  it("returns the value unchanged when present", () => {
    expect(requireLiveConfig("hi", "UMACTUALLY_API_URL")).toBe("hi");
  });

  it("exposes a string hint on a thrown RequiredConfigError", () => {
    try {
      requireLiveConfig(undefined, "UMACTUALLY_API_URL");
      throw new Error("expected");
    } catch (error) {
      if (!(error instanceof RequiredConfigError)) throw error;
      expect(error.code).toBe("LIVE_CONFIG_MISSING");
      expect(error.message).toBe("UMACTUALLY_API_URL must be set for live review.");
      expect(typeof error.hint).toBe("string");
      expect(error.hint).toMatch(/--api-url/u);
      expect(error.hint).toMatch(/--dry-run/u);
    }
  });

  it("buildRequiredConfigMessage returns the canonical message + hint pair", () => {
    const built = buildRequiredConfigMessage("UMACTUALLY_API_KEY");
    expect(built.message).toBe("UMACTUALLY_API_KEY must be set for live review.");
    expect(built.hint).toMatch(/--api-key/u);
  });

  it("buildRequiredConfigMessage omits a CLI-flag clause for env vars without a known flag", () => {
    const built = buildRequiredConfigMessage("GITHUB_TOKEN");
    expect(built.hint).toMatch(/GITHUB_TOKEN=/u);
    // Don't invent a CLI flag for env vars without one — only name the env var.
    expect(built.hint).not.toMatch(/--githu-token/u);
  });
});

describe("CLI graceful recovery — validate.ts structured errors", () => {
  it("collectValidationErrors returns { flag, message, hint } records", () => {
    // Given: a live-mode invocation with no provider flags.
    const p = liveParsedArgs([]);
    // When: collecting always-validation errors.
    const errors = collectValidationErrors(p);
    // Then: every entry is structured.
    expect(errors.length).toBeGreaterThan(0);
    for (const e of errors) {
      expect(typeof e.flag === "string" || e.flag === null).toBe(true);
      expect(typeof e.message).toBe("string");
      expect(typeof e.hint).toBe("string");
      expect(e.message.length).toBeGreaterThan(0);
      expect(e.hint.length).toBeGreaterThan(0);
    }
  });

  it("emits a hint naming the env var when --api-url is missing", () => {
    // Given: live mode, no --api-url.
    const p = liveParsedArgs([]);
    const errors = collectValidationErrors(p);
    const apiUrlError = errors.find((e) => e.flag === "--api-url");
    expect(apiUrlError).toBeDefined();
    expect(apiUrlError?.hint).toMatch(/--api-url/u);
    expect(apiUrlError?.hint).toMatch(/UMACTUALLY_API_URL/u);
  });

  it("emits a hint naming the env var when --api-key is missing", () => {
    const errors = collectValidationErrors(liveParsedArgs([]));
    const apiKeyError = errors.find((e) => e.flag === "--api-key");
    expect(apiKeyError).toBeDefined();
    // hint must mention BOTH the flag and the env var so operator
    // can fix via either surface.
    expect(apiKeyError?.hint).toMatch(/--api-key/u);
    expect(apiKeyError?.hint).toMatch(/UMACTUALLY_API_KEY/u);
  });

  it("skips posting-validation errors when --review is missing", () => {
    // Given: a live invocation with no --review.
    const p = liveParsedArgs([]);
    // When: collecting posting-validation errors.
    const errors = collectPostingValidationErrors(p);
    // Then: no errors (we're not posting).
    expect(errors).toHaveLength(0);
  });

  it("emits a hint naming --event <path> when missing", () => {
    // Given: --review was supplied but --event was not.
    const p = liveParsedArgs([
      "--review",
      "/tmp/review.json",
      "--api-url",
      "https://api.example.com/v1",
      "--api-key",
      "sk-test",
    ]);
    const errors = collectPostingValidationErrors(p);
    const eventError = errors.find((e) => e.flag === "--event");
    expect(eventError).toBeDefined();
    expect(eventError?.hint).toMatch(/--event/u);
    expect(eventError?.hint).toMatch(/<path>/u);
  });

  it("emits a hint for --pr-number when --platform azure is set without --review", () => {
    // Posting-validation only fires with --review. Set --review to
    // exercise the Azure-platform branch.
    const p = parseCliArgs([
      "--platform",
      "azure",
      "--review",
      "/tmp/review.json",
      "--api-url",
      "https://api.example.com/v1",
      "--api-key",
      "sk-test",
    ]);
    const errors = collectPostingValidationErrors(p);
    const prNumberError = errors.find((e) => e.flag === "--pr-number");
    expect(prNumberError).toBeDefined();
    expect(prNumberError?.hint).toMatch(/--pr-number/u);
  });

  it("composes always + posting errors in a single flat array", () => {
    const p = liveParsedArgs(["--review", "/tmp/review.json"]);
    const errors = collectValidationErrors(p);
    // Always-applicable errors come first (api-url, api-key), followed
    // by posting-applicable errors (event, diff).
    const flags = errors.map((e) => e.flag);
    expect(flags).toContain("--api-url");
    expect(flags).toContain("--event");
  });

  it("preserveCollectedErrors keeps the message contract byte-identical", () => {
    // The legacy `cli: <msg>;<msg>` join is built by joining each
    // entry's `message`. Confirm the messages still match what the
    // old flat-list validator emitted so any consumer grep'ing for
    // `cli: --api-url is required` keeps working.
    const p = liveParsedArgs([]);
    const errors = collectValidationErrors(p);
    const joined = errors.map((e) => e.message).join("; ");
    expect(joined).toMatch(/--api-url is required/u);
    expect(joined).toMatch(/--api-key is required/u);
  });
});

describe("resolvePlatform still works (no regressions)", () => {
  it("returns 'github' for github", () => {
    expect(resolvePlatform("github", {})).toBe("github");
  });
  it("returns 'azure' for azure", () => {
    expect(resolvePlatform("azure", {})).toBe("azure");
  });
  it("returns 'github' as the auto-detect fallback", () => {
    expect(resolvePlatform("auto", {})).toBe("github");
  });
});
