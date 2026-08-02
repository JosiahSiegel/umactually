# umactually

AI-powered PR review that posts inline comments to your pull requests. Works with any model provider (OpenAI, Anthropic, GitHub Copilot) and both GitHub and Azure DevOps.

[![npm](https://img.shields.io/npm/v/umactually)](https://www.npmjs.com/package/umactually)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=24](https://img.shields.io/badge/node-%3E%3D24-339933.svg)](https://nodejs.org/)

Latest release: **[v0.6.22](https://github.com/JosiahSiegel/umactually/releases/tag/v0.6.22)** — see [all releases](https://github.com/JosiahSiegel/umactually/releases).

## Installation

```bash
# Node 24+ or Bun 1.2+
npm install -g umactually

# or one-shot, no install
npx umactually review --api-url https://api.openai.com/v1 --api-key "$OPENAI_API_KEY"
```

Other install paths (curl-pipe installer, single-file Node SEA binary, Windows PowerShell) live in [`docs/distribution-architecture.md`](docs/distribution-architecture.md).

## Quickstart

Run from any git working tree with a diff staged or committed. The CLI auto-detects the platform from environment variables (`GITHUB_ACTIONS`, `TF_BUILD`) and posts review comments to the PR.

```bash
# 1. Configure your provider (writes ~/.umactually/config.json — dry-run by default)
umactually init --provider openai --apply

# 2. Verify the environment is ready
umactually doctor --json | jq -e '.ok'

# 3. Review the local diff without posting
umactually review --dry-run --json | jq -e '.ok'

# 4. Post a review to the PR
umactually review --json | jq -e '.ok'
```

In CI the CLI auto-detects the platform and posts the review directly to the PR — no flag required. Copy the canonical workflows into your pipeline rather than re-deriving them:

### GitHub Actions

See [`examples/github/pr-review.yml`](examples/github/pr-review.yml) and the [setup guide](docs/gh-actions.md).

### Azure DevOps

See [`examples/azure/azure-pipelines.yml`](examples/azure/azure-pipelines.yml) and the [setup guide](docs/azure-devops.md).

## Commands

```text
umactually review                     Run PR review (default)
umactually doctor                     Check environment is ready
umactually verify <path>              Validate a review artifact (alias: check-review-artifact)
umactually init --provider <name>     Scaffold ~/.umactually/config.json
umactually uninstall                  Remove the binary, config, cache, and PATH entry
umactually --version                  Print version
umactually --help                     Show this help
```

Every command supports `--json` for machine-readable output. Exit codes: `0=ok`, `1=provider-error`, `2=usage-error`, `3=parse-fail`, `4=auth-required`, `127=bundle-missing`. See [`docs/exit-codes.md`](docs/exit-codes.md) for the per-action contract.

## Documentation

- [Configuration reference](docs/configuration.md) — every CLI flag, every env var, every precedence rule
- [Provider setup](docs/providers.md) — the per-family wire shape and the cross-protocol dispatcher
- [Distribution architecture](docs/distribution-architecture.md) — npm, curl-pipe, Node SEA binary, OIDC publish
- [GitHub Actions guide](docs/gh-actions.md)
- [Azure DevOps guide](docs/azure-devops.md)
- [Troubleshooting](docs/troubleshooting.md) — parse-fail triage, auto-artifact validation, concurrency notes
- [Security & redaction](docs/security.md)
- [Exit codes](docs/exit-codes.md)
- [Release process](docs/release-process.md) — for maintainers cutting a release
- [Sample review artifact](docs/samples/review-artifact.json)
- [CHANGELOG](CHANGELOG.md)

## Security and trust

The runtime treats PR title, body, comments, diff lines, and `prompt-file` contents as **untrusted**, and the operator-supplied secrets / `GITHUB_TOKEN` / `SYSTEM_ACCESSTOKEN` as **trusted**. `security` and `leak` findings bypass every `minimum-severity` threshold and cannot be turned off — to suppress them you must remove them at the source. See [`docs/security.md`](docs/security.md).

To report a security issue, open a private security advisory (see the link at the bottom of [`docs/security.md`](docs/security.md#reporting-issues)).

## Contributing

PRs welcome. Run the test suite before opening a PR:

```bash
npm install
npm run typecheck
npm test
```

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the release process, code style, and review workflow.

## License

[MIT](LICENSE).
