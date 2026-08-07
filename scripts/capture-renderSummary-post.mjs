// scripts/capture-renderSummary-post.mjs — post-purge byte-identity capture.
// Deleted after F1 verifies byte-identity (no need to ship this).
// Run with: bun scripts/capture-renderSummary-post.mjs > <post file>
import { renderSummary } from "../src/render/summary-layouts.ts";

const SAMPLE = {
  review: {
    summary: "Reviewed the auth refactor in this PR. Two blockers (hardcoded secret, leaked connection), one reliability issue, and a couple of minor style nits.",
    verdict: "NEEDS_FIX",
    comments: [
      { path: "src/auth.ts", line: 34, body: "Hardcoded signing secret.", severity: "critical", category: "security" },
      { path: "src/db.ts", line: 88, body: "Connection leak.", severity: "critical", category: "bug" },
      { path: "src/api.ts", line: 201, body: "Unhandled promise rejection.", severity: "high", category: "reliability" },
      { path: "src/util.ts", line: 14, body: "Cyclomatic complexity 18.", severity: "medium", category: "maintainability" },
      { path: "src/index.ts", line: 5, body: "Missing JSDoc.", severity: "low", category: "style" },
      { path: "README.md", line: 1, body: "Trailing whitespace.", severity: "low", category: "style" },
    ],
    suppressedComments: [
      { path: "src/legacy/sessions.ts", line: 142, body: "Outdated comment.", severity: "low", category: "style" },
    ],
  },
  provider: "openai-compatible",
  modelId: "claude-opus-4-5",
  validCommentCount: 6,
  suppressedCommentCount: 1,
  severityCounts: { critical: 2, high: 1, medium: 1, low: 2 },
  offDiffFromComments: [],
  postedComments: [],
  secrets: [],
};

process.stdout.write(renderSummary(SAMPLE));
