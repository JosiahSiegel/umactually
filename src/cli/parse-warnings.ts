import type { LiveReviewComment } from "./live-shared.js";
import { parseDiffPositions } from "../diff/parse-positions.js";
import type { BodyAliasObservation } from "../provider/provider-parse.js";

/**
 * A single off-diff or invalid-line finding the model emitted.
 *
 * Captured in the `parse-warnings.json` artifact so operators can
 * detect LLM citation hallucination (paths/lines the model cited
 * that aren't in the supplied diff). Each warning includes the
 * model's raw claim AND the closest anchor in the diff for
 * debugging.
 */
export type ParseWarning = {
  /** Why this comment was rejected. */
  readonly reason: "path-not-in-diff" | "line-not-in-diff" | "empty-body" | "body-alias";
  /** Source of the comment: the model's `comments` array or `suppressed_comments` array. */
  readonly source: "comments" | "suppressed_comments";
  /** The index in the source array (matches `review.comments[i]` etc). */
  readonly index: number;
  /** The model-claimed path (raw, un-normalized). */
  readonly modelPath: string;
  /** The model-claimed line number (raw). */
  readonly modelLine: number;
  /** The model-emitted severity (raw, un-normalized — preserve for debugging). */
  readonly modelSeverity: string;
  /** The model's body excerpt (truncated to 200 chars to keep the artifact small). */
  readonly bodyExcerpt: string;
  /** Alias-key name (body-alias reason only — the key that supplied the populated body). */
  readonly field?: string;
  /** Comment index from the observation sink (body-alias reason only — matches the readCommentArray input index). */
  readonly commentIndex?: number;
};

/**
 * Classify and return the list of `comments` and `suppressed_comments`
 * whose (path, line) pair does not anchor to the supplied diff.
 *
 * The diff filter (Layer 1) and the prompt grounding (Layer 2) aim to
 * prevent these in the first place, but every production LLM
 * review tool still encounters them at the long tail. Surfacing
 * them in a structured artifact is the difference between "model
 * fabricated dist/cli.js:1 and we have no idea" and "the manifest
 * records exactly what the model emitted, what we filtered, and why".
 *
 * Reasons:
 *   - `path-not-in-diff` — the model cited a path that does not appear
 *     anywhere in the diff (e.g. `dist/cli.js` when dist/ was excluded
 *     by the diff filter)
 *   - `line-not-in-diff` — the path appears in the diff but the
 *     specific line does not (off-by-one or hallucinated line number)
 *   - `empty-body` — the model emitted a comment with an empty body;
 *     if the same comment is also off-diff, BOTH warnings are emitted
 *     (double-count is intentional per the live-provider.ts partition
 *     contract: the two reasons are independently actionable)
 */
