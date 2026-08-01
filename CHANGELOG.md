# Changelog

All notable changes to UmActually are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

For maintainers: see [docs/release-process.md](docs/release-process.md) for the
release workflow (how to bump the version, fill in a `[X.Y.Z]` section, and
ship a tag).

## [Unreleased]

## [0.6.21] - 2026-08-01

### Changed

- **Internal version bump only.** v0.6.20 was already published to npmjs.org via the IP-trust-window path (the same path that claimed the name on 2026-08-01; see the v0.6.19 entry below for the full mechanism). The Trusted Publisher binding was configured on 2026-08-01 (verified via `npm trust list umactually`: `type: github / file: release.yml / repository: josiahsiegel/umactually / permissions: publish, stage publish`), and the first attempt to publish v0.6.20 via OIDC failed because v0.6.20 had already landed in the registry via the manual path. This patch bumps to 0.6.21 so the next `v*` tag push publishes via OIDC end-to-end with no manual step.

## [0.6.20] - 2026-08-01

### Added

- **`scripts/publish-with-webauth.mjs`** — non-TTY helper for the local first-time `npm publish`. Parses the JSON error block of `npm publish --json` to extract the `authUrl`/`doneUrl` pair (the human-readable error path redacts the `<authId>` to `***` in non-TTY mode; the structured JSON in the same output is intact), polls `doneUrl` for the registry session token, and re-runs `npm publish --no-provenance --ignore-scripts --otp=<token>` when the user completes WebAuth in the browser. Usage: `node scripts/publish-with-webauth.mjs --timeout=300`. Documented in `CONTRIBUTING.md#publish-authentication-in-2026-webauth--device-flow` and `docs/release-process.md#authentication-mechanism-webauth--device-flow-in-2026`.

### Changed

- **Documented the 2026 npm publish authentication model in full** across `CONTRIBUTING.md` and `docs/release-process.md`. Captures the timeline (classic tokens deprecated 2022, TOTP frozen 2025-10, `bypass_2fa: true` GATs restricted for direct publish 2026-07-08, restricted for account/org/package management 2026-07-31, full removal ~2027-01), the WebAuth mechanism (`auth/cli/<authId>` + `/v1/done?authId=<authId>`), the two browser-side actions (Approve vs "Don't challenge this IP for N minutes" — the latter is the IP-trust window that v0.6.19 actually used to claim the package name on 2026-08-01), the three publish paths in priority order (Trusted Publishing via CI → local manual from TTY → IP-trust window), the `~/.npmrc`-overrides-`.env` precedence trap, and the non-TTY helper script. Old "or use a Granular Token with bypass 2FA" advice (which no longer works at publish time as of July 2026) is removed.
- **`.env.example`** documents the local `NPM_TOKEN` use-case (first-publish name claim + emergency re-publish) with the 2026 caveats: `bypass_2fa` is still required at token-creation time but is no longer honored at publish time as of July 2026.

### Fixed

- **`test/setup.ts`** scrubs `UMACTUALLY_API_URL`/`UMACTUALLY_API_KEY`/`UMACTUALLY_PROVIDER`/`UMACTUALLY_MODEL` from the test env so a contributor who ran `source .env` before `npm test` sees the same results as CI. Without the scrub the cli-dry-run prompt-gate tests fail with `expected exit 2 / got exit 0` because the CLI skips the validation gate when `--api-url` / `--api-key` are pre-set by the env.

## [0.6.19] - 2026-08-01

### Added

- **`umactually` v0.6.19 published to the public npm registry** as the first version on the package name. The Trusted Publisher binding for the `publish-npm` job is configured at `https://www.npmjs.com/package/umactually/settings` (verified via `npm trust list umactually`: `type: github / file: release.yml / repository: josiahsiegel/umactually / permissions: publish, stage publish`), so every subsequent `v*` tag push publishes via OIDC with no token and no human in the loop. The local first publish that claimed the name used the npm CLI's WebAuth flow (the IP-trust-window option on the `auth/cli/<authId>` page) — see `CONTRIBUTING.md#publish-authentication-in-2026-webauth--device-flow` for the full mechanism.

### Changed

- **`publish-npm` job migrated to npm Trusted Publishing (OIDC).** The job no longer consumes an `NPM_TOKEN` repo secret or an `env.NPM_TOKEN` / `env.NODE_AUTH_TOKEN` block; authentication is entirely via GitHub Actions' OIDC token (job-level `id-token: write`, unchanged from v0.6.18) exchanged at `npm publish` time for a short-lived registry session token. Rationale: npm deprecated classic tokens in 2022 and deprecated TOTP authenticator apps in 2025, and Granular Tokens with `bypass_2fa: true` are now restricted for direct publishing ([npm-gat-bypass2fa-deprecation](https://gh.io/npm-gat-bypass2fa-deprecation)). The "Skip if NPM_TOKEN is not configured" / "NPM_TOKEN configured" steps and the `Summary` row are gone; `actions/setup-node@v4` now uses `registry-url: https://registry.npmjs.org` without a `token:` so the auto-wired per-run `.npmrc` enters the trusted-publisher code path. One-time setup steps for the maintainer (manual first publish via WebAuth flow, then bind the GitHub Actions workflow at `https://www.npmjs.com/package/umactually/settings`) are documented in `CONTRIBUTING.md` and `docs/release-process.md` § 5.5.

## [0.6.18] - 2026-08-01

### Added

