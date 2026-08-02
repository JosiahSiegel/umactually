// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";

import { runDoctor, type DoctorDeps } from "../../src/cli/doctor.js";

const packageRoot = "/repo";
const healthyFs: DoctorDeps["fsAdapter"] = {
  stat: async (path) => ({ mtimeMs: path.endsWith("src/cli.ts") ? 100 : 200 }),
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
    ...overrides,
  };
}

describe("doctor --fix", () => {
  it("skips repair without --yes and exits 0", async () => {
    // Given: a fix request without explicit --yes.
    const result = await runDoctor(options({ fix: "dist-freshness" }));

    // Then: repair is skipped, exit 0.
    expect(result.exitCode).toBe(0);
    expect(result.json?.fix?.outcome).toBe("skipped");
  });

  it("repairs dist-freshness when --yes is given", async () => {
    // Given: --yes is set; the underlying execFile succeeds.
    const result = await runDoctor(
      options({
        fix: "dist-freshness",
        fixYes: true,
        fsAdapter: {
          stat: async (path) => ({ mtimeMs: path.endsWith("src/cli.ts") ? 200 : 100 }),
        },
      }),
    );

    // Then: bundle ran and fix is marked repaired.
    expect(result.exitCode).toBe(0);
    expect(result.json?.fix?.outcome).toBe("repaired");
    expect(result.json?.fix?.checkId).toBe("dist-freshness");
  });

  it("returns exit 2 for an unknown check-id", async () => {
    // Given: an invalid check-id even with --yes.
    const result = await runDoctor(options({ fix: "bogus", fixYes: true }));

    // Then: failed outcome and exit 2.
    expect(result.exitCode).toBe(2);
    expect(result.json?.fix?.outcome).toBe("failed");
    expect(result.json?.fix?.message).toContain("unknown check-id 'bogus'");
  });

  it("returns exit 1 when the repair itself throws", async () => {
    // Given: --yes is set; execFile rejects.
    const result = await runDoctor(
      options({
        fix: "dist-freshness",
        fixYes: true,
        execFile: async () => {
          throw new Error("bundle boom");
        },
        fsAdapter: {
          stat: async (path) => ({ mtimeMs: path.endsWith("src/cli.ts") ? 200 : 100 }),
        },
      }),
    );

    // Then: repair fails with exit 1 (not 2).
    expect(result.exitCode).toBe(1);
    expect(result.json?.fix?.outcome).toBe("failed");
    expect(result.json?.fix?.message).toBe("bundle boom");
  });

  it("skips provider-config and node-version repair without an execFile call", async () => {
    // Given: a fix request for the no-op node-version check; track
    // whether the FIX body itself invokes execFile (the runDoctor
    // preamble may still call execFile for the git probe).
    let bundleCalls = 0;
    const result = await runDoctor(
      options({
        fix: "node-version",
        fixYes: true,
        execFile: async (file) => {
          if (file === "npm") {
            bundleCalls += 1;
          }
          return { stdout: "", stderr: "" };
        },
      }),
    );

    // Then: the no-op fix path did not invoke `npm run bundle`.
    expect(bundleCalls).toBe(0);
    expect(result.exitCode).toBe(0);
    expect(result.json?.fix?.outcome).toBe("skipped");
    expect(result.json?.fix?.message).toContain("install Node 24+");
  });

  it("surfaces the init hint for the provider-config repair path", async () => {
    // Given: a fix request for the provider-config hint.
    const result = await runDoctor(options({ fix: "provider-config", fixYes: true }));

    // Then: a copy-pasteable init hint is surfaced (no bundle call).
    expect(result.exitCode).toBe(0);
    expect(result.json?.fix?.outcome).toBe("skipped");
    expect(result.json?.fix?.message).toContain("umactually init --provider");
  });
});