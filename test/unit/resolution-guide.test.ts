// Smoke + invariant tests for the platform-aware resolution-guide renderer.
//
// Task 1 contract (see .omo/notepads/bake-resolution-guide/):
//   - `resolutionGuide("github" | "azure")` returns ONE collapsed <details>
//     block per platform, < 2,500 chars, terminated by the v3 marker.
//   - `RESOLUTION_GUIDE_MARKER` equals `<!-- umactually:resolution-guide-v3 -->`.
//   - Cross-platform rules (from src/render/summary-layouts.ts:42-43):
//       * NO raw `<table>` HTML — Azure ignores it.
//       * NO task-list `- [ ]` / `- [x]` — Azure ignores check state.
//       * `<details>`/`<summary>` IS allowed on both platforms.
//   - GitHub variant references the GraphQL `resolveReviewThread` mutation;
//     Azure variant references `az repos pr thread update` — the inverse
//     cross-platform tokens must NOT leak into the wrong variant.

import { describe, expect, it } from "vitest";

import { resolutionGuide } from "../../src/render/resolution-guide.js";
import { RESOLUTION_GUIDE_MARKER } from "../../src/util/marker.js";

const PLATFORMS = ["github", "azure"] as const;

describe("S1 — RESOLUTION_GUIDE_MARKER constant", () => {
  it("equals the v3 marker line", () => {
    expect(RESOLUTION_GUIDE_MARKER).toBe("<!-- umactually:resolution-guide-v3 -->");
  });
});

describe("S2 — resolutionGuide() is platform-aware and under the 2,500-char budget", () => {
  for (const platform of PLATFORMS) {
    it(`${platform}: output is non-empty and under 2,500 chars`, () => {
      const out = resolutionGuide(platform);
      expect(typeof out).toBe("string");
      expect(out.length).toBeGreaterThan(0);
      expect(out.length).toBeLessThan(2_500);
    });

    it(`${platform}: contains exactly one <details> and one </details>`, () => {
      const out = resolutionGuide(platform);
      const opens = out.match(/<details>/gu) ?? [];
      const closes = out.match(/<\/details>/gu) ?? [];
      expect(opens).toHaveLength(1);
      expect(closes).toHaveLength(1);
    });

    it(`${platform}: contains exactly one <summary>`, () => {
      const out = resolutionGuide(platform);
      const summaries = out.match(/<summary>/gu) ?? [];
      expect(summaries).toHaveLength(1);
    });

    it(`${platform}: final non-empty line is the v3 marker`, () => {
      const out = resolutionGuide(platform);
      const lines = out.split("\n");
      const lastNonEmpty = lines.filter((line) => line.trim().length > 0).pop();
      expect(lastNonEmpty).toBe(RESOLUTION_GUIDE_MARKER);
    });

    it(`${platform}: does NOT use raw <table> HTML (Azure-incompatible)`, () => {
      const out = resolutionGuide(platform);
      expect(out).not.toContain("<table");
    });

    it(`${platform}: does NOT use task-list syntax (Azure-incompatible)`, () => {
      const out = resolutionGuide(platform);
      expect(out).not.toMatch(/-\s\[\s\]/u);
      expect(out).not.toMatch(/-\s\[x\]/iu);
    });
  }
});

describe("S3 — platform-specific tokens are correctly partitioned", () => {
  it("github variant references resolveReviewThread and NOT az repos", () => {
    const out = resolutionGuide("github");
    expect(out).toContain("resolveReviewThread");
    expect(out).not.toContain("az repos");
  });

  it("azure variant references az repos pr thread update and NOT resolveReviewThread", () => {
    const out = resolutionGuide("azure");
    expect(out).toContain("az repos pr thread update");
    expect(out).not.toContain("resolveReviewThread");
  });
});

describe("S4 — shell escaping is correct (PR #238 review feedback)", () => {
  // Regression guard for the `\$` typo in the AZURE_GUIDE Step 2 reply
  // block. Inside a JS template literal, `\$` is a no-op escape (no JS
  // interpolation is happening for the `$(...)` command substitution),
  // so `\$` would render as a literal backslash in the bash code fence
  // — defeating the command substitution. The `\$` in `"\${PR_ID}"`
  // on subsequent lines IS intentional: `${...}` would be interpolated
  // by JS at template-literal parse time, so the escape is needed to
  // render literal `${PR_ID}` for bash.
  it("azure variant uses shell-correct $(...) command substitution (no leading backslash)", () => {
    const out = resolutionGuide("azure");
    // The Step 2 PR_ID assignment must NOT contain a leading backslash.
    expect(out).not.toMatch(/PR_ID="\\\(/u);
    // The Step 2 PR_ID assignment must use the shell-correct form.
    expect(out).toContain('PR_ID="$(az repos pr show');
    // Sanity: the PR_ID references on subsequent lines render as
    // literal `${PR_ID}` (the shell expands them at runtime, but the
    // JS template literal would interpolate `${PR_ID}` as undefined
    // otherwise — so the source escapes them as `\${PR_ID}` and the
    // rendered output uses the unescaped `${PR_ID}`).
    expect(out).toContain('"${PR_ID}"');
  });
});