// Pins the new CLARITY-9 contract: the parent card explicitly labels
// three independent counts (posted / considered / suppressed) so the
// reader can never confuse the model's pre-filter output with what was
// actually posted.
//
// The "all info + off-diff" scenario is the one that surfaced the bug:
// under the old layout the counts line showed "0 critical · 0 high ·
// 0 medium · 0 low · 5 suppressed" while the Top concerns list showed
// 5 items, which read as contradictory.
import { describe, expect, it } from "vitest";

import { buildReviewBody } from "../../src/cli/live-shared.js";

describe("CLARITY-9: parent card posts three labeled counts", () => {
  it("renders explicit Posted / Considered / Suppressed labels", () => {
    const body = buildReviewBody({
      review: {
        summary: "Three issues need attention before merge.",
        verdict: "NEEDS_FIX",
        comments: [
          { path: "src/auth.ts", line: 12, body: "Use bcrypt.", severity: "high", category: "security" },
          { path: "src/db.ts", line: 7, body: "Add timeout.", severity: "medium", category: "maintainability" },
          { path: "README.md", line: 42, body: "Update example.", severity: "low", category: "docs" },
        ],
        suppressedComments: [
          { path: "src/old.ts", line: 3, body: "Legacy.", severity: "low", category: "general" },
        ],
      },
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 3,
      suppressedCommentCount: 1,
      secrets: [],
    });
    expect(body).toMatch(/\*\*Posted:\*\*\s+`3`\s+inline thread\(s\)/u);
    expect(body).toMatch(/\*\*Considered:\*\*\s+`3`\s+finding\(s\) from model/u);
    expect(body).toMatch(/\*\*Suppressed:\*\*\s+`1`\s+off-diff/u);
  });

  it("makes the all-info+off-diff scenario unambiguous", () => {
    // All 5 model findings are info-severity AND off-diff → 0 posted, 5 considered, 5 suppressed.
    const body = buildReviewBody({
      review: {
        summary: "",
        verdict: "COMMENT",
        comments: [
          { path: "dist/cli.js", line: 451, body: "Bundled output", severity: "info", category: "build" },
          { path: "dist/cli.js", line: 453, body: "Bundled output", severity: "info", category: "build" },
          { path: "dist/index.js", line: 449, body: "Bundled output", severity: "info", category: "build" },
          { path: "artifacts/manual/s4-azure-mocked-run.json", line: 5, body: "Manual fixture", severity: "info", category: "test" },
          { path: "artifacts/manual/s6-sonar-mocked-run.json", line: 26, body: "Manual fixture", severity: "info", category: "test" },
        ],
        suppressedComments: [],
      },
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 5,
      secrets: [],
    });
    expect(body).toMatch(/\*\*Posted:\*\*\s+`0`\s+inline thread\(s\)/u);
    expect(body).toMatch(/\*\*Considered:\*\*\s+`5`\s+finding\(s\) from model/u);
    expect(body).toMatch(/\*\*Suppressed:\*\*\s+`5`\s+off-diff/u);
    // The Top concerns header must label itself as pre-filter so the reader
    // knows this is the model's output (5 of 5), NOT the posted set (0).
    expect(body).toMatch(/📋\s+Top concerns from model \(5 of 5\)/u);
  });

  it("renders the three labeled rows even on empty / parse-fail (CLARITY-5 inheritance)", () => {
    const body = buildReviewBody({
      review: { summary: "", verdict: "COMMENT", comments: [], suppressedComments: [] },
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 0,
      secrets: [],
    });
    expect(body).toMatch(/\*\*Posted:\*\*\s+`0`\s+inline thread\(s\)/u);
    expect(body).toMatch(/\*\*Considered:\*\*\s+`0`\s+finding\(s\) from model/u);
    expect(body).toMatch(/\*\*Suppressed:\*\*\s+`0`\s+off-diff/u);
  });
});