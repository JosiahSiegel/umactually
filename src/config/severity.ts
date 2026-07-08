import type { Severity } from "./types.js";
import { severityRank } from "../util/severity.js";

/**
 * Returns the numeric rank for a severity. Higher = more severe.
 *
 * Delegates to `severityRank` in `src/util/severity.ts` so the
 * config-layer and the live-layer share one rank table. The previous
 * separate `SEVERITY_RANK` table here diverged from the live path on
 * absolute values (e.g. `critical` was 3 here vs 4 in the live path)
 * and could silently disagree on ordering when the two surfaces were
 * composed in the same call (see `live-shared.ts:passesSeverityPolicy`,
 * which used the live-path table and ignored this one entirely).
 */
export function rankSeverity(severity: Severity): number {
  return severityRank(severity);
}

/**
 * True when `severity` is at least as severe as `minimum`. Delegates
 * to the canonical `severityRank` so the comparison cannot drift from
 * the live-path filter or the merge-path ranking.
 */
export function isSeverityAtLeast(minimum: Severity, severity: Severity): boolean {
  return severityRank(severity) >= severityRank(minimum);
}

/**
 * Decides whether a finding should be kept under the configured minimum
 * severity threshold.
 *
 * Security policy invariant: `security` and `leak` findings ALWAYS survive
 * any threshold, even when the configured minimum would otherwise filter them.
 */
export function shouldKeepFinding(
  controls: { readonly minimum: Severity },
  finding: Severity,
): boolean {
  // security and leak ALWAYS survive any threshold (security policy)
  if (finding === "security" || finding === "leak") return true;
  return isSeverityAtLeast(controls.minimum, finding);
}