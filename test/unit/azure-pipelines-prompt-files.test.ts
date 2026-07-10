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

// String.contains regex helpers — built with the RegExp constructor
// because the literal regex syntax chokes on `--` (the leading `-` is
// a literal char, but the parser treats it as a flag).
const reEnvVarBinding = (name: string): RegExp =>
  new RegExp(`${name}:\\s+\\$\\(${name}\\)`, "u");
const reIfBlock = (name: string): RegExp =>
  new RegExp(`if\\s+\\[\\s+-n\\s+"\\$\\{${name}:-`, "u");

describe("azure-pipelines.yml: UMACTUALLY_PROMPT_FILES / UMACTUALLY_ADDITIONAL_PROMPT_FILES forwarding", () => {
  it("root azure-pipelines.yml forwards UMACTUALLY_PROMPT_FILES to --prompt-files (conditionally)", async () => {
    const yaml = await readFile(
      join(process.cwd(), "azure-pipelines.yml"),
      "utf8",
    );
    // The pipeline MUST include the env var binding so the value
    // reaches the script's env: block (where the conditional logic
    // reads it).
    expect(yaml).toMatch(reEnvVarBinding("UMACTUALLY_PROMPT_FILES"));
    // The script body MUST conditionally append --prompt-files.
    expect(yaml).toMatch(reIfBlock("UMACTUALLY_PROMPT_FILES"));
    expect(yaml).toContain(`EXTRA_ARGS+=(${`--prompt-files`}`);
  });

  it("root azure-pipelines.yml forwards UMACTUALLY_ADDITIONAL_PROMPT_FILES to --additional-prompt-files (conditionally)", async () => {
    const yaml = await readFile(
      join(process.cwd(), "azure-pipelines.yml"),
      "utf8",
    );
    expect(yaml).toMatch(
      reEnvVarBinding("UMACTUALLY_ADDITIONAL_PROMPT_FILES"),
    );
    expect(yaml).toMatch(reIfBlock("UMACTUALLY_ADDITIONAL_PROMPT_FILES"));
    expect(yaml).toContain(`EXTRA_ARGS+=(${`--additional-prompt-files`}`);
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
    expect(yaml).toMatch(reEnvVarBinding("UMACTUALLY_PROMPT_FILES"));
    expect(yaml).toMatch(reEnvVarBinding("UMACTUALLY_ADDITIONAL_PROMPT_FILES"));
    expect(yaml).toContain(`EXTRA_ARGS+=(${`--prompt-files`}`);
    expect(yaml).toContain(`EXTRA_ARGS+=(${`--additional-prompt-files`}`);
  });
});