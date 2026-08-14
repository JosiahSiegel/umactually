// Pins docs/configuration.md to the real debug-raw env-var name exported from
// src/util/debug-raw.ts (DEBUG_RAW_ENV, the single source of truth). The docs
// table currently references the stale literal "UMACTUALLY_DEBUG_RAW_RESPONSE"
// (docs/configuration.md:103). This is the red step for the docs fix: the test
// must fail while the stale name is still documented, then go green once the
// docs reference DEBUG_RAW_ENV. Read-only — no filesystem writes, hermetic.

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DEBUG_RAW_ENV } from "../../src/util/debug-raw.js";

describe("docs/debug-raw env-var name consistency", () => {
  const docsPath = path.join(process.cwd(), "docs", "configuration.md");
  const docs = readFileSync(docsPath, "utf8");

  it("DOCS-DEBUG-RAW-001: DEBUG_RAW_ENV is the canonical env-var name (sanity pin)", () => {
    expect(DEBUG_RAW_ENV).toBe("UMACTUALLY_DEBUG_RAW");
  });

  it("DOCS-DEBUG-RAW-002: docs/configuration.md documents the canonical env-var name", () => {
    expect(docs).toContain(DEBUG_RAW_ENV);
  });

  it("DOCS-DEBUG-RAW-003: docs/configuration.md does not reference the stale env-var name", () => {
    // Hardcoded on purpose: this is the exact v0.9.3 docs-drift literal cited by
    // CHANGELOG.md. Deriving it from DEBUG_RAW_ENV (e.g. `${DEBUG_RAW_ENV}_RESPONSE`)
    // would make the test tautological — it would silently pass for any canonical
    // name and never flag a future regression where this stale literal reappears
    // in the docs. Pinning the historical string keeps the regression net live
    // even if DEBUG_RAW_ENV itself changes again.
    const staleName = "UMACTUALLY_DEBUG_RAW_RESPONSE";
    expect(docs).not.toContain(staleName);
  });
});
