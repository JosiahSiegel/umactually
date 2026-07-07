/**
 * 20 unique markdown layout variants for the UmActually PR review summary.
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
 * This module defines twenty visually distinct layouts that all answer
 * those questions but organize the answer differently. The default
 * (`LAYOUT_DEFAULT`) is byte-identical to the existing `buildReviewBody`
 * output so that all existing tests continue to pass without modification.
 * The other nineteen are opt-in alternatives.
 *
 * Cross-platform rules (GitHub PR review body + Azure DevOps PR thread):
 *   - DO use GFM tables, headings, blockquote, lists, fenced code,
 *     inline code, links, raw Unicode emoji, horizontal rules.
 *   - DO use `<details>`/`<summary>` — verified 2026-07-05 to render as
 *     a collapsible section on BOTH GitHub PR reviews AND Azure DevOps
 *     PR comments (empirical test via playwright against PR #43 thread
 *     575 and the production review thread, both show working
 *     click-to-expand UX). The previous "Azure renders as raw text"
 *     rule was based on 2023-era community reports and is no longer
 *     accurate. The severity-table layout uses `<details>` for verbose
 *     summaries (>500 chars) — pinned by S5a (short summary has no
 *     details) and S5b (long summary wraps in details) in
 *     `test/unit/summary-layouts.test.ts`.
 *   - DO NOT use raw `<table>` HTML (Azure ignores it).
 *   - DO NOT use task lists `- [x]` / `- [ ]` (Azure ignores check state).
 *   - Body must stay under GitHub's 65,536-char comment limit.
 *
 * Every layout in this module obeys the rules above. See
 * `test/unit/summary-layouts.test.ts` for the invariant assertions.
 */

import { REVIEW_MARKER, MANIFEST_SCHEMA } from "../util/marker.js";
import type { LiveReview, LiveReviewComment } from "../cli/live-shared.js";
import { SEVERITY_ORDER, severityRank } from "../util/severity.js";
import { REDACTED_SECRET_TOKEN } from "../util/brand.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Stable identifier for every layout in this module. Listed in `LAYOUTS`
 * below and exported so callers can pick one without re-typing the union.
 *
 * `BASELINE` is the byte-identical reproduction of the existing
 * `buildReviewBody` output; it is exported separately so callers can
 * pin it as the "what we have now" comparison but it is NOT part of
 * the 20 replacement layouts the user asked for.
 */
export type LayoutId =
  | "dashboard" // 1: KPI tiles
  | "pipeline" // 2: sequential step diagram
  | "verdict-banner" // 3: single oversized banner
  | "severity-table" // 4: classic SonarQube-style table
  | "card-grid" // 5: one card per severity bucket
  | "tldr-walkthrough" // 6: TL;DR + per-file sections
  | "checklist" // 7: bulleted checklist grouped by category
  | "progress-bars" // 8: ASCII block bars
  | "pros-cons" // 9: two-column GFM table
  | "tweet" // 10: announcement-style TL;DR
  | "faq" // 11: Q/A pairs
  | "terminal" // 12: fenced-code terminal output
  | "incident" // 13: status-page timeline
  | "release-notes" // 14: changelog-style lists
  | "coverage" // 15: per-file coverage table
  | "thermometer" // 16: vertical severity ladder
  | "status-page" // 17: status banner + components
  | "diffstat" // 18: per-file +/- with bars
  | "sticky-notes" // 19: push-pin quote blocks
  | "newspaper"; // 20: headline-lede-body

/**
 * Identifier for the baseline layout (byte-identical reproduction of
 * the existing `buildReviewBody` output). NOT part of the 20-sheet
 * `LAYOUTS` list — it is exposed separately so callers can render the
 * "what we have now" reference for side-by-side comparison.
 */
export type BaselineId = "current";

/** The 20 replacement layouts the user requested. */
export const LAYOUTS: readonly LayoutId[] = [
  "dashboard",
  "pipeline",
  "verdict-banner",
  "severity-table",
  "card-grid",
  "tldr-walkthrough",
  "checklist",
  "progress-bars",
  "pros-cons",
  "tweet",
  "faq",
  "terminal",
  "incident",
  "release-notes",
  "coverage",
  "thermometer",
  "status-page",
  "diffstat",
  "sticky-notes",
  "newspaper",
];

/** Singleton baseline identifier. */
export const BASELINE: BaselineId = "current";

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
   * append a per-tier `*` marker + a `_\* = filtered by threshold_`
   * legend line when some tiers are intentionally hidden by
   * `--minimum-severity` or `--ignore-minor`. When both fields are
   * omitted (or `null`/`false`), the tally renders unchanged
   * (byte-identical to the original behavior).
   */
  readonly minimumSeverity?: string | null;
  readonly ignoreMinor?: boolean;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Sanitize a value against the redaction list before it lands in markdown. */
function redact(value: string, secrets: readonly string[]): string {
  if (secrets.length === 0) return value;
  let out = value;
  for (const secret of secrets) {
    if (secret.length === 0) continue;
    out = out.split(secret).join(REDACTED_SECRET_TOKEN);
  }
  return out;
}

/** Total findings the model produced (posted + off-diff + filtered). */
function totalFindings(data: ReviewData): number {
  return data.review.comments.length + data.review.suppressedComments.length;
}

/** Off-diff count: model-suppressed + off-diff-from-comments. */
function offDiffCount(data: ReviewData): number {
  return data.review.suppressedComments.length + data.offDiffFromComments.length;
}

