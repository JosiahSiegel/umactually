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
      offDiffFromComments: [],
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
      offDiffFromComments: [],
      secrets: [],
    });
    expect(body).toMatch(/\*\*Posted:\*\*\s+`0`\s+inline thread\(s\)/u);
    expect(body).toMatch(/\*\*Considered:\*\*\s+`5`\s+finding\(s\) from model/u);
    expect(body).toMatch(/\*\*Suppressed:\*\*\s+`5`\s+off-diff/u);
    // CLARITY-11: when every finding was filtered (Posted: 0, Considered > 0),
    // the header must re-label to "Filtered findings" so the reader does not
    // mistake "0 posted + N listed" for a clean bill of health.
    expect(body).toMatch(/🔕\s+Filtered findings from model \(5 of 5\)\s+—\s+none reached inline/u);
    expect(body).toMatch(/severity policy.*max-comments.*off-diff suppression/u);
    // Sanity: the OLD misleading "Top concerns" header must NOT appear in this case.
    expect(body).not.toMatch(/📋\s+Top concerns from model \(5 of 5\)/u);
  });

  it("uses 'Top concerns' header (not 'Filtered') when at least one finding landed inline", () => {
    // If validCommentCount > 0, the header is the normal "Top concerns" — the
    // pre-filter preview is a sample of the posted set, not a rejected list.
    const body = buildReviewBody({
      review: {
        summary: "",
        verdict: "COMMENT",
        comments: [
          { path: "src/auth.ts", line: 12, body: "Use bcrypt", severity: "high", category: "security" },
          { path: "src/auth.ts", line: 14, body: "Use bcrypt", severity: "high", category: "security" },
          { path: "src/auth.ts", line: 16, body: "Use bcrypt", severity: "high", category: "security" },
        ],
        suppressedComments: [],
      },
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 3,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      secrets: [],
    });
    expect(body).toMatch(/📋\s+Top concerns from model \(3 of 3\)/u);
    // Filtered-style header must NOT appear when findings landed.
    expect(body).not.toMatch(/🔕\s+Filtered findings from model/u);
  });

  it("renders the three labeled rows even on empty / parse-fail (CLARITY-5 inheritance)", () => {
    const body = buildReviewBody({
      review: { summary: "", verdict: "COMMENT", comments: [], suppressedComments: [] },
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 0,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      secrets: [],
    });
    expect(body).toMatch(/\*\*Posted:\*\*\s+`0`\s+inline thread\(s\)/u);
    expect(body).toMatch(/\*\*Considered:\*\*\s+`0`\s+finding\(s\) from model/u);
    expect(body).toMatch(/\*\*Suppressed:\*\*\s+`0`\s+off-diff/u);
  });

  it("Top concerns preview is sorted by severity desc (highest first)", () => {
    // The reviewer flagged M6OO6Hf: "list content is sorted by
    // severityRank desc — for a payload of mixed severities, the top-5
    // preview will mostly be critical/high". Pin the ordering contract:
    // when comments have mixed severities, the preview shows
    // critical/high/medium/low (in that order) before lower-severity ones.
    const body = buildReviewBody({
      review: {
        summary: "Mixed severities.",
        verdict: "NEEDS_FIX",
        comments: [
          { path: "src/low.ts", line: 1, body: "low finding", severity: "low", category: "general" },
          { path: "src/info.ts", line: 1, body: "info finding", severity: "info", category: "general" },
          { path: "src/critical.ts", line: 1, body: "critical finding", severity: "critical", category: "security" },
          { path: "src/medium.ts", line: 1, body: "medium finding", severity: "medium", category: "general" },
          { path: "src/high.ts", line: 1, body: "high finding", severity: "high", category: "security" },
        ],
        suppressedComments: [],
      },
      provider: "openai-compatible",
      modelId: "auto",
      validCommentCount: 5,
      suppressedCommentCount: 0,
      offDiffFromComments: [],
      secrets: [],
    });
    // Extract the order of paths in the Top concerns block.
    // The block runs from the 📋 header until the closing </details>
    // tag, regardless of intermediate blank lines.
    const topConcernsMatch = body.match(
      /📋\s+Top concerns from model \(5 of 5\)[\s\S]*?<\/details>/u,
    );
    expect(topConcernsMatch).not.toBeNull();
    const topConcernsSection = topConcernsMatch?.[0] ?? "";
    const criticalIdx = topConcernsSection.indexOf("src/critical.ts");
    const highIdx = topConcernsSection.indexOf("src/high.ts");
    const mediumIdx = topConcernsSection.indexOf("src/medium.ts");
    const lowIdx = topConcernsSection.indexOf("src/low.ts");
    const infoIdx = topConcernsSection.indexOf("src/info.ts");
    expect(criticalIdx).toBeGreaterThan(-1);
    expect(criticalIdx).toBeLessThan(highIdx);
    expect(highIdx).toBeLessThan(mediumIdx);
    expect(mediumIdx).toBeLessThan(lowIdx);
    expect(lowIdx).toBeLessThan(infoIdx);
  });
});

