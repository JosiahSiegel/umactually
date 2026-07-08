import { describe, expect, it } from "vitest";

import { resolveParseWarningsArtifactPath } from "../../src/cli/run.js";

describe("resolveParseWarningsArtifactPath", () => {
  it("derives the parse-warnings sibling path from the .md GitHub artifact (POSIX paths)", () => {
    expect(
      resolveParseWarningsArtifactPath(
        "/home/runner/work/umactually/umactually/artifacts/manual/s1-github-self-review.md",
      ),
    ).toBe("/home/runner/work/umactually/umactually/artifacts/manual/s1-github-self-review.parse-warnings.json");
  });

  it("derives the parse-warnings sibling path from the .json Azure artifact (POSIX paths)", () => {
    expect(
      resolveParseWarningsArtifactPath(
        "/home/runner/work/umactually/umactually/artifacts/manual/s4-azure-mocked-run.json",
      ),
    ).toBe("/home/runner/work/umactually/umactually/artifacts/manual/s4-azure-mocked-run.parse-warnings.json");
  });

  it("handles a user-supplied --output-artifact path", () => {
    expect(
      resolveParseWarningsArtifactPath("artifacts/manual/my-review.md"),
    ).toBe("artifacts/manual/my-review.parse-warnings.json");
  });

  it("replaces the last extension only (does not append after multi-dot names)", () => {
    // e.g. s6.sonar-mocked-run.json — the .json at the end is the only
    // one replaced.
    expect(
      resolveParseWarningsArtifactPath("artifacts/manual/s6.sonar-mocked-run.json"),
    ).toBe("artifacts/manual/s6.sonar-mocked-run.parse-warnings.json");
  });

  it("handles Windows-style backslash paths", () => {
    // On Linux CI this test confirms the backslash-preserving branch
    // is reached. The forward-slash form is the canonical case.
    expect(
      resolveParseWarningsArtifactPath(
        "D:\\repos\\umactually\\artifacts\\manual\\s1-github-self-review.md",
      ),
    ).toBe("D:\\repos\\umactually\\artifacts\\manual\\s1-github-self-review.parse-warnings.json");
  });
});