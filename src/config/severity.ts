import type { Severity } from "./types.js";

const SEVERITY_RANK: Readonly<Record<Severity, number>> = Object.freeze({
  info: 0,
  minor: 1,
  major: 2,
  critical: 3,
  security: 4,
  leak: 5,
});

/**
 * Returns the numeric rank for a severity. Higher = more severe.
 */
export function rankSeverity(severity: Severity): number {
  return SEVERITY_RANK[severity];
}

/**
 * True when `severity` is at least as severe as `minimum`.
 */
export function isSeverityAtLeast(minimum: Severity, severity: Severity): boolean {
  return rankSeverity(severity) >= rankSeverity(minimum);
}

/**
 * Decides whether a finding should be kept under the configured severity controls.
 * - ignoreMinor=true suppresses `info` and `minor` findings only.
 * - `security` and `leak` findings are NEVER suppressed by ignoreMinor.
 * - The minimum threshold is evaluated AFTER ignoreMinor; security/leak are still
 *   at-or-above their own rank, so they survive any threshold check.
 */
export function shouldKeepFinding(
  controls: { readonly ignoreMinor: boolean; readonly minimum: Severity },
  finding: Severity,
): boolean {
  if (controls.ignoreMinor) {
    if (finding === "info" || finding === "minor") return false;
    return true;
  }
  return isSeverityAtLeast(controls.minimum, finding);
}