export type AzureStatus = "succeeded" | "failed" | "pending";

const KNOWN_UMBRELLA_VERDICTS = ["APPROVED", "COMMENT", "DISCUSS", "SHIP"] as const;

export function mapVerdictToAzureStatus(verdict: string): AzureStatus {
  const normalized = verdict.toUpperCase();
  if (KNOWN_UMBRELLA_VERDICTS.includes(normalized as (typeof KNOWN_UMBRELLA_VERDICTS)[number])) {
    return "succeeded";
  }
  return "pending";
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

/**
 * Sum the postable severity counts into a single "are there findings?"
 * boolean. Used by both `reconcileVerdictForEmptySeverityCounts` and
 * `escalateVerdictForNonEmptySeverityCounts` so the empty/non-empty
 * check is defined exactly once. A non-empty `severityCounts` object
 * with all zero-valued tiers (e.g. `{"medium": 0, "high": 0}` from a
 * malformed upstream producer) is treated as empty — same contract as
 * the existing reconcile helper.
 */
export function totalSeverityCount(
  severityCounts: Readonly<Record<string, number>>,
): number {
  let total = 0;
  for (const value of Object.values(severityCounts)) {
    total += value;
  }
  return total;
}

/**
 * Reconcile a non-blocking verdict (SHIP / APPROVED / COMMENT / DISCUSS /
 * unknown) against the postable severity counts. The model emits a verdict
 * string from its JSON payload verbatim, but a verdict that says "ship it"
 * or "looks good" is incoherent with a body that lists postable findings
 * the user explicitly opted into via `--minimum-severity`.
 *
 * This is the inverse direction of `reconcileVerdictForEmptySeverityCounts`:
 *   - empty counts + non-blocking verdict → coherent state, pass through
 *     (`✅ SHIP` on zero findings IS the canonical "no findings, looks good"
 *     outcome — must NOT be re-stamped).
 *   - non-empty counts + non-blocking verdict → upgrade to `NEEDS_FIX`
 *     because the model missed what its own findings list implies.
 *
 * `NEEDS_FIX` passes through (the inverse helper handles the empty-counts
 * downgrade direction). The blocking-discriminator comparison is
 * case-insensitive (`"needs_fix"`, `"Needs-Fix"`, and `"NEEDS_FIX"` all
 * pass through) — a model emitting a non-canonical-case blocking verdict
 * must not be re-stamped. When the helper DOES upgrade, it emits the
 * canonical `"NEEDS_FIX"` regardless of input casing so downstream
 * renderers and the manifest see a stable vocabulary. When the helper
 * does NOT upgrade (counts empty, or already-blocking input), it returns
 * the raw input string so the original model prose is preserved — same
 * discipline as `reconcileVerdictForEmptySeverityCounts` two functions
 * above. Unknown verdict strings ALSO upgrade to `NEEDS_FIX` when counts
 * are non-empty — the same "model said one thing, its findings imply
 * another" contradiction applies regardless of whether the verdict
 * string is one of the canonical four. This helper is a contradiction
 * guard, NOT a verdict normaliser: it doesn't try to map "MAYBE" or
 * "looks_ok" onto the canonical vocabulary, only to decide whether the
 * body and verdict disagree. The existing verdict mappers
 * (`mapVerdictToAzureStatus`, `mapVerdictToGithubEvent`) still see the
 * raw verdict and collapse unknowns to their own safe defaults there.
 *
 * Regression: PR #183 self-review (verdict-severity-contradiction review
 * pass). The model emitted `verdict: "SHIP"` with `summary: "looks good,
 * ship it"` while the inline comments contained a SonarCloud MAJOR
 * finding. The badge rendered `✅ SHIP` against `📊 1 inline finding`, the
 * prose at the top of the body said "ship it", and a reviewer scanning
 * the top would miss the MAJOR inline thread below. The
 * `reconcileVerdictForEmptySeverityCounts` helper that already handles
 * the reverse case (NEEDS_FIX + empty counts → COMMENT) only fires on the
 * inverse; this helper completes the symmetry.
 */
export function escalateVerdictForNonEmptySeverityCounts(
  verdict: string,
  severityCounts: Readonly<Record<string, number>>,
): string {
  const normalized = verdict.toUpperCase().replace(/[-\s]+/gu, "_");
  if (normalized === "NEEDS_FIX") {
    return verdict;
  }
  // Only escalate KNOWN non-blocking verdicts. Unknown verdicts pass
  // through untouched so the verdict mappers (mapVerdictToAzureStatus,
  // mapVerdictToGithubEvent) can apply their own safe defaults — same
  // discipline as reconcileVerdictForEmptySeverityCounts above. This
  // prevents a model emitting a coherent non-canonical verdict (e.g.
  // "LGTM_NIT" against an info-severity comment) from being stamped to
  // NEEDS_FIX just because counts are non-empty.
  const KNOWN_NON_BLOCKING = new Set(["SHIP", "APPROVED", "COMMENT", "DISCUSS"]);
  if (KNOWN_NON_BLOCKING.has(normalized) && totalSeverityCount(severityCounts) > 0) {
    return "NEEDS_FIX";
  }
  return verdict;
}

/**
 * Apply both reconciliation rules in order and report whether the verdict
 * was changed from the model's raw value. Single-call helper for the
 * user-facing surfaces that need both rules (badge, manifest, GitHub
 * review event, Azure PR status, merge worst-verdict pick).
 *
 * Reconciliation order matters:
 *   1. First downgrade `NEEDS_FIX` + empty counts to `COMMENT`
 *      (existing rule, prevents the `⛔ NEEDS_FIX` + `📊 0 inline findings`
 *      contradiction — PR #18).
 *   2. Then upgrade any non-blocking verdict with non-empty counts to
 *      `NEEDS_FIX` (new rule, prevents the `✅ SHIP` + `📊 N inline findings`
 *      contradiction where N ≥ 1 — PR #183 review pass).
 *
 * The two rules are not contradictory on the same input: rule 1 fires
 * only on empty counts; rule 2 fires only on non-empty counts. A review
 * that fires rule 1 will never fire rule 2.
 *
 * Returned `escalated: true` means the caller should render a one-line
 * banner so a reviewer scanning the headline sees why the verdict
 * disagrees with the model's prose summary. Kept as a separate boolean
 * (not a sentence) so callers can format it consistently with the rest
 * of the rendered layout — the banner text lives in
 * `src/render/summary-layouts.ts` so the verdict utility stays
 * pure-data.
 */
export function composeEffectiveVerdict(input: {
  readonly rawVerdict: string;
  readonly severityCounts: Readonly<Record<string, number>>,
}): { readonly verdict: string; readonly escalated: boolean } {
  const { rawVerdict, severityCounts } = input;
  const downgraded = reconcileVerdictForEmptySeverityCounts(rawVerdict, severityCounts);
  const final = escalateVerdictForNonEmptySeverityCounts(downgraded, severityCounts);
  const escalated = rawVerdict !== downgraded || downgraded !== final;
  return { verdict: final, escalated };
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