export function collectParseWarnings(input: {
  readonly review: {
    readonly comments: readonly LiveReviewComment[];
    readonly suppressedComments: readonly LiveReviewComment[];
  };
  readonly diffText: string;
}): readonly ParseWarning[] {
  const positions = parseDiffPositions(input.diffText);
  const diffPaths = new Set(positions.enumerate().map((p) => p.path));

  const warnings: ParseWarning[] = [];
  for (const [source, list] of [
    ["comments", input.review.comments],
    ["suppressed_comments", input.review.suppressedComments],
  ] as const) {
    list.forEach((comment, index) => {
      const path = comment.path;
      const line = comment.line;
      // empty-body check (must precede the diff-anchor check so a
      // finding whose body the model failed to populate still surfaces
      // in the artifact even when its (path, line) anchor is valid).
      // Records the body-replacement failure rather than a citation
      // failure so the operator can distinguish "model wrote nothing
      // here" from "model cited a fake path".
      //
      // Source-gated to `comments`: the partition layer in
      // `normalizeProviderReview` moves every trim-empty entry into
      // `suppressedComments` and emits the warning explicitly with
      // `source: "comments"`. Re-emitting here would double-count.
      //
      // Does NOT return early: an empty-body comment that ALSO has an
      // off-diff citation is double-counted (intentional per the
      // live-provider.ts partition contract: "two reasons are
      // independently actionable"). Without this, operators triaging
      // an attacker-supplied path/line + empty body would see only
      // `empty-body` and miss the path fabrication.
      if (source === "comments" && comment.body.trim().length === 0) {
        warnings.push({
          reason: "empty-body",
          source,
          index,
          modelPath: path,
          modelLine: line,
          modelSeverity: comment.severity,
          bodyExcerpt: "",
        });
        // Continue to off-diff check — do not return.
      }
      // Defensive: a model might emit a non-integer line OR an
      // empty path. Treat both as off-diff (the most actionable
      // signal: the model fabricated the position) so the
      // parse-warnings artifact records the shape error too —
      // a comment with `line: 2.5` is a fabrication just as
      // much as a hallucinated `dist/cli.js:1`, and silently
      // dropping it from the artifact would hide a real failure
      // mode from operators.
      const pathInDiff = path.length > 0 && diffPaths.has(path);
      const lineInDiff = Number.isInteger(line) && line > 0 && positions.hasPosition({ path, line });
      if (pathInDiff && lineInDiff) {
        return;
      }
      // Reason precedence: if the path is not in the diff, that's the
      // most actionable signal (the diff filter missed it OR the model
      // fabricated the path). A line-number error on an in-diff path
      // is a different failure mode (off-by-one / hallucinated line).
      const reason: ParseWarning["reason"] = !pathInDiff
        ? "path-not-in-diff"
        : "line-not-in-diff";
      warnings.push({
        reason,
        source,
        index,
        modelPath: path,
        modelLine: line,
        modelSeverity: comment.severity,
        bodyExcerpt: comment.body.length > 200
          ? `${comment.body.slice(0, 200)}…`
          : comment.body,
      });
    });
  }
  return warnings;
}

/**
 * Build the parse-warnings JSON payload. Always includes the
 * `summary` counts so operators can scan the artifact for
 * regressions without parsing the full array.
 */
export function buildParseWarningsArtifact(input: {
  readonly review: {
    readonly comments: readonly LiveReviewComment[];
    readonly suppressedComments: readonly LiveReviewComment[];
  };
  readonly diffText: string;
  readonly bodyAliasObservations?: readonly BodyAliasObservation[];
  /**
   * Length of the model's original `comments` array BEFORE the
   * empty-body partition moved entries into `suppressedComments`.
   * Required: the post-partition `review.comments.length` would
   * misattribute observations whose original index falls in the
   * partition range.
   */
  readonly originalCommentsLength: number;
}): {
  readonly summary: {
    readonly totalComments: number;
    readonly totalSuppressed: number;
    readonly invalidCount: number;
    readonly byReason: Readonly<Record<ParseWarning["reason"], number>>;
    readonly bySource: Readonly<Record<ParseWarning["source"], number>>;
  };
  readonly warnings: readonly ParseWarning[];
} {
  const diffWarnings = collectParseWarnings(input);
  const aliasWarnings: ParseWarning[] = (input.bodyAliasObservations ?? []).map(
    (obs) => {
      const source: ParseWarning["source"] = obs.commentIndex < input.originalCommentsLength
        ? "comments"
        : "suppressed_comments";
      return {
        reason: "body-alias",
        source,
        index: obs.commentIndex,
        modelPath: "",
        modelLine: 0,
        modelSeverity: "",
        bodyExcerpt: "",
        field: obs.field,
        commentIndex: obs.commentIndex,
      };
    },
  );
  const warnings = [...diffWarnings, ...aliasWarnings];
  const byReason: Record<ParseWarning["reason"], number> = {
    "path-not-in-diff": 0,
    "line-not-in-diff": 0,
    "empty-body": 0,
    "body-alias": 0,
  };
  const bySource: Record<ParseWarning["source"], number> = {
    comments: 0,
    suppressed_comments: 0,
  };
  for (const w of warnings) {
    byReason[w.reason] += 1;
    bySource[w.source] += 1;
  }
  return {
    summary: {
      totalComments: input.review.comments.length,
      totalSuppressed: input.review.suppressedComments.length,
      invalidCount: warnings.length,
      byReason,
      bySource,
    },
    warnings,
  };
}
