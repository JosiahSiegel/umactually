// Pins the SSE-streaming parser's coverage of the OpenAI Responses API
// format (response.output_text.delta, response.completed), which is the
// format that produced a 0-finding fallback review on PR #3. The
// previous parser only knew about chat-completions delta.content and
// a top-level delta string — neither matched the Responses API shape.
import { describe, expect, it } from "vitest";

import {
  buildResponsesBody,
  extractTextPayload,
  parseReviewPayload,
  type ProviderReviewPayload,
} from "../../src/provider/provider-parse.js";

describe("extractTextPayload: SSE streaming coverage", () => {
  it("parses the OpenAI Responses API streaming format (response.output_text.delta)", () => {
    // This is the exact shape the opencode/MiniMax model returned
    // against PR #3 — fragment events wrapped in a {type, delta}
    // envelope with `type: "response.output_text.delta"`. The parser
    // must accumulate the per-fragment `delta` strings into a single
    // text payload so parseReviewPayload can extract the review JSON.
    const sse =
      'event: response.created\n' +
      'data: {"type":"response.created","response":{"id":"resp_1","status":"in_progress","output":[]}}\n' +
      '\n' +
      'event: response.output_text.delta\n' +
      `data: {"type":"response.output_text.delta","delta":${JSON.stringify('{"summary":"all clean", "verdict":"APPROVED", "comments":[], "suppressed_comments":[]}')}}\n` +
      '\n' +
      'event: response.completed\n' +
      'data: {"type":"response.completed","response":{"id":"resp_1","status":"completed"}}\n';
    const text = extractTextPayload("responses", sse);
    expect(text).toBe('{"summary":"all clean", "verdict":"APPROVED", "comments":[], "suppressed_comments":[]}');
  });

  it("prefers the final response.completed output_text over accumulated deltas", () => {
    // Some providers (notably those that wrap Responses API streaming
    // weirdly) only send the final event with output_text and skip the
    // per-fragment deltas. We should prefer the completed response's
    // full text over fragment accumulation.
    const completedResponse = {
      type: "response.completed",
      response: {
        id: "resp_2",
        status: "completed",
        output_text: '{"summary":"full output from completed event","verdict":"NEEDS_FIX","comments":[],"suppressed_comments":[]}',
      },
    };
    const sse =
      'event: response.created\n' +
      `data: ${JSON.stringify(completedResponse)}\n`;
    const text = extractTextPayload("responses", sse);
    expect(text).toBe(completedResponse.response.output_text);
  });

  it("falls back to the output[] array join when response.completed has no output_text", () => {
    const sse =
      'event: response.completed\n' +
      'data: {"type":"response.completed","response":{"id":"resp_3","output":[{"content":[{"text":"joined"}]}]}}\n';
    const text = extractTextPayload("responses", sse);
    expect(text).toBe("joined");
  });

  it("returns the raw SSE text when only metadata events are present (CLARITY-10 lets the strict empty-fields check handle it)", () => {
    // Pure metadata events, no output_text delta or response.completed.
    // This is the failure mode that hit PR #3. extractTextPayload
    // returns the raw SSE text so the downstream strict empty-fields
    // check (CLARITY-10) can fire as a parse failure — NOT as a
    // 0-finding review.
    const sse =
      'event: response.created\n' +
      'data: {"type":"response.created","response":{"id":"resp_4","status":"in_progress","output":[]}}\n';
    const text = extractTextPayload("responses", sse);
    expect(text).toBe(sse);
  });
});

