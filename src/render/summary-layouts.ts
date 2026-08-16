/**
 * Markdown rendering for the UmActually PR review summary.
 *
 * The "review summary" is the parent PR-level card posted alongside the
 * per-finding inline threads on a GitHub Pull Request review or an Azure
 * DevOps PR thread. The summary is the first thing reviewers see when they
 * open the PR conversation; it must answer four questions in under five
 * seconds:
 *
 *   1. Should I ship, fix, or discuss?
 *   2. How many things are wrong?
 *   3. What kinds of things are wrong?
 *   4. Where in the diff should I look first?
 *
 * A single shipped renderer answers those questions: `renderSummary`
 * hardcodes the production layout (`layoutSeverityTable`, with
 * `renderCleanShip` for the empty-review fast path). The previous
 * twenty-variant layout union, the comparison sheet that wrapped them,
 * and the registry maps have all been removed; this module now exposes
 * exactly four surface symbols (`ReviewData`, `renderSummary`,
 * `layoutSeverityTable`, `renderCleanShip`).
 *
 * Cross-platform rules (GitHub PR review body + Azure DevOps PR thread):
 *   - DO use GFM tables, headings, blockquote, lists, fenced code,
 *     inline code, links, raw Unicode emoji, horizontal rules.
 *   - DO use `<details>`/`<summary>` — verified to render as a working
 *     click-to-expand widget on BOTH GitHub PR reviews AND Azure DevOps
 *     PR comments. Empirical evidence:
 *       - GitHub: PR #20 self-review renders with disclosure triangle +
 *         click-to-expand (verified via DOM 2026-07-07).
 *       - Azure DevOps: PR #53 thread 1620 renders with `▸` disclosure
 *         marker on each summary; clicking toggles `open` attr; body
 *         expands to show path + full title (verified via playwright
 *         + DOM 2026-07-07). Previous "Azure renders as raw text" rule
 *         was based on 2023-era community reports and is no longer
 *         accurate for the post-2025 Azure DevOps PR thread renderer.
 *     The severity-table + dashboard layouts use `<details>` for the
 *     findings list (one block per finding — see findingsDetailsRow
 *     docstring for the full rationale) and for verbose summaries
 *     (>500 chars). Pinned by S5a (short summary uses no <details> in
 *     the SUMMARY section) and S5b (long summary wraps in <details>).
 *   - DO NOT use raw `<table>` HTML (Azure ignores it).
 *   - DO NOT use task lists `- [x]` / `- [ ]` (Azure ignores check state).
 *   - Body must stay under GitHub's 65,536-char comment limit.
 *
 * The single shipped layout obeys the rules above. See
 * `test/unit/summary-layouts.test.ts` for the invariant assertions.
 */

import { REVIEW_MARKER, MANIFEST_SCHEMA, MANIFEST_MARKER_PREFIX, MANIFEST_MARKER_SUFFIX } from "../util/marker.js";
import type { LiveReview, LiveReviewComment } from "../cli/live-shared.js";
import { SEVERITY_ORDER, severityRank } from "../util/severity.js";
import { replaceSecretsLiterally } from "../util/redact.js";
import { resolutionGuide } from "./resolution-guide.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Summary length above which the default layout uses a collapsed details block. */
export const VERBOSE_THRESHOLD_CHARS = 500;

/**
 * Data shape every layout accepts. Derived from `LiveReview` (the
 * canonical input shape to the existing `buildReviewBody` in
 * `src/cli/live-shared.ts`) plus the per-comment counts the existing
 * renderer already computes. All fields are readonly so a layout
 * function cannot mutate caller state.
 */
