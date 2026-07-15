#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Canonical CI validation suite for the UmActually repo.
#
# This is the single implementation of the "typecheck + test + bundle +
# dist-freshness" pipeline that both azure-pipelines.yml and
# examples/azure/azure-pipelines.yml invoke. Before this script existed,
# the root pipeline ran typecheck + test inline and the example pipeline
# skipped them entirely — the two pipelines were silently diverging on
# which validation gates ran. Now both call this script and the gates
# stay in lock-step.
#
# Behaviour:
#   1. tsc --noEmit (npm run typecheck)
#   2. vitest run (npm test -- --run)
#   3. ncc bundle src/cli.ts via the existing build script (npm run bundle).
#      Re-bundling every run is required because the
#      committed dist/ may be older than src/ from someone else's prior
#      commit — see scripts/check-dist-freshness.mjs for the rationale.
#   4. Verify the freshly-built dist/ is newer than every src/*.ts file
#      (npm run check:dist-freshness). Exits 1 if the bundle is stale,
#      which would silently review with the wrong code.
#   5. Re-render the {{UMACTUALLY_*}} template tokens in README.md, docs/,
#      and examples/ (npm run render-docs) so the committed view always
#      reflects the current `package.json` `version`. The render step is
#      idempotent: a clean tree stays clean.
#   6. Run the drift guard (npm run check:version-alignment). It asserts
#      that no token survives on disk, no non-canonical {{UMACTUALLY_*}}
#      token survives, and no historical `vX.Y.Z` string survives in any
#      shipped docs file. See scripts/check-version-alignment.mjs.
#
# Usage from an Azure DevOps pipeline step:
#   - script: bash scripts/ci-validate.sh
#     displayName: Run CI validation suite
#
# Required env vars: none. The script reads no Azure-specific variables;
# it only invokes npm scripts and exits non-zero on the first failure.

set -euo pipefail

# Fail fast if npm is unavailable on the runner rather than producing a
# confusing "command not found" cascade mid-pipeline.
command -v npm >/dev/null 2>&1 || {
  echo "ci-validate: npm is not on PATH. Install Node 24.x via NodeTool@0 before invoking this script." >&2
  exit 127
}

echo "==> typecheck"
npm run typecheck

echo "==> test"
npm test -- --run

echo "==> bundle"
npm run bundle

echo "==> dist-freshness"
npm run check:dist-freshness

echo "==> render-docs"
npm run render-docs

echo "==> version-alignment"
npm run check:version-alignment -- --quiet

echo "ci-validate: OK"
