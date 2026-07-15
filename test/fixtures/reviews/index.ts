/**
 * Fixture registry for Part C (ground-truth review-quality evals).
 *
 * Add new fixtures to this file. Each fixture is a typed
 * `ReviewFixture` object; the live runner picks them up automatically.
 * Adding a fixture MUST NOT alter existing fixture thresholds.
 */
import { greetingI18nCleanFixture } from "./greeting-i18n-clean.js";
import { intentionalDesignFixture } from "./intentional-design.js";
import { multiIssueFixture } from "./multi-issue.js";
import { offDiffCitationAttemptFixture } from "./off-diff-citation-attempt.js";
import type { ReviewFixture } from "../../e2e/review-eval.js";

export const REVIEW_FIXTURES: readonly ReviewFixture[] = [
  greetingI18nCleanFixture,
  offDiffCitationAttemptFixture,
  multiIssueFixture,
  intentionalDesignFixture,
];