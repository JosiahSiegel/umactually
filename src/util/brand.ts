/**
 * Canonical brand string used across CLI, platform, and provider code.
 *
 * NOT a generic brand concept: this is the specific string "umactually"
 * that downstream consumers (PR comments, HTTP User-Agent headers, GitHub
 * agents) match on. Renamed from "umactually" in v0.1.0 because
 * the project ships under the bare name `umactually` and never launched
 * with the longer string — no installed copies depend on the old value.
 */

/** Canonical review brand string; eliminates the 50+ inline "umactually" literals across CLI, platform, and provider code. */
export const BRAND = "umactually";

/** Log prefix shared by annotation helpers; eliminates hand-built "umactually: " prefixes in stderr diagnostics. */
export const BRAND_PREFIX = `${BRAND}: `;

/** HTTP User-Agent token shared by provider and platform clients; eliminates duplicated header literals. */
export const USER_AGENT = BRAND;

/** Azure DevOps PR status context name; prevents status updates from drifting away from the review brand. */
export const AZURE_STATUS_CONTEXT_NAME = `${BRAND}-status`;

/** Azure DevOps PR status context genre; the discriminator that keeps our status updates distinct from any other tool's. */
export const AZURE_STATUS_CONTEXT_GENRE = "pr-review";

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

/**
 * Placeholder string substituted into config-parse error messages instead of
 * leaking values. Re-exported from `src/config/errors.ts` as `REDACTED` to
 * preserve the existing import surface in that module (the parser chain in
 * `src/config/parsers.ts` already imports `REDACTED` from `errors.ts`).
 */
export const REDACTED_PLACEHOLDER = "[REDACTED]";

/** Replaces an entire `Authorization: ...` header value in logged request bodies. */
export const REDACTED_AUTHORIZATION_HEADER = "[REDACTED_AUTHORIZATION_HEADER]";

/** Replaces a `Bearer <token>` segment inside a logged request body. */
export const REDACTED_BEARER_TOKEN = "[REDACTED_BEARER_TOKEN]";
