# umactually

AI-powered PR review that posts inline comments directly to your pull requests. Works with any model provider (OpenAI, Anthropic, Copilot) and both GitHub and Azure DevOps.

## Install

```bash
# npm
npm install -g umactually

# bun
bun add -g umactually

# macOS / Linux / Windows Git Bash (no Node required)
curl -fsSL https://github.com/JosiahSiegel/umactually/raw/main/scripts/install.sh | sh

# Windows PowerShell (no Node required)
irm https://github.com/JosiahSiegel/umactually/raw/main/scripts/install.ps1 | iex
```

Or try without installing: `npx umactually@latest review` / `bunx umactually review`

## Usage

Run from inside any git repo with a PR diff in your working tree:

```bash
umactually review --api-url https://api.openai.com/v1 --api-key "$UMACTUALLY_API_KEY"
```

This reviews your local diff and writes the results to `./umactually-review.json` — no GitHub or Azure DevOps token required, nothing is posted.

In CI, the CLI auto-detects the platform from environment variables (`GITHUB_ACTIONS`, `TF_BUILD`) and posts review comments directly to the PR. See [CI Integration](#ci-integration) below.

### Commands

```
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

### GitHub Actions

```yaml
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
        run: npx umactually@0.1.0 review --platform github
        env:
          GITHUB_TOKEN: ${{ github.token }}
          UMACTUALLY_API_URL: ${{ secrets.UMACTUALLY_API_URL }}
          UMACTUALLY_API_KEY: ${{ secrets.UMACTUALLY_API_KEY }}
```

### Azure DevOps

```yaml
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
  - script: npx umactually@0.1.0 review --platform azure-devops
    displayName: Run umactually PR review
    env:
      SYSTEM_ACCESSTOKEN: $(System.AccessToken)
      UMACTUALLY_API_URL: $(UMACTUALLY_API_URL)
      UMACTUALLY_API_KEY: $(UMACTUALLY_API_KEY)
```

Enable "Allow scripts to access the OAuth token" in pipeline settings.

## Configuration

All options are env vars — set them as CI secrets/variables, no flags needed:

| Variable | Default | Description |
|---|---|---|
| `UMACTUALLY_API_URL` | — | Model provider URL (required) |
| `UMACTUALLY_API_KEY` | — | Provider API key (required) |
| `UMACTUALLY_MODEL` | auto | Model ID (e.g. `gpt-4o`, `claude-3-5-sonnet`) |
| `UMACTUALLY_PROVIDER` | openai-compatible | `openai-compatible`, `anthropic`, or `copilot` |
| `UMACTUALLY_PROMPT_FILES` | auto-discover | Comma-separated prompt file paths (e.g. `CLAUDE.md,AGENTS.md`) |
| `UMACTUALLY_STRICT_SCHEMA` | true | Validate provider output matches schema |
| `UMACTUALLY_VERIFY_FINDINGS` | true | Cross-check findings against diff |
| `UMACTUALLY_MAX_OUTPUT_TOKENS` | 16000 | Max tokens per provider response |
| `UMACTUALLY_MINIMUM_SEVERITY` | medium | `low`, `medium`, or `high` |

Boolean values: `true`/`false`/`1`/`0`/`yes`/`no`. Precedence: CLI flag > env var > default.

## Documentation

- [Configuration reference](docs/configuration.md)
- [GitHub Actions guide](docs/gh-actions.md)
- [Azure DevOps guide](docs/azure-devops.md)
- [Provider setup](docs/providers.md)
- [Security & redaction](docs/security.md)
- [Exit codes](docs/exit-codes.md)
- [Sample review artifact](docs/samples/review-artifact.json)
