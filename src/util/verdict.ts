/**
 * Verdict → Azure PR-status mapping. Centralised so the live CLI
 * (`live-shared.ts`) and the S4 mocked-run fixture (`azure/run-azure-review.ts`)
 * share one rank table.
 *
 * Two policies exist because they were written at different times:
 *   - `legacy`: NEEDS_FIX → "failed" (S4 RED contract — fixture pinned).
 *     Throws on unknown verdicts via an explicit `TypeError` (preserves
 *     the throw-on-unknown guarantee the original
 *     `azure/run-azure-review.ts:mapVerdictToStatus` had — there is no
 *     `assertNever` helper in this module).
 *   - `current`: NEEDS_FIX → "pending" (live behavior — see CLARITY-2 in
 *     live-azure-status-policy.test.ts for the rationale: a failing review
 *     is a finding, not a merge-blocking check). Unknowns collapse to
 *     "pending" so a malformed verdict doesn't crash the runner.
 *
 * The umbrella strings (APPROVED / COMMENT / DISCUSS / SHIP) are always
 * "succeeded" under both policies — only NEEDS_FIX differs.
 *
 * GitHub verdict mapping (REQUEST_CHANGES vs COMMENT) is also exported
 * for symmetry; it has a single canonical mapping.
 */

import { createHash } from "node:crypto";

export type AzureStatusPolicy = "legacy" | "current";

export type AzureStatus = "succeeded" | "failed" | "pending";

/** Known verdict strings accepted by either policy. */
const KNOWN_UMBRELLA_VERDICTS = ["APPROVED", "COMMENT", "DISCUSS", "SHIP"] as const;
const KNOWN_BLOCKING_VERDICT = "NEEDS_FIX";

export function mapVerdictToAzureStatus(verdict: string, policy: AzureStatusPolicy): AzureStatus {
  const normalized = verdict.toUpperCase();
  // Umbrella strings → succeeded under both policies.
  if (KNOWN_UMBRELLA_VERDICTS.includes(normalized as (typeof KNOWN_UMBRELLA_VERDICTS)[number])) {
    return "succeeded";
  }
  if (policy === "legacy") {
    // Legacy policy throws on unknown verdicts — preserves the original
    // `assertNever(verdict)`-style guard from
    // `azure/run-azure-review.ts:mapVerdictToStatus` that the S4 RED
    // contract depends on. (There is no `assertNever` function in this
    // module; the same effect is achieved via the explicit TypeError
    // below.)
    if (normalized === KNOWN_BLOCKING_VERDICT) return "failed";
    throw new TypeError(`unknown verdict for legacy Azure status mapping: ${redactVerdictForError(verdict)}`);
  }
  // Current policy: NEEDS_FIX → "pending"; anything unknown (including
  // empty string) also collapses to "pending" so a malformed verdict
  // can't crash the live runner.
  return "pending";
}

/**
 * Redact a user-supplied verdict for inclusion in an error message.
 * Replaces the raw input with `len=<utf8 bytes>, sha256=<12 hex chars>`
 * so the error is informative for log correlation without echoing
 * PII, control characters, or terminal-escape sequences from the input.
 */
function redactVerdictForError(verdict: string): string {
  const bytes = Buffer.byteLength(verdict, "utf8");
  const hash = createHash("sha256").update(verdict).digest("hex").slice(0, 12);
  return `len=${bytes}, sha256=${hash}`;
}

export type GithubEvent = "COMMENT" | "REQUEST_CHANGES";

/** GitHub verdict → review-submission event. */
export function mapVerdictToGithubEvent(verdict: string): GithubEvent {
  return verdict === "NEEDS_FIX" ? "REQUEST_CHANGES" : "COMMENT";
}

/**
 * Reconcile the model's raw verdict against the postable severity counts.
 *
 * The model emits a `verdict` string from its JSON payload verbatim (see
 * `src/provider/provider-parse.ts:351`). The severity filter
 * (`passesSeverityPolicy` in `src/cli/live-shared.ts`) may then drop
 * every comment — for example, the model tagged everything `info` and
 * the user set `--minimum-severity medium`. In that case
 * `severityCounts` is empty, `postableComments.length` is 0, and the
 * review posts with a `⛔ NEEDS_FIX` headline and a contradictory
 * `📊 0 inline findings` summary. The PR is then blocked by
 * `REQUEST_CHANGES` / a `pending` ADO status, but there is nothing
 * for the human reviewer to act on.
 *
 * This helper centralizes the fix: when the postable severity counts
 * are empty AND the model's verdict is the blocking `NEEDS_FIX`,
 * downgrade the verdict to `COMMENT` so the headline matches the
 * body. Non-blocking verdicts (`APPROVED` / `COMMENT` / `DISCUSS` /
 * `SHIP`) on an empty review are a coherent state — an empty review
 * that the model approves is fine and must NOT be re-stamped as
 * `COMMENT` (which would lose information; `✅ SHIP` on zero
 * findings is the canonical "no findings, looks good" outcome).
 *
 * Apply this at every user-facing surface that renders the verdict
 * (badge, manifest, GitHub review event, Azure PR status). The
 * reconcile-on-read pattern keeps the model's raw verdict intact in
 * the parsed `LiveReview` so logging / debugging can still see what
 * the model actually said.
 *
 * Regression: PR #18 self-review posted `⛔ NEEDS_FIX` with `📊 0
 * inline findings` because the model emitted `NEEDS_FIX` while
 * tagging all five findings `severity: "info"`, and the default
 * `--minimum-severity medium` filtered every one of them out. The
 * reviewer had to expand the collapsible summary to learn what the
 * model wanted. This helper makes that contradiction impossible.
 */
export function reconcileVerdictForEmptySeverityCounts(
  verdict: string,
  severityCounts: Readonly<Record<string, number>>,
): string {
  // Only the blocking verdict is the contradiction class. Other
  // verdicts on empty reviews are coherent states and pass through.
  if (verdict.toUpperCase() !== "NEEDS_FIX") {
    return verdict;
  }
  const total = Object.values(severityCounts).reduce((sum, count) => sum + count, 0);
  if (total === 0) {
    return "COMMENT";
  }
  return verdict;
}

/** Verdict ranking used by the merge path's "worst verdict wins" rule. */
export function verdictRank(verdict: string): number {
  switch (verdict.toUpperCase()) {
    case "NEEDS_FIX":
      return 4;
    case "DISCUSS":
      return 3;
    case "COMMENT":
    case "SHIP":
    case "APPROVED":
      return 2;
    default:
      return 0;
  }
}
