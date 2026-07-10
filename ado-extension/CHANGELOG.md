# Changelog

All notable changes to the UmActually Azure DevOps Marketplace
extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial extension scaffold (vss-extension.json + ReviewTask).
- Build/Release task that wraps the UmActually CLI for Azure Pipelines
  PR validation builds.
- 16 task inputs covering the most-used CLI flags plus pipeline-attach
  fields with no CLI equivalent.
- 3 output variables (`UMACTUALLY_REVIEWED`, `UMACTUALLY_FINDING_COUNT`,
  `UMACTUALLY_SEVERITY_HIGH_COUNT`) for downstream steps.
- 4 task-result categories (Succeeded, ReviewTimeout, ReviewFailed,
  TaskError) with distinct messages and log markers.
- `scripts/package-extension.sh` for build + .vsix + share + publish.
- Comprehensive README + overview + license-terms + per-task README
  + icon-placeholder instructions.

### IN DEVELOPMENT
- **Not yet sideloaded** into a real ADO organization. The pre-publish
  checklist in `README.md` is the authoritative source for what's
  needed before publishing to the public Marketplace.
- **Icons are placeholders.** `images/extension-icon.png` (128×128)
  and `ReviewTask/icon.png` (32×32) need real artwork before
  sideloading.
- **Publisher ID is `REPLACE_WITH_PUBLISHER_ID`** until a real
  Marketplace publisher is registered.
- **Task GUID is `REPLACE_WITH_GENERATED_GUID`** until a fresh UUID
  is generated. The build script generates one automatically if
  `uuidgen` or `python` is on PATH.

## [0.1.0-dev] — 2026-07-10

Initial scaffold. See the git log for the full history.

[Unreleased]: https://github.com/JosiahSiegel/umactually/compare/ado-main-with-github-main15...HEAD
[0.1.0-dev]: https://github.com/JosiahSiegel/umactually/tree/ado-main-with-github-main15
