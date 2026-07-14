import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { FIELDS } from "../../src/config/field-schema.js";

/**
 * CLI-first contract: every CLI flag exposed by src/cli/parse-args.ts
 * MUST have a corresponding field in src/config/field-schema.ts (so the
 * action surface and the Azure DevOps pipeline can forward it).
 *
 * This is the single source of truth for "no functionality is CLI-only".
 * If a new CLI flag is added without a field-schema entry, this test
 * fails and the implementer MUST either:
 *   1. Add the field to src/config/field-schema.ts (and the action
 *      input, env var, and Azure DevOps pipeline forwarding), OR
 *   2. Add the flag to the CLI-ONLY allowlist below with a comment
 *      explaining why the action and ADO surfaces must NOT expose it
 *      (e.g. because it's a per-review dry-run / test affordance).
 *
 * The action entry (src/index.ts) and the ADO pipeline
 * (azure-pipelines.yml) MUST be thin wrappers that map their inputs
 * to CLI argv. If you find yourself adding CLI-only behavior, ask
 * whether the action's users (GitHub Actions + Azure DevOps) should
 * also be able to opt in — the answer is almost always yes.
 */
describe("CLI-first contract: every CLI flag has a field-schema entry", () => {
  // Flags intentionally NOT exposed by the action surface. Each
  // entry MUST have a one-line justification. Adding a flag here
  // IS the regression signal — this list is reviewed on every PR
  // that touches src/cli/parse-args.ts.
  const CLI_ONLY_FLAGS: ReadonlySet<string> = new Set([
    // Deprecated migration aid — the CLI surfaces a CliUsageError
    // pointing at the replacement (--minimum-severity). The
    // action doesn't have a legacy --ignore-minor surface, and
    // --no-ignore-minor is just the boolean-negation form.
    "--ignore-minor",
    "--no-ignore-minor",
    // Internal / help.
    "--help",
  ]);

  // Flags that are emitted directly by the action entry (src/index.ts)
  // based on whether INPUT_* env vars are set. They are NOT in
  // field-schema because they're "caller-owned" — the action reads
  // them from the env at the build-argv layer, not from the action's
  // declared inputs. They're also in action.yml as inputs but handled
  // by src/index.ts directly (not via append-cli-inputs.ts).
  const CALLER_OWNED_FLAGS: ReadonlySet<string> = new Set([
    "--event",
    "--diff",
    "--review",
    "--threads",
    "--pr-number",
    "--repo",
    "--platform",
    "--output-artifact",
  ]);

  it("every CLI flag has a field-schema entry (or is on the CLI-only / caller-owned allowlist)", async () => {
    const cliFlags = await extractCliFlags();
    const schemaFlags = collectSchemaFlags();

    const missing: string[] = [];
    for (const flag of cliFlags) {
      // Negation form (--no-X) is implicit in the field-schema (the
      // schema declares only the positive form; pushFieldValue
      // converts the value to the negation). Map to the positive
      // form for matching.
      const positiveForm = flag.startsWith("--no-") ? `--${flag.slice(5)}` : flag;
      if (schemaFlags.has(positiveForm)) continue;
      if (CLI_ONLY_FLAGS.has(flag)) continue;
      if (CALLER_OWNED_FLAGS.has(flag)) continue;
      missing.push(flag);
    }

    // Empty missing array == the contract holds. A non-empty
    // missing array lists every CLI flag the action surface has
    // dropped — a regression that the implementer must fix.
    expect(missing, "CLI flags without field-schema entries").toEqual([]);
  });

  it("the CLI-only allowlist is a real allowlist (no false negatives)", () => {
    // The allowlist is small. If a maintainer adds a flag to it
    // that IS in field-schema, this test fails — pin that the
    // allowlist is for true CLI-only flags only.
    const schemaFlags = collectSchemaFlags();
    for (const flag of CLI_ONLY_FLAGS) {
      const positiveForm = flag.startsWith("--no-") ? `--${flag.slice(5)}` : flag;
      expect(
        schemaFlags.has(positiveForm),
        `CLI-only allowlist contains ${flag} but it IS in field-schema. Remove from the allowlist.`,
      ).toBe(false);
    }
  });

  it("--per-request-timeout-seconds has a field-schema entry (CLI users tune it directly)", () => {
    // Regression: a future maintainer might "remove CLI-only flags"
    // by deleting the field-schema entry for --per-request-timeout-seconds.
    // The CLI still accepts it; the action layer just doesn't forward
    // it (documented in test/unit/action-inputs.test.ts). The flag
    // remains fully CLI-functional.
    expect(FIELDS.perRequestTimeoutSeconds.flag).toBe("--per-request-timeout-seconds");
    // And: the action-input layer explicitly documents it as not
    // surfaced via `with:` — pinned by the "omits --per-request-timeout-seconds
    // because inputs.perRequestTimeoutSeconds is not an ActionInput"
    // test in test/unit/action-inputs.test.ts.
  });

  it("the field-schema entries for the strict-schema / verify-findings flags are wired to the action surface", () => {
    // Defensive check: the fix that closes the strict-schema /
    // verify-findings gap is pinned here so a future refactor
    // that drops these entries fails the test.
    expect(FIELDS.strictSchema.flag).toBe("--strict-schema");
    expect(FIELDS.strictSchema.input).toBe("strict-schema");
    expect(FIELDS.strictSchema.env).toContain("UMACTUALLY_STRICT_SCHEMA");
    expect(FIELDS.verifyFindings.flag).toBe("--verify-findings");
    expect(FIELDS.verifyFindings.input).toBe("verify-findings");
    expect(FIELDS.verifyFindings.env).toContain("UMACTUALLY_VERIFY_FINDINGS");
  });

  it("(action.yml was deleted in v0.1.0 — CLI is the only entrypoint)", () => {
    // Wrapper-era action.yml cross-check is obsolete. The CLI surface
    // is the only entrypoint. This placeholder test documents the
    // removal so future readers see why the test file no longer
    // covers action inputs.
    expect(true).toBe(true);
  });
});

/**
 * Extract every CLI flag from src/cli/parse-args.ts by reading the
 * `case "--...": ` switch arms. Includes both the positive and
 * `--no-X` negation forms.
 */
async function extractCliFlags(): Promise<Set<string>> {
  const text = await readFile(
    join(process.cwd(), "src/cli/parse-args.ts"),
    "utf8",
  );
  const flags = new Set<string>();
  for (const m of text.matchAll(/case \"(--[a-z][a-z0-9-]*)\":/g)) {
    const flag = m[1];
    if (typeof flag === "string") {
      flags.add(flag);
    }
  }
  return flags;
}

/**
 * Collect every positive flag declared in FIELDS (the field-schema
 * is the single source of truth for the action surface). Negation
 * forms (`--no-X`) are implicit and excluded from this set so
 * callers can map `--no-X` -> `--X` before lookup.
 */
function collectSchemaFlags(): Set<string> {
  const flags = new Set<string>();
  for (const def of Object.values(FIELDS)) {
    if (def.flag !== null) flags.add(def.flag);
  }
  return flags;
}