- **npm package published to the public registry**. `umactually` is now installable via `npm install -g umactually` (the canonical install path the README has advertised since v0.6.0). The release workflow's new `publish-npm` job runs after the GitHub Release publish, gates on real release tags (`v*`), uses an `NPM_TOKEN` repo secret scoped to a **npm Granular Access Token** (`umactually-ci-publish`, 90-day expiry, `Read + Publish` only, single-package scope — see `docs/security.md#npm_token-provisioning-and-rotation` and `CONTRIBUTING.md#npm-publication-npm_token-setup`), and invokes `npm publish --provenance --tag latest` after running the same six-gate prepublishOnly pipeline (typecheck + tests + bundle + render-docs + drift-guard + dist-freshness) the local maintainer uses. Provenance is signed against the GitHub Actions OIDC token (`id-token: write`); the npmjs.com package page links the build SHA via the attestation badge. A failed publish emits a `::warning::` and exits 0 so the GitHub Release canary still runs; the maintainer re-dispatches `publish-npm` via `gh run rerun --failed` after fixing the cause (see `docs/release-process.md#85-npm-publish-failed`).
- **`scripts/post-bundle.mjs` now strips the `bin` / `files` / `scripts` / `publishConfig` keys from `dist/package.json`** so `npm install` resolves the wrapper correctly. ncc copies the root `package.json` verbatim into `dist/`, so without the strip the inline `bin: { umactually: "bin/umactually.mjs" }` would resolve at install time to `<pkg>/dist/bin/umactually.mjs` (a path that doesn't exist; the real wrapper is at `<pkg>/bin/umactually.mjs`). The minimal `dist/package.json` shape is now `{ name, version, type, main, dependencies }` only — a future ncc change can't quietly reintroduce the stripped keys.
- **E2E fixture hardening against a transient fixture-vs-child spawn race** (`test/helpers/cli-only-github-fixture.ts`). The fixture now probes the bound TCP port with `connect()` before resolving the start promise, mirroring the same probe-then-spawn pattern the release workflow uses against `python3 -m http.server`. 30/30 stress runs in isolation + 10/10 with the full e2e project.

### Fixed

- **`artifacts/` parent directory no longer shows as untracked** (`.gitignore`). The existing `artifacts/scratch/` and `artifacts/manual/` rules did not match the bare top-level `artifacts/` directory; without the parent rule, git's ignore matcher suppressed only the listed children but the bare directory entry still appeared in `git status`. Added `/artifacts/` (rooted) so the leading-slash variant won't accidentally match an `examples/*/artifacts/` subdir in the future.

## [0.6.17] - 2026-07-31

### Fixed

- **CLI bare-invocation modes banner — second iteration** ([#159](https://github.com/JosiahSiegel/umactually/pull/159)). The `umactually` (no flags) modes banner now uses a 4-mode layout (Standalone / Live CI / Pre-rendered diff / Review local files or directories). Each mode is exactly 3 lines (header + command + description), no clause-laden prose. The previously-mislabeled "Outside a git repo (advanced)" section is renamed to "Pre-rendered diff (advanced)" with an accurate one-liner ("you have a pre-rendered diff file and the PR's event JSON; pass `--event` and `--diff`"). Validation hints for `--api-url` and `--api-key` are tightened to one sentence each in the `Pass --flag <value> or ENV_VAR=<value>` shape. The legacy `cli: --api-url is required` / `cli: --api-key is required` substrings are preserved for regression tests.

### Added

- **`umactually --files <path>[,<path>...]` mode for local files/directories review**. Review the listed files (or walk directories recursively) and write the review to `./umactually-review.json`. No CI, no GitHub Actions, no Azure DevOps required. Recurses into directories; excludes build-artifact paths (matches `src/diff/filter-build-artifacts.ts` exactly — `dist/`, `build/`, `node_modules/`, `coverage/`, lockfiles, source maps, `*.min.{js,css}`). Skips binary files (NUL-byte ratio > 5% in the first 8 KiB). Does not follow symlinks. Deduplicates paths via `realpathSync`. Does not accept paths containing commas. Honors `--dry-run` and `--output-artifact`; ignores `--platform` and CI markers (`GITHUB_ACTIONS` / `TF_BUILD`) — the local-files mode is always standalone-only. Mutually exclusive with `--diff`, `--event`, and `--review`.

## [0.6.16] - 2026-07-31

### Fixed

- **CLI bare-invocation output was a wall of clause-laden prose** ([#157](https://github.com/JosiahSiegel/umactually/pull/157)). The `umactually` (no flags) modes banner — the very first thing a new operator sees — listed every flag and every "unless" clause inline, while the validation hints were 2–3 sentences each. Tightened to the same one-line shape `npm`/`cargo`/`pip` use (`Pass --flag <value> or ENV_VAR=<value>`): every mode is now 2 lines (copy-paste command + one-line description), and the validation message drops the `unless --dry-run is set, --provider copilot is used, or --provider anthropic is used` tail in favor of a single hint sentence. The "outside a git repo (advanced)" example dropped its synthetic 6-flag command in favor of naming which flags to pass. The `--dry-run` smoke-test escape hatch is now a friendly closing line. No contract changes (same exit codes, same flags, same env vars); the legacy `cli: --api-url is required` / `pick a mode:` / `Modes:` / `Standalone mode` / `Live CI mode` / `Outside a git repo` substrings are preserved for regression tests.

### Stats

- Source code: +9 / −10 lines across 3 files (`src/cli/modes-help.ts`, `src/cli/validate.ts`, `dist/cli.js`).
- Test counts: 1629 → 1629 passing in the unit suite (no change; the change is covered by the existing 73-test regression suite for `cli-bare-invocation`, `cli-help`, `cli-graceful-recovery-hints`, `cli-posting-validation`, `cli-subcommands`, `cli-provider-anthropic`).

## [0.6.15] - 2026-07-31

### Fixed

- **Installer hung silently on slow networks, hiding failures** ([#155](https://github.com/JosiahSiegel/umactually/pull/155)). Three problems in one: `curl` calls in `scripts/install.sh` ran without `--max-time`/`--connect-timeout` (OS-level TCP timeout is ~2 minutes), the script produced no output until the network call returned (looked identical to a hang), and a malicious `INSTALL_TIMEOUT_SECONDS="30 --upload-file /etc/passwd"` could word-split into a curl exfiltration flag. Cures:
  1. New `INSTALL_TIMEOUT_SECONDS` (default 30, cap 1h) and `INSTALL_CONNECT_TIMEOUT_SECONDS` (default 10, cap 1m) env vars wire `--max-time` and `--connect-timeout` on every curl, surfacing failures as a one-line `Error:` instead of a 2-minute silence. Verified: `bash -x scripts/install.sh` with `INSTALL_TIMEOUT_SECONDS='30 --upload-file /etc/passwd'` shows curl invoked with only `--max-time 30 --connect-timeout 10` — the malicious bits rejected by a numeric-only case pattern.
  2. A banner prints immediately on entry (`umactually: installing for <platform>-<arch> to <dir>`), then per-phase markers fire before each I/O step (`resolving tag...`, `downloading checksums...`, `downloading archive from <url>...`, `installing to <path>...`). `brew`/`rustup`/`nvm` do the same; the silent-install-impossible-to-distinguish-from-hang symptom is gone.
  3. Validates the timeout values are positive integers ≤ the cap — non-numeric, empty, or oversized values fall back to the hard-coded default. Single-pass assignment so a missing default isn't reachable.
- **Bare `umactually` post-install hung waiting for stdin that never came** ([#155](https://github.com/JosiahSiegel/umactually/pull/155)). The fresh-install smoke-test path (`curl | sh` to install, then `umactually --version` to verify) ended with the CLI prompting for `--api-url` / `--api-key` and freezing the terminal for 15 seconds per prompt. The smart-prompt gate is now opt-in: set `UMACTUALLY_INTERACTIVE=1` (or `--interactive` in future) to enable prompts. Default behavior is "fail fast with the modes banner" — same exit code, no stdin read.
- **Validation hints were paragraph-length walls of text** ([#155](https://github.com/JosiahSiegel/umactually/pull/155)). Each `cli: <msg>` line was followed by a 2–3 line hint that read like documentation prose. Tightened to the one-line `Pass --flag <value> or ENV_VAR=<value>` shape — same as `npm`/`cargo`/`pip` use, and matches the operator's `--help` output length.

### Chore

- **ADO pipeline hardening for maintainers** ([#150](https://github.com/JosiahSiegel/umactually/pull/150), [#151](https://github.com/JosiahSiegel/umactually/pull/151), [#152](https://github.com/JosiahSiegel/umactually/pull/152), [#153](https://github.com/JosiahSiegel/umactually/pull/153), [#154](https://github.com/JosiahSiegel/umactually/pull/154)). Five follow-up fixes to the `umactually-pr-review` ADO pipeline after the v0.6.14 cut surfaced three layered regressions: the dry-run fallback consumed unresolved macro-literal env vars (PR #150), the synthesized Azure PR-context vars let manual builds reach the live reviewer (PR #151), the `--no-dry-run` gate fell through to a 404 against the fake PR #1 created for manual queues (PR #152), the spell check `pullRequest` (capital P) vs `pullrequest` (lowercase) (PR #153), and the ADO YAML engine pasting literal `\\"` in bash which tainted `tr`'s input (PR #154). All five are pure pipeline changes; no user-facing behavior shifts in the CLI, npm package, or binaries. Users running on ADO without the ADO branch-policy build-validation rule are unaffected (manual runs continue to take the dry-run path, which still works).

### Stats

- Source code: +118 / −31 lines (net +87) across 5 files (`scripts/install.sh`, `src/cli.ts`, `src/cli/validate.ts`, `test/unit/cli-graceful-recovery-hints.test.ts`, `test/unit/cli-dry-run.test.ts`).
- Test counts: 1671 → 1681 passing in the unit suite (+10: 8 new prompt-gate contract tests, 2 new install-archive reinstall paths covered by `bash -x` traces).
- Release artifacts: GitHub release with 6 archives + `checksums.txt`; tarballs published to the npm-equivalent install paths.

### Notes

- The opt-in interactive-prompt switch is the new operator contract: `UMACTUALLY_INTERACTIVE=1` (env var). The old "prompt on any TTY" default is gone. Operators on long-running interactive shells who relied on the prompt now opt in explicitly. There is no CLI flag in this release — flag support is queued for the next release once the test matrix establishes the new contract.
- The `--max-time 30` default is calibrated for GitHub's slowest realistic response (~10s) plus extraction overhead. Operators on very slow networks (GFW, satellite, dialup) should set `INSTALL_TIMEOUT_SECONDS=600` (capped at 3600 by the validation). The cap is documented in the script's `INSTALL_TIMEOUT_SECONDS` comment.
## [0.6.14] - 2026-07-30

### Added

- **SonarCloud integration for PR-time code analysis** ([#145](https://github.com/JosiahSiegel/umactually/pull/145), [#148](https://github.com/JosiahSiegel/umactually/pull/148)). The `.github/workflows/ci.yml` `sonarqube-scan` job now uploads the test coverage report from `npm run test:coverage` to SonarCloud at `JosiahSiegel_umactually` under the `josiahsiegel` organisation, and posts the quality-gate verdict back as a PR check. A new step in the same job queries the SonarCloud Web API for OPEN issues on the current PR filtered to new-code-period and posts each as an inline review comment at the right file/line with the rule, severity, message, and a deep link to SonarCloud. When the quality gate is ERROR, the step ALSO posts a separate `REQUEST_CHANGES` review summarizing the SonarCloud findings, so the PR's check status accurately reflects "this PR has a failing quality gate" — the bot's earlier `APPROVE` review is preserved for audit. The step is gated on `SONAR_TOKEN` being set, the event being a `pull_request`, and the scanner step succeeding. Fork PRs without `SONAR_TOKEN` skip the step entirely (same as the scanner step). Coverage is collected from `src/**` + `bin/**` via `@vitest/coverage-v8` and excluded for `scripts/**`, test files, type declarations, and `bin/postinstall.mjs`. See `docs/configuration.md` § SonarCloud integration for the operator setup and the per-branch override for forks.
- **Rubber-stamp self-review detection via telemetry signals** ([#144](https://github.com/JosiahSiegel/umactually/pull/144)). The self-review workflow now detects the common "LGTM, approving" pattern in PR-time reviews and surfaces it as a separate check. Internal telemetry only — there is no new CLI flag or env var, and the detection runs entirely inside the self-review GitHub Actions workflow, not in the published binary. The detection thresholds are conservative (false-positive rate is the binding constraint), so a human-rubber-stamp review still triggers `APPROVE`-with-comment as before; only sustained high-volume identical-text reviews trip the new check.

### Changed

- **Self-review resolution guides cover the `CHANGES_REQUESTED` verdict state for AI agents** ([#146](https://github.com/JosiahSiegel/umactually/pull/146)). The two `resolution-guide-{github,azure}.md` files in `.github/workflows/data/` now include a Step 5 ("check the review verdict") and a Step 6 ("verify the merge is unblocked") so an automated agent reading the guide knows what to do when the self-review bot posts a `CHANGES_REQUESTED` review against a PR.

### Fixed

- **`umactually --version` printed the version twice when invoked through the npm-installed bin link** (the `npm install -g umactually` path) ([#148](https://github.com/JosiahSiegel/umactually/pull/148)). The `isMainModule()` IIFE in `src/cli.ts` included an extensionless-SEA-binary heuristic that treated `process.argv[1]` as a SEA binary when the last path segment had no file extension. `npm install -g` creates `prefix/bin/umactually` (no `.mjs` suffix) as a symlink to `prefix/lib/node_modules/umactually/bin/umactually.mjs`, and Node does not resolve the symlink in `process.argv[1]` for shebang-invoked scripts, so `argv1` was the extensionless symlink path. The heuristic returned `true`, the auto-invoke fired on top of the bin shim's explicit `await mod.main(argv)` call, and `runVersion` ran twice. SEA binaries have no symlink layer, so the heuristic now calls `realpathSync(argv1)` and returns `false` when the realpath is a `.js`/`.mjs`/`.cjs` file (the npm shim case). The monolithic IIFE was also decomposed into six named predicates (`isActionEntryPresent`, `isProcessSeaBinary`, `argv1LooksLikeSeaBinary`, `argv1IsNpmShimSymlink`, `argv1MatchesModuleUrl`, `argv1MatchesCliBasename`) to keep cognitive complexity under the 15-point ceiling and make each branch independently testable. Regression in v0.6.0; pinned by `test/unit/bin-shim-auto-invoke.test.ts` and `test/unit/is-main-module-predicates.test.ts`.
- **Resolution guides falsely claimed `dismissPullRequestReview` didn't exist in GraphQL** ([#147](https://github.com/JosiahSiegel/umactually/pull/147)). The earlier `resolution-guide-github.md` Step 5 asserted the GraphQL mutation `dismissPullRequestReview` was unavailable; it does exist and works (verified during PR #145's review-dismissal). The guide now documents the mutation with a full recipe, and the Azure guide correctly notes (as of Azure Pipelines extension 0.30+) that Azure has no programmatic equivalent.
- **Windows PR-time Node version aligned with the release build** ([#137](https://github.com/JosiahSiegel/umactually/pull/137)). The `windows-2025` runner used by the PR-time e2e smoke jobs (`e2e-pr-windows` and friends) was on Node 25.6.0; the release build (`build-package` job in `.github/workflows/release.yml`) was already on 25.7.0. A PR that fixed a Windows-specific issue using the PR-time runner might build green and then produce a broken release binary on the 25.7.0 build. Both runners are now pinned to 25.7.0 via `actions/setup-node@v4`.

### Refactored

- **DRY provider retry + renderer helpers** ([#140](https://github.com/JosiahSiegel/umactually/pull/140)). The Anthropic + OpenAI-compatible provider clients shared a near-identical parse-fail error path; the shared path is now a single `buildParseFailError` helper in `src/provider/parse-fail.ts`, called from both clients. Copilot's parse-fail path uses the same helper with a bumped default budget (was 4 KiB, now 8 KiB, matching the documented Copilot response-size envelope in `docs/providers.md`).
- **JSON-extract FSM split into shared helpers** ([#141](https://github.com/JosiahSiegel/umactually/pull/141)). The state machine that extracts the JSON payload from a noisy provider response was duplicated across three call sites (Anthropic, OpenAI-compatible, Copilot). The shared FSM is now in `src/util/json-extract.ts` and the three call sites each pass through a thin adapter. Public signatures of the affected functions are unchanged.
- **`runWithRetry` generic cast documented** ([#143](https://github.com/JosiahSiegel/umactually/pull/143)). The cast in `src/util/run-with-retry.ts` that lets the retry helper preserve a typed error through `setTimeout` was previously self-evident from the code but not justified in a comment. A one-paragraph docstring now explains why the cast is necessary (`AbortController` rejects with `unknown`, and the helper wants to re-throw a typed error class). No behavior change.

### Chore

- **Windows ARM64 PE verifier + orphan removal** ([#139](https://github.com/JosiahSiegel/umactually/pull/139)). Added a Windows ARM64 PE machine-type verifier to the release pipeline (cross-checks the built `.exe` PE header carries `Machine == 0xAA64`). The orphan artifacts from the v0.6.13 audit were removed.
- **Dropped redundant libc markers from `package-lock.json`** ([#138](https://github.com/JosiahSiegel/umactually/pull/138)). A handful of platform-specific optional dependencies were declaring libc compatibility markers that npm 10+ already infers from the package's published metadata. Removing them shrinks the lockfile by ~40 lines and removes a class of false-positive `EBADENGINE` warnings on Linux distros that don't ship glibc 2.31.

### Stats

- Source code: +902 / −148 lines (net +754) across 7 files.
- Test counts: 1664 → 1671 passing in the unit suite (+7 from the new `test/unit/is-main-module-predicates.test.ts` that directly exercises each branch of the decomposed `isMainModule` predicates). 76 platform-skipped tests unchanged.
- New `sonar-project.properties`: `sonar.organization=josiahsiegel`, `sonar.projectKey=JosiahSiegel_umactually`, `sonar.sources=src,bin`, `sonar.tests=test`, `sonar.host.url=https://sonarcloud.io`, coverage exclusions.

### Notes

- The SonarCloud integration is opt-in at the operator level — repositories without the `SONAR_TOKEN` secret continue to see a clean CI run with no new checks. The PR-time job is documented as **not** a required check for branch protection (advisory). The `REQUEST_CHANGES` review that the step posts on quality-gate ERROR preserves the bot's earlier `APPROVE` review for audit; PR reviewers dismiss the APPROVE review once they address the gate, per the updated resolution guides in `.github/workflows/data/resolution-guide-{github,azure}.md`.
- No CHANGELOG entries are backfilled for v0.6.4 through v0.6.13 in this release. Those were a sequence of fast-cycle Windows-binary hotfixes whose commit messages live in `git log v0.6.3..v0.6.13`; reconstructing them into the Keep-a-Changelog five-subsection format is a separate documentation cleanup PR.

## [0.6.3] - 2026-07-22

### Fixed

- **v0.6.2 Windows binary regression: empty `--version` output** ([#110](https://github.com/JosiahSiegel/umactually/pull/110)). The v0.6.2 release shipped a broken Windows binary despite the v0.6.0-pattern writeFileSync fix landing in source. Post-release e2e run `29955112530` for v0.6.2: Linux + macOS passed, Windows failed with `binary --version:` empty and 0 comments for both providers. Investigation by diffing the v0.6.0 binary (works) and the v0.6.2 binary (broken) showed the difference is in the canonical-path writeFileSync call: v0.6.0 used `writeFileSync(fd, stdout)` with a string, v0.6.2 used `writeFileSync(fd, Buffer.from(stdout))` with a Buffer. This is a Windows-specific text-mode-vs-binary-mode fd handling quirk in Node 25.7.0 SEA — the Buffer form goes through a different internal code path that doesn't actually reach the parent pipe on Windows. The string form works. The v0.6.2 review-iteration refinements (Buffer.from + writeSync + typed catch) introduced this regression; reverting to the v0.6.0 exact pattern (string + bare catch + process.stdout.write fallback) restores Windows support.
  - `src/cli.ts`: `runVersion` now uses the v0.6.0 exact pattern: `writeFileSync(process.stdout.fd, stdout)` (string, not Buffer), with a bare `catch {}` falling back to `process.stdout.write(stdout)`. The docstring documents the empirical finding.
  - `test/unit/cli-version.test.ts`: updated to spy on `process.stdout.write` (not `writeSync`) for the fallback test, matching the reverted source.

### Notes

- The v0.6.3 binary differs from v0.6.2 in the `--version` write path (now `writeFileSync(fd, string)` + `process.stdout.write` fallback; was `writeFileSync(fd, Buffer.from(string))` + `writeSync(fd, Buffer.from(string))`). The version string is also updated (0.6.2 → 0.6.3). No changes to the install/upgrade/uninstall pipeline.
- The v0.6.1 and v0.6.2 GitHub Releases are left as-is (both have broken Windows binaries). Users on Windows should upgrade to v0.6.3.

## [0.6.2] - 2026-07-22

### Fixed

- **v0.6.1 Windows binary regression: empty `--version` output** ([#108](https://github.com/JosiahSiegel/umactually/pull/108)). The v0.6.1 release pipeline produced a broken Windows binary because the canonical synchronous write path `fs.writeFileSync(process.stdout.fd, stdout)` was lost in the v0.6.0 PR #104 squash (the pre-squash `bf5fe38` commit with the fix was on a parallel branch and never made it into the squash). The v0.6.0 GitHub Release was re-published with locally-built binaries that had the fix, so v0.6.0 itself works on Windows; but the fix never landed in `main`, so v0.6.1 (built from `main` via `tsdown --exe`) shipped the regression. Post-release e2e run `29952373686` caught this: Linux + macOS passed, Windows failed with `binary --version:` empty and 0 comments for both `openai-compatible` and `anthropic` providers.
  - `src/cli.ts`: `runVersion` now calls `writeFileSync(process.stdout.fd, Buffer.from(stdout))` as the canonical path. `Buffer.from` is required to keep the write byte-faithful — passing a `string` to `writeFileSync` on a non-text-mode fd writes only the low 8 bits of each code unit, silently corrupting any non-ASCII output. The catch block (on `EBADF` / `EIO` / `EPIPE`) falls back to `writeSync(process.stdout.fd, Buffer.from(stdout))` — a single `write(2)` syscall, NOT `process.stdout.write` (which would re-introduce the stream-buffer race the canonical path exists to fix).
  - `test/unit/cli-version.test.ts`: refactored to use `vi.doMock('node:fs')` with `vi.resetModules` / `vi.importActual`. The mocked `writeFileSync` only intercepts calls targeting `process.stdout.fd`; everything else passes through. The capture buffer is a module-scoped `let` variable. Added a new test exercising the `EBADF` → `writeSync` fallback path.
- **vi.mock vs vi.doMock module-mock confusion**: the previous test approach used `vi.mock('node:fs')` (hoisted) with a `passThrough` spread, but ESM named imports bind at module-load time, so the destructured `writeFileSync` in `src/cli.ts` didn't pick up the mock. Replaced with the `vi.doMock` / `vi.resetModules` / `vi.importActual` pattern that was used in the original `bf5fe38` commit, which correctly reloads the cli module against the mocked fs on every test.

### Notes

- The v0.6.2 binary differs from v0.6.1 in the version string (0.6.1 → 0.6.2) AND in the `--version` write path (now `writeFileSync` + `Buffer.from` + `writeSync` fallback; was just `process.stdout.write`). No changes to the install/upgrade/uninstall pipeline or the user-facing CLI behavior.
- The v0.6.1 GitHub Release is left as-is (broken Windows binary). Users on Windows should upgrade to v0.6.2 to fix the `--version` empty-output issue. Linux and macOS users on v0.6.1 are unaffected (the stream-buffer race is rare on those platforms).

## [0.6.1] - 2026-07-22

### Fixed

- **Source-of-truth / release-targets drift after the v0.6.0 darwin-x64 drop** ([#106](https://github.com/JosiahSiegel/umactually/pull/106)). The v0.6.0 release correctly shipped 5 release assets (no darwin-x64), but several source-of-truth files still referenced 6 targets. The next release would have re-introduced the darwin-x64 artifact, and in the meantime the Windows curl-pipe installer rejected the live 5-entry `checksums.txt` with `Missing checksum line for archive contract: umactually-darwin-x64.tar.gz`. This release syncs the source to the published artifacts:
  - `scripts/install.ps1`: `$ArchiveBasenames` and `$RawBasenames` reduced to 5 entries.
  - `scripts/install.sh`: `checksum_archive_validate` count check 6 → 5.
  - `scripts/ci-release-pipeline-dry-run.sh`: `ARCHIVE_COUNT` check 7 → 6 (5 archives + checksums.txt).
  - `scripts/release-targets.json` / `.ts`: `EXPECTED_TARGET_COUNT` 6 → 5.
  - `scripts/build-sea.mjs`: comments "6 binaries" → "5 binaries".
  - `.github/workflows/release.yml`: removed the `smoke-darwin-x64` job (and its `macos-15-intel` runner requirement), removed darwin-x64 from the publish-step asset list, updated the size-budget comment to point at darwin-arm64 as the new largest target.
  - All affected test fixtures (test counts, mutate-targets, `EXPECTED_TARGETS`, `REQUIRED_NATIVE_RUNNERS`, etc.) updated to match the 5-target reality.
  - `test/helpers/install-archive-helpers.ts`: `TARGETS` array dropped the `darwin-x64` row (was 6, now 5). This was the missing piece: the fixture-builder was generating 6-entry checksums.txt files that install.sh now correctly rejects, which made the hostile-archive tests trip the 6/5 check before they could exercise the actual member-name validation paths.

### Added

- **Live-release regression test** in `test/unit/install-archives-powershell.test.ts`: fetches the live v0.6.0 `checksums.txt` from the GitHub Release and asserts **bidirectional equality** between `install.ps1`'s `$ArchiveBasenames` and the live release (every expected in live AND every live in expected, plus set-size equality). The test gracefully skips when offline (so local dev and air-gapped CI don't get a red build) and is opt-in-fail via the `UMACTUALLY_REQUIRE_LIVE_RELEASE=1` env var. Catches both directions of contract drift: install.ps1 expecting a target the release dropped (the v0.6.0 darwin-x64 bug) AND the release shipping a target install.ps1 doesn't know about.

### Notes

- The v0.6.1 binary differs from v0.6.0 only in the version string (0.6.0 → 0.6.1) baked in by `tsdown.config.ts:132`. No changes to the bundled CLI behavior or the install/upgrade/uninstall pipeline.

## [0.6.0] - 2026-07-21

### Added

- **Smart installer**: `scripts/install.sh` and `scripts/install.ps1` now check for Node 24+ on PATH at the very top, before any network work. If a recent Node is available, they run `npm install -g umactually` and exit cleanly. Otherwise they fall through to the existing single-file-binary download path. This ships ~330 KB via npm instead of ~30 MB via the binary for users with Node installed.
- **`npx umactually` and `bunx umactually` are first-class install paths.** The bin shim (`bin/umactually.mjs`) now reads the major from `process.versions.node ?? process.versions.bun` (Math.max fallback), so it accepts both runtimes.
- **Node SEA single-file binary via `tsdown --exe` (commit 1, 4, 6).** Replaces the Bun --compile pipeline. Built on `node --build-sea` (Node 25.5.0+, Joyee Cheung) which is the official path as of January 2026. The resulting binary bundles Node 25.7 and runs on any system without a pre-installed Node. Sizes:
  - linux-x64 / arm64: ~70 MB raw, ~28 MB gzipped
  - darwin-arm64: ~70 MB raw, ~28 MB gzipped
  - windows-x64 / arm64: ~72 MB raw, ~28 MB gzipped

  (`darwin-x64` is not produced — see [Removed] below.)

### Removed

- **`darwin-x64` (Intel macOS) dropped from the single-file binary distribution.** Node's `--build-sea` produces a binary that segfaults at launch on Intel macOS, 100% of the time — an upstream Node.js bug ([nodejs/node#62893](https://github.com/nodejs/node/issues/62893), [pnpm/pnpm#11423](https://github.com/pnpm/pnpm/issues/11423)). The Node team has officially excluded `darwin-x64` from the supported SEA platforms list; pnpm 11.0.5 dropped the same artifact for the same reason. The release-targets manifest goes from six to five rows (`linux-x64`, `linux-arm64`, `darwin-arm64`, `windows-x64`, `windows-arm64`); the `darwin-x64` macOS-Intel smoke job is removed from the release workflow; `scripts/install.sh` fails fast on Intel macOS with a pointer at the npm install path (`npm install -g umactually`); `EXPECTED_TARGET_COUNT` is now 5. Intel Mac users get the npm install path or build from source — see README § Install.

- **`scripts/build-binary.mjs`** — Bun --compile pipeline (replaced by `scripts/build-sea.mjs`).
- **`scripts/verify-release-assets.mjs`** (and `.d.ts`) — Bun-version-pinned size check.
- **`scripts/release-size-budget.json`** — Bun-calibrated budget. The new size check is per-target output presence + the smoke-sea CI job.
- **`test/unit/build-binary.test.ts`**, **`test/unit/release-budget.test.ts`**, **`test/unit/release-assets.test.ts`** — replaced by `test/unit/build-sea.test.ts` (commit 1).
- **`test/helpers/fake-bun-build.mjs`** — replaced by `fake-tsdown-build.mjs`.


### Stats

- Source code: +1,196 / −2,128 lines (net -932). 4 scripts deleted, 5 scripts modified, 1 new test helper, 3 new tests (`build-sea.test.ts`, `bin-shim-version-gate.test.ts`, `install-smart-router.test.ts`).
- Test counts: 1,566 → ~1,539 unit tests (net −27). The 4 new test files add 13 cases (5 build-sea skipped on Node < 25, 4 bin-shim, 4 install-router, ~1 win-PowerShell install-archives) but 40 cases are removed by deleting the 4 v0.5.x Bun-pipeline test files (`build-binary.test.ts` ~4, `release-budget.test.ts` ~17, `release-assets.test.ts` ~16, `release-workflow-layout.test.ts` ~3) whose coverage is replaced by `build-sea.test.ts` + the smoke-sea CI job.
- Binary size: 36 MB gzipped (Bun) → 28 MB gzipped (Node SEA) for the per-target archives. The npm package is 330 KB; the binary is the fallback for users without Node.
- Build matrix: 5 cross-compile lanes (linux x64/arm64, darwin arm64, windows x64/arm64) on `ubuntu-24.04` only. tsdown downloads the target Node binary from nodejs.org for cross-platform builds, so the matrix is `[ubuntu-24.04]` for build instead of `[ubuntu, macos, windows]`.
## [0.5.9] - 2026-07-21

### Added

- **Built-in `umactually uninstall` subcommand** (PR #102). Mirrors the `doctor` structure: `--remove-binary` (default) / `--no-remove-binary` / `--purge-config` / `--revert-path` / `--yes, -y` / `--json` / `--help, -h`. Emits one `UninstallCheck` per action (id ∈ `exec-path`, `binary-removal`, `config-removal`, `cache-removal`, `path-revert`, `self-deletion`) and exits `0` (success), `1` (user declined), or `2` (unsafe exec path or non-interactive destructive flag without `--yes`). Refuses to unlink symlinks, refuses if `process.execPath` is not on the allowlist, and on Windows schedules a delayed-delete helper (`%TEMP%\umactually-uninstall-<pid>-<ts>.cmd`) to work around the write-lock on a running binary. `umactually uninstall --purge-config` removes both `~/.umactually/` and `~/.cache/umactually/`. The pre-existing `scripts/uninstall.sh` is kept for back-compat.
- **`scripts/install.sh --ssl-no-revoke`** (PR #100). Windows Git Bash ships with a `curl` linked against `schannel`, which performs CRL/OCSP checks and frequently fails on offline revocation servers with `CRYPT_E_REVOCATION_OFFLINE (0x80092013)`. The installer now auto-detects `schannel` builds, prints a one-line hint pointing at `--ssl-no-revoke`, accepts `--ssl-no-revoke` as a positional argument, and reactively retries a failed `curl` with `--ssl-no-revoke` appended when the failure looks like a schannel revocation error. macOS and Linux are unaffected.

### Changed

- **README § Install** (PR #101). The Schannel workaround is now promoted above the first install example. Windows users with `CRYPT_E_REVOCATION_OFFLINE` see the fix before they try the one-liner.
- **PR self-review workflow** (PR #103). `continue-on-error: true` on the self-review step is replaced with explicit failure surfacing (the workflow now fails fast on a non-zero self-review exit) and the per-request timeout is raised to 240 seconds. This makes self-review visible as a real CI gate rather than a silent advisory, and accommodates the 4s+ retry backoff added to the Anthropic + OpenAI-compatible providers. The Anthropic + OpenAI-compatible providers now treat `timeout` as a retryable error class (`isRetryable` includes "timeout"), so a transient `AbortController` fire auto-retries once before surfacing.

### Stats

- Tests: 1502 → 1566 passing in the full unit suite (+64 from PR #102 alone: 6 new tests in `cli-uninstall.test.ts`; 2 in `anthropic-messages.test.ts` for ANTH-RED-007/008 retry-on-timeout). 121 platform-skipped tests are unchanged.
- Files: 10 changed / 2002 insertions / 17 deletions (PR #102 squash); 4 changed / 24 insertions (PR #103 squash); 1 changed (PR #101).

## [0.5.8] - 2026-07-21

### Fixed

- **Test suite fully green on Node 22 sandboxes** (PR #98). Three production scripts (`scripts/build-binary.mjs`, `scripts/package-release-assets.mjs`, `scripts/verify-release-assets.mjs`) import `scripts/release-targets.ts`, which uses Node 24's native `.ts` import. When the test suite ran on a host with Node < 24, every spawn failed with `ERR_UNKNOWN_FILE_EXTENSION` before any assertion could run. New `test/helpers/node-version-gate.ts` exports a shared `NODE_24_REQUIRED` constant; the affected `describe` blocks across 5 test files now `skipIf(NODE_24_REQUIRED)`. `test/unit/install-methods.test.ts` joins the same skip path (the installed binary enforces `engines.node >= 24` via `bin/umactually.mjs`). `ALLOW_NODE_22_SMOKE=1` overrides for debugging.
- **`runInstaller()` always sandboxes the install path** (test helper). `scripts/install.sh` switches to `/usr/local/bin` when running as root (the default in Docker / CI / sandboxes); without an explicit `INSTALL_DIR_OVERRIDE` the test assertions looking at `<fakeHome>/.local/bin/umactually` saw `ENOENT`. The helper now pins `INSTALL_DIR_OVERRIDE` to the sandbox path so the assertion target is honored. Tests passing `INSTALL_DIR_OVERRIDE` via `extraEnv` still win (extraEnv is merged last).

### Stats

- Before: 50 failed / 1518 passed / 55 skipped (1,623 total).
- After:  0 failed / 1502 passed / 121 skipped (1,623 total). All 121 skips have a documented reason (Node 24 requirement + override env var).

## [0.5.0] - 2026-07-17

### Added

- **Archive-based install pipeline**: the standalone-binary installer now downloads a `.tar.gz` (Linux/macOS) or `.zip` (Windows) archive from the release instead of the raw binary. The installer verifies the archive's SHA-256 against `checksums.txt`, validates the contract member name (`umactually-<id>` / `umactually-<id>.exe`) and the strict checksum grammar `^[0-9A-Fa-f]{64}  <basename>$`, extracts the single member to its final path, and atomically replaces the destination. Windows installer uses `System.IO.Compression.ZipArchive` (PowerShell 5.1+) and POSIX uses `tar -xzf` + `sha256sum`. Raw-binary download is preserved as a literal allowlist for `v0.2.1`, `v0.3.0`, `v0.4.0`, and `v0.4.1` only — archive-capable tags never fall back. See `scripts/install.sh`, `scripts/install.ps1`, `test/unit/install-archives-posix.test.ts`, `test/unit/install-archives-powershell.test.ts`.
- **Bun 1.3.14 pinned exactly**: `scripts/build-binary.mjs` pins the Bun compile target to `1.3.14` (no caret, no tilde) so every published binary carries the same runtime. Six leak-prone environment keys (`BUN_OPTIONS`, `BUN_CONFIG_VERBOSE_FETCH`, `BUN_CONFIG_MAX_HTTP_REQUESTS`, `BUN_CONFIG_NO_CLEAR_TERMINAL`, `BUN_CONFIG_REGISTRY`, `BUN_INSTALL`) are deleted from the spawn environment so a developer's local Bun config can't influence the published binary.
- **Size-budget enforcement**: `scripts/release-size-budget.json` declares the six accepted archive-size ceilings (one per manifest row, baseline `1.10x`, ceiling `52,428,800` bytes, ratio `0.50`). `verify-release-assets.mjs --enforce --budget …` is a hard gate in the build-package job; archives over budget fail the release before any smoke job runs. Pinned by `test/unit/release-budget.test.ts`.
- **11-job release workflow with native smoke gates + Git Bash delegation + bad-checksum preservation + immutable-tag post-publish canary** (`.github/workflows/release.yml`): `build-package` -> 5 native smoke lanes (`ubuntu-24.04`, `ubuntu-24.04-arm`, `macos-15-intel`, `macos-15`, `windows-2025`) -> Git Bash-to-PowerShell delegation (`install-posix` on `ubuntu-latest` exercising `install.sh`, `install-powershell` on `windows-latest` exercising `install.ps1`) -> Windows ARM64 structural PE machine-type + archive validation (non-runtime, `e_lfanew` + `Machine == 0xAA64`) -> bad-checksum preservation gate (publish keeps a draft if `checksums.txt` has any line outside the strict grammar) -> `publish` (least-privilege, downloads artifact by ID, recomputes SHA-256 against the producer's reported digest, three-step create-verify-draft-false) -> `canary` (`needs: publish`, runs `install.sh` against the immutable published tag, not the candidate bundle). Exactly six archives + `checksums.txt` per release — no raw public assets. Contract enforced by `test/unit/release-workflow-contract.test.ts` (16 rules) and `test/unit/windows-release-smoke.test.ts` (3 legacy smoke rules). Legacy surface (`windows-latest` + `ubuntu-latest`) is preserved for the user-facing install path.
- **Manifest as single source of truth** (`scripts/release-targets.json`): the six targets (`linux-x64`, `linux-arm64`, `darwin-x64`, `darwin-arm64`, `windows-x64`, `windows-arm64`) are declared once and consumed by the packager, the verifier, and the workflow contract. `parseReleaseTargets({ manifestPath })` is the typed runtime guard (Node 24 strips TS types from `.ts` imports); `test/unit/release-targets.test.ts` enforces schema + uniqueness + archive-name derivation. Contract test Rule 17 (`manifest-parity`) ensures the workflow's `gh release create` asset list and the workflow's `runs-on` labels stay in lock-step with the manifest.

## [0.4.1] - 2026-07-15

### Added

- **`docs/troubleshooting.md`** is a new single-topic doc that consolidates content previously duplicated across `docs/azure-devops.md` and `docs/gh-actions.md`. Auto-artifact validation, parse-fail triage (5-step procedure), concurrency + duplicate-runs behavior per platform, the `SYSTEM_ACCESSTOKEN` mapping requirement, and the interactive recovery-prompt gate (TTY + `UMACTUALLY_NO_INTERACTIVE` escape) now live in one place.

### Changed

- **`scripts/render-versions.mjs`** now walks `CONTRIBUTING.md` in addition to `README.md` and `docs/**/*.md`. A `vX.Y.Z` literal in any shipped markdown auto-migrates with the release; `CHANGELOG.md` is intentionally excluded because it IS the version history. Bundled docs surface shrinks from 1496 → 1158 lines (-22.6%) without losing information: YAML quickstarts in `README.md`/azure-devops.md/gh-actions.md now point at the canonical `examples/*` files; the 29-row env-var table in `README.md` is replaced by a link to `docs/configuration.md`; the provider-families + cross-protocol-dispatcher text in `docs/configuration.md` defers to the canonical `docs/providers.md`; the GitGuardian ops deep-dive moves from `docs/security.md` to a new `CONTRIBUTING.md § CI operational notes`.
- **`scripts/check-version-alignment.mjs`** tightened regex shared with the new `render-versions.mjs` literal-rewrite pass: URL path segments and filename extensions stay intact, suffixed `vX.Y.Z-{prerelease}` / `vX.Y.Z+{build}` literals are preserved (intentional historical context).
- **`docs/release-process.md` § 5 (Cut the tag)** gains a post-tag verification block: `git tag --points-at HEAD`, `gh release view vX.Y.Z --json name,assets`, and `curl -sLI .../releases/latest | grep ^location`. New § 8.4 covers recovery when a stale queued tag from a previous squash-merge rides along on `--follow-tags`. The 35-line HTML "review pass" comment block at the file's bottom (left over from the doc specialist's self-audit) was deleted.
- **`test/unit/readme-freshness.test.ts`** was rewritten to enforce README's `### GitHub Actions` and `### Azure DevOps` sections reference the right `examples/*` files (and that those example files are self-contained parseable workflows) — replacing the old assertion that README's embedded YAML matched the examples, which would have blocked the consolidation.
- **`CONTRIBUTING.md` § CI operational notes** gained the GitGuardian + `do-not-leak` sentinel documentation that previously lived in `docs/security.md`; the security model in `docs/security.md` stays focused on runtime security guarantees.

### Fixed

- **`docs/exit-codes.md`** had a broken `[README](#)` self-link replaced with concrete links to `README.md` and the new `docs/troubleshooting.md`.

## [0.4.0] - 2026-07-15

### Added

- **Auto-rendered version tokens across all shipped docs (PR #62).**

### Added

- No new changes yet.

## [0.4.0] - 2026-07-15

### Added

- **Auto-rendered version tokens across all shipped docs (PR #62).** The version
  pin used to be hardcoded in nine places across `README.md`,
  `docs/configuration.md`, `docs/azure-devops.md`, `docs/gh-actions.md`,
  `examples/azure/azure-pipelines.yml`, and `examples/github/pr-review.yml`;
  every release required a manual sweep and they drifted in practice (the
  v0.3.0 release shipped with `v0.2.1` still hardcoded in 22 spots). The
  hardcodes are now template tokens `{{UMACTUALLY_VERSION}}` (tag form)
  and `{{UMACTUALLY_VERSION_DOT}}` (bare form), and the new
  `scripts/render-versions.mjs` walks `README.md`, `docs/**/*.md`, and
  `examples/**/*.{yml,yaml,md}` to rewrite them from a single source of
  truth: `package.json` `version`. The script refuses to leave any
  `{{UMACTUALLY_*}}` token unreplaced (typos fail with exit 2), is fully
  idempotent, supports `--check` and `--dry-run` modes, and accepts
  `--package-root <dir>` for sandboxed runs.
- **`scripts/check-version-alignment.mjs` is a new release gate (PR #62).** It
  calls `render-versions.mjs --check` and additionally greps every shipped
  doc for any historical `vX.Y.Z` literal that does not equal
  `v<package.json version>`. Failing this gate exits 1 with a diff that
  names the offending file and the exact stray pin.
- **Canonical release-process runbook (PR #63).** `docs/release-process.md`
  is the one-stop maintainer reference for cutting a release: TL;DR,
  pre-release checklist, cut-the-tag commands, post-tag workflow behavior,
  ADO sync, recovery (bad tag, ci-validate failure, hotfix), and an
  inline SemVer decision guide.
- **`scripts/release.sh` pre-flight helper (PR #63).** Bumps `package.json`
  `version`, inserts a `[X.Y.Z] - YYYY-MM-DD` placeholder under
  `[Unreleased]` in `CHANGELOG.md`, runs `npm run render-docs`, runs
  `bash scripts/ci-validate.sh`, and prints the exact next-step commands.
  Does NOT auto-commit, auto-merge, auto-tag, or auto-push.

### Changed

- **`scripts/ci-validate.sh` grew two new gates** (now six total, PR #62):
  `npm run render-docs` (re-renders tokens against the current
  `package.json` `version`) and `npm run check:version-alignment`
  (drift detector). Both run after `npm run bundle` and before
  `npm run check:dist-freshness`. `package.json` `prepublishOnly` was
  updated in lock-step so `npm publish` enforces the same gates locally.
- **`CONTRIBUTING.md`** documents the new release-process section, the
  token contract, the release PR checklist, and the post-tag push
  workflow. The "Pre-PR validation" section's "four gates" wording was
  updated to "six gates" to match the canonical pipeline (PR #62). The
  Release process section was further trimmed to delegate to
  `docs/release-process.md` as the canonical reference (PR #63).
- **README.md** Documentation index adds `[Release process]` link
  (PR #63).
- **CHANGELOG.md** top-level note points at `docs/release-process.md`
  for the maintainer release workflow (PR #63).

### Fixed

- The on-disk README still claimed `Latest release: v0.2.1` after
  v0.3.0 was tagged (and the npx install fragment was the same). The
  re-render brought every reference up to `v0.3.0` in the same
  commit that landed the rendering tool. Future releases can't
  drift the same way.
- **Drift detector URL false positive (PR #63).**
  `check-version-alignment.mjs` previously flagged the literal
  `v2.0.0` substring inside `https://semver.org/spec/v2.0.0.html` as
  historical project drift. The regex now uses boundary anchors that
  exclude URL path segments, file extensions, and scheme separators,
  so only standalone version literals are matched.

## [0.3.0] - 2026-07-15

### Added

- **CLI graceful recovery with structured remediation hints (PR #60)**:
  every CLI-side error now surfaces an actionable "what to do next"
  hint alongside the bare message. Three layers were threaded:

  1. Typed `hint` field on every CLI-reachable error class
     (`CliUsageError`, `RequiredConfigError`, `LiveReviewError`).
     Parse-time throws for unknown flags now include a Levenshtein-
     based `did you mean` suggestion; `--event` without a value,
     `--foo abc` when `--foo` needs an integer, and the legacy
     `--ignore-minor` all carry explicit hints naming the
     replacement flag, expected shape, or escape-hatch env var.
  2. `validate.ts` is now structured — every error is a
     `{ flag, message, hint }` record (was a flat string list). The
     validator's nine error messages all carry hints naming the
     missing flag, the env var, and the docs URL. The CLI render
     glue preserves the legacy `cli: <msg>` first-line shape so CI
     log scrapers grep'ing for `cli: --api-url is required` keep
     working; new `hint:` lines render underneath.
  3. `ensureHttpOk` (the funnel for every GitHub / Azure 4xx / 5xx)
     grows an optional remediation hint. All 7 call sites in
     `live-github.ts` (3) and `live-azure.ts` (4) pass a platform-
     specific hint naming the missing scope, the right token, the
     docs URL, or the exact `--flag` to re-run with. The
     orchestrator's generic dispatchLivePlatform catch narrows on
     `LiveReviewError` / `RequiredConfigError` / `AzureContextError`
     / `GithubContextError` and surfaces the hint on a second line
     next to the failure.

  Plus an interactive recovery mode: when validation fails ONLY
  because `--api-url` / `--api-key` is missing AND the process is
  attached to a TTY (NOT CI / piped stdin), the CLI asks for those
  values instead of failing. CI is never asked — `canPromptInteractively`
  gates the branch and a `UMACTUALLY_NO_INTERACTIVE` escape hatch
  lets operators force-off. `SmartPromptUnavailable` is a typed
  boundary (`NO_TTY` / `TIMEOUT` / `CLOSED_STDIN` / `READ_ERROR`)
  so the validate-glue renders a structured remediation when a
  prompt cannot be answered.

  Standalone-run now prints the no-diff reason next to the artifact
  path so the operator can see why the CLI wrote a stub without
  having to `cat` the JSON; the `provider-error` result carries a
  `hint` field so the standalone CLI's "exited 1, here is what
  happened" message carries the same remediation the live CI
  delivers.

### Fixed

- **Smart-prompt timeout race + listener-attachment race (PR #60 follow-up)**:
  the original smart-prompt timer called `stdin.destroy(error)` to
  abort the read, but Node's read-stream destroy-with-error only
  surfaces via the `error` event if a read is mid-flight — on a
  paused TTY it never fires, so the read promise hung until the
  operator pressed Enter (the typed `TIMEOUT` code was unreachable
  in practice). Replaced with `Promise.race([readOneLine, timeoutPromise])`,
  the canonical "Promise that should timeout" pattern. Also fixed
  a listener-attachment race in `readOneLine`: the original code
  registered `data` / `end` / `error` listeners AFTER calling
  `stream.resume()`, so a fast EOF (CI with a closed pipe) had
  the synchronous `end` event fire before listeners were bound,
  hanging the Promise forever. Listeners are now attached before
  `resume()`.

## [0.2.1] - 2026-07-15

### Fixed

- **CLI help rendered one character per line (PR #57)**: the contextual
  help feature in v0.2.0 was broken at the bundled-CLI layer. The
  spread `...renderFlags(flagsForContext("review"))` was spreading a
  joined string into an array literal, so each character of a flag line
  became its own array element and the outer `.join("\n")` emitted
  every character on its own line. Affected every per-command help:
  `umactually review --help`, `umactually doctor --help`, and
  `umactually check-review-artifact --help`. The bare
  `umactually --help` was unaffected because it uses a different code
  path (`HELP_FLAGS.map(renderFlagLine)`). Fixed by returning an array
  from `renderFlags` instead of a pre-joined string; added structural
  regression tests that pin each `--flag` to a single line.

## [0.2.0] - 2026-07-15

### Added

- **Contextual per-command CLI help (PR #55)**: `--help` now produces
  output scoped to the subcommand instead of always dumping the same
  40+ flag wall. `umactually review --help` shows review-specific usage
  and flags; `umactually doctor --help` shows the doctor checks list
  and exit codes; `umactually check-review-artifact --help` shows the
  artifact validation usage. The bare `umactually --help` retains the
  top-level Commands banner plus all review flags. Flags are tagged
  with `appliesTo` contexts so each help section shows only the flags
  relevant to that command.

- **Default repository prompt auto-discovery**: UmActually now
  auto-loads common agent-instruction files from the repository root
  when no explicit prompt override is supplied. The default-lookup
  list (in order) is `CLAUDE.md`, `AGENTS.md`,
  `.github/copilot-instructions.md`, `.cursorrules`, and `GEMINI.md`.
  Files that do not exist are silently skipped, so repos that lack
  any of these fall through cleanly to the existing built-in default
  system prompt. The lookup runs against the workflow
  `working-directory` and is subject to the existing path-safety
  refusals (absolute paths, `..` traversal, symlink escape).
- **`prompt-files` and `additional-prompt-files` inputs** (CLI flags
  `--prompt-files` / `--additional-prompt-files`; env vars
  `UMACTUALLY_PROMPT_FILES` / `UMACTUALLY_ADDITIONAL_PROMPT_FILES`):
  comma/newline-separated lists of repository-relative paths. When
  non-empty, the list **completely overrides** the default-lookup
  list and the legacy single-path `prompt-file` /
  `additional-prompt-file` input. Files are concatenated in the
  listed order with the existing `\n\n---\n\n` separator. Same
  cwd-confinement + byte-cap security as the legacy single-file
  reader. **Both inputs are wired through end-to-end on every
  supported surface**: GitHub Actions `with:` block, the
  `UMACTUALLY_PROMPT_FILES` / `UMACTUALLY_ADDITIONAL_PROMPT_FILES`
  pipeline variables in the root `azure-pipelines.yml` (and the
  `examples/azure/azure-pipelines.yml` example), and the bundled
  CLI's `--prompt-files` / `--additional-prompt-files` flags. The
  Azure DevOps pipeline conditionally forwards the env vars to the
  CLI so an unset value produces a clean argv (no empty
  `--prompt-files ""` flag). See
  [docs/azure-devops.md#forwarding-prompt-file-lists-overrides-the-default-lookup-list](docs/azure-devops.md#forwarding-prompt-file-lists-overrides-the-default-lookup-list).
- **CLI-first coverage for `strict-schema` and `verify-findings`**:
  both CLI flags are now exposed as GitHub Actions inputs
  (`strict-schema`, `verify-findings`; underscore-key synonyms
  `strict_schema`, `verify_findings` for runners that need them)
  and as Azure DevOps pipeline variables
  (`UMACTUALLY_STRICT_SCHEMA`, `UMACTUALLY_VERIFY_FINDINGS`). The
  action emits the negation form (`--no-strict-schema` /
  `--no-verify-findings`) when the workflow sets the input to
  `false`, and the positive form when set to `true` (matching
  the existing `--detect-leaks` / `--no-detect-leaks` pattern).
  The Azure DevOps pipeline conditionally forwards the env vars
  to the CLI. This closes the last two CLI flags that were
  previously action-invisible — the CLI is now the canonical
  surface for ALL functionality, and the action + ADO surfaces
  are thin pass-through wrappers. Pinned by
  `test/unit/cli-first-contract.test.ts`.

- **Native Anthropic Messages API provider (PR #31)**: third
  provider family alongside `openai-compatible` and `copilot`. Wire
  shape is the Anthropic Messages schema (`POST /v1/messages`,
  `x-api-key` + `anthropic-version: 2023-06-01`, top-level `system`,
  user-only `messages[]`, `max_tokens` instead of `max_output_tokens`).
  URL resolver follows the `@anthropic-ai/sdk` convention — preserves
  the operator's path prefix — so Anthropic-protocol gateways mounted
  under arbitrary prefixes route correctly. The `--provider anthropic`
  default base URL is `https://api.anthropic.com/v1`; `api-url` is
  optional for this provider (override for self-hosted Anthropic-protocol
  gateways like MiniMax).
- **URL-aware defaults in `parseFallbackModels` (PR #29)**: the
  `model: "auto"` resolver picks the right per-provider model from the
  hostname pattern. `gpt-5-mini` for `openai-compatible`, `claude-sonnet-4.6`
  for Anthropic endpoints, `claude-3-5-sonnet` for Copilot (4.6 is not
  Copilot-routable), `gemini-2.5-flash` for Google, `MiniMax-M3` for
  MiniMax. Per the Vectara HHEM 2026-05-11 leaderboard.
- **Cross-protocol auto-discovery on dual-protocol gateways (PR #32)**:
  the dispatcher transparently retries the OTHER provider family at the
  same `UMACTUALLY_API_URL` when the named provider returns a routing-level
  rejection (404). Documented use case: [MiniMax](https://platform.minimax.io/docs/token-plan/claude-code)
  serves both Anthropic-protocol (`/anthropic/v1/messages`) and
  OpenAI-protocol (`/v1/responses`) under the same hostname with the same
  API key. Operators no longer have to guess which protocol lives under
  which path prefix — `--provider` becomes advisory. Fallback is strictly
  bounded to 404 (payload 400 / parse / auth / network errors do NOT
  trigger fallback — those have a single root cause). See
  [`docs/providers.md`](docs/providers.md#cross-protocol-auto-discovery-the-dispatcher).
- **Path-prefix heuristic for `/anthropic` URLs (PR #34)**: the cross-
  protocol fallback in PR #32 only fires AFTER the named provider's URL
  candidate loop exhausts. On MiniMax-style dual-protocol gateways the
  openai-compatible loop successfully degrades `/anthropic` to
  origin+`/v1` (where MiniMax also serves OpenAI), so the dispatcher
  never reached the fallback and silently routed an
  `UMACTUALLY_API_URL=https://api.minimax.io/anthropic` to OpenAI at
  `/v1/responses` — wrong protocol. Fix: a new heuristic in the
  dispatcher checks whether any path segment in the operator's URL
  exactly equals `anthropic` (case-insensitive, byte-for-byte). When
  true, the dispatcher commits to the Anthropic Messages API client
  regardless of `--provider`, with a `::notice::` annotation for
  operator audit. Conservative by design — false negatives still fall
  through to cross-protocol fallback; false positives are bounded to
  exact-segment matches so `anthropic-v2` and `my-anthropic` do NOT
  trigger. See
  [`docs/providers.md`](docs/providers.md#path-prefix-heuristic-the-anthropic-url-commits-to-the-anthropic-protocol).
- **New `docs/providers.md`**: canonical end-to-end reference for the
  provider layer — per-family URL resolution rules, the
  Anthropic-protocol path-prefix preservation contract (with the
  `@anthropic-ai/sdk` / `anthropic-sdk-kotlin` references), the
  cross-protocol dispatcher decision tree, the dual-protocol gateway
  matrix (MiniMax, LiteLLM, Portkey patterns), and model
  auto-resolution per hostname. The page a fresh dev reads first when
  touching anything in `src/util/url.ts` or
  `src/cli/live-provider.ts`.

### Changed

- **Anthropic URL helper now preserves operator path prefixes
  (PR #32)**: the previous `resolveProviderBaseUrl(baseUrl, "/v1")`
  stripped the operator's path and always substituted `/v1`, which
  silently 404'd MiniMax-style Anthropic-protocol gateways under path
  prefixes. The new `resolveAnthropicMessagesUrl(baseUrl)` in
  `src/util/url.ts` appends `/v1/messages` per the official
  `@anthropic-ai/sdk` convention without stripping the operator's
  path. Query string and fragment are now stripped before appending
  (prevents `.../v1?token=abc/v1/messages`-style URL malformation).
- **`redactUrlForLog` helper (PR #32)**: strips query string and
  fragment from URLs before they enter `::notice::` action annotations
  (which persist in GitHub Actions run logs). Three log sites in
  `src/provider/openai-compatible.ts` and two in
  `src/cli/live-provider.ts` route through the helper. Pinned by
  `test/unit/redact-url-for-log.test.ts`. Operators who accidentally
  (or maliciously) type a URL with a `?token=` parameter no longer
  leak the token into the persisted CI annotation log.
- **LLM citation grounding (PR #26)**: layered defense against LLM
  path/line fabrication. Five layers, each closing a different
  failure mode observed in PR #56 (a 122-line source-only diff that
  produced 8 dist/-fabrication findings on the ADO policy review):
  1. **Diff filter** — `src/diff/filter-build-artifacts.ts` strips
     `dist/`, `build/`, `node_modules/`, lockfiles, `*.min.js`,
     `*.map`, etc. on BOTH the GitHub REST-diff path and the
     Azure REST-reconstruction path. Centralizes what was a
     shell-side `':!dist'` on Azure only.
  2. **System-prompt rewrite** — `src/cli/provider-prompts.ts` now
     documents the strict JSON schema, the diff path enum, the
     quote-first workflow (Anthropic pattern: copy the diff lines
     that justify a finding BEFORE emitting it), and the positive
     constraint (cite only what's in the Files-in-diff list).
  3. **Wire-format `response_format: json_schema`** — the strict
     schema is sent on the wire to providers that support it.
     `--strict-schema` (default ON) / `--no-strict-schema`.
  4. **Parse-warnings artifact** — every off-diff or off-line
     finding the model emitted is now recorded in
     `artifacts/manual/*.parse-warnings.json` (sibling to the
     main review artifact). Pinned by a regression test
     (`test/unit/parse-warnings.test.ts`) that locks the exact
     8-fabrication count from PR #56.
  5. **Model auto-resolver** — `model: "auto"` no longer passes
     through verbatim. Resolves to `gpt-5-mini` (OpenAI),
     `claude-sonnet-4.6` (Anthropic), `claude-3-5-sonnet`
     (Copilot — the 4.6 string is NOT Copilot-routable and
     would 404, so Copilot uses the 3.5 Sonnet line), or
     `gemini-2.5-flash` (Google) based on the active provider +
     `UMACTUALLY_API_URL`. Per the Vectara HHEM 2026-05-11
     leaderboard, these models have HHEM 5-11% vs the
     9-23% of gpt-4o/o3/o4-mini that the prior default fell back to.
  6. **Deterministic verify-findings filter** — defense-in-depth
     re-runs the (path, line) filter on the model's `comments[]`
     before posting. Default ON. `--verify-findings` /
     `--no-verify-findings`. Critically, the parse-warnings
     artifact is built from the PRE-verify review so it captures
     every fabrication event (the inline filter is a defense
     in depth, not a replacement for the artifact).
- New CLI flags: `--strict-schema`, `--no-strict-schema`,
  `--verify-findings`, `--no-verify-findings`. Both default to
  ON. Both are no-ops when the provider doesn't support
  `response_format: json_schema`.

### Removed

- **BREAKING**: `action.yml` `outputs:` block removed. The
  declaration named 7 outputs (`marker`, `marker_text`,
  `inline_thread_count`, `suppressed_comment_count`, `artifact_path`,
  `posted_thread_count`, `posted_status_state`) that the runtime
  never wrote (zero `core.setOutput` / `GITHUB_OUTPUT` /
  `::set-output` calls anywhere in `src/`). Any downstream consumer
  using `steps.<id>.outputs.<name>` was silently getting empty
  strings; the CI guard at `scripts/check-self-review-output.mjs`
  reads the on-disk JSON artifact directly instead. The `outputs:`
  block was removed so the action schema no longer advertises a
  contract it does not implement. Consumers that need structured
  review metadata should read the JSON artifact written to
  `artifacts/manual/` (path configurable via `--output-artifact`).
- **BREAKING**: `ignore-minor` input removed.
  The `ignore-minor` action input, CLI flag, and `UMACTUALLY_IGNORE_MINOR` /
  `REVIEW_IGNORE_MINOR` env vars have been removed. Use `minimum-severity`
  (`low|medium|high`, default `medium`) instead — it covers the same
  "suppress minor findings" use case with finer control. The previous
  guarantee that `security` and `leak` findings are never suppressed now
  lives inside `minimum-severity`'s semantics and applies regardless of
  the configured threshold.
  - CLI: `--ignore-minor` / `--no-ignore-minor` throw `CliUsageError`
    with a migration message — fail loudly is intentional so explicit
    CLI callers can't silently miss the change.
  - Env vars: silently ignored. CI users who still have
    `UMACTUALLY_IGNORE_MINOR` / `REVIEW_IGNORE_MINOR` set will see a
    one-time stderr warning on the next run pointing them at
    `minimum-severity`. The asymmetry with the CLI is deliberate: env
    vars are inherited invisibly and a hard throw on every run would
    brick pipelines that simply forgot to clean up.
  - Action users who were on the previous defaults
    (`ignore-minor: false`, `minimum-severity: low`) will lose
    `info` findings that were previously posted inline; that
    matches the new `minimum-severity: medium` default. Set
    `minimum-severity: low` explicitly to keep the old
    "show everything" behavior.
  - Pipelines that were passing `ignore-minor: true` need to recreate
    their previous filter combination on top of `minimum-severity`,
    NOT just rely on the new default. The two knobs were layered
    (`ignoreMinor` filtered info+low; `minimum-severity` filtered
    everything below the configured tier), so the equivalent new
    setting depends on what previous `minimum-severity` tier you
    were filtering at. Migration examples:
    - `ignore-minor: true` + previous `minimum-severity: low` (the
      old default) → `minimum-severity: medium` (the new default).
      The previous effective filter dropped info+low, and the new
      default does the same.
    - `ignore-minor: true` + previous `minimum-severity: medium`
      → `minimum-severity: medium` (the new default). No change
      needed.
    - `ignore-minor: true` + previous `minimum-severity: high`
      → `minimum-severity: high` (NOT the new default).
    - `ignore-minor: false` (the prior default) + previous
      `minimum-severity: low` (the prior default) → accept the
      new default of `medium` to filter style/hygiene, or set
      `minimum-severity: low` explicitly to keep all findings.
    - `ignore-minor: false` + previous `minimum-severity: high`
      → `minimum-severity: high` (no change needed).
- **BREAKING**: `minimum-severity` default flipped from `low` to `medium`.
  Out of the box, low-severity findings (style, hygiene) are filtered
  out of the postable set and do not appear as inline comments. Set
  `minimum-severity: low` explicitly to keep them.
- Severity-table layout headline now leads with the **posted comment
  count** (e.g. `📊 24 inline findings`) rather than the model's gross
  output. Off-diff findings are surfaced as a separate callout
  (`> 🔍 4 off-diff findings not posted inline — the model produced
  them but they target files not in this PR's diff.`) instead of
  appearing as a "28 findings → 24 posted" math breakdown. The
  manifest still carries `inlineCount` and `suppressedCount`
  separately for downstream consumers.

## [0.1.0] - 2026-06-27

### Added

- Initial release of the UmActually PR review action for GitHub Actions and Azure DevOps.
- Bundled CLI (`bin/umactually.mjs`) that delegates to `dist/cli.js` (built with `@vercel/ncc`).
- `UMACTUALLY_*` environment variable surface for `API_URL`, `API_KEY`, `MODEL`, `PROMPT_FILE`, `ADDITIONAL_PROMPT_FILE`, `REVIEW_TIMEOUT_SECONDS`, `STALL_SECONDS`, `MAX_OUTPUT_TOKENS`, `SONAR_HOST_URL`, `SONAR_TOKEN`, `SONAR_PROJECT_KEY`, `INCLUDE_SONARQUBE`, `IGNORE_MINOR`, `DETECT_LEAKS`, with `REVIEW_*` retained as a backward-compatible fallback.
- `--detect-leaks` / `--no-detect-leaks` and `--include-sonarqube` CLI flags driving the S5 redaction report and the S6 SonarQube mocked report.
- Live redaction scan in `runReview` and `runAzureReview` so secret leaks always block raw output before posting.
- `LICENSE` (MIT), `CHANGELOG.md`, `.nvmrc` (24), `examples/github/pr-review.yml`, and `examples/azure/azure-pipelines.yml`.
- CI smoke step that exercises the bundled CLI against the S1/S4 fixtures.
- `npm run bundle` and `npm run check:dist-freshness` scripts.

### Changed

- `src/index.ts` now wires every action input through to the CLI instead of always forcing `--dry-run`.
- `bin/umactually.mjs` no longer falls back to `src/cli.ts`; it errors with exit code 127 when `dist/cli.js` is missing.
- `docs/configuration.md` and `README.md` document the canonical `UMACTUALLY_*` secrets, the updated defaults (`max-output-tokens=16000`, `ignore-minor=false`), and the `--no-detect-leaks` flag.
- `src/reference/verify-reference-regressions.ts` performs real input checks against fixture contents rather than tautological self-contains.
