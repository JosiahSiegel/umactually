# Install `umactually-action`

The Composite Action is the one-line install path for GitHub Actions. It owns Node.js 24 setup, `npm install -g umactually@<cli-version>`, the first-run secret bootstrap, the live PR review, and verdict output for branch protection.

This document is the canonical reference for the action. The README's [Quickstart](../README.md#quickstart) shows the one-line snippet; this page documents the input matrix, the env-passthrough contract, the first-run bootstrap behavior, and the branch-protection contract in full.

## One-line install

```yaml
- uses: JosiahSiegel/umactually-action@043d6070a43a5f61aa6ede9efe60d0f47b76fc58  # v1
  with:
    provider: openai-compatible
    api-url: ${{ secrets.UMACTUALLY_API_URL }}
    api-key: ${{ secrets.UMACTUALLY_API_KEY }}
```

Pin `uses:` to a full commit SHA for supply-chain integrity. Floating `@v1` accepts any future tag the action repo publishes; a compromised repo would run arbitrary code in your workflow with `pull-requests: write`. Enable Dependabot's `github-actions` ecosystem on the workflow file to auto-bump the SHA on new releases. Confirm the current tag deref with `git ls-remote https://github.com/JosiahSiegel/umactually-action.git refs/tags/v1^{}`.

Forward repository secrets through `with:` inputs (e.g. `with: api-url: ${{ secrets.UMACTUALLY_API_URL }}`). The companion action's internal steps read `inputs.api-url` and `inputs.api-key`; direct `secrets.` expressions in its composite-step metadata are rejected by the runtime loader. This supersedes the earlier `secrets:`-block forwarding contract per `JosiahSiegel/umactually-action@4d5a5f4` (see [CHANGELOG.md](../CHANGELOG.md) for the version history).

## Input matrix

