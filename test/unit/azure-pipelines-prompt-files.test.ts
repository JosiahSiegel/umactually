import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The root azure-pipelines.yml and examples/azure/azure-pipelines.yml
 * are the canonical entry points for Azure DevOps users. Both
 * pipelines MUST forward the UMACTUALLY_PROMPT_FILES /
 * UMACTUALLY_ADDITIONAL_PROMPT_FILES pipeline variables to the
 * bundled CLI's --prompt-files / --additional-prompt-files flags so
 * Azure DevOps operators can supply a comma/newline-separated list
 * of repository-relative prompt files that override the
 * default-lookup list (CLAUDE.md, AGENTS.md, etc.).
 *
 * These tests pin the YAML structure so a future refactor of the
 * pipeline that drops the forwarding surfaces a test failure rather
 * than a silent regression where Azure DevOps users can no longer
 * pass the new inputs.
 */

const envVarBinding = (name: string): string => `${name}: $(${name})`;
const optionalValueAssignment = (variable: string, target: string): string =>
  `${target}=\"$(optional_env_value ${variable})\"`;

const expectOptionalMacroGuard = (yaml: string, variable: string): void => {
  expect(yaml).toContain("optional_env_value()");
  expect(yaml).toContain(`[[ "$value" == \\$\\(*\\) ]]`);
  expect(yaml).toContain(envVarBinding(variable));
};

describe("azure-pipelines.yml: UMACTUALLY_PROMPT_FILES / UMACTUALLY_ADDITIONAL_PROMPT_FILES forwarding", () => {
  it("root azure-pipelines.yml forwards UMACTUALLY_PROMPT_FILES to --prompt-files (conditionally)", async () => {
    const yaml = await readFile(
      join(process.cwd(), "azure-pipelines.yml"),
      "utf8",
    );
    expectOptionalMacroGuard(yaml, "UMACTUALLY_PROMPT_FILES");
    expect(yaml).toMatch(
      optionalValueAssignment("UMACTUALLY_PROMPT_FILES", "prompt_files"),
    );
    expect(yaml).toContain('if [ -n "$prompt_files" ]; then');
    expect(yaml).toContain(`EXTRA_ARGS+=(${`--prompt-files`} "$prompt_files")`);
  });

  it("root azure-pipelines.yml forwards UMACTUALLY_ADDITIONAL_PROMPT_FILES to --additional-prompt-files (conditionally)", async () => {
    const yaml = await readFile(
      join(process.cwd(), "azure-pipelines.yml"),
      "utf8",
    );
    expectOptionalMacroGuard(yaml, "UMACTUALLY_ADDITIONAL_PROMPT_FILES");
    expect(yaml).toMatch(
      optionalValueAssignment(
        "UMACTUALLY_ADDITIONAL_PROMPT_FILES",
        "additional_prompt_files",
      ),
    );
    expect(yaml).toContain('if [ -n "$additional_prompt_files" ]; then');
    expect(yaml).toContain(
      `EXTRA_ARGS+=(${`--additional-prompt-files`} "$additional_prompt_files")`,
    );
  });

  it("the script body uses EXTRA_ARGS expansion so unset env vars don't add empty flags", async () => {
    // Critical contract: when UMACTUALLY_PROMPT_FILES is unset, the
    // flag MUST NOT be appended (an empty --prompt-files would force
    // a useless "explicit empty" override that the CLI happens to
    // ignore — but we want the argv to be clean for tests and
    // debugging).
    const yaml = await readFile(
      join(process.cwd(), "azure-pipelines.yml"),
      "utf8",
    );
    expect(yaml).toContain("EXTRA_ARGS+=(--prompt-files");
    expect(yaml).toContain("EXTRA_ARGS+=(--additional-prompt-files");
    expect(yaml).toContain('"${EXTRA_ARGS[@]}"');
  });
});

