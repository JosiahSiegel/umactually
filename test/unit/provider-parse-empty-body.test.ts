// SPDX-License-Identifier: MIT
// Failing contract tests for the empty-body soft-fail work:
//
//   Group A — PARSE_FAIL_RETRY_PROMPT must teach the model the FULL
//   comment schema (path, line, body, severity, category) including the
//   non-empty-body requirement, so a retried parse doesn't come back with
//   schema-valid-but-empty finding bodies.
//
//   Group B — two shared pure predicates that decide when a parsed review
//   consists solely of findings whose bodies are empty/whitespace:
//     - hasOnlyEmptyBodyFindings(review): comments.length > 0 && every
//       body.trim() === "" (suppressed_comments excluded — a clean
//       0-finding review with populated suppressed output must NOT
//       trigger the soft-fail path).
//     - countPopulatedBodies(review): how many comment bodies carry
//       non-whitespace text.
//
// These tests are RED until the T6 (retry prompt) and T8 (predicates)
// implementations land. Until the helpers are exported, the optional-
// property lookups resolve to undefined, so every predicate assertion
// fails as an assertion mismatch — not a compile error — keeping
// `npm run typecheck` green while the contract is pinned.

import { PARSE_FAIL_RETRY_PROMPT } from "../../src/provider/provider-parse.js";
import type { ProviderComment, ProviderReviewPayload } from "../../src/provider/provider-parse.js";
import * as providerParse from "../../src/provider/provider-parse.js";

// The helpers are introduced by T8. Access them through a namespace cast
// with optional signatures so this file compiles (strict mode) before the
// exports exist; `typeof` checks below pin their existence.
const emptyBodyExports = providerParse as unknown as {
  readonly hasOnlyEmptyBodyFindings?: (review: ProviderReviewPayload) => boolean;
  readonly countPopulatedBodies?: (review: ProviderReviewPayload) => number;
};

const hasOnlyEmptyBodyFindings = emptyBodyExports.hasOnlyEmptyBodyFindings;
const countPopulatedBodies = emptyBodyExports.countPopulatedBodies;

function comment(body: string): ProviderComment {
  return { path: "src/example.ts", line: 1, body, severity: "medium", category: "correctness" };
}

function review(
  comments: readonly ProviderComment[],
  suppressedComments: readonly ProviderComment[] = [],
): ProviderReviewPayload {
  return {
    summary: "Populated summary — review completed.",
    verdict: "COMMENT",
    comments,
    suppressed_comments: suppressedComments,
  };
}

// ---------------------------------------------------------------------------
// Group A — retry prompt completeness (T6 contract)
// ---------------------------------------------------------------------------

describe("PARSE_FAIL_RETRY_PROMPT — full comment-schema completeness", () => {
  const requiredSubstrings: readonly string[] = [
    "path",
    "line",
    "body",
    "severity",
    "category",
    "must be a non-empty string",
  ];

  for (const substring of requiredSubstrings) {
    it(`retry prompt mentions "${substring}"`, () => {
      expect(PARSE_FAIL_RETRY_PROMPT).toContain(substring);
    });
  }
});

// ---------------------------------------------------------------------------
// Group B — shared soft-fail predicates (T8 contract)
// ---------------------------------------------------------------------------

describe("hasOnlyEmptyBodyFindings — all-empty-bodies trigger (suppressed excluded)", () => {
  it("exports hasOnlyEmptyBodyFindings as a function", () => {
    expect(typeof hasOnlyEmptyBodyFindings).toBe("function");
  });

  const cases: ReadonlyArray<{
    readonly label: string;
    readonly reviewPayload: ProviderReviewPayload;
    readonly expected: boolean;
  }> = [
    {
      label: "empty comments + populated summary → false (vacuous-truth guard: clean 0-finding review)",
      reviewPayload: review([]),
      expected: false,
    },
    {
      label: 'all comments body "" → true',
      reviewPayload: review([comment(""), comment("")]),
      expected: true,
    },
    {
      label: 'all comments body "   " (whitespace) → true',
      reviewPayload: review([comment("   "), comment(" \t ")], []),
      expected: true,
    },
    {
      label: "mixed: one populated + two empty → false",
      reviewPayload: review([comment("real finding"), comment(""), comment("   ")]),
      expected: false,
    },
    {
      label: "all populated → false",
      reviewPayload: review([comment("first"), comment("second")]),
      expected: false,
    },
    {
      label: "all-empty comments + populated suppressed_comments → true (suppressed excluded from trigger)",
      reviewPayload: review([comment(""), comment("   ")], [comment("suppressed finding")]),
      expected: true,
    },
    {
      label: "comment with body:null (defense-in-depth coerce) → true",
      reviewPayload: {
        ...review([]),
        comments: [{ path: "src/example.ts", line: 1, body: null, severity: "medium", category: "correctness" } as unknown as ProviderComment],
      },
      expected: true,
    },
    {
      label: "comment with body:undefined (defense-in-depth coerce) → true",
      reviewPayload: {
        ...review([]),
        comments: [{ path: "src/example.ts", line: 1, body: undefined, severity: "medium", category: "correctness" } as unknown as ProviderComment],
      },
      expected: true,
    },
  ];

  for (const c of cases) {
    it(`${c.label} → ${c.expected}`, () => {
      expect(hasOnlyEmptyBodyFindings?.(c.reviewPayload)).toBe(c.expected);
    });
  }
});

describe("countPopulatedBodies — non-whitespace body counter", () => {
  it("exports countPopulatedBodies as a function", () => {
    expect(typeof countPopulatedBodies).toBe("function");
  });

  const cases: ReadonlyArray<{
    readonly label: string;
    readonly reviewPayload: ProviderReviewPayload;
    readonly expected: number;
  }> = [
    {
      label: "no comments → 0",
      reviewPayload: review([]),
      expected: 0,
    },
    {
      label: "3 comments all populated → 3",
      reviewPayload: review([comment("one"), comment("two"), comment("three")]),
      expected: 3,
    },
    {
      label: "3 comments all empty → 0",
      reviewPayload: review([comment(""), comment(""), comment("")]),
      expected: 0,
    },
    {
      label: "mixed: 1 populated + 2 empty → 1",
      reviewPayload: review([comment(""), comment("only real one"), comment("   ")]),
      expected: 1,
    },
    {
      label: "whitespace-only body counts as empty → 0",
      reviewPayload: review([comment("   ")]),
      expected: 0,
    },
    {
      label: "comment with body:null counts as empty (defense-in-depth coerce) → 0",
      reviewPayload: {
        ...review([]),
        comments: [{ path: "src/example.ts", line: 1, body: null, severity: "medium", category: "correctness" } as unknown as ProviderComment],
      },
      expected: 0,
    },
    {
      label: "comment with body:undefined counts as empty (defense-in-depth coerce) → 0",
      reviewPayload: {
        ...review([]),
        comments: [{ path: "src/example.ts", line: 1, body: undefined, severity: "medium", category: "correctness" } as unknown as ProviderComment],
      },
      expected: 0,
    },
  ];

  for (const c of cases) {
    it(`${c.label} → ${c.expected}`, () => {
      expect(countPopulatedBodies?.(c.reviewPayload)).toBe(c.expected);
    });
  }
});
