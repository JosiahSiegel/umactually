import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");

describe("self-review workflow", () => {
  it("passes an explicit overridable synthetic model to the review invocation", () => {
    // Given: the checked-in self-review workflow.
    const workflow = readFileSync(join(REPO_ROOT, ".github/workflows/self-review.yml"), "utf8");

    // When: the review invocation step is selected.
    const reviewStep = workflow.match(/- name: Run UmActually self review[\s\S]*?(?=\n      - name:)/u)?.[0] ?? "";

    // Then: the invocation bypasses discovery with the canonical overridable model.
    expect(reviewStep).toContain("node bin/umactually.mjs review");
    expect(reviewStep).toContain("--model ");
    expect(reviewStep).toContain('${UMACTUALLY_MODEL:-review-model-synthetic}');
  });
});