export type ReviewData = {
  readonly review: LiveReview;
  readonly provider: string;
  readonly modelId: string;
  readonly validCommentCount: number;
  readonly suppressedCommentCount: number;
  readonly severityCounts: Readonly<Record<string, number>>;
  readonly offDiffFromComments: readonly LiveReviewComment[];
  readonly postedComments: readonly LiveReviewComment[];
  readonly secrets: readonly string[];
  /**
   * Optional threshold context used by the `🏷️ …` severity tally to
   * append a per-tier `*` marker + a `` `* = filtered by threshold` ``
   * legend line when some tiers are intentionally hidden by
   * `--minimum-severity`. When omitted (or `null`), the tally renders
   * unchanged (byte-identical to the original behavior).
   */
  readonly minimumSeverity?: string | null;
  /**
   * When `composeEffectiveVerdict` changed the effective verdict from the
   * model's raw verdict (downgrade on empty counts OR upgrade on
   * non-empty counts), this carries the raw model verdict so layouts
   * can render a one-line escalation banner between the badge and the
   * pipeline summary. Omit when the raw and effective verdicts agree.
   */
  readonly verdictEscalatedFrom?: string;
  /**
   * Optional platform tag — empty/`undefined`/`"auto"` defaults to the
   * GitHub variant. The renderer uses this to choose the correct
   * platform-aware resolution guide footer. Omit for simulate/dry-run
   * callers that don't have a known platform.
   */
  readonly platform?: "github" | "azure";
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Sanitize a value against the redaction list before it lands in markdown. */
function redact(value: string, secrets: readonly string[]): string {
  return replaceSecretsLiterally(value, secrets);
}

/** Escape pipes in a value so it can sit inside a GFM table cell. */
function cell(value: string): string {
  return value.replace(/\|/gu, "\\|").replace(/\r?\n/gu, " ").trim();
}

/**
 * Redact a comment body and collapse runs of whitespace to a single space.
 *
 * Most layouts want a one-line "snippet" — never the raw multi-paragraph
 * provider body, never unredacted secrets. The collapsed form is the
 * canonical snippet shape used in tables, bullets, sticky notes, and
 * the inline preview. Returns an empty string if the body is empty
 * after redaction (so callers can `parts.push(snippet)` without
 * rendering an empty bullet).
 *
 * Replaces 13 inline copies of
 * `redact(c.body, secrets).replace(/\s+/gu, " ").trim()`.
 */
function collapseBody(c: LiveReviewComment, secrets: readonly string[]): string {
  return redact(c.body, secrets).replace(/\s+/gu, " ").trim();
}

/**
 * Truncate a snippet to `max` chars with a horizontal-ellipsis suffix.
 *
 * Layouts use different truncation budgets depending on column width
 * (table cells vs. blockquote stickies vs. newspaper lede), so this
 * helper is parameterised rather than hardcoded. The threshold check
 * (`> max`) preserves a string at exactly `max` chars — i.e. we only
 * truncate when there is something to cut. The cut leaves room for the
 * single-char `…` suffix (i.e. `slice(0, max - 3)`, then append `…`),
 * which matches the byte-for-byte truncation budget the layouts have
 * always used (e.g. `length > 80 ? slice(0, 77) + '…' : title` → 78
 * visible chars). Two chars of headroom are dropped so future suffixes
 * wider than `…` (e.g. two-char '..') can swap in without re-tuning
 * every call site.
 *
 * Pass `max = 0` (or any falsy) to disable truncation and return the
 * input unchanged — useful when a layout has unlimited horizontal room.
 */
function truncateSnippet(snippet: string, max: number): string {
  if (!max || snippet.length <= max) return snippet;
  return `${snippet.slice(0, max - 3)}…`;
}

/**
 * Render a single finding as a `<details>` collapsible block.
 *
 * Mobile-friendly replacement for a GFM table row. GFM tables at
 * 576px viewport auto-size columns to their widest cell, then wrap
 * mid-word (`#` column stacks "10" vertically, File:Line breaks
 * mid-identifier, Title truncates with `…`, Severity header wraps
 * to "Severit"/"y"). The `<details>` element has no column-width
 * constraints, so:
 *   - severity emoji + word always render on one line
 *   - the summary line never truncates inside a code path
 *   - the full body, path, and line number render at any width
 *     once the user expands the row
 *
 * Summary line shape: `1 · 🟠 Medium — Indentation regression: line 831 …`
 * Expanded body shape: blank line, then `📍 \`path\`:line`, then
 * `> ` blockquoted body (blockquotes survive inside `<details>`
 * on both GitHub and Azure DevOps).
 *
 * `summaryCap` is the budget for the summary-line truncation. The
 * full title always renders in the expanded body.
 */
function findingsDetailsRow(
  index: number,
  c: LiveReviewComment,
  secrets: readonly string[],
  summaryCap: number,
): string {
  const title = collapseBody(c, secrets);
  // When the provider emits an empty `body` (e.g. the synthetic
  // review-model for some findings) the collapsed title is "" and the
  // summary line would render as `1 · 🟠 Medium — ` — useless to
  // reviewers. Mirror the inline-thread fallback in
  // `src/cli/live-shared.ts:buildInlineCommentBody` (which produces
  // `Finding at <path>:<line>.` for the same empty-body case) so the
  // summary snippet still gives the reader a locatable handle.
  const safePath = cell(c.path);
  const fallbackBody = `Finding at ${safePath}:${c.line}.`;
  const snippetSource = title.trim().length > 0 ? title : fallbackBody;
  const snippet = truncateSnippet(snippetSource, summaryCap);
  const lines: string[] = [];
  lines.push("<details>");
  lines.push(
    `<summary>${index} · ${severityEmoji(c.severity)} ${severityLabel(c.severity)} — ${cell(snippet)}</summary>`,
  );
  lines.push("");
  lines.push(`📍 \`${safePath}\`:${c.line}`);
  lines.push("");
  lines.push(`> ${cell(snippetSource)}`);
  lines.push("");
  lines.push("</details>");
  return lines.join("\n");
}

/**
 * Severity → display emoji used by every layout that wants a single glyph.
 *
 * Uses the Unicode colored-circle emoji (🟣 � 🟠 🟡 ⚪) because they
 * render with their own color on GitHub (which ships a colored emoji
 * font) without any inline HTML or `style` attribute. An earlier revision
 * tried inline `<span style="color:…">…</span>` to work around Azure
 * DevOps not rendering colored emoji — but GitHub's sanitizer strips
 * the `style` attribute from `<span>` tags (verified via the GitHub
 * `/markdown` API), so the colors vanished on GitHub and the approach
 * failed on both platforms.
 *
 * CROSS-PLATFORM STATUS:
 *   - GitHub: renders with color (ships a colored emoji font).
 *   - Azure DevOps: renders as outline `⚪` for all severities (no
 *     colored emoji font installed). Reviewers on Azure lose the
 *     color signal but the glyph shape (`🟣`/`🔴`/`🟠`/`�`) is
 *     still distinct. This is a known cross-platform limitation,
 *     not a regression.
 *
 * The fallback (unknown severity) is the same outline `⚪` so
 * "I don't know what this is" doesn't visually claim to be a real severity.
 */
function severityEmoji(level: string): string {
  switch (level.toLowerCase()) {
    case "critical":
    case "security": return "🟣";
    case "high":     return "🔴";
    case "medium":
    case "major":    return "🟠";
    case "low":
    case "minor":    return "🟡";
    case "info":     return "🟡";
    case "leak":     return "🔴";
    default:         return "⚪";
  }
}

/** Severity → short label used in compact rows. */
function severityLabel(level: string): string {
  switch (level.toLowerCase()) {
    case "critical":
    case "security": return "Critical";
    case "leak":     return "High";
    case "high": return "High";
    case "medium":
    case "major": return "Medium";
    case "low":
    case "minor": return "Low";
    default: return level || "Info";
  }
}

/** Compose the stable hidden manifest that AI agents parse. */
function manifest(data: ReviewData): string {
  const payload = {
    schema: MANIFEST_SCHEMA,
    verdict: data.review.verdict,
    provider: data.provider,
    modelId: data.modelId,
    inlineCount: data.validCommentCount,
    suppressedCount: data.suppressedCommentCount,
    severityCounts: { ...data.severityCounts },
    ...(data.review.parseFailed === true ? { parseFailed: true } : {}),
  };
  return `${MANIFEST_MARKER_PREFIX}${JSON.stringify(payload)}${MANIFEST_MARKER_SUFFIX}`;
}

/** Compose the verdict badge. Mirrors `verdictBadge` in live-shared.ts. */
function verdictBadge(data: ReviewData): string {
  const normalized = data.review.verdict.toUpperCase();
  const nothingActionable =
    data.validCommentCount === 0 && data.suppressedCommentCount === 0;
  if (normalized === "NEEDS_FIX" && !nothingActionable) return "⛔ NEEDS_FIX";
  if (normalized === "APPROVED" || normalized === "SHIP") return "✅ SHIP";
  return "💬 DISCUSS";
}

/**
 * Render a one-line banner explaining a verdict reconciliation. Two
 * directions are supported: upgrade (raw non-blocking → `NEEDS_FIX`,
 * PR #183 review pass) and downgrade (raw `NEEDS_FIX` → `COMMENT`,
 * PR #18). Blockquote-formatted to match `PARSE_FAILED_BANNER` at
 * the same insertion point. Returns `""` when no reconciliation was
 * needed.
 */
function verdictEscalationBanner(data: ReviewData): string {
  if (data.verdictEscalatedFrom === undefined) return "";
  const raw = data.verdictEscalatedFrom.toUpperCase();
  const effective = data.review.verdict.toUpperCase();
  const direction = effective === "NEEDS_FIX" && raw !== "NEEDS_FIX" ? "escalated" : "downgraded";
  const findingCount = data.postedComments.length;
  const findingSuffix = findingCount === 1 ? "postable finding" : "postable findings";
  const reason = effective === "NEEDS_FIX"
    ? `review contains ${findingCount} ${findingSuffix}`
    : "no postable findings to address";
  return `> ⚠️ Verdict ${direction} from \`${raw}\` → \`${effective}\`: ${reason}.`;
}

/**
 * Push the verdict badge (`## ⛔ NEEDS_FIX` etc.) followed by the
 * optional escalation banner. All layouts that render a verdict must
 * go through this helper so the banner can't be forgotten on a future
 * layout.
 */
function pushVerdict(parts: string[], data: ReviewData): void {
  parts.push(`## ${verdictBadge(data)}`);
  const banner = verdictEscalationBanner(data);
  if (banner.length > 0) parts.push(banner);
}

/**
 * Pipeline summary line used by most layouts.
 *
 * Leads with the number of comments that will appear inline on the diff
 * (i.e. `postedComments.length`). The reader's question is "how many
 * findings will I see on this PR?" — not "how many did the model
 * produce?" The model's gross output is the wrong primary signal
 * because it includes findings the runtime filtered (severity policy,
 * off-diff suppression) before posting. Off-diff findings are surfaced
 * separately as a callout in `layoutSeverityTable` (see
 * `severity-table off-diff callout` block below), not jammed into the
 * headline number.
 */
function pipelineLine(data: ReviewData): string {
  const n = data.postedComments.length;
  return `📊 ${n} inline finding${n === 1 ? "" : "s"}`;
}

/**
 * Returns the set of severity tiers that are intentionally hidden by
 * the active `--minimum-severity` threshold. Empty when no threshold is
 * configured or the threshold keeps every displayed tier visible — callers
 * use this to (a) mark each filtered tier with a trailing `*` in the tally
 * line, and (b) emit the legend line below.
 *
 * Examples:
 *   - minimumSeverity=null     → ∅ (no marker anywhere)
 *   - minimumSeverity="low"    → ∅ (everything visible)
 *   - minimumSeverity="medium" → { low }
 *   - minimumSeverity="high"   → { medium, low }
 */
function filteredTiers(data: ReviewData): ReadonlySet<string> {
  const minimum = data.minimumSeverity != null ? data.minimumSeverity.toLowerCase() : null;
  if (minimum === null) return new Set();
  return new Set(SEVERITY_ORDER.filter((level) => severityRank(level) < severityRank(minimum)));
}

/**
 * Legend line that follows the severity tally when any tier is
 * filtered. Returns `""` when nothing is filtered — callers MUST treat
 * it as opt-in: only push this line in layouts that have room for a
 * second markdown line below the tally. Returns the code-fenced
 * single-line legend `` `* = filtered by threshold` `` — code-fenced
 * (not italic) so the `*` doesn't need a backslash escape on either
 * GitHub or Azure DevOps, and short enough to fit below the tally
 * without breaking table-cell / bullet contexts.
 */
function severityTallyLegend(data: ReviewData): string {
  if (filteredTiers(data).size === 0) return "";
  return "`* = filtered by threshold`";
}

/**
 * Severity tally line. Walks `SEVERITY_ORDER` (provider + internal
 * vocabularies interleaved) and skips tiers with count 0 — except
 * tiers filtered by the `--minimum-severity` threshold, which keep an
 * asterisk to surface that they were hidden.
 *
 * Carve-out tiers (`security`, `leak`) are ALWAYS omitted from the
 * rendered tally regardless of their count. They bypass the
 * `--minimum-severity` threshold (see `config/severity.ts:shouldKeepFinding`)
 * by security policy and are not part of the four-tier display
 * vocabulary the user opted into. The threshold marker `*` only
 * applies to display tiers; rendering `security*` or `leak*` would
 * falsely imply they were filtered when they actually passed.
 */
function severityTally(data: ReviewData): string {
  const filtered = filteredTiers(data);
  const parts: string[] = [];
  let total = 0;
  // Carve-out tiers (security, leak) are counted toward `total` so the
  // empty-string early-return doesn't fire for a review whose only
  // postable findings are security/leak (otherwise the card renders
  // "0 inline findings" against validCommentCount ≥ 1 — misleading).
  // They are still skipped from the rendered tally line itself per
  // the carve-out invariant above.
  for (const level of SEVERITY_ORDER) {
    if (level in data.severityCounts) {
      total += data.severityCounts[level] ?? 0;
    }
    if (level === "security" || level === "leak") continue;
    const isPresent = level in data.severityCounts;
    const isFiltered = filtered.has(level);
    if (!isPresent && !isFiltered) continue;
    const count = data.severityCounts[level] ?? 0;
    const mark = isFiltered ? "*" : "";
    parts.push(`\`${count}\` ${level}${mark}`);
  }
  if (total === 0) return "";
  // When the display tiers render no parts (all postable findings are
  // carve-outs — security/leak), emit a special marker so the card
  // doesn't show a bare 🏷️ with no breakdown. Operators see at a
  // glance that findings exist but are carved out of the four-tier
  // display. Use wording that does NOT match the per-tier render
  // pattern `\`N\` security` so the existing carve-out invariant
  // (security/leak absent from the rendered tally) still holds.
  if (parts.length === 0) {
    const carveOutCount = (data.severityCounts["security"] ?? 0) +
      (data.severityCounts["leak"] ?? 0);
    return `🏷️ 🔒 \`${carveOutCount}\` carve-out only`;
  }
  return `🏷️ ${parts.join(" · ")}`;
}

/**
 * Canonical parse-fail banner string — the blockquote that a layout
 * emits immediately after the verdict badge when the provider returned
 * a non-JSON / unparseable response. CLARITY-10 invariant: the banner
 * must be unmistakable so a 0-finding review cannot be confused with
 * a clean bill of health.
 */
const PARSE_FAILED_BANNER =
  "> ⚠️ `Parse failed` — provider response was not a valid JSON review payload. The raw provider text is included in the Summary section below for diagnostics.";

/** Compose the standard footer line. */
function footer(data: ReviewData, overrideCount?: number): string {
  const safeModel = redact(data.modelId, data.secrets);
  const safeProvider = redact(data.provider, data.secrets);
  const count = overrideCount ?? data.validCommentCount;
  return `🤖 Generated by \`${safeModel}\` via \`${safeProvider}\` · ${count} inline`;
}

/** Sort posted comments by severity desc, then path asc — same invariant the existing code uses. */
function sortedPosted(data: ReviewData): readonly LiveReviewComment[] {
  return [...data.postedComments].sort((a, b) => {
    const ra = severityRank(a.severity);
    const rb = severityRank(b.severity);
    if (ra !== rb) return rb - ra;
    return a.path.localeCompare(b.path);
  });
}

// ---------------------------------------------------------------------------
// Shipped renderer — severity-table
// ---------------------------------------------------------------------------

export function renderCleanShip(data: ReviewData): string {
  const safeSummary = redact(data.review.summary, data.secrets);
  const banner = verdictEscalationBanner(data);
  const parts: string[] = [
    REVIEW_MARKER,
    "",
    "## ✅ 0 inline findings — ship it",
  ];
  if (banner.length > 0) {
    parts.push(banner);
  }
  parts.push("");
  if (safeSummary.trim().length > 0) {
    parts.push("<details>");
    parts.push("<summary>📝 Click to expand the full review summary</summary>");
    parts.push("");
    parts.push(safeSummary);
    parts.push("");
    parts.push("</details>");
    parts.push("");
  }
  // Footer + manifest. The footer mirrors the convention used by every
  // other layout (so downstream consumers that grep for "Generated by"
  // recognize this as a umactually body), but emits 0 inline so the
  // count stays consistent with the ship-it verdict.
  parts.push("---");
  parts.push(footer(data, 0));
  parts.push("");
  parts.push(resolutionGuide(data.platform ?? "github"));
  parts.push("");
  parts.push(manifest(data));
  return parts.join("\n");
}

export function layoutSeverityTable(data: ReviewData): string {
  const all = sortedPosted(data);
  const parts: string[] = [];

  // Clean-ship branch is hoisted to renderSummary so every layout
  // receives the same one-line verdict for empty, non-parse-failed
  // reviews. layoutSeverityTable only handles the populated-or-parse-failed
  // cases from here.

  // Marker first so dedup loops always find it (the contract that
  // GitHub/Azure dedup loops rely on). The verdict comes next so the
  // first non-marker line is the verdict badge (CLARITY-1 invariant).
  parts.push(REVIEW_MARKER);
  parts.push("");
  pushVerdict(parts, data);
  parts.push("");

  // CLARITY-10: parse-fail banner must be unmistakable. Rendered as a
  // blockquote immediately after the verdict so a 0-finding review
  // cannot be confused with a clean bill of health.
  if (data.review.parseFailed === true) {
    parts.push(PARSE_FAILED_BANNER);
    parts.push("");
  } else {
    parts.push(pipelineLine(data));
    const tally = severityTally(data);
    if (tally.length > 0) {
      parts.push(tally);
      const legend = severityTallyLegend(data);
      if (legend.length > 0) parts.push(legend);
    }
    // CLARITY-19a (retired): the off-diff callout used to explain why
    // the table has fewer rows than the model's gross output. Removed
    // — reviewers don't action off-diff findings (they target files
    // outside this PR's diff) and the "Off-diff: N" KPI tile in the
    // dashboard already exposes the count without noise.
    parts.push("");
  }

  parts.push("### 📋 Findings");
  parts.push("");
  // Mobile-friendly collapsible list. A GFM table at 576px viewport
  // auto-sizes each column to fit its widest cell, then wraps mid-word
  // (`#` column stacks "10" → "1"/"0", File:Line breaks inside
  // `summary-layouts` → `summa`/`ry-`/`layouts.ts`, Title truncates
  // mid-sentence, Severity header wraps to "Severit"/"y"). None of
  // those are fixable inside a GFM table because the renderer doesn't
  // expose column-width controls and `word-wrap: anywhere` will
  // character-break any unbreakable token that overflows even by 1px.
  //
  // `<details>`/`<summary>` is a native HTML element that GitHub's
  // GFM passes through (verified 2026-07-05 per file header; Azure
  // DevOps renders the same way in markdown). Each finding gets one
  // collapsed block: the summary shows severity emoji + word + the
  // first ~80 chars of the title; clicking expands to show the full
  // path, line number, and full title with no width constraints.
  //
  // Information previously encoded in table columns:
  //   #       → leading "N · " in the summary line
  //   Severity→ "🟠 Medium" (emoji + label, no width constraint)
  //   File:Line → first line of expanded body, prefixed with 📍
  //   Title  → first 80 chars in summary, full text in expanded body
  if (all.length === 0) {
    parts.push("_No findings to address._");
    parts.push("");
  } else {
    all.forEach((c, i) => {
      parts.push(findingsDetailsRow(i + 1, c, data.secrets, 80));
    });
    parts.push("");
  }

  if (data.review.summary.trim().length > 0) {
    const safeSummary = redact(data.review.summary, data.secrets);
    // Cross-platform note: <details>/<summary> renders as a collapsible
    // section on GitHub PR reviews (primary platform), but Azure DevOps
    // PR comments show the raw HTML. We accept that trade-off ONLY for
    // verbose summaries (>500 chars) — short summaries stay inline.
    // Threshold picked to match the "long/verbose" trigger the user
    // asked us to address; below it, the summary stays compact and
    // readable on both platforms.
    if (safeSummary.length > VERBOSE_THRESHOLD_CHARS) {
      parts.push("### 📝 Summary");
      parts.push("");
      parts.push("<details>");
      parts.push("<summary>📝 Click to expand the full review summary</summary>");
      parts.push("");
      parts.push(safeSummary);
      parts.push("");
      parts.push("</details>");
      parts.push("");
    } else {
      parts.push("### 📝 Summary");
      parts.push("");
      parts.push(safeSummary);
      parts.push("");
    }
  }

  parts.push("---");
  parts.push(footer(data));
  parts.push("");
  parts.push(resolutionGuide(data.platform ?? "github"));
  parts.push("");
  parts.push(manifest(data));
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Public dispatch
// ---------------------------------------------------------------------------

/**
 * Render a review summary using the single shipped layout.
 *
 * @param data Review data shape; same inputs as the existing
 *             `buildReviewBody` in `src/cli/live-shared.ts`.
 * @returns Markdown body string safe to post to GitHub PR reviews
 *          and Azure DevOps PR threads.
 */
export function renderSummary(data: ReviewData): string {
  if (data.postedComments === undefined) {
    throw new Error("renderSummary: data.postedComments is required (was undefined). Use buildReviewBody() to dispatch — it computes the post-filter set from review.comments.");
  }
  if (data.validCommentCount === undefined) {
    throw new Error("renderSummary: data.validCommentCount is required (was undefined). The clean-ship gate cannot fire on undefined === 0; pass the count of comments that survived all filter layers.");
  }
  if (data.suppressedCommentCount === undefined) {
    throw new Error("renderSummary: data.suppressedCommentCount is required (was undefined). Pass the count of comments the verified-facts + confidence filters dropped.");
  }
  // Clean-ship gate is enforced at the entry point so every layout
  // gets the same one-line verdict for empty, non-parse-failed reviews.
  // Suppressed findings (confidence/verified-facts filtered) don't
  // count against the reviewer — they're pipeline-internal noise the
  // filter already handled. Only parseFailed short-circuits to a verbose
  // layout so the operator sees the raw response.
  //
  // Reconciliation-bypass carve-out: when the raw verdict was
  // reconciled (downgraded NEEDS_FIX→COMMENT or upgraded SHIP→NEEDS_FIX)
  // AND there are no postable findings, `renderCleanShip` still
  // surfaces the escalation banner so the clean-ship body doesn't
  // hide the raw→effective flip from a scanning reviewer.
  if (
    data.validCommentCount === 0 &&
    data.review.parseFailed !== true &&
    data.verdictEscalatedFrom === undefined
  ) {
    return renderCleanShip(data);
  }
  return layoutSeverityTable(data);
}
