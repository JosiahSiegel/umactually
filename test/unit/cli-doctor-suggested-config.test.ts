import { describe, expect, it } from "vitest";

import {
  formatDoctorHuman,
  formatDoctorJson,
  runDoctor,
  type DoctorDeps,
} from "../../src/cli/doctor.js";

const packageRoot = "/repo";

const healthyFs: DoctorDeps["fsAdapter"] = {
  stat: async (path) => ({ mtimeMs: path.endsWith("src/cli.ts") ? 100 : 200 }),
};

const staleDistFs: DoctorDeps["fsAdapter"] = {
  stat: async (path) => ({ mtimeMs: path.endsWith("src/cli.ts") ? 200 : 100 }),
};

const insideGit: DoctorDeps["execFile"] = async () => ({ stdout: "true\n", stderr: "" });

function options(overrides: Partial<DoctorDeps> = {}): DoctorDeps {
  return {
    cwd: packageRoot,
    isTTY: true,
    env: {
      UMACTUALLY_API_KEY: "test-key",
      UMACTUALLY_API_URL: "https://api.example.test/v1",
    },
    fsAdapter: healthyFs,
    execFile: insideGit,
    packageRoot,
    nodeVersion: "24.0.0",
    suggestedConfig: true,
    ...overrides,
  };
}

describe("doctor --suggested-config", () => {
  it("returns the API key suggestion when the key is missing", async () => {
    // Given: an otherwise healthy installation without an API key.
    const deps = options({ env: {} });

    // When: doctor runs with suggested configuration enabled.
    const result = await runDoctor(deps);

    // Then: the result contains copy-pasteable API key guidance.
    expect(result.suggestion).toBe("Set UMACTUALLY_API_KEY or pass --api-key");
  });

  it("returns null when every check passes", async () => {
    // Given: all diagnostics are healthy.
    const deps = options();

    // When: doctor runs with suggested configuration enabled.
    const result = await runDoctor(deps);

    // Then: no repair suggestion is needed.
    expect(result.suggestion).toBeNull();
  });

  it("prioritizes API key guidance over dist freshness", async () => {
    // Given: both the API key and bundled output checks fail.
    const deps = options({ env: {}, fsAdapter: staleDistFs });

    // When: doctor chooses one suggested repair.
    const result = await runDoctor(deps);

    // Then: API authentication guidance wins the requested priority ordering.
    expect(result.suggestion).toBe("Set UMACTUALLY_API_KEY or pass --api-key");
  });

  it("includes the suggestion in doctor JSON data", async () => {
    // Given: a doctor result with missing API credentials.
    const result = await runDoctor(options({ env: {} }));

    // When: the result is formatted for JSON envelope data.
    const data: unknown = JSON.parse(formatDoctorJson(result));

    // Then: the structured payload carries the selected suggestion.
    expect(data).toMatchObject({ suggestion: "Set UMACTUALLY_API_KEY or pass --api-key" });
  });

  it("prints the suggestion in human output", async () => {
    // Given: a doctor result with missing API credentials.
    const result = await runDoctor(options({ env: {} }));

    // When: the result is formatted for a human terminal.
    const stdout = formatDoctorHuman(result.checks, result.suggestion);

    // Then: stdout includes the actionable suggestion.
    expect(stdout).toContain("Suggested config: Set UMACTUALLY_API_KEY or pass --api-key");
  });

  it("suggests setting UMACTUALLY_API_URL when only the URL is missing", async () => {
    // Given: an env that has the key but not the URL.
    const deps = options({
      env: { UMACTUALLY_API_KEY: "test-key" },
    });

    // When: doctor runs with suggested configuration enabled.
    const result = await runDoctor(deps);

    // Then: api-url guidance wins because api-key is set.
    expect(result.suggestion).toBe("Set UMACTUALLY_API_URL or pass --api-url");
  });

  it("suggests dist-freshness when only the dist is stale", async () => {
    // Given: env is healthy but dist is older than src.
    const deps = options({ fsAdapter: staleDistFs });

    // When: doctor runs with suggested configuration enabled.
    const result = await runDoctor(deps);

    // Then: dist-freshness wins because auth env is set.
    expect(result.suggestion).toBe("Run `npm run bundle` to refresh dist/cli.js");
  });
});
