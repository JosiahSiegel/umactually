/**
 * Verdict → Azure PR-status mapping. Centralised so the live CLI
 * (`live-shared.ts`) and the S4 mocked-run fixture (`azure/run-azure-review.ts`)
 * share one rank table.
 *
 * Two policies exist because they were written at different times:
 *   - `legacy`: NEEDS_FIX → "failed" (S4 RED contract — fixture pinned).
 *   - `current`: NEEDS_FIX → "pending" (live behavior — see CLARITY-2 in
 *     live-azure-status-policy.test.ts for the rationale: a failing review
 *     is a finding, not a merge-blocking check).
 *
 * The umbrella strings (APPROVED / COMMENT / DISCUSS / SHIP) are always
 * "succeeded" under both policies — only NEEDS_FIX (and unknown/empty)
 * differ.
 *
 * GitHub verdict mapping (REQUEST_CHANGES vs COMMENT) is also exported
 * for symmetry; it has a single canonical mapping.
 */

export type AzureStatusPolicy = "legacy" | "current";

export type AzureStatus = "succeeded" | "failed" | "pending";

export function mapVerdictToAzureStatus(verdict: string, policy: AzureStatusPolicy): AzureStatus {
  const normalized = verdict.toUpperCase();
  // Umbrella strings → succeeded under both policies.
  if (normalized === "APPROVED" || normalized === "COMMENT" || normalized === "DISCUSS" || normalized === "SHIP") {
    return "succeeded";
  }
  if (policy === "legacy") {
    if (normalized === "NEEDS_FIX") return "failed";
    return "pending";
  }
  // Current policy: any non-success including NEEDS_FIX collapses to "pending"
  // so the Checks panel does not light up red for an unsuccessful review.
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