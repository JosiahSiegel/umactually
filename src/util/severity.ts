import type { Severity } from "../config/types.js";

/**
 * Canonical severity ranking — the single source of truth for severity
 * ordering across the entire codebase.
 *
 * Unified scale (supersedes the former parallel table in config/severity.ts):
 *   leak=6, security=5, critical=4, high=3, medium/major=2, low/minor=1,
 *   info/everything else=0.
 *
 * Both the provider-output vocabulary (info/low/medium/high/critical,
 * produced by `normalizeProviderSeverity`) and the internal-finding
 * vocabulary (info/minor/major/critical/security/leak, used by the
 * `Severity` type) are handled by this one function so they can never
 * diverge. Used by the live-path severity filter (`live-shared.ts`), the
 * merge-path highest-wins rule (`live-merge.ts`), the summary layouts
 * (`render/summary-layouts.ts`), and the config-layer severity policy
 * (`config/severity.ts` which now delegates here).
 *
 * Exhaustiveness: `SEVERITY_RANK` is typed `Record<Severity, number>`
 * so the TypeScript compiler rejects any future `Severity` member that
 * lacks a rank entry. The runtime `lookup` does the same check by
 * indexing into the typed table — `info` from the internal vocabulary
 * ranks 0 (not the default collapse). Provider-side typos
 * (`"warning"`, `"3"`, etc.) that survive `normalizeProviderSeverity`
 * still hit the default branch and rank 0; those are already warned
 * about upstream via `provider-parse.ts:emitSeverityWarning`.
 */
const SEVERITY_RANK = {
  info: 0,
  minor: 1,
  major: 2,
  critical: 4,
  security: 5,
  leak: 6,
} as const satisfies Record<Severity, number>;

const SEVERITY_RANK_BY_STRING: Readonly<Record<string, number>> = Object.freeze({
  ...SEVERITY_RANK,
  // Provider-output aliases not in the internal Severity union. These
  // are normalized upstream by `normalizeProviderSeverity` but a few
  // call sites still pass raw provider strings (notably
  // `passesSeverityPolicy` for the minimum-severity threshold). The
  // ranks below are pinned by the test suite — explicit literals
  // (not arithmetic on `SEVERITY_RANK.critical` etc.) so a future
  // re-tuning of the canonical table cannot silently shift the
  // aliases. The order is: low < medium < high < critical; the
  // minor/major aliases already in `SEVERITY_RANK` collapse to the
  // same ranks as low/medium respectively (kept consistent on
  // purpose — Sonar emits `minor`/`major`, providers emit
  // `low`/`medium`).
  low: 1,
  medium: 2,
  high: 3,
});

export function severityRank(severity: string): number {
  return SEVERITY_RANK_BY_STRING[severity.toLowerCase()] ?? 0;
}

/**
 * Visual order for the counts line. Includes the provider vocabulary
 * (critical/high/medium/low) and the internal Severity vocabulary
 * (security/leak/major/minor) so findings carrying either vocabulary
 * render. Order is severity-DESCENDING by `severityRank` so the
 * tallest tier appears first in the tally; ties at the same rank
 * (medium vs major, low vs minor) prefer provider-vocab first to
 * preserve the original four-tier display contract.
 *
 * Note: `security` and `leak` are CARVE-OUT tiers — they appear in
 * this array so `severityRank` consumers see the full vocabulary,
 * but `severityTally` skips them at render time (they bypass the
 * `--minimum-severity` threshold by security policy and are not
 * part of the four-tier display vocabulary). The visible tally order
 * is therefore critical → high → medium/major → low/minor.
 */
export const SEVERITY_ORDER = (Object.keys(SEVERITY_RANK_BY_STRING) as readonly string[])
  .filter((k) => k !== "info")
  .slice()
  .sort((a, b) => {
    const rankDiff = severityRank(b) - severityRank(a);
    if (rankDiff !== 0) return rankDiff;
    const aProvider = ["critical", "high", "medium", "low"].includes(a);
    const bProvider = ["critical", "high", "medium", "low"].includes(b);
    if (aProvider !== bProvider) return aProvider ? -1 : 1;
    return 0;
  }) as readonly string[];

/** Tally comments by severity; eliminates repeated lowercase accumulation logic in live review paths. */
export function countBySeverity(comments: readonly { readonly severity: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const comment of comments) {
    const key = comment.severity.toLowerCase();
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
