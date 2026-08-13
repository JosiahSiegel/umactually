# Install `umactually-action`

The Composite Action is the one-line install path for GitHub Actions. It owns Node.js 24 setup, `npm install -g umactually@<cli-version>`, the first-run secret bootstrap, the live PR review, and verdict output for branch protection.

This document is the canonical reference for the action. The README's [Quickstart](../README.md#quickstart) shows the one-line snippet; this page documents the input matrix, the env-passthrough contract, the first-run bootstrap behavior, and the branch-protection contract in full.

## One-line install

```yaml
- uses: JosiahSiegel/umactually-action@v1
  with:
    api-url: ${{ secrets.UMACTUALLY_API_URL }}
    api-key: ${{ secrets.UMACTUALLY_API_KEY }}
```

## Input matrix

The full input matrix from `action/action.yml`:

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `cli-version` | no | `__UMACTUALLY_VERSION__` | `umactually` CLI version to install via `npm install -g`. Pin a specific tag (e.g. `0.8.2`) to disable auto-update. |
| `api-url` | no | `${{ secrets.UMACTUALLY_API_URL }}` | Provider API base URL. Forwarded to the CLI as `UMACTUALLY_API_URL`. |
| `api-key` | no | `${{ secrets.UMACTUALLY_API_KEY }}` | Provider API key. Forwarded to the CLI as `UMACTUALLY_API_KEY`. |
| `provider` | no | `openai-compatible` | Provider family: `openai-compatible`, `anthropic`, or `copilot`. |
| `model` | no | `""` | Provider-specific model identifier (optional). |
| `config-path` | no | `./umactually.review.json` | Path to the committed `umactually.review.json` policy file (schemaVersion 1). |
| `output-artifact` | no | `umactually-review.json` | Path the CLI writes the review artifact to. |
| `skip-draft` | no | `'true'` | When `'true'`, the CLI skips re-reviewing files whose inline threads haven't changed. |
| `paths-ignore` | no | `'**/*.md,docs/**,**/*.lock'` | Comma-separated gitignore-style globs the CLI excludes from review. |

## Outputs

| Output | Description |
| --- | --- |
| `verdict` | `success` / `failure` for required status checks. Branch-protection rules branch on this output. |
| `inline-thread-count` | Number of inline review threads posted. Zero = clean review. |
| `review-id` | Opaque run identifier (request id) for log correlation. |

## Env passthrough

The action sets these env vars before invoking the CLI (the equivalent of the longform workflow's `env:` block):

- `UMACTUALLY_API_URL` ← `${{ inputs.api-url }}`
- `UMACTUALLY_API_KEY` ← `${{ inputs.api-key }}`
- `GITHUB_TOKEN` ← `${{ github.token }}`

Optional passthrough (from `inputs.model` / `inputs.provider`) is forwarded as the `--model` / `--provider` CLI flags so the wizard's saved config doesn't override the operator's per-run choice.

## GitHub Enterprise Server (GHES)

Supported. Set `GITHUB_API_URL=https://<your-ghe-host>/api/v3` (or your install's equivalent) on the runner; the action forwards it unchanged. The CLI rejects malformed values (non-HTTPS, userinfo, query/fragment) at the platform base boundary before any network call fires. See [`docs/gh-actions.md` § GitHub Enterprise Server](gh-actions.md#github-enterprise-server) for the per-feature contract.

## First-run secret bootstrap

If `secrets.UMACTUALLY_API_URL` or `secrets.UMACTUALLY_API_KEY` is empty on an opening/reopening pull request, the action posts an idempotent PR comment with the literal marker:

```html
<!-- umactually-bootstrap -->
```

followed by a short explanation of the two secrets to configure. The marker is the idempotency guard — on a `synchronize` event the action checks for an existing comment with the marker and skips the post. After the comment (or the no-op skip), the action exits with the typed error code `UMACTUALLY_ERR_SECRET_BOOTSTRAP` (3) — sourced from `src/util/exit-codes.ts` (`UMACTUALLY_EXIT_CODES.SECRET_BOOTSTRAP`). Branch-protection rules surface this as a required status check failure with a searchable, documented message.

## Branch-protection contract

Branch-protection rules branch on the action's three outputs:

- **`verdict`** — `success` when the review posted without a parse-fail sentinel; `failure` otherwise. This is the canonical required-check signal.
- **`inline-thread-count`** — informational; surfaced in the job summary for human reviewers. Zero is a successful clean review.
- **`review-id`** — opaque identifier; use it to correlate CI logs with the CLI's `--json` envelope (`metadata.requestId`).

The action exits with code 0 when `verdict === success`, code 3 when the first-run secret bootstrap fired (typed-error code `UMACTUALLY_ERR_SECRET_BOOTSTRAP`), and the CLI's own exit code (1, 2, 4, or 127) when the review itself failed. See [`docs/exit-codes.md`](exit-codes.md) for the full contract.

## Versioning / auto-update

The action tracks the latest CLI release by default. The `cli-version` input's default value `__UMACTUALLY_VERSION__` is the substitution point the `umactually init` wizard rewrites on emit; running the action with the wizard's output pins the CLI to the release the wizard was built against (the CLI release used to generate the workflow).

To pin a specific CLI version, set `cli-version: <tag>` explicitly (e.g. `cli-version: 0.8.2`). To auto-update to the latest CLI release, enable Dependabot on your workflow file's `with:` block via a separate `dependabot.yml` — this is the operator's responsibility, not the action's. See [GitHub's Dependabot version updates guide](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates) for the `package-ecosystem: github-actions` config.

## Reference

- [`action/action.yml`](../action/action.yml) — the input matrix and outputs.
- [`src/util/exit-codes.ts`](../src/util/exit-codes.ts) — the typed-error code literals (`UMACTUALLY_ERR_SECRET_BOOTSTRAP`, `UMACTUALLY_ERR_PUBLISHER_UNVERIFIED`).
- [`docs/configuration.md`](configuration.md) — the committed `umactually.review.json` schema (the `config-path` input's payload).
- [`docs/onboarding/github-marketplace.md`](onboarding/github-marketplace.md) — the Marketplace listing copy.