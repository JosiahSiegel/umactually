#!/usr/bin/env bash
# Local E2E smoke against api.minimax.io (OpenAI + Anthropic paths).
#
# Exits non-zero if:
#   - the e2e project is not present in package.json
#   - UMACTUALLY_E2E_MINIMAX_KEY is unset (no .env fallback)
#   - any e2e test fails
#
# The e2e suite itself enforces per-row budgets (1-2 calls each)
# summing to ~26 real provider HTTP round-trips per run; this
# script does not retry.

set -euo pipefail

cd "$(dirname "$0")/.."

if ! node -e "require('./package.json').scripts['test:e2e']" >/dev/null 2>&1; then
  echo "::error::test:e2e script missing in package.json" >&2
  exit 1
fi

if [[ -z "${UMACTUALLY_E2E_MINIMAX_KEY:-}" && ! -s .env ]]; then
  echo "::error::UMACTUALLY_E2E_MINIMAX_KEY is unset and .env is empty/missing" >&2
  echo "::error::set the key in .env (test/e2e/.env.example shows the format) or in the environment" >&2
  exit 1
fi

echo "==> running e2e suite (api.minimax.io OpenAI + Anthropic)"
npm run test:e2e
