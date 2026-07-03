/**
 * Canonical severity ranking. Scale: critical=4, high=3, medium=2, low=1,
 * everything else (info, undefined, "")=0. Used by both the live-path
 * severity filter (live-shared.ts) and the merge-path highest-wins rule
 * (live-merge.ts). Keep both in sync — these were duplicated until now.
 */
export function severityRank(severity: string): number {
  switch (severity.toLowerCase()) {
    case "critical": return 4;
    case "high": return 3;
    case "medium": return 2;
    case "low": return 1;
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
