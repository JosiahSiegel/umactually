# Changelog

All notable changes to UmActually are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

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
  - Action users on the previous default (`ignore-minor: false`) will
    lose `info` findings that were previously posted inline; that
    matches the new `minimum-severity: medium` default.
  - Pipelines that were passing `ignore-minor: true` should migrate to
    `minimum-severity: medium` (the new default) to preserve the same
    behavior.
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
- Bundled CLI (`bin/umactually-pr-review.mjs`) that delegates to `dist/cli.js` (built with `@vercel/ncc`).
- `UMACTUALLY_*` environment variable surface for `API_URL`, `API_KEY`, `MODEL`, `PROMPT_FILE`, `ADDITIONAL_PROMPT_FILE`, `REVIEW_TIMEOUT_SECONDS`, `STALL_SECONDS`, `MAX_OUTPUT_TOKENS`, `SONAR_HOST_URL`, `SONAR_TOKEN`, `SONAR_PROJECT_KEY`, `INCLUDE_SONARQUBE`, `IGNORE_MINOR`, `DETECT_LEAKS`, with `REVIEW_*` retained as a backward-compatible fallback.
- `--detect-leaks` / `--no-detect-leaks` and `--include-sonarqube` CLI flags driving the S5 redaction report and the S6 SonarQube mocked report.
- Live redaction scan in `runReview` and `runAzureReview` so secret leaks always block raw output before posting.
- `LICENSE` (MIT), `CHANGELOG.md`, `.nvmrc` (24), `examples/github/pr-review.yml`, and `examples/azure/azure-pipelines.yml`.
- CI smoke step that exercises the bundled CLI against the S1/S4 fixtures.
- `npm run bundle` and `npm run check:dist-freshness` scripts.

### Changed

- `src/index.ts` now wires every action input through to the CLI instead of always forcing `--dry-run`.
- `bin/umactually-pr-review.mjs` no longer falls back to `src/cli.ts`; it errors with exit code 127 when `dist/cli.js` is missing.
- `docs/configuration.md` and `README.md` document the canonical `UMACTUALLY_*` secrets, the updated defaults (`max-output-tokens=16000`, `ignore-minor=false`), and the `--no-detect-leaks` flag.
- `src/reference/verify-reference-regressions.ts` performs real input checks against fixture contents rather than tautological self-contains.