/**
 * Workflow contract test for the self-review workflow — this file used
 * to pin the (now removed) "Append resolution-guide to latest review
 * body" step. The CLI now bakes the guide into every review body
 * (the bake-resolution-guide plan), so the workflow step is redundant
 * and was removed.
 *
 * The remaining contracts:
 *   - the workflow still sets UMACTUALLY_PLATFORM at workflow-level env
 *     (single source of truth for the upstream review step)
 *   - the workflow file does NOT contain the removed step's markers
 *     (regression guard against an accidental re-introduction)
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");
const WORKFLOW_FILE = resolve(REPO_ROOT, ".github/workflows/self-review.yml");

describe("self-review workflow — guide-append step removed (bake-resolution-guide)", () => {
  const workflowText = readFileSync(WORKFLOW_FILE, "utf8");

  it("the 'Append resolution-guide to latest review body' step is REMOVED", () => {
    // The CLI bakes the guide into every review body (src/render/resolution-guide.ts).
    // The workflow step that re-appended the long-form guide was redundant
    // and is intentionally removed. Future re-introductions must be paired
    // with a removal of the bake-in-cmd path — pick one surface, not both.
    expect(workflowText).not.toMatch(
      /- name: Append resolution-guide to latest review body/u,
    );
  });

  it("the workflow GUIDE_MARKER literal is no longer referenced (step removed)", () => {
    // The removed step used `GUIDE_MARKER="<!-- umactually:resolution-guide-v3 -->"`
    // for its idempotency grep. With the step gone, the workflow file
    // should not reference that marker at all.
    expect(workflowText).not.toContain("GUIDE_MARKER=");
    expect(workflowText).not.toMatch(/umactually:resolution-guide-v\[0-9\]/u);
  });

  it("the workflow still sets UMACTUALLY_PLATFORM at workflow-level env (single source of truth)", () => {
    // The env var is consumed by the upstream 'Run UmActually self review' step
    // (echoed via step output for the platform flag). The single-source-of-truth
    // discipline from PR #139 round 8 must hold: declare it once at workflow level,
    // not inline in individual step env blocks.
    expect(workflowText).toMatch(/^env:\s*\n[\s\S]*?UMACTUALLY_PLATFORM:\s*github/m);
  });
});
