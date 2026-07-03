import { describe, expect, it } from "vitest";

import { buildSimulatedFindings } from "../../src/review/simulated-findings.js";

describe("buildSimulatedFindings — empty diff fallback", () => {
  it("S7-RED-020 produces 4-6 inline comments even when the diff has zero positions", () => {
    // Given: an empty diff (placeholder or typo-only PR).
    const emptyDiff = "";
    const result = buildSimulatedFindings(
      "octo-org/octo-repo",
      42,
      "1111111111111111111111111111111111111111",
      emptyDiff,
    );

    // Then: the fixture still produces 4-6 inline comments anchored somewhere.
    expect(result.comments.length).toBeGreaterThanOrEqual(4);
    expect(result.comments.length).toBeLessThanOrEqual(6);

    // Then: at least 1 suppressed comment exists (off-diff behavior).
    expect(result.suppressed_comments.length).toBeGreaterThanOrEqual(1);

    // Then: every inline comment has a non-empty body, path, line, severity, category.
    for (const c of result.comments) {
      expect(typeof c.path).toBe("string");
      expect(c.path.length).toBeGreaterThan(0);
      expect(typeof c.line).toBe("number");
      expect(c.severity.length).toBeGreaterThan(0);
      expect(c.category.length).toBeGreaterThan(0);
      expect(c.body.length).toBeGreaterThan(0);
    }
  });
});