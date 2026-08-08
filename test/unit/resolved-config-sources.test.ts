import { afterEach, describe, expect, it, vi } from "vitest";

import { runJsonReview } from "../../src/cli/dispatch.js";

const TRACKED_ENV = [
  "UMACTUALLY_API_KEY",
  "UMACTUALLY_API_URL",
  "UMACTUALLY_GITHUB_API_BASE",
  "UMACTUALLY_MODEL",
  "UMACTUALLY_PROVIDER",
  "UMACTUALLY_IGNORE_MINOR",
  "REVIEW_IGNORE_MINOR",
  "REVIEW_PROVIDER_URL",
  "UMACTUALLY_PROMPT_FILES",
  "UMACTUALLY_STRICT_SCHEMA",
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

async function resolvedConfig(argv: readonly string[]): Promise<Record<string, unknown>> {
  let stdout = "";
  const spy = vi.spyOn(process.stdout, "write").mockImplementation((chunk): boolean => {
    stdout += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    return true;
  });
  try {
    await runJsonReview(argv);
  } finally {
    spy.mockRestore();
  }
  const envelope: unknown = JSON.parse(stdout);
  expect(envelope).toBeTypeOf("object");
  expect(envelope).not.toBeNull();
  if (typeof envelope !== "object" || envelope === null) {
    throw new TypeError("Expected JSON review envelope object");
  }
  const config = Reflect.get(envelope, "resolvedConfig");
  expect(config).toBeTypeOf("object");
  expect(config).not.toBeNull();
  return config;
}

function sourceFor(config: Record<string, unknown>, field: string): Record<string, unknown> {
  const sources = config["sources"];
  expect(sources).toBeTypeOf("object");
  expect(sources).not.toBeNull();
  if (typeof sources !== "object" || sources === null) {
    throw new TypeError("Expected resolvedConfig.sources object");
  }
  const source = Reflect.get(sources, field);
  expect(source).toBeTypeOf("object");
  expect(source).not.toBeNull();
  return source;
}

describe("resolvedConfig source provenance", () => {
  it("reports an object of field sources", async () => {
    const config = await resolvedConfig(["--dry-run"]);

    expect(config["sources"]).toBeTypeOf("object");
    expect(config["sources"]).not.toBeNull();
  });

  it("reports only current public environment names in provenance", async () => {
    process.env["UMACTUALLY_API_KEY"] = "current-key";
    process.env["UMACTUALLY_API_URL"] = "https://canonical.example/v1";
    process.env["UMACTUALLY_GITHUB_API_BASE"] = "https://github.example/api/v3";
    process.env["UMACTUALLY_MODEL"] = "current-model";
    process.env["UMACTUALLY_PROVIDER"] = "anthropic";
    process.env["UMACTUALLY_IGNORE_MINOR"] = "true";
    process.env["REVIEW_IGNORE_MINOR"] = "true";
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    let config: Record<string, unknown>;
    let warningOutput = "";
    try {
      config = await resolvedConfig(["--dry-run"]);
      warningOutput = stderr.mock.calls.flatMap((call) => call).join("");
    } finally {
      stderr.mockRestore();
    }
    const sources = config["sources"];
    if (typeof sources !== "object" || sources === null) {
      throw new TypeError("Expected resolvedConfig.sources object");
    }

    const envNames = Object.values(sources)
      .filter((source): source is Record<string, unknown> => typeof source === "object" && source !== null)
      .map((source) => source["envName"])
      .filter((envName): envName is string => typeof envName === "string")
      .sort();

    expect(envNames).toEqual([
      "UMACTUALLY_API_KEY",
      "UMACTUALLY_API_URL",
      "UMACTUALLY_GITHUB_API_BASE",
      "UMACTUALLY_MODEL",
      "UMACTUALLY_PROVIDER",
    ]);
    expect(warningOutput).not.toContain("UMACTUALLY_IGNORE_MINOR");
    expect(warningOutput).not.toContain("REVIEW_IGNORE_MINOR");
  });

  it("reports strictSchema from an explicit flag", async () => {
    process.env["UMACTUALLY_STRICT_SCHEMA"] = "false";

    const source = sourceFor(
      await resolvedConfig(["--dry-run", "--strict-schema"]),
      "strictSchema",
    );

    expect(source["source"]).toBe("flag");
  });

  it("reports strictSchema from its default", async () => {
    delete process.env["UMACTUALLY_STRICT_SCHEMA"];

    const source = sourceFor(await resolvedConfig(["--dry-run"]), "strictSchema");

    expect(source["source"]).toBe("default");
  });

  it("reports apiKey from its environment variable without leaking the key", async () => {
    const secret = "source-test-secret";
    process.env["UMACTUALLY_API_KEY"] = secret;

    const source = sourceFor(await resolvedConfig(["--dry-run"]), "apiKey");

    expect(source["source"]).toBe("env");
    expect(source["envName"]).toBe("UMACTUALLY_API_KEY");
    expect(JSON.stringify(source)).not.toContain(secret);
  });

  it("reports apiKey from an explicit flag without leaking the key", async () => {
    const secret = "flag-source-test-secret";

    const source = sourceFor(
      await resolvedConfig(["--dry-run", "--api-key", secret]),
      "apiKey",
    );

    expect(source["source"]).toBe("flag");
    expect(JSON.stringify(source)).not.toContain(secret);
  });

  it("does not report removed environment variables as provenance", async () => {
    process.env["REVIEW_PROVIDER_URL"] = "https://legacy.example/v1";
    process.env["UMACTUALLY_PROMPT_FILES"] = "CLAUDE.md,AGENTS.md";
    process.env["UMACTUALLY_STRICT_SCHEMA"] = "false";

    const config = await resolvedConfig(["--dry-run"]);

    expect(sourceFor(config, "apiUrl")["source"]).toBe("default");
    expect(sourceFor(config, "strictSchema")["source"]).toBe("default");
    expect(config["promptFilesPresent"]).toBe(false);
  });

  it("keeps existing sanitized resolvedConfig fields alongside provenance", async () => {
    process.env["UMACTUALLY_API_KEY"] = "additive-secret";

    const config = await resolvedConfig(["--dry-run"]);

    expect(config["strictSchema"]).toBe(true);
    expect(config["apiKeyPresent"]).toBe(true);
    expect(config["dryRun"]).toBe(true);
  });
});
