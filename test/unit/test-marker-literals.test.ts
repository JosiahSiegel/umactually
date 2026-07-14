// Structural test: ensures that `<!-- umactually -->` literal
// never re-appears in Category C test files (the TS test files that are
// NOT the marker-literal allowlist and NOT JSON fixtures). Every Category
// C test must consume the literal via the `REVIEW_MARKER` constant
// exported from `src/util/marker.ts`.
//
// The allowlist file `test/unit/marker-literal.test.ts` is intentionally
// retained as a guard against silent drift in `src/util/marker.ts`
// itself. The Category A JSON fixtures under `test/fixtures/**` are data
// files — the marker is a payload field, not a code reference.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(__dirname, "..", "..");
const MARKER_LITERAL = "<!-- umactually -->";

/**
 * Category C — TypeScript test files that the DRY cleanup is allowed to
 * touch. JSON fixtures and `test/unit/marker-literal.test.ts` are NOT
 * included (data + allowlist).
 */
const CATEGORY_C_FILES: readonly string[] = [
  "test/scenarios/s1-github-happy.test.ts",
  "test/scenarios/s4-azure.test.ts",
  "test/unit/check-self-review-output-contradiction.test.ts",
  "test/unit/cli-dry-run.test.ts",
  "test/unit/live-azure-dedup.test.ts",
  "test/unit/live-azure-parent-clarity.test.ts",
  "test/unit/live-azure-parent-top.test.ts",
  "test/unit/live-azure-parent-update.test.ts",
  "test/unit/live-azure-pr-comment.test.ts",
  "test/unit/live-github-state.test.ts",
  "test/unit/live-shared-body.test.ts",
  "test/unit/live-shared-prepare-posted-review.test.ts",
  "test/unit/raw-output-safety.test.ts",
  "test/unit/reference-behavior.test.ts",
  "test/unit/run-live-azure-chunked.test.ts",
  "test/unit/run-live-azure.test.ts",
  "test/unit/run-live-orchestration.test.ts",
  "test/unit/simulated-findings.test.ts",
  "test/unit/summary-layouts.test.ts",
] as const;

/**
 * Sanity-list — files that MUST still contain the literal. The
 * allowlist pin (`test/unit/marker-literal.test.ts`) guards against
 * silent drift in `src/util/marker.ts`. JSON fixtures are data; the
 * marker appears as a payload field, not as a code reference.
 */
const SANITY_FILES_THAT_MUST_CONTAIN_LITERAL: readonly string[] = [
  "test/unit/marker-literal.test.ts",
  "test/fixtures/azure/expected-surface.json",
  "test/fixtures/azure/threads.json",
  "test/fixtures/github/existing-review-comments.json",
  "test/fixtures/github/expected-surface.json",
] as const;

describe("DRY-MARKER: no duplicated `<!-- umactually -->` literals in test code", () => {
  it("DRY-MARKER-001: every Category C test file consumes the marker via the REVIEW_MARKER constant, not as a literal", async () => {
    const offenders: string[] = [];
    for (const relPath of CATEGORY_C_FILES) {
      const absPath = resolve(REPO_ROOT, relPath);
      const contents = await readFile(absPath, "utf8");
      if (contents.includes(MARKER_LITERAL)) {
        offenders.push(relPath);
      }
    }
    expect(offenders, `Found the marker literal in Category C files. Replace with the REVIEW_MARKER constant from src/util/marker.ts:\n  - ${offenders.join("\n  - ")}`).toEqual([]);
  });

  it("DRY-MARKER-002: the allowlist pin and JSON fixtures DO still contain the literal (sanity guard)", async () => {
    const missing: string[] = [];
    for (const relPath of SANITY_FILES_THAT_MUST_CONTAIN_LITERAL) {
      const absPath = resolve(REPO_ROOT, relPath);
      const contents = await readFile(absPath, "utf8");
      if (!contents.includes(MARKER_LITERAL)) {
        missing.push(relPath);
      }
    }
    expect(missing, `These files must still contain the marker literal (allowlist pin or JSON data). If the allowlist is wrong, fix the SANITY_FILES_THAT_MUST_CONTAIN_LITERAL list:\n  - ${missing.join("\n  - ")}`).toEqual([]);
  });
});
