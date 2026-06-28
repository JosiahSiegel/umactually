import { parseDiffPositions, type DiffPositionIndex } from "../diff/parse-positions.js";
import type { ProviderReviewPayload } from "../provider/provider-parse.js";

/**
 * Deterministic fixture used by `simulate-findings` to exercise the full
 * render + post path when the live provider returns structurally empty output.
 *
 * The fixture:
 * - parses the real PR diff with `parseDiffPositions` to anchor every inline
 *   comment on a real diff line,
 * - mixes severities (high/medium/low) and categories (security, style,
 *   correctness, performance) across at least two files,
 * - ships 1-2 suppressed_comments entries that deliberately reference lines
 *   NOT in the diff so the suppression path is exercised,
 * - never embeds the review marker, raw provider JSON, fenced details blocks,
 *   or API keys — the marker is appended by the GitHub posting layer.
 */
export function buildSimulatedFindings(
  repo: string,
  prNumber: number,
  headSha: string,
  diffText: string,
): ProviderReviewPayload {
  const positions: DiffPositionIndex = parseDiffPositions(diffText);

  const inlineBlueprints: ReadonlyArray<SimulatedFindingBlueprint> = [
    {
      path: "src/review/example.ts",
      line: 2,
      severity: "high",
      category: "security",
      body: "`renderReview` embeds a synthetic test secret literal (`syntheticSecret`) into the returned string. Move the value into a fixture-only constant and confirm the redactor drops it before posting.",
    },
    {
      path: "src/review/example.ts",
      line: 3,
      severity: "medium",
      category: "correctness",
      body: "`renderReview` returns the template-literal and the boolean flag is exported without a guarantee that downstream consumers will gate it. Validate the call sites in `dispatchLive` before relying on the new shape.",
    },
    {
      path: "src/review/example.ts",
      line: 4,
      severity: "low",
      category: "style",
      body: "The trailing blank line export (`export const changedLine = true;`) lacks a preceding blank line convention. Reformat to keep the trailing region grouped with the function body.",
    },
    {
      path: "src/review/example.ts",
      line: 5,
      severity: "medium",
      category: "performance",
      body: "Re-running `renderReview` per render path allocates a new template-literal each time. Memoize the constant output once the function body stabilizes to keep hot paths cheap.",
    },
    {
      path: "docs/review.md",
      line: 4,
      severity: "medium",
      category: "performance",
      body: "The new reviewer-guidance line should link to the existing per-finding severity table to avoid forcing readers to scroll. Adding the anchor inline is cheap and reduces backtracking.",
    },
    {
      path: "docs/review.md",
      line: 3,
      severity: "low",
      category: "style",
      body: "Consider wrapping `Existing text.` in a numbered list so the new guidance line stays semantically grouped instead of being a one-line afterthought.",
    },
  ];

  const comments: Array<ProviderReviewPayload["comments"][number]> = [];
  for (const blueprint of inlineBlueprints) {
    if (positions.hasPosition(blueprint)) {
      comments.push({ ...blueprint });
    }
    if (comments.length >= 6) {
      break;
    }
  }

  // Suppressed off-diff entries deliberately reference paths/lines that are
  // NOT present in the diff so the suppression-counting path is exercised.
  const suppressedBlueprints: ReadonlyArray<SimulatedFindingBlueprint> = [
    {
      path: "src/review/example.ts",
      line: 999,
      severity: "medium",
      category: "correctness",
      body: "Older comment that referenced `renderReview` is suppressed because the diff no longer contains that line.",
    },
    {
      path: "src/review/legacy.ts",
      line: 12,
      severity: "low",
      category: "style",
      body: "Suppressed because `src/review/legacy.ts` is not part of the PR diff.",
    },
  ];

  const suppressed_comments: Array<ProviderReviewPayload["suppressed_comments"][number]> = [];
  for (const blueprint of suppressedBlueprints) {
    if (!positions.hasPosition(blueprint)) {
      suppressed_comments.push({ ...blueprint });
    }
    if (suppressed_comments.length >= 2) {
      break;
    }
  }

  return {
    summary:
      `Simulated review for ${repo}#${prNumber} at ${headSha}. ` +
      `${comments.length} inline findings, ${suppressed_comments.length} suppressed off-diff.`,
    verdict: "NEEDS_FIX",
    comments,
    suppressed_comments,
  };
}

type SimulatedFindingBlueprint = {
  readonly path: string;
  readonly line: number;
  readonly severity: string;
  readonly category: string;
  readonly body: string;
};
