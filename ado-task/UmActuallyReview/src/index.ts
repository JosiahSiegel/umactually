#!/usr/bin/env node
// SPDX-License-Identifier: MIT
/**
 * Azure Pipelines Task handler for `UmActuallyReview`.
 *
 * Mirrors the published Composite Action's flow (see `JosiahSiegel/umactually-action@v1`):
 *   1. Bootstrap: detect missing `UMACTUALLY_API_URL` or
 *      `UMACTUALLY_API_KEY` env vars and exit with the typed error
 *      code `UMACTUALLY_ERR_SECRET_BOOTSTRAP` (3, see
 *      `src/util/exit-codes.ts`).
 *   2. Install the pinned CLI: `npm install -g umactually@<cliVersion>`.
 *      The default value `__UMACTUALLY_VERSION__` is substituted by
 *      the wizard at emit time; if it survives to runtime the build
 *      step didn't run and the task exits with a typed error.
 *   3. Run the live review: `umactually review --platform azure`.
 *   4. Parse the artifact JSON and surface `verdict`,
 *      `inlineThreadCount`, and `reviewId` as ADO output variables
 *      (set via `##vso[task.setvariable variable=…;isOutput=true]…`).
 *
 * `SYSTEM_ACCESSTOKEN` is forwarded via the env block in the
 * `examples/azure/azure-pipelines.yml.task-ref.yml` pipeline; the task
 * does not need to know about it explicitly.
 *
 * This source is compiled into `dist/index.js` by the project's
 * `tfx-cli pack` step (`tfx-cli pack --task-path ./ado-task/UmActuallyReview`).
 * The shipped `dist/index.js` is a generated stub in this repo (see
 * `dist/index.js`) — `tfx-cli` rewrites it during the real pack step
 * (plan T07).
 */
"use strict";

const { spawnSync } = require("node:child_process");
const { readFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");

const UMACTUALLY_TYPED_EXIT_CODES = {
  // RUNTIME_ERROR (1) is for packaging failures — e.g. the
  // `__UMACTUALLY_VERSION__` placeholder surviving to runtime — so
  // branch-protection rules (which branch on 3 for missing secrets)
  // don't mis-attribute packaging bugs to secrets. See `installCli()`.
  RUNTIME_ERROR: 1,
  SECRET_BOOTSTRAP: 3,
  PUBLISHER_UNVERIFIED: 4,
};

/**
 * Read a single input from the ADO task SDK. `process.env[name]` is
 * the path ADO uses to inject inputs (the SDK builds a tmp file that
 * exports each input as an env var). Returns `undefined` if the input
 * was not provided.
 */
function readInput(name) {
  return typeof process.env[name] === "string" ? process.env[name] : undefined;
}

/**
 * Surface an ADO output variable. Mirrors the action's `$GITHUB_OUTPUT`
 * pattern so both entry points use the same downstream contract.
 */
function setOutput(name, value) {
  // isOutput=true is required for the consuming pipeline to read
  // `$(task.<jobName>.<name>)` syntax.
  console.log(`##vso[task.setvariable variable=${name};isOutput=true]${value}`);
}

/**
 * Detect the typed plan exit code from the child's exit status.
 * Mirrors `isTypedPlanExitCode` in `src/util/exit-codes.ts`.
 */
function isTypedPlanExitCode(code) {
  return Object.prototype.hasOwnProperty.call(UMACTUALLY_TYPED_EXIT_CODES, code);
}

function bootstrap() {
  const apiUrl = readInput("apiUrl");
  const apiKey = readInput("apiKey");
  if (!apiUrl || !apiKey) {
    // Typed-error contract: exit code 3 + `UMACTUALLY_ERR_SECRET_BOOTSTRAP`
    // The literal is documented in `src/util/exit-codes.ts` and
    // `docs/exit-codes.md`. Don't replace the literal — the typed-
    // error name is part of the contract.
    console.error("::error::UMACTUALLY_ERR_SECRET_BOOTSTRAP — UMACTUALLY_API_URL or UMACTUALLY_API_KEY is empty.");
    process.exit(UMACTUALLY_TYPED_EXIT_CODES.SECRET_BOOTSTRAP);
  }
}

function installCli() {
  const cliVersion = readInput("cliVersion") || "__UMACTUALLY_VERSION__";
  // Exit 1 (RUNTIME_ERROR), NOT 3 (SECRET_BOOTSTRAP): code 3 is the
  // typed-error contract for missing secrets and branch-protection rules
  // surface it as "secret bootstrap required". An un-substituted
  // version pin is a packaging bug, not a secret bootstrap failure, and
  // must not mis-attribute to the secrets path. The `UMACTUALLY_ERR_
  // CLI_VERSION_UNRESOLVED` log is a `::error::` string only — it is
  // intentionally NOT a numeric exit code (see `src/util/exit-codes.ts`).
  if (cliVersion === "__UMACTUALLY_VERSION__") {
    console.error("::error::UMACTUALLY_ERR_CLI_VERSION_UNRESOLVED — cliVersion is the un-substituted wizard placeholder; pin it to a CLI version (e.g. `0.10.0`) or regenerate the workflow via `umactually init`.");
    process.exit(UMACTUALLY_TYPED_EXIT_CODES.RUNTIME_ERROR);
  }
  const install = spawnSync("npm", ["install", "-g", `umactually@${cliVersion}`], { stdio: "inherit" });
  if (install.status !== 0) {
    process.exit(install.status ?? 1);
  }
}

function runReview() {
  const configPath = readInput("configPath") || "./umactually.review.json";
  const outputArtifact = readInput("outputArtifact") || "umactually-review.json";
  const skipDraft = readInput("skipDraft") || "true";
  const pathsIgnore = readInput("pathsIgnore") || "**/*.md,docs/**,**/*.lock";
  const provider = readInput("provider") || "openai-compatible";
  const model = readInput("model") || "";
  const review = spawnSync(
    "umactually",
    [
      "review",
      "--platform",
      "azure",
      "--provider",
      provider,
      "--config-path",
      configPath,
      "--output-artifact",
      outputArtifact,
      "--skip-draft",
      skipDraft,
      "--paths-ignore",
      pathsIgnore,
      ...(model ? ["--model", model] : []),
    ],
    { stdio: "inherit", env: process.env },
  );
  if (review.status !== 0 && typeof review.status === "number" && !isTypedPlanExitCode(review.status)) {
    process.exit(review.status);
  }
  // Typed plan exit codes propagate so the consumer can branch on
  // the typed-error name. The action's bootstrap step already exits
  // with code 3 before this runs, so propagation is for completeness.
  if (review.status !== 0) {
    process.exit(review.status);
  }
}

function emitOutputs() {
  const outputArtifact = readInput("outputArtifact") || "umactually-review.json";
  if (!existsSync(outputArtifact)) {
    setOutput("verdict", "failure");
    setOutput("inlineThreadCount", "0");
    setOutput("reviewId", "");
    return;
  }
  try {
    const json = JSON.parse(readFileSync(outputArtifact, "utf8"));
    setOutput("verdict", json.verdict || "success");
    setOutput("inlineThreadCount", String(json.inlineThreadCount ?? 0));
    setOutput("reviewId", (json.metadata && json.metadata.requestId) || json.reviewId || "");
  } catch {
    setOutput("verdict", "failure");
    setOutput("inlineThreadCount", "0");
    setOutput("reviewId", "");
  }
}

function main() {
  bootstrap();
  installCli();
  runReview();
  emitOutputs();
}

main();