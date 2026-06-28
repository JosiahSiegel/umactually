import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parseDiffPositions } from "../../src/diff/parse-positions.js";
import { buildSimulatedFindings } from "../../src/review/simulated-findings.js";

const FIXTURE_REPO = "octo-org/octo-repo";
const FIXTURE_PR_NUMBER = 42;
const FIXTURE_HEAD_SHA = "1111111111111111111111111111111111111111";

async function readFullPrDiff(): Promise<string> {
  const fixturePath = fileURLToPath(new URL("../fixtures/github/full-pr.diff", import.meta.url));
  return readFile(fixturePath, "utf8");
}

describe("buildSimulatedFindings", () => {
  it("returns a deterministic ProviderReviewPayload when the diff has anchor points", async () => {
    // Given: the canonical full-PR diff fixture with three changed files.
    const diffText = await readFullPrDiff();
    const positions = parseDiffPositions(diffText);

    // When: the simulated fixture is requested for this PR.
    const payload = buildSimulatedFindings(FIXTURE_REPO, FIXTURE_PR_NUMBER, FIXTURE_HEAD_SHA, diffText);

    // Then: the summary and verdict identify the simulated source.
    expect(payload.summary.length).toBeGreaterThan(0);
    expect(payload.verdict).toBe("NEEDS_FIX");

    // Then: every inline comment is anchored on a real diff position.
    expect(payload.comments.length).toBeGreaterThanOrEqual(4);
    expect(payload.comments.length).toBeLessThanOrEqual(6);
    for (const comment of payload.comments) {
      expect(positions.hasPosition(comment)).toBe(true);
      expect(typeof comment.path).toBe("string");
      expect(typeof comment.line).toBe("number");
      expect(typeof comment.body).toBe("string");
      expect(comment.body.length).toBeGreaterThan(0);
    }
  });

  it("spans multiple files and mixes severities and categories", async () => {
    // Given: the canonical full-PR diff fixture.
    const diffText = await readFullPrDiff();

    // When: the fixture is built.
    const payload = buildSimulatedFindings(FIXTURE_REPO, FIXTURE_PR_NUMBER, FIXTURE_HEAD_SHA, diffText);

    // Then: findings touch at least two distinct files.
    const distinctPaths = new Set(payload.comments.map((comment) => comment.path));
    expect(distinctPaths.size).toBeGreaterThanOrEqual(2);

    // Then: severities include high/medium/low at least one each.
    const severities = new Set(payload.comments.map((comment) => comment.severity));
    expect(severities.has("high")).toBe(true);
    expect(severities.has("medium")).toBe(true);
    expect(severities.has("low")).toBe(true);

    // Then: categories include security, style, correctness, and performance.
    const categories = new Set(payload.comments.map((comment) => comment.category));
    expect(categories.has("security")).toBe(true);
    expect(categories.has("style")).toBe(true);
    expect(categories.has("correctness")).toBe(true);
    expect(categories.has("performance")).toBe(true);
  });

  it("includes suppressed_comments that point off-diff", async () => {
    // Given: the canonical full-PR diff fixture.
    const diffText = await readFullPrDiff();
    const positions = parseDiffPositions(diffText);

    // When: the fixture is built.
    const payload = buildSimulatedFindings(FIXTURE_REPO, FIXTURE_PR_NUMBER, FIXTURE_HEAD_SHA, diffText);

    // Then: at least one suppressed comment points outside the diff (off-diff path).
    expect(payload.suppressed_comments.length).toBeGreaterThanOrEqual(1);
    expect(payload.suppressed_comments.length).toBeLessThanOrEqual(2);
    let offDiffFound = false;
    for (const comment of payload.suppressed_comments) {
      if (!positions.hasPosition(comment)) {
        offDiffFound = true;
        break;
      }
    }
    expect(offDiffFound).toBe(true);
  });

  it("anchors inline comments on positions actually present in the diff", async () => {
    // Given: the canonical full-PR diff fixture.
    const diffText = await readFullPrDiff();
    const positions = parseDiffPositions(diffText);

    // When: the fixture is built.
    const payload = buildSimulatedFindings(FIXTURE_REPO, FIXTURE_PR_NUMBER, FIXTURE_HEAD_SHA, diffText);

    // Then: every inline comment is anchored on a real diff position (not a
    // hard-coded example path that exists only in old fixtures).
    const enumerated = positions.enumerate();
    expect(enumerated.length).toBeGreaterThanOrEqual(4);
    for (const comment of payload.comments) {
      expect(positions.hasPosition(comment)).toBe(true);
    }

    // Then: at least one inline comment targets the orchestrator file added to the fixture.
    const orchestratorAnchor = payload.comments.find(
      (comment) => comment.path === "src/cli/orchestrator.ts",
    );
    expect(orchestratorAnchor).toBeDefined();
  });

  it("produces body text that references a real symbol from the diff", async () => {
    // Given: the canonical full-PR diff fixture (which contains renderReview and applySimulateFindings).
    const diffText = await readFullPrDiff();

    // When: the fixture is built.
    const payload = buildSimulatedFindings(FIXTURE_REPO, FIXTURE_PR_NUMBER, FIXTURE_HEAD_SHA, diffText);

    // Then: at least one finding body references a real symbol from the diff.
    const allBodies = payload.comments.map((comment) => comment.body).join("\n");
    expect(
      allBodies.includes("renderReview") || allBodies.includes("applySimulateFindings"),
    ).toBe(true);
  });

  it("produces at least 4 inline comments when given any diff with >= 4 right-side lines", async () => {
    // Given: a synthetic large diff with plenty of right-side positions.
    const syntheticDiff = [
      "diff --git a/src/a.ts b/src/a.ts",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -1,3 +1,5 @@",
      " export function alpha(): string {",
      "-  return \"a\";",
      "+  const secretA = \"leak-a\";",
      "+  return `a-${secretA}`;",
      " }",
      "+",
      "+export const changedA = true;",
      "diff --git a/src/b.ts b/src/b.ts",
      "--- a/src/b.ts",
      "+++ b/src/b.ts",
      "@@ -1,3 +1,5 @@",
      " export function beta(): string {",
      "-  return \"b\";",
      "+  const secretB = \"leak-b\";",
      "+  return `b-${secretB}`;",
      " }",
      "+",
      "+export const changedB = true;",
      "diff --git a/src/c.ts b/src/c.ts",
      "--- a/src/c.ts",
      "+++ b/src/c.ts",
      "@@ -1,3 +1,5 @@",
      " export function gamma(): string {",
      "-  return \"c\";",
      "+  const secretC = \"leak-c\";",
      "+  return `c-${secretC}`;",
      " }",
      "+",
      "+export const changedC = true;",
      "",
    ].join("\n");

    // When: the fixture is built.
    const payload = buildSimulatedFindings(FIXTURE_REPO, FIXTURE_PR_NUMBER, FIXTURE_HEAD_SHA, syntheticDiff);

    // Then: at least 4 inline comments and at least 1 suppressed comment.
    expect(payload.comments.length).toBeGreaterThanOrEqual(4);
    expect(payload.suppressed_comments.length).toBeGreaterThanOrEqual(1);

    // Then: each comment body references one of the diff symbols.
    const symbols = ["alpha", "beta", "gamma"];
    for (const symbol of symbols) {
      const referenced = payload.comments.some((comment) => comment.body.includes(symbol));
      expect(referenced).toBe(true);
    }
  });

  it("is deterministic — repeated calls produce identical payloads", async () => {
    // Given: the canonical full-PR diff fixture.
    const diffText = await readFullPrDiff();

    // When: the fixture is built twice with the same inputs.
    const first = buildSimulatedFindings(FIXTURE_REPO, FIXTURE_PR_NUMBER, FIXTURE_HEAD_SHA, diffText);
    const second = buildSimulatedFindings(FIXTURE_REPO, FIXTURE_PR_NUMBER, FIXTURE_HEAD_SHA, diffText);

    // Then: the payloads match exactly (deterministic for tests).
    expect(second).toEqual(first);
  });

  it("does NOT include the marker or raw JSON in any body", async () => {
    // Given: the canonical full-PR diff fixture.
    const diffText = await readFullPrDiff();

    // When: the fixture is built.
    const payload = buildSimulatedFindings(FIXTURE_REPO, FIXTURE_PR_NUMBER, FIXTURE_HEAD_SHA, diffText);

    // Then: the fixture must never carry the marker (the marker is appended by the
    // GitHub posting layer, not by the fixture).
    const allText = JSON.stringify(payload);
    expect(allText).not.toContain("<!-- umactually-pr-review -->");

    // Then: the fixture must never carry raw provider JSON or a fenced details block.
    expect(allText).not.toMatch(/<details[\s>]/u);
    expect(allText).not.toMatch(/```json/u);
  });
});