# Contributing to UmActually

This guide is for **cold-startup sessions** — anyone opening the repo on a fresh machine after weeks or months away. Read it first when you return to the codebase. It covers:

1. What the action does and how to think about it
2. Local development setup (`npm ci` + `ci-validate`)
3. **Read this first** order of source/docs when touching the provider layer
4. ADO ↔ GitHub sync workflow (for the operator's dual-remote setup)
5. Pre-commit + pre-PR validation sequence
6. Release process (version pins, template tokens, publish)
7. CI operational notes (scanner config, do-not-leak convention)

## What the action does

UmActually is a provider-agnostic PR review action. It:

1. Reads a redacted PR diff from the GitHub Actions / Azure Pipelines runtime.
2. POSTs the diff to one of three provider families:
   - `openai-compatible` (default) — any OpenAI-protocol gateway
   - `copilot` — GitHub Copilot via token exchange
   - `anthropic` — native Anthropic Messages API
3. Parses the model's response into platform-native review comments (GitHub review threads or Azure PR threads).
4. Posts a stable `<!-- umactually -->` marker so repeat runs de-duplicate feedback.

The runtime entrypoint is `src/cli.ts`, bundled as `dist/cli.js` and exposed through `bin/umactually.mjs`.

## Three-level onboarding order

When you come back to the codebase after time away, read in this order:

**Tier 1 — what it does (5 minutes):**
- `README.md` — product surface, quickstarts, documentation index.
- `docs/providers.md` — the provider layer in one place. URL resolution rules, the cross-protocol dispatcher, the dual-protocol gateway matrix. Read this if you only read one doc.

**Tier 2 — why it does it (15 minutes):**
- `docs/configuration.md` — input surface, env-var precedence.
- `docs/security.md` — trust model + redaction defenses.
- `docs/troubleshooting.md` — parse-fail triage, auto-artifact validation, concurrency notes.

**Tier 3 — how to change it (30+ minutes):**
- `CHANGELOG.md` — read the recent `[Unreleased]` entries to understand current direction.
- `src/util/url.ts`, `src/cli/live-provider.ts`, `src/provider/anthropic-messages.ts` — the URL layer, dispatcher, and third provider client.

## Local development

```bash
npm ci                            # once per checkout
bash scripts/ci-validate.sh       # typecheck + tests + bundle + dist-freshness + render-docs + version-alignment
npm run typecheck                 # fast inner-loop check
npm test                          # vitest watch mode; pass -- --run for CI mode
npm run bundle                    # rebuild dist/ (required before pushing)
```

### Required local secrets (`.env` — gitignored)

`UMACTUALLY_API_URL`, `UMACTUALLY_API_KEY`, `DEVOPS_PAT`. Copy `.env.example` to `.env` and fill in real values. The MiniMax pattern in `.env.example` shows the dual-protocol setup the operator runs against.

### Fast inner loop for the provider layer

`test/unit/live-provider-cross-protocol-dispatch.test.ts` and `test/unit/resolve-anthropic-base-url.test.ts` together pin every contract the dispatcher and URL helper should respect. `npx vitest run test/unit/<file>.test.ts` runs them in ~200ms. Run after every edit.

## Pre-PR validation

```bash
npm run typecheck
npm test
npm run bundle && node scripts/check-dist-freshness.mjs
npm run render-docs
npm run check:version-alignment
bash scripts/ci-validate.sh
git push origin <branch>
gh pr create --base main --head <branch>
```

`scripts/ci-validate.sh` is the **single implementation** of the six gates — both `azure-pipelines.yml` and `examples/azure/azure-pipelines.yml` invoke it. There is no inline `tsc && vitest && ncc` chain anywhere; if you find yourself running gates piecemeal in a workflow, write the script to replace the chain.

## ADO ↔ GitHub sync workflow

The operator maintains a fork of this action in Azure DevOps for ADO-side validation work and needs ADO `main` to stay in lock-step with the canonical GitHub `main`. The full six-step workflow — including the conflict-resolution dance when ADO's `mergeStatus: conflicts` — lives in [`docs/azure-devops.md#syncing-merged-github-prs-to-ado-main`](docs/azure-devops.md#syncing-merged-github-prs-to-ado-main).

## Release process

Cutting a new release is documented end-to-end in [`docs/release-process.md`](docs/release-process.md). Maintainer TL;DR: bump `version` in `package.json`, fill in the `[X.Y.Z]` CHANGELOG heading, run `npm run render-docs` and `bash scripts/ci-validate.sh`, open a release PR, merge to main, sync to ADO, tag with `git tag -a vX.Y.Z`, push. The pre-flight helper `scripts/release.sh vX.Y.Z` automates the package.json + CHANGELOG + render-docs + ci-validate steps; the rest is manual on purpose so the maintainer sees every commit and tag.

`scripts/render-versions.mjs` and `scripts/check-version-alignment.mjs` enforce the version-pin invariant that shipped docs always show `v<package.json version>`. The renderer rewrites both `{{UMACTUALLY_*}}` template tokens AND historical `vX.Y.Z` literals whose `X.Y.Z ≠ package.json version`, so the first release needs the tokens replaced and every subsequent release just runs the renderer. URL path segments like `https://semver.org/spec/v2.0.0.html` are preserved (they are not rewritten or flagged as drift).

## Coding conventions

- Atomic commits with conventional-commit messages (`fix:`, `feat:`, `docs:`, `test:`, `refactor:`). Multi-commit PRs are fine; the bot squash-merges anyway.
- Type-first: every public function has explicit parameter and return types. Avoid `any`, `as`, `@ts-ignore`.
- Errors are typed: every catch returns a `LiveReviewError` or `ProviderError`, never a bare `throw new Error(...)`.
- Self-healing on parse failures: every provider client retries once with a JSON-only reminder before surfacing parse-fail.
- Comments justify *why*, not *what*. The action's behavior is in the test names; the comments in src/ explain the design decisions.

## CI operational notes

### Secret scanning (GitGuardian)

The UmActually repository uses [GitGuardian's GitHub App](https://dashboard.gitguardian.com) to scan every PR for committed secrets. The detector is the industry-standard high-recall scanner — any long random-looking string assigned to a variable named `apiKey`, `token`, `secret`, etc. triggers an incident. This is the right posture for production code and surfaces the kind of accidental credential commit that would otherwise ship to a public mirror.

#### Per-repo configuration (`.gitguardian.yaml`)

`secret.ignored_paths` excludes `test/**`, `tests/**`, `**/*.test.ts`, `**/*.spec.ts`, `**/__tests__/**`, `**/fixtures/**`, `**/__snapshots__/**`, `dist/**`, `build/**`, `coverage/**`, `artifacts/**`, `docs/**`, `**/*.md`, `**/*.rst`, `LICENSE`, `CHANGELOG*`, and editor scratch. These are the paths where the `do-not-leak` fixtures and the per-run redaction-report / cassette artifacts live.

`secret.ignored_matches` pre-registers the `sk-*-do-not-leak` fixture values from the cross-protocol-dispatch test file so the corresponding dashboard incidents auto-resolve on the next scan. **The `Generic High Entropy Secret` detector is NOT globally disabled** — `src/**` and `bin/**` stay fully scanned. Production code is the surface that needs the most aggressive scanning.

The full configuration is 144 lines and lives at `.gitguardian.yaml` in the repo root. Schema reference: <https://docs.gitguardian.com/ggshield-docs/configuration>.

#### False positives

The `.gitguardian.yaml` config governs **future** scans. Pre-existing incidents in the GitGuardian workspace must be resolved manually — the config does not retroactively close them. When the scanner reports a `Generic High Entropy Secret` incident on a `do-not-leak` test fixture:

1. Open the incident at the URL printed in the PR check annotation.
2. Click **Ignore** and choose the reason **False positive**.
3. Add a comment citing this section so the audit trail is self-explanatory: `Synthetic test fixture per the do-not-leak sentinel convention; see CONTRIBUTING.md#ci-operational-notes.`

To script the resolution via the GitGuardian API:

```bash
curl -X POST "https://api.gitguardian.com/v1/incidents/secrets/<incident_id>/ignore" \
  -H "Authorization: Token $GITGUARDIAN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"ignore_reason": "false_positive_test"}'
```

`GITGUARDIAN_API_KEY` is the workspace API token from **GitGuardian dashboard → Settings → API**. The valid `ignore_reason` values are `false_positive_test`, `false_positive`, `test_credential`, `low_risk`, or `low_severity`. For `do-not-leak` fixtures, `false_positive_test` is the right choice.

#### Real secrets

If GitGuardian reports a finding that is NOT a `do-not-leak` fixture in `test/`:

1. **Do not merge the PR.** Treat the report as a security incident.
2. Rotate the leaked credential at the issuing platform (GitHub PAT settings, Azure DevOps PAT settings, the provider's API-key console, etc.).
3. Rewrite git history to remove the secret (`git filter-repo` or BFG).
4. Add the rotated value to your platform's secret store and reference it via `${{ secrets.* }}` (GitHub) or the variable group's secret variable (Azure DevOps).
5. Mark the incident **Resolved** in the GitGuardian dashboard with `secret_revoked: true`.

The scanner is configured to fail CI on any open incident at the `Triggered` status.

## Reporting issues

For security issues, open a private security advisory (see [`docs/security.md`](docs/security.md#reporting-issues)). For non-security issues, open a public issue on the GitHub repo.
