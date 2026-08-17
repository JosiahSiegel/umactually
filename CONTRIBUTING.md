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

## Architecture and ownership map

[`docs/architecture.md`](docs/architecture.md) maps the CLI, configuration/policy, platform context, provider, review-contract, posting, distribution, and proof layers to their source and test paths. Start there before making cross-layer changes. Schema changes require compatibility and rollback notes; comparative product copy requires a reproducible artifact and an entry in [`docs/benchmark.md#claims-inventory`](docs/benchmark.md#claims-inventory).

## Dependency-update policy

Dependabot proposes weekly npm and GitHub Actions updates under `.github/dependabot.yml`. A dependency PR must explain runtime/security impact, preserve Node.js 24 support, update every rendered/versioned surface when applicable, and pass the same full verification as a feature PR. Review lockfile changes as resolver output; never hand-edit them. Treat a `0.x` minor bump as potentially breaking, read upstream release notes, and keep action references immutable. Do not add a dependency when the platform, standard library, or an existing dependency already owns the contract.

## Local development

```bash
npm ci                            # once per checkout
bash scripts/ci-validate.sh       # typecheck + tests + bundle + dist-freshness + render-docs + version-alignment
npm run typecheck                 # fast inner-loop check
npm test                          # vitest watch mode; pass -- --run for CI mode
npm run bundle                    # rebuild dist/ (required before pushing)
```

### Required local secrets (`.env` — gitignored)

`UMACTUALLY_API_URL`, `UMACTUALLY_API_KEY`, `DEVOPS_PAT`. Copy `.env.example` to `.env` and fill in real values. The generic `gateway.example.com` examples in `.env.example` show the dual-protocol setup the operator runs against.

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

**Before you tag**: read [`docs/release-process.md` § 5](#5-cut-the-tag) and [`docs/release-process.md` § 10](#10-verify-npm-publication-timed-out--did-the-publish-actually-land) — the tag-anchor trap (squash-merge commit vs. branch tip) and the verify-step false-positive have both wasted a maintainer afternoon in production. The doc's [`§ 11 Pre-release gotchas`](#11-pre-release-gotchas-that-dont-fail-the-six-gates-but-will-fail-the-release-pr) is the field guide for the three CHANGELOG / dist / bundle traps that don't fail `ci-validate.sh` but will fail the release PR or the post-tag workflow. Recipes for confirming a publish landed are in [`§ 12 Recipes`](#12-recipes).

`scripts/render-versions.mjs` and `scripts/check-version-alignment.mjs` enforce the version-pin invariant that shipped docs always show `v<package.json version>`. The renderer rewrites both `{{UMACTUALLY_*}}` template tokens AND historical `vX.Y.Z` literals whose `X.Y.Z ≠ package.json version`, so the first release needs the tokens replaced and every subsequent release just runs the renderer. URL path segments like `https://semver.org/spec/v2.0.0.html` are preserved (they are not rewritten or flagged as drift).

### npm publication (Trusted Publishing / OIDC)

The release workflow's `publish-npm` job publishes `umactually` to npmjs.org after the GitHub Release succeeds. The job is gated on the same real-release-tag pattern as `publish`, and authenticates via **Trusted Publishing (OIDC)** — no long-lived secret, no 2FA prompt at CI time. `npm publish --provenance --tag latest` is invoked with `id-token: write` granted at the job level; the npm CLI exchanges the OIDC token for a short-lived registry session token. The maintainer-facing pre-flight is the existing `npm run prepublishOnly`, which runs typecheck → test → bundle → render-docs → drift-guard → dist-freshness in order.

**There is no `NPM_TOKEN` repo secret.** Authentication is entirely via the Trusted Publisher binding configured on npmjs.org.

#### One-time setup (already complete as of the initial npm claim)

The package name `umactually` was claimed on 2026-08-01 via `npm publish --no-provenance --ignore-scripts --tag latest` from a local terminal — see [§ Publish authentication in 2026](#publish-authentication-in-2026-webauth--device-flow) below for the exact mechanism. The Trusted Publisher binding still needs to be configured on npmjs.com after this first publish; the binding is the prerequisite for the `publish-npm` GHA job.

1. **Manually publish the first version** of `umactually` to claim the package name on npmjs.org. Trusted Publishers cannot be configured against a name that doesn't exist yet. From a local terminal with `npm@10+`:

   ```bash
   npm publish --provenance=false --tag latest --registry https://registry.npmjs.org/
   ```

   `--provenance=false` overrides `package.json#publishConfig.provenance: true` for this single invocation — no `package.json` edit, no rollback commit, no temporary downgrade of the published provenance commitment. The CLI emits a `EOTP — This operation requires a one-time password` error and prints a URL like `https://www.npmjs.com/auth/cli/<id>` along with a polling endpoint `https://registry.npmjs.org/-/v1/done?authId=<id>`. Open the `auth/cli/<id>` URL in any browser, complete the GitHub-backed sign-in (passkey, security key, or Touch ID — whatever your account has configured), and the publish proceeds. There is no `--otp` step. See [§ Publish authentication in 2026: WebAuth / device flow](#publish-authentication-in-2026-webauth--device-flow) for the full mechanism, including the non-TTY helper script.

   **CRITICAL: the WebAuth URL only appears in full when read from a real interactive TTY.** npm CLI redacts the `<id>` portion to `***` in redirected output (background jobs, piped, captured). Running `npm publish` in a CI shell, a background job, or any non-TTY context will print `https://www.npmjs.com/auth/cli/***` with no way to recover the actual ID from the text output. The structured `--json` output (and the JSON inside the human-readable error block) does include the full URLs, which is why `scripts/publish-with-webauth.mjs` uses `--json` to extract them programmatically. Always run the first-time publish from a terminal you can read interactively (your laptop, a SSH session with an active shell, a tmux pane — any of those work; an automated agent shell must use the helper script below).

   **Why `--provenance=false` is required locally**: a local machine has no GitHub Actions OIDC issuer to mint a Sigstore provenance attestation. With `package.json#publishConfig.provenance: true` and no CLI override, the CLI errors with `npm error code EUSAGE — Automatic provenance generation not supported for provider: null`. The CI publish path uses GitHub Actions OIDC + `--provenance`, so `provenance: true` in `package.json` stays correct for that path; the local first-time publish just needs the CLI override.
2. **Configure the Trusted Publisher binding** on https://www.npmjs.com/package/umactually/settings → Publishing access → Add a Trusted Publisher → GitHub Actions. Repository: `JosiahSiegel/umactually`. Workflow filename: `release.yml`. Environment: (optional, leave blank). Confirm with a test tag push before relying on this binding for a real release.
3. **(Optional, recommended)** On the same npm settings page, enable **"Require two-factor authentication and disallow tokens"** so direct publishing requires a 2FA flow that only the maintainers control — preventing a future maintainer from accidentally pasting a long-lived secret into CI.
4. **(One-time cleanup)** If the repo previously stored an `NPM_TOKEN` secret, delete it from Settings → Secrets and variables → Actions. Revoke any old Granular Tokens at https://www.npmjs.com/settings/~/tokens. From this point forward there is no token to rotate, expire, or leak.

#### Subsequent releases

Use the GitHub Actions workflow exclusively. Push the version tag and `release.yml` runs the `publish-npm` job automatically. The job exchanges the OIDC token for a short-lived session token at publish time; nothing is stored in repo secrets, nothing needs rotation, nothing has a 90-day expiry. The `Verify npm publication` step in the same job runs a two-phase probe: Phase 1 polls the package-level `dist-tags.latest` field on `registry.npmjs.org` for up to 12 retries spaced 5 seconds apart (60s budget), and Phase 2 cross-validates by polling the per-version URL's `attestations` field for up to 60 retries spaced 10 seconds apart (600s budget). The two-phase shape replaced a single-probe 50s budget after the 0.10.x release series, where `npm` reported success but registry propagation lagged past the timeout and falsely failed the canary; Phase 1 catches the common case fast while Phase 2 backs it up with the long-tail budget.

#### Manual re-publish (release engineer)

If the automated path fails and a maintainer needs to push a version directly, the same WebAuth flow used in step 1 still works:

```bash
npm publish --provenance=false --tag latest --registry https://registry.npmjs.org/
```

The CLI prints a fresh `https://www.npmjs.com/auth/cli/<id>` URL; open it, complete the GitHub-backed sign-in, and the publish proceeds. No token to mint, no `--otp` to type, no 90-day clock.

#### Publish authentication in 2026: WebAuth / device flow

**TL;DR (Aug 2026):** `bypass_2fa: true` on a Granular Access Token (GAT) is no longer honored at publish time. Every `npm publish` for an account with 2FA enabled — including the first publish that claims a new package name — requires an interactive WebAuth challenge (passkey, security key, Touch ID) via a browser. There is no fully automated path for the first publish; the publish only proceeds after a human approves in a browser.

This section documents the actual mechanism in detail so maintainers know what the CLI error messages mean and what the options are. Sources: [github.blog 2026-07-31 — Restricting npm bypass-2FA granular access tokens](https://github.blog/changelog/2026-07-31-restricting-npm-bypass-2fa-granular-access-tokens/), [github.blog 2026-07-08 — npm install-time security and GAT bypass2fa deprecation](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/), [docs.npmjs.com/trusted-publishers](https://docs.npmjs.com/trusted-publishers/), [docs.npmjs.com/about-access-tokens](https://docs.npmjs.com/about-access-tokens/).

##### What npm is moving away from

npm deprecated **classic tokens** in 2022, **TOTP authenticator apps** for new accounts in Oct 2025 ([community discussion #178140](https://github.com/orgs/community/discussions/178140) — "TOTP 2FA: Cannot add new or reconfigure existing setups"), and **Granular Access Tokens with `bypass_2fa: true`** for direct publishing in two waves:

| Date | Change | Reference |
| --- | --- | --- |
| 2026-07-08 | `bypass_2fa: true` GATs lose the ability to publish directly; staged publish only | github.blog 2026-07-08 changelog |
| 2026-07-31 | `bypass_2fa: true` GATs blocked from account/org/package **management** actions (token create/delete, maintainer changes, access, trusted-publishing config) | github.blog 2026-07-31 changelog |
| ~2027-01 | `bypass_2fa: true` GATs lose direct publish entirely (the change is currently being enforced ahead of schedule) | github.blog 2026-07-08 changelog |

In practice today: minting a GAT with `bypass_2fa: true` still succeeds (the API accepts the field), but the registry now treats it like any other 2FA-bound token at publish time — the EOTP error appears, and the CLI opens a WebAuth URL regardless of the token's bypass flag. The only fully-automated publish path is **Trusted Publishing (OIDC)** from a CI/CD runner, and that requires the package name to already exist on the registry.

##### What `npm publish` does today when 2FA is required

The CLI returns `npm ERR! code EOTP` with two URLs in the error detail and in `--json` output:

```text
Open this URL in your browser to authenticate:
  https://www.npmjs.com/auth/cli/<authId>
After authenticating, your token can be retrieved from:
  https://registry.npmjs.org/-/v1/done?authId=<authId>
```

`auth/cli/<authId>` is the **WebAuthn challenge page**: sign in, the browser triggers the configured authenticator (passkey, security key, Touch ID), and on approval the registry marks the authId as approved. `doneUrl` is the polling endpoint; after approval it returns `{"token":"<16-digit-otp>"}` — that token is the **registry session token** that `npm publish --otp=<token>` consumes (npm calls it an "OTP" in the error message but the value IS the session token, not a TOTP code).

There are two browser-side actions a user can take:

| Browser action | Effect on doneUrl | Effect on subsequent `npm publish` from the same terminal |
| --- | --- | --- |
| **Approve** with the configured authenticator | Returns `{"token":"<16-digit-otp>"}` | `--otp=<token>` consumed and publish proceeds |
| **Don't challenge requests from this IP for N minutes** | Returns `""` indefinitely (until the window expires) | Next `npm publish` from the same IP succeeds without OTP for the next N minutes |

The IP-trust window is the path the initial npm publish used in practice — it lets the maintainer skip the WebAuth ceremony when they're already authenticated. It is **NOT a bypass of the security model**: the trust window is bound to (account, IP, expiry) on the registry side, expires automatically, and reverts to the WebAuth challenge on the next publish from a different IP.

##### Three publish paths, in priority order

1. **Trusted Publishing (OIDC) from CI** — the canonical path. After the package exists on the registry and a Trusted Publisher binding is configured on npmjs.com, the `publish-npm` job in `.github/workflows/release.yml` publishes with `id-token: write` and no human in the loop. **Use this for every release after the first.**
2. **Local manual publish from a TTY** — the path for the first publish and any emergency re-publish. Run `npm publish --provenance=false --tag latest --registry https://registry.npmjs.org/` from your laptop / SSH session / tmux pane. Read the `auth/cli/<id>` URL directly, click Approve or "Don't challenge this IP", and the publish proceeds. See [`scripts/publish-with-webauth.mjs`](scripts/publish-with-webauth.mjs) for a helper if you must run this from a non-TTY shell (the script uses `npm publish --json` to extract the URLs programmatically and polls `doneUrl` for the session token).
3. **Local automated publish via the IP-trust window** — what the initial npm claim actually used. Click "Don't challenge requests from this IP for N minutes" in the browser once, then re-run `npm publish --provenance=false --tag latest --registry https://registry.npmjs.org/` from the same terminal within the window. The publish goes straight through with no OTP. This works because the registry trusts the IP for that window; it does not require any new token or configuration. **This is the lowest-friction first-publish path when a maintainer is already authenticated and just wants to claim the name.**

##### Programmatic WebAuth helper (non-TTY environments)

[`scripts/publish-with-webauth.mjs`](scripts/publish-with-webauth.mjs) automates the polling loop for environments that can't display the authUrl to a human in real time (CI shells, agents, captured-stdout pipelines). It:

1. Invokes `npm publish --no-provenance --ignore-scripts --json` and parses the JSON error block to extract `authUrl` and `doneUrl` (the `--json` flag returns the URLs in full even when stderr is captured — the human-readable error path redacts the `<id>` to `***` in non-TTY mode).
2. Prints the `authUrl` and a "waiting for OTP" banner.
3. Polls `doneUrl` every 3s for up to `--timeout=<sec>` (default 180s), handling both `{"token":"..."}` (success) and `{"message":"not found"}` (authId consumed/expired) responses.
4. On success, re-runs `npm publish --no-provenance --ignore-scripts --otp=<token>` with the registry session token.

Usage:

```bash
node scripts/publish-with-webauth.mjs --timeout=300
```

If the user picks the IP-trust window option in the browser instead of approving WebAuth, the script's doneUrl poll stalls (the registry never returns a token — it just returns `""`). The script's timeout error explains this and tells the user to re-run `npm publish --no-provenance --ignore-scripts` from the same terminal within the IP-trust window. **This is expected behavior**, not a failure — pick the right path for your auth posture before invoking the script.

##### Why `--ignore-scripts` and `--no-provenance`

- `--ignore-scripts` skips the `prepublishOnly` hook in `package.json`. The hook runs `npm run typecheck && npm test -- --run && npm run bundle && npm run render-docs && npm run check:version-alignment && npm run check:dist-freshness` — that gate is enforced by CI (the same hook runs in the `publish-npm` job), so re-running it for a manual first publish is redundant and slow. Skip it; if any gate would have failed, CI would have caught it first.
- `--no-provenance` overrides `package.json#publishConfig.provenance: true` for this single invocation. Without the override, the registry errors with `npm ERR! code EUSAGE — Automatic provenance generation not supported for provider: null` because the local CLI has no GitHub Actions OIDC issuer to mint a Sigstore attestation. The CI publish path uses OIDC + `--provenance` and is unaffected.

##### `~/.npmrc` overrides `.env` `NPM_TOKEN`

If your environment has both an `.env` `NPM_TOKEN=...` and a `~/.npmrc` line like `//registry.npmjs.org/:_authToken=...`, the `~/.npmrc` token wins (npm config layering: builtin → env → project → user → global, with user-level `.npmrc` overriding env vars). Verify which token your `npm publish` is actually using before debugging an auth failure:

```bash
npm config get //registry.npmjs.org/:_authToken  # prints "(protected)" — that's expected
npm config ls -l --location=user | grep auth     # shows the resolved value masked
# Direct check:
curl -sS -H "Authorization: Bearer $NPM_TOKEN" https://registry.npmjs.org/-/npm/v1/tokens | jq '.objects[] | {name, bypass_2fa, revoked}'
```

If `~/.npmrc` holds a stale or wrong token (different account, expired, or wrong scope), the local CLI uses it and `npm publish` fails with that account's auth errors. Delete or update the line, then re-run.

#### Failure modes and recovery

See [`docs/release-process.md` § 8.5](docs/release-process.md#85-npm-publish-failed-github-release-succeeded-npm-didnt) for the full troubleshooting matrix. Common symptoms post-OIDC:

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `npm ERR! code EOTP — requires a one-time password` | Trusted Publisher binding missing on npmjs.com (CI path) OR first-publish name claim (local path) | CI: add the GitHub Actions binding. Local: complete WebAuth once or use the IP-trust window. See [§ Publish authentication in 2026](#publish-authentication-in-2026-webauth--device-flow). |
| `npm ERR! code EUSAGE — Automatic provenance generation not supported for provider: null` | Local CLI attempted publish with `publishConfig.provenance: true` and no `--no-provenance` override | Add `--provenance=false` to the command, or publish from CI |
| `error: ID token could not be minted` | `id-token: write` permission missing from `release.yml` | Confirm the job-level permission block; re-run |
| `npm ERR! code E404 — 'umactually@*' is not in this registry` | Package name not yet claimed | One-time setup step 1: local WebAuth publish (or IP-trust window) |
| `npm ERR! code E403 — cannot modify existing version` | SHA divergence or duplicate publish | Bump to `vX.Y.Z+1` and cut a patch release |
| Local CLI uses the wrong npm account | `~/.npmrc` overrides `.env` `NPM_TOKEN` | Audit `npm config ls -l --location=user`, fix the stale line, re-run |

Rotation reminders and 90-day token timers are not applicable — there is no token. The only state to maintain is the Trusted Publisher binding on npmjs.com, which is a single dashboard click to add and never expires.

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
