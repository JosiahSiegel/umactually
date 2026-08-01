# umactually

AI-powered PR review that posts inline comments directly to your pull requests. Works with any model provider (OpenAI, Anthropic, Copilot) and both GitHub and Azure DevOps.

[![GitHub release](https://img.shields.io/github/v/release/JosiahSiegel/umactually)](https://github.com/JosiahSiegel/umactually/releases/tag/v0.6.23)
[![npm](https://img.shields.io/npm/v/umactually)](https://www.npmjs.com/package/umactually)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=24](https://img.shields.io/badge/node-%3E%3D24-339933.svg)](https://nodejs.org/)

Latest release: **[v0.6.23](https://github.com/JosiahSiegel/umactually/releases/tag/v0.6.23)** — see [all releases](https://github.com/JosiahSiegel/umactually/releases).

## Install

Pick the path that matches your environment. Full comparison at [`docs/distribution-architecture.md`](docs/distribution-architecture.md).

### Recommended: `npm install -g umactually`

```bash
# Global install (Node 24+ or Bun 1.2+)
npm install -g umactually

# One-shot, no install
npx umactually review …

# Bun users
bunx umactually review …
```

~330 KB download, uses your existing runtime. This is the canonical install path.

### Alternative: curl-pipe installer (smart-routes to npm, falls back to binary)

Use this if you want one command that picks the best path for you. The installer checks for Node 24+ on PATH first; if found, it runs `npm install -g umactually` and exits. Otherwise it downloads a single-file Node SEA binary that bundles Node 25.7 (~30 MB, no Node required).

```bash
# macOS / Linux / Windows Git Bash — install latest
curl -fsSL https://github.com/JosiahSiegel/umactually/raw/main/scripts/install.sh | sh

# Pin a specific version
curl -fsSL https://github.com/JosiahSiegel/umactually/raw/main/scripts/install.sh | sh -s -- --tag v0.6.23
```

```powershell
# Windows PowerShell
irm https://github.com/JosiahSiegel/umactually/raw/main/scripts/install.ps1 | iex
```

**Windows Git Bash note:** if you see `curl: (35) schannel: ... CRYPT_E_REVOCATION_OFFLINE (0x80092013)`, your network can't reach GitHub's OCSP responder. Re-run with `--ssl-no-revoke` on both the curl and the install:

```bash
curl -fsSL --ssl-no-revoke https://github.com/JosiahSiegel/umactually/raw/main/scripts/install.sh | sh -s -- --ssl-no-revoke
```

**All installer flags / env vars** (also accepted as env vars, env wins):

| Flag | Env var | Default |
| --- | --- | --- |
| `--tag vX.Y.Z` | `INSTALL_RELEASE_TAG` | auto-detect from `releases/latest` |
| `--base <url>` | `INSTALL_RELEASE_BASE` | GitHub releases URL |
| `--contract archive\|legacy` | `INSTALL_ASSET_CONTRACT` | auto-detect from `checksums.txt` |
| `--install-dir <path>` | — | `/usr/local/bin` (root) or `~/.local/bin` (non-root) |
| `--ssl-no-revoke` | `INSTALL_SSL_NO_REVOKE` | revocation checks on (secure default) |
| `--try-npm` | `INSTALL_TRY_NPM` | opt in to the smart-router on first invocation |
| — | `INSTALL_FORCE_BINARY=1` | skip the npm smart-router, always download the binary |

Bypass options: set `INSTALL_FORCE_BINARY=1` to always use the binary, or `INSTALL_TEST_MODE=1` to skip destructive side effects during installer development.

For the full flag list and edge cases, run `curl -fsSL https://github.com/JosiahSiegel/umactually/raw/main/scripts/install.sh | sh -s -- --help`.

### From source (GitHub tarball, Node 24+ required)

```bash
npx github:JosiahSiegel/umactually#v0.6.23 review
```

The `#v0.6.23` fragment pins to the tagged release. Omit it only when you specifically want the latest unreleased `main` build.

### Platform support

| OS | Install path | Notes |
| --- | --- | --- |
| Linux x64 / arm64 | npm, binary, or curl-pipe | full support |
| macOS arm64 (Apple Silicon) | npm, binary, or curl-pipe | full support |
| macOS x64 (Intel) | **npm only** | `node --build-sea` segfaults on darwin-x64 ([nodejs/node#62893](https://github.com/nodejs/node/issues/62893)); use `npm install -g umactually` |
| Windows x64 / arm64 | npm, binary, PowerShell, or curl-pipe | full support; Windows ARM64 is ZIP-only and not smoke-tested in CI (structural validation only) |

Verify after installation:

```bash
umactually --version
```

### Uninstall

```bash
# Built-in subcommand (recommended — handles binary, config, cache, PATH)
umactually uninstall                    # interactive confirmation
umactually uninstall --yes              # non-interactive
umactually uninstall --purge-config     # also remove ~/.umactually/ and ~/.cache/umactually/
umactually uninstall --json             # machine-readable output

# Legacy one-liner (kept for back-compat with v0.5.x)
curl -fsSL https://github.com/JosiahSiegel/umactually/raw/main/scripts/uninstall.sh | sh
```

```powershell
# Windows PowerShell
umactually uninstall --yes

# Legacy
irm https://github.com/JosiahSiegel/umactually/raw/main/scripts/uninstall.ps1 | iex
```

## Usage

Run from any git working tree with a diff staged or committed:

```bash
umactually review --api-url https://api.openai.com/v1 --api-key "$UMACTUALLY_API_KEY"
umactually --files src/foo.ts,src/bar.ts --api-key "$UMACTUALLY_API_KEY"     # Local files/dirs (no CI)
```

This reviews the local diff and writes `./umactually-review.json`. No GitHub or Azure DevOps token required, nothing is posted.

In CI the CLI auto-detects the platform from environment variables (`GITHUB_ACTIONS`, `TF_BUILD`) and posts review comments directly to the PR. See [CI Integration](#ci-integration) below.

### Commands

```text
umactually review                    Run PR review (default)
umactually doctor                    Check environment is ready
umactually check-review-artifact     Validate a review artifact
umactually uninstall                 Remove the binary, config, cache, and PATH entry
umactually --version
umactually --help
```

Every subcommand supports `--json` for machine-readable output. `umactually doctor` and `umactually uninstall` share the same envelope shape so CI can drive both with one parser. See [`docs/exit-codes.md`](docs/exit-codes.md) for the per-action exit-code contract.

### How it works

1. Fetches the PR diff from the platform API.
2. Redacts known secret patterns and cross-checks finding paths against the diff.
3. Sends it to the configured model provider with the review prompt.
4. Posts findings as inline review comments under a stable marker.

Invalid review output fails the same invocation with a non-zero exit code — no partial posts. See [`docs/exit-codes.md`](docs/exit-codes.md).

## CI Integration

CI must use Node.js 24 and a version-pinned install. Pin to the [`v0.6.23` release tag](https://github.com/JosiahSiegel/umactually/releases/tag/v0.6.23) — never track `main` and never use the interactive binary installers in a CI step.

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
