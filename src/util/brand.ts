/** Canonical review brand string; eliminates the 50+ inline "umactually-pr-review" literals across CLI, platform, and provider code. */
export const BRAND = "umactually-pr-review";

/** Log prefix shared by annotation helpers; eliminates hand-built "umactually-pr-review: " prefixes in stderr diagnostics. */
export const BRAND_PREFIX = `${BRAND}: `;

/** HTTP User-Agent token shared by provider and platform clients; eliminates duplicated header literals. */
export const USER_AGENT = BRAND;

/** Manifest schema identifier shared by artifacts and parsers; prevents schema-name drift between producers and consumers. */
export const MANIFEST_SCHEMA = `${BRAND}/v1`;

/** Azure DevOps PR status context name; prevents status updates from drifting away from the review brand. */
export const AZURE_STATUS_CONTEXT_NAME = `${BRAND}-status`;
