# GitHub Actions setup

Run UmActually as a version-pinned npm CLI in pull request workflows. Copy the slim canonical workflow from [`examples/github/pr-review.yml`](../examples/github/pr-review.yml).

## Minimal flow

Use Node 24, checkout the repository, and invoke the pinned CLI once. `npx` installs the CLI; repositories that do not otherwise need a `package.json` do not need a separate `npm ci` step.

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
        env:
          GITHUB_TOKEN: ${{ github.token }}
          UMACTUALLY_API_URL: ${{ secrets.UMACTUALLY_API_URL }}
          UMACTUALLY_API_KEY: ${{ secrets.UMACTUALLY_API_KEY }}
        # Pin to the v0.1.0 release tag. The umactually npm package is not
        # yet published; `npx github:owner/repo#tag` resolves to the GitHub
        # tarball at that ref so the install is reproducible.
        run: npx github:JosiahSiegel/umactually#v0.1.0 review --platform github
```

Do not use `pull_request_target`; it is unnecessary and can expose secrets to untrusted pull request code. Keep the npm version pinned and upgrade it deliberately after reviewing the release notes.

## Permissions and token wiring

`contents: read` supports checkout and repository context discovery. `pull-requests: write` permits review and inline-comment updates. GitHub creates `${{ github.token }}`, but arbitrary `run:` steps only receive it when explicitly mapped to `GITHUB_TOKEN`.

The concurrency key cancels obsolete runs for the same pull request, preventing overlapping reviews from racing to update the marker-bearing comment.

## Provider secrets and CLI-native variables

Store `UMACTUALLY_API_URL` and `UMACTUALLY_API_KEY` as repository or organization Actions secrets. Never place credentials in YAML literals or command arguments.

The CLI natively honors every `UMACTUALLY_*` env var, so optional behavior needs no shell forwarding. High-value settings include:

- `UMACTUALLY_PROVIDER`, `UMACTUALLY_MODEL`, and `UMACTUALLY_EFFORT`
- `UMACTUALLY_PROMPT_FILES` and `UMACTUALLY_ADDITIONAL_PROMPT_FILES`
- `UMACTUALLY_STRICT_SCHEMA` and `UMACTUALLY_VERIFY_FINDINGS`
- `UMACTUALLY_REVIEW_TIMEOUT_SECONDS`, `UMACTUALLY_STALL_SECONDS`, and `UMACTUALLY_MAX_OUTPUT_TOKENS`
- `UMACTUALLY_DETECT_LEAKS`, `UMACTUALLY_WALKTHROUGH`, and `UMACTUALLY_DRY_RUN`

For example, set `UMACTUALLY_STRICT_SCHEMA=false` in the review step's `env:` block to disable strict schema. Prompt-file lists accept comma- or newline-separated repository-relative paths and override the corresponding default lookup when non-empty.

## Automatic artifact validation

After every live review, the CLI validates the persisted review artifact automatically. A missing, malformed, contradictory, parse-failed, or otherwise unusable artifact fails the same review invocation. Do not add an `if: always()` `check-review-artifact` step.

The `check-review-artifact` subcommand remains available for manually validating an existing artifact, but it is not part of the normal pipeline flow.

## Parse-fail triage

A parse-fail diagnostic card is not approval.

1. Inspect review logs for provider status, endpoint attribution, and parse warnings.
2. Confirm provider URL, family, credential, and model compatibility.
3. If the gateway rejects strict JSON schema, set `UMACTUALLY_STRICT_SCHEMA=false`; local finding verification remains enabled.
4. Raise output or timeout budgets only when logs show truncation or exhaustion.
5. Re-run after correcting configuration; automatic artifact validation will enforce the result.

## GitHub Enterprise Server limitation

GitHub Enterprise Server is not supported in the first CLI-only release. Live requests use runner-provided `GITHUB_API_URL` or `https://api.github.com`, and the current test matrix covers GitHub.com only.
