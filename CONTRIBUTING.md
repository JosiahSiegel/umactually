# Contributing to UmActually

This guide is for **cold-startup sessions** — anyone opening the repo on a fresh machine after weeks or months away. Read it first when you return to the codebase. It covers:

1. What the action does and how to think about it
2. Local development setup (`npm ci` + `ci-validate`)
3. **Read this first** order of source/docs when touching the provider layer
4. ADO ↔ GitHub sync workflow (for the operator's dual-remote setup)
5. Pre-commit + pre-PR validation sequence

## What the action does

UmActually is a provider-agnostic PR review action. It:

1. Reads a redacted PR diff from the GitHub Actions / Azure Pipelines runtime.
2. POSTs the diff to one of three provider families:
   - `openai-compatible` (default) — any OpenAI-protocol gateway
   - `copilot` — GitHub Copilot via token exchange
   - `anthropic` — native Anthropic Messages API
3. Parses the model's response into platform-native review comments (GitHub review threads or Azure PR threads).
4. Posts a stable `<!-- umactually-pr-review -->` marker so repeat runs de-duplicate feedback.

The action lives at `src/index.ts` (entrypoint) + `src/cli.ts` (bundled CLI). The GitHub Action is a thin wrapper around the CLI.

## Three-level onboarding order

When you come back to the codebase after time away, read in this order:

**Tier 1 — what it does (5 minutes):**
- `README.md` — product surface, input table, quickstarts.
- `docs/providers.md` — the provider layer in one place. THIS is the most important doc — it explains the URL resolution rules, the cross-protocol dispatcher, the dual-protocol gateway matrix. Read this if you only read one doc.

**Tier 2 — why it does it (15 minutes):**
- `docs/configuration.md` — input surface, env-var precedence, the per-family provider semantics.
- `docs/security.md` — the trust model + redaction defenses + cross-protocol dispatcher security notes.
- `docs/azure-devops.md` — the ADO platform integration (including the GitHub-sync workflow).

**Tier 3 — how to change it (30+ minutes):**
- `CHANGELOG.md` — read the recent `[Unreleased]` entries to understand current direction. The PRs #29 / #31 / #32 sequence is the recent provider-layer restructuring.
- `src/util/url.ts` — `resolveProviderBaseUrlCandidates`, `resolveAnthropicMessagesUrl`, `redactUrlForLog`. The URL layer is small and well-isolated.
- `src/cli/live-provider.ts` — `runWithCrossProtocolFallback`, `providerNameForEndpoint`. The dispatcher layer.
- `src/provider/anthropic-messages.ts` — the third provider client. Same shape as the other two.

## Local development

```bash
# Once per checkout
npm ci

# Fast validation loop (typecheck + tests + bundle + dist-freshness)
bash scripts/ci-validate.sh

# Quick checks during edit
npm run typecheck       # tsc --noEmit only
npm test                # vitest (watch mode by default; pass -- --run for CI mode)
npm run bundle          # rebuild dist/ (required before pushing)
node scripts/check-dist-freshness.mjs   # must-pass before merging
```

### Required local secrets (`.env` — gitignored)

`UMACTUALLY_API_URL`, `UMACTUALLY_API_KEY`, `DEVOPS_PAT`. Copy `.env.example` to `.env` and fill in real values. The MiniMax pattern in `.env.example` shows the dual-protocol setup the operator runs against.

### Fast inner loop for the provider layer

`test/unit/live-provider-cross-protocol-dispatch.test.ts` and `test/unit/resolve-anthropic-base-url.test.ts` together pin every contract the dispatcher and URL helper should respect. `npx vitest run test/unit/<file>.test.ts` runs them in ~200ms. Run after every edit.

## Pre-PR validation

Run in order, in this order:

```bash
npm run typecheck                                                # gates: src/ types
npm test                                                         # gates: vitest suite (≈1000 tests, ~10s)
npm run bundle && node scripts/check-dist-freshness.mjs         # gates: bundled output is fresh
bash scripts/ci-validate.sh                                      # gate: all four gates in one
git push origin <branch>                                         # uploads branch
gh pr create --base main --head <branch>                         # opens PR
```

`scripts/ci-validate.sh` is the **single implementation** of the four gates. Both `azure-pipelines.yml` and `examples/azure/azure-pipelines.yml` invoke it — there is no inline `tsc && vitest && ncc` chain anywhere. If you find yourself running the four gates piecemeal in a workflow, write the script to replace the chain instead.

## ADO ↔ GitHub sync workflow

The operator's setup has GitHub as the canonical review pipeline (the action's home repo) and an Azure DevOps fork (`josiah-siegel/DemoProject/_git/umactually`) for ADO-side validation work. When the canonical GitHub main advances, ADO main needs to catch up via a sync PR.

The end-to-end workflow is documented in [`docs/azure-devops.md`](docs/azure-devops.md#syncing-merged-github-prs-to-ado-main). The summary:

1. Merge the GitHub PR (squash, per the bot's preference).
2. `git push` a new `sync/ado-main-with-github-mainN` branch to ADO.
3. Use the ADO REST API to create a PR with `bypassPolicy: true` (bypasses the canonical-branch commit-policy check on ADO main, which the sync branch isn't subject to).
4. If ADO reports `mergeStatus: conflicts`, resolve locally: `git merge ado/main --no-ff`, `git checkout --theirs <conflict-file>`, `git commit --no-edit`.
5. `git push --force-with-lease ado sync/ado-main-with-github-mainN` to update the branch tip with the resolution.
6. PATCH the PR to `status: completed` with `bypassPolicy: true` and `lastMergeSourceCommit: { commitId: <force-pushed SHA> }`.

The sync PR's merge commit is one commit ahead of GitHub main in history (the merge commit itself), but the tree is identical. After the sync, run `bash scripts/ci-validate.sh` against ADO main to confirm parity.

## Coding conventions

Captured in code comments + this guide:

- Atomic commits per change, with conventional-commit messages (`fix:`, `feat:`, `docs:`, `test:`, `refactor:`). Multi-commit PRs are fine; the bot squash-merges anyway.
- Type-first — every public function has explicit parameter and return types. Avoid `any`, `as`, `@ts-ignore`.
- Errors are typed — every catch returns a `LiveReviewError` or `ProviderError`, never a bare `throw new Error(...)`.
- Self-healing on parse failures — every provider client retries once with a JSON-only reminder before surfacing parse-fail.
- Comments justify *why*, not *what*. The action's behavior is in the test names; the comments in src/ explain the design decisions.

## Reporting issues

Open a private security advisory for security issues (see [`docs/security.md`](docs/security.md#reporting-issues)). For non-security issues, open a public issue on the GitHub repo.
