import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { dispatch, type DispatchResult } from "../../src/cli/dispatch.js";

const GITHUB_REVIEW = {
  event: "COMMENT",
  verdict: "COMMENT",
  inlineThreadCount: 2,
  suppressedCommentCount: 0,
  blockedRawOutput: false,
  parseFailed: false,
} as const;

const AZURE_REVIEW = {
  postedThreadCount: 1,
  postedStatusState: "succeeded",
  blockedRawOutput: false,
} as const;

describe("check-review-artifact command", () => {
  let directory = "";
  let stderr = "";

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "umactually-review-artifact-"));
    stderr = "";
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      stderr += String(chunk);
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(directory, { recursive: true, force: true });
  });

  it("returns exit 0 for a valid GitHub review artifact", async () => {
    // Given
    const path = writeArtifact("github.json", GITHUB_REVIEW);

    // When
    const result = await runCheck(path);

    // Then
    expect(result.exitCode).toBe(0);
    expect(stderr).toContain(`${path}: real review (2 findings, verdict=COMMENT)`);
  });

  it("returns exit 0 for a valid Azure review artifact", async () => {
    // Given
    const path = writeArtifact("azure.json", AZURE_REVIEW);

    // When
    const result = await runCheck(path);

    // Then
    expect(result.exitCode).toBe(0);
    expect(stderr).toContain(`${path}: real review (1 findings, verdict=succeeded)`);
  });

  it("returns exit 1 when the artifact is missing", async () => {
    // Given
    const path = join(directory, "missing.json");

    // When
    const result = await runCheck(path);

    // Then
    expect(result.exitCode).toBe(1);
    expect(stderr).toContain(`${path}: file not found`);
  });

  it("returns exit 1 when the artifact is invalid JSON", async () => {
    // Given
    const path = join(directory, "invalid.json");
    writeFileSync(path, "{not-json", "utf8");

    // When
    const result = await runCheck(path);

    // Then
    expect(result.exitCode).toBe(1);
    expect(stderr).toContain(`${path}: invalid JSON`);
  });

  it("returns exit 1 for a parse-fail sentinel artifact", async () => {
    // Given
    const path = writeArtifact("parse-fail.json", {
      event: "COMMENT",
      verdict: "COMMENT",
      inlineThreadCount: 1,
      summary: "Provider response did not contain a valid JSON review payload",
    });

    // When
    const result = await runCheck(path);

    // Then
    expect(result.exitCode).toBe(1);
    expect(stderr).toContain(`${path}: contains parse-fail sentinel`);
  });

  it("returns exit 1 for a contradictory review", async () => {
    // Given
    const path = writeArtifact("contradiction.json", {
      event: "REQUEST_CHANGES",
      verdict: "NEEDS_FIX",
      inlineThreadCount: 0,
      suppressedCommentCount: 2,
      parseFailed: false,
    });

    // When
    const result = await runCheck(path);

    // Then
    expect(result.exitCode).toBe(1);
    expect(stderr).toContain("contradictory review: verdict=NEEDS_FIX with 0 findings");
  });

  it("returns exit 2 when the path argument is missing", async () => {
    // Given / When
    const result = await dispatch(["check-review-artifact"]);

    // Then
    expect(result.exitCode).toBe(2);
    expect(stderr).toContain("usage: umactually check-review-artifact <path>");
  });

  it("returns exit 2 when an extra positional argument is supplied", async () => {
    // Given
    const path = writeArtifact("review.json", GITHUB_REVIEW);

    // When
    const result = await dispatch(["check-review-artifact", path, "extra.json"]);

    // Then
    expect(result.exitCode).toBe(2);
    expect(stderr).toContain("usage: umactually check-review-artifact <path>");
  });

  function writeArtifact(name: string, value: object): string {
    const path = join(directory, name);
    writeFileSync(path, JSON.stringify(value), "utf8");
    return path;
  }
});

async function runCheck(path: string): Promise<DispatchResult> {
  const result = await dispatch(["check-review-artifact", path]);
  if (typeof result === "number") {
    return { exitCode: result };
  }
  return result;
}
