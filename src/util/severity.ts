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
 */
export function severityRank(severity: string): number {
  switch (severity.toLowerCase()) {
    case "leak": return 6;
    case "security": return 5;
    case "critical": return 4;
    case "high": return 3;
    case "medium":
    case "major":
      return 2;
    case "low":
    case "minor":
      return 1;
    default: return 0;
  }
}

/** Visual order for the counts line; eliminates repeated critical → high → medium → low ordering literals. */
export const SEVERITY_ORDER = ["critical", "high", "medium", "low"] as const;

/** Tally comments by severity; eliminates repeated lowercase accumulation logic in live review paths. */
export function countBySeverity(comments: readonly { readonly severity: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const comment of comments) {
    const key = comment.severity.toLowerCase();
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
