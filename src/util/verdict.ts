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
