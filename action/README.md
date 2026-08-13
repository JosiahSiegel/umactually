# `JosiahSiegel/umactually-action`

Run UmActually as a Composite GitHub Action. The action owns Node.js 24 setup, `npm install -g umactually`, first-run secret bootstrap, the live PR review, and verdict output for branch protection.

## One-line install

```yaml
- uses: JosiahSiegel/umactually-action@v1
  with:
    provider: openai-compatible
  secrets:
    api-url: ${{ secrets.UMACTUALLY_API_URL }}
    api-key: ${{ secrets.UMACTUALLY_API_KEY }}
```

Secrets are forwarded via the `secrets:` block on `uses:` — GitHub Actions does not template `${{ secrets.* }}` expressions inside a Composite Action's input `default:` values.

## Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `cli-version` | no | `__UMACTUALLY_VERSION__` | `umactually` CLI version to install. Pin a specific tag (e.g. `0.8.2`) to disable auto-update. |
| `api-url` | no | `""` | Provider API base URL. Default empty — forward via `secrets: api-url:`. Override via `with:` only for non-default hosts. |
| `api-key` | no | `""` | Provider API key. Default empty — forward via `secrets: api-key:`. Never place the credential in YAML literals. |
| `provider` | no | `openai-compatible` | Provider family: `openai-compatible`, `anthropic`, or `copilot`. |
| `model` | no | `""` | Provider-specific model identifier (optional). |
| `config-path` | no | `./umactually.review.json` | Path to the committed `umactually.review.json` policy file (schemaVersion 1). |
| `output-artifact` | no | `umactually-review.json` | Path the CLI writes the review artifact to. Uploaded via `actions/upload-artifact@v4`. |
| `skip-draft` | no | `'true'` | When `'true'`, the CLI skips re-reviewing files whose inline threads haven't changed. |
| `paths-ignore` | no | `'**/*.md,docs/**,**/*.lock'` | Comma-separated gitignore-style globs the CLI excludes from review. |

## Outputs

| Output | Description |
| --- | --- |
| `verdict` | `success` / `failure` for required status checks. Branch-protection rules branch on this. |
| `inline-thread-count` | Number of inline review threads posted. Zero = clean review. |
| `review-id` | Opaque run identifier (request id) for log correlation. |

## GitHub Enterprise Server (GHES)

Supported. Set `GITHUB_API_URL=https://<your-ghe-host>/api/v3` (or your install's equivalent) and `GITHUB_TOKEN` against the GHES instance; the action forwards both unchanged. See [`docs/gh-actions.md` § GitHub Enterprise Server](../docs/gh-actions.md#github-enterprise-server) for the per-feature contract.

## First-run secret bootstrap

If `secrets.UMACTUALLY_API_URL` or `secrets.UMACTUALLY_API_KEY` is empty on an opening/reopening pull request, the action queries existing comments for the `<!-- umactually-bootstrap -->` marker and, if none is found, posts an idempotent PR comment explaining the two secrets to configure. The marker guard ensures only one bootstrap comment per PR, even across reopened events. The action then exits with the typed error code `UMACTUALLY_ERR_SECRET_BOOTSTRAP` (3) — sourced from `src/util/exit-codes.ts`. Branch-protection rules surface this as a required status check failure with a searchable, documented message.

## License

[MIT](../LICENSE).