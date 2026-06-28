import { parseDiffPositions, type DiffPosition, type DiffPositionIndex } from "../diff/parse-positions.js";
import type { ProviderReviewPayload } from "../provider/provider-parse.js";
import {
  extractRepresentativeToken,
  readDiffLine,
} from "./diff-line-utils.js";

/**
 * Deterministic fixture used by `simulate-findings` to exercise the full
 * render + post path when the live provider returns structurally empty output.
 *
 * The fixture:
 * - parses the real PR diff with `parseDiffPositions` and enumerates the
 *   right-side positions to anchor every inline comment on a real diff line,
 * - mixes severities (high/medium/low) and categories (security, style,
 *   correctness, performance) across at least two files,
 * - extracts a representative token from the diff line (or path) so each
 *   finding body references real code rather than a hard-coded example,
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
  const enumerated: ReadonlyArray<DiffPosition> = positions.enumerate();

  const inlineBlueprints: ReadonlyArray<SimulatedFindingBlueprint> = buildDiverseBlueprints(
    enumerated,
    diffText,
  );

  const comments: Array<ProviderReviewPayload["comments"][number]> = [];
  for (const blueprint of inlineBlueprints) {
    if (positions.hasPosition(blueprint)) {
      comments.push({ ...blueprint });
    }
    if (comments.length >= MAX_INLINE) {
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
      body: "Older comment that referenced a removed line is suppressed because the diff no longer contains that position.",
    },
    {
      path: "src/legacy/never-existed.ts",
      line: 1,
      severity: "low",
      category: "style",
      body: "Suppressed because `src/legacy/never-existed.ts` is not part of the PR diff and no longer ships in the tree.",
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

const MAX_INLINE = 6;

const SEVERITY_PALETTE: ReadonlyArray<string> = ["high", "medium", "low"];
const CATEGORY_PALETTE: ReadonlyArray<string> = [
  "security",
  "correctness",
  "style",
  "performance",
];

type SimulatedFindingBlueprint = {
  readonly path: string;
  readonly line: number;
  readonly severity: string;
  readonly category: string;
  readonly body: string;
};

/**
 * Pick up to `MAX_INLINE` positions from the enumerated diff, ensuring at
 * least one anchor per distinct file so findings span multiple paths and
 * severities/categories cycle through their palettes.
 *
 * Strategy: take the first position from each unique file (in diff order)
 * to guarantee path diversity, then top up with additional positions from
 * earlier paths until the cap is reached.
 */
function buildDiverseBlueprints(
  enumerated: ReadonlyArray<DiffPosition>,
  diffText: string,
): ReadonlyArray<SimulatedFindingBlueprint> {
  const picked: Array<DiffPosition> = [];
  const seenPaths = new Set<string>();
  for (const position of enumerated) {
    if (seenPaths.has(position.path)) {
      continue;
    }
    seenPaths.add(position.path);
    picked.push(position);
    if (picked.length >= MAX_INLINE) {
      break;
    }
  }

  for (const position of enumerated) {
    if (picked.length >= MAX_INLINE) {
      break;
    }
    if (picked.includes(position)) {
      continue;
    }
    picked.push(position);
  }

  return picked.map((position, index) => {
    const lineContent = readDiffLine(diffText, position);
    const token = extractRepresentativeToken(lineContent, position.path);
    const severity = SEVERITY_PALETTE[index % SEVERITY_PALETTE.length] ?? "medium";
    const category = CATEGORY_PALETTE[index % CATEGORY_PALETTE.length] ?? "correctness";
    const body = buildContextAwareBody(position, token, category);
    return {
      path: position.path,
      line: position.line,
      severity,
      category,
      body,
    };
  });
}

/**
 * Build a body that references the file path and a representative token,
 * tuned by category. Bodies stay generic enough that the fixture remains
 * useful even when the extracted token is awkward.
 */
function buildContextAwareBody(
  position: DiffPosition,
  token: string,
  category: string,
): string {
  const file = position.path;
  switch (category) {
    case "security":
      return (
        `The changed line in \`${file}\` references \`${token}\`. ` +
        `Confirm that any string literals, tokens, or secrets reachable from \`${token}\` ` +
        `are stripped by the redactor before review output is posted.`
      );
    case "correctness":
      return (
        `The changed line in \`${file}\` references \`${token}\`. ` +
        `Trace the new code path through \`${token}\` and verify the call sites ` +
        `still gate the same invariants the previous implementation enforced.`
      );
    case "performance":
      return (
        `The changed line in \`${file}\` references \`${token}\`. ` +
        `If \`${token}\` is invoked on every render path, consider memoizing its ` +
        `output or hoisting the constant to keep the hot path cheap.`
      );
    case "style":
      return (
        `The changed line in \`${file}\` references \`${token}\`. ` +
        `Reformat the surrounding region so the new \`${token}\` declaration stays ` +
        `semantically grouped with the existing module exports.`
      );
    default:
      return (
        `The changed line in \`${file}\` references \`${token}\`. ` +
        `Review the surrounding code paths and ensure \`${token}\` continues to behave as expected.`
      );
  }
}