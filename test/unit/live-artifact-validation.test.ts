import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseCliArgs } from "../../src/cli/parse-args.js";
import type { LiveRunResult } from "../../src/cli/live-shared.js";

const runOrchestrator = vi.fn<(input: unknown) => Promise<LiveRunResult>>();

vi.mock("../../src/cli/orchestrator.js", () => ({
  runLive: runOrchestrator,
}));

const { dispatchLive, runDryRun, validateLiveArtifact } = await import(
  "../../src/cli/run.js"
);

const directories: string[] = [];

beforeEach(() => {
  runOrchestrator.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function temporaryDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "umactually-live-artifact-"));
  directories.push(directory);
  return directory;
}

function artifactWith(body: string): string {
  const path = join(temporaryDirectory(), "review.json");
  writeFileSync(path, body, "utf8");
  return path;
}

function parsed(outputArtifact = "review.json") {
  return parseCliArgs(["--output-artifact", outputArtifact]);
}

const GITHUB_ENV: NodeJS.ProcessEnv = { GITHUB_ACTIONS: "true" };

describe("automatic live artifact validation", () => {
  it("keeps exit 0 when a live review persists a valid artifact", async () => {
    // Given
    const cwd = temporaryDirectory();
    runOrchestrator.mockResolvedValue({
      exitCode: 0,
      posted: true,
      reviewId: 1,
      message: "posted",
      inlineThreadCount: 0,
      verdict: "APPROVED",
    });

    // When
    const result = await dispatchLive(parsed(), cwd, GITHUB_ENV);

    // Then
    expect(result.exitCode).toBe(0);
  });

  it("maps an empty persisted artifact to runtime exit 3 (parse-fail)", () => {
    // Given
    const path = artifactWith("");

    // When
    const exitCode = validateLiveArtifact(path, 0);

    // Then
    expect(exitCode).toBe(3);
  });

  it("maps a parse-fail sentinel artifact to runtime exit 3", () => {
    // Given
    const path = artifactWith("Parse failed — provider response");

    // When
    const exitCode = validateLiveArtifact(path, 0);

    // Then
    expect(exitCode).toBe(3);
  });

  it("maps an explicitly contradictory artifact to runtime exit 3", () => {
    // Given
    const path = artifactWith(JSON.stringify({
      event: "REQUEST_CHANGES",
      verdict: "NEEDS_FIX",
      inlineThreadCount: 0,
      parseFailed: true,
    }));

    // When
    const exitCode = validateLiveArtifact(path, 0);

    // Then
    expect(exitCode).toBe(3);
  });

  it("maps NEEDS_FIX with zero findings to runtime exit 3", () => {
    // Given
    const path = artifactWith(JSON.stringify({
      event: "REQUEST_CHANGES",
      verdict: "NEEDS_FIX",
      inlineThreadCount: 0,
      parseFailed: false,
    }));

    // When
    const exitCode = validateLiveArtifact(path, 0);

    // Then
    expect(exitCode).toBe(3);
  });

  it("preserves the live review's parse-fail exit 3 (M7 additive code)", async () => {
    // Given
    const cwd = temporaryDirectory();
    runOrchestrator.mockResolvedValue({
      exitCode: 1,
      posted: false,
      reviewId: undefined,
      message: "Provider response did not contain a valid JSON review payload",
    });

    // When
    const result = await dispatchLive(parsed(), cwd, GITHUB_ENV);

    // Then
    expect(result.exitCode).toBe(3);
  });

  it("does not auto-validate the standalone dry-run path", async () => {
    // Given
    const cwd = temporaryDirectory();
    const dryRunArgs = parseCliArgs([
      "--dry-run",
      "--output-artifact",
      "dry-run.json",
    ]);

    // When
    const result = await runDryRun(dryRunArgs, cwd, "github");

    // Then
    expect(result.exitCode).toBe(0);
  });

  it("validates the resolveArtifactPath output rather than a hard-coded filename", async () => {
    // Given
    const cwd = temporaryDirectory();
    const relativePath = join("nested", "custom-review.json");
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    runOrchestrator.mockResolvedValue({
      exitCode: 0,
      posted: true,
      reviewId: 1,
      message: "posted",
      inlineThreadCount: 0,
      verdict: "NEEDS_FIX",
    });

    // When
    const result = await dispatchLive(parsed(relativePath), cwd, GITHUB_ENV);

    // Then
    expect(result.exitCode).toBe(3);
    expect(stderr).toHaveBeenCalledWith(
      expect.stringContaining(join(cwd, relativePath)),
    );
  });
});
