// Capability-based validation tests.
//
// Posting target is determined by whether the operator asked the CLI to
// post (via `--review` path being a real, supplied file). Plumbing flags
// (`--event`, `--diff`, `--pr-number`, `--repo`) are inputs to a run
// that may OR MAY NOT post — they are NOT posting identity. Therefore
// they must be required only when the run is actually posting.
//
// Why: today, running `node bin/umactually.mjs --api-url X
// --api-key Y` (forgetting that plumbing flags are required for any
// invocation) produces `cli: --event is required`. That message is
// misleading because the operator did not intend to post anything — they
// just wanted to invoke the binary. The fix: split validation into two
// halves: (a) always-validations (provider config, sonarqube, etc.) and
// (b) posting-validations (only when `--review` is set or the resolved
// dispatcher says posting was requested).
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { parseCliArgs, type ParsedCliArgs } from "../../src/cli/parse-args.js";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");

function reviewEnvelopeExitCode(stdout: string): number | null {
  const line = stdout.trimEnd().split(/\r?\n/u).at(-1);
  if (line === undefined) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(line);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const envelope = Object.fromEntries(Object.entries(parsed));
    return envelope["schemaVersion"] === 1 &&
      envelope["command"] === "review" &&
      typeof envelope["exitCode"] === "number"
      ? envelope["exitCode"]
      : null;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }
}

async function collectValidationErrors(
  parsed: ParsedCliArgs,
): Promise<readonly string[]> {
  // Dynamic import so a missing export throws at call time, not at module load.
  const mod = await import("../../src/cli/validate.js");
  // Validate-glue returns structured { flag, message, hint } records;
  // map to the legacy string shape so existing assertion sites (which
  // call `includes`/`join` on the result) keep working.
  return mod.collectValidationErrors(parsed).map((e) => e.message);
}

async function collectPostingValidationErrors(
  parsed: ParsedCliArgs,
): Promise<readonly string[]> {
  const mod = await import("../../src/cli/validate.js");
  return mod.collectPostingValidationErrors(parsed).map((e) => e.message);
}

const GH_POSTING_ARGS = [
  "--platform", "github",
  "--api-url", "https://router.example.invalid/v1",
  "--api-key", "sk-test-do-not-leak",
] as const;

const AZURE_POSTING_ARGS = [
  "--platform", "azure",
  "--api-url", "https://router.example.invalid/v1",
  "--api-key", "sk-test-do-not-leak",
] as const;

describe("CLI-only posting validation regression", () => {
  it("CLI-VALIDATION: bare GitHub review with provider config never requests wrapper-era plumbing flags", () => {
    // Given: a valid GitHub event context but no --event/--diff/--review/--pr-number/--repo argv.
    const workspace = mkdtempSync(join(tmpdir(), "umactually-cli-validation-"));
    const eventPath = join(workspace, "event.json");
    writeFileSync(eventPath, JSON.stringify({
      repository: { full_name: "example/umactually" },
      pull_request: {
        number: 42,
        title: "Validation contract",
        body: "",
        draft: false,
        base: { sha: "0000000000000000000000000000000000000001" },
        head: { sha: "0000000000000000000000000000000000000002" },
      },
    }));

    try {
      // When: the public shim receives only the review command and provider configuration.
      const result = spawnSync(process.execPath, [
        join(REPO_ROOT, "bin", "umactually.mjs"),
        "review",
        "--platform", "github",
        "--json",
        "--api-url", "http://example.invalid",
        "--api-key", "placeholder",
      ], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        env: {
          ...process.env,
          GITHUB_ACTIONS: "true",
          GITHUB_EVENT_PATH: eventPath,
          GITHUB_TOKEN: "fixture-token",
          GITHUB_REPOSITORY: "example/umactually",
        },
      });

      // Then: runtime/provider failure is allowed, but wrapper-plumbing validation is not.
      const stdout = result.stdout ?? "";
      const envelopeStatus = reviewEnvelopeExitCode(stdout);
      const status = envelopeStatus ?? result.status;
      if (process.platform === "win32" && envelopeStatus !== null && result.status !== envelopeStatus) {
        console.warn(`CLI validation ignored Windows libuv teardown status ${String(result.status)}; JSON envelope reported ${envelopeStatus}.`);
      }
      expect([0, 1]).toContain(status);
      expect(`${stdout}\n${result.stderr ?? ""}`).not.toMatch(/(?:--diff|--event|--pr-number|--repo|--review).*required/iu);
    } finally {
      rmSync(workspace, { recursive: true, force: true });
    }
  });
});