The full input matrix from the published [`JosiahSiegel/umactually-action`](https://github.com/JosiahSiegel/umactually-action/blob/v1/action.yml) manifest:

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `cli-version` | no | `__UMACTUALLY_VERSION__` | `umactually` CLI version to install via `npm install -g`. Pin a specific tag (e.g. `0.8.2`) to disable auto-update. |
| `api-url` | no | `""` | Provider API base URL. Default empty — forward via `with: api-url: ${{ secrets.UMACTUALLY_API_URL }}`. Override via `with:` only for non-default hosts. |
| `api-key` | no | `""` | Provider API key. Default empty — forward via `with: api-key: ${{ secrets.UMACTUALLY_API_KEY }}`. |
| `provider` | no | `openai-compatible` | Provider family: `openai-compatible`, `anthropic`, or `copilot`. |
| `model` | no | `""` | Provider-specific model identifier (optional). |
| `config-path` | no | `./umactually.review.json` | Declared for wizard back-compat; **not forwarded to the CLI** as of action release 1.0.1 — the CLI auto-discovers `umactually.review.json` from cwd. |
| `output-artifact` | no | `umactually-review.json` | Path the CLI writes the review artifact to. |
| `skip-draft` | no | `'true'` | Declared for wizard back-compat; **not forwarded to the CLI** as of action release 1.0.1 — incremental review is per-PR via GitHub thread queries. |
| `paths-ignore` | no | `'**/*.md,docs/**,**/*.lock'` | Declared for wizard back-compat; **not forwarded to the CLI** as of action release 1.0.1 — the `--files` flag and the diff's own ignore list handle path filtering. |

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

The action reads `inputs.api-url` and `inputs.api-key` only. Pass repository secrets into those `with:` inputs in the calling workflow; the former `secrets.* || inputs.*` coalesce was removed in `JosiahSiegel/umactually-action@4d5a5f4`.

## CLI-flag passthrough

As of action release 1.0.1 (`JosiahSiegel/umactually-action@317613a`), the action forwards only these action inputs as CLI flags on the `umactually review` invocation:

- `--provider` ← `${{ inputs.provider }}` (always forwarded; default `openai-compatible`)
- `--model` ← `${{ inputs.model }}` (forwarded ONLY when non-empty; the action's default `""` would override the wizard's saved config if always forwarded)
- `--output-artifact` ← `${{ inputs.output-artifact }}` (default `umactually-review.json`)

The `config-path`, `skip-draft`, and `paths-ignore` inputs remain declared for backward compatibility with the wizard template and pre-v0.9.3 examples, but are no longer forwarded: the CLI auto-discovers `umactually.review.json` from cwd, incremental review is per-PR via GitHub thread queries, and the `--files` flag plus the diff's own ignore list handle path filtering. Passing them is dead config.

## GitHub Enterprise Server (GHES)

Supported. Set `GITHUB_API_URL=https://<your-ghe-host>/api/v3` (or your install's equivalent) on the runner; the action forwards it unchanged. The CLI rejects malformed values (non-HTTPS, userinfo, query/fragment) at the platform base boundary before any network call fires. See [`docs/gh-actions.md` § GitHub Enterprise Server](gh-actions.md#github-enterprise-server) for the per-feature contract.

## First-run secret bootstrap

If `UMACTUALLY_API_URL` or `UMACTUALLY_API_KEY` is empty on an opening/reopening/ready-for-review pull request event, the action posts an idempotent PR comment with the literal marker:

```html
<!-- umactually-bootstrap -->
```

followed by a short explanation of the two secrets to configure. **Idempotency is enforced via a marker guard**: before posting, the step queries existing PR comments (via `gh api .../issues/{n}/comments`) and searches for the marker (`grep -F '<!-- umactually-bootstrap -->'`). If a comment carrying the marker already exists, the post is skipped — so a reopened PR that previously received the bootstrap comment will not be spammed with a duplicate. On `synchronize` events the comment step is a no-op entirely. After the comment (or the no-op skip), the action exits with the typed error code `UMACTUALLY_ERR_SECRET_BOOTSTRAP` (3) — sourced from `src/util/exit-codes.ts` (`UMACTUALLY_EXIT_CODES.SECRET_BOOTSTRAP`). Branch-protection rules surface this as a required status check failure with a searchable, documented message.

## Branch-protection contract

Branch-protection rules branch on the action's three outputs:

- **`verdict`** — `success` when the review posted without a parse-fail sentinel; `failure` otherwise. This is the canonical required-check signal.
- **`inline-thread-count`** — informational; surfaced in the job summary for human reviewers. Zero is a successful clean review.
- **`review-id`** — opaque identifier; use it to correlate CI logs with the CLI's `--json` envelope (`metadata.requestId`).

The action exits with code 0 when `verdict === success`, code 3 when the first-run secret bootstrap fired (typed-error code `UMACTUALLY_ERR_SECRET_BOOTSTRAP`), and the CLI's own exit code (1, 2, 4, or 127) when the review itself failed. See [`docs/exit-codes.md`](exit-codes.md) for the full contract.

## Versioning / auto-update

The action ref itself should be SHA-pinned (`uses: JosiahSiegel/umactually-action@<full-sha>  # v1`) — see the install snippet above. Dependabot's `github-actions` ecosystem auto-updates both the `uses:` SHA and the `with:` block whenever a new release ships.

The action tracks the latest CLI release by default. The `cli-version` input's default value `__UMACTUALLY_VERSION__` is the substitution point the `umactually init` wizard rewrites on emit; running the action with the wizard's output pins the CLI to the release the wizard was built against (the CLI release used to generate the workflow).

To pin a specific CLI version, set `cli-version: <tag>` explicitly (e.g. `cli-version: 0.8.2`). To auto-update to the latest CLI release, enable Dependabot on your workflow file's `with:` block via a separate `dependabot.yml` — this is the operator's responsibility, not the action's. See [GitHub's Dependabot version updates guide](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates) for the `package-ecosystem: github-actions` config.

## Reference

- [`JosiahSiegel/umactually-action@v1`](https://github.com/JosiahSiegel/umactually-action/tree/v1) — the published action, input matrix, and outputs.
- [`src/util/exit-codes.ts`](../src/util/exit-codes.ts) — the typed-error code literals (`UMACTUALLY_ERR_SECRET_BOOTSTRAP`, `UMACTUALLY_ERR_PUBLISHER_UNVERIFIED`).
- [`docs/configuration.md`](configuration.md) — the committed `umactually.review.json` schema (the `config-path` input's payload).
- [`docs/onboarding/github-marketplace.md`](onboarding/github-marketplace.md) — the Marketplace listing copy.