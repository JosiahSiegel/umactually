/**
 * Pins the new constants introduced by the DRY optimization that
 * replaces the remaining inline brand/marker literals in production
 * source code. These constants live alongside their siblings in
 * `src/util/brand.ts` and `src/util/marker.ts`. A silent drift on
 * the literal values would break:
 *   - the manifest HTML comment prefix that AI agents parse,
 *   - the Azure DevOps status `genre` field that the dedup helper
 *     uses to locate legacy entries on the next run,
 *   - the `current marker slug` invariant the reference-regression
 *     helper checks against.
 *
 * Source-file regressions covered (and the literal that USED to live
 * at each site):
 *   - `src/cli/live-azure.ts:516`      const AZURE_STATUS_CONTEXT_GENRE = "pr-review"
 *   - `src/render/summary-layouts.ts:354`  `<!-- umactually-pr-review:manifest ...`
 *   - `src/render/summary-layouts.ts:354`  ` -->`
 *   - `src/cli/run.ts:385`              marker: "<!-- umactually-pr-review -->",
 *   - `src/cli/run.ts:405`              marker: "<!-- umactually-pr-review -->",
 *   - `src/cli/live-azure.ts:516`       local declaration of AZURE_STATUS_CONTEXT_GENRE
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { AZURE_STATUS_CONTEXT_GENRE } from "../../src/util/brand.js";
import { MANIFEST_MARKER_PREFIX, MANIFEST_MARKER_SUFFIX } from "../../src/util/marker.js";

// Repo root: vitest runs tests with cwd at the project root.
const REPO_ROOT = resolve();

function readSrc(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), "utf8");
}

describe("DRY-BRAND: brand/marker constants (Wave 2 task #8)", () => {
  it("DRY-BRAND-001: AZURE_STATUS_CONTEXT_GENRE === 'pr-review'", () => {
    expect(AZURE_STATUS_CONTEXT_GENRE).toBe("pr-review");
  });

  it("DRY-BRAND-002: MANIFEST_MARKER_PREFIX is the canonical comment prefix", () => {
    expect(MANIFEST_MARKER_PREFIX).toBe("<!-- umactually-pr-review:manifest ");
  });

  it("DRY-BRAND-003: MANIFEST_MARKER_SUFFIX is the canonical comment closer", () => {
    expect(MANIFEST_MARKER_SUFFIX).toBe(" -->");
  });

  it("DRY-BRAND-004: src/cli/run.ts uses REVIEW_MARKER and not the literal marker", () => {
    const src = readSrc("src/cli/run.ts");
    // The two artifact-write sites (around line 385 and 405) must
    // reference REVIEW_MARKER (imported from util/marker.js).
    expect(src).toMatch(/marker:\s*REVIEW_MARKER/u);
    // The exact literal that previously sat on those two lines must
    // no longer appear in run.ts.
    expect(src).not.toContain('marker: "<!-- umactually-pr-review -->"');
  });

  it("DRY-BRAND-005: src/cli/live-azure.ts imports AZURE_STATUS_CONTEXT_GENRE from brand and does not redeclare it", () => {
    const src = readSrc("src/cli/live-azure.ts");
    // Imports the constant from util/brand.
    expect(src).toMatch(
      /import\s*\{[^}]*\bAZURE_STATUS_CONTEXT_GENRE\b[^}]*\}\s*from\s*["']\.\.\/util\/brand(?:\.js)?["']/u,
    );
    // No local declaration of the constant.
    expect(src).not.toMatch(/^(?:\s*)const\s+AZURE_STATUS_CONTEXT_GENRE\s*=/um);
  });
});