describe("parseReviewPayload + end-to-end SSE → review payload", () => {
  it("extracts the review payload from a Responses API SSE stream", () => {
    const review = {
      summary: "Found one issue.",
      verdict: "NEEDS_FIX",
      comments: [
        { path: "src/auth.ts", line: 12, body: "Use bcrypt.", severity: "high", category: "security" },
      ],
      suppressed_comments: [],
    };
    const sse =
      'event: response.output_text.delta\n' +
      `data: {"type":"response.output_text.delta","delta":${JSON.stringify(JSON.stringify(review))}}\n` +
      '\n' +
      'event: response.completed\n' +
      'data: {"type":"response.completed","response":{"id":"resp_5","status":"completed"}}\n';
    const text = extractTextPayload("responses", sse);
    expect(text).not.toBeNull();
    const payload: ProviderReviewPayload | null = parseReviewPayload(text!);
    expect(payload).not.toBeNull();
    expect(payload?.summary).toBe("Found one issue.");
    expect(payload?.verdict).toBe("NEEDS_FIX");
    expect(payload?.comments).toHaveLength(1);
    expect(payload?.comments[0]?.path).toBe("src/auth.ts");
    expect(payload?.comments[0]?.severity).toBe("high");
  });

  it("returns the raw SSE text when only metadata events are present in a stream with response.completed (CLARITY-10)", () => {
    const sse =
      'event: response.created\n' +
      'data: {"type":"response.created","response":{"id":"resp_6","status":"in_progress","output":[]}}\n' +
      '\n' +
      'event: response.completed\n' +
      'data: {"type":"response.completed","response":{"id":"resp_6","status":"completed","output":[]}}\n';
    const text = extractTextPayload("responses", sse);
    // Returns the raw SSE text — CLARITY-10 strict empty-fields check
    // is responsible for catching this as a parse failure.
    expect(text).toBe(sse);
  });
});

describe("buildResponsesBody: self-healing retry override", () => {
  it("accepts a userOverride that replaces the user message", () => {
    const body = buildResponsesBody(
      {
        model: "auto",
        system: "you are a reviewer",
        user: "review this diff",
      },
      { userOverride: "Please output JSON only" },
    );
    const input = body["input"] as ReadonlyArray<{ readonly role: string; readonly content: string }>;
    expect(input[1]?.content).toBe("Please output JSON only");
    expect(input[0]?.content).toBe("you are a reviewer");
  });

  it("falls back to the original user message when no override is supplied", () => {
    const body = buildResponsesBody({
      model: "auto",
      system: "you are a reviewer",
      user: "review this diff",
    });
    const input = body["input"] as ReadonlyArray<{ readonly role: string; readonly content: string }>;
    expect(input[1]?.content).toBe("review this diff");
  });
});

