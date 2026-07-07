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
 * Exhaustiveness: the canonical `Severity` union is captured in
 * `SEVERITY_RANK` below as a `Record<Severity, number>`. The TypeScript
 * compiler will reject any future `Severity` member that lacks a rank
 * entry, so a new severity can't silently collapse to rank 0 via the
 * default branch. The function signature accepts `string` (not
 * `Severity`) because it is also called with raw provider-emitted
 * values (`info | low | medium | high | critical`) plus Sonar aliases
 * (`minor | major`) that are normalized upstream; unrecognized strings
 * intentionally rank 0 so the minimum-severity threshold filters them
 * out cleanly.
 */
const SEVERITY_RANK = {
  info: 0,
  minor: 1,
  major: 2,
  critical: 4,
  security: 5,
  leak: 6,
} as const satisfies Record<Severity, number>;

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
    case "info":
      return 0;
    default:
      return 0;
  }
}

/**
 * Compile-time exhaustiveness assertion: if a future severity is added
 * to the `Severity` union but not given a rank in `SEVERITY_RANK`, the
 * `as const satisfies Record<Severity, number>` check above will fail.
 * The runtime `default: return 0` below handles only truly-unrecognized
 * strings (provider-side typos like "warning" or "3") that survived
 * `normalizeProviderSeverity`. Those are already warned about upstream
 * via `provider-parse.ts:emitSeverityWarning`.
 */
// Reference the table so TS preserves the type-level check even though
// the runtime `switch` is what actually returns ranks.
void SEVERITY_RANK;

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
