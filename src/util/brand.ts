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
