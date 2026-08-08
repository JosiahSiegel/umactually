# umactually

AI-powered PR review that posts inline comments directly to your pull requests. Works with any model provider (OpenAI, Anthropic, Copilot) and both GitHub and Azure DevOps.

[![GitHub release](https://img.shields.io/github/v/release/JosiahSiegel/umactually)](https://github.com/JosiahSiegel/umactually/releases/tag/v0.7.0)
[![npm](https://img.shields.io/npm/v/umactually)](https://www.npmjs.com/package/umactually)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=24](https://img.shields.io/badge/node-%3E%3D24-339933.svg)](https://nodejs.org/)

Latest release: **[v0.7.0](https://github.com/JosiahSiegel/umactually/releases/tag/v0.7.0)** — see [all releases](https://github.com/JosiahSiegel/umactually/releases).

## Quickstart (recommended)

The guided setup wizard walks you through provider, scope, and CI in four steps. After that, every `umactually review` reads your saved choices from `~/.umactually/config.json` (mode `0o600`; never contains secrets). Full per-flag detail at [`docs/configuration.md`](docs/configuration.md) and [`docs/providers.md`](docs/providers.md#setup-wizard).

> **First time?** Run `umactually` with no subcommand on a fresh install and the CLI prints a compact quickstart leading with `umactually init` and summarizing the three review commands (`review`, `--files`, `doctor`). After you run `umactually init`, the quickstart switches: it confirms what's loaded (`Loaded config (provider=X, model=Y). Run:`) and drops the `umactually init` block, because you've already configured. The quickstart replaces the noisy `cli: --api-url is required` banner only for interactive users (real TTY stdout AND no CI marker — `GITHUB_ACTIONS`, `TF_BUILD`, `BUILDKITE`, `CIRCLECI`, or `JENKINS_URL` — AND no programmatic flag like `--api-*`, `--model`, `--platform*`, `--json`, `--no-color`); every other case (CI, programmatic flags) keeps the existing loud banner so scripts that grep for the validation text keep working. See [Saved config](#saved-config) below.

1. **Run the wizard** — interactive on a TTY, non-interactive in CI:

   ```bash
   umactually init
   ```

2. **Pick a provider family** — one of `openai-compatible`, `anthropic`, or `copilot`. The wizard prompts per-branch (`api-url` + `api-key` + `model` for OpenAI-compatible; `api-key` + `model` for Anthropic; `github-api-base` + `model` for Copilot — no `api-key`, the wizard points you at the `GITHUB_TOKEN` / `GH_TOKEN` env var).
3. **Set your API credentials in your platform secret store** — the wizard never persists the credential to disk; it only records the provider family, the optional `api-url`, and the optional `model`. Examples:

   ```bash
   # GitHub Actions: Settings → Secrets and variables → Actions → New secret UMACTUALLY_API_KEY
   # Azure DevOps:  Pipelines → Library → Variable group → UMACTUALLY_API_KEY (secret)
   # Local shell:
   export UMACTUALLY_API_KEY="$UMACTUALLY_API_KEY"
   ```

4. **Run a review** — `umactually review` posts inline PR comments; `umactually --files src/foo.ts` reviews local files without CI.

```bash
# Non-interactive automation (CI provisioner, dotfiles bootstrap, etc.)
# The CLI reads UMACTUALLY_API_KEY from the env; the flag never accepts a literal value.
export UMACTUALLY_API_KEY="$UMACTUALLY_API_KEY"
umactually init --non-interactive \
  --provider openai-compatible \
  --api-url https://api.openai.com/v1 \
  --ci auto
```

The full exit-code contract for the wizard is at [`docs/exit-codes.md`](docs/exit-codes.md#umactually-init-exit-codes); the trust model (what is and isn't persisted) is at [`docs/security.md#trust-model-init`](docs/security.md#trust-model-init).

## Saved config

After `umactually init`, the wizard writes `~/.umactually/config.json` (mode `0o600`, dir mode `0o700`). Subsequent invocations of `umactually review` and `umactually --files ...` read it back as the **third tier** of a four-layer precedence chain:

| Tier | Source | Notes |
| --- | --- | --- |
| 1 | `--provider`, `--api-url`, `--model` flags | Highest priority; always wins. |
| 2 | `UMACTUALLY_PROVIDER`, `UMACTUALLY_API_URL`, `UMACTUALLY_MODEL` env vars | Overrides saved config. |
| 3 | `~/.umactually/config.json` (`provider`, optional `apiUrl`, optional `model`) | The wizard's output. |
| 4 | Schema default (`openai-compatible`, `""`, `auto`) | Fallback. |

Practical effect: once you've run `umactually init`, you can stop passing `--provider`, `--api-url`, and `--model` on every `umactually review` call. Saved config supplies them automatically; flags still win if you need to override for a one-off run.

### Inspect what's loaded

```bash
umactually --show-config
```

Prints the resolved `provider`, `apiUrl?`, `model?`, and the path the loader used. Exits 0 (or 1 with a stderr message if the file is corrupt). Read-only; never opens a network connection. Matches the convention of `kubectl config view`, `aws configure get`, and `git config --list --show-origin`.

### API key handling (security boundary)

The saved config **NEVER** contains the API key — only the three non-secret fields above. So even with a leaked config file, an attacker can't exfiltrate the key from disk. Three ways to supply the key per invocation:

```bash
umactually review --api-url https://api.openai.com/v1 --api-key "$KEY"   # explicit (rare; CI)
export UMACTUALLY_API_KEY="$KEY"; umactually review ...                    # env var (recommended)
# + GitHub Actions: Settings → Secrets and variables → Actions → New secret UMACTUALLY_API_KEY
# + Azure DevOps:   Pipelines → Library → Variable group → UMACTUALLY_API_KEY (secret)
```

Resolution order for the key: `--api-key` flag > `UMACTUALLY_API_KEY` env var > `cli: --api-key is required` error. The env var is the canonical Unix-conventional "remember a secret without writing it to disk" approach; the wizard never sees or stores the key. See [docs/security.md#trust-model-init](docs/security.md#trust-model-init) for the full trust model.

## Install (alternative)

Pick the path that matches your environment. Full comparison at [`docs/distribution-architecture.md`](docs/distribution-architecture.md).

### npm install -g umactually

```bash
# Global install (Node 24+)
npm install -g umactually

# One-shot, no install
npx umactually review …

# Bun users (Bun runs the npm-installed package; the install.sh smart-router
# still only checks for Node, so Bun-only machines fall through to the binary)
bunx umactually review …
```

~330 KB download, uses your existing runtime. This is the canonical npm path.

### curl-pipe installer (smart-routes to npm, falls back to binary)

Use this if you want one command that picks the best path for you. The installer checks for Node 24+ on PATH first; if found, it runs `npm install -g umactually` and exits. Otherwise it downloads a single-file Node SEA binary that bundles Node 25.7 (~30 MB, no Node required).

```bash
# macOS / Linux / Windows Git Bash — install latest
curl -fsSL https://github.com/JosiahSiegel/umactually/raw/main/scripts/install.sh | sh

# Pin a specific version
curl -fsSL https://github.com/JosiahSiegel/umactually/raw/main/scripts/install.sh | sh -s -- --tag v0.7.0
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
npx github:JosiahSiegel/umactually#v0.7.0 review
```

The `#v0.7.0` fragment pins to the tagged release. Omit it only when you specifically want the latest unreleased `main` build.

### Platform support

| OS | Install path | Notes |
| --- | --- | --- |
| Linux x64 / arm64 | npm, binary, or curl-pipe | full support |
| macOS arm64 (Apple Silicon) | npm, binary, or curl-pipe | full support |
| macOS x64 (Intel) | **npm only** | `node --build-sea` segfaults on darwin-x64 ([nodejs/node#62893](https://github.com/nodejs/node/issues/62893)); use `npm install -g umactually` |
| Windows x64 | npm, binary, PowerShell, or curl-pipe | full support; x64 binary is the only runtime-validated Windows target |
| Windows arm64 | npm only (recommended); binary download via PowerShell / curl-pipe works on Windows 11 22H2+ via x64 emulation | partial support; the published `umactually-windows-arm64.zip` ships for install-contract parity but the underlying binary is an x64 fallback (PE `0x8664`), not a real ARM64 PE. See [`docs/release-process.md` § Windows ARM64](docs/release-process.md#windows-arm64). |

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
umactually init                      Guided setup wizard (interactive or --non-interactive)
umactually review                    Run PR review (default)
umactually doctor                    Check environment is ready
umactually tui                       Launch the interactive terminal UI (review, config, debug)
umactually uninstall                 Remove the binary, config, cache, and PATH entry
umactually check-review-artifact     Validate a review artifact
umactually version                   Print version (alias for --version)
umactually --version
umactually --help
```

Every subcommand that emits output (`review`, `doctor`, `uninstall`, `check-review-artifact`, `init`) supports `--json` for machine-readable output. `doctor`, `uninstall`, and `check-review-artifact` share the same envelope shape so CI can drive them with one parser. See [`docs/exit-codes.md`](docs/exit-codes.md) for the per-action exit-code contract.

### How it works

1. Fetches the PR diff from the platform API.
2. Redacts known secret patterns and cross-checks finding paths against the diff.
3. Sends it to the configured model provider with the review prompt.
4. Posts findings as inline review comments under a stable marker.

Invalid review output fails the same invocation with a non-zero exit code — no partial posts. See [`docs/exit-codes.md`](docs/exit-codes.md).

## CI Integration

CI must use Node.js 24 and a version-pinned install. Pin to the [`v0.7.0` release tag](https://github.com/JosiahSiegel/umactually/releases/tag/v0.7.0) — never track `main` and never use the interactive binary installers in a CI step.

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
