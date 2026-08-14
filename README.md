# umactually

A Node.js 24 CLI for auditable, policy-aware pull-request review. It posts validated inline findings to GitHub (including documented GHES support) and Azure DevOps through an operator-selected OpenAI-compatible, Anthropic, or Copilot provider.

[![GitHub release](https://img.shields.io/github/v/release/JosiahSiegel/umactually)](https://github.com/JosiahSiegel/umactually/releases/tag/v0.9.3)
[![npm](https://img.shields.io/npm/v/umactually)](https://www.npmjs.com/package/umactually)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=24](https://img.shields.io/badge/node-%3E%3D24-339933.svg)](https://nodejs.org/)
Latest release: **[v0.9.3](https://github.com/JosiahSiegel/umactually/releases/tag/v0.9.3)** — see [all releases](https://github.com/JosiahSiegel/umactually/releases).
## Quickstart

Add `umactually-action` to a pull-request workflow, configure two repo secrets, ship. The action owns Node.js 24 setup, `npm install -g umactually`, the first-run secret bootstrap, the live review, and the verdict output for branch protection. Full reference: [`docs/install-action.md`](docs/install-action.md).

1. **Add the action** to `.github/workflows/umactually-pr-review.yml` (SHA-pinned; enable Dependabot on `uses:` to auto-bump the SHA):

   ```yaml
   - uses: JosiahSiegel/umactually-action@043d6070a43a5f61aa6ede9efe60d0f47b76fc58  # v1
     with:
       cli-version: 0.9.3
       provider: openai-compatible
       api-url: ${{ secrets.UMACTUALLY_API_URL }}
       api-key: ${{ secrets.UMACTUALLY_API_KEY }}
   ```

2. **Add two repository secrets** at Settings → Secrets and variables → Actions: `UMACTUALLY_API_URL` (provider base URL) and `UMACTUALLY_API_KEY` (provider API key). For the `copilot` family, the action uses `GITHUB_TOKEN` instead of `api-key`. The action never persists the key to disk.

3. **Open a PR** — the action runs on every `pull_request` event. On the first run it posts an idempotent bootstrap comment (marker `<!-- umactually-bootstrap -->`) explaining the secrets to configure, then exits with the typed code `UMACTUALLY_ERR_SECRET_BOOTSTRAP` (3) — see [`docs/exit-codes.md`](docs/exit-codes.md). Once both secrets are set, the next `synchronize` runs the live review and emits `verdict` + `inline-thread-count` + `review-id` outputs for branch protection.

### Advanced / local install

For local-first operator workflows (running `umactually review` from your shell, generating a workflow manually, or wiring non-GitHub platforms) the `umactually init` wizard is the equivalent first-run path. The wizard writes non-secret choices to `~/.umactually/config.json` (mode `0o600`); every later `umactually review` reads them. Per-flag reference: [`docs/configuration.md`](docs/configuration.md).

```bash
umactually init
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

CI must use Node.js 24 and a version-pinned install. Pin to [`v0.9.3`](https://github.com/JosiahSiegel/umactually/releases/tag/v0.9.3) — never track `main`.

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
| `docs/configuration.md` | `docs/install-action.md` | `docs/providers.md` | [`docs/release-process.md`](docs/release-process.md) |
| `docs/troubleshooting.md` | `docs/gh-actions.md` | `docs/security.md` | CHANGELOG.md |
| — | `docs/azure-devops.md` | `docs/exit-codes.md` | CONTRIBUTING.md |
| — | [`docs/onboarding/github-marketplace.md`](docs/onboarding/github-marketplace.md) | `docs/distribution-architecture.md` | — |

Benchmark methodology and results, including the schema-versioned artifact contract and exact reproduction command, are in [`docs/benchmark.md`](docs/benchmark.md). Architecture, context/policy provenance, incremental behavior, suggestions, local metrics/privacy, `doctor`, TUI, limitations, and rollback are in [`docs/architecture.md`](docs/architecture.md). Security reporting is in [`SECURITY.md`](SECURITY.md) and the detailed trust model in [`docs/security.md`](docs/security.md); contributor operations are in [`CONTRIBUTING.md`](CONTRIBUTING.md). Deferred—not shipped—surfaces are a hosted control plane, GitLab, Bitbucket, opaque learning, and auto-commit behavior.

## License

[MIT](LICENSE).
