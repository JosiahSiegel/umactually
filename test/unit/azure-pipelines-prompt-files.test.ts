import { afterEach, describe, expect, it, vi } from "vitest";

import { runJsonReview } from "../../src/cli/dispatch.js";

const TRACKED_ENV = [
  "UMACTUALLY_PROMPT_FILES",
  "UMACTUALLY_ADDITIONAL_PROMPT_FILES",
  "UMACTUALLY_STRICT_SCHEMA",
  "UMACTUALLY_VERIFY_FINDINGS",
] as const;
const originalEnv = Object.fromEntries(TRACKED_ENV.map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const name of TRACKED_ENV) {
    const value = originalEnv[name];
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
});

async function resolvedConfig(): Promise<Record<string, unknown>> {
  let stdout = "";
  const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk): boolean => {
    stdout += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  });
  try {
    await runJsonReview(["--dry-run"]);
  } finally {
    spy.mockRestore();
  }

  const envelope: unknown = JSON.parse(stdout);
  if (typeof envelope !== "object" || envelope === null) {
    throw new TypeError("Expected JSON review envelope object");
  }
  const config = Reflect.get(envelope, "resolvedConfig");
  if (typeof config !== "object" || config === null) {
    throw new TypeError("Expected resolvedConfig object");
  }
  return Object.fromEntries(Object.entries(config));
}

function sourceFor(config: Record<string, unknown>, field: string): Record<string, unknown> {
  const sources = config["sources"];
  if (typeof sources !== "object" || sources === null) {
    throw new TypeError("Expected resolvedConfig.sources object");
  }
  const source = Reflect.get(sources, field);
  if (typeof source !== "object" || source === null) {
    throw new TypeError(`Expected source metadata for ${field}`);
  }
  return Object.fromEntries(Object.entries(source));
}

describe("Azure pipeline variables use the CLI-native UMACTUALLY_* environment surface", () => {
  it("resolves prompt-file lists directly from canonical environment variables", async () => {
    // Given: values supplied exactly as Azure pipeline variables reach the CLI.
    process.env["UMACTUALLY_PROMPT_FILES"] = "prompts/system.md,prompts/context.md";
    process.env["UMACTUALLY_ADDITIONAL_PROMPT_FILES"] = "prompts/extra.md";

    // When: the CLI resolves its JSON configuration envelope.
    const config = await resolvedConfig();

    // Then: both lists are present and attributed to their canonical env vars.
    expect(config["promptFilesPresent"]).toBe(true);
    expect(config["additionalPromptFilesPresent"]).toBe(true);
    expect(sourceFor(config, "promptFiles")).toEqual({
      source: "env",
      envName: "UMACTUALLY_PROMPT_FILES",
    });
    expect(sourceFor(config, "additionalPromptFiles")).toEqual({
      source: "env",
      envName: "UMACTUALLY_ADDITIONAL_PROMPT_FILES",
    });
  });

  it("resolves boolean toggles directly from canonical environment variables", async () => {
    // Given: default-on options disabled through Azure pipeline variables.
    process.env["UMACTUALLY_STRICT_SCHEMA"] = "false";
    process.env["UMACTUALLY_VERIFY_FINDINGS"] = "false";

    // When: the CLI resolves its JSON configuration envelope.
    const config = await resolvedConfig();

    // Then: values and provenance reflect the environment without shell translation.
    expect(config["strictSchema"]).toBe(false);
    expect(config["verifyFindings"]).toBe(false);
    expect(sourceFor(config, "strictSchema")).toEqual({
      source: "env",
      envName: "UMACTUALLY_STRICT_SCHEMA",
    });
    expect(sourceFor(config, "verifyFindings")).toEqual({
      source: "env",
      envName: "UMACTUALLY_VERIFY_FINDINGS",
    });
  });
});
