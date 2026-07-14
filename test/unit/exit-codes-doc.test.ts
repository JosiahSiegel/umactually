import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Resolve the package root from THIS test file's location
// (test/unit/exit-codes-doc.test.ts -> ../../package root).
const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..", "..");
const docPath = resolve(packageRoot, "docs", "exit-codes.md");

// Load-once: re-reading on every `it` is wasteful and the file
// is the contract under test, not the test inputs.
const docExists = (() => {
  try {
    readFileSync(docPath, "utf8");
    return true;
  } catch {
    return false;
  }
})();
const docBody: string = docExists ? readFileSync(docPath, "utf8") : "";

// Wave 2 T5 contract: docs/exit-codes.md is the canonical operator
// reference for every exit code the CLI / wrapper shim can return.
// This test pins the FILE SHAPE and EVERY required row so the T5
// document author can't silently drop a code or rename a meaning.
// Every assertion is independent so a future regression points at
// the exact missing row instead of a generic "doc changed" failure.
describe("docs/exit-codes.md", () => {
  it("exists at docs/exit-codes.md (relative to package root)", () => {
    // The cross-link from --help (cli-help.test.ts) and from README.md
    // depend on this path being stable. If T5 writes the file elsewhere
    // (docs/exit-codes/index.md, docs/exit_codes.md, etc.) every
    // operator-facing surface breaks; this assertion locks the path.
    expect(docExists, `expected reference document at ${docPath}`).toBe(true);
  });

  it("documents exit code 0 — success (normal completion)", () => {
    // exit 0 is returned by both src/cli.ts (validation+success path,
    // dry-run success) and bin/umactually.mjs (delegated
    // mod.main()). The doc MUST list it so operators can confirm a
    // successful run is what they saw.
    expect(docBody).toMatch(/\| 0 \|/u);
    expect(docBody).toContain("success");
  });

  it("documents exit code 1 — runtime error (Node guard / standalone provider / internal)", () => {
    // exit 1 fires from:
    //   - bin/umactually.mjs Node-version guard (<24)
    //   - src/cli.ts standalone-mode provider-error branch
    //   - src/cli.ts `main()` catch-all (`unexpected error`)
    // The doc MUST list it AND mention all three triggers so an operator
    // can map a returned exit 1 back to the actual fault.
    expect(docBody).toMatch(/\| 1 \|/u);
    expect(docBody).toMatch(/runtime error/u);
    // Triggers (any phrasing order is fine — pin the keywords).
    expect(docBody.toLowerCase()).toContain("node");
    expect(docBody).toMatch(/standalone/u);
    expect(docBody).toMatch(/provider/u);
    expect(docBody).toMatch(/internal/u);
  });

  it("documents exit code 2 — validation error (src/cli.ts validation gate)", () => {
    // exit 2 is the validation-gate contract: collectValidationErrors()
    // returns non-empty in src/cli.ts:179-194. The doc MUST mention
    // validation so operators don't conflate it with the generic 1.
    expect(docBody).toMatch(/\| 2 \|/u);
    expect(docBody).toMatch(/validation error/u);
  });

  it("documents exit code 127 — missing bundle (bin/...mjs dist guard)", () => {
    // exit 127 is the wrapper-shim's "bundle missing" branch
    // (bin/umactually.mjs lines 37-46). Distinct from 1 so
    // a fresh-clone operator who skipped `npm run bundle` gets a
    // clear, searchable signal. The doc MUST say `127` AND name the
    // missing artifact so the operator knows to run `npm run bundle`.
    expect(docBody).toMatch(/\| 127 \|/u);
    expect(docBody).toMatch(/missing bundle/u);
    expect(docBody).toMatch(/dist\/cli\.js/u);
  });

  it("uses a Markdown table shape (Code | Meaning | When)", () => {
    // The doc is consumed by humans AND by this test. A Markdown
    // table guarantees both readability (humans) and a stable
    // row-pinning surface (tests). The header row MUST use the
    // exact `Code | Meaning | When` columns so future schema
    // additions slot in without breaking the column contract.
    expect(docBody).toMatch(/\| Code \| Meaning \| When \|/u);
    expect(docBody).toMatch(/\|[-\s|]+\|/u);
  });
});