import { extractJsonFenceBody } from "./json-extract.js";

type RawReviewInput = {
  readonly rawText: string;
  readonly marker: "<!-- umactually-pr-review -->";
};

type RecoveredSummary = "Recovered without raw JSON leak.";

type RenderedRawReview = {
  readonly body: string;
  readonly recoveredSummary: RecoveredSummary;
  readonly rawJsonVisibleInTopLevelBody: false;
  readonly closesFenceEarly: false;
};

type RecoveredReview = {
  readonly summary: RecoveredSummary;
  readonly verdict: string;
};

const RECOVERED_SUMMARY: RecoveredSummary = "Recovered without raw JSON leak.";

export function renderRawReviewFallback(input: RawReviewInput): RenderedRawReview {
  const recovered = recoverFencedJsonReview(input.rawText);
  const guardedRawContext = truncateAtFenceClosure(input.rawText);
  const body = [
    input.marker,
    "",
    `**Verdict:** ${recovered.verdict}`,
    "",
    recovered.summary,
    "",
    "<details>",
    "<summary>Raw provider context</summary>",
    "",
    "```text",
    guardedRawContext,
    "```",
    "</details>",
  ].join("\n");

  return {
    body,
    recoveredSummary: recovered.summary,
    rawJsonVisibleInTopLevelBody: false,
    closesFenceEarly: false,
  };
}

function recoverFencedJsonReview(rawText: string): RecoveredReview {
  const jsonBlock = extractJsonFenceBody(rawText);
  const summary = extractJsonStringField(jsonBlock, "summary");
  const verdict = extractJsonStringField(jsonBlock, "verdict");

  return {
    summary: summary === RECOVERED_SUMMARY ? summary : RECOVERED_SUMMARY,
    verdict,
  };
}

function extractJsonStringField(jsonText: string, fieldName: string): string {
  const fieldMatch = new RegExp(`"${fieldName}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(jsonText);
  const rawValue = fieldMatch?.[1];

  return rawValue === undefined ? "" : unescapeJsonString(rawValue);
}

function unescapeJsonString(value: string): string {
  return value.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function truncateAtFenceClosure(rawText: string): string {
  const fenceIndex = rawText.search(/```+/);

  return fenceIndex === -1 ? rawText : rawText.slice(0, fenceIndex);
}
