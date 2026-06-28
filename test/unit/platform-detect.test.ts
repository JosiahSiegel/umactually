import { describe, expect, it } from "vitest";

import { expectFutureModule } from "../helpers/assert-red-module.js";

type CiPlatform = "github" | "azure-devops" | "unknown";
type DetectPlatform = (env: NodeJS.ProcessEnv) => CiPlatform;

type PlatformDetectionErrorShape = Error & {
  readonly code: "PLATFORM_UNKNOWN";
};

const detectModule = "../../src/platform/detect.js";
const detectPath = "src/platform/detect.ts";

function isDetectPlatform(value: unknown): value is DetectPlatform {
  return typeof value === "function";
}

function isPlatformDetectionError(value: unknown): value is PlatformDetectionErrorShape {
  return value instanceof Error && value.name === "PlatformDetectionError" && "code" in value && value.code === "PLATFORM_UNKNOWN";
}

async function loadDetectPlatform(): Promise<DetectPlatform> {
  const moduleNamespace = await expectFutureModule(detectModule);
  const detectPlatform = moduleNamespace["detectPlatform"];
  if (!isDetectPlatform(detectPlatform)) {
    expect.fail(`RED: ${detectPath} must export detectPlatform(env)`);
  }
  return detectPlatform;
}

describe("platform detection unit contract", () => {
  it("PLATFORM-RED-001 returns github when GitHub Actions marker is present", async () => {
    // Given: an environment carrying the GitHub Actions platform marker.
    const detectPlatform = await loadDetectPlatform();
    const env: NodeJS.ProcessEnv = { GITHUB_ACTIONS: "true", TF_BUILD: "true" };

    // When: the platform detector evaluates the CI environment.
    const platform = detectPlatform(env);

    // Then: GitHub wins precedence over Azure DevOps.
    expect(platform).toBe("github");
  });

  it("PLATFORM-RED-002 returns azure-devops when Azure Pipelines marker is present", async () => {
    // Given: an environment carrying only the Azure Pipelines platform marker.
    const detectPlatform = await loadDetectPlatform();
    const env: NodeJS.ProcessEnv = { TF_BUILD: "true" };

    // When: the platform detector evaluates the CI environment.
    const platform = detectPlatform(env);

    // Then: Azure DevOps is selected.
    expect(platform).toBe("azure-devops");
  });

  it("PLATFORM-RED-003 throws a typed sanitized error when no platform marker is present", async () => {
    // Given: an unknown CI environment with secret-like values that must not leak.
    const detectPlatform = await loadDetectPlatform();
    const env: NodeJS.ProcessEnv = {
      SECRET_TOKEN: "super-secret-token",
      API_KEY: "top-secret-api-key",
    };

    // When: the platform detector evaluates the unknown environment.
    let thrown: unknown;
    try {
      detectPlatform(env);
    } catch (error) {
      thrown = error;
    }

    // Then: the failure is typed and its message does not expose env values.
    if (!isPlatformDetectionError(thrown)) {
      expect.fail("RED: unknown platform must throw PlatformDetectionError with code PLATFORM_UNKNOWN");
    }
    expect(thrown.message).not.toContain("super-secret-token");
    expect(thrown.message).not.toContain("top-secret-api-key");
  });
});
