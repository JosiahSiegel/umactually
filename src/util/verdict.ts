/**
 * Verdict → Azure PR-status mapping. Centralised so the live CLI
 * (`live-shared.ts`) and the S4 mocked-run fixture (`azure/run-azure-review.ts`)
 * share one rank table.
 *
 * Two policies exist because they were written at different times:
 *   - `legacy`: NEEDS_FIX → "failed" (S4 RED contract — fixture pinned).
 *     Throws on unknown verdicts (preserves the assertNever guard the
 *     original `azure/run-azure-review.ts:mapVerdictToStatus` had).
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
    // `assertNever(verdict)` guard from `azure/run-azure-review.ts:118`
    // that the S4 RED contract depends on.
    if (normalized === KNOWN_BLOCKING_VERDICT) return "failed";
    throw new TypeError(`unknown verdict for legacy Azure status mapping: ${JSON.stringify(verdict)}`);
  }
  // Current policy: NEEDS_FIX → "pending"; anything unknown (including
  // empty string) also collapses to "pending" so a malformed verdict
  // can't crash the live runner.
  return "pending";
}

export type GithubEvent = "COMMENT" | "REQUEST_CHANGES";

/** GitHub verdict → review-submission event. */
export function mapVerdictToGithubEvent(verdict: string): GithubEvent {
  return verdict === "NEEDS_FIX" ? "REQUEST_CHANGES" : "COMMENT";
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
