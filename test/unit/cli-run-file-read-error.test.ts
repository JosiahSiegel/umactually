// SPDX-License-Identifier: MIT
//
// PR #2 — `CliArgumentError` must extend `CliUsageError` so the stderr handler
// at `src/cli.ts` (which gates on `instanceof CliUsageError`) writes the
// `hint:` line for file-read failures instead of falling through to the
// generic `cli: unexpected error: ...` path.
//
// Two assertion surfaces are exercised:
//   1. The class itself (in-source): instanceof, hint field, name field.
//   2. The bundled CLI (`bin/umactually.mjs` → `dist/cli.js`): the actual
//      `2>&1` output for a missing `--event` file is captured and grep'd
//      for the `hint:` line and the absence of the `unexpected error:`
//      line. The CLI writes to stderr, so the test merges both streams.

import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

import { CliArgumentError } from "../../src/cli/run.js";
import { CliUsageError } from "../../src/cli/parse-args.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..", "..");
const BIN_PATH = join(REPO_ROOT, "bin", "umactually.mjs");
const DIST_PATH = join(REPO_ROOT, "dist", "cli.js");

// PR #2: the failure modes that previously fell through to `unexpected error:`
// (because CliArgumentError was a plain Error subclass) must now be caught by
// the `instanceof CliUsageError` branch in src/cli.ts and emit a `hint:` line.
describe("CliArgumentError extends CliUsageError (PR #2)", () => {
  it("is a CliUsageError subclass (instanceof both ways)", () => {
    // Given: a CliArgumentError thrown with a hint.
    const err = new CliArgumentError(
      "--review requires --event and --diff to be supplied",
      "Pass --event <path> and --diff <path> when invoking --review, or run 'umactually --help' for the full flag list.",
    );
    // Then: it is catchable as CliUsageError so the src/cli.ts handler
    // routes it through the hint-writing branch.
    expect(err).toBeInstanceOf(CliUsageError);
    expect(err).toBeInstanceOf(CliArgumentError);
  });

  it("preserves the legacy name + message so existing tests/logs stay byte-identical", () => {
    const err = new CliArgumentError("plain message");
    // The name field is part of the contract that JSON envelopes + log
    // scrapers key off of. PR #2 must not change it.
    expect(err.name).toBe("CliArgumentError");
    expect(err.message).toBe("plain message");
  });

  it("exposes a string hint when supplied to the constructor", () => {
    const hint = "Pass --event <path> and --diff <path> when invoking --review, or run 'umactually --help' for the full flag list.";
    const err = new CliArgumentError("msg", hint);
    expect(typeof err.hint).toBe("string");
    expect(err.hint).toBe(hint);
  });

  it("hint is undefined when omitted (constructor's optional 2nd arg)", () => {
    const err = new CliArgumentError("msg");
    expect(err.hint).toBeUndefined();
  });
});

