/**
 * Stable HTML markers and the manifest schema identifier emitted by the
 * UmActually live review marker. Critical for dedup: the runner searches
 * for these strings in existing PR comments, so a silent drift here
 * would break every dedup loop and every downstream consumer that
 * parses the manifest. Every reference (dry-run artifact, live review,
 * fixture parser, raw-output type guard, GitHub agent) sees the same
 * values via this module.
 *
 * Drift discipline: every line emitted into a PR comment body that a
 * downstream tool may need to grep for MUST live here — REVIEW_MARKER
 * (the live review marker), MANIFEST_MARKER_PREFIX / MANIFEST_MARKER_SUFFIX
 * (the hidden JSON manifest), MANIFEST_SCHEMA (its schema id), and
 * RESOLUTION_GUIDE_MARKER (the v3 baked resolution-guide footer used by
 * the self-review workflow's idempotency check).
 */

import { BRAND } from "./brand.js";

/**
 * Stable HTML marker the runner greps for in existing PR comments when
 * deciding whether to replace a previous UmActually review.
 *
 * Renamed from `<!-- umactually -->` in v0.1.0 because the
 * project ships under the bare `umactually` name and never launched —
 * no installed copies depend on the old marker.
 */
export const REVIEW_MARKER = "<!-- umactually -->";

/**
 * JSON schema identifier for the UmActually manifest that lives inside
 * the `<!-- umactually:manifest { ... } -->` HTML comment on every
 * posted review. Format is `${BRAND}/v${VERSION}`. AI agents and
 * downstream tooling parse this string to know they're reading an
 * UmActually-shaped payload.
 *
 * NOT a generic "manifest schema" — this is UmActually-specific by
 * design. The brand name appears in the schema id so consumers can
 * tell UmActually manifests apart from any other review tool's
 * payloads.
 */
export const MANIFEST_SCHEMA = "umactually/v1";

/** Opening HTML-comment prefix of the manifest hidden inside each UmActually review comment. */
export const MANIFEST_MARKER_PREFIX = `<!-- ${BRAND}:manifest `;

/** Closing HTML-comment suffix of the manifest hidden inside each UmActually review comment. */
export const MANIFEST_MARKER_SUFFIX = " -->";

/**
 * Stable HTML marker emitted as the final line of every CLI-baked
 * resolution-guide body. The self-review workflow greps posted PR
 * comments for this exact string to decide whether to re-bake the
 * guide (idempotency check); a silent drift here would either
 * over-bake (every sync re-posts the full guide) or under-bake
 * (the guide never appears on synced PRs that previously used a
 * different marker).
 *
 * Versioning:
 *   - v1 / v2 were burned by the marker history under
 *     `.github/workflows/data/resolution-guide-{github,azure}.md`
 *     (see CHANGELOG.md:73 for the historical marker-rotation entry);
 *     they MUST NOT be reintroduced because any consumer that
 *     greps for the older string would mis-classify new bodies.
 *   - v3 identifies the CLI-baked guide produced by
 *     `src/render/resolution-guide.ts` (Task 1 of the
 *     bake-resolution-guide plan). Bumping this string is a
 *     consumer-visible change — coordinate with the self-review
 *     workflow before bumping.
 *
 * Centralized so the dedup greper, the renderer, and any future
 * fixture parser can all reference the same constant.
 */
export const RESOLUTION_GUIDE_MARKER = "<!-- umactually:resolution-guide-v3 -->";

/**
 * Returns true when `body` contains the UmActually review marker.
 * Centralized so future marker variants (e.g. parent-vs-inline) only need
 * to be added here.
 */
export function commentBodyHasMarker(body: string): boolean {
  return body.includes(REVIEW_MARKER);
}

