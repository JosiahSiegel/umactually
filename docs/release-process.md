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
| Major (`X+1.0.0`) | Any backwards-incompatible change to a documented contract: removed env var, renamed CLI flag, changed default behavior of an existing flag, changed the artifact schema, dropped a provider family, raised the minimum Node version. | Remove a legacy `REVIEW_*` alias after a deprecation window. Change the default of `UMACTUALLY_STRICT_SCHEMA` from `true` to `false`. Drop support for Node 22. |

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

Expected: one asset per supported platform plus `checksums.txt`. If the asset list is shorter, or if `assets` is `null`, an earlier job failed; fetch logs via `gh run list --workflow=release`. The fix is on `main` before you re-tag — but you cannot just `git tag vX.Y.Z` again, because both `origin` and `ado` still have the prior tag pointing at the same commit, and a second `git push origin vX.Y.Z` will be rejected with `! [rejected]` (nothing to push). Recover per [§ 8.1](#81-a-bad-tag-was-pushed), which uses `git tag -d` + `git push :refs/tags/<tag>` + re-tag-at-fixed-commit to create a new tag with a new SHA.

Verify the public `latest` redirect points at this release:

```bash
curl -sLI https://github.com/<OWNER>/<REPO>/releases/latest | grep -i ^location
# expected: https://github.com/<OWNER>/<REPO>/releases/tag/vX.Y.Z
```

If the redirect still points at an older tag, GitHub's CDN has stale edge cache (typically 1-2 minutes). If it persists past five minutes, see [§ 8.4](#84-a-stale-queued-tag-rode-along).

## 6. Post-tag behavior

`.github/workflows/release.yml` runs four jobs after the tag lands. None of them are your problem as the maintainer beyond watching them go green:

| Job | What it does | Failure mode to watch |
| --- | --- | --- |
| `release` | Checks out at the tag, runs `npm ci`, `npm run typecheck`, `npm run build`, `node scripts/build-binary.mjs`, then smoke tests the Linux x64 binary (`--version`, `doctor`, `--help`), computes SHA-256 checksums, uploads Windows + Windows-arm64 artifacts, and creates the GitHub Release with the six platform binaries plus `checksums.txt`. | If `npm run build` fails, the release job exits before any binary is published; the GitHub Release is not created. Re-run by deleting and re-pushing the tag. |
| `windows-smoke` | Downloads the Windows x64 binary, runs `--version` in pwsh, and verifies the ARM64 binary exists. | A failure here means the Windows binary is broken even though it was uploaded; the GitHub Release should be edited to un-publish the broken assets before fixing forward. |
| `install-smoke-linux` | Runs `bash scripts/install.sh` against the freshly-published release on a non-root ubuntu-latest runner, then verifies the installed binary works. | A failure here means the user-facing install path is broken end-to-end; treat as a P0 and cut a follow-up patch release. |
| `install-smoke-windows` | Runs `./scripts/install.ps1` in `INSTALL_TEST_MODE=1` against the freshly-published release on windows-latest. | Same as above, but for the PowerShell install path. |

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
| `npm run render-docs` | The token contract was violated (a non-canonical `{{UMACTUALLY_*}}` token snuck in). | Read the script output for the file and token name. Replace it with `v0.4.1` or `0.4.0` as appropriate. Exit 2 means a typo; exit 1 means a token survived. |
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

