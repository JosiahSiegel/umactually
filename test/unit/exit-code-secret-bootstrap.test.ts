import { describe, expect, it } from "vitest";

import {
  isTypedPlanExitCode,
  UMACTUALLY_EXIT_CODES,
  UMACTUALLY_TYPED_EXIT_CODE_NAMES,
} from "../../src/util/exit-codes.js";

// Wave 4 T14 contract: the typed-error literals exported from
// `src/util/exit-codes.ts` are the contract between the published
// action's first-run bootstrap step (T02) and the publisher-identity
// precondition gate (T09). These tests pin the literal numeric values
// and the typed-error name strings so a future rename in the exit-code
// map is a one-file change — every call site that branches on the
// numeric code or the typed-error name re-routes through this module.
//
// No network. No side effects. Pure import-and-assert.
describe("src/util/exit-codes.ts — typed-error literals (single-click-github-install plan T02 + T09)", () => {
  it("UMACTUALLY_EXIT_CODES.SECRET_BOOTSTRAP === 3 (action first-run bootstrap path)", () => {
    // exit 3 is the typed code emitted by the published action's
    // first-run bootstrap step when `secrets.UMACTUALLY_API_URL` or
    // `secrets.UMACTUALLY_API_KEY` is empty on an opening/reopening
    // pull-request event. The action posts (or skips on `synchronize`)
    // the bootstrap PR comment, then exits with this code.
    expect(UMACTUALLY_EXIT_CODES.SECRET_BOOTSTRAP).toBe(3);
  });

  it("UMACTUALLY_EXIT_CODES.PUBLISHER_UNVERIFIED === 4 (Marketplace publisher precondition gate)", () => {
    // exit 4 is the typed code emitted by the publisher-identity
    // precondition gate (T09) when neither the `umactually-publisher`
    // GitHub App nor the `JosiahSiegel` org app is a verified
    // Marketplace publisher. Marketplace submission silently fails
    // without verification — fail-fast is mandatory.
    expect(UMACTUALLY_EXIT_CODES.PUBLISHER_UNVERIFIED).toBe(4);
  });

  it("UMACTUALLY_TYPED_EXIT_CODE_NAMES[3] === 'UMACTUALLY_ERR_SECRET_BOOTSTRAP'", () => {
    // The fully-qualified typed-error identifier surfaced in stderr
    // diagnostics and CI logs for exit code 3. Must match the
    // literal used in `docs/exit-codes.md` row 3.
    expect(UMACTUALLY_TYPED_EXIT_CODE_NAMES[3]).toBe("UMACTUALLY_ERR_SECRET_BOOTSTRAP");
  });

  it("UMACTUALLY_TYPED_EXIT_CODE_NAMES[4] === 'UMACTUALLY_ERR_PUBLISHER_UNVERIFIED'", () => {
    // The fully-qualified typed-error identifier surfaced in stderr
    // diagnostics and CI logs for exit code 4. Must match the
    // literal used in `docs/exit-codes.md` row 4.
    expect(UMACTUALLY_TYPED_EXIT_CODE_NAMES[4]).toBe("UMACTUALLY_ERR_PUBLISHER_UNVERIFIED");
  });

  it("isTypedPlanExitCode(3) === true (action bootstrap step type guard)", () => {
    // The action's bootstrap step uses `isTypedPlanExitCode(code)` to
    // distinguish a typed plan exit from an unrelated numeric
    // collision in the same row of the exit-code table. Code 3 is
    // the typed plan exit; the guard MUST return true.
    expect(isTypedPlanExitCode(3)).toBe(true);
  });

  it("isTypedPlanExitCode(4) === true (publisher precondition type guard)", () => {
    // Same rationale as the code-3 guard above — code 4 is the typed
    // publisher-identity precondition exit.
    expect(isTypedPlanExitCode(4)).toBe(true);
  });

  it("isTypedPlanExitCode(2) === false (validation error is a pre-existing generic code, NOT a typed plan code)", () => {
    // Code 2 (validation error) predates the typed-error naming
    // convention introduced by the single-click-github-install plan.
    // It intentionally has NO entry in UMACTUALLY_TYPED_EXIT_CODE_NAMES
    // so the type guard returns false. The guard exists specifically
    // to distinguish typed-plan codes (3, 4) from the generic codes
    // (0, 1, 2, 127) — pin the negative case so a future regression
    // that broadens the guard (e.g. accidentally including 2) is
    // caught here.
    expect(isTypedPlanExitCode(2)).toBe(false);
  });
});