/**
 * Canonical brand string used across CLI, platform, and provider code.
 *
 * NOT a generic brand concept: this is the specific string
 * "umactually-pr-review" that downstream consumers (PR comments, HTTP
 * User-Agent headers, GitHub agents) match on. Any value other than the
 * literal "umactually-pr-review" will break dedup loops and integration
 * parsers, so this is a pinned identifier — not a configuration knob.
 */

/** Canonical review brand string; eliminates the 50+ inline "umactually-pr-review" literals across CLI, platform, and provider code. */
export const BRAND = "umactually-pr-review";

/** Log prefix shared by annotation helpers; eliminates hand-built "umactually-pr-review: " prefixes in stderr diagnostics. */
export const BRAND_PREFIX = `${BRAND}: `;

/** HTTP User-Agent token shared by provider and platform clients; eliminates duplicated header literals. */
export const USER_AGENT = BRAND;

/** Azure DevOps PR status context name; prevents status updates from drifting away from the review brand. */
export const AZURE_STATUS_CONTEXT_NAME = `${BRAND}-status`;

/**
 * Redaction token emitted by secret scanners and runtime sanitizers
 * when a high-confidence secret or per-secret value is replaced. The
 * runtime sanitizer (`live-shared.ts:sanitizeForPost`) and the
 * scanner (`scan-review-secrets.ts`) must emit the SAME token so the
 * downstream log-filter and dedup heuristics agree on what counts as
 * "already-redacted". Single source of truth — any future rename must
 * touch this constant only.
 */
export const REDACTED_SECRET_TOKEN = "[REDACTED_SECRET]";

/** Placeholder string substituted into config-parse error messages instead of leaking values. */
export const REDACTED_PLACEHOLDER = "[REDACTED]";

/** Replaces an entire `Authorization: ...` header value in logged request bodies. */
export const REDACTED_AUTHORIZATION_HEADER = "[REDACTED_AUTHORIZATION_HEADER]";

/** Replaces a `Bearer <token>` segment inside a logged request body. */
export const REDACTED_BEARER_TOKEN = "[REDACTED_BEARER_TOKEN]";
