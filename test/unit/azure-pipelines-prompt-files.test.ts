import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Wrapper-era regression guard. The CLI is now native-env-aware
 * (every UMACTUALLY_* env var flows through automatically), so the
 * example pipelines do NOT need bash forwarding macros.
 *
 * If a future refactor re-introduces the optional_env_value() macro
 * for UMACTUALLY_PROMPT_FILES, UMACTUALLY_ADDITIONAL_PROMPT_FILES,
 * UMACTUALLY_STRICT_SCHEMA, or UMACTUALLY_VERIFY_FINDINGS, that is
 * almost certainly a regression — the CLI handles those natively
 * today and the example should stay minimal.
 */

const REPO_ROOT = process.cwd();

async function readPipeline(name: "azure-pipelines.yml" | "examples/azure/azure-pipelines.yml"): Promise<string> {
  return readFile(join(REPO_ROOT, name), "utf8");
}

describe("example pipelines do not contain wrapper-era bash forwarding", () => {
  it("examples/azure/azure-pipelines.yml has no optional_env_value() macro", async () => {
    const yaml = await readPipeline("examples/azure/azure-pipelines.yml");
    expect(yaml).not.toContain("optional_env_value()");
  });

  it("examples/azure/azure-pipelines.yml has no EXTRA_ARGS array", async () => {
    const yaml = await readPipeline("examples/azure/azure-pipelines.yml");
    expect(yaml).not.toContain("EXTRA_ARGS=()");
  });

  it("examples/azure/azure-pipelines.yml has no separate check-review-artifact step", async () => {
    const yaml = await readPipeline("examples/azure/azure-pipelines.yml");
    expect(yaml).not.toContain("check-review-artifact");
  });
});
