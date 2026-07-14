#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// CI smoke runner — single CLI invocation per scenario, parameterised by
// the scenario id passed as argv[2]. Replaces the four near-identical
// "CLI smoke" steps that previously lived inline in
// .github/workflows/ci.yml. Adding a new scenario = one entry here + one
// step in ci.yml, not a new 12-line block.
//
// Usage:
//   node scripts/ci-smoke.mjs S1
//   node scripts/ci-smoke.mjs S4
//   node scripts/ci-smoke.mjs S5
//   node scripts/ci-smoke.mjs S6
//
// Exit codes:
//   0  scenario produced its expected artifact
//   1  unknown scenario id (arg missing or not in the SCENARIOS table)
//   2  the CLI invocation failed (propagated exit code)

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, "..");
const CLI = resolve(packageRoot, "bin", "umactually.mjs");

const FIXTURE_EVENT_GH = "test/fixtures/github/pull-request-event.json";
const FIXTURE_DIFF_GH = "test/fixtures/github/full-pr.diff";
const FIXTURE_REVIEW_GH = "test/fixtures/github/provider-review.json";

const FIXTURE_EVENT_AZ = "test/fixtures/azure/pull-request.json";
const FIXTURE_THREADS_AZ = "test/fixtures/azure/threads.json";
const FIXTURE_PR_NUMBER_AZ = "42";
const FIXTURE_REPO_AZ = "example/umactually-fixture";

const ARTIFACT_DIR = "artifacts/manual";

/**
 * Each entry maps a scenario id to the argv that the CLI is invoked with.
 * Every scenario is `--dry-run` and writes a single output artifact under
 * artifacts/manual/. The CLI flag set was copied verbatim from the
 * pre-refactor ci.yml inline steps to keep behaviour byte-identical.
 */
const SCENARIOS = {
  S1: {
    label: "S1 GitHub dry-run",
    args: [
      "--platform", "github",
      "--event", FIXTURE_EVENT_GH,
      "--diff", FIXTURE_DIFF_GH,
      "--review", FIXTURE_REVIEW_GH,
      "--output-artifact", `${ARTIFACT_DIR}/s1-github-self-review.md`,
      "--dry-run",
    ],
  },
  S4: {
    label: "S4 Azure dry-run",
    args: [
      "--platform", "azure-devops",
      "--event", FIXTURE_EVENT_AZ,
      "--diff", FIXTURE_DIFF_GH,
      "--threads", FIXTURE_THREADS_AZ,
      "--review", FIXTURE_REVIEW_GH,
      "--pr-number", FIXTURE_PR_NUMBER_AZ,
      "--repo", FIXTURE_REPO_AZ,
      "--output-artifact", `${ARTIFACT_DIR}/s4-azure-mocked-run.json`,
      "--dry-run",
    ],
  },
  S5: {
    label: "S5 redaction",
    args: [
      "--platform", "github",
      "--event", FIXTURE_EVENT_GH,
      "--diff", FIXTURE_DIFF_GH,
      "--review", FIXTURE_REVIEW_GH,
      "--detect-leaks",
      "--output-artifact", `${ARTIFACT_DIR}/s5-redaction-report.json`,
      "--dry-run",
    ],
  },
  S6: {
    label: "S6 SonarQube mocked",
    args: [
      "--platform", "github",
      "--event", FIXTURE_EVENT_GH,
      "--diff", FIXTURE_DIFF_GH,
      "--review", FIXTURE_REVIEW_GH,
      "--include-sonarqube",
      "--sonar-host-url", "https://sonar.example.test",
      "--sonar-token", "synthetic",
      "--sonar-project-key", "synthetic",
      "--output-artifact", `${ARTIFACT_DIR}/s6-sonar-mocked-run.json`,
      "--dry-run",
    ],
  },
};

const scenarioId = process.argv[2];
const scenario = scenarioId === undefined ? undefined : SCENARIOS[scenarioId];

if (scenario === undefined) {
  const known = Object.keys(SCENARIOS).join(", ");
  process.stderr.write(`ci-smoke: unknown or missing scenario id (got ${JSON.stringify(scenarioId)}). Known: ${known}\n`);
  process.exit(1);
}

console.log(`[ci-smoke] running ${scenario.label}`);
const result = spawnSync(process.execPath, [CLI, ...scenario.args], {
  cwd: packageRoot,
  stdio: "inherit",
});
if (result.error !== undefined && result.error !== null) {
  process.stderr.write(`[ci-smoke] spawn error: ${result.error.message}\n`);
  process.exit(2);
}
process.exit(result.status ?? 2);
