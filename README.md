# UmActually PR Review Action

UmActually is a pull request review action that sends a redacted PR diff to the UmActually review API, converts the result into platform-native review comments, and posts a stable review marker so repeated runs can update or de-duplicate feedback.

The action is designed for:

- GitHub pull request reviews with least-privilege `GITHUB_TOKEN` permissions.
- Azure DevOps PR validation pipelines that call the same bundled CLI.
- Safe handling of secrets, prompt files, and minor-finding suppression.

## Quickstarts

- [GitHub Actions quickstart](#github-actions-quickstart)
- [Azure DevOps quickstart](#azure-devops-quickstart)
- [Configuration reference](docs/configuration.md)
- [Security model](docs/security.md)
- [Azure DevOps setup notes](docs/azure-devops.md)

## Inputs

These inputs mirror `action.yml`.

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `api-url` | No | `""` | UmActually review API base URL. Prefer `UMACTUALLY_API_URL` in `env` for reusable workflows. |
| `api-key` | No | `""` | UmActually review API key. Prefer `UMACTUALLY_API_KEY` in `env` or a platform secret; never hard-code it. |
| `model` | No | `auto` | Review model to request. Use `auto` unless a maintainer asks for a pinned synthetic test model. |
| `effort` | No | `medium` | Reasoning effort hint (low\|medium\|high). Forwarded as `reasoning.effort` to providers that support it. |
| `provider` | No | `openai-compatible` | Provider family. Set to `copilot` to use GitHub Copilot (requires a GitHub PAT as `UMACTUALLY_API_KEY`). |
| `github-api-base` | No | `""` | GitHub API base URL for Copilot token exchange. Defaults to `https://api.github.com`. Set to `https://<tenant>.ghe.com` for GitHub Enterprise Server. |
| `review-timeout-seconds` | No | `300` | Maximum review wall-clock time in seconds. |
| `stall-seconds` | No | `270` | Seconds without provider output before the review is considered stalled. |
| `max-output-tokens` | No | `16000` | Maximum provider output token budget. |
| `ignore-minor` | No | `false` | Suppress minor non-security findings. Leaks and security findings are never suppressed by this option. |
| `detect-leaks` | No | `true` | Run secret-leak detection on the diff. Disable with the `--no-detect-leaks` CLI flag. |
| `prompt` | No | `""` | Inline system prompt override. Wins over `prompt-file`. |
| `additional-prompt` | No | `""` | Inline additional prompt override. Wins over `additional-prompt-file`. |
| `prompt-file` | No | `""` | Optional repository-relative prompt file. Absolute paths and path traversal are rejected. |
| `dry-run` | No | `false` | Generate review output without posting comments or status. |

See [docs/configuration.md](docs/configuration.md) for environment variables, precedence, and platform-specific defaults.

## GitHub Actions quickstart

Use the action from a `pull_request` workflow. Do **not** use `pull_request_target` for this action; it is not required and can expose secrets to untrusted PR code.

```yaml
name: UmActually PR Review

on:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # Replace `./` with the published action tag (for example `example/umactually-pr-review@v1`)
      # once this action is published to the GitHub Marketplace.
      - uses: ./
        env:
          UMACTUALLY_API_URL: ${{ secrets.UMACTUALLY_API_URL }}
          UMACTUALLY_API_KEY: ${{ secrets.UMACTUALLY_API_KEY }}
```

A complete copyable example lives at [`examples/github/pr-review.yml`](examples/github/pr-review.yml).

## Azure DevOps quickstart

Azure DevOps uses the bundled CLI directly from a pipeline step. This repository includes a root [`azure-pipelines.yml`](azure-pipelines.yml) that uses Node 24, runs `npm ci`, validates the project, prepares Azure input files, executes an Azure dry run, and publishes `artifacts/manual`.

For a minimal CLI invocation, pass the supported Azure flags explicitly:

```yaml
- script: |
    node bin/umactually-pr-review.mjs \
      --platform azure-devops \
      --event "$AZURE_EVENT_PATH" \
      --diff "$AZURE_DIFF_PATH" \
      --review "$AZURE_REVIEW_PATH" \
      --pr-number "$UMACTUALLY_PR_NUMBER" \
      --repo "$UMACTUALLY_REPO" \
      --dry-run \
      --output-artifact artifacts/manual/s4-azure-mocked-run.json
  displayName: Run UmActually PR review
  env:
    SYSTEM_ACCESSTOKEN: $(System.AccessToken)
    UMACTUALLY_API_URL: $(UMACTUALLY_API_URL)
    UMACTUALLY_API_KEY: $(UMACTUALLY_API_KEY)
```

Use `--repo`; there is no longer alias for that option. Azure dry-run validation still requires `--event`, `--diff`, `--pr-number`, and `--repo`. The root pipeline creates a safe synthetic event/diff/review path for manual branch runs without `SYSTEM_PULLREQUEST_PULLREQUESTID`; PR validation runs fetch the real PR diff with `$(System.AccessToken)` when available.

For Azure Repos, configure a branch policy build validation pipeline; the YAML `pr:` trigger is only honored for GitHub and Bitbucket Cloud repositories in Azure Pipelines. See [`docs/azure-devops.md`](docs/azure-devops.md) and [`examples/azure/azure-pipelines.yml`](examples/azure/azure-pipelines.yml).

## Security summary

- Secrets are never intentionally logged or echoed.
- Review diffs are redacted before provider submission and before artifacts are written.
- High-confidence leaks and security findings are blocking even when `ignore-minor` is enabled.
- `prompt-file` is repository-relative only; absolute paths and `..` traversal are rejected.

Read the full [security notes](docs/security.md) before enabling this on repositories that accept external contributors.

## Verifying reviews

After the workflow runs on a PR, check the PR conversation or Files changed tab for comments containing the marker:

```text
<!-- umactually-pr-review -->
```

On GitHub, the action posts a pull request review. On Azure DevOps, the CLI posts PR threads and a PR status using the OAuth token mapped to `SYSTEM_ACCESSTOKEN`.