describe("examples/azure/azure-pipelines.yml: UMACTUALLY_PROMPT_FILES / UMACTUALLY_ADDITIONAL_PROMPT_FILES forwarding", () => {
  it("example pipeline forwards both env vars to the CLI conditionally", async () => {
    const yaml = await readFile(
      join(process.cwd(), "examples/azure/azure-pipelines.yml"),
      "utf8",
    );
    expectOptionalMacroGuard(yaml, "UMACTUALLY_PROMPT_FILES");
    expectOptionalMacroGuard(yaml, "UMACTUALLY_ADDITIONAL_PROMPT_FILES");
    expect(yaml).toMatch(
      optionalValueAssignment("UMACTUALLY_PROMPT_FILES", "prompt_files"),
    );
    expect(yaml).toMatch(
      optionalValueAssignment(
        "UMACTUALLY_ADDITIONAL_PROMPT_FILES",
        "additional_prompt_files",
      ),
    );
    expect(yaml).toContain(`EXTRA_ARGS+=(${`--prompt-files`} "$prompt_files")`);
    expect(yaml).toContain(
      `EXTRA_ARGS+=(${`--additional-prompt-files`} "$additional_prompt_files")`,
    );
  });
});

describe("azure-pipelines.yml: UMACTUALLY_STRICT_SCHEMA / UMACTUALLY_VERIFY_FINDINGS forwarding (CLI-first coverage)", () => {
  it("root azure-pipelines.yml forwards both toggles to the CLI conditionally", async () => {
    // The CLI-first contract requires that every CLI flag is
    // forwardable from the Azure DevOps pipeline. The strict-schema
    // and verify-findings toggles are default-ON in the CLI; the
    // pipeline forwards them only when the operator sets the env
    // vars to opt out (the `false` value translates to
    // --no-strict-schema / --no-verify-findings).
    const yaml = await readFile(
      join(process.cwd(), "azure-pipelines.yml"),
      "utf8",
    );
    expectOptionalMacroGuard(yaml, "UMACTUALLY_STRICT_SCHEMA");
    expectOptionalMacroGuard(yaml, "UMACTUALLY_VERIFY_FINDINGS");
    expect(yaml).toMatch(
      optionalValueAssignment("UMACTUALLY_STRICT_SCHEMA", "strict_schema"),
    );
    expect(yaml).toMatch(
      optionalValueAssignment("UMACTUALLY_VERIFY_FINDINGS", "verify_findings"),
    );
    expect(yaml).toContain('if [ -n "$strict_schema" ]; then');
    expect(yaml).toContain('if [ -n "$verify_findings" ]; then');
    // Negative-form forward for opt-out.
    expect(yaml).toContain("EXTRA_ARGS+=(--no-strict-schema");
    expect(yaml).toContain("EXTRA_ARGS+=(--no-verify-findings");
    // Positive-form forward for explicit opt-in (default behavior).
    expect(yaml).toContain("EXTRA_ARGS+=(--strict-schema");
    expect(yaml).toContain("EXTRA_ARGS+=(--verify-findings");
  });
});

describe("examples/azure/azure-pipelines.yml: UMACTUALLY_STRICT_SCHEMA / UMACTUALLY_VERIFY_FINDINGS forwarding", () => {
  it("example pipeline forwards both toggles to the CLI conditionally", async () => {
    const yaml = await readFile(
      join(process.cwd(), "examples/azure/azure-pipelines.yml"),
      "utf8",
    );
    expectOptionalMacroGuard(yaml, "UMACTUALLY_STRICT_SCHEMA");
    expectOptionalMacroGuard(yaml, "UMACTUALLY_VERIFY_FINDINGS");
    expect(yaml).toMatch(
      optionalValueAssignment("UMACTUALLY_STRICT_SCHEMA", "strict_schema"),
    );
    expect(yaml).toMatch(
      optionalValueAssignment("UMACTUALLY_VERIFY_FINDINGS", "verify_findings"),
    );
    expect(yaml).toContain('if [ -n "$strict_schema" ]; then');
    expect(yaml).toContain('if [ -n "$verify_findings" ]; then');
    expect(yaml).toContain("EXTRA_ARGS+=(--no-strict-schema");
    expect(yaml).toContain("EXTRA_ARGS+=(--no-verify-findings");
  });
});