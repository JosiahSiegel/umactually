import { buildSimulatedFindings } from "../review/simulated-findings.js";
import { sanitizeForPost, type LiveProviderOutcome, type LiveReviewComment } from "./live-shared.js";

/**
 * Replaces the provider outcome with a deterministic fixture only when the live
 * result is structurally empty. Live findings always win.
 */
export function applySimulateFindings(input: {
  readonly outcome: LiveProviderOutcome;
  readonly simulateFindings: boolean;
  readonly repo: string;
  readonly prNumber: number;
  readonly headSha: string;
  readonly diffText: string;
  readonly secrets: readonly string[];
}): LiveProviderOutcome {
  if (!input.simulateFindings) {
    return input.outcome;
  }

  const liveCommentCount = input.outcome.review.comments.length;
  const liveSuppressedCount = input.outcome.review.suppressedComments.length;
  const isStructurallyEmpty = liveCommentCount === 0 && liveSuppressedCount === 0;

  if (!isStructurallyEmpty) {
    const message = `umactually-pr-review: --simulate-findings set but ignored (live result has ${liveCommentCount} inline, ${liveSuppressedCount} suppressed). Live findings always win.`;
    const sanitized = sanitizeForPost(message, input.secrets);
    process.stderr.write(`::notice::${sanitized}\n`);
    return input.outcome;
  }

  const fixture = buildSimulatedFindings(input.repo, input.prNumber, input.headSha, input.diffText);
  return {
    endpoint: input.outcome.endpoint,
    provider: input.outcome.provider,
    modelId: input.outcome.modelId,
    review: {
      summary: sanitizeForPost(fixture.summary, input.secrets),
      verdict: fixture.verdict,
      comments: sanitizeComments(fixture.comments, input.secrets),
      suppressedComments: sanitizeComments(fixture.suppressed_comments, input.secrets),
    },
  };
}

function sanitizeComments(
  comments: readonly LiveReviewComment[],
  secrets: readonly string[],
): readonly LiveReviewComment[] {
  return comments.map((comment) => ({
    path: comment.path,
    line: comment.line,
    body: sanitizeForPost(comment.body, secrets),
    severity: sanitizeForPost(comment.severity, secrets),
    category: sanitizeForPost(comment.category, secrets),
  }));
}
