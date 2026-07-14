import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";

import { classifyReviewArtifact } from "../../src/cli/check-review-artifact.js";

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("review artifact contradiction regression", () => {
  it("rejects NEEDS_FIX with zero inline findings even when comments were suppressed", () => {
    // Given
    const directory = mkdtempSync(join(tmpdir(), "umactually-contradiction-"));
    directories.push(directory);
    const path = join(directory, "review.json");
    writeFileSync(path, JSON.stringify({
      event: "REQUEST_CHANGES",
      verdict: "NEEDS_FIX",
      inlineThreadCount: 0,
      suppressedCommentCount: 2,
      parseFailed: false,
    }), "utf8");

    // When
    const result = classifyReviewArtifact(path);

    // Then
    expect(result).toEqual({
      ok: false,
      reason: "contradictory review: verdict=NEEDS_FIX with 0 findings",
    });
  });
});