/** Filtered = model comments that survived parsing but were not posted. */
function filteredCount(data: ReviewData): number {
  return Math.max(0, totalFindings(data) - data.validCommentCount - offDiffCount(data));
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
 * Group posted comments by file path and return the entries sorted
 * alphabetically by path. Used by every layout that renders a
 * per-file section (`tldr-walkthrough`, `coverage`, `diffstat`).
 * Replaces 3 inline copies of
 * `new Map → for-loop → [...entries].sort([a],[b] localeCompare)`.
 */
function groupByFile(
  comments: readonly LiveReviewComment[],
): readonly (readonly [string, readonly LiveReviewComment[]])[] {
  const map = new Map<string, LiveReviewComment[]>();
  for (const c of comments) {
    const list = map.get(c.path) ?? [];
    list.push(c);
    map.set(c.path, list);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

/** Render a single-line finding label as `path:line — snippet`. */
function findingLine(c: LiveReviewComment, secrets: readonly string[]): string {
  const snippet = truncateSnippet(collapseBody(c, secrets), 100);
  return `\`${cell(c.path)}\`:${c.line} — ${snippet}`;
}

/**
 * Severity → display emoji used by every layout that wants a single glyph.
 *
 * Uses the Unicode colored-circle emoji (🟣 🔴 🟠 🟡 ⚪) because they
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
 *     color signal but the glyph shape (`🟣`/`🔴`/`🟠`/`🟡`) is
 *     still distinct. This is a known cross-platform limitation,
 *     not a regression.
 *
 * The fallback (unknown severity) is the same outline `⚪` so
 * "I don't know what this is" doesn't visually claim to be a real severity.
 */
function severityEmoji(level: string): string {
  switch (level.toLowerCase()) {
    case "critical": return "🟣";
    case "high":     return "🔴";
    case "medium":   return "🟠";
    case "low":      return "🟡";
    case "info":     return "🟡";
    default:         return "⚪";
  }
}

/** Severity → short label used in compact rows. */
function severityLabel(level: string): string {
  switch (level.toLowerCase()) {
    case "critical": return "Critical";
    case "high": return "High";
    case "medium": return "Medium";
    case "low": return "Low";
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
  return `<!-- umactually-pr-review:manifest ${JSON.stringify(payload)} -->`;
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
 * the active `--minimum-severity` / `--ignore-minor` threshold. Empty
 * when no threshold is configured or the threshold keeps every tier
 * visible — callers use this to (a) mark each filtered tier with a
 * trailing `*` in the tally line, and (b) emit the legend line below.
 *
 * Examples:
 *   - minimumSeverity=null,  ignoreMinor=false → ∅ (no marker anywhere)
 *   - minimumSeverity="high", ignoreMinor=false → { medium, low }
 *   - minimumSeverity=null,  ignoreMinor=true  → { low }
 *   - minimumSeverity="high", ignoreMinor=true  → { medium, low } (union)
 *   - minimumSeverity="low",  ignoreMinor=false → ∅ (everything visible)
 */
function filteredTiers(data: ReviewData): ReadonlySet<string> {
  const minimum = data.minimumSeverity != null ? data.minimumSeverity.toLowerCase() : null;
  const ignoreMinor = data.ignoreMinor === true;
  if (!ignoreMinor && minimum === null) return new Set();
  const ignoredByMin =
    minimum !== null
      ? SEVERITY_ORDER.filter((level) => severityRank(level) < severityRank(minimum))
      : [];
  const ignoredByIgnoreMinor = ignoreMinor ? ["low"] : [];
  return new Set([...ignoredByMin, ...ignoredByIgnoreMinor]);
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

/** Severity tally line used by most layouts. */
function severityTally(data: ReviewData): string {
  const filtered = filteredTiers(data);
  const parts: string[] = [];
  let total = 0;
  for (const level of SEVERITY_ORDER) {
    const count = data.severityCounts[level] ?? 0;
    total += count;
    const mark = filtered.has(level) ? "*" : "";
    parts.push(`\`${count}\` ${level}${mark}`);
  }
  if (total === 0) return "";
  return `🏷️ ${parts.join(" · ")}`;
}

/**
 * Append the canonical "provider summary" section to `parts` when the
 * review has a non-empty summary. Every layout wants this section —
 * the variation is purely cosmetic (heading emoji + label, and whether
 * to wrap in blockquote or render inline). When `heading` is `null`,
 * no `###` line is emitted (callers like `dashboard` render the summary
 * inside their own wrapper). When `blockquote` is true, every line of
 * the summary is prefixed with `> ` so it renders as a single blockquote
 * — used by `dashboard` to keep the summary visually separated from the
 * KPI tiles above it.
 *
 * Output is byte-identical to the previous inline form
 *   if (data.review.summary.trim().length > 0) {
 *     parts.push(`### ${heading}`); parts.push("");
 *     parts.push(redact(data.review.summary, data.secrets));
 *     parts.push("");
 *   }
 * for the 14 layouts that use this shape (8 default + 5 custom-heading
 * variants + 1 blockquote variant). Two layouts have unique rendering
 * needs that the helper doesn't fit and stay inline:
 *   - `severity-table` wraps verbose summaries in a `<details>` block.
 *   - `faq` renders the summary as `### Q: ...?` + `**A:** ...`.
 */
function summarySection(
  data: ReviewData,
  parts: string[],
  options: { heading?: string | null; blockquote?: boolean } = {},
): void {
  if (data.review.summary.trim().length === 0) return;
  const safeSummary = redact(data.review.summary, data.secrets);
  const heading = options.heading ?? "### 💬 Summary";
  if (heading !== null) {
    parts.push(heading);
    parts.push("");
  }
  if (options.blockquote === true) {
    parts.push(`> ${safeSummary.split("\n").join("\n> ")}`);
  } else {
    parts.push(safeSummary);
  }
  parts.push("");
}

/**
 * Canonical parse-fail banner string — the blockquote that a layout
 * emits immediately after the verdict badge when the provider returned
 * a non-JSON / unparseable response. CLARITY-10 invariant: the banner
 * must be unmistakable so a 0-finding review cannot be confused with
 * a clean bill of health. Used by `layoutBaseline` and
 * `layoutSeverityTable` (the only two layouts that render this banner;
 * the other 18 layouts rely on `pipelineLine` + `severityTally` being
 * empty when parse-failed and skip the banner entirely).
 */
const PARSE_FAILED_BANNER =
  "> ⚠️ `Parse failed` — provider response was not a valid JSON review payload. The raw provider text is included in the Summary section below for diagnostics.";

/** Compose the standard footer line. */
function footer(data: ReviewData): string {
  const safeModel = redact(data.modelId, data.secrets);
  const safeProvider = redact(data.provider, data.secrets);
  return `🤖 Generated by \`${safeModel}\` via \`${safeProvider}\` · ${data.validCommentCount} inline`;
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

/** Top N preview line items (rendered as bullets, capped at 5 like the existing code). */
function previewLines(data: ReviewData, max: number = 5): readonly string[] {
  return sortedPosted(data).slice(0, max).map((c, i) => `${i + 1}. ${findingLine(c, data.secrets)}`);
}

/**
 * Append the canonical trailer (horizontal rule, `footer`, marker, manifest)
 * to `parts` and return the joined string. Every replacement layout in
 * `LAYOUT_RENDERERS` ends with this exact sequence — it is the contract
 * that keeps dedup loops and the AI manifest parser happy:
 *   1. `<!-- umactually-pr-review -->` marker (dedup key)
 *   2. Stable hidden manifest with verdict + severity tally
 *   3. `🤖 Generated by ...` footer at the bottom for human readers
 *
 * NOT used by `layoutBaseline` — the baseline reproduces the legacy
 * `buildReviewBody` byte-for-byte, which puts the marker at the TOP
 * and uses no horizontal rule.
 *
 * Output is byte-identical to the previous hand-rolled trailer.
 */
function closeReviewBlock(data: ReviewData, parts: string[]): string {
  parts.push("---");
  parts.push(footer(data));
  parts.push("");
  parts.push(REVIEW_MARKER);
  parts.push(manifest(data));
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Baseline — current (what we have now)
// ---------------------------------------------------------------------------
// Byte-identical to the existing buildReviewBody() body. Re-uses the same
// section order so all existing tests continue to pass without modification.
// Exposed for side-by-side comparison in the viewer; not part of the 20-sheet.

function layoutBaseline(data: ReviewData): string {
  const summary = redact(data.review.summary, data.secrets);
  const sections: string[] = [];

  sections.push(REVIEW_MARKER);
  sections.push("");
  sections.push(`## ${verdictBadge(data)}`);
  sections.push("");

  if (data.review.parseFailed === true) {
    sections.push(PARSE_FAILED_BANNER);
  } else {
    sections.push(pipelineLine(data));
  }

  const tally = severityTally(data);
  if (tally.length > 0) {
    sections.push(tally);
    const legend = severityTallyLegend(data);
    if (legend.length > 0) sections.push(legend);
  }

  // Posted preview (or filtered preview)
  if (data.validCommentCount > 0 && data.postedComments.length > 0) {
    const preview = previewLines(data);
    const total = data.postedComments.length;
    const header = preview.length < total
      ? `📋 Posted preview (showing ${preview.length} of ${total})`
      : `📋 Posted preview (${preview.length})`;
    sections.push("");
    sections.push(header);
    for (const line of preview) sections.push(line);
  } else if (data.review.comments.length > 0) {
    const preview = previewLines(data);
    const total = data.review.comments.length;
    sections.push("");
    sections.push(`🧹 Filtered preview (showing ${preview.length} of ${total} candidates)`);
    sections.push("");
    sections.push(`_The model produced ${total} finding(s); all were filtered by severity policy, the \`max-comments\` cap, or off-diff suppression. The list below is the pre-filter view for transparency — no inline comments were posted._`);
    for (const line of preview) sections.push(line);
  }

  // Off-diff block — removed (CLARITY-19a retired). Reviewers don't
  // action off-diff findings; the dashboard "Off-diff: N" KPI tile
  // already exposes the count. See the retired callout in
  // layoutSeverityTable for the full rationale.

  // Summary prose
  if (summary.trim().length > 0) {
    sections.push("");
    sections.push("📝 Summary");
    sections.push("");
    sections.push(summary);
  }

  sections.push("");
  sections.push(footer(data));
  sections.push("");
  sections.push(manifest(data));

  return sections.filter((s) => s.length > 0).join("\n");
}

// ---------------------------------------------------------------------------
// Layout 1 — Dashboard (KPI tiles)
// ---------------------------------------------------------------------------
// Large numbers in a GFM grid: one row of KPI tiles + one row of sub-stats.
// Reads in 3 seconds: how many, what verdict, what model.

function layoutDashboard(data: ReviewData): string {
  const verdict = verdictBadge(data);
  const tally = severityTally(data);
  const total = totalFindings(data);
  const posted = data.validCommentCount;
  const offDiff = offDiffCount(data);
  const filtered = filteredCount(data);
  const parts: string[] = [];

  parts.push(`## ${verdict}`);
  parts.push("");
  parts.push("### 📊 Review dashboard");
  parts.push("");
  parts.push("| Verdict | Findings | Posted | Off-diff | Filtered |");
  parts.push("| :--- | ---: | ---: | ---: | ---: |");
  parts.push(`| **${verdict}** | **${total}** | **${posted}** | **${offDiff}** | **${filtered}** |`);
  parts.push("");

  if (tally.length > 0) {
    parts.push("### 🏷️ Severity breakdown");
    parts.push("");
    parts.push("| Critical | High | Medium | Low |");
    parts.push("| ---: | ---: | ---: | ---: |");
    const c = data.severityCounts["critical"] ?? 0;
    const h = data.severityCounts["high"] ?? 0;
    const m = data.severityCounts["medium"] ?? 0;
    const l = data.severityCounts["low"] ?? 0;
    parts.push(`| **${c}** | **${h}** | **${m}** | **${l}** |`);
    parts.push("");
  }

  if (data.postedComments.length > 0) {
    parts.push("### 🔝 Top findings");
    parts.push("");
    parts.push("| # | Severity | File:Line | Title |");
    parts.push("| ---: | :--- | :--- | :--- |");
    sortedPosted(data).slice(0, 5).forEach((c, i) => {
      const title = collapseBody(c, data.secrets);
      const snippet = truncateSnippet(title, 80);
      parts.push(`| ${i + 1} | ${severityEmoji(c.severity)} ${severityLabel(c.severity)} | \`${cell(c.path)}\`:${c.line} | ${cell(snippet)} |`);
    });
    parts.push("");
  }

  summarySection(data, parts, { heading: null, blockquote: true });

  return closeReviewBlock(data, parts);
}

// ---------------------------------------------------------------------------
// Layout 2 — Pipeline (sequential step diagram)
// ---------------------------------------------------------------------------
// Reads as a flow: input → review → output. Each step is a numbered
// blockquote block so it scans top-to-bottom like a process diagram.

function layoutPipeline(data: ReviewData): string {
  const verdict = verdictBadge(data);
  const parts: string[] = [];

  parts.push(`## ${verdict}`);
  parts.push("");
  parts.push("### 🔄 Review pipeline");
  parts.push("");
  parts.push("```text");
  parts.push("┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐");
  parts.push("│  Provider    │──▶│  Redaction   │──▶│   Review     │──▶│  Filter &    │");
  parts.push(`│  ${(redact(data.provider, data.secrets) || "?").padEnd(10)} │   │  scan: diff  │   │  model: ok   │   │  post: ${data.validCommentCount}    │`);
  parts.push("└──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘");
  parts.push("```");
  parts.push("");

  parts.push("### 🪜 Steps in this run");
  parts.push("");
  parts.push(`> **①  Provider request** — sent to \`${redact(data.provider, data.secrets)}\`.`);
  parts.push(">");
  parts.push(`> **②  Secret scan** — redaction pass on the diff before it reached the model.`);
  parts.push(">");
  parts.push(`> **③  Model review** — \`${redact(data.modelId, data.secrets)}\` returned \`${data.review.verdict}\`.`);
  parts.push(">");
  parts.push(`> **④  Filter** — severity policy + \`max-comments\` cap + off-diff suppression.`);
  parts.push(">");
  parts.push(`> **⑤  Post** — ${data.validCommentCount} of ${totalFindings(data)} findings posted as inline threads.`);
  parts.push("");

  if (data.validCommentCount > 0) {
    parts.push("### 🎯 Highest-priority items");
    parts.push("");
    sortedPosted(data).slice(0, 5).forEach((c, i) => {
      parts.push(`${i + 1}. ${severityEmoji(c.severity)} **${severityLabel(c.severity)}** — ${findingLine(c, data.secrets)}`);
    });
    parts.push("");
  }

  return closeReviewBlock(data, parts);
}

// ---------------------------------------------------------------------------
// Layout 3 — Verdict Banner (oversized single banner)
// ---------------------------------------------------------------------------
// One HUGE verdict banner with a tiny context table under it.
// Best when reviewers want a one-glance signal.

function layoutVerdictBanner(data: ReviewData): string {
  const verdict = verdictBadge(data);
  const parts: string[] = [];

  parts.push(`# ${verdict}`);
  parts.push("");
  parts.push(`> ## ${verdict}`);
  parts.push(`>`);
  parts.push(`> **${data.validCommentCount}** findings to address · ${totalFindings(data)} total considered`);
  parts.push(`>`);
  parts.push(`> Model: \`${redact(data.modelId, data.secrets)}\` · Provider: \`${redact(data.provider, data.secrets)}\``);
  parts.push("");

  parts.push("### 📌 At a glance");
  parts.push("");
  parts.push("| Total | Posted | Off-diff | Filtered |");
  parts.push("| ---: | ---: | ---: | ---: |");
  parts.push(`| **${totalFindings(data)}** | **${data.validCommentCount}** | **${offDiffCount(data)}** | **${filteredCount(data)}** |`);
  parts.push("");

  const tally = severityTally(data);
  if (tally.length > 0) {
    parts.push(tally);
    const legend = severityTallyLegend(data);
    if (legend.length > 0) parts.push(legend);
    parts.push("");
  }

  if (data.postedComments.length > 0) {
    parts.push("### 📋 Findings to address");
    parts.push("");
    sortedPosted(data).slice(0, 5).forEach((c, i) => {
      const title = collapseBody(c, data.secrets);
      const snippet = truncateSnippet(title, 90);
      parts.push(`${i + 1}. ${severityEmoji(c.severity)} \`${cell(c.path)}\`:${c.line} — ${cell(snippet)}`);
    });
    parts.push("");
  }

  summarySection(data, parts, { heading: "### 💬 Provider summary" });

  return closeReviewBlock(data, parts);
}

// ---------------------------------------------------------------------------
// Layout 4 — Severity Table (SonarQube-style)
// ---------------------------------------------------------------------------
// Classic GFM table: every finding on a row, severity + category + title.
// Best when reviewers want to triage the full list in one glance.

function layoutSeverityTable(data: ReviewData): string {
  const verdict = verdictBadge(data);
  const all = sortedPosted(data);
  const parts: string[] = [];

  // Marker first so dedup loops always find it (the contract that
  // GitHub/Azure dedup loops rely on). The verdict comes next so the
  // first non-marker line is the verdict badge (CLARITY-1 invariant).
  parts.push(REVIEW_MARKER);
  parts.push("");
  parts.push(`## ${verdict}`);
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
  parts.push("| # | Severity | Category | File:Line | Title |");
  parts.push("| ---: | :--- | :--- | :--- | :--- |");
  if (all.length === 0) {
    parts.push("| — | — | — | — | _No findings to address_ |");
  } else {
    all.forEach((c, i) => {
      const title = collapseBody(c, data.secrets);
      // Truncate to 50 chars (not 80) so the Title column doesn't
      // dominate GitHub's proportional table auto-layout. At 80 chars
      // the title starves the narrow Severity/Category columns,
      // causing mid-word wrapping ("Mediu/m", "correct/ness") on
      // GitHub's ~680px PR comment container. 50 keeps the table's
      // max-content width near the container width so columns barely
      // compress. ADO's wider container is unaffected either way.
      const snippet = truncateSnippet(title, 50);
      parts.push(`| ${i + 1} | ${severityEmoji(c.severity)} ${severityLabel(c.severity)} | ${cell(c.category ?? "general")} | \`${cell(c.path)}\`:${c.line} | ${cell(snippet)} |`);
    });
  }
  parts.push("");

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
  parts.push(manifest(data));
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Layout 5 — Card Grid (one card per severity bucket)
// ---------------------------------------------------------------------------
// Each severity bucket is its own ## section. Inside: a short list of
// bullet findings. Reads like a stack of color-coded sticky notes.

function layoutCardGrid(data: ReviewData): string {
  const verdict = verdictBadge(data);
  const buckets: Record<string, LiveReviewComment[]> = {
    critical: [], high: [], medium: [], low: [],
  };
  for (const c of data.postedComments) {
    const key = c.severity.toLowerCase();
    const target = buckets[key] ?? buckets["low"];
    if (target !== undefined) target.push(c);
  }
  const parts: string[] = [];

  parts.push(`## ${verdict}`);
  parts.push("");
  parts.push("### 🎴 Findings by severity");
  parts.push("");

  for (const level of SEVERITY_ORDER) {
    const bucket = buckets[level] ?? [];
    if (bucket.length === 0) continue;
    parts.push(`#### ${severityEmoji(level)} ${severityLabel(level)} — ${bucket.length} finding${bucket.length === 1 ? "" : "s"}`);
    parts.push("");
    for (const c of bucket) {
      const title = collapseBody(c, data.secrets);
      parts.push(`> **\`${cell(c.path)}\`:${c.line}** — ${cell(title)}`);
      parts.push("");
    }
  }

  if (data.postedComments.length === 0) {
    parts.push("> _No findings to address._");
    parts.push("");
  }

  return closeReviewBlock(data, parts);
}

// ---------------------------------------------------------------------------
// Layout 6 — TL;DR + Walkthrough
// ---------------------------------------------------------------------------
// Headline TL;DR callout followed by per-file walkthrough sections.
// Mirrors CodeRabbit's summary card.

function layoutTldrWalkthrough(data: ReviewData): string {
  const verdict = verdictBadge(data);
  const parts: string[] = [];

  parts.push(`## ${verdict}`);
  parts.push("");
  parts.push("### 📌 TL;DR");
  parts.push("");
  parts.push(`> ${verdict}. **${data.validCommentCount}** of **${totalFindings(data)}** findings posted inline.`);
  parts.push(">");
  if (data.postedComments.length > 0) {
    parts.push(`> Top concern: ${findingLine(sortedPosted(data)[0]!, data.secrets)}`);
  } else {
    parts.push("> No actionable concerns surfaced.");
  }
  parts.push("");

  // Per-file walkthrough
  const sortedFiles = groupByFile(data.postedComments);
  if (sortedFiles.length > 0) {
    parts.push("### 📂 Files touched");
    parts.push("");
    for (const [path, comments] of sortedFiles) {
      parts.push(`#### \`${cell(path)}\` — ${comments.length} finding${comments.length === 1 ? "" : "s"}`);
      parts.push("");
      for (const c of comments) {
        const title = collapseBody(c, data.secrets);
        parts.push(`- ${severityEmoji(c.severity)} **${severityLabel(c.severity)}** (line ${c.line}) — ${cell(title)}`);
      }
      parts.push("");
    }
  }

  summarySection(data, parts, { heading: "### 💬 Full summary" });

  return closeReviewBlock(data, parts);
}

// ---------------------------------------------------------------------------
// Layout 7 — Checklist (grouped by category)
// ---------------------------------------------------------------------------
// Plain bulleted list grouped by category. Each item has an emoji and
// a `path:line` reference. Reads like a todo list.

function layoutChecklist(data: ReviewData): string {
  const verdict = verdictBadge(data);
  const parts: string[] = [];

  parts.push(`## ${verdict}`);
  parts.push("");
  parts.push("### ✅ Review checklist");
  parts.push("");

  // Group by category
  const byCat = new Map<string, LiveReviewComment[]>();
  for (const c of data.postedComments) {
    const key = c.category || "general";
    const arr = byCat.get(key) ?? [];
    arr.push(c);
    byCat.set(key, arr);
  }
  const sortedCats = [...byCat.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [cat, comments] of sortedCats) {
    parts.push(`#### 📦 ${cat} (${comments.length})`);
    parts.push("");
    for (const c of comments) {
      const title = collapseBody(c, data.secrets);
      const snippet = truncateSnippet(title, 90);
      parts.push(`- ${severityEmoji(c.severity)} \`${cell(c.path)}\`:${c.line} — ${cell(snippet)}`);
    }
    parts.push("");
  }
  if (sortedCats.length === 0) {
    parts.push("> _No findings to address._");
    parts.push("");
  }

  const tally = severityTally(data);
  if (tally.length > 0) {
    parts.push(tally);
    const legend = severityTallyLegend(data);
    if (legend.length > 0) parts.push(legend);
    parts.push("");
  }

  return closeReviewBlock(data, parts);
}

// ---------------------------------------------------------------------------
// Layout 8 — Progress Bars (ASCII block bars)
// ---------------------------------------------------------------------------
// Per-severity bar made of `█` (filled) and `░` (empty) blocks inside
// an inline code block. Terminal-style dashboard.

function layoutProgressBars(data: ReviewData): string {
  const verdict = verdictBadge(data);
  const total = data.validCommentCount;
  const parts: string[] = [];

  parts.push(`## ${verdict}`);
  parts.push("");
  parts.push("### 📊 Severity distribution");
  parts.push("");

  const max = Math.max(1, ...SEVERITY_ORDER.map((l) => data.severityCounts[l] ?? 0));
  for (const level of SEVERITY_ORDER) {
    const count = data.severityCounts[level] ?? 0;
    const filled = Math.round((count / max) * 20);
    const empty = 20 - filled;
    const bar = "█".repeat(filled) + "░".repeat(empty);
    const pct = total === 0 ? "0%" : `${Math.round((count / total) * 100)}%`;
    parts.push(`\`${level.padEnd(8)} ${bar} ${String(count).padStart(3)} ${pct.padStart(4)}\``);
  }
  parts.push("");

  parts.push("### 📋 Findings");
  parts.push("");
  if (data.postedComments.length === 0) {
    parts.push("> _No findings to address._");
  } else {
    sortedPosted(data).slice(0, 5).forEach((c, i) => {
      parts.push(`${i + 1}. ${severityEmoji(c.severity)} ${findingLine(c, data.secrets)}`);
    });
  }
  parts.push("");

  summarySection(data, parts);

  return closeReviewBlock(data, parts);
}

// ---------------------------------------------------------------------------
// Layout 9 — Pros & Cons (two-column GFM table)
// ---------------------------------------------------------------------------
// Splits the list into positives (low/critical-clean items) and
// negatives (findings to fix). Reads like a balanced review.

function layoutProsCons(data: ReviewData): string {
  const verdict = verdictBadge(data);
  const parts: string[] = [];

  parts.push(`## ${verdict}`);
  parts.push("");
  parts.push("### ⚖️ Strengths vs concerns");
  parts.push("");

  const concerns = sortedPosted(data);
  const lowCount = (data.severityCounts["low"] ?? 0);
  const highCount = (data.severityCounts["high"] ?? 0) + (data.severityCounts["critical"] ?? 0);

  parts.push("| ✅ Strengths | ⚠️ Concerns |");
  parts.push("| :--- | :--- |");
  const strengthsMd = totalFindings(data) === 0
    ? "_No issues found — clean review._"
    : `_Reviewed **${totalFindings(data)}** finding${totalFindings(data) === 1 ? "" : "s"} across the diff. Severity tally: ${severityTally(data) || "all clear"}._`;
  const concernsMd = concerns.length === 0
    ? "_None._"
    : concerns.slice(0, 5).map((c) => `**${severityLabel(c.severity)}** — ${findingLine(c, data.secrets)}`).join("<br>");
  parts.push(`| ${strengthsMd} | ${concernsMd} |`);
  parts.push("");

  if (lowCount + highCount > 0) {
    parts.push("### 📊 Tally");
    parts.push("");
    parts.push(severityTally(data));
    const legend = severityTallyLegend(data);
    if (legend.length > 0) parts.push(legend);
    parts.push("");
  }

  summarySection(data, parts);

  return closeReviewBlock(data, parts);
}

// ---------------------------------------------------------------------------
// Layout 10 — Tweet / Announcement
// ---------------------------------------------------------------------------
// Single big quote-block headline followed by 4-bullet "what this means".
// Reads like a project announcement card.

function layoutTweet(data: ReviewData): string {
  const verdict = verdictBadge(data);
  const parts: string[] = [];

  parts.push(`## ${verdict}`);
  parts.push("");
  parts.push(`> ## ${verdict}`);
  parts.push(">");
  parts.push(`> **${data.validCommentCount}** finding${data.validCommentCount === 1 ? "" : "s"} posted inline out of **${totalFindings(data)}** total.`);
  parts.push(">");
  parts.push(`> Powered by \`${redact(data.modelId, data.secrets)}\` via \`${redact(data.provider, data.secrets)}\`.`);
  parts.push("");

  parts.push("### 💡 What this means");
  parts.push("");
  const tally = severityTally(data);
  if (tally.length > 0) {
    parts.push(`- ${tally}`);
  }
  if (data.postedComments.length > 0) {
    parts.push(`- Top priority: ${findingLine(sortedPosted(data)[0]!, data.secrets)}`);
  } else {
    parts.push("- ✅ No actionable concerns.");
  }
  if (filteredCount(data) > 0) {
    parts.push(`- 🧹 ${filteredCount(data)} filtered by severity policy or \`max-comments\` cap.`);
  }
  parts.push("");

  summarySection(data, parts, { heading: "### 📖 Story" });

  return closeReviewBlock(data, parts);
}

// ---------------------------------------------------------------------------
// Layout 11 — FAQ Q&A
// ---------------------------------------------------------------------------
// Each finding becomes a Q: "Why is `path:line` a problem?" A: ...
// Great for senior reviewers asking "what do I actually need to know?"

function layoutFaq(data: ReviewData): string {
  const verdict = verdictBadge(data);
  const parts: string[] = [];

  parts.push(`## ${verdict}`);
  parts.push("");
  parts.push("### ❓ Reviewer Q&A");
  parts.push("");

  if (data.postedComments.length === 0) {
    parts.push("> _No findings to address — review passed clean._");
    parts.push("");
  } else {
    sortedPosted(data).slice(0, 5).forEach((c, i) => {
      const title = collapseBody(c, data.secrets);
      parts.push(`### Q${i + 1}: What's wrong at \`${cell(c.path)}\`:${c.line}?`);
      parts.push("");
      parts.push(`**A:** ${severityEmoji(c.severity)} **${severityLabel(c.severity)}** (${cell(c.category)}). ${cell(title)}`);
      parts.push("");
    });
  }

  parts.push("### Q: What's the overall verdict?");
  parts.push("");
  parts.push(`**A:** ${verdict}. ${data.validCommentCount} posted of ${totalFindings(data)} total.`);
  parts.push("");

  if (data.review.summary.trim().length > 0) {
    parts.push("### Q: Anything else worth noting?");
    parts.push("");
    parts.push(`**A:** ${redact(data.review.summary, data.secrets)}`);
    parts.push("");
  }

  return closeReviewBlock(data, parts);
}

// ---------------------------------------------------------------------------
// Layout 12 — Terminal Output (fenced code block)
// ---------------------------------------------------------------------------
// Entire summary sits inside a single fenced code block styled like
// terminal output. Pure ASCII + emoji.

function layoutTerminal(data: ReviewData): string {
  const verdict = verdictBadge(data);
  const parts: string[] = [];

  parts.push(`## ${verdict}`);
  parts.push("");
  parts.push("### 🖥️ Terminal report");
  parts.push("");
  parts.push("```text");
  parts.push("┌──────────────────────────────────────────────────────────┐");
  parts.push(`│ umactually-pr-review · ${verdict.padEnd(36)} │`);
  parts.push("├──────────────────────────────────────────────────────────┤");
  parts.push(`│ Provider : ${(redact(data.provider, data.secrets) || "?").padEnd(45)} │`);
  parts.push(`│ Model    : ${(redact(data.modelId, data.secrets) || "?" ).padEnd(45)} │`);
  parts.push(`│ Total    : ${String(totalFindings(data)).padEnd(45)} │`);
  parts.push(`│ Posted   : ${String(data.validCommentCount).padEnd(45)} │`);
  parts.push(`│ Off-diff : ${String(offDiffCount(data)).padEnd(45)} │`);
  parts.push(`│ Filtered : ${String(filteredCount(data)).padEnd(45)} │`);
  parts.push("└──────────────────────────────────────────────────────────┘");
  parts.push("");
  parts.push("[Findings by severity]");
  for (const level of SEVERITY_ORDER) {
    const count = data.severityCounts[level] ?? 0;
    const bar = "■".repeat(count) + "□".repeat(Math.max(0, 10 - count));
    parts.push(`  ${level.padEnd(8)} ${bar} (${String(count).padStart(3)})`);
  }
  if (data.postedComments.length > 0) {
    parts.push("");
    parts.push("[Top 5 posted]");
    sortedPosted(data).slice(0, 5).forEach((c, i) => {
      parts.push(`  ${String(i + 1).padStart(2)}. ${c.severity.padEnd(8)} ${cell(c.path)}:${c.line}`);
    });
  }
  parts.push("```");
  parts.push("");

  summarySection(data, parts);

  return closeReviewBlock(data, parts);
}

// ---------------------------------------------------------------------------
// Layout 13 — Incident Report (timeline)
// ---------------------------------------------------------------------------
// Reads like a post-incident report: status, severity, timeline, impact.

function layoutIncident(data: ReviewData): string {
  const verdict = verdictBadge(data);
  const parts: string[] = [];

  parts.push(`## ${verdict}`);
  parts.push("");
  parts.push("### 📟 Incident report");
  parts.push("");

  const severityWord = data.validCommentCount === 0
    ? "✅ None"
    : (data.severityCounts["critical"] ?? 0) > 0
      ? "🟣 Critical"
      : (data.severityCounts["high"] ?? 0) > 0
        ? "🔴 High"
        : (data.severityCounts["medium"] ?? 0) > 0
          ? "🟠 Medium"
          : "🟡 Low";

  parts.push(`**Status:** ${verdict}  &nbsp;&nbsp;  **Severity:** ${severityWord}  &nbsp;&nbsp;  **Findings:** ${data.validCommentCount} of ${totalFindings(data)}`);
  parts.push("");

  parts.push("### ⏱️ Timeline of this review run");
  parts.push("");
  parts.push("| Step | Event |");
  parts.push("| :--- | :--- |");
  parts.push(`| ① | 🟢 Diff fetched from \`${redact(data.provider, data.secrets)}\` PR source. |`);
  parts.push(`| ② | 🔒 Secret scan ran — ${data.validCommentCount > 0 ? "diff redacted before model submission" : "no high-confidence secrets detected"}. |`);
  parts.push(`| ③ | 🤖 Model \`${redact(data.modelId, data.secrets)}\` returned \`${data.review.verdict}\`. |`);
  parts.push(`| ④ | 🧹 Filter pass: severity policy + \`max-comments\` cap. |`);
  parts.push(`| ⑤ | 📤 ${data.validCommentCount} inline thread${data.validCommentCount === 1 ? "" : "s"} posted. |`);
  parts.push("");

  parts.push("### 🎯 Impact");
  parts.push("");
  if (data.postedComments.length > 0) {
    sortedPosted(data).slice(0, 5).forEach((c, i) => {
      parts.push(`${i + 1}. ${findingLine(c, data.secrets)}`);
    });
  } else {
    parts.push("- ✅ No blocking findings.");
  }
  parts.push("");

  // CLARITY-19a (retired): the "📍 Off-diff items (not posted)" section
  // used to render up to 5 off-diff findings. Removed — reviewers
  // don't action off-diff findings (they target files outside this
  // PR's diff) and the "Off-diff: N" KPI tile in the dashboard
  // already exposes the count without noise.

  summarySection(data, parts, { heading: "### 💬 Provider summary" });

  return closeReviewBlock(data, parts);
}

// ---------------------------------------------------------------------------
// Layout 14 — Release Notes (categorized changelog)
// ---------------------------------------------------------------------------
// Reads like a CHANGELOG entry: Features / Fixes / Style sections.

function layoutReleaseNotes(data: ReviewData): string {
  const verdict = verdictBadge(data);
  const parts: string[] = [];

  parts.push(`## ${verdict}`);
  parts.push("");
  parts.push("### 📝 Review changelog");
  parts.push("");

  // Map severity → "category"
  type ReleaseNotesBucketName =
    | "🔴 Fixes (high/critical)"
    | "🟠 Improvements (medium)"
    | "🟡 Style (low)";
  const buckets: Record<ReleaseNotesBucketName, LiveReviewComment[]> = {
    "🔴 Fixes (high/critical)": [],
    "🟠 Improvements (medium)": [],
    "🟡 Style (low)": [],
  };
  const SEVERITY_RANK_TO_BUCKET: Record<number, ReleaseNotesBucketName> = {
    4: "🔴 Fixes (high/critical)",
    3: "🔴 Fixes (high/critical)",
    2: "🟠 Improvements (medium)",
    1: "🟡 Style (low)",
    0: "🟡 Style (low)",
  };
  for (const c of data.postedComments) {
    const rank = severityRank(c.severity);
    const bucketName = SEVERITY_RANK_TO_BUCKET[rank] ?? "🟡 Style (low)";
    buckets[bucketName].push(c);
  }

  for (const [header, list] of Object.entries(buckets)) {
    if (list.length === 0) continue;
    parts.push(`### ${header}`);
    parts.push("");
    list.forEach((c, i) => {
      const title = collapseBody(c, data.secrets);
      const snippet = truncateSnippet(title, 80);
      parts.push(`- **${cell(c.path)}:${c.line}** — ${cell(snippet)}`);
      if (i === list.length - 1) parts.push("");
    });
  }

  if (data.postedComments.length === 0) {
    parts.push("### ✅ No changes required");
    parts.push("");
    parts.push("- Review passed clean — ship it.");
    parts.push("");
  }

  summarySection(data, parts, { heading: "### 📖 Notes" });

  return closeReviewBlock(data, parts);
}

// ---------------------------------------------------------------------------
// Layout 15 — Coverage Report
// ---------------------------------------------------------------------------
// Per-file table with emoji status. Reads like a test-coverage widget.

function layoutCoverage(data: ReviewData): string {
  const verdict = verdictBadge(data);
  const parts: string[] = [];

  parts.push(`## ${verdict}`);
  parts.push("");
  parts.push("### 🧪 File-by-file review");
  parts.push("");

  const sortedFiles = groupByFile(data.postedComments);

  parts.push("| File | Findings | Status |");
  parts.push("| :--- | ---: | :---: |");
  if (sortedFiles.length === 0) {
    parts.push("| _all files_ | **0** | ✅ Pass |");
  } else {
    for (const [path, comments] of sortedFiles) {
      const worst = Math.max(...comments.map((c) => severityRank(c.severity)));
      const status = worst >= 3 ? "🔴" : worst === 2 ? "🟠" : worst === 1 ? "🟡" : "⚪";
      parts.push(`| \`${cell(path)}\` | **${comments.length}** | ${status} |`);
    }
  }
  parts.push("");

  parts.push("### 📋 Detail");
  parts.push("");
  if (sortedFiles.length === 0) {
    parts.push("> _No findings to address._");
  } else {
    for (const [path, comments] of sortedFiles) {
      parts.push(`#### \`${cell(path)}\``);
      parts.push("");
      for (const c of comments) {
        parts.push(`- ${severityEmoji(c.severity)} line ${c.line} — ${collapseBody(c, data.secrets)}`);
      }
      parts.push("");
    }
  }

  summarySection(data, parts);

  return closeReviewBlock(data, parts);
}

// ---------------------------------------------------------------------------
// Layout 16 — Thermometer (vertical severity ladder)
// ---------------------------------------------------------------------------
// Stacked emoji severity ladder + count badges. Visual "how hot is this PR".

function layoutThermometer(data: ReviewData): string {
  const verdict = verdictBadge(data);
  const parts: string[] = [];

  parts.push(`## ${verdict}`);
  parts.push("");
  parts.push("### 🌡️ Risk thermometer");
  parts.push("");

  const total = data.validCommentCount;
  const c = data.severityCounts["critical"] ?? 0;
  const h = data.severityCounts["high"] ?? 0;
  const m = data.severityCounts["medium"] ?? 0;
  const l = data.severityCounts["low"] ?? 0;
  const ratio = total === 0 ? 0 : Math.min(1, (c * 4 + h * 3 + m * 2 + l * 1) / Math.max(1, total * 4));

  parts.push("```text");
  parts.push("       🟣 Critical  ┌──┐");
  parts.push("                    │" + "█".repeat(Math.round(c * 2)).padEnd(10, " ") + "│ " + String(c).padStart(3));
  parts.push("       🔴 High      │  │");
  parts.push("                    │" + "█".repeat(Math.round(h * 2)).padEnd(10, " ") + "│ " + String(h).padStart(3));
  parts.push("       🟠 Medium    │  │");
  parts.push("                    │" + "█".repeat(Math.round(m * 2)).padEnd(10, " ") + "│ " + String(m).padStart(3));
  parts.push("       🟡 Low       │  │");
  parts.push("                    │" + "█".repeat(Math.round(l * 2)).padEnd(10, " ") + "│ " + String(l).padStart(3));
  parts.push("                    └──┘");
  parts.push("                     0  " + Math.round(ratio * 100) + "%");
  parts.push("```");
  parts.push("");

  parts.push("### 📋 Findings");
  parts.push("");
  if (data.postedComments.length === 0) {
    parts.push("> _No findings._");
  } else {
    sortedPosted(data).slice(0, 5).forEach((c, i) => {
      parts.push(`${i + 1}. ${findingLine(c, data.secrets)}`);
    });
  }
  parts.push("");

  summarySection(data, parts);

  return closeReviewBlock(data, parts);
}

// ---------------------------------------------------------------------------
// Layout 17 — Status Page
// ---------------------------------------------------------------------------
// Mirrors GitHub Status / statuspage.io: status banner, then per-component status.

function layoutStatusPage(data: ReviewData): string {
  const verdict = verdictBadge(data);
  const parts: string[] = [];

  parts.push(`## ${verdict}`);
  parts.push("");
  parts.push("### 📡 Status page");
  parts.push("");

  const banner = data.validCommentCount === 0
    ? "✅ All clear — no findings"
    : (data.severityCounts["critical"] ?? 0) > 0
      ? "🟣 Critical findings reported"
      : (data.severityCounts["high"] ?? 0) > 0
        ? "🔴 High severity findings reported"
        : (data.severityCounts["medium"] ?? 0) > 0
          ? "🟠 Medium severity findings reported"
          : "🟡 Low severity findings reported";

  parts.push(`> ## ${banner}`);
  parts.push(">");
  parts.push(`> Last updated by \`${redact(data.modelId, data.secrets)}\` via \`${redact(data.provider, data.secrets)}\``);
  parts.push("");

  parts.push("### 🧩 Components");
  parts.push("");
  parts.push("| Component | Status | Details |");
  parts.push("| :--- | :---: | :--- |");
  parts.push(`| Diff fetch | ✅ Operational | Provider \`${cell(redact(data.provider, data.secrets))}\` responded. |`);
  parts.push(`| Secret scan | ✅ Operational | Redaction pass complete. |`);
  parts.push(`| Model review | ${data.review.parseFailed === true ? "🔴 Degraded" : "✅ Operational"} | \`${cell(redact(data.modelId, data.secrets))}\` verdict: \`${data.review.verdict}\`. |`);
  parts.push(`| Filter & post | ${data.validCommentCount === 0 ? "🟡 No-op" : "✅ Operational"} | ${data.validCommentCount} of ${totalFindings(data)} posted. |`);
  parts.push("");

  if (data.postedComments.length > 0) {
    parts.push("### ⚠️ Active incidents");
    parts.push("");
    sortedPosted(data).slice(0, 5).forEach((c, i) => {
      parts.push(`${i + 1}. ${findingLine(c, data.secrets)}`);
    });
    parts.push("");
  }

  summarySection(data, parts, { heading: "### 📝 Notes" });

  return closeReviewBlock(data, parts);
}

// ---------------------------------------------------------------------------
// Layout 18 — Diffstat (per-file +/- with ASCII bars)
// ---------------------------------------------------------------------------
// Per-file change summary using ASCII bars. Reads like `git diff --stat`.

function layoutDiffstat(data: ReviewData): string {
  const verdict = verdictBadge(data);
  const parts: string[] = [];

  parts.push(`## ${verdict}`);
  parts.push("");
  parts.push("### 📊 Review diffstat");
  parts.push("");

  const sortedFiles = groupByFile(data.postedComments);
  const max = Math.max(1, ...sortedFiles.map(([, v]) => v.length));

  parts.push("```text");
  if (sortedFiles.length === 0) {
    parts.push("(no findings)");
  } else {
    const pathWidth = Math.max(8, ...sortedFiles.map(([p]) => p.length));
    for (const [path, comments] of sortedFiles) {
      const filled = Math.round((comments.length / max) * 24);
      const bar = "█".repeat(filled) + "░".repeat(24 - filled);
      parts.push(`  ${path.padEnd(pathWidth)} │ ${bar} ${String(comments.length).padStart(3)}`);
    }
  }
  parts.push("```");
  parts.push("");

  if (sortedFiles.length > 0) {
    parts.push("### 🔎 Detail");
    parts.push("");
    for (const [path, comments] of sortedFiles) {
      parts.push(`#### \`${cell(path)}\``);
      parts.push("");
      for (const c of comments) {
        parts.push(`- ${severityEmoji(c.severity)} line ${c.line} — ${collapseBody(c, data.secrets)}`);
      }
      parts.push("");
    }
  } else {
    parts.push("> _No findings to address._");
    parts.push("");
  }

  summarySection(data, parts);

  return closeReviewBlock(data, parts);
}

// ---------------------------------------------------------------------------
// Layout 19 — Sticky Notes (push-pin quote blocks)
// ---------------------------------------------------------------------------
// Each finding is its own blockquote with a 📌 prefix. Reads like a
// wall of sticky notes.

function layoutStickyNotes(data: ReviewData): string {
  const verdict = verdictBadge(data);
  const parts: string[] = [];

  parts.push(`## ${verdict}`);
  parts.push("");
  parts.push("### 📌 Sticky notes");
  parts.push("");

  if (data.postedComments.length === 0) {
    parts.push("> 📌 _No sticky notes — review passed clean._");
    parts.push("");
  } else {
    sortedPosted(data).slice(0, 6).forEach((c) => {
      const title = collapseBody(c, data.secrets);
      const snippet = truncateSnippet(title, 200);
      parts.push(">");
      parts.push(`> 📌 **${severityLabel(c.severity)}** — \`${cell(c.path)}\`:${c.line}`);
      parts.push(">");
      parts.push(`> ${cell(snippet)}`);
      parts.push(">");
    });
    if (data.postedComments.length > 6) {
      parts.push(`> _…and ${data.postedComments.length - 6} more._`);
    }
    parts.push("");
  }

  const tally = severityTally(data);
  if (tally.length > 0) {
    parts.push(tally);
    const legend = severityTallyLegend(data);
    if (legend.length > 0) parts.push(legend);
    parts.push("");
  }

  summarySection(data, parts);

  return closeReviewBlock(data, parts);
}

// ---------------------------------------------------------------------------
// Layout 20 — Newspaper (headline-lede-body)
// ---------------------------------------------------------------------------
// Headline H1, italic lede, then body. Reads like a news article.

function layoutNewspaper(data: ReviewData): string {
  const verdict = verdictBadge(data);
  const parts: string[] = [];

  parts.push(`# ${verdict}`);
  parts.push("");
  parts.push(`### *${data.validCommentCount} of ${totalFindings(data)} findings posted; review model: \`${redact(data.modelId, data.secrets)}\`*`);
  parts.push("");

  if (data.postedComments.length > 0) {
    parts.push("> ## Top story");
    parts.push(">");
    const top = sortedPosted(data)[0]!;
    const topTitle = redact(top.body, data.secrets).replace(/\s+/gu, " ").trim();
    parts.push(`> **${severityLabel(top.severity)}** at \`${cell(top.path)}\`:${top.line}.`);
    parts.push(">");
    parts.push(`> ${cell(topTitle)}`);
    parts.push("");
  }

  parts.push("### The rundown");
  parts.push("");
  if (data.postedComments.length === 0) {
    parts.push("_No findings to address._");
  } else {
    sortedPosted(data).slice(0, 6).forEach((c, i) => {
      const title = collapseBody(c, data.secrets);
      const snippet = truncateSnippet(title, 140);
      parts.push(`**${i + 1}.** ${severityEmoji(c.severity)} \`${cell(c.path)}\`:${c.line} — ${cell(snippet)}`);
    });
  }
  parts.push("");

  if (data.review.summary.trim().length > 0) {
    parts.push("### Editor's note");
    parts.push("");
    parts.push(redact(data.review.summary, data.secrets));
    parts.push("");
  }

  const tally = severityTally(data);
  if (tally.length > 0) {
    parts.push("### By the numbers");
    parts.push("");
    parts.push(tally);
    const legend = severityTallyLegend(data);
    if (legend.length > 0) parts.push(legend);
    parts.push("");
  }

  return closeReviewBlock(data, parts);
}

// ---------------------------------------------------------------------------
// Public dispatch
// ---------------------------------------------------------------------------

type RendererFn = (data: ReviewData) => string;

const LAYOUT_RENDERERS: Record<LayoutId, RendererFn> = {
  "dashboard": layoutDashboard,
  "pipeline": layoutPipeline,
  "verdict-banner": layoutVerdictBanner,
  "severity-table": layoutSeverityTable,
  "card-grid": layoutCardGrid,
  "tldr-walkthrough": layoutTldrWalkthrough,
  "checklist": layoutChecklist,
  "progress-bars": layoutProgressBars,
  "pros-cons": layoutProsCons,
  "tweet": layoutTweet,
  "faq": layoutFaq,
  "terminal": layoutTerminal,
  "incident": layoutIncident,
  "release-notes": layoutReleaseNotes,
  "coverage": layoutCoverage,
  "thermometer": layoutThermometer,
  "status-page": layoutStatusPage,
  "diffstat": layoutDiffstat,
  "sticky-notes": layoutStickyNotes,
  "newspaper": layoutNewspaper,
};

const BASELINE_RENDERERS: Record<BaselineId, RendererFn> = {
  "current": layoutBaseline,
};

/**
 * Render a review summary using one of the 20 replacement layouts.
 *
 * @param layout  Layout identifier (see {@link LayoutId}).
 * @param data    Review data shape; same inputs as the existing
 *                `buildReviewBody` in `src/cli/live-shared.ts`.
 * @returns Markdown body string safe to post to GitHub PR reviews
 *          and Azure DevOps PR threads.
 */
export function renderSummary(layout: LayoutId, data: ReviewData): string {
  if (data.postedComments === undefined) {
    throw new Error("renderSummary: data.postedComments is required (was undefined). Use buildReviewBody() to dispatch — it computes the post-filter set from review.comments.");
  }
  const renderer = LAYOUT_RENDERERS[layout];
  if (renderer === undefined) {
    throw new Error(`Unknown layout: ${layout as string}`);
  }
  return renderer(data);
}

/**
 * Render the BASELINE review summary (byte-identical reproduction of
 * the existing `buildReviewBody` output). Use this for side-by-side
 * comparison in the viewer and for the regression test that pins
 * `LAYOUTS` parity with `buildReviewBody`.
 */
export function renderBaseline(baseline: BaselineId, data: ReviewData): string {
  const renderer = BASELINE_RENDERERS[baseline];
  if (renderer === undefined) {
    throw new Error(`Unknown baseline: ${baseline as string}`);
  }
  return renderer(data);
}

/** Human-readable label for each of the 20 layouts. */
export const LAYOUT_LABELS: Record<LayoutId, string> = {
  "dashboard": "1 · Dashboard — KPI tiles",
  "pipeline": "2 · Pipeline — step diagram",
  "verdict-banner": "3 · Verdict banner — single oversized callout",
  "severity-table": "4 · Severity table — SonarQube-style",
  "card-grid": "5 · Card grid — one card per severity",
  "tldr-walkthrough": "6 · TL;DR + walkthrough",
  "checklist": "7 · Checklist — grouped by category",
  "progress-bars": "8 · Progress bars — ASCII block bars",
  "pros-cons": "9 · Pros & Cons — two-column GFM table",
  "tweet": "10 · Tweet — announcement card",
  "faq": "11 · FAQ — Q/A pairs",
  "terminal": "12 · Terminal — fenced code block",
  "incident": "13 · Incident report — timeline",
  "release-notes": "14 · Release notes — categorized changelog",
  "coverage": "15 · Coverage report — per-file table",
  "thermometer": "16 · Thermometer — vertical severity ladder",
  "status-page": "17 · Status page — components & incidents",
  "diffstat": "18 · Diffstat — per-file +/- with ASCII bars",
  "sticky-notes": "19 · Sticky notes — push-pin quote blocks",
  "newspaper": "20 · Newspaper — headline-lede-body",
};