# Changelog

All notable changes to UmActually are documented in this file. The format is
based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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