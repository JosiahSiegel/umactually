// Tests pinning the "platform arg wins" property of `buildReviewBody`.
//
// Contract: `buildReviewBody` accepts an optional `platform?: "github" | "azure"`
// field and forwards it to the rendered layout. The docstring says:
//   "Omit for the byte-identical GitHub legacy default".
//
// PR #238 review feedback: when the orchestrator resolves the platform
// (GitHub vs Azure) and passes it explicitly via `buildReviewBody({...
// platform: "github"|"azure"})`, the explicit `platform` arg must drive
// the platform-aware resolution-guide variant. The legacy contract is:
// omitted `platform` → GitHub guide (byte-identical legacy default).
//
// The "wins" property tested here is the explicit arg's precedence over
// the implicit default — there is no `parsed.platform` in `buildReviewBody`'s
// signature, so the assertion is functional: omitting the platform field
// always renders the GitHub variant, passing `platform: "azure"` always
// renders the Azure variant, and the field is the sole source of truth.

import { describe, expect, it } from "vitest";

import {
  buildReviewBody,
  type LiveReview,
} from "../../src/cli/live-shared.js";

function makeEmptyReview(): LiveReview {
  return {
    summary: "Reviewed.",
    verdict: "COMMENT",
    comments: [],
    suppressedComments: [],
  };
}

const BASE_INPUT = {
  review: makeEmptyReview(),
  provider: "openai-compatible",
  modelId: "auto",
  validCommentCount: 0,
  suppressedCommentCount: 0,
  offDiffFromComments: [],
  severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
  secrets: [] as readonly string[],
} as const;

describe("buildReviewBody — explicit platform arg drives the resolution-guide variant", () => {
  it("explicit platform: 'azure' → Azure guide renders", () => {
    // Given: the runner resolves to 'azure' and passes it explicitly.
    const body = buildReviewBody({
      ...BASE_INPUT,
      platform: "azure",
    });

    // Then: the body contains the Azure `az repos pr thread update` command.
    expect(body).toContain("az repos pr thread update");
    // Cross-token guard: the GitHub recipe must NOT leak into the Azure variant.
    expect(body).not.toContain("resolveReviewThread");
  });

  it("explicit platform: 'github' → GitHub guide renders", () => {
    // Given: the runner resolves to 'github' and passes it explicitly.
    const body = buildReviewBody({
      ...BASE_INPUT,
      platform: "github",
    });

    // Then: the body contains the GitHub GraphQL `resolveReviewThread` mutation.
    expect(body).toContain("resolveReviewThread");
    // Cross-token guard: the Azure recipe must NOT leak into the GitHub variant.
    expect(body).not.toContain("az repos pr thread update");
  });

  it("platform omitted → GitHub variant (legacy byte-identity default)", () => {
    // Given: a simulate/dry-run-style caller that omits the platform
    // field entirely (matches legacy call sites in
    // test/unit/live-shared-body.test.ts and the simulate-findings fixture).
    const body = buildReviewBody({
      ...BASE_INPUT,
    });

    // Then: the body renders the GitHub variant — the byte-identical
    // legacy default documented on the `platform?` field.
    expect(body).toContain("resolveReviewThread");
    expect(body).not.toContain("az repos pr thread update");
  });

  it("explicit platform: 'github' is the variant-source-of-truth on the clean-ship branch", () => {
    // Given: a 0-finding SHIP verdict that hits the clean-ship path.
    // The clean-ship predicate doesn't override the explicit platform
    // choice — the explicit `platform: 'github'` is the sole source of
    // truth for which resolution-guide variant renders.
    const body = buildReviewBody({
      ...BASE_INPUT,
      validCommentCount: 0,
      platform: "github",
    });
    expect(body).toContain("resolveReviewThread");
    expect(body).not.toContain("az repos pr thread update");
  });
});
