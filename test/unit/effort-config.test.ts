import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CliUsageError, parseCliArgs } from "../../src/cli/parse-args.js";
import { applySavedConfig } from "../../src/cli/apply-saved-config.js";
import { resolveFromSchema } from "../../src/config/field-resolution.js";
import { InvalidConfigError } from "../../src/config/errors.js";
import { readSavedConfig, serializeSavedConfig, writeSavedConfig } from "../../src/config/saved-config.js";

const levels = ["none", "minimal", "low", "medium", "high", "xhigh", "max"] as const;
const directories: string[] = [];
afterEach(() => {
  for (const directory of directories) rmSync(directory, { recursive: true, force: true });
  directories.length = 0;
});

function sandbox() {
  const directory = mkdtempSync(join(tmpdir(), "effort-config-"));
  directories.push(directory);
  return { homeDir: directory, cwd: directory };
}

describe("effort configuration contract", () => {
  it.each(levels)("accepts normalized CLI effort when %s is supplied", (effort) => {
    // Given: an enum with surrounding whitespace and uppercase.
    const args = ["--effort", ` ${effort.toUpperCase()} `];
    // When: parsing the CLI.
    const parsed = parseCliArgs(args);
    // Then: only the enum is normalized.
    expect(parsed.effort).toBe(effort);
  });

  it.each(levels)("resolves env effort when %s is supplied", (effort) => {
    // Given: no CLI override.
    const parsed = parseCliArgs([]);
    // When: resolving a normalized environment enum.
    const result = resolveFromSchema(parsed, { UMACTUALLY_EFFORT: ` ${effort.toUpperCase()} ` });
    // Then: provenance contains only its source identifier.
    expect(result.effort).toBe(effort);
    expect(result.fieldProvenance["effort"]).toEqual({ source: "env", envName: "UMACTUALLY_EFFORT" });
  });

  it.each([undefined, "", " \t "])("leaves effort unset when env is %s", (value) => {
    // Given: missing or blank effort.
    const env = value === undefined ? {} : { UMACTUALLY_EFFORT: value };
    // When: resolving defaults.
    const result = resolveFromSchema(parseCliArgs([]), env);
    // Then: provider defaults remain available.
    expect(result.effort).toBeNull();
    expect(result.fieldProvenance["effort"]).toEqual({ source: "default" });
  });

  it("rejects invalid env without echoing its contents", () => {
    // Given: a secret-shaped invalid enum.
    const resolve = () => resolveFromSchema(parseCliArgs([]), { UMACTUALLY_EFFORT: "sk-private" });
    // When / Then: validation is typed and sanitized.
    expect(resolve).toThrow(InvalidConfigError);
    expect(resolve).not.toThrow(/sk-private/);
  });

  it.each(["", " ", "extreme"])("rejects CLI effort when %j is supplied", (value) => {
    // Given / When / Then: invalid CLI input never silently selects a default.
    expect(() => parseCliArgs(["--effort", value])).toThrow(CliUsageError);
  });

  it.each([
    { args: ["--effort", "none"], env: { UMACTUALLY_EFFORT: "high" }, expected: "none", source: "flag" },
    { args: [], env: { UMACTUALLY_EFFORT: "high" }, expected: "high", source: "env" },
    { args: [], env: {}, expected: "low", source: "savedConfig" },
    { args: [], env: { UMACTUALLY_EFFORT: " " }, expected: "low", source: "savedConfig" },
  ])("honors precedence when source is $source", ({ args, env, expected, source }) => {
    // Given: a different saved value from both higher-priority inputs.
    const resolved = resolveFromSchema(parseCliArgs(args), env);
    const saved = { schemaVersion: 1, provider: "anthropic", effort: "low" } as const;
    // When: filling defaults from persistence.
    const result = applySavedConfig(resolved, saved, "/saved/config.json");
    // Then: the highest-priority configured value wins.
    expect(result.resolved.effort).toBe(expected);
    expect(result.resolved.fieldProvenance["effort"]).toEqual(
      source === "env" ? { source, envName: "UMACTUALLY_EFFORT" } : { source },
    );
  });

  it("preserves opaque model IDs when resolving effort", () => {
    // Given: a case-sensitive, whitespace-bearing model identifier.
    const model = " Vendor/Model-X ";
    // When: resolving alongside an enum.
    const result = resolveFromSchema(parseCliArgs(["--model", model, "--effort", "HIGH"]), {});
    // Then: model bytes survive unchanged.
    expect(result.model).toBe(model);
  });

  it.each(levels)("round-trips saved effort when %s is supplied", async (effort) => {
    // Given: real isolated filesystem storage.
    const deps = sandbox();
    const config = { schemaVersion: 1, provider: "anthropic", effort } as const;
    // When: persisting and loading settings.
    const written = await writeSavedConfig(config, { ...deps, scope: "global" });
    const loaded = readSavedConfig(deps);
    // Then: effort is retained by both serialization and validation.
    expect(written.ok).toBe(true);
    expect(loaded).toMatchObject({ ok: true, config });
    expect(JSON.parse(serializeSavedConfig(config))).toEqual(config);
  });

  it.each(["", " ", "extreme", "sk-private", null, 4, []].map((effort) => ({ effort })))("rejects saved effort when $effort is supplied", ({ effort }) => {
    // Given: an untrusted saved JSON field.
    const deps = sandbox();
    writeFileSync(join(deps.cwd, "umactually.config.json"), JSON.stringify({ schemaVersion: 1, provider: "anthropic", effort }));
    // When: loading settings.
    const result = readSavedConfig(deps);
    // Then: invalid effort is rejected without echoing the value.
    expect(result).toMatchObject({ ok: false, exitCode: 2 });
    expect(JSON.stringify(result)).not.toContain("sk-private");
  });

  it("keeps old saved files effort-free", () => {
    // Given: schema v1 before effort existed.
    const deps = sandbox();
    const config = { schemaVersion: 1, provider: "anthropic" } as const;
    writeFileSync(join(deps.cwd, "umactually.config.json"), JSON.stringify(config));
    // When: loading and applying settings.
    const loaded = readSavedConfig(deps);
    if (!loaded.ok) throw new Error(loaded.message);
    const result = applySavedConfig(resolveFromSchema(parseCliArgs([]), {}), loaded.config, loaded.path);
    // Then: no implicit medium or saved effort provenance appears.
    expect(loaded.config).toEqual(config);
    expect(result.resolved.effort).toBeNull();
    expect(result.applied).not.toContain("effort");
  });
});
