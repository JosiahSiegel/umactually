/**
 * Stable HTML markers and the manifest schema identifier emitted by the
 * UmActually live review marker. Critical for dedup: the runner searches
 * for these strings in existing PR comments, so a silent drift here
 * would break every dedup loop and every downstream consumer that
 * parses the manifest. Every reference (dry-run artifact, live review,
 * fixture parser, raw-output type guard, GitHub agent) sees the same
 * values via this module.
 */

import { BRAND } from "./brand.js";

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

/** Opening HTML-comment prefix of the manifest hidden inside each UmActually review comment. */
export const MANIFEST_MARKER_PREFIX = `<!-- ${BRAND}:manifest `;

/** Closing HTML-comment suffix of the manifest hidden inside each UmActually review comment. */
export const MANIFEST_MARKER_SUFFIX = " -->";

/**
 * Legacy HTML marker from the prior action incarnation. Kept so existing
 * PR comments authored under that scheme can still be detected for replacement.
 */
export const LEGACY_MARKER = "<!-- auto-pr-review -->";

/** Slug of the legacy marker, for body-text matching without the HTML comment delimiters. */
export const LEGACY_MARKER_SLUG = "auto-pr-review";

/**
 * Returns true when `body` contains the UmActually review marker.
 * Centralized so future marker variants (e.g. parent-vs-inline) only need
 * to be added here.
 */
export function commentBodyHasMarker(body: string): boolean {
  return body.includes(REVIEW_MARKER);
}
