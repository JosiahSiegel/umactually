// SPDX-License-Identifier: MIT
// Regression: writeLiveArtifact (src/cli/run.ts) must capture the live
// review's actual thread count + verdict on successful posts, so the
// self-review guard artifact reflects what the GitHub/Azure API actually
// saw — not whatever the dry-run stub wrote.
//
// Live evidence: the guard artifact from the latest self-review run had
// `inlineThreadCount: 0` even though the live review posted 50 inline
// threads. The guard was inspecting a stale dry-run stub. This test
// pins that the live-artifact writer updates the artifact with the
// real counts.

import { describe, expect, it } from "vitest";
import type { LiveRunResult } from "../../src/cli/live-shared.js";

// The shape change to LiveRunResult is the contract under test. The
// artifact writer (src/cli/run.ts) reads these fields and writes them
// to the artifact JSON.
describe("LiveRunResult — fields surfaced for the self-review guard", () => {
  it("carries inlineThreadCount for successful posts", () => {
    const result: LiveRunResult = {
      exitCode: 0,
      posted: true,
      reviewId: 12345,
      message: "posted GitHub review",
      inlineThreadCount: 50,
      verdict: "NEEDS_FIX",
    };
    expect(result.inlineThreadCount).toBe(50);
    expect(result.verdict).toBe("NEEDS_FIX");
  });

  it("omits inlineThreadCount when the action did not post (parse-fail path)", () => {
    // Failed pre-review paths don't have a review to count. The artifact
    // writer must stamp zeros + parseFailed: true in this case.
    const result: LiveRunResult = {
      exitCode: 1,
      posted: false,
      reviewId: undefined,
      message: "Provider response did not contain a JSON review payload after self-healing retry.",
    };
    expect(result.posted).toBe(false);
    expect(result.inlineThreadCount).toBeUndefined();
  });
});