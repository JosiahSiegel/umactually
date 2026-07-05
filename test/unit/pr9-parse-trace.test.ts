import { describe, it, expect } from "vitest";
import { extractJsonBlock } from "../../src/render/json-extract.js";
import { parseReviewPayload, isNonEmptyReview } from "../../src/provider/provider-parse.js";

describe("PR-9 post-fix parse trace", () => {
  it("parses the real 17KB review without firing the empty-review retry path", () => {
    // Pad the summary to ~17,500 bytes to match the 2026-07-05T23:43:45Z
    // self-review run that successfully extracted a real 17,566-byte
    // payload from SSE deltas but then incorrectly fired the parse-fail
    // retry path because isNonEmptyReview returned false.
    const realReview = {
      summary: "This is a very large PR (~5k lines of src/ts + ~5k lines of dist/ bundles + 7 new scripts + 6 new tests). It introduces a 20-layout system for the review summary card, replaces the existing buildReviewBody helper with a severity-table layout, and adds new tests for control-char escaping in the JSON extractor and stub-completed detection in the SSE parser. The cross-platform constraint (no raw `<table>` HTML, no task lists, no fragile Unicode) is respected across all 20 renderers per the S5/S6 tests. No issues — positive note on rendering correctness. ".repeat(30),
      verdict: "NEEDS_FIX",
      comments: [
        { path: "src/cli/live-shared.ts", line: 227, body: "The CLARITY-4 doc-comment section says NO LONGER APPLIES and the surrounding tests assert on the same text — that means the comment was wrong but the tests pass for the wrong reason. Update the comment AND the assertion together (or delete the test if the new behavior intentionally changed).", severity: "high", category: "documentation" },
        { path: "src/cli/live-shared.ts", line: 131, body: "The import `import { renderSummary, type LayoutId, type ReviewData as LayoutReviewData } from \"../../src/render/summary-layouts.js\"` is only used in JSDoc type annotations. The actual import is fine but `LayoutReviewData` is a type-only alias that the layout module does not export — verify it resolves or drop it.", severity: "medium", category: "correctness" },
        { path: "src/provider/openai-compatible.ts", line: 170, body: "DEBUG_SECRET_PATTERNS matches sk_test_[a-z_]+ but real OpenAI/Anthropic API keys are sk-[A-Za-z0-9]{48} and the test fixtures use the latter. Either extend the pattern or add a separate pattern for the production key shape.", severity: "medium", category: "security" },
        { path: "test/unit/summary-layouts.test.ts", line: 428, body: "The cross-cutting invariants test on line ~427 has hardcoded count strings (📊 7 findings → 6 posted, 1 off-diff, 0 filtered) — those will need updating if the busy fixture changes. Consider deriving the expected string from the same data instead of hardcoding.", severity: "medium", category: "correctness" },
      ],
      suppressed_comments: [
        { path: "scripts/resolve-pr-threads.mjs", line: 8, body: "Hardcoded PR_NUMBER = 9 — this is a one-off maintainer tool, but a comment explaining that fact would help reviewers.", severity: "low", category: "code-quality" },
        { path: "src/render/summary-layouts.ts", line: 1582, body: "renderSummary throws when data.postedComments === undefined. The throw message is helpful but the API contract should make postedComments required, not optional-with-throw.", severity: "low", category: "correctness" },
      ],
    };

    const json = JSON.stringify(realReview);
    expect(json.length).toBeGreaterThan(15_000);

    // Step 1: extractJsonBlock should return the object
    const extracted = extractJsonBlock(json);
    expect(extracted).not.toBeNull();
    expect(typeof extracted).toBe("object");

    // Step 2: parseReviewPayload should return a real review
    const review = parseReviewPayload(json);
    expect(review).not.toBeNull();
    expect(review!.summary.length).toBeGreaterThan(0);
    expect(review!.verdict).toBe("NEEDS_FIX");
    expect(review!.comments).toHaveLength(4);
    expect(review!.suppressed_comments).toHaveLength(2);

    // Step 3: isNonEmptyReview should return true (so the retry does NOT fire)
    expect(isNonEmptyReview(review!)).toBe(true);
  });
});
