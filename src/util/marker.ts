/**
 * Stable HTML marker the live review marker greps for. Critical for dedup:
 * the runner searches for this exact string in existing PR comments, so a
 * silent drift here would break every dedup loop. The constant lives here
 * so every reference (dry-run artifact, live review, fixture parser, raw
 * output type guard) sees the same value.
 */
export const REVIEW_MARKER = "<!-- umactually-pr-review -->";
