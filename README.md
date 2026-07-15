# umactually

AI-powered PR review that posts inline comments directly to your pull requests. Works with any model provider (OpenAI, Anthropic, Copilot) and both GitHub and Azure DevOps.

[![GitHub release](https://img.shields.io/github/v/release/JosiahSiegel/umactually)](https://github.com/JosiahSiegel/umactually/releases/tag/v0.2.1)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js >=24](https://img.shields.io/badge/node-%3E%3D24-339933.svg)](https://nodejs.org/)

Latest release: **[v0.2.1](https://github.com/JosiahSiegel/umactually/releases/tag/v0.2.1)** — see [all releases](https://github.com/JosiahSiegel/umactually/releases).

## Install

### Recommended: standalone binary (SHA-256-verified)

The installer downloads the matching release asset, verifies its checksum, and places `umactually` on your PATH. No Node.js required.

```bash
# macOS / Linux / Windows Git Bash
curl -fsSL https://github.com/JosiahSiegel/umactually/raw/main/scripts/install.sh | sh
```

```powershell
# Windows PowerShell
irm https://github.com/JosiahSiegel/umactually/raw/main/scripts/install.ps1 | iex
```

Verify after installation:

```bash
umactually --version
```

Supported release assets:

- Linux x64 / arm64
- macOS x64 / arm64
- Windows x64 / arm64

### From the GitHub source tarball

When Node.js 24 is already available, run the pinned CLI directly without a global install:

```bash
npx github:JosiahSiegel/umactually#v0.2.1 review
```

The `#v0.2.1` fragment pins the install to the [v0.2.1 release tag](https://github.com/JosiahSiegel/umactually/releases/tag/v0.2.1). Omit the fragment only when you specifically want the latest unreleased `main` build. The `umactually` npm package is not yet published — `npm install -g umactually` will 404 until a future release.

### Uninstall

```bash
# macOS / Linux / Windows Git Bash
curl -fsSL https://github.com/JosiahSiegel/umactually/raw/main/scripts/uninstall.sh | sh
```

```powershell
# Windows PowerShell
irm https://github.com/JosiahSiegel/umactually/raw/main/scripts/uninstall.ps1 | iex
```

## Usage

Run from inside any git repo with a PR diff in your working tree:

```bash
umactually review --api-url https://api.openai.com/v1 --api-key "$UMACTUALLY_API_KEY"
```

This reviews your local diff and writes the results to `./umactually-review.json` — no GitHub or Azure DevOps token required, nothing is posted.

In CI, the CLI auto-detects the platform from environment variables (`GITHUB_ACTIONS`, `TF_BUILD`) and posts review comments directly to the PR. See [CI Integration](#ci-integration) below.

### Commands

```text
umactually review                    Run PR review (default)
umactually doctor                    Check environment is ready
umactually check-review-artifact     Validate a review artifact
umactually --version
umactually --help
```

### How it works

1. Fetches the PR diff from the platform API
2. Sends it to your model provider with a review prompt
3. Posts findings as inline review comments
4. Updates the same review on subsequent runs (no duplicates)

The CLI auto-validates its output after each run. Invalid reviews exit with code 1.

## CI Integration

CI must use Node.js 24 and a version-pinned install. Pin to the [`v0.2.1` release tag](https://github.com/JosiahSiegel/umactually/releases/tag/v0.2.1) — never track `main` and never use the interactive binary installers in a CI step.

### GitHub Actions

```yaml
# Runs umactually as a pinned npm CLI for pull requests.
name: PR review
on: [pull_request]
concurrency:
  group: umactually-${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
permissions:
  contents: read
  pull-requests: write
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"
      - name: Run umactually PR review
        env:
          GITHUB_TOKEN: ${{ github.token }}
          UMACTUALLY_API_URL: ${{ secrets.UMACTUALLY_API_URL }}
          UMACTUALLY_API_KEY: ${{ secrets.UMACTUALLY_API_KEY }}
        # Pin to the v0.2.1 release tag — `npx github:owner/repo#tag` resolves
        # to the GitHub tarball at that ref, so the install is reproducible
        # instead of tracking `main`. The npm package is not yet published.
        run: npx github:JosiahSiegel/umactually#v0.2.1 review --platform github
```

See the [GitHub Actions guide](docs/gh-actions.md) and the canonical workflow at [`examples/github/pr-review.yml`](examples/github/pr-review.yml).

### Azure DevOps

```yaml
# Enable "Allow scripts to access the OAuth token" in pipeline settings.
# UMACTUALLY_* options (prompt files, strict schema, verify findings, etc.) are
# CLI-native: set them as ADO pipeline variables and they flow through automatically.
# Artifact validation is automatic after each live review. SYSTEM_ACCESSTOKEN is the
# only ADO-specific plumbing because Azure does not export $(System.AccessToken).
trigger: none
pr:
  branches:
    include: [main]
pool:
  vmImage: ubuntu-latest
steps:
  - checkout: self
  - task: NodeTool@0
    inputs:
      versionSpec: "24.x"
  # Pin to the v0.2.1 release tag — `npx github:owner/repo#tag` resolves
  # to the GitHub tarball at that ref, so the install is reproducible
  # instead of tracking `main`. The npm package is not yet published.
  - script: npx github:JosiahSiegel/umactually#v0.2.1 review --platform azure-devops
    displayName: Run umactually PR review
    env:
      SYSTEM_ACCESSTOKEN: $(System.AccessToken)
      UMACTUALLY_API_URL: $(UMACTUALLY_API_URL)
      UMACTUALLY_API_KEY: $(UMACTUALLY_API_KEY)
```

Enable "Allow scripts to access the OAuth token" in pipeline settings.

See the [Azure DevOps guide](docs/azure-devops.md) and the canonical pipeline at [`examples/azure/azure-pipelines.yml`](examples/azure/azure-pipelines.yml).

## Configuration

Configuration is accepted through CLI flags, environment variables, and platform-provided CI variables. Precedence is:

1. Explicit CLI flag
2. Canonical `UMACTUALLY_*` environment variable
3. Legacy `REVIEW_*` environment variable
4. Built-in default

Do not put API keys or tokens directly in workflow YAML. Use GitHub Actions secrets, Azure Pipelines secret variables, or a protected variable group.

| Variable | Default | Description |
| --- | --- | --- |
| `UMACTUALLY_API_URL` | unset | Model provider base URL. Required for hosted review API use. |
| `UMACTUALLY_API_KEY` | unset | Model provider API key. Store it as a secret. |
| `UMACTUALLY_MODEL` | `auto` | Model ID. `auto` resolves per-provider (e.g. `gpt-5-mini`, `claude-sonnet-4.6`). |
| `UMACTUALLY_EFFORT` | `medium` | Reasoning effort: `low`, `medium`, or `high`. |
| `UMACTUALLY_PROVIDER` | `openai-compatible` | Provider family: `openai-compatible`, `copilot`, or `anthropic`. |
| `UMACTUALLY_GITHUB_API_BASE` | unset | GitHub API base for Copilot token exchange (e.g. `https://<tenant>.ghe.com`). |
| `UMACTUALLY_REVIEW_TIMEOUT_SECONDS` | `300` | Overall review wall-clock budget in seconds. |
| `UMACTUALLY_STALL_SECONDS` | `270` | Provider-output stall budget in seconds. |
| `UMACTUALLY_MAX_OUTPUT_TOKENS` | `16000` | Maximum provider output-token budget. |
| `REVIEW_FILE_LIMIT` | `200` | Changed-file soft limit; use `0` to disable. |
| `REVIEW_MINIMUM_SEVERITY` | `medium` | Minimum inline severity: `low`, `medium`, or `high`. |
| `UMACTUALLY_PROMPT` | unset | Inline system prompt override; wins over `UMACTUALLY_PROMPT_FILE`. |
| `UMACTUALLY_ADDITIONAL_PROMPT` | unset | Inline additional prompt; wins over its file setting. |
| `UMACTUALLY_PROMPT_FILE` | unset | Repository-relative system prompt file. |
| `UMACTUALLY_PROMPT_FILES` | auto-discover | Ordered comma/newline-separated prompt files; overrides discovery. |
| `UMACTUALLY_ADDITIONAL_PROMPT_FILE` | unset | Repository-relative additional prompt file. |
| `UMACTUALLY_ADDITIONAL_PROMPT_FILES` | unset | Ordered comma/newline-separated additional prompt files. |
| `UMACTUALLY_DETECT_LEAKS` | `true` | Scan the diff for leaked secrets before posting. |
| `UMACTUALLY_INCLUDE_SONARQUBE` | `false` | Include SonarQube issues in the review. |
| `UMACTUALLY_SONAR_HOST_URL` | unset | SonarQube base URL. |
| `UMACTUALLY_SONAR_TOKEN` | unset | SonarQube token. Store it as a secret. |
| `UMACTUALLY_SONAR_PROJECT_KEY` | unset | SonarQube project key. |
| `UMACTUALLY_DRY_RUN` | `false` | Generate output without posting comments or status. |
| `UMACTUALLY_WALKTHROUGH` | `false` | Post a separate PR walkthrough comment. |
| `UMACTUALLY_DIAGNOSTIC` | `false` | Inject a synthetic finding for pipeline smoke tests. |
| `UMACTUALLY_DEBUG_RAW_RESPONSE` | `false` | Echo the raw provider response for debugging. |
| `UMACTUALLY_SIMULATE_FINDINGS` | `false` | Replace an empty live result with deterministic fixture findings. |
| `UMACTUALLY_STRICT_SCHEMA` | `true` | Request strict provider-side structured output where supported. |
| `UMACTUALLY_VERIFY_FINDINGS` | `true` | Cross-check finding paths and lines against the diff. |
| `UMACTUALLY_PLATFORM` | `auto` | Platform dispatch hint: `auto`, `github`, or `azure`. |

Boolean environment variables accept `true`, `false`, `1`, `0`, `yes`, `no`, `on`, `off`, `y`, and `n`, case-insensitively.

Platform runners also provide `GITHUB_TOKEN`, `GITHUB_EVENT_PATH`, `SYSTEM_ACCESSTOKEN`, and Azure pull-request metadata. See the [configuration reference](docs/configuration.md) for the complete CLI flag set, legacy aliases, prompt-file discovery order, and provider-specific behavior.

## Documentation

- [Configuration reference](docs/configuration.md)
- [GitHub Actions guide](docs/gh-actions.md)
- [Azure DevOps guide](docs/azure-devops.md)
- [Provider setup](docs/providers.md)
- [Security & redaction](docs/security.md)
- [Exit codes](docs/exit-codes.md)
- [Sample review artifact](docs/samples/review-artifact.json)
- [CHANGELOG](CHANGELOG.md)