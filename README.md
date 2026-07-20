# umactually

AI-powered PR review that posts inline comments directly to your pull requests. Works with any model provider (OpenAI, Anthropic, Copilot) and both GitHub and Azure DevOps.

[![GitHub release](https://img.shields.io/github/v/release/JosiahSiegel/umactually)](https://github.com/JosiahSiegel/umactually/releases/tag/v0.5.7)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=24](https://img.shields.io/badge/node-%3E%3D24-339933.svg)](https://nodejs.org/)

Latest release: **[v0.5.7](https://github.com/JosiahSiegel/umactually/releases/tag/v0.5.7)** — see [all releases](https://github.com/JosiahSiegel/umactually/releases).

## Install

### Recommended: standalone binary (SHA-256-verified)

```bash
# macOS / Linux / Windows Git Bash — install latest
curl -fsSL https://github.com/JosiahSiegel/umactually/raw/main/scripts/install.sh | sh

# Install a pinned version
curl -fsSL https://github.com/JosiahSiegel/umactually/raw/main/scripts/install.sh | sh -s -- --tag v0.5.7

# Install to a custom directory (e.g. for non-root users without /usr/local/bin write access)
curl -fsSL https://github.com/JosiahSiegel/umactually/raw/main/scripts/install.sh | sh -s -- --install-dir ~/.local/bin

# Print the installer's flag/env-var reference
curl -fsSL https://github.com/JosiahSiegel/umactually/raw/main/scripts/install.sh | sh -s -- --help
```

```powershell
# Windows PowerShell
irm https://github.com/JosiahSiegel/umactually/raw/main/scripts/install.ps1 | iex
```

The installer downloads a `.tar.gz` (Linux/macOS) or `.zip` (Windows) archive from the release, verifies its SHA-256 against `checksums.txt`, and extracts the binary to your PATH. No Node.js required. Supported release assets: Linux x64/arm64, macOS x64/arm64, Windows x64/arm64.

Supported installer flags (also accepted as env vars):

| Flag | Env var | Default |
| --- | --- | --- |
| `--tag vX.Y.Z` | `INSTALL_RELEASE_TAG` | auto-detect from `releases/latest` |
| `--base <url>` | `INSTALL_RELEASE_BASE` | GitHub releases URL |
| `--contract archive\|legacy` | `INSTALL_ASSET_CONTRACT` | auto-detect from published `checksums.txt` |
| `--install-dir <path>` | (none) | `/usr/local/bin` (root) or `~/.local/bin` (non-root) |

Env vars take precedence over flags when both are set (POSIX convention: the env var is the deployment default, the flag is the per-call override).

Compressed transfer size is ~3x smaller than the installed binary size (e.g., ~18 MB download / ~60 MB installed on Linux x64).

> **Windows ARM64** is supported via ZIP archive but cannot be smoke-tested in CI (structural-only validation); see [docs/release-process.md](docs/release-process.md#windows-arm64).

Verify after installation:

```bash
umactually --version
```

### From the GitHub source tarball (Node 24 required)

```bash
npx github:JosiahSiegel/umactually#v0.5.7 review
```

The `#v0.5.7` fragment pins the install to the tagged release. Omit the fragment only when you specifically want the latest unreleased `main` build. The `umactually` npm package is not yet published — `npm install -g umactually` will 404 until a future release.

### Uninstall

```bash
curl -fsSL https://github.com/JosiahSiegel/umactually/raw/main/scripts/uninstall.sh | sh
```

```powershell
irm https://github.com/JosiahSiegel/umactually/raw/main/scripts/uninstall.ps1 | iex
```

## Usage

Run from any git working tree with a diff staged or committed:

```bash
umactually review --api-url https://api.openai.com/v1 --api-key "$UMACTUALLY_API_KEY"
```

This reviews the local diff and writes `./umactually-review.json`. No GitHub or Azure DevOps token required, nothing is posted.

In CI the CLI auto-detects the platform from environment variables (`GITHUB_ACTIONS`, `TF_BUILD`) and posts review comments directly to the PR. See [CI Integration](#ci-integration) below.

### Commands

```text
umactually review                    Run PR review (default)
umactually doctor                    Check environment is ready
umactually check-review-artifact     Validate a review artifact
umactually --version
umactually --help
```

### How it works

1. Fetches the PR diff from the platform API.
2. Redacts known secret patterns and cross-checks finding paths against the diff.
3. Sends it to the configured model provider with the review prompt.
4. Posts findings as inline review comments under a stable marker.

Invalid review output fails the same invocation with a non-zero exit code — no partial posts. See [`docs/exit-codes.md`](docs/exit-codes.md).

## CI Integration

CI must use Node.js 24 and a version-pinned install. Pin to the [`v0.5.7` release tag](https://github.com/JosiahSiegel/umactually/releases/tag/v0.5.7) — never track `main` and never use the interactive binary installers in a CI step.

The canonical CI workflows are the source of truth — copy them into your pipeline rather than re-deriving them:

### GitHub Actions

Canonical workflow at [`examples/github/pr-review.yml`](examples/github/pr-review.yml). Setup details at [`docs/gh-actions.md`](docs/gh-actions.md).

### Azure DevOps

Canonical pipeline at [`examples/azure/azure-pipelines.yml`](examples/azure/azure-pipelines.yml). Setup details at [`docs/azure-devops.md`](docs/azure-devops.md).

### Troubleshooting

Parse-fail triage, auto-artifact validation, and concurrency notes at [`docs/troubleshooting.md`](docs/troubleshooting.md). Complete env-var and flag reference at [`docs/configuration.md`](docs/configuration.md).

## Security and trust

The runtime treats PR title, body, comments, diff lines, and `prompt-file` contents as **untrusted**, and the operator-supplied secrets / `GITHUB_TOKEN` / `SYSTEM_ACCESSTOKEN` as **trusted**. `security` and `leak` findings bypass every `minimum-severity` threshold and cannot be turned off — to suppress them you must remove them at the source. See [`docs/security.md`](docs/security.md).

To report a security issue, open a private security advisory (see the link at the bottom of [`docs/security.md`](docs/security.md#reporting-issues)).

## Documentation

- [Configuration reference](docs/configuration.md) — every CLI flag, every env var, every precedence rule
- [Provider setup](docs/providers.md) — the per-family wire shape and the cross-protocol dispatcher
- [GitHub Actions guide](docs/gh-actions.md)
- [Azure DevOps guide](docs/azure-devops.md)
- [Troubleshooting](docs/troubleshooting.md) — parse-fail triage, auto-artifact validation, concurrency notes
- [Security & redaction](docs/security.md)
- [Exit codes](docs/exit-codes.md)
- [Release process](docs/release-process.md) — for maintainers cutting a release
- [Sample review artifact](docs/samples/review-artifact.json)
- [CHANGELOG](CHANGELOG.md)

## License

[MIT](LICENSE).
