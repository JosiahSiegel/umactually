# UmActually PR review

Provider-agnostic pull-request review from the UmActually CLI. SHA-pinned install, two repository secrets, ship.

## Install

```yaml
name: PR review
on:
  pull_request:
    branches: [main]
    paths: ["**.ts", "**.tsx", "**.js", "**.py", "**.go", "**.rs", "**.java", "**.rb", "**.yml", "**.json", "Dockerfile", "!.github/workflows/pr-review.yml"]
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
      - uses: JosiahSiegel/umactually-action@043d6070a43a5f61aa6ede9efe60d0f47b76fc58  # v1
        with:
          cli-version: 0.9.3
          provider: openai-compatible
          api-url: ${{ secrets.UMACTUALLY_API_URL }}
          api-key: ${{ secrets.UMACTUALLY_API_KEY }}
```

Secrets are forwarded via the `with:` inputs (`api-url`, `api-key`). Composite Actions cannot access the `secrets.` context; a `secrets:` block on `uses:` is not honored here.

## Why the SHA pin

`uses:` is pinned to a full commit SHA. Floating `@v1` accepts any future tag the action repo publishes; a compromised repo would run arbitrary code in your workflow with `pull-requests: write`. Enable Dependabot's `github-actions` ecosystem on the workflow file to auto-bump the SHA whenever a new release ships — no hand edits.

## What it does

Installs the pinned `umactually` CLI on Node.js 24; posts an idempotent first-run bootstrap comment (marker `<!-- umactually-bootstrap -->`) when secrets are missing, exiting with the typed error `UMACTUALLY_ERR_SECRET_BOOTSTRAP` (3); runs the live review with inline findings; emits `verdict` / `inline-thread-count` / `review-id` outputs for branch protection.

Full reference: [`docs/install-action.md`](../install-action.md).