describe("validation: posting-capability matrix", () => {
  it("CV-R1: dry-run with NO --review and missing plumbing flags → no posting errors; api-key NOT required (dry-run skips provider call)", async () => {
    const a = parseCliArgs([
      "--platform", "github",
      "--dry-run",
      "--api-url", "https://router.example.invalid/v1",
    ]);
    const postingErrors = await collectPostingValidationErrors(a);
    expect(postingErrors).toEqual([]);
    // Capability-based validation contract: --dry-run skips the provider
    // call entirely, so api-key/api-url are optional in dry-run mode.
    // (Pre-Task-7 contract required api-key in dry-run too; that contract
    // was retired in favor of capability-based validation per the planning
    // agent's Decision D5/D7.)
    const all = await collectValidationErrors(a);
    expect(all.some((e) => e.includes("--api-key is required"))).toBe(false);
  });

  it("CV-R2: live mode with NO --review and missing plumbing fields → no posting errors (operator did not post)", async () => {
    const a = parseCliArgs([
      "--platform", "github",
      "--api-url", "https://router.example.invalid/v1",
      "--api-key", "sk-test-do-not-leak",
    ]);
    const postingErrors = await collectPostingValidationErrors(a);
    expect(postingErrors).toEqual([]);
  });

  it("CV-R3: --review set + --platform github + missing plumbing → posting requires GitHub posting fields", async () => {
    const a = parseCliArgs([
      ...GH_POSTING_ARGS,
      "--review", "/tmp/out.json",
    ]);
    const postingErrors = await collectPostingValidationErrors(a);
    expect(postingErrors.length).toBeGreaterThan(0);
    // Event + diff are required for GitHub posting.
    const errs = postingErrors.join("\n");
    expect(errs).toContain("--review requires --event");
    expect(errs).toContain("--review requires --diff");
  });

  it("CV-R4: --review set + --platform azure + missing plumbing → posting requires ALL Azure posting fields", async () => {
    const a = parseCliArgs([
      ...AZURE_POSTING_ARGS,
      "--review", "/tmp/out.json",
    ]);
    const postingErrors = await collectPostingValidationErrors(a);
    expect(postingErrors.length).toBeGreaterThan(0);
    const errs = postingErrors.join("\n");
    expect(errs).toContain("--review requires --event");
    expect(errs).toContain("--review requires --diff");
    expect(errs).toContain("--review requires --pr-number");
    expect(errs).toContain("--review requires --repo");
  });

  it("CV-R5: --review set + all plumbing fields supplied → no posting errors", async () => {
    const a = parseCliArgs([
      ...GH_POSTING_ARGS,
      "--event", "/tmp/evt.json",
      "--diff", "/tmp/diff.patch",
      "--review", "/tmp/out.json",
    ]);
    const postingErrors = await collectPostingValidationErrors(a);
    expect(postingErrors).toEqual([]);
  });

  it("CV-R6: plumbing fields supplied WITHOUT --review → must not independently activate posting", async () => {
    // Operator supplies event + diff + pr-number + repo but NO --review.
    // They did NOT request posting. The posting validator must not flag.
    const a = parseCliArgs([
      "--platform", "azure",
      "--api-url", "https://router.example.invalid/v1",
      "--api-key", "sk-test-do-not-leak",
      "--event", "/tmp/evt.json",
      "--diff", "/tmp/diff.patch",
      "--pr-number", "42",
      "--repo", "foo/bar",
    ]);
    const postingErrors = await collectPostingValidationErrors(a);
    expect(postingErrors).toEqual([]);
  });

  it("CV-R7: --review set but missing --api-url (Anthropic default-exception still applies)", async () => {
    const a = parseCliArgs([
      "--platform", "github",
      "--provider", "anthropic",
      "--api-key", "sk-ant-test-do-not-leak",
      "--review", "/tmp/out.json",
      "--event", "/tmp/evt.json",
      "--diff", "/tmp/diff.patch",
    ]);
    // Anthropic defaults api-url to https://api.anthropic.com/v1; always-validation
    // does NOT require api-url when provider=anthropic. Posting must also not.
    const postingErrors = await collectPostingValidationErrors(a);
    expect(postingErrors).toEqual([]);
  });
});

describe("validation: posting-validator surfaces only posting errors (no leakage from always-validator)", () => {
  it("CV-ISO-1: posting-validator ignores api-key / api-url absence for providers that don't require them", async () => {
    // Anthropic-style provider, --review set, no api-url. Always-validator
    // would still complain for openai-compatible, but posting-validator
    // is exclusively the posting identity check.
    const a = parseCliArgs([
      "--platform", "github",
      "--provider", "anthropic",
      "--review", "/tmp/out.json",
      "--event", "/tmp/evt.json",
      "--diff", "/tmp/diff.patch",
    ]);
    const postingErrors = await collectPostingValidationErrors(a);
    expect(postingErrors).toEqual([]);
  });
});

describe("validation: posting-validator is composable into collectValidationErrors", () => {
  it("CV-COMP-1: collectValidationErrors = alwaysErrors ⨁ postingErrors (when posting)", async () => {
    const a = parseCliArgs([
      ...GH_POSTING_ARGS,
      "--review", "/tmp/out.json",
      // No event/diff → posting errors expected.
    ]);
    const all = await collectValidationErrors(a);
    const postingOnly = await collectPostingValidationErrors(a);
    // Every posting-error string must appear in the combined error list.
    for (const postingMsg of postingOnly) {
      expect(all.some((m) => m.includes(postingMsg) || postingMsg.includes(m))).toBe(true);
    }
  });

  it("CV-COMP-2: collectValidationErrors = alwaysErrors (when not posting)", async () => {
    const a = parseCliArgs([
      "--platform", "github",
      "--api-url", "https://router.example.invalid/v1",
      "--api-key", "sk-test-do-not-leak",
    ]);
    const all = await collectValidationErrors(a);
    const postingOnly = await collectPostingValidationErrors(a);
    expect(postingOnly).toEqual([]);
    // Always-validator may flag the missing api-url's required form
    // depending on provider — but with openai-compatible default
    // and --api-key supplied, --api-url IS supplied; expect no error.
    expect(all).toEqual([]);
  });
});