describe("parseReviewPayload: soft parse-fail detector (CLARITY-10b)", () => {
  // Pins the soft parse-fail detector that catches "model returned valid
  // JSON but the content is an apology" responses. Without this, the
  // 3e62237 self-review on PR #3 produced a `Posted: 0, Considered: 0`
  // review with the summary "No diff or file contents were provided to
  // review..." — structurally valid JSON, zero findings, looked like
  // a clean bill of health, but the model had actually failed to review.

  it("returns null when summary is the 'no diff or file contents' apology AND zero findings", () => {
    const apologyPayload = JSON.stringify({
      summary: "No diff or file contents were provided to review. Please share the pull request diff or the changed files so I can produce a review.",
      verdict: "comment",
      comments: [],
      suppressed_comments: [],
    });
    expect(parseReviewPayload(apologyPayload)).toBeNull();
  });

  it("returns null when summary says 'please share the diff' AND zero findings", () => {
    const apologyPayload = JSON.stringify({
      summary: "I cannot review without a diff. Please share the pull request diff.",
      verdict: "comment",
      comments: [],
      suppressed_comments: [],
    });
    expect(parseReviewPayload(apologyPayload)).toBeNull();
  });

  it("returns null when summary says 'I am unable to review' AND zero findings", () => {
    const apologyPayload = JSON.stringify({
      summary: "I'm unable to review this pull request because no diff was supplied.",
      verdict: "comment",
      comments: [],
      suppressed_comments: [],
    });
    expect(parseReviewPayload(apologyPayload)).toBeNull();
  });

  it("returns null when summary says 'empty diff' AND zero findings", () => {
    const apologyPayload = JSON.stringify({
      summary: "The diff is empty, nothing to review.",
      verdict: "comment",
      comments: [],
      suppressed_comments: [],
    });
    expect(parseReviewPayload(apologyPayload)).toBeNull();
  });

  it("DOES NOT trigger when summary is a legitimate clean-review signal (no findings, non-apology summary)", () => {
    const cleanReview = JSON.stringify({
      summary: "All clean. No issues found.",
      verdict: "APPROVED",
      comments: [],
      suppressed_comments: [],
    });
    expect(parseReviewPayload(cleanReview)).not.toBeNull();
  });

  it("DOES NOT trigger when there ARE findings, even with an apologetic-sounding summary", () => {
    // A real review that includes findings but whose summary is frustrated
    // is legitimate. We only flag zero-finding reviews as soft parse-fail.
    const frustratedButRealReview = JSON.stringify({
      summary: "I cannot review the full PR but I can see one critical issue.",
      verdict: "NEEDS_FIX",
      comments: [
        { path: "src/auth.ts", line: 12, body: "Use bcrypt.", severity: "high", category: "security" },
      ],
      suppressed_comments: [],
    });
    const result = parseReviewPayload(frustratedButRealReview);
    expect(result).not.toBeNull();
    expect(result?.comments).toHaveLength(1);
  });

  it("DOES NOT trigger when summary is empty (the strict-check already covers that case)", () => {
    const emptySummary = JSON.stringify({
      summary: "",
      verdict: "comment",
      comments: [],
      suppressed_comments: [],
    });
    // Empty summary is caught by the strict empty-fields check at the
    // caller (line 164 of openai-compatible.ts) — not by the apology
    // detector. parseReviewPayload returns the parsed object either way.
    const result = parseReviewPayload(emptySummary);
    expect(result).not.toBeNull();
    expect(result?.summary).toBe("");
  });

  it("DOES NOT trigger when summary describes a finding with apology-like language", () => {
    // "I cannot find any issues" is a legitimate clean-review summary
    // — it has the word "cannot" but the intent is "I cannot find any",
    // not "I cannot review because no input". The detector should not
    // over-match.
    const noIssuesFound = JSON.stringify({
      summary: "I cannot find any issues with this change. Looks good to merge.",
      verdict: "APPROVED",
      comments: [],
      suppressed_comments: [],
    });
    const result = parseReviewPayload(noIssuesFound);
    expect(result).not.toBeNull();
    expect(result?.verdict).toBe("APPROVED");
  });

  it("DOES NOT trigger on 'I cannot recall' — pattern requires 'review' + object after the verb", () => {
    // Tightened regex: requires the verb (cannot/can't/etc.) to be
    // immediately followed by 'review' + a determiner (this/it/the/a/that).
    // 'I cannot recall' should NOT match because 'recall' is not 'review'.
    const summary = JSON.stringify({
      summary: "I cannot recall what the issue was. Approving this change.",
      verdict: "APPROVED",
      comments: [],
      suppressed_comments: [],
    });
    expect(parseReviewPayload(summary)).not.toBeNull();
  });

  it("DOES NOT trigger on 'I cannot review this' — wait, this IS an apology. Confirm match.", () => {
    // "I cannot review this" is the canonical apology pattern.
    // Tightened regex now matches this.
    const apology = JSON.stringify({
      summary: "I cannot review this without the diff being provided.",
      verdict: "comment",
      comments: [],
      suppressed_comments: [],
    });
    expect(parseReviewPayload(apology)).toBeNull();
  });

  it("DOES NOT trigger on 'I cannot review it' (alternate object pronoun)", () => {
    const apology = JSON.stringify({
      summary: "I cannot review it because there's no diff to look at.",
      verdict: "comment",
      comments: [],
      suppressed_comments: [],
    });
    expect(parseReviewPayload(apology)).toBeNull();
  });
});

