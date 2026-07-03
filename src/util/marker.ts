/**
 * Stable HTML markers and the manifest schema identifier emitted by the
 * UmActually live review marker. Critical for dedup: the runner searches
 * for these strings in existing PR comments, so a silent drift here
 * would break every dedup loop and every downstream consumer that
 * parses the manifest. Every reference (dry-run artifact, live review,
 * fixture parser, raw-output type guard, GitHub agent) sees the same
 * values via this module.
 */

/**
 * Stable HTML marker the runner greps for in existing PR comments when
 * deciding whether to replace a previous UmActually review.
 */
export const REVIEW_MARKER = "<!-- umactually-pr-review -->";

/**
 * JSON schema identifier for the UmActually manifest that lives inside
 * the `<!-- umactually-pr-review:manifest { ... } -->` HTML comment on
 * every posted review. Format is `${BRAND}/v${VERSION}`. AI agents and
 * downstream tooling parse this string to know they're reading an
 * UmActually-shaped payload.
 *
 * NOT a generic "manifest schema" — this is UmActually-specific by
 * design. The brand name appears in the schema id so consumers can
 * tell UmActually manifests apart from any other review tool's
 * payloads.
 */
export const MANIFEST_SCHEMA = "umactually-pr-review/v1";