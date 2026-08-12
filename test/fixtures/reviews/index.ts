/**
 * Fixture registry for Part C (ground-truth review-quality evals).
 *
 * Add new fixtures to this file. Each fixture is a typed
 * `ReviewFixture` object; the live runner picks them up automatically.
 * Adding a fixture MUST NOT alter existing fixture thresholds.
 *
 * `REVIEW_FIXTURES` is the GREEN set exercised by the hermetic gate
 * on every CI / prepublish / release run.
 *
 * `SABOTAGE_FIXTURES` is loaded only when the runner is invoked with
 * `REVIEW_EVAL_SABOTAGE=1`. These fixtures are designed to
 * intentionally trip the gate so the failure path is exercised end-to-
 * end (named threshold breach → non-zero exit).
 */
import { crossFileContractBreakFixture } from "./cross-file-contract-break.js";
import { falsePositiveTrapFixture } from "./false-positive-trap.js";
import { greetingI18nCleanFixture } from "./greeting-i18n-clean.js";
import { intentionalDesignFixture } from "./intentional-design.js";
import { largeDiffFixture } from "./large-diff.js";
import { missingTestsFixture } from "./missing-tests.js";
import { multiIssueFixture } from "./multi-issue.js";
import { offDiffCitationAttemptFixture } from "./off-diff-citation-attempt.js";
import { parseFailureNotCleanFixture } from "./parse-failure-not-clean.js";
import { securitySecretLeakFixture } from "./security-secret-leak.js";
import { truncationFixture } from "./truncation.js";
import { sabotageFailSecretLeakFixture } from "./sabotage-fail.js";
import type { ReviewFixture } from "../../e2e/review-eval.js";

export const REVIEW_FIXTURES: readonly ReviewFixture[] = [
  greetingI18nCleanFixture,
  intentionalDesignFixture,
  multiIssueFixture,
  offDiffCitationAttemptFixture,
  crossFileContractBreakFixture,
  falsePositiveTrapFixture,
  missingTestsFixture,
  securitySecretLeakFixture,
  parseFailureNotCleanFixture,
  truncationFixture,
  largeDiffFixture,
];

export const SABOTAGE_FIXTURES: readonly ReviewFixture[] = [
  sabotageFailSecretLeakFixture,
];
