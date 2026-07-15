// Manual QA: parseCliArgs actually accepts --provider anthropic and threads api-url/key through.
import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../../src/cli/parse-args.js";

describe("CLI surface — provider anthropic", () => {
  it("M1 --provider anthropic flows through parseCliArgs with the right value", () => {
    const a = parseCliArgs([
      "--platform", "azure",
      "--dry-run",
      "--provider", "anthropic",
      "--api-key", "sk-ant-test-do-not-leak",
      "--api-url", "https://api.anthropic.com/v1",
      "--event", "/tmp/x.json",
      "--diff", "/tmp/y.json",
      "--review", "/tmp/z.json",
      "--pr-number", "42",
      "--repo", "foo/bar",
    ]);
    expect(a.provider).toBe("anthropic");
    expect(a.apiUrl).toBe("https://api.anthropic.com/v1");
    expect(a.apiKey).toBe("sk-ant-test-do-not-leak");
    expect(a.dryRun).toBe(true);
    expect(a.platform).toBe("azure");
  });
  it("M2 omitting --api-url with --provider anthropic does NOT throw a CliUsageError (validate.ts skips the URL check)", () => {
    // The CLI parser itself doesn't enforce URL presence, that's the
    // validator's job — but we still want to confirm parseCliArgs can
    // output apiUrl=null for the anthropic provider without erroring.
    const a = parseCliArgs([
      "--platform", "azure",
      "--dry-run",
      "--provider", "anthropic",
      "--api-key", "sk-ant-test-do-not-leak",
      "--event", "/tmp/x.json",
      "--diff", "/tmp/y.json",
      "--review", "/tmp/z.json",
      "--pr-number", "42",
      "--repo", "foo/bar",
    ]);
    expect(a.provider).toBe("anthropic");
    expect(a.apiUrl).toBeNull();
  });
  it("M3 non-anthropic provider REQUIRES api-url via the validator (control case)", async () => {
    const { collectValidationErrors } = await import("../../src/cli/validate.js");
    const a = parseCliArgs([
      "--platform", "azure",
      "--provider", "openai-compatible",
      "--api-key", "sk-test-do-not-leak",
      "--event", "/tmp/x.json",
      "--diff", "/tmp/y.json",
      "--review", "/tmp/z.json",
      "--pr-number", "42",
      "--repo", "foo/bar",
    ]);
    const errs = collectValidationErrors(a);
    // dryRun is unset (false) — so URL is required.
    // Validate-glue returns { flag, message, hint } records; map to
    // messages so the `includes(...)` assertion below keeps working.
    const messages = errs.map((e) => e.message);
    expect(messages.some(e => e.includes("--api-url is required"))).toBe(true);
  });
  it("M4 anthropic provider does NOT trigger api-url required error (negative control)", async () => {
    const { collectValidationErrors } = await import("../../src/cli/validate.js");
    const a = parseCliArgs([
      "--platform", "azure",
      "--provider", "anthropic",
      "--api-key", "sk-ant-test-do-not-leak",
      "--event", "/tmp/x.json",
      "--diff", "/tmp/y.json",
      "--review", "/tmp/z.json",
      "--pr-number", "42",
      "--repo", "foo/bar",
    ]);
    const errs = collectValidationErrors(a);
    const messages = errs.map((e) => e.message);
    expect(messages.some(e => e.includes("--api-url is required"))).toBe(false);
  });
});
