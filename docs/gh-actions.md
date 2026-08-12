# GitHub Actions setup

Run UmActually as a version-pinned npm CLI in pull request workflows. Copy the canonical workflow from [`examples/github/pr-review.yml`](../examples/github/pr-review.yml) — do not edit inline copies of it.

## Setup

The canonical workflow uses Node.js 24, pinned via `actions/setup-node@v4`, and invokes the CLI once per pull request. `npx github:owner/repo#tag` resolves to the GitHub tarball at that ref, so the install is reproducible instead of tracking `main`. The `umactually` npm package is published via **Trusted Publishing (OIDC)** by the release workflow; install it with `npm install -g umactually` or pin to a specific tag with `npx umactually@X.Y.Z review`. See [`docs/release-process.md` § npm publication](release-process.md#55-npm-publication-post-github-release) for the publishing mechanism.

Do not use `pull_request_target`. It is not required to comment on a PR and can expose secrets to untrusted PR code.

## Permissions and token wiring

`contents: read` supports checkout and repository context discovery. `pull-requests: write` permits review and inline-comment updates. GitHub creates `${{ github.token }}`, but arbitrary `run:` steps only receive it when explicitly mapped to `GITHUB_TOKEN` in the step's `env:` block.

The canonical workflow uses a concurrency group keyed on `github.workflow + pull_request.number` with `cancel-in-progress: true`, so overlapping runs cancel and cannot race to update the marker-bearing comment.

## Provider secrets and CLI-native variables

Store `UMACTUALLY_API_URL` and `UMACTUALLY_API_KEY` as repository or organization Actions secrets. Never place credentials in YAML literals or command arguments.

Every documented `UMACTUALLY_*` env var is honored natively by the CLI, so optional behavior needs no shell forwarding. The full reference lives in [`docs/configuration.md`](configuration.md#review-options).

## GitHub Enterprise Server

GitHub Enterprise Server (GHES) is supported on the live review path. The runner-provided `GITHUB_API_URL` (or its `UMACTUALLY_GITHUB_API_BASE` provider override) is honored as the API base; REST endpoints are composed under the operator's path prefix (typically `/api/v3`) and the GraphQL endpoint resolves to `/api/graphql`. github.com remains the default when `GITHUB_API_URL` is unset.

Configuration is driven by the standard GitHub Actions runners: set `GITHUB_API_URL=https://<your-ghe-host>/api/v3` (or your install's equivalent) and `GITHUB_TOKEN` against the GHES instance. The CLI rejects malformed values (non-HTTPS, userinfo, query/fragment) at the platform base boundary before any network call fires.

Documented limitations:

- The Copilot `--provider copilot` flow has its own base (`UMACTUALLY_GITHUB_API_BASE` / `--github-api-base`) and is not auto-derived from `GITHUB_API_URL`. Operators running on GHES without Copilot support should leave the Copilot family unconfigured; the CLI will surface a typed error if `--provider copilot` is requested on an install that doesn't support it.
- The `umactually doctor full` probe adds a `github-ghes` check that hits `${GITHUB_API_URL}/meta` (or `/api/v3/meta`) to confirm version/capability. A 404 means the install does not expose the meta endpoint; review posting still works but version-specific features (e.g. newer inline suggestion formats) are unsupported.
- GHES version-specific behavior is not branched on; the CLI targets the same REST + GraphQL contract on github.com and GHES. If your install runs an older GHES release (pre-3.10), some REST media types may need a custom `Accept` header — file an issue and we'll add a version-aware shim.

## Next

- Verify pipeline with the canonical workflow at [`examples/github/pr-review.yml`](../examples/github/pr-review.yml).
- For parse-fail triage, automatic artifact validation, and concurrency notes, see [`docs/troubleshooting.md`](troubleshooting.md).
- For ADO-side integration, see [`docs/azure-devops.md`](azure-devops.md). For the ADO ↔ GitHub mirror sync, see [`docs/azure-devops.md#syncing-merged-github-prs-to-ado-main`](azure-devops.md#syncing-merged-github-prs-to-ado-main).
