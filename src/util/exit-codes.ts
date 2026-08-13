// SPDX-License-Identifier: MIT
/**
 * Typed exit-code contract for the umactually CLI.
 *
 * Two layers live in this module:
 *
 *   1. `UMACTUALLY_EXIT_CODES` — the canonical map from numeric exit
 *      code to a short symbolic name (`SUCCESS`, `RUNTIME_ERROR`, ...).
 *      Every call site that emits a process exit code MUST source its
 *      literal from this object so a rename is a one-file change.
 *
 *   2. `UMACTUALLY_TYPED_EXIT_CODE_NAMES` — the map from numeric exit
 *      code to the fully-qualified typed-error name surfaced in
 *      diagnostics and CI logs (e.g. `"UMACTUALLY_ERR_SECRET_BOOTSTRAP"`).
 *      Only the codes added by the single-click-github-install plan
 *      (T02 + T09) appear here; the existing generic codes (0, 1, 2,
 *      127) intentionally have NO typed-error name because they predate
 *      the typed-error naming convention.
 *
 * The two map shapes deliberately mirror each other by key so a
 * future typed-error name can be added in lockstep with a new exit
 * code without having to touch call sites that branch on the numeric
 * code. `isTypedPlanExitCode` is the runtime guard used by the action's
 * bootstrap step and the publisher-identity precondition gate to
 * distinguish a typed plan exit from an unrelated numeric collision.
 */

export const UMACTUALLY_EXIT_CODES = {
  SUCCESS: 0,
  RUNTIME_ERROR: 1,
  VALIDATION_ERROR: 2,
  SECRET_BOOTSTRAP: 3,
  PUBLISHER_UNVERIFIED: 4,
  MISSING_BUNDLE: 127,
} as const satisfies Record<string, number>;

/** Numeric exit code emitted by `process.exit(code)`. */
export type UmactuallyExitCode = (typeof UMACTUALLY_EXIT_CODES)[keyof typeof UMACTUALLY_EXIT_CODES];

/**
 * Map from the typed plan exit code (3, 4) to the fully-qualified
 * typed-error identifier surfaced in stderr diagnostics and CI logs.
 *
 * Added by the single-click-github-install plan (T02, T09). Only the
 * codes that introduce a brand-new typed-error category are listed;
 * codes 0, 1, 2, 127 are intentionally absent because they predate
 * the typed-error naming convention.
 */
export const UMACTUALLY_TYPED_EXIT_CODE_NAMES = {
  [UMACTUALLY_EXIT_CODES.SECRET_BOOTSTRAP]: "UMACTUALLY_ERR_SECRET_BOOTSTRAP",
  [UMACTUALLY_EXIT_CODES.PUBLISHER_UNVERIFIED]: "UMACTUALLY_ERR_PUBLISHER_UNVERIFIED",
} as const satisfies Record<number, string>;

/** Union of typed-error names surfaced by `UMACTUALLY_TYPED_EXIT_CODE_NAMES`. */
export type UmactuallyTypedExitCodeName = (typeof UMACTUALLY_TYPED_EXIT_CODE_NAMES)[keyof typeof UMACTUALLY_TYPED_EXIT_CODE_NAMES];

/** Union of numeric codes that have a typed-error name (the single-click-github-install codes 3 and 4). */
export type UmactuallyTypedPlanExitCode = keyof typeof UMACTUALLY_TYPED_EXIT_CODE_NAMES;

/**
 * Type guard for the numeric codes introduced by the
 * single-click-github-install plan (currently 3 and 4). Returns true
 * when `code` has a matching entry in
 * `UMACTUALLY_TYPED_EXIT_CODE_NAMES`. Used by the action's bootstrap
 * step and the publisher-identity precondition gate to distinguish a
 * typed plan exit from an unrelated numeric collision in the same
 * row of the exit-code table.
 */
export function isTypedPlanExitCode(code: number): code is UmactuallyTypedPlanExitCode {
  return Object.prototype.hasOwnProperty.call(UMACTUALLY_TYPED_EXIT_CODE_NAMES, code);
}