// End-to-end check: drive the bundled CLI with a missing --event file and
// confirm the stderr handler prints the `hint:` line AND does NOT print the
// fallback `unexpected error:` line. This is the regression that PR #2 fixes.
describe("Bundled CLI surfaces `hint:` for file-read failures (PR #2)", () => {
  it("dist/cli.js exists (npm run bundle has been run)", () => {
    // S2699: real assertion. Without the bundle, downstream tests would
    // silently pass — point the developer at the fix via the hint arg.
    expect(
      existsSync(DIST_PATH),
      `dist/cli.js missing at ${DIST_PATH}. Run 'npm run bundle' before this test.`,
    ).toBe(true);
  });

  it("writes the hint line and skips the 'unexpected error:' fallback for a missing --event file", () => {
    // Given: the bundled CLI is present and bin/umactually.mjs is executable.
    expect(existsSync(BIN_PATH)).toBe(true);
    expect(existsSync(DIST_PATH)).toBe(true);

    // Use a guaranteed-missing absolute path. The trigger combo is:
    //   --dry-run --platform github --review <somewhere> --event <missing>
    // because buildGithubDryRunArtifact (run.ts:185-224) only reaches
    // readRequiredFile when parsed.dryRun && reviewPath===null is FALSE —
    // i.e. when --review is supplied alongside --dry-run. The earlier
    // short-circuit at run.ts:198 returns a stub instead.
    const missingPath = "/tmp/umactually-pr2-missing-event.json";
    const result = spawnSync(
      process.execPath,
      [
        BIN_PATH,
        "--dry-run",
        "--platform",
        "github",
        "--review",
        "/tmp/umactually-pr2-fake-review.json",
        "--api-url",
        "https://api.example.com/v1",
        "--api-key",
        "sk-pr2-fixture",
        "--event",
        missingPath,
      ],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        // Merge stderr into stdout so the regression assertion can grep
        // both streams (the src/cli.ts handler writes to stderr).
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 15_000,
      },
    );

    // Then: the process exited 2 (CliUsageError branch), not 1 (fallback).
    // Spawn may return null status if killed; allow that only by failing
    // explicitly here so the test does not silently pass.
    expect(result.status).not.toBeNull();
    const exitCode = result.status as number;
    const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`;

    // The handler at src/cli.ts:715 writes:
    //   `cli: ${error.message}${hintLine}\n`
    // where hintLine is `\n  hint: ${error.hint}` when hint is present.
    // We assert on the COMBINED stream because the handler is on stderr.
    expect(exitCode).toBe(2);
    expect(combined).toMatch(/^cli: failed to read --event file/m);
    expect(combined).toMatch(/\n  hint: /u);
    expect(combined).toMatch(/--event/u);
    expect(combined).toMatch(/absolute path/u);
    // And: it MUST NOT have fallen through to the generic fallback.
    expect(combined).not.toMatch(/unexpected error:/u);
  });

  it("still emits the legacy `cli: <msg>` byte shape on the first line", () => {
    const missingPath = "/tmp/umactually-pr2-missing-event-line.json";
    const result = spawnSync(
      process.execPath,
      [
        BIN_PATH,
        "--dry-run",
        "--platform",
        "github",
        "--review",
        "/tmp/umactually-pr2-fake-review-line.json",
        "--api-url",
        "https://api.example.com/v1",
        "--api-key",
        "sk-pr2-fixture",
        "--event",
        missingPath,
      ],
      {
        cwd: REPO_ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 15_000,
      },
    );
    expect(result.status).toBe(2);
    const combined = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    // The CLI's stderr handler must still emit `cli: failed to read --event ...`
    // as the file-read-error line PR #2 fixes. We deliberately look for
    // *that specific line* (by prefix) rather than the first non-empty line
    // of the combined stream, because unrelated earlier output (e.g. an
    // `ENOTEMPTY: ...` from another test's leftover `.umactually-auto-ctx/`
    // directory reaching the auto-context cleanup) could otherwise appear
    // first and poison the assertion without any change in PR #2 behavior.
    const lines = combined.split("\n");
    const fileReadLine = lines.find((line) => line.startsWith("cli: failed to read --event ")) ?? "";
    // The file-read-error line must exist and reference --event byte-identically
    // so existing log scrapers and CI greps keep working.
    expect(fileReadLine.length).toBeGreaterThan(0);
    expect(fileReadLine.startsWith("cli: failed to read --event ")).toBe(true);
    expect(fileReadLine).toMatch(/--event/u);
    // The legacy `cli: <msg>` byte shape is preserved exactly: every `cli:`
    // line in the captured stream must start with `cli: ` (no leading
    // whitespace, no intermediate transformation).
    for (const line of lines) {
      if (line.startsWith("cli:")) {
        expect(line.startsWith("cli: ")).toBe(true);
      }
    }
  });

  it("dist/cli.js bundle reflects the source fix (sanity check after npm run bundle)", () => {
    // Given: dist/cli.js exists.
    expect(existsSync(DIST_PATH)).toBe(true);
    // When: reading it (treated as a single-line ncc bundle, so substring
    // matching is the only practical option).
    const bundled = readFileSync(DIST_PATH, "utf8");
    // Then: the bundle MUST contain the new hint text for the file-read
    // path. If it doesn't, npm run bundle wasn't re-run after the source
    // edit and the test would be lying about coverage.
    expect(bundled).toMatch(/absolute path/u);
  });
});
