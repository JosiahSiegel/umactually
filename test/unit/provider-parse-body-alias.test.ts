// SPDX-License-Identifier: MIT
// Body-key alias tolerance contract for readCommentArray (driven through
// the exported parseReviewPayload — readCommentArray is private).
//
// Providers occasionally emit the finding text under a synonym of `body`
// (`description`, `message`, `comment`, `issue`, `detail`). The parser
// currently only reads `body`, so those findings land with an empty body
// and post as empty inline comments.
//
// Contract under test (T7 target):
//   Alias order: body → description → message → comment → issue → detail
//   Fallthrough ONLY when `body` is missing or trim-empty — a populated
//   `body` always wins outright.
//
// These tests pin the target behavior: the alias cases FAIL until T7
// implements the fallback chain. The body-wins and no-body-no-alias cases
// pin current behavior so the implementation cannot regress them.

import { describe, expect, it } from "vitest";
import { parseReviewPayload } from "../../src/provider/provider-parse.js";

/** Build a single comment entry with a fixed anchor + caller overrides. */
function comment(entry: Record<string, unknown>): Record<string, unknown> {
  return {
    path: "src/a.ts",
    line: 1,
    severity: "medium",
    category: "style",
    ...entry,
  };
}

/** Wrap comment entries into the JSON payload string production parses. */
function payloadFor(...comments: readonly Record<string, unknown>[]): string {
  return JSON.stringify({
    summary: "ok",
    verdict: "COMMENT",
    comments,
    suppressed_comments: [],
  });
}

/** Parse and return comments[0].body, failing loudly if shape is wrong. */
function firstBody(payload: string): string {
  const review = parseReviewPayload(payload);
  expect(review).not.toBeNull();
  expect(review!.comments.length).toBeGreaterThan(0);
  return review!.comments[0]!.body;
}

// ---------------------------------------------------------------------------
// 1. Single alias cases: the comment has ONLY the alias key (no `body`).
//    The parser should populate `body` from the alias value.
// ---------------------------------------------------------------------------

describe("parseReviewPayload — body-key alias fallback (single alias)", () => {
  const aliasCases: ReadonlyArray<{
    readonly alias: string;
    readonly text: string;
  }> = [
    { alias: "description", text: "fix the typo in the variable name" },
    { alias: "message", text: "this loop can never terminate" },
    { alias: "comment", text: "the config value is read but never used" },
    { alias: "issue", text: "unhandled promise rejection on this line" },
    { alias: "detail", text: "prefer const over let for this binding" },
  ];

  for (const c of aliasCases) {
    it(`populates body from '${c.alias}' when 'body' is absent`, () => {
      const payload = payloadFor(comment({ [c.alias]: c.text }));
      expect(firstBody(payload)).toBe(c.text);
    });
  }
});

// ---------------------------------------------------------------------------
// 2. Precedence cases: `body` wins when populated; fallthrough only when
//    missing or trim-empty; first alias in the order wins when several
//    are present.
// ---------------------------------------------------------------------------

describe("parseReviewPayload — body-key alias precedence", () => {
  it("populated 'body' wins over 'description' alias", () => {
    const payload = payloadFor(
      comment({ body: "real", description: "alias" }),
    );
    expect(firstBody(payload)).toBe("real");
  });

  it("empty-string 'body' falls through to 'description' alias", () => {
    const payload = payloadFor(comment({ body: "", description: "x" }));
    expect(firstBody(payload)).toBe("x");
  });

  it("whitespace-only 'body' falls through to 'issue' alias", () => {
    const payload = payloadFor(comment({ body: "  ", issue: "y" }));
    expect(firstBody(payload)).toBe("y");
  });

  it("empty 'body' with all 5 aliases present → first in order ('description') wins", () => {
    const payload = payloadFor(
      comment({
        body: "",
        description: "first-alias",
        message: "second-alias",
        comment: "third-alias",
        issue: "fourth-alias",
        detail: "fifth-alias",
      }),
    );
    expect(firstBody(payload)).toBe("first-alias");
  });
});

// ---------------------------------------------------------------------------
// 3. Regression pin: no `body` key and no alias keys at all → body stays
//    empty (current behavior must be preserved, not crash or invent text).
// ---------------------------------------------------------------------------

describe("parseReviewPayload — no body and no alias (regression pin)", () => {
  it("comment with only path/line/severity/category → body === ''", () => {
    const payload = payloadFor(
      comment({}), // path/line/severity/category only
    );
    expect(firstBody(payload)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// 4. Multiple comments with mixed alias usage — each comment resolves its
//    own body independently.
// ---------------------------------------------------------------------------

describe("parseReviewPayload — mixed alias usage across comments", () => {
  it("comment[0] uses body, comment[1] uses description, comment[2] uses issue", () => {
    const payload = payloadFor(
      comment({ path: "src/a.ts", line: 1, body: "body-text" }),
      comment({ path: "src/b.ts", line: 2, description: "description-text" }),
      comment({ path: "src/c.ts", line: 3, issue: "issue-text" }),
    );
    const review = parseReviewPayload(payload);
    expect(review).not.toBeNull();
    expect(review!.comments.length).toBe(3);
    expect(review!.comments[0]!.body).toBe("body-text");
    expect(review!.comments[1]!.body).toBe("description-text");
    expect(review!.comments[2]!.body).toBe("issue-text");
  });
});
