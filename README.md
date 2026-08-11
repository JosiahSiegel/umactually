# umactually

A Node.js 24 CLI for auditable, policy-aware pull-request review. It posts validated inline findings to GitHub (including documented GHES support) and Azure DevOps through an operator-selected OpenAI-compatible, Anthropic, or Copilot provider.

[![GitHub release](https://img.shields.io/github/v/release/JosiahSiegel/umactually)](https://github.com/JosiahSiegel/umactually/releases/tag/v0.8.0)
[![npm](https://img.shields.io/npm/v/umactually)](https://www.npmjs.com/package/umactually)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=24](https://img.shields.io/badge/node-%3E%3D24-339933.svg)](https://nodejs.org/)

Latest release: **[v0.8.0](https://github.com/JosiahSiegel/umactually/releases/tag/v0.8.0)** — see [all releases](https://github.com/JosiahSiegel/umactually/releases).
## Quickstart

Use `umactually init` as the single current-version first-run path after installing the CLI. The wizard writes non-secret choices to `~/.umactually/config.json` (mode `0o600`); every later `umactually review` reads them. Per-flag reference: [`docs/configuration.md`](docs/configuration.md). Exit codes: [`docs/exit-codes.md`](docs/exit-codes.md#umactually-init-exit-codes).

1. **Run the wizard** — interactive on a TTY, non-interactive in CI.

   ```bash
   umactually init
   ```

2. **Pick a provider family** — one of `openai-compatible`, `anthropic`, or `copilot`. The wizard prompts per branch (e.g. `api-url` + `api-key` + `model` for OpenAI-compatible; `api-key` + `model` for Anthropic; `github-api-base` + `model` for Copilot — no `api-key`, the wizard points you at `GITHUB_TOKEN`). Stash the API credential in your platform secret store: GitHub Actions → Settings → Secrets → `UMACTUALLY_API_KEY`; Azure DevOps → Pipelines → Library → Variable group → `UMACTUALLY_API_KEY` (secret); local shell → `export UMACTUALLY_API_KEY="$KEY"`. The wizard never persists the key to disk.

3. **Run a review** — `umactually review` posts inline PR comments. You're ready.

   ```bash
   umactually review
   ```

## Install

Full comparison at [`docs/distribution-architecture.md`](docs/distribution-architecture.md).

```bash
npm install -g umactually
```

```bash
npx umactually review …
bunx umactually review …
```

Platform support: macOS/Linux/Windows on `arm64` and `x64` (`darwin-x64` is npm-only because `node --build-sea` segfaults there — see [nodejs/node#62893](https://github.com/nodejs/node/issues/62893)). Verify after install with `umactually --version`.

## Common operations

| Command | What it does |
| --- | --- |
| `umactually init` | Guided setup wizard (interactive or `--non-interactive`) |
| `umactually review` | Run PR review (default) |
| `umactually doctor` | Check the environment is ready |
| `umactually tui` | Launch the interactive terminal UI |
| `umactually check-review-artifact` | Validate a review artifact (CI artifact gate) |
| `umactually uninstall` | Remove the binary, config, cache, and PATH entry |

Inspect what the loader actually resolved at runtime:

```bash
umactually --show-config
```

Read-only; never opens a network connection; prints the resolved `provider`, `apiUrl?`, `model?`, and the path the loader used. Per-action exit-code contract at [`docs/exit-codes.md`](docs/exit-codes.md).

## Provider

| Family | Setup wizard prompts |
| --- | --- |
| `openai-compatible` | `api-url` (default `https://api.openai.com/v1`), `api-key` (NEVER persisted), `model` (optional) |
| `anthropic` | `api-key` (NEVER persisted), `model` (optional) |
| `copilot` | `github-api-base` (default `https://api.github.com`), `model` (optional); no `api-key` — wizard points at `GITHUB_TOKEN` |

Full per-family wire shape and the cross-protocol dispatcher at [`docs/providers.md`](docs/providers.md#setup-wizard).

## CI

CI must use Node.js 24 and a version-pinned install. Pin to [`v0.8.0`](https://github.com/JosiahSiegel/umactually/releases/tag/v0.8.0) — never track `main`.

### GitHub Actions

Canonical workflow at [`examples/github/pr-review.yml`](examples/github/pr-review.yml). Setup details at [`docs/gh-actions.md`](docs/gh-actions.md).

### Azure DevOps

Canonical pipeline at [`examples/azure/azure-pipelines.yml`](examples/azure/azure-pipelines.yml). Setup details at [`docs/azure-devops.md`](docs/azure-devops.md).

## Verify

```bash
umactually doctor
```

## Uninstall

```bash
umactually uninstall --yes              # remove binary, config, cache, PATH entry
umactually uninstall --purge-config     # also remove ~/.umactually/ and ~/.cache/umactually/
```

## Documentation

| User | Platform | Operator | Maintainers |
| --- | --- | --- | --- |
| `docs/configuration.md` | `docs/gh-actions.md` | `docs/providers.md` | [`docs/release-process.md`](docs/release-process.md) |
| `docs/troubleshooting.md` | `docs/azure-devops.md` | `docs/security.md` | CHANGELOG.md |
| — | — | `docs/exit-codes.md` | CONTRIBUTING.md |
| — | — | `docs/distribution-architecture.md` | — |

Benchmark methodology and results, including the schema-versioned artifact contract and exact reproduction command, are in [`docs/benchmark.md`](docs/benchmark.md). Architecture, context/policy provenance, incremental behavior, suggestions, local metrics/privacy, `doctor`, TUI, limitations, and rollback are in [`docs/architecture.md`](docs/architecture.md). Security reporting is in [`SECURITY.md`](SECURITY.md) and the detailed trust model in [`docs/security.md`](docs/security.md); contributor operations are in [`CONTRIBUTING.md`](CONTRIBUTING.md). Deferred—not shipped—surfaces are a hosted control plane, GitLab, Bitbucket, opaque learning, and auto-commit behavior.

## License

[MIT](LICENSE).
