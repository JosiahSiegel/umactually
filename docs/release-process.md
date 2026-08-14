# Release process

This document is the canonical, end-to-end runbook for cutting a new UmActually release. It is written for a maintainer who has just been told "we need to ship the next release" and wants the shortest safe path through the six CI gates, the version-token render, the tag push, and the post-tag GitHub Release workflow. Throughout this document the placeholder `vX.Y.Z` stands for whichever next version you are cutting (pick the actual numbers via [§ 3 SemVer decision guide](#3-semver-decision-guide)).

The release flow has three properties worth understanding up front. First, `package.json` `version` is the single source of truth: every other version literal in the repo is auto-rendered from it, and you should never hand-edit a `vX.Y.Z` pin in shipped docs. Second, the six CI gates in `scripts/ci-validate.sh` are the only validation you need; both `azure-pipelines.yml` and `examples/azure/azure-pipelines.yml` invoke that script, so any gate that passes locally will pass in CI. Third, the GitHub Release workflow (`.github/workflows/release.yml`) is what actually publishes the cross-platform binaries and writes the GitHub Release notes. Pushing the tag is the trigger; nothing else is.

You may also use `scripts/release.sh` as a convenience wrapper if it is installed in your worktree; the rest of this document describes the manual flow and is fully valid on its own.

## 1. TL;DR

A release is a release PR that bumps `package.json` `version`, fills in the `[X.Y.Z]` CHANGELOG heading, and re-renders the version tokens, followed by a tag push that fires `.github/workflows/release.yml`, which builds the binaries, runs smoke tests, and creates the GitHub Release. The full canonical pre-PR checklist is in [`CONTRIBUTING.md`](../CONTRIBUTING.md#release-process); the per-step walkthrough below assumes that checklist has already passed and the release PR is merged to `main`.

If you have ten minutes and want the shortest safe path: cut the release PR per `CONTRIBUTING.md` § Release process (it owns the version bump + CHANGELOG + render-docs + drift guard). Merge it. Then run the four commands in [§ 5 Cut the tag](#5-cut-the-tag) and walk away. The Release workflow handles the binaries and the GitHub Release; the ADO sync step in [§ 7 Sync to the ADO mirror](#7-sync-to-the-ado-mirror) is only needed if you also maintain an ADO fork for ADO-side validation.

## 2. Pre-release checklist

This section restates the release-PR gates in the order they must run. The single-source-of-truth description of what `package.json` `version` controls lives in [`CONTRIBUTING.md`](../CONTRIBUTING.md#release-process); this section only covers the commands. `scripts/ci-validate.sh` runs the first five gates automatically; the sixth is a one-line verification you run after the script.

### 2.1 Confirm the working tree is clean

```bash
git fetch origin
git checkout main
git status                 # expect: nothing to commit, working tree clean
git pull --ff-only origin main
```

`--ff-only` is deliberate: if your local `main` has diverged, fast-forwarding keeps the release PR base trivial. If `git pull` refuses, your local `main` has local commits that are not on `origin/main`; resolve that first.

### 2.2 Run the six CI gates

```bash
npm ci
bash scripts/ci-validate.sh
```

The script runs, in order, `npm run typecheck`, `npm test -- --run`, `npm run bundle`, `npm run check:dist-freshness`, `npm run render-docs`, and `npm run check:version-alignment`. It exits non-zero on the first failure. See [`scripts/ci-validate.sh`](../scripts/ci-validate.sh) for the per-gate commentary.

### 2.3 Verify the version-pin drift guard

```bash
node scripts/render-versions.mjs --check
```

This re-walks `README.md`, `docs/**/*.md`, and `examples/**/*.{yml,yaml,md}` and exits 1 if any unreplaced `{{UMACTUALLY_*}}` token survived on disk or if any historical `vX.Y.Z` literal that does not equal the current `package.json` `version` would be rewritten. A clean exit means every shipped doc already references the value of `package.json` `version`. The script enforces the token contract: only `vX.Y.Z` and `X.Y.Z` matching the current version are allowed in shipped docs; any other `{{UMACTUALLY_*}}` shape is a typo and exits 2. Both passes preserve URL path segments (a `https://semver.org/spec/v2.0.0.html` reference is not rewritten or flagged) so cross-pinned historic URLs stay intact.

### 2.4 Verify the historical-pin drift guard

```bash
node scripts/check-version-alignment.mjs
```

This greps every shipped doc for any `vX.Y.Z` literal that does not equal the current `package.json` `version`. A passing run means no historical version pin is hiding in a doc, badge, or CI example.

### 2.5 Confirm the bundle is reproducible

```bash
git status                 # expect: nothing to commit (render-docs and bundle were idempotent)
```

A non-empty `git status` after `ci-validate.sh` means a gate wrote a file that was not yet committed. Re-run `npm run render-docs` and `npm run bundle`, then commit the diff into the release PR before tagging.

## 3. SemVer decision guide

Use this guide to pick the next version. The rules below are the project-specific reading of [SemVer 2.0.0](https://semver.org/spec/v2.0.0.html); the link is here for reference only. You do not need to re-read semver.org from scratch.

| Bump | Trigger | Concrete examples |
| --- | --- | --- |
| Patch (`X.Y.Z+1`) | Backwards-compatible bug fix that does not change any documented input, output, or contract. Internal refactors that preserve every public signature. | Fix a typo in a log line. Correct a wrong default in `UMACTUALLY_*` env handling. Repair a parse-fail path that was returning an empty finding list instead of a typed error. |
| Minor (`X.Y+1.0`) | Backwards-compatible feature addition. New env var, new CLI flag, new provider family, new `--flag` with a default that preserves existing behavior. | Add a new `UMACTUALLY_*` env var with a documented default. Add a new provider family. Add a new finding field that older clients ignore. |
| Major (`X+1.0.0`) | Any backwards-incompatible change to a documented contract: removed env var, renamed CLI flag, changed default behavior of an existing flag, changed the artifact schema, dropped a provider family, raised the minimum Node version. | Change the default of `UMACTUALLY_STRICT_SCHEMA` from `true` to `false`. Drop support for Node 22. |

Pre-1.0 caveat: this project is currently at `0.x.y`. The SemVer rules still apply, but a minor bump that breaks behavior is acceptable when the user-facing contract is still in flux; treat any bump that changes a documented default as a minor at minimum, not a patch. Once the project reaches `1.0.0`, this caveat goes away.

## 4. CHANGELOG guidance

`CHANGELOG.md` uses [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) format. The `[Unreleased]` section stays at the top of the file at all times and accumulates entries between releases. When you cut a release, you do three things in the same commit that bumps `package.json`:

1. Promote the `[Unreleased]` heading to `[X.Y.Z] - YYYY-MM-DD` (today's date).
2. Replace the promoted section's contents with the same Added / Changed / Fixed / Removed / Security subsections, populated from the bullets you carried over.
3. Re-create a fresh empty `[Unreleased]` section above it for the next cycle.

Pulling bullets from `git log`:

```bash
# Replace vX.Y.Z with the tag of the previous release.
git log vX.Y.Z..HEAD --pretty=format:"- %s" --no-merges
```

For each commit subject, classify it into one of the five subsections. Skip `chore:`, `ci:`, `test:`, and `refactor:` commits unless they have a user-visible effect (a CI behavior change is a `Changed`; a user-visible default-value change is a `Changed`; an internal rename is typically omitted). If a commit fixes a security issue, the bullet goes under `Security` and is followed by a `CVE-YYYY-NNNN` reference if one exists; otherwise it stays under `Fixed`.

Format requirements: every bullet starts with `- `, every subsection uses `### Heading` (third level), every version heading is a level-2 anchor so the GitHub Release notes generator picks it up. The release date is the date the tag was pushed, in `YYYY-MM-DD` form.

## 5. Cut the tag

After the release PR has merged to `main`, run these four commands from a clean `main`:

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git tag -a vX.Y.Z -m "release: vX.Y.Z (see CHANGELOG.md for the changes)"
```

Sanity-check the tag points at the merge commit you expect with `git show --stat vX.Y.Z` (diff matches the release PR) and `git log -1 --pretty=format:'%H %s' vX.Y.Z` (verify the SHA).

```bash
git push origin main --follow-tags
```

> **CRITICAL: the tag must point at the *squash-merge commit* on `main`, not the branch's pre-squash tip.** Repo policy squash-merges feature PRs, so the merge commit on `main` (e.g. `9a41f30 release: vX.Y.Z ... (#NNN)`) is a *different* SHA than the branch's last commit (e.g. `5c09ad9 release: vX.Y.Z...`). The tag must land on the squash-merge SHA so the GitHub Release's "commit" link points at the merged commit, the canary's `git rev-parse HEAD` matches the GitHub Release's commit, and downstream consumers pinning the tag get byte-identical binaries. After the release PR is merged, fetch `main` and confirm the SHA before tagging:
>
> ```bash
> git fetch origin
> git tag -a vX.Y.Z <squash-merge-sha> -m "release: vX.Y.Z (see CHANGELOG.md for the changes)"
> ```
>
> If you tag the branch's pre-squash SHA by accident, the tag will still resolve to a real commit, the release workflow will still fire, and the binaries will still build — but the GitHub Release commit link will point at the branch's pre-squash commit, the README version pin will be off by one commit, and any subsequent `git show vX.Y.Z` from `origin/main` will be a *different* commit than the tag's anchor. Recovery (do all of this; missing the GitHub Release step leaves a stale release pointing at the wrong commit):
>
> ```bash
> # 1. Move the tag to the correct squash-merge commit.
> git tag -d vX.Y.Z
> git push origin :refs/tags/vX.Y.Z
> git tag -a vX.Y.Z <squash-merge-sha> -m "release: vX.Y.Z (see CHANGELOG.md for the changes)"
> git push origin vX.Y.Z
> # 2. Recreate the GitHub Release against the re-anchored tag. The release
> #    workflow re-fires on `git push origin vX.Y.Z` and publishes a fresh
> #    release page, but if it had already fired once on the wrong SHA, the
> #    old release page is still live and must be deleted manually — `gh
> #    release view` against the new tag returns the NEW page only.
> gh release view "vX.Y.Z" --json name,tagName,targetCommitish  # confirm the new page exists
> # If a stale release from the wrong SHA is still published (look for a
> # release page whose tagCommitish points at the pre-squash SHA):
> gh release list --json tagName,targetCommitish | jq '.[] | select(.tagName == "vX.Y.Z")'
> # Delete the stale release; the workflow's next push (or a manual
> # workflow_dispatch re-run) will recreate it on the correct SHA.
> gh release delete "vX.Y.Z" --yes --cleanup-tag
> ```
>
> Always verify the SHA before pushing the tag, AND verify the GitHub Release's `targetCommitish` after the recovery.

That single push is enough: `--follow-tags` pushes every annotated tag whose commit is reachable from `main`, and the `on: push: tags: ['v*']` trigger in the workflow starts the release job for each tag. **Verify the only tag being pushed is the one you intend** — see [§ 8.4 A stale queued tag rode along](#84-a-stale-queued-tag-rode-along) if a previous release's tag was created at squash-merge time but never pushed (the workflow will publish a release for it, with this release's binaries mislabelled).

Verify the tag actually corresponds to the merge commit you expect:

```bash
git tag --points-at HEAD                 # every tag HEAD points at should be vX.Y.Z
git show --stat vX.Y.Z                   # diff matches the release PR
git log -1 --pretty=format:'%H %s' vX.Y.Z
```

Wait for the Release workflow to finish:

```bash
gh release view "vX.Y.Z" --json name,assets
```

Expected: exactly six assets (five archives + `checksums.txt`). If the asset list is shorter, or if `assets` is `null`, an earlier job failed; fetch logs via `gh run list --workflow=release`. The fix is on `main` before you re-tag — but you cannot just `git tag vX.Y.Z` again, because both `origin` and `ado` still have the prior tag pointing at the same commit, and a second `git push origin vX.Y.Z` will be rejected with `! [rejected]` (nothing to push). Recover per [§ 8.1](#81-a-bad-tag-was-pushed), which uses `git tag -d` + `git push :refs/tags/<tag>` + re-tag-at-fixed-commit to create a new tag with a new SHA.

### 5.5 npm publication (post GitHub Release)

After the GitHub Release publishes, the workflow's `publish-npm` job publishes `umactually` to npmjs.org via **Trusted Publishing (OIDC)** — no long-lived secret, no 2FA prompt at CI time. The job is gated on the same real-release-tag pattern as `publish` and runs the same six-gate pipeline via `npm run prepublishOnly` before invoking `npm publish --provenance --tag latest`. The two publishes (GitHub Release + npm) always consume the same `git SHA` — they will never drift.

Wait for the `publish-npm` job to finish:

```bash
gh run list --workflow=release --status=success --json name,headBranch --jq '.[] | select(.headBranch | contains("v"))'
# Or:
gh run watch $(gh run list --workflow=release --limit 1 --json databaseId -q '.[0].databaseId')
```

The job emits a `Summary` step that records the event / ref / tag / auth method (`Trusted Publishing (OIDC)`) / outcome in `$GITHUB_STEP_SUMMARY`. After the summary, verify the package landed on npm:

```bash
curl -fsSL https://registry.npmjs.org/umactually/vX.Y.Z | jq '.dist-tags, .version'
# Expected: { "latest": "X.Y.Z" } and the fetched JSON keyed by X.Y.Z
```

The `publish-npm` job's own `Verify npm publication` step runs a two-phase probe against the npm registry, so a transient registry-propagation delay does not falsely fail the canary. Phase 1 polls the package-level URL `https://registry.npmjs.org/umactually` up to 12 times at 5-second intervals (≈60s budget) and fast-paths on the `dist-tags.latest` signal that the publish has landed. Phase 2 cross-validates by polling the per-version URL `https://registry.npmjs.org/umactually/vX.Y.Z` up to 60 times at 10-second intervals (≈600s / 10-min budget). If both phases fail, the step logs `::error::umactually@<version> not found on registry.npmjs.org ...` — recovery is below in [§ 8.5](#85-npm-publish-failed), and the false-positive diagnostic is in [§ 10](#10-verify-npm-publication-timed-out--did-the-publish-actually-land).

Provenance verification (one-time, after first publish):

```bash
curl -fsSL https://registry.npmjs.org/umactually/vX.Y.Z | jq '.version, .dist.integrity, .dist.unpackedSize'
# Visit https://www.npmjs.com/package/umactually/v/X.Y.Z and confirm the
# "Provenance" badge links to the matching GitHub Actions run URL.
```

The Sigstore attestation is signed against the GitHub Actions OIDC token, so the badge on npmjs.com links to the precise workflow run that performed the publish — re-running `gh run view <id> --json headSha,event,workflow` for that run shows the same SHA as `git rev-parse HEAD` on the release commit.

#### Authentication: Trusted Publishing (OIDC)

Authentication for the `publish-npm` job is **Trusted Publishing (OIDC)** — the npm-recommended replacement for legacy Granular Tokens with bypass-2FA (which are now restricted for direct publishing; see https://gh.io/npm-gat-bypass2fa-deprecation). The job requests an OIDC token from GitHub Actions (`id-token: write` permission) and `npm publish` exchanges it for a short-lived registry session token. **No `NPM_TOKEN` secret is stored in repo settings**, and there is no `--otp=<code>` step at CI time.

Why the move: npm deprecated classic tokens in 2022 and deprecated TOTP authenticator apps in 2025. Granular Tokens with `bypass_2fa: true` are being restricted. Trusted Publishing is the official replacement — see https://docs.npmjs.com/trusted-publishers.

The current binding (verified 2026-08-01 via `npm trust list umactually`):

```text
type: github
file: release.yml
repository: josiahsiegel/umactually
permissions: publish, stage publish
```

`stage publish` is not currently exercised by the workflow (only the `publish-npm` job runs `npm publish --provenance --tag latest`); it is enabled for symmetry with npm's defaults so an operator can switch to `npm stage publish` later without re-touching the npm settings.

#### One-time setup (complete on this repo; the first publish on 2026-08-01 claimed the name)

1. Manually publish the first version of `umactually` to claim the package name on npmjs.org. This is the chicken-and-egg step — Trusted Publishers cannot be configured against a name that doesn't exist yet. From a local terminal with `npm@10+`:

   ```bash
   # Local first publish: no GitHub Actions OIDC issuer available locally,
   # so pass --provenance=false to override package.json#publishConfig.provenance: true
   # for this single invocation. --ignore-scripts skips the prepublishOnly gate
   # (CI enforces the same gate in the publish-npm job — re-running it here is
   # redundant and slow). The publish lands with no provenance attestation,
   # which is acceptable for the one-time name-claim; every subsequent CI
   # publish via Trusted Publishing does carry provenance.
   npm publish --provenance=false --ignore-scripts --tag latest --registry https://registry.npmjs.org/
   ```

   The CLI will print an `EOTP — This operation requires a one-time password` error with two URLs: `https://www.npmjs.com/auth/cli/<authId>` (the WebAuth challenge) and `https://registry.npmjs.org/-/v1/done?authId=<authId>` (the polling endpoint for the registry session token). The `auth/cli/<authId>` page offers two browser-side actions — see [§ Authentication mechanism: WebAuth / device flow in 2026](#authentication-mechanism-webauth--device-flow-in-2026) below for the full breakdown of what each does and which to pick for your situation.

   If you can't read the URL from the terminal directly (e.g. an agent shell, CI step, captured-stdout pipeline), use [`scripts/publish-with-webauth.mjs`](../scripts/publish-with-webauth.mjs) — it parses the JSON error block to extract the URLs programmatically and polls the doneUrl for the session token:

   ```bash
   node scripts/publish-with-webauth.mjs --timeout=300
   ```

   The script will print the `authUrl`, wait for you to complete the browser flow, then automatically run `npm publish --no-provenance --ignore-scripts --otp=<token>` with the registry session token it captured.

2. Open https://www.npmjs.com/package/umactually/settings → **Publishing access** → **Add a Trusted Publisher** → **GitHub Actions** → Repository `JosiahSiegel/umactually`, Workflow filename `release.yml`, Environment (optional, leave blank for now). Verify with `npm trust list umactually` from an authenticated shell — the binding should print `type: github / file: release.yml / repository: josiahsiegel/umactually / permissions: publish, stage publish`.

3. **Delete the GitHub repo secret `NPM_TOKEN`** if it exists, and revoke any old Granular Tokens at https://www.npmjs.com/settings/~/tokens. From this point forward, all publishes go through OIDC and the `publish-npm` job has no token to lose.

4. (Optional, recommended) On the same npm settings page, enable **"Require two-factor authentication and disallow tokens"** so direct publishing requires a 2FA flow that only the maintainers control — preventing a future maintainer from accidentally pasting a long-lived secret into CI.

#### Authentication mechanism: WebAuth / device flow in 2026

**TL;DR (Aug 2026):** Granular Access Tokens with `bypass_2fa: true` are no longer honored at publish time. Every `npm publish` for an account with 2FA enabled — including the first publish that claims a new package name — requires an interactive WebAuth challenge (passkey, security key, Touch ID) via a browser. There is no fully automated path for the first publish; the publish only proceeds after a human approves in a browser. Sources: [github.blog 2026-07-31 — Restricting npm bypass-2FA granular access tokens](https://github.blog/changelog/2026-07-31-restricting-npm-bypass-2fa-granular-access-tokens/), [github.blog 2026-07-08 — npm install-time security and GAT bypass2fa deprecation](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/), [docs.npmjs.com/trusted-publishers](https://docs.npmjs.com/trusted-publishers/), [docs.npmjs.com/about-access-tokens](https://docs.npmjs.com/about-access-tokens/).

##### Timeline

| Date | Change | Reference |
| --- | --- | --- |
| 2022 | Classic tokens deprecated | npm docs |
| 2025-10 | TOTP authenticator apps frozen (no new/reconfigure, existing still works) | [community #178140](https://github.com/orgs/community/discussions/178140) |
| 2026-07-08 | `bypass_2fa: true` GATs lose the ability to publish directly; staged publish only | github.blog 2026-07-08 changelog |
| 2026-07-31 | `bypass_2fa: true` GATs blocked from account/org/package management actions | github.blog 2026-07-31 changelog |
| ~2027-01 | `bypass_2fa: true` GATs lose direct publish entirely (currently being enforced ahead of schedule) | github.blog 2026-07-08 changelog |

##### What `npm publish` does today when 2FA is required

The CLI returns `EOTP` with two URLs in the error detail and `--json` output:

```text
Open this URL in your browser to authenticate:
  https://www.npmjs.com/auth/cli/<authId>
After authenticating, your token can be retrieved from:
  https://registry.npmjs.org/-/v1/done?authId=<authId>
```

`auth/cli/<authId>` is the WebAuthn challenge page: sign in, the browser triggers the configured authenticator (passkey, security key, Touch ID), and on approval the registry marks the authId as approved. `doneUrl` is the polling endpoint; after approval it returns `{"token":"<16-digit-otp>"}` — that token IS the registry session token that `npm publish --otp=<token>` consumes (npm calls it an "OTP" in the error message but the value IS the session token, not a TOTP code).

There are two browser-side actions a user can take on the `auth/cli/<authId>` page:

| Browser action | Effect on doneUrl | Effect on subsequent `npm publish` from the same IP |
| --- | --- | --- |
| **Approve** with the configured authenticator | Returns `{"token":"<16-digit-otp>"}` (one-shot; the authId is then consumed and subsequent polls return 404) | `--otp=<token>` consumed and publish proceeds |
| **Don't challenge requests from this IP for N minutes** | Returns `""` indefinitely (until the window expires) | Next `npm publish` from the same IP succeeds without OTP for the next N minutes |

The IP-trust window is the path the first publish of `umactually` actually used to claim the name on 2026-08-01: the maintainer clicked "Don't challenge this IP for 5 minutes" once, then re-ran `npm publish` from the same terminal within the window and the publish went straight through. The trust window is bound to (account, IP, expiry) on the registry side, expires automatically, and reverts to the WebAuth challenge on the next publish from a different IP. It is **NOT a bypass of the security model** — it is the maintainer's own browser telling the registry "I just authenticated, give me N minutes of grace from this IP".

> **Note:** the helper script `scripts/publish-with-webauth.mjs` documented in [§ Programmatic helper for non-TTY environments](#programmatic-helper-for-non-tty-environments) below is for the *subsequent* release-engineer path (any maintainer running `npm publish` from a non-TTY shell — CI, agent, captured-stdout pipeline) — it automates the polling loop for cases where the maintainer cannot click the `authUrl` in a browser interactively. The first publish (which established this whole Trusted Publisher flow) was done from a TTY via the IP-trust window, not via the helper script. The two paths serve different audiences; the helper script is not the path that claimed the package name.

##### Programmatic helper for non-TTY environments

[`scripts/publish-with-webauth.mjs`](../scripts/publish-with-webauth.mjs) automates the polling loop for environments that can't display the `authUrl` to a human in real time (CI shells, agents, captured-stdout pipelines):

```bash
node scripts/publish-with-webauth.mjs --timeout=300
```

1. Invokes `npm publish --no-provenance --ignore-scripts --json` and parses the JSON error block to extract `authUrl` and `doneUrl`. The `--json` flag returns the URLs in full even when stderr is captured — the human-readable error path redacts the `<id>` to `***` in non-TTY mode, but the structured JSON block in the same output is intact.
2. Prints the `authUrl` and a "waiting for OTP" banner.
3. Polls `doneUrl` every 3s for up to `--timeout=<sec>` (default 180s), handling both `{"token":"..."}` (success) and `{"message":"not found"}` (authId consumed/expired) responses.
4. On success, re-runs `npm publish --no-provenance --ignore-scripts --otp=<token>` with the registry session token.

If the user picks the IP-trust window option in the browser instead of approving WebAuth, the script's `doneUrl` poll stalls (the registry never returns a token — it just returns `""`). The script's timeout error explains this and tells the user to re-run `npm publish --no-provenance --ignore-scripts` from the same terminal within the IP-trust window. **This is expected behavior**, not a failure — pick the right path for your auth posture before invoking the script.

##### Why `--ignore-scripts` and `--provenance=false` for local manual publish

- `--ignore-scripts` skips the `prepublishOnly` hook in `package.json`. The hook runs `npm run typecheck && npm test -- --run && npm run bundle && npm run render-docs && npm run check:version-alignment && npm run check:dist-freshness` — that gate is enforced by CI (the same hook runs in the `publish-npm` job), so re-running it for a manual first publish is redundant and slow. Skip it; if any gate would have failed, CI would have caught it first.
- `--provenance=false` overrides `package.json#publishConfig.provenance: true` for this single invocation. Without the override, the registry errors with `EUSAGE — Automatic provenance generation not supported for provider: null` because the local CLI has no GitHub Actions OIDC issuer to mint a Sigstore attestation. The CI publish path uses OIDC + `--provenance` and is unaffected.

##### `~/.npmrc` overrides `.env` `NPM_TOKEN`

If your environment has both an `.env` `NPM_TOKEN=...` and a `~/.npmrc` line like `//registry.npmjs.org/:_authToken=...`, the `~/.npmrc` token wins (npm config layering: builtin → env → project → user → global, with user-level `.npmrc` overriding env vars). Verify which token your `npm publish` is actually using before debugging an auth failure:

```bash
# Direct API probe of the token in the env var (does not use npm config layering):
curl -sS -H "Authorization: Bearer $NPM_TOKEN" https://registry.npmjs.org/-/npm/v1/tokens | jq '.objects[] | {name, bypass_2fa, revoked}'
```

If `~/.npmrc` holds a stale or wrong token (different account, expired, or wrong scope), the local CLI uses it and `npm publish` fails with that account's auth errors. Delete or update the line, then re-run.

#### Manual re-publish (release engineer)

If the automated path fails for any reason and a maintainer needs to push a version directly (e.g. the Trusted Publisher binding got deconfigured), the same WebAuth / IP-trust-window flow used in step 1 still works for any version, including re-publishing an existing one.

```bash
# Local manual publish: no GitHub Actions OIDC issuer available, so
# pass --provenance=false to override package.json#publishConfig.provenance.
# For the Trusted-Publisher-via-GitHub path (the canonical publish route)
# the CI job uses OIDC and `--provenance` automatically.
npm publish --provenance=false --ignore-scripts --tag latest --registry https://registry.npmjs.org/
```

The CLI prints a fresh `https://www.npmjs.com/auth/cli/<authId>` URL; open it, complete the GitHub-backed sign-in OR click "Don't challenge this IP for N minutes", and the publish proceeds. No token to mint, no `--otp` to type, no 90-day clock.

**TTY caveat**: npm CLI redacts the WebAuth `<authId>` portion to `***` in redirected output (background jobs, piped, captured). Running `npm publish` in a CI shell, a background job, or any non-TTY context will print `https://www.npmjs.com/auth/cli/***` with no way to recover the actual ID from the text output. The structured `--json` output (and the JSON inside the human-readable error block) does include the full URLs — that's why `scripts/publish-with-webauth.mjs` uses `--json` to extract them programmatically. Always run a manual publish from a terminal where you can read the URL directly, or use the helper script.

### Release assets

Every GitHub Release under the `vX.Y.Z` tag ships exactly six public assets — five archives and one manifest. There are no raw executables, no intermediate build artifacts, and no internal telemetry in the public asset set. The archive contract is the only supported download entry point; the installer one-liners in the README are the canonical way to fetch and verify these assets.

| Asset | Format | Source binary | Archive member |
| --- | --- | --- | --- |
| `umactually-linux-x64.tar.gz` | gzipped tar | `umactually-linux-x64` | `umactually-linux-x64` |
| `umactually-linux-arm64.tar.gz` | gzipped tar | `umactually-linux-arm64` | `umactually-linux-arm64` |
| `umactually-darwin-arm64.tar.gz` | gzipped tar | `umactually-darwin-arm64` | `umactually-darwin-arm64` |
| `umactually-windows-x64.zip` | ZIP | `umactually-windows-x64.exe` | `umactually-windows-x64.exe` |
| `umactually-windows-arm64.zip` | ZIP | `umactually-windows-arm64.exe` | `umactually-windows-arm64.exe` |
| `checksums.txt` | manifest | (SHA-256 of every archive above) | — |

`checksums.txt` carries one `<sha256>   <archive-name>` line per archive, in stable order, generated by `scripts/package-release-assets.mjs` and shipped alongside the archives. The manifest's source of truth is [`scripts/release-targets.json`](../scripts/release-targets.json); the workflow and the installers both parse it. Do not introduce a "raw download" section into any user-facing doc — the installer one-liner is the supported entry point, and every archive's SHA-256 is verified against `checksums.txt` before any binary is placed on the user's PATH.

Verify the public `latest` redirect points at this release:

```bash
curl -sLI https://github.com/<OWNER>/<REPO>/releases/latest | grep -i ^location
# expected: https://github.com/<OWNER>/<REPO>/releases/tag/vX.Y.Z
```

If the redirect still points at an older tag, GitHub's CDN has stale edge cache (typically 1-2 minutes). If it persists past five minutes, see [§ 8.4](#84-a-stale-queued-tag-rode-along).

### Compressed transfer vs installed size

Each archive is a deterministic gzip-compressed tar (Linux/macOS) or ZIP (Windows) containing exactly one binary member. The compressed archive is the **transfer size** (what the installer downloads and what the user sees on the wire); the extracted member is the **installed size** (what sits on the user's PATH after extraction). They are not the same number, and the plan deliberately does not promise they will converge:

- The compressed transfer size is bounded by a per-target sanity check in the release workflow's "Compute release-size report" step (1 MiB floor, 200 MiB ceiling per raw binary). tsdown's `--exe` enforces the inner bundle size; the workflow's check is a safety net for a runaway build (a new dep pulling in an unexpectedly large native module). As of the most recent release the largest target is `darwin-arm64` at ~125 MiB (darwin-x64 was dropped because Node's `--build-sea` segfaults on it; see the [Removed] section of [CHANGELOG](./CHANGELOG.md) for the upstream Node.js bug context); 200 MiB leaves ~60% headroom for legitimate growth. Any new target that legitimately needs more room must bump the ceiling AND document the reason in the PR — do not silently widen the global cap.
- The installed binary size is determined by the Node SEA runtime and is not a release-time budget. The standalone Node 25.7 runtime is bundled in, so the installed binary is substantially larger than the archive — typically **~2.5x larger** than what the user actually downloads. See [distribution-architecture.md](./distribution-architecture.md) for the full comparison vs Bun, yao-pkg, and Deno.

Treat these as two distinct telemetry numbers in any user-facing copy. The README install section explains the ratio; the size budget file governs only the transfer side.

### Pre-publication gates

`.github/workflows/release.yml` runs a strict ordered graph before the GitHub Release is published. Every pre-publication gate must be GREEN; a single failure deletes the draft release and aborts the run. The order is: build → archive + checksum + size budget → five native/install gates → publish.

| Gate | Job id | What it proves |
| --- | --- | --- |
| Cross-platform build + archive | `build-package` | Produces the candidate bundle (`public/<archives>`, `internal/raw/<binaries>`, `internal/release-size-report.json`) under one immutable artifact (`umactually-release-candidate`). |
| Linux x64 installer smoke | `smoke-linux-x64` | Downloads the candidate by artifact id, verifies transport + inner SHA-256, runs the installer in production mode against a local serve, exercises `--version` / `--help` / `doctor`. |
| Linux ARM64 installer smoke | `smoke-linux-arm64` | Same contract on `ubuntu-24.04-arm`. |
| macOS x64 installer smoke | _(none — see Note)_ | Darwin-x64 has no native smoke job because Node `--build-sea` segfaults on Intel macOS (see [nodejs/node#62893](https://github.com/nodejs/node/issues/62893)). Intel Mac users get the npm install path: the matrix above covers all five binaries the workflow actually produces, and the README "Platform support" table points Intel Mac users at `npm install -g umactually`. |
| macOS ARM64 installer smoke | `smoke-darwin-arm64` | Same contract on `macos-15`. |
| Windows x64 installer smoke | `smoke-windows-x64` | Same contract on `windows-2025`, exercising PowerShell 5.1's `install.ps1`. |
| Windows x64 Git Bash delegation | `smoke-windows-x64-git-bash-delegate` | Confirms Git Bash invokes PowerShell correctly; this is the path most Windows users actually take. |
| Windows ARM64 structural validation | _(removed in v0.6.4+)_ | See [Windows ARM64](#windows-arm64) below. The build still ships a `umactually-windows-arm64.zip` for parity with the install contract, but the underlying binary is a Linux-built x64 fallback (PE machine type `0x8664`, not `0xAA64`). The job was removed because re-enabling it requires a `windows-11-arm` GitHub-hosted runner and a per-arch job split — see the comment in `.github/workflows/release.yml` for the full rationale. |
| Checksum-failure preservation | `smoke-bad-checksum` | Seeds a known-good install, presents a deliberately-corrupted `checksums.txt`, and asserts the installer refuses to overwrite the seeded binary and removes any staging residue. |
| Publish | `publish` | Sole holder of `contents: write`. Downloads the candidate by artifact id, verifies the transport digest, drafts the release with exactly six explicit basename paths (the five archives + `checksums.txt`), re-verifies draft asset names + hashes against `checksums.txt`, then runs `gh release edit --draft=false` only if every gate is green. A pre-publish failure deletes the draft. |

### Windows ARM64

**Status as of v0.6.4+:** the `smoke-windows-arm64-structural` job was **removed** because the cross-compiled binary the Linux build produces is an x64 fallback (PE machine type `0x8664`), not an ARM64 binary (`0xAA64`). The release still ships a `umactually-windows-arm64.zip` so the installer contract (`umactually-windows-arm64.exe` resolves, SHA-256 verifies, single-member archive) is unbroken, but the underlying executable is x64. On an actual ARM64 Windows host, Windows will refuse to load a non-native PE machine type, so the binary will not run there today.

This means **Windows ARM64 is not a runtime-supported platform today** — the asset ships for parity with the manifest and install contract, but the binary is x64. Windows ARM64 users have two working paths:

1. `npm install -g umactually` (Node 24+ ARM64 build), or
2. The PowerShell one-liner (`irm .../install.ps1 | iex`) downloads the x64 binary which Windows-on-ARM can run via the x64 emulation layer (works on Windows 11 22H2+ with the x64 emulation feature enabled).

The README's "Platform support" table reflects this: "Windows ARM64 is ZIP-only" — the ZIP is part of the install contract, but the binary inside is x64.

Re-enabling a real ARM64 build requires a `windows-11-arm` GitHub-hosted runner (added 2024) and a per-arch job split — see the comment in `.github/workflows/release.yml` around line 785.

### Size budgets

The per-archive transfer size check lives in `scripts/verify-release-sizes.mjs` and is called from both `.github/workflows/release.yml`'s "Compute release-size report" step and `scripts/ci-release-pipeline-dry-run.sh`'s "verify stage sizes" step. It applies a `MIN_RAW_BYTES` floor (1 MiB; rejects empty / truncated / partial SEA blobs that would still pass a self-consistent sha256 but crash on launch) and a `MAX_RAW_BYTES` ceiling (200 MiB; the same safety net as the v0.5.x budget file). The check applies to the raw binary, not the archive — the archive is the gzip/zip wrapper, and a 130 MiB raw binary compresses to ~30 MiB transfer. Because both call sites delegate to the same module, the thresholds and the size-report JSON shape are owned by one file — bumping the ceiling requires editing one constant (`MAX_RAW_BYTES` at the top of `scripts/verify-release-sizes.mjs`) and documenting the reason in the PR. Do not silently widen the cap; the workflow will reject PRs that try.

### Recovery

The workflow's pre-publication gates catch most problems before the GitHub Release is published, but post-publication failure modes still exist. The four named recovery patterns:

1. **A bad tag was pushed** (wrong commit, typo in `package.json`, wrong CHANGELOG entry): delete the local + remote tag, delete the GitHub Release via the web UI if one was created, fix the underlying issue on `main`, then re-cut. See [§ 8.1](#81-a-bad-tag-was-pushed).
2. **`ci-validate` failed mid-release**: every gate reports the file and line it tripped; the fix is on `main` and the release PR picks it up automatically — no tag deletion needed. See [§ 8.2](#82-ci-validate-failed-mid-release).
3. **A hotfix between releases**: land the fix on `main`, add a `Fixed` bullet under `[Unreleased]`, bump `package.json` `version`, and cut a patch tag. There is no separate hotfix branch model. See [§ 8.3](#83-a-hotfix-is-needed-between-releases).
4. **A stale queued tag rode along** (older tag created at squash-merge time but never pushed): `git tag --points-at HEAD` before `git push origin main --follow-tags` catches this; clean up with `git push origin :refs/tags/<stale>` + `git tag -d <stale>` before re-pushing. See [§ 8.4](#84-a-stale-queued-tag-rode-along).

The post-publish canary (§6 below) is a defense-in-depth check: if it ever fails, the install path is broken end-to-end against the live tag and you must cut a follow-up patch release. The fix cannot be a draft edit — once the release is public, only a new tag supersedes it.

## 6. Post-tag behavior

`.github/workflows/release.yml` runs the full pre-publication graph (build, the six native / installer smoke jobs in the table above, plus the Windows ARM64 structural note — removed in v0.6.4+, see [Windows ARM64](#windows-arm64), and the checksum-failure preservation job) and then publishes. The `publish` job is the sole holder of `contents: write`. The post-publish `canary` job runs **only after `publish` succeeds**, queries the published release by exact tag (never `/releases/latest/`), and re-exercises the user-facing install path end-to-end against the live immutable tag URL.

| Job | What it does | Failure mode to watch |
| --- | --- | --- |
| `build-package` | Cross-platform build + archive packaging + checksum + size report. Uploads ONE immutable candidate artifact (`umactually-release-candidate`) with three subtrees: `public/<archives>`, `internal/raw/<binaries>`, `internal/release-size-report.json`. | If this fails, no smoke gates run. Fix is on `main` and the release PR picks it up. |
| Six native / installer smoke jobs (`smoke-linux-x64`, `smoke-linux-arm64`, `smoke-darwin-arm64`, `smoke-windows-x64`, `smoke-windows-x64-git-bash-delegate`; see `smoke-darwin-x64` note in the table above) | Each downloads the candidate by artifact id, verifies transport + inner SHA-256, runs the installer in production mode against a local serve, and exercises `--version` / `--help` / `doctor`. | A failure here means the user-facing install path is broken on that platform — treat as a P0 and fix before re-tagging. |
| `smoke-windows-arm64-structural` | _(removed in v0.6.4+)_ | Validated the Windows ARM64 ZIP archive + member name + PE machine type from a `windows-2025` host. Removed because the cross-compiled binary the Linux build produces is an x64 fallback, not an ARM64 PE — see [Windows ARM64](#windows-arm64) for the full rationale and the supported install paths on Windows-on-ARM. |
| `smoke-bad-checksum` | Confirms a corrupted `checksums.txt` causes the installer to refuse without overwriting the seeded install. | A failure here means a malicious or corrupted release could clobber a working install — this is a security regression. |
| `publish` | Sole holder of `contents: write`. Downloads the candidate by artifact id, verifies the transport digest, drafts the release with exactly six explicit basename paths (the five archives + `checksums.txt`), re-verifies draft asset names + hashes against `checksums.txt`, then runs `gh release edit --draft=false` only if every pre-publish gate is green. | A failure here deletes the draft via `if: failure()` and surfaces the violated gate in the run log. |
| `canary` | Post-publish probe. Queries `api.github.com/repos/JosiahSiegel/umactually/releases/tags/${{ github.ref_name }}` (NEVER `/releases/latest/`), asserts exactly six assets with the expected names, downloads one native archive + `checksums.txt` from the public immutable tag URL, verifies the archive's SHA-256 against the manifest, then runs the public installer (`INSTALL_RELEASE_BASE=...`, `INSTALL_RELEASE_TAG=...`) and asserts `--version` / `--help` / `doctor` all exit 0. | A failure here means the public install path is broken end-to-end against the live tag. Treat as a P0; cut a follow-up patch release. |

The workflow uses `concurrency: { group: release-${{ github.ref }}, cancel-in-progress: false }` deliberately: a follow-up tag must not cancel an in-flight release of the previous tag.

After the release job completes, the GitHub Release page is the public artifact. The release notes are auto-generated (`generate_release_notes: true`), but the CHANGELOG section you wrote is the canonical reference; the GitHub Release notes are a convenience summary, not the source of truth.

## 7. Sync to the ADO mirror

If you maintain a fork of this action in Azure DevOps for ADO-side validation work, ADO `main` must catch up with the canonical GitHub `main` after every GitHub merge, including release merges. The full workflow, including the conflict-resolution dance, lives in [`docs/azure-devops.md`](../docs/azure-devops.md#syncing-merged-github-prs-to-ado-main). The release-specific shape is:

1. Confirm the GitHub Release workflow has fully completed (all four jobs green). The sync PR should not open until the release artifacts exist, because the ADO-side build validation may try to fetch them.
2. Open a sync PR on ADO via the REST API with `bypassPolicy: true`. The full curl is in the ADO doc; the shape is `POST https://dev.azure.com/{org}/{project}/_apis/git/repositories/{repoId}/pullrequests?api-version=7.1` with a body containing `{ "sourceRefName": "refs/heads/sync/ado-main-with-github-mainN", "targetRefName": "refs/heads/main", "title": "sync: GitHub main → ADO main", "bypassPolicy": true }`. The `bypassPolicy: true` flag is required because the sync branch is not subject to the canonical-branch commit policy.
3. If the PR reports `mergeStatus: conflicts`, resolve locally (the ADO doc spells out the `git merge ado/main --no-ff`, `git checkout --theirs <file>`, `git commit --no-edit` sequence), force-push with `--force-with-lease`, and PATCH the PR to `status: completed` with `lastMergeSourceCommit: { commitId: <force-pushed SHA> }`. Still pass `bypassPolicy: true` on the PATCH.
4. After the sync merges, run `bash scripts/ci-validate.sh` against ADO `main` to confirm parity.

You only need this step if you actually maintain an ADO fork. A GitHub-only maintainer can skip [§ 7](#7-sync-to-the-ado-mirror) entirely.

## 8. When something goes wrong

Three failure modes recur. Each is recoverable without a full re-cut.

### 8.1 A bad tag was pushed

You pushed `vX.Y.Z` against the wrong commit, or the version bump in `package.json` had a typo, or the CHANGELOG entry was wrong. The release job may have already uploaded partial assets.

```bash
# 1. Delete the local and remote tag. This does not undo the GitHub
#    Release or uploaded binaries. See step 2.
git tag -d vX.Y.Z
git push origin :refs/tags/vX.Y.Z
git push ado :refs/tags/vX.Y.Z     # if a tag was pushed to ado as well

# 2. If softprops/action-gh-release already created the GitHub Release,
#    delete it from the GitHub web UI (Releases → vX.Y.Z → Delete).
#    The action does not currently expose auto-deletion on tag removal.

# 3. Fix the underlying issue (package.json, CHANGELOG, or commit).
#    Land the fix as a normal PR; do NOT just re-tag the broken commit.

# 4. Re-cut with the corrected tag once the fix is on main.
git fetch origin
git checkout main
git pull --ff-only origin main
git tag -a vX.Y.Z -m "release: vX.Y.Z (see CHANGELOG.md for the changes)"
git push origin main --follow-tags
```

### 8.2 `ci-validate` failed mid-release

The six-gate pipeline exited non-zero on a release PR. Read the gate name from the script output (it prints `==> typecheck`, `==> test`, etc. before each step). The most common mid-release failures:

| Gate | Typical cause | Fix |
| --- | --- | --- |
| `npm run typecheck` | New code with an implicit `any`, or a `@ts-ignore` that the strict settings now reject. | Run `npm run typecheck` locally, fix the reported file and line, push. |
| `npm test -- --run` | A test for a removed or renamed export. | Run `npm test` locally, read the diff between the expected and actual names, fix. |
| `npm run bundle` | An ncc error, typically a missing file path in `src/cli.ts`. | Re-run `npm run bundle` locally; ncc's error message names the file. |
| `npm run check:dist-freshness` | You edited `src/` after the last `npm run bundle` and forgot to re-bundle. | `npm run bundle`, commit `dist/`. |
| `npm run render-docs` | The token contract was violated (a non-canonical `{{UMACTUALLY_*}}` token snuck in). | Read the script output for the file and token name. Replace it with `vX.Y.Z` matching the current `package.json` `version`, or with `0.4.0` as the pre-renderer example. Exit 2 means a typo; exit 1 means a token survived. |
| `npm run check:version-alignment` | A historical `vX.Y.Z` literal exists in a shipped doc. | Read the script output for the file and the stray pin; remove or replace it. |

None of these gate failures requires a tag deletion. Fix the underlying issue on `main` and the release PR picks up the fix automatically.

### 8.3 A hotfix is needed between releases

A critical fix lands that cannot wait for the next scheduled release. Cut it as a normal PR to `main`, then fast-track a patch release:

1. Land the fix as a normal PR. The squash merge lands on `main` with one commit.
2. Add a `Fixed` bullet under `[Unreleased]` in `CHANGELOG.md` summarizing the hotfix. Promote `[Unreleased]` to `[X.Y.Z+1] - YYYY-MM-DD` in the same PR. Or, if you want to keep the PR minimal, do it as a follow-up one-line commit.
3. Bump `package.json` `version` from `X.Y.Z` to `X.Y.Z+1` in that same follow-up commit.
4. Run [§ 2 Pre-release checklist](#2-pre-release-checklist) on the bump commit. The token render must produce `vX.Y.Z+1` everywhere.
5. Cut the tag per [§ 5 Cut the tag](#5-cut-the-tag).

There is no separate "hotfix branch" model. The `main` branch is always releasable, and a hotfix is just a patch release with a smaller delta. The CI gates catch any regression before the tag is pushed.

### 8.4 A stale queued tag rode along

A previous release's squash-merge landed on `main` with a local tag created (the bot's job) but never pushed to GitHub. When you push `main --follow-tags` to publish the new release, every reachable tag — including the stale one — gets pushed and triggers the Release workflow. Symptom: the public `/releases/latest` badge redirects to the older tag, and the older tag has assets containing this release's binaries mislabelled as the older version.

To prevent this in the first place, before pushing the tag run:

```bash
git tag --points-at HEAD
```

Expected: only `vX.Y.Z` (the release you are about to publish) is listed. If other `v*` tags appear, they are stale queued tags from earlier releases. Recover them first:

```bash
# Recover the stale tags before re-pushing the intended one.
git push origin :refs/tags/vSTALE_1
git push origin :refs/tags/vSTALE_2
git push ado   :refs/tags/vSTALE_1
git push ado   :refs/tags/vSTALE_2
git tag -d vSTALE_1 vSTALE_2
```

Then delete the stale GitHub Releases (if they were already created) via `gh release delete vSTALE_1 vSTALE_2 --yes`, then push the intended tag:

```bash
git push origin main --follow-tags
gh release view "vX.Y.Z" --json assets  # confirm only the intended release
curl -sLI https://github.com/<OWNER>/<REPO>/releases/latest | grep -i ^location
```

If the redirect still resolves to the older tag after a few minutes, see [§ 5 the verification block](#5-cut-the-tag).

### 8.5 npm publish failed (GitHub Release succeeded, npm didn't)

The two publishes are independent pipelines: the `publish` job created the GitHub Release and finished green, but the downstream `publish-npm` job's `npm publish --provenance --tag latest` step exited non-zero. The most common failure modes (post-OIDC migration; no `NPM_TOKEN` secret exists anymore):

1. **`Trusted Publisher binding is missing or stale.`** Symptom: `npm ERR! code EOTP — This operation requires a one-time password` or `npm ERR! code E401 — Invalid credentials` or `npm ERR! code E403 — Forbidden`. Recovery: open https://www.npmjs.com/package/umactually/settings → Publishing access → confirm the GitHub Actions binding is present, repo `JosiahSiegel/umactually`, workflow filename `release.yml`. Verify with `npm trust list umactually` from an authenticated shell — it should print `type: github / file: release.yml / repository: josiahsiegel/umactually / permissions: publish, stage publish`. If absent or pointing at the wrong repo/workflow, re-add it (no token needed — the binding itself is policy), then re-run just `publish-npm` via `gh run rerun <run-id> --failed`.

2. **`id-token: write` permission missing from the workflow.** Symptom: the job logs `error: ID token could not be minted` or `error: insufficient permissions`. Recovery: confirm `.github/workflows/release.yml` has `permissions: { id-token: write }` at the job level for `publish-npm` (it does in the current revision). Re-run.

3. **`npm ERR! code E404 — 'umactually@*' is not in this registry`**: a fresh package name hasn't been claimed yet. Run `npm publish --provenance=false --ignore-scripts --tag latest --registry https://registry.npmjs.org/` once on a local terminal that can complete the WebAuth browser flow (or use the IP-trust-window option in the browser to skip the ceremony for the next 5 minutes — see [§ 5.5 Authentication mechanism](#authentication-mechanism-webauth--device-flow-in-2026) for the full mechanism). For non-TTY environments, `node scripts/publish-with-webauth.mjs --timeout=300` automates the polling loop. After the first publish lands, re-run the workflow.

4. **`npm ERR! code E403`** with **"cannot modify existing version"**: someone (or a previous workflow run) already published this version with a different tarball. Either (a) the GitHub Release SHA and the npm publish SHA diverged — check `git rev-parse HEAD` against the GitHub Release commit; or (b) someone locally published the same version. Recovery is to bump to `vX.Y.Z+1` and cut a patch release.

5. **`::error::umactually@<version> not found on registry.npmjs.org ...`** from the verify step: the publish step reported success but the registry hasn't synced within ~50 s. This is rare and almost always transient. Re-run `publish-npm` and the next pass usually lands clean. If it repeats, open a `npm support ticket` quoting the request id from the publish step's log.

6. **Local manual publish, the CLI prints `EOTP` with a redacted URL** (`https://www.npmjs.com/auth/cli/***`): you're in a non-TTY environment (background, piped, captured output). The `<authId>` is unrecoverable from the text output — npm redacts it deliberately. Re-run the command in an interactive TTY (laptop, SSH session, tmux pane) and read the full URL directly, OR use `node scripts/publish-with-webauth.mjs` which parses the JSON error block to recover the URL. The Trusted-Publisher-via-GitHub path (the `publish-npm` job) is unaffected — this failure mode is local-only.

7. **Local manual publish fails with `403 Forbidden — Two-factor authentication or granular access token with bypass 2fa enabled is required to publish packages.`** This is a registry-level enforcement, not a token problem. Granular Access Tokens with `bypass_2fa: true` are no longer honored at publish time as of July 2026 (see [github.blog 2026-07-31 changelog](https://github.blog/changelog/2026-07-31-restricting-npm-bypass-2fa-granular-access-tokens/)). The fix is the WebAuth flow above — complete it once per IP-trust window OR use the IP-trust option for low-friction publishes. If you only need CI-driven publishes, the `publish-npm` job via Trusted Publishing is unaffected.

8. **Local publish uses the wrong account**: your `~/.npmrc` holds a `//registry.npmjs.org/:_authToken=...` line that overrides `.env`'s `NPM_TOKEN=...`. npm config layering (builtin → env → project → user → global) makes user-level `.npmrc` win over env vars. Audit with `cat ~/.npmrc` and either remove the stale line or replace it with the current token. Re-run.

After a recovery, the next workflow run for the same tag reuses the same git SHA — npm picks up the new tarball, the GitHub Release keeps the assets it already uploaded, and the `dist-tags.latest` does not change between the two publishes. **Never** force-push or delete+re-push the tag to "retry" an npm failure; that breaks the canary, the post-publish canary's URL-contract assertions, and every downstream consumer's immutable-tag pinning. Re-running the workflow with the same tag is the only correct retry.

## 9. Appendix: helpers and references

### `scripts/release.sh`

A convenience wrapper, if present in your worktree, automates the four commands in [§ 5 Cut the tag](#5-cut-the-tag) and the sync PR creation. This document does not require it; the manual flow above is the canonical contract, and the helper is a thin layer on top. If the helper is unavailable, has a different argument shape than what is documented here, or fails partway through, fall back to the manual commands. Do not debug the helper mid-release.

### Related docs

- [`CONTRIBUTING.md`](../CONTRIBUTING.md): the canonical release-process section, including the version-token contract table and the pre-release PR checklist.
- [`scripts/ci-validate.sh`](../scripts/ci-validate.sh): the six-gate validation script, with per-gate commentary in the file header.
- [`scripts/render-versions.mjs`](../scripts/render-versions.mjs): the version-token renderer, with the token contract and the `TARGETS` glob documented in the file header.
- [`docs/azure-devops.md`](../docs/azure-devops.md): the ADO sync workflow, including the full curl for the `bypassPolicy: true` PR creation.
- [`.github/workflows/release.yml`](../.github/workflows/release.yml): the tag-triggered workflow that builds the binaries, runs smoke tests, and creates the GitHub Release.
- [`CHANGELOG.md`](../CHANGELOG.md): the Keep a Changelog file you update every release.
- [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/): the format reference for the CHANGELOG.
- [SemVer 2.0.0](https://semver.org/spec/v2.0.0.html): the version-bump rules summarized in [§ 3](#3-semver-decision-guide).

## 10. "Verify npm publication" timed out — did the publish actually land?

This is the most common post-OIDC confusion mode. The `publish-npm` job has two CI-visible steps: `Publish to npm (Trusted Publishing / OIDC)` (the actual `npm publish`) and `Verify npm publication` (a **two-phase probe** against the npm registry). The log shows `+ umactually@X.Y.Z` for the publish step, then the verify step runs:

- **Phase 1 — package-level `dist-tags.latest` fast-path** (`https://registry.npmjs.org/umactually`): polls up to 12 times at 5-second intervals (≈60s budget). Phase 1 maps directly to the canonical "did the publish land?" signal (see recipe below) — happy-path latency is ≈30s.
- **Phase 2 — per-version URL cross-validation** (`https://registry.npmjs.org/umactually/vX.Y.Z`): polls up to 60 times at 10-second intervals (≈600s / 10-min budget). Phase 2 catches genuine regressions (malicious publish, missing attestations) that Phase 1 cannot see.
- A genuine publish failure (e.g. OIDC misconfig) still fails the workflow — the step does **not** carry `continue-on-error: true`. A false negative only happens when Phase 1 returns `X.Y.Z` (publish landed) but Phase 2's per-version URL still 404s on the read path (registry CDN lag). Worst-case latency rises from ~315s to ~660s; the budget is intentionally generous.
- The verify step exits 1 because Phase 2's **per-version URL** still returns 404 — but Phase 1 has already proven the publish landed (see recipe below).
- The `npm view` data is the operator's ground truth: confirm it via the three-signal recipe below before taking any recovery action.
- If you are reading this section because the step failed, jump to the recipe, run the three signals, then re-read the rest of this section in order. The proof is the recipe, not the step's exit code.

```bash
# Did the publish actually land? Three signals to check:

# 1. dist-tags.latest (the canonical "is this the active version?" check)
curl -fsSL https://registry.npmjs.org/umactually | jq '.dist-tags.latest'
# Expected: "X.Y.Z" (the version you just pushed). If this is X.Y.Z, the publish landed.

# 2. The version entry in the registry's `versions` map
curl -fsSL https://registry.npmjs.org/umactually | jq '.versions["X.Y.Z"].dist | {shasum, integrity, tarball}'
# Expected: a non-empty shasum + integrity + tarball URL. If shasum matches the
# "Tarball Details" log line in the publish step's output, the publish is real.

# 3. The tarball itself
curl -sS -o /tmp/umactually-X.Y.Z.tgz -w "HTTP %{http_code} size=%{size_download}\n" \
  https://registry.npmjs.org/umactually/-/umactually-X.Y.Z.tgz
# Expected: HTTP 200, size > 100 KB. The packument's `attestations` field (if present)
# confirms the Sigstore provenance went through.
```

If all three signals are present, the publish landed. The verify step's 404 is the registry's URL-rewrite path lagging behind `dist-tags.latest` — the registry updated "what is the latest version" and the tarball storage before the per-version pointer on the read path. Common propagation window is 60-180 seconds; the verify step's 5-minute budget is sometimes too tight on a busy day at npmjs.org.

**The proof that the publish landed** is the registry's *immutable* response to a re-publish attempt: `npm ERR! code E403 — You cannot publish over the previously published versions: X.Y.Z`. If you re-run the failed `publish-npm` job and the only error is this `E403`, the original publish is intact and the re-run was correctly rejected by the registry. **Do not retry differently** — the only safe paths are:

1. **Accept the publish as real, wait for the registry CDN to catch up**, and treat the failed workflow run as a known false-positive (annotate the run with the proof above). The next workflow run for the same tag will reuse the same git SHA, npm will keep the existing tarball, and `dist-tags.latest` will not change.
2. **If you absolutely need a clean GitHub Actions badge**: cut a `vX.Y.Z+1` patch release that re-runs the full pipeline. Cannot reuse the failed tag (registry would reject).
3. **Never** force-push or delete+re-push the tag. That breaks the canary's URL-contract assertions and every downstream consumer's immutable-tag pinning.

The "verify step" should be renamed to "verify CDN caught up". Until then, treat the step's exit code as **advisory only** — confirm the publish via the three `npm view` signals above before taking any recovery action.

## 11. Pre-release gotchas that don't fail the six gates but will fail the release PR

These are real-world bumps landed in the field that the `scripts/ci-validate.sh` gates don't catch on their own. Document them inline so the next release doesn't rediscover them.

### 11.1 `INIT-DOC` test fails because the CHANGELOG mentions omit `umactually init`

`test/unit/init-docs-freshness.test.ts:INIT-DOC` scans the CHANGELOG and asserts that the **most recent non-`[Unreleased]` section** contains the literal string `umactually init`. The original invariant was that the `[Unreleased]` section always mentions `umactually init` (since the wizard was the first-run path); the test was generalized to the most-recent versioned section for the post-release case. Practical consequence: a `[X.Y.Z]` CHANGELOG bullet that does not mention `umactually init` anywhere in its body fails the test. If your release is a CLI-only fix that doesn't touch the wizard, the bullet reads naturally without the wizard reference — add one anyway. The fix is a one-line rephrase, e.g. "Affects the same surfaces that the bare-invocation quickstart (which leads with `umactually init`) and `umactually --help` (which lists every subcommand) already surface, so existing discoverability contracts are preserved."

### 11.2 `dist/cli.js` is stale, version-pin tests fail, but `npm run bundle` was never run

`scripts/ci-validate.sh` runs `npm run bundle` AFTER the test suite, not before. If `dist/cli.js` is stale (the source bundle is older than the runtime src/), the version-pin tests in `test/unit/install-methods.test.ts` and the install-smoke tests fail because they read the version string from the bundled CLI. Symptom: `AssertionError: expected '0.6.26' to contain '0.6.27'`. **Fix**: run `npm run bundle` BEFORE `scripts/ci-validate.sh` (or between the typecheck and test gates, which the script doesn't do). The flow is `npm run bundle && bash scripts/ci-validate.sh`. The `npm run check:dist-freshness` gate catches the opposite case (src edited without re-bundling) but not the version-stale case.

### 11.3 The release PR's squash-merge commit is the tag's anchor, not the branch's last commit

See [§ 5 Cut the tag](#5-cut-the-tag) for the explicit warning. The pre-release process produces a branch with one commit (`release: vX.Y.Z (your summary)`); after the squash-merge, `main` has a SECOND commit (the squash-merge commit on `main`) which is the canonical anchor. Always tag the squash-merge commit SHA, not the branch's pre-squash tip.

### 11.4 Don't render `dist/cli.js` into the release PR's diff

`npm run bundle` rewrites `dist/cli.js` and `dist/package.json`. These are **tracked files** — they MUST stay tracked because the bundle is the published artifact (the release workflow's `build-package` job reads the bundled CLI from the tag, not from `src/`). If the release PR includes the `--dist` rewrite, the diff is large and noisy. The bundle is re-generated by the release workflow's `build-package` job from the already-pinned `src/` and `package.json` in the tag, so committing the local `dist/cli.js` is incidental. Two options:

- **Commit the bundle** (current canonical flow): the release PR includes the bundle update. The release workflow's `build-package` job re-runs the same `npm run bundle` and the produced binaries are byte-identical (with the same shasum) — the SHA-256 in the GitHub Release checksums.txt matches the SHA-256 of the artifacts the PR was reviewed against.
- **Skip the commit** (NOT RECOMMENDED, documented for completeness): keep `dist/` tracked locally but `git checkout -- dist/cli.js dist/package.json` before opening the PR to drop the bundle rewrite from the diff. This is non-canonical: the merged PR will not contain the bundle the workflow re-generates from, and a fast-follow-up that re-runs `npm run bundle` will produce a different SHAs than the workflow's tarball. **Do NOT add `dist/` to `.gitignore`** — untracking `dist/cli.js` means the release workflow's `build-package` job fails to find the bundle in the tag's tree, and downstream consumers lose the immutable-pin guarantee.

The current canonical flow is to commit. The doc's [§ 5.5 npm publication](#55-npm-publication-post-github-release) is unaffected either way.

## 12. Recipes

### 12.1 Confirm a release was published without trusting the GitHub Actions conclusion

```bash
TAG="v0.9.4"
curl -fsSL "https://registry.npmjs.org/umactually" | jq --arg t "$TAG" '
  {
    "is_latest": (.dist-tags.latest == ($t | sub("^v";""))),
    "version_present": (.versions[$t | sub("^v";"")] != null),
    "shasum": .versions[$t | sub("^v";"")].dist.shasum,
    "tarball_size": .versions[$t | sub("^v";"")].dist.unpackedSize,
    "has_attestations": (.versions[$t | sub("^v";"")] | has("attestations"))
  }
'
```

Returns `true` for every field if the publish landed. The `has_attestations` field is the Sigstore provenance-attestation indicator; if `false`, the publish went through but the OIDC token exchange failed silently (re-run the job).

### 12.2 Confirm the GitHub Release exists with all 6 assets

```bash
gh release view "v0.9.4" --json name,assets,publishedAt | jq '
  {
    "name": .name,
    "published": .publishedAt,
    "asset_count": (.assets | length),
    "expected": 6,
    "assets": [.assets[].name] | sort
  }
'
```

Expected: `asset_count == 7` (six archives + `checksums.txt`). If the asset list is shorter, the `publish` job failed mid-upload — check the release workflow's logs.

### 12.3 Confirm the post-release install path works end-to-end

```bash
npm run test:post-release -- --tag v0.9.4
```

Downloads the published archive, verifies SHA-256 against `checksums.txt`, extracts the binary, spawns a mock LLM, and runs both `--provider openai-compatible` and `--provider anthropic` review paths against the prompt. Exit 0 with two `comments=2` lines is the canonical "the install path is healthy" signal. The artifacts live at `artifacts/post-release-e2e/` in the worktree.

