# UmActually PR review

Provider-agnostic pull-request review from the UmActually CLI. One-line install, two repository secrets, ship.

## Install

```yaml
- uses: JosiahSiegel/umactually-action@v1
  with:
    provider: openai-compatible
    api-url: ${{ secrets.UMACTUALLY_API_URL }}
    api-key: ${{ secrets.UMACTUALLY_API_KEY }}
```

## What it does

- Installs the pinned `umactually` CLI on Node.js 24.
- Detects missing `UMACTUALLY_API_URL` / `UMACTUALLY_API_KEY` secrets on opening PRs and posts an idempotent bootstrap comment (marker `<!-- umactually-bootstrap -->`).
- Runs the live PR review, posts inline findings, writes the artifact.
- Emits `verdict`, `inline-thread-count`, `review-id` outputs for branch protection.

## Inputs

`cli-version`, `api-url`, `api-key`, `provider`, `model`, `config-path`, `output-artifact`, `skip-draft`, `paths-ignore`. All optional; defaults track the wizard's saved config.

## Providers

`openai-compatible` (default), `anthropic`, `copilot`. `copilot` uses `GITHUB_TOKEN` instead of `api-key`.

## GitHub Enterprise Server

Supported. Set `GITHUB_API_URL=https://<your-ghe-host>/api/v3` on the runner; the action forwards it unchanged.

## First-run bootstrap

Missing secrets → queries existing comments for the `<!-- umactually-bootstrap -->` marker and, if absent, posts the idempotent bootstrap PR comment on opening/reopening PRs (skipped on `synchronize`). The marker guard prevents duplicate comments on reopened PRs. Then exits with the typed error `UMACTUALLY_ERR_SECRET_BOOTSTRAP` (3). Branch protection surfaces this as a required check failure.

## Versioning

Auto-tracks the latest CLI release. Pin with `cli-version: <tag>` to disable. Dependabot's `github-actions` ecosystem auto-updates the `with:` block.

## Documentation

Full reference: [`docs/install-action.md`](../install-action.md). Policy schema: [`docs/configuration.md`](../configuration.md). Exit codes: [`docs/exit-codes.md`](../exit-codes